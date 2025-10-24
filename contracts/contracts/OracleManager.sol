// SPDX-License-Identifier: MIT
// Author: hagiasofia

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./libraries/DataTypes.sol";

interface IPretiumOracle {
    function getRate(
        string memory currency_code
    ) external view returns (uint256 quotedRate, uint256 timestamp);
}

contract OracleManager is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MAX_PRICE_DEVIATION_BPS = 1000;
    uint256 public constant PRICE_STALENESS_THRESHOLD = 1 hours;
    uint256 public constant CIRCUIT_BREAKER_THRESHOLD = 5000;

    IPretiumOracle public pretiumOracle;

    mapping(address => DataTypes.AssetConfig) public assetConfigs;
    mapping(address => uint256) public lastValidPrice;
    mapping(address => uint256) public lastPriceUpdate;

    bool public emergencyMode;

    event PriceUpdated(
        address indexed token,
        uint256 price,
        uint256 timestamp,
        string source
    );
    event AssetConfigured(
        address indexed token,
        DataTypes.AssetType assetType,
        address chainlinkFeed,
        string pretiumCurrency
    );
    event CircuitBreakerTriggered(
        address indexed token,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 deviationBps
    );
    event EmergencyModeActivated(string reason);
    event EmergencyModeDeactivated();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _pretiumOracle) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        require(_pretiumOracle != address(0), "Invalid oracle");
        pretiumOracle = IPretiumOracle(_pretiumOracle);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function getPrice(address token) external view returns (uint256 price) {
        require(!emergencyMode, "Emergency mode");

        DataTypes.AssetConfig memory config = assetConfigs[token];
        require(config.enabled, "Unsupported asset");

        if (config.assetType == DataTypes.AssetType.USD_BACKED) {
            return _getChainlinkPrice(config);
        } else if (config.assetType == DataTypes.AssetType.LOCAL_CURRENCY) {
            return _getPretiumPrice(config);
        } else if (config.assetType == DataTypes.AssetType.DUAL_SOURCE) {
            return _getDualSourcePrice(config);
        }

        revert("Invalid type");
    }

    function _getChainlinkPrice(
        DataTypes.AssetConfig memory config
    ) internal view returns (uint256 price) {
        require(config.chainlinkFeed != address(0), "No feed");

        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            config.chainlinkFeed
        );

        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        require(answer > 0, "Invalid price");
        require(updatedAt > 0, "Incomplete round");
        require(answeredInRound >= roundId, "Stale answer");
        require(
            block.timestamp - updatedAt <= PRICE_STALENESS_THRESHOLD,
            "Stale price"
        );

        uint8 feedDecimals = priceFeed.decimals();
        price = _normalizePrice(uint256(answer), feedDecimals);
    }

    function _getPretiumPrice(
        DataTypes.AssetConfig memory config
    ) internal view returns (uint256 price) {
        require(bytes(config.pretiumCurrency).length > 0, "No currency");

        (uint256 rate, uint256 timestamp) = pretiumOracle.getRate(
            config.pretiumCurrency
        );

        require(rate > 0, "Invalid rate");
        require(
            block.timestamp - timestamp <= PRICE_STALENESS_THRESHOLD,
            "Stale price"
        );

        price = (PRECISION * 1e6) / rate;
    }

    function _getDualSourcePrice(
        DataTypes.AssetConfig memory config
    ) internal view returns (uint256 price) {
        uint256 chainlinkPrice = _getChainlinkPrice(config);
        uint256 pretiumPrice = _getPretiumPrice(config);

        uint256 deviation = _calculateDeviation(chainlinkPrice, pretiumPrice);
        require(deviation <= MAX_PRICE_DEVIATION_BPS, "Diverged");

        return (chainlinkPrice + pretiumPrice) / 2;
    }

    function _normalizePrice(
        uint256 price,
        uint8 decimals
    ) internal pure returns (uint256) {
        if (decimals == 18) {
            return price;
        } else if (decimals < 18) {
            return price * (10 ** (18 - decimals));
        } else {
            return price / (10 ** (decimals - 18));
        }
    }

    function _calculateDeviation(
        uint256 price1,
        uint256 price2
    ) internal pure returns (uint256) {
        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        uint256 avg = (price1 + price2) / 2;
        return (diff * 10000) / avg;
    }

    function configureUSDBackedAsset(
        address token,
        address chainlinkFeed,
        uint8 decimals
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            token != address(0) && chainlinkFeed != address(0),
            "Invalid input"
        );

        assetConfigs[token] = DataTypes.AssetConfig({
            assetType: DataTypes.AssetType.USD_BACKED,
            chainlinkFeed: chainlinkFeed,
            pretiumCurrency: "",
            decimals: decimals,
            enabled: true
        });

        emit AssetConfigured(
            token,
            DataTypes.AssetType.USD_BACKED,
            chainlinkFeed,
            ""
        );
    }

    function configureLocalCurrencyAsset(
        address token,
        string memory currencyCode,
        uint8 decimals
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            token != address(0) && bytes(currencyCode).length > 0,
            "Invalid input"
        );

        assetConfigs[token] = DataTypes.AssetConfig({
            assetType: DataTypes.AssetType.LOCAL_CURRENCY,
            chainlinkFeed: address(0),
            pretiumCurrency: currencyCode,
            decimals: decimals,
            enabled: true
        });

        emit AssetConfigured(
            token,
            DataTypes.AssetType.LOCAL_CURRENCY,
            address(0),
            currencyCode
        );
    }

    function configureDualSourceAsset(
        address token,
        address chainlinkFeed,
        string memory currencyCode,
        uint8 decimals
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            token != address(0) &&
                chainlinkFeed != address(0) &&
                bytes(currencyCode).length > 0,
            "Invalid input"
        );

        assetConfigs[token] = DataTypes.AssetConfig({
            assetType: DataTypes.AssetType.DUAL_SOURCE,
            chainlinkFeed: chainlinkFeed,
            pretiumCurrency: currencyCode,
            decimals: decimals,
            enabled: true
        });

        emit AssetConfigured(
            token,
            DataTypes.AssetType.DUAL_SOURCE,
            chainlinkFeed,
            currencyCode
        );
    }

    function setPretiumOracle(
        address _pretiumOracle
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_pretiumOracle != address(0), "Invalid address");
        pretiumOracle = IPretiumOracle(_pretiumOracle);
    }

    function setEmergencyMode(
        bool _emergency
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyMode = _emergency;
        if (_emergency) {
            emit EmergencyModeActivated("Admin");
        } else {
            emit EmergencyModeDeactivated();
        }
    }

    function disableAsset(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assetConfigs[token].enabled = false;
    }

    function getAssetConfig(
        address token
    ) external view returns (DataTypes.AssetConfig memory) {
        return assetConfigs[token];
    }

    function isPriceStale(address token) external view returns (bool) {
        return
            block.timestamp - lastPriceUpdate[token] >
            PRICE_STALENESS_THRESHOLD;
    }

    function getPretiumRate(
        string memory currencyCode
    ) external view returns (uint256 rate, uint256 timestamp) {
        return pretiumOracle.getRate(currencyCode);
    }
}

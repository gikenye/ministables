// SPDX-License-Identifier: MIT
// Author: 0xth3gh05t0fw1nt3r
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title BackendPriceOracle (UUPS upgradeable)
 * @notice Minimal on-chain oracle storage updated by an authorized backend.
 *         - Rates are USD per token, normalized to 1e18
 *         - Exposes getMedianRate(address) to match Ministables interface
 *         - Emits rich events for frontend indexing
 */
contract BackendPriceOracle is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // token => price (1e18), token => lastUpdated timestamp
    mapping(address => uint256) public rates;
    mapping(address => uint256) public lastUpdatedAt;

    // Authorized accounts allowed to push price updates
    mapping(address => bool) public isUpdater;

    // Index of known tokens (for off-chain discovery)
    address[] private knownTokens;
    mapping(address => bool) private isKnownToken;

    // Events for frontends/indexers
    event UpdaterSet(address indexed updater, bool allowed);
    event RateUpdated(address indexed token, uint256 rate, uint256 timestamp, address indexed updater);
    event RatesBatchUpdated(address indexed updater, address[] tokens, uint256 timestamp);
    event RateCleared(address indexed token, uint256 timestamp, address indexed updater);
    event TokenRegistered(address indexed token);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialUpdater) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        if (initialUpdater != address(0)) {
            isUpdater[initialUpdater] = true;
            emit UpdaterSet(initialUpdater, true);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    modifier onlyUpdaterOrOwner() {
        require(isUpdater[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    /**
     * @notice Set or revoke an updater address.
     */
    function setUpdater(address updater, bool allowed) external onlyOwner {
        require(updater != address(0), "Zero address");
        isUpdater[updater] = allowed;
        emit UpdaterSet(updater, allowed);
    }

    /**
     * @notice Update a single token rate.
     * @param token Token address updated
     * @param rate1e18 USD per token, 1e18-scaled
     */
    function setRate(address token, uint256 rate1e18) external onlyUpdaterOrOwner {
        require(token != address(0), "Invalid token");
        require(rate1e18 > 0, "Invalid rate");
        if (!isKnownToken[token]) {
            isKnownToken[token] = true;
            knownTokens.push(token);
            emit TokenRegistered(token);
        }
        rates[token] = rate1e18;
        lastUpdatedAt[token] = block.timestamp;
        emit RateUpdated(token, rate1e18, block.timestamp, msg.sender);
    }

    /**
     * @notice Batch update multiple token rates.
     */
    function setRatesBatch(address[] calldata tokens, uint256[] calldata rate1e18) external onlyUpdaterOrOwner {
        require(tokens.length == rate1e18.length, "Length mismatch");
        uint256 ts = block.timestamp;
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 rate = rate1e18[i];
            require(token != address(0) && rate > 0, "Invalid entry");
            if (!isKnownToken[token]) {
                isKnownToken[token] = true;
                knownTokens.push(token);
                emit TokenRegistered(token);
            }
            rates[token] = rate;
            lastUpdatedAt[token] = ts;
            emit RateUpdated(token, rate, ts, msg.sender);
        }
        emit RatesBatchUpdated(msg.sender, tokens, ts);
    }

    /**
     * @notice Clear a token's rate (sets to 0), useful in emergencies.
     */
    function clearRate(address token) external onlyUpdaterOrOwner {
        require(token != address(0), "Invalid token");
        rates[token] = 0;
        lastUpdatedAt[token] = block.timestamp;
        emit RateCleared(token, block.timestamp, msg.sender);
    }

    /**
     * @notice Returns all tokens that have ever been registered/updated.
     */
    function getKnownTokens() external view returns (address[] memory) {
        return knownTokens;
    }

    /**
     * @notice Read-only method matching the interface expected by `Ministables`.
     * @dev Returns (rate, timestamp). Reverts if no rate is present.
     */
    function getMedianRate(address token) external view returns (uint256 rate, uint256 timestamp) {
        rate = rates[token];
        require(rate != 0, "No price feed");
        timestamp = lastUpdatedAt[token];
    }
}


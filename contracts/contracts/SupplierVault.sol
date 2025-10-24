// SPDX-License-Identifier: MIT
// Author: hagiasofia

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/DataTypes.sol";
import "./interfaces/IAaveStrategy.sol";

contract SupplierVault is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 public constant STRATEGY_ROLE = keccak256("STRATEGY_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    uint256 public constant PRECISION = 1e18;
    uint256 public constant BPS_DIVISOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant MAX_DEPOSITS_PER_USER = 128;

    IERC20 public asset;
    uint8 private assetDecimals;
    bool public isAaveSupported;

    address public strategyAddress;

    DataTypes.ReserveData public reserveData;
    DataTypes.InterestRateModel public interestModel;

    mapping(address => mapping(uint256 => DataTypes.SupplierDeposit))
        public deposits;
    mapping(address => uint256) public depositCount;

    mapping(uint256 => DataTypes.LockTier) public lockTiers;
    uint256 public lockTierCount;

    uint256 public totalShares;
    mapping(address => uint256) public userTotalShares;

    uint256 public liquidityBuffer;
    uint256 public maxUtilizationRate;

    address public treasury;
    
    mapping(bytes32 => bool) public processedTxHashes;

    event Deposited(
        address indexed user,
        uint256 indexed depositId,
        uint256 amount,
        uint256 shares,
        uint256 lockTier
    );
    event Withdrawn(
        address indexed user,
        uint256 indexed depositId,
        uint256 amount,
        uint256 yield,
        uint256 sharesBurned
    );
    event YieldDistributed(uint256 amount, uint256 newInterestIndex);
    event InterestAccrued(uint256 borrowInterest, uint256 newIndex);
    event DepositPledgedStatusChanged(
        address indexed user,
        uint256 indexed depositId,
        bool pledged
    );
    event WithdrawalForLiquidation(
        address indexed user,
        uint256 indexed depositId,
        uint256 amount,
        address indexed liquidator
    );
    event StrategySet(address indexed oldStrategy, address indexed newStrategy);
    event AaveSupportUpdated(bool supported);
    event OnrampDeposit(
        address indexed user,
        uint256 indexed depositId,
        uint256 amount,
        uint256 shares,
        bytes32 indexed txHash
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _asset,
        string memory _name,
        string memory _symbol,
        uint256 _liquidityBuffer,
        uint256 _maxUtilization,
        address _treasury,
        bool _isAaveSupported
    ) external initializer {
        __ERC20_init(_name, _symbol);
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        require(_asset != address(0), "Invalid asset");
        require(_treasury != address(0), "Invalid treasury");

        asset = IERC20(_asset);
        assetDecimals = IERC20Metadata(_asset).decimals();
        liquidityBuffer = _liquidityBuffer;
        maxUtilizationRate = _maxUtilization;
        treasury = _treasury;
        isAaveSupported = _isAaveSupported;

        reserveData.interestIndex = PRECISION;
        reserveData.lastUpdateTime = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _addLockTier(0, 0);
        _addLockTier(30 days, 50);
        _addLockTier(90 days, 200);
        _addLockTier(180 days, 500);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function deposit(
        uint256 amount,
        uint256 lockTierId
    ) external nonReentrant returns (uint256 depositId) {
        require(amount > 0, "Zero amount");
        require(lockTierId < lockTierCount, "Invalid tier");
        require(lockTiers[lockTierId].active, "Inactive tier");
        require(
            depositCount[msg.sender] < MAX_DEPOSITS_PER_USER,
            "Max deposits"
        );

        _accrueInterest();

        uint256 shares = _convertToShares(amount);
        uint256 boostedShares = shares +
            (shares * lockTiers[lockTierId].yieldBoostBps) /
            BPS_DIVISOR;

        asset.safeTransferFrom(msg.sender, address(this), amount);

        depositId = depositCount[msg.sender]++;
        deposits[msg.sender][depositId] = DataTypes.SupplierDeposit({
            shares: boostedShares,
            principal: amount,
            depositTime: block.timestamp,
            lockEnd: block.timestamp + lockTiers[lockTierId].duration,
            lastInterestIndex: reserveData.interestIndex,
            pledgedAsCollateral: false
        });

        totalShares += boostedShares;
        userTotalShares[msg.sender] += boostedShares;
        reserveData.totalSupply += amount;

        _mint(msg.sender, boostedShares);

        emit Deposited(
            msg.sender,
            depositId,
            amount,
            boostedShares,
            lockTierId
        );
    }

    function allocateOnrampDeposit(
        address user,
        uint256 amount,
        bytes32 txHash
    ) external onlyRole(BACKEND_ROLE) nonReentrant returns (uint256 depositId) {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Zero amount");
        require(txHash != bytes32(0), "Invalid txHash");
        require(!processedTxHashes[txHash], "Already processed");
        require(
            depositCount[user] < MAX_DEPOSITS_PER_USER,
            "Max deposits"
        );

        uint256 balanceBefore = asset.balanceOf(address(this));
        require(balanceBefore >= amount, "Insufficient balance");

        _accrueInterest();

        uint256 shares = _convertToShares(amount);

        depositId = depositCount[user]++;
        deposits[user][depositId] = DataTypes.SupplierDeposit({
            shares: shares,
            principal: amount,
            depositTime: block.timestamp,
            lockEnd: block.timestamp,
            lastInterestIndex: reserveData.interestIndex,
            pledgedAsCollateral: false
        });

        totalShares += shares;
        userTotalShares[user] += shares;
        reserveData.totalSupply += amount;
        processedTxHashes[txHash] = true;

        _mint(user, shares);

        emit OnrampDeposit(user, depositId, amount, shares, txHash);
    }

    function withdraw(
        uint256 depositId
    ) external nonReentrant returns (uint256 amountWithdrawn) {
        DataTypes.SupplierDeposit storage dep = deposits[msg.sender][depositId];
        require(dep.shares > 0, "Not found");
        require(block.timestamp >= dep.lockEnd, "Locked");
        require(!dep.pledgedAsCollateral, "Pledged");

        _accrueInterest();

        uint256 currentValue = _convertToAssets(dep.shares);
        uint256 availableLiquidity = _getAvailableLiquidity();
        
        if (availableLiquidity < currentValue && strategyAddress != address(0) && isAaveSupported) {
            uint256 needed = currentValue - availableLiquidity;
            try IAaveStrategy(strategyAddress).withdraw(needed) {
                availableLiquidity = _getAvailableLiquidity();
            } catch {
                // Strategy withdrawal failed, proceed with available liquidity
            }
        }
        
        require(availableLiquidity >= currentValue, "Insufficient liquidity");

        totalShares -= dep.shares;
        userTotalShares[msg.sender] -= dep.shares;
        reserveData.totalSupply -= dep.principal;

        _burn(msg.sender, dep.shares);

        uint256 yieldEarned = currentValue > dep.principal
            ? currentValue - dep.principal
            : 0;
        delete deposits[msg.sender][depositId];

        asset.safeTransfer(msg.sender, currentValue);

        emit Withdrawn(
            msg.sender,
            depositId,
            dep.principal,
            yieldEarned,
            dep.shares
        );

        return currentValue;
    }

    function _accrueInterest() internal {
        if (block.timestamp == reserveData.lastUpdateTime) return;

        uint256 timeDelta = block.timestamp - reserveData.lastUpdateTime;

        if (reserveData.totalBorrows > 0) {
            uint256 borrowRate = _getBorrowRate();
            uint256 interestFactor = (borrowRate * timeDelta) /
                SECONDS_PER_YEAR;
            uint256 interestAccrued = (reserveData.totalBorrows *
                interestFactor) / PRECISION;

            reserveData.totalBorrows += interestAccrued;
            reserveData.totalReserves += (interestAccrued * 20) / 100;

            uint256 supplierInterest = (interestAccrued * 80) / 100;
            if (totalShares > 0) {
                uint256 indexDelta = (supplierInterest * PRECISION) /
                    totalShares;
                reserveData.interestIndex += indexDelta;
            }

            emit InterestAccrued(interestAccrued, reserveData.interestIndex);
        }

        reserveData.lastUpdateTime = block.timestamp;
    }

    function distributeYield(
        uint256 yieldAmount
    ) external onlyRole(STRATEGY_ROLE) {
        require(yieldAmount > 0, "Zero yield");
        require(isAaveSupported, "Asset not Aave supported");

        _accrueInterest();

        asset.safeTransferFrom(msg.sender, address(this), yieldAmount);

        if (totalShares > 0) {
            uint256 indexDelta = (yieldAmount * PRECISION) / totalShares;
            reserveData.interestIndex += indexDelta;
        }

        emit YieldDistributed(yieldAmount, reserveData.interestIndex);
    }

    function lend(
        address borrower,
        uint256 amount
    ) external onlyRole(CORE_ROLE) returns (bool) {
        _accrueInterest();

        uint256 utilizationAfter = ((reserveData.totalBorrows + amount) *
            PRECISION) / reserveData.totalSupply;
        require(utilizationAfter <= maxUtilizationRate, "High utilization");

        uint256 availableLiquidity = _getAvailableLiquidity();
        require(availableLiquidity >= amount, "Insufficient liquidity");

        reserveData.totalBorrows += amount;

        asset.safeTransfer(borrower, amount);

        return true;
    }

    function receiveRepayment(
        uint256 amount
    ) external onlyRole(CORE_ROLE) returns (bool) {
        _accrueInterest();

        asset.safeTransferFrom(msg.sender, address(this), amount);

        reserveData.totalBorrows = reserveData.totalBorrows > amount
            ? reserveData.totalBorrows - amount
            : 0;

        return true;
    }

    function setDepositPledged(
        address user,
        uint256 depositId,
        bool pledged
    ) external onlyRole(BRIDGE_ROLE) {
        require(deposits[user][depositId].shares > 0, "Not found");

        deposits[user][depositId].pledgedAsCollateral = pledged;

        emit DepositPledgedStatusChanged(user, depositId, pledged);
    }

    function withdrawForLiquidation(
        address user,
        uint256 depositId,
        uint256 amount
    ) external onlyRole(BRIDGE_ROLE) nonReentrant returns (uint256 withdrawn) {
        DataTypes.SupplierDeposit storage dep = deposits[user][depositId];
        require(dep.shares > 0, "Not found");
        require(dep.pledgedAsCollateral, "Not pledged");

        _accrueInterest();

        uint256 currentValue = _convertToAssets(dep.shares);
        uint256 withdrawAmount = amount > currentValue ? currentValue : amount;

        uint256 sharesToBurn = (dep.shares * withdrawAmount) / currentValue;

        totalShares -= sharesToBurn;
        userTotalShares[user] -= sharesToBurn;

        dep.shares -= sharesToBurn;
        dep.principal =
            (dep.principal * dep.shares) /
            (dep.shares + sharesToBurn);

        if (dep.shares == 0) {
            delete deposits[user][depositId];
        }

        _burn(user, sharesToBurn);

        asset.safeTransfer(msg.sender, withdrawAmount);

        emit WithdrawalForLiquidation(
            user,
            depositId,
            withdrawAmount,
            msg.sender
        );

        return withdrawAmount;
    }

    function _convertToShares(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalShares;
        return (supply == 0) ? assets : (assets * supply) / _totalAssets();
    }

    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        uint256 supply = totalShares;
        return (supply == 0) ? shares : (shares * _totalAssets()) / supply;
    }

    function _totalAssets() internal view returns (uint256) {
        return
            reserveData.totalSupply +
            reserveData.totalReserves -
            reserveData.totalBorrows;
    }

    function _getBorrowRate() internal view returns (uint256) {
        uint256 utilization = _getUtilizationRate();

        if (utilization <= interestModel.optimalUtilization) {
            return
                interestModel.baseRateBps *
                1e14 +
                (utilization * interestModel.slope1) /
                interestModel.optimalUtilization;
        } else {
            uint256 excessUtilization = utilization -
                interestModel.optimalUtilization;
            return
                interestModel.baseRateBps *
                1e14 +
                interestModel.slope1 +
                (excessUtilization * interestModel.slope2) /
                (PRECISION - interestModel.optimalUtilization);
        }
    }

    function _getUtilizationRate() internal view returns (uint256) {
        if (reserveData.totalSupply == 0) return 0;
        return (reserveData.totalBorrows * PRECISION) / reserveData.totalSupply;
    }

    function _getAvailableLiquidity() internal view returns (uint256) {
        uint256 cash = asset.balanceOf(address(this));
        return cash > liquidityBuffer ? cash - liquidityBuffer : 0;
    }

    function _addLockTier(uint256 duration, uint256 boostBps) internal {
        lockTiers[lockTierCount++] = DataTypes.LockTier({
            duration: duration,
            yieldBoostBps: boostBps,
            active: true
        });
    }

    function addLockTier(uint256 duration, uint256 boostBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addLockTier(duration, boostBps);
    }

    function setInterestModel(
        uint256 baseRate,
        uint256 optimalUtil,
        uint256 slope1,
        uint256 slope2
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        interestModel = DataTypes.InterestRateModel({
            baseRateBps: baseRate,
            optimalUtilization: optimalUtil,
            slope1: slope1,
            slope2: slope2
        });
    }

    function setLiquidityBuffer(
        uint256 newBuffer
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        liquidityBuffer = newBuffer;
    }

    function setTreasury(
        address newTreasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }

    function setStrategy(address _strategy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isAaveSupported, "Asset not Aave supported");
        address oldStrategy = strategyAddress;
        strategyAddress = _strategy;
        emit StrategySet(oldStrategy, _strategy);
    }

    function setAaveSupport(bool _supported) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isAaveSupported = _supported;
        emit AaveSupportUpdated(_supported);
    }

    function deployToStrategy(uint256 amount) external onlyRole(KEEPER_ROLE) {
        require(strategyAddress != address(0), "No strategy");
        require(isAaveSupported, "Aave not supported");
        require(amount > 0, "Zero amount");
        asset.safeTransfer(strategyAddress, amount);
    }

    function withdrawFromStrategy(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(strategyAddress != address(0), "No strategy");
        require(isAaveSupported, "Aave not supported");
        require(amount > 0, "Zero amount");
        (bool success, ) = strategyAddress.call(
            abi.encodeWithSignature("withdraw(uint256)", amount)
        );
        require(success, "Strategy withdraw failed");
    }

    function getUserDeposit(
        address user,
        uint256 depositId
    )
        external
        view
        returns (
            uint256 principal,
            uint256 currentValue,
            uint256 yieldEarned,
            uint256 lockEnd,
            bool canWithdraw
        )
    {
        DataTypes.SupplierDeposit memory dep = deposits[user][depositId];
        require(dep.shares > 0, "Not found");

        principal = dep.principal;
        currentValue = _convertToAssets(dep.shares);
        yieldEarned = currentValue > principal ? currentValue - principal : 0;
        lockEnd = dep.lockEnd;
        canWithdraw = block.timestamp >= lockEnd && !dep.pledgedAsCollateral;
    }

    function getSupplyAPY() external view returns (uint256) {
        uint256 borrowRate = _getBorrowRate();
        uint256 utilization = _getUtilizationRate();
        return (borrowRate * utilization * 80) / (PRECISION * 100);
    }

    function getBorrowRate() external view returns (uint256) {
        return _getBorrowRate();
    }

    function getAvailableLiquidity() external view returns (uint256) {
        return _getAvailableLiquidity();
    }

    function isDepositPledged(
        address user,
        uint256 depositId
    ) external view returns (bool) {
        return deposits[user][depositId].pledgedAsCollateral;
    }
}

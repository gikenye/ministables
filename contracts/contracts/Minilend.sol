// SPDX-License-Identifier: MIT
// Author: 0xth3gh05t0fw1nt3r

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";

interface ISortedOracles {
    function getMedianRate(address token) external view returns (uint256 rate, uint256 timestamp);
}

contract MiniLend {
    using SafeERC20 for IERC20;

    IPool public immutable aavePool;
    ISortedOracles public immutable oracles;
    IERC20 public immutable usdc;
    address public immutable treasury;
    address public owner;
    address[] public supportedStablecoins;
    address[] public supportedCollateral;
    address[] public dollarBackedTokens;

    // Configurable default lock periods (in seconds)
    uint256[] public defaultLockPeriods;
    uint256 public constant MIN_LOCK_PERIOD = 60; // 60 seconds for testing
    uint256 public constant MAX_LOCK_PERIOD = 365 days; // Max 1 year for safety

    // Existing constants
    uint256 public constant LIQUIDATION_THRESHOLD = 150;
    uint256 public constant LIQUIDATION_FEE = 5;
    uint256 public constant INTEREST_SHARE_PROTOCOL = 20;
    uint256 public constant INTEREST_SHARE_PROVIDERS = 80;
    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    uint256 public constant PRECISION = 1e18;

    // Storage
    mapping(address => mapping(address => uint256)) public userDeposits;
    mapping(address => mapping(address => uint256)) public userBorrows;
    mapping(address => mapping(address => uint256)) public userCollateral;
    mapping(address => mapping(address => uint256)) public depositLockEnd;
    mapping(address => mapping(address => uint256)) public contractReserves;
    mapping(address => uint256) public maxBorrowPerToken;
    mapping(address => uint256) public minReserveThreshold;
    mapping(address => bool) public isBorrowingPaused;
    mapping(address => mapping(address => uint256)) public borrowStartTime;
    mapping(address => uint256) public accumulatedInterest;
    mapping(address => uint256) public totalBorrows;
    mapping(address => uint256) public totalSupply;

    struct InterestRateParams {
        uint256 optimalUtilization;
        uint256 baseRate;
        uint256 slope1;
        uint256 slope2;
    }
    mapping(address => InterestRateParams) public interestRateParams;

    // Events
    event Supplied(address indexed user, address indexed token, uint256 amount, uint256 lockPeriod);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 interest);
    event CollateralDeposited(address indexed user, address indexed token, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, address indexed token, uint256 amount, uint256 collateralUsed);
    event Repaid(address indexed user, address indexed token, uint256 principal, uint256 interest);
    event Liquidated(address indexed user, address indexed token, uint256 debtAmount, uint256 collateralSeized, address collateralToken);
    event BorrowCapUpdated(address indexed token, uint256 oldCap, uint256 newCap);
    event ReserveThresholdUpdated(address indexed token, uint256 oldThreshold, uint256 newThreshold);
    event BorrowingPaused(address indexed token, bool paused);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event InterestRateParamsUpdated(address indexed token, uint256 optimalUtilization, uint256 baseRate, uint256 slope1, uint256 slope2);
    event BalanceUpdated(address indexed user, address indexed token, uint256 balance, uint256 yield);
    event DebugString(string message);
    event DebugAddress(string message, address value);
    event DebugUint(string message, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _poolAddressProvider,
        address _oracles,
        address _usdc,
        address[] memory _supportedStablecoins,
        address[] memory _supportedCollateral,
        address[] memory _dollarBackedTokens,
        uint256[] memory _maxBorrowPerToken,
        uint256[] memory _minReserveThreshold,
        address _treasury,
        uint256[] memory _optimalUtilizations,
        uint256[] memory _baseRates,
        uint256[] memory _slope1s,
        uint256[] memory _slope2s
    ) {
        require(_poolAddressProvider != address(0), "Invalid pool address provider");
        require(_oracles != address(0), "Invalid oracle address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_supportedStablecoins.length > 0, "No stablecoins provided");
        require(_supportedCollateral.length > 0, "No collateral provided");
        require(_dollarBackedTokens.length > 0, "No dollar-backed tokens provided");
        require(_supportedStablecoins.length == _maxBorrowPerToken.length, "Invalid borrow caps");
        require(_supportedStablecoins.length == _minReserveThreshold.length, "Invalid reserve thresholds");
        require(_supportedStablecoins.length == _optimalUtilizations.length, "Invalid optimal utilizations");
        require(_supportedStablecoins.length == _baseRates.length, "Invalid base rates");
        require(_supportedStablecoins.length == _slope1s.length, "Invalid slope1s");
        require(_supportedStablecoins.length == _slope2s.length, "Invalid slope2s");

        IPoolAddressesProvider provider = IPoolAddressesProvider(_poolAddressProvider);
        aavePool = IPool(provider.getPool());
        oracles = ISortedOracles(_oracles);
        usdc = IERC20(_usdc);
        treasury = _treasury;
        owner = msg.sender;
        supportedStablecoins = _supportedStablecoins;
        supportedCollateral = _supportedCollateral;
        dollarBackedTokens = _dollarBackedTokens;

        // Initialize default lock periods (30 days, 60 days, 120 days)
        defaultLockPeriods.push(30 days);
        defaultLockPeriods.push(60 days);
        defaultLockPeriods.push(120 days);

        for (uint256 i = 0; i < _supportedStablecoins.length; i++) {
            maxBorrowPerToken[_supportedStablecoins[i]] = _maxBorrowPerToken[i];
            minReserveThreshold[_supportedStablecoins[i]] = _minReserveThreshold[i];
            interestRateParams[_supportedStablecoins[i]] = InterestRateParams({
                optimalUtilization: _optimalUtilizations[i],
                baseRate: _baseRates[i],
                slope1: _slope1s[i],
                slope2: _slope2s[i]
            });
        }
    }

    function isValidLockPeriod(uint256 lockPeriod) internal view returns (bool) {
        if (lockPeriod >= MIN_LOCK_PERIOD && lockPeriod <= MAX_LOCK_PERIOD) {
            return true;
        }
        for (uint256 i = 0; i < defaultLockPeriods.length; i++) {
            if (lockPeriod == defaultLockPeriods[i]) {
                return true;
            }
        }
        return false;
    }

    function updateBorrowCap(address token, uint256 newCap) external onlyOwner {
        require(isSupportedStablecoin(token), "Unsupported stablecoin");
        require(newCap > 0, "Cap must be greater than 0");
        if (!isDollarBacked(token)) {
            uint256 totalReserves = totalSupply[token];
            require(newCap <= totalReserves, "Cap exceeds available reserves");
            require(newCap >= minReserveThreshold[token], "Cap below reserve threshold");
        }
        emit BorrowCapUpdated(token, maxBorrowPerToken[token], newCap);
        maxBorrowPerToken[token] = newCap;
    }

    function updateReserveThreshold(address token, uint256 newThreshold) external onlyOwner {
        require(isSupportedStablecoin(token), "Unsupported stablecoin");
        require(!isDollarBacked(token), "Only for non-dollar-backed tokens");
        uint256 totalReserves = totalSupply[token];
        require(newThreshold <= totalReserves, "Threshold exceeds reserves");
        require(newThreshold <= maxBorrowPerToken[token], "Threshold exceeds borrow cap");
        if (newThreshold == 0) {
            emit DebugString("Warning: Reserve threshold set to 0, borrowing may be paused");
        }
        emit ReserveThresholdUpdated(token, minReserveThreshold[token], newThreshold);
        minReserveThreshold[token] = newThreshold;
    }

    function updateInterestRateParams(
        address token,
        uint256 optimalUtilization,
        uint256 baseRate,
        uint256 slope1,
        uint256 slope2
    ) external onlyOwner {
        require(isSupportedStablecoin(token), "Unsupported stablecoin");
        require(optimalUtilization <= PRECISION, "Invalid optimal utilization");
        require(baseRate <= PRECISION, "Invalid base rate");
        require(slope1 <= PRECISION, "Invalid slope1");
        require(slope2 <= PRECISION, "Invalid slope2");
        interestRateParams[token] = InterestRateParams({
            optimalUtilization: optimalUtilization,
            baseRate: baseRate,
            slope1: slope1,
            slope2: slope2
        });
        emit InterestRateParamsUpdated(token, optimalUtilization, baseRate, slope1, slope2);
    }

    function pauseBorrowing(address token, bool paused) external onlyOwner {
        require(isSupportedStablecoin(token), "Unsupported stablecoin");
        require(!isDollarBacked(token), "Only for non-dollar-backed tokens");
        isBorrowingPaused[token] = paused;
        emit BorrowingPaused(token, paused);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function isDollarBacked(address token) internal view returns (bool) {
        for (uint256 i = 0; i < dollarBackedTokens.length; i++) {
            if (dollarBackedTokens[i] == token) return true;
        }
        return false;
    }

    function isSupportedStablecoin(address token) internal view returns (bool) {
        for (uint256 i = 0; i < supportedStablecoins.length; i++) {
            if (supportedStablecoins[i] == token) return true;
        }
        return false;
    }

    function isSupportedCollateral(address token) internal view returns (bool) {
        for (uint256 i = 0; i < supportedCollateral.length; i++) {
            if (supportedCollateral[i] == token) return true;
        }
        return false;
    }

    function getUtilizationRate(address token) internal view returns (uint256) {
        uint256 totalBorrowsForToken = totalBorrows[token];
        uint256 totalSupplyForToken = totalSupply[token];
        if (totalSupplyForToken == 0) return 0;
        return (totalBorrowsForToken * PRECISION) / totalSupplyForToken;
    }

    function getInterestRate(address token) internal view returns (uint256) {
        InterestRateParams memory params = interestRateParams[token];
        uint256 utilization = getUtilizationRate(token);
        if (utilization <= params.optimalUtilization) {
            return params.baseRate + (utilization * params.slope1) / params.optimalUtilization;
        } else {
            uint256 excessUtilization = utilization - params.optimalUtilization;
            uint256 excessDenominator = PRECISION - params.optimalUtilization;
            return params.baseRate + params.slope1 + (excessUtilization * params.slope2) / excessDenominator;
        }
    }

    function calculateInterest(uint256 principal, uint256 startTime, address token) internal view returns (uint256) {
        uint256 duration = block.timestamp - startTime;
        uint256 rate = getInterestRate(token);
        return (principal * rate * duration) / (PRECISION * SECONDS_PER_YEAR);
    }

    function validateOraclePrices(address token, address collateralToken)
        internal
        returns (uint256 tokenPrice, uint256 collateralPrice)
    {
        uint256 timestamp;
        uint256 collateralTimestamp;
        (tokenPrice, timestamp) = oracles.getMedianRate(token);
        require(tokenPrice > 0, "Invalid token price");
        require(timestamp >= block.timestamp - 1 hours, "Stale token price");
        emit DebugUint("liquidate: oracle tokenPrice", tokenPrice);
        emit DebugUint("liquidate: oracle timestamp", timestamp);

        (collateralPrice, collateralTimestamp) = oracles.getMedianRate(collateralToken);
        require(collateralPrice > 0, "Invalid collateral price");
        require(collateralTimestamp >= block.timestamp - 1 hours, "Stale collateral price");
        emit DebugUint("liquidate: oracle collateralPrice", collateralPrice);
        emit DebugUint("liquidate: oracle collateralTimestamp", collateralTimestamp);
    }

    function calculateCollateralToSeize(uint256 totalDebt, uint256 tokenPrice, uint256 collateralPrice)
        internal
        pure
        returns (uint256 collateralToSeize, uint256 feeAmount)
    {
        uint256 loanValue = (totalDebt * tokenPrice) / 1e18;
        uint256 debtValueWithFee = (loanValue * (100 + LIQUIDATION_FEE)) / 100;
        collateralToSeize = (debtValueWithFee * 1e6) / collateralPrice;
        feeAmount = (collateralToSeize * LIQUIDATION_FEE) / (100 + LIQUIDATION_FEE);
    }

    function deposit(address token, uint256 amount, uint256 lockPeriod) external {
        supply(token, amount, lockPeriod);
    }

    function depositCollateral(address token, uint256 amount) public {
        emit DebugString("depositCollateral: start");
        require(amount > 0, "Amount must be greater than 0");
        require(isSupportedCollateral(token), "Unsupported collateral");
        require(IERC20(token).balanceOf(msg.sender) >= amount, "Insufficient balance");
        emit DebugAddress("depositCollateral: token", token);
        emit DebugUint("depositCollateral: amount", amount);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if (isDollarBacked(token)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            try aavePool.supply(token, amount, address(this), 0) {
                userCollateral[msg.sender][token] += amount;
                emit DebugString("depositCollateral: Aave supply succeeded");
            } catch Error(string memory reason) {
                emit DebugString(string.concat("depositCollateral: Aave supply failed: ", reason));
                revert(string.concat("Aave supply failed: ", reason));
            }
        }
        emit CollateralDeposited(msg.sender, token, amount);
    }

    function depositUSDCollateral(uint256 amount) external {
        depositCollateral(address(usdc), amount);
    }

    function supply(address token, uint256 amount, uint256 lockPeriod) public {
        emit DebugString("supply: start");
        require(amount > 0, "Amount must be greater than 0");
        require(isValidLockPeriod(lockPeriod), "Invalid lock period");
        require(isSupportedStablecoin(token), "Unsupported stablecoin");
        require(IERC20(token).balanceOf(msg.sender) >= amount, "Insufficient balance");
        emit DebugAddress("supply: token", token);
        emit DebugUint("supply: amount", amount);
        emit DebugUint("supply: lockPeriod", lockPeriod);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if (isDollarBacked(token)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            try aavePool.supply(token, amount, address(this), 0) {
                emit DebugString("supply: Aave supply succeeded");
            } catch Error(string memory reason) {
                emit DebugString(string.concat("supply: Aave supply failed: ", reason));
                revert(string.concat("Aave supply failed: ", reason));
            }
        } else {
            contractReserves[msg.sender][token] += amount;
            emit DebugString("supply: added to contract reserves");
        }
        userDeposits[msg.sender][token] += amount;
        totalSupply[token] += amount;
        depositLockEnd[msg.sender][token] = block.timestamp + lockPeriod;
        emit Supplied(msg.sender, token, amount, lockPeriod);
    }

    function borrow(address token, uint256 amount, address collateralToken) external {
        emit DebugString("borrow: start");
        emit DebugAddress("borrow: token", token);
        emit DebugUint("borrow: amount", amount);
        emit DebugAddress("borrow: collateralToken", collateralToken);

        require(isSupportedStablecoin(token), "Unsupported stablecoin");
        require(isSupportedCollateral(collateralToken), "Unsupported collateral");
        require(amount > 0, "Amount must be greater than 0");
        require(userCollateral[msg.sender][collateralToken] > 0, "No collateral deposited");
        require(userBorrows[msg.sender][token] + amount <= maxBorrowPerToken[token], "Token borrow cap exceeded");
        require(!isBorrowingPaused[token], "Borrowing paused for token");
        emit DebugUint("borrow: user collateral", userCollateral[msg.sender][collateralToken]);

        (uint256 tokenPrice, uint256 timestamp) = oracles.getMedianRate(token);
        require(tokenPrice > 0, "Invalid oracle price");
        require(timestamp >= block.timestamp - 1 hours, "Stale oracle price");
        emit DebugUint("borrow: oracle tokenPrice", tokenPrice);
        emit DebugUint("borrow: oracle timestamp", timestamp);

        uint256 collateralValue = userCollateral[msg.sender][collateralToken] * 1e12;
        uint256 loanValue = (amount * tokenPrice) / 1e18;
        emit DebugUint("borrow: collateralValue", collateralValue);
        emit DebugUint("borrow: loanValue", loanValue);
        require(collateralValue >= (loanValue * LIQUIDATION_THRESHOLD) / 100, "Insufficient collateral");

        if (isDollarBacked(token)) {
            emit DebugString("borrow: calling aavePool.borrow for dollar-backed token");
            IERC20(token).forceApprove(address(aavePool), amount);
            try aavePool.borrow(token, amount, 2, 0, address(this)) {
                emit DebugString("borrow: Aave borrow succeeded");
            } catch Error(string memory reason) {
                emit DebugString(string.concat("borrow: Aave borrow failed: ", reason));
                revert(string.concat("Aave borrow failed: ", reason));
            }
        } else {
            emit DebugString("borrow: using contract reserves for non-dollar-backed token");
            uint256 totalReserves = totalSupply[token];
            require(totalReserves >= amount, "Insufficient contract reserves");
            require(totalReserves - amount >= minReserveThreshold[token], "Below reserve threshold");
            contractReserves[msg.sender][token] = sub(contractReserves[msg.sender][token], amount);
            emit DebugString("borrow: reserves updated");
        }

        userBorrows[msg.sender][token] += amount;
        totalBorrows[token] += amount;
        borrowStartTime[msg.sender][token] = block.timestamp;
        emit Borrowed(msg.sender, token, amount, userCollateral[msg.sender][collateralToken]);
    }

    function repay(address token, uint256 amount) external {
        emit DebugString("repay: start");
        emit DebugAddress("repay: token", token);
        emit DebugUint("repay: amount", amount);

        require(isSupportedStablecoin(token), "Unsupported stablecoin");
        require(amount > 0, "Amount must be greater than 0");
        uint256 userDebt = userBorrows[msg.sender][token];
        require(userDebt > 0, "No outstanding debt");
        uint256 interest = calculateInterest(userDebt, borrowStartTime[msg.sender][token], token);
        uint256 totalRepay = userDebt + interest;
        uint256 repayAmount = amount > totalRepay ? totalRepay : amount;
        require(IERC20(token).balanceOf(msg.sender) >= repayAmount, "Insufficient balance");
        emit DebugUint("repay: repayAmount", repayAmount);
        emit DebugUint("repay: userDebt", userDebt);
        emit DebugUint("repay: interest", interest);

        IERC20(token).safeTransferFrom(msg.sender, address(this), repayAmount);
        emit DebugString("repay: transferFrom succeeded");

        uint256 principalRepaid = repayAmount > interest ? repayAmount - interest : 0;
        uint256 interestRepaid = repayAmount > interest ? interest : repayAmount;

        if (interestRepaid > 0) {
            uint256 protocolShare = (interestRepaid * INTEREST_SHARE_PROTOCOL) / 100;
            uint256 providerShare = interestRepaid - protocolShare;
            IERC20(token).safeTransfer(treasury, protocolShare);
            if (isDollarBacked(token)) {
                IERC20(token).forceApprove(address(aavePool), providerShare);
                try aavePool.supply(token, providerShare, address(this), 0) {
                    emit DebugString("repay: interest supplied to Aave");
                } catch Error(string memory reason) {
                    emit DebugString(string.concat("repay: Aave supply failed: ", reason));
                    revert(string.concat("Aave supply failed: ", reason));
                }
            } else {
                accumulatedInterest[token] += providerShare;
                emit DebugString("repay: interest added to accumulatedInterest");
            }
        }

        if (principalRepaid > 0) {
            if (isDollarBacked(token)) {
                emit DebugString("repay: approving Aave for dollar-backed token");
                IERC20(token).forceApprove(address(aavePool), principalRepaid);
                try aavePool.repay(token, principalRepaid, 2, address(this)) returns (uint256 result) {
                    emit DebugUint("repay: aavePool.repay result", result);
                } catch Error(string memory reason) {
                    emit DebugString(string.concat("repay: Aave repay failed: ", reason));
                    revert(string.concat("Aave repay failed: ", reason));
                }
            } else {
                emit DebugString("repay: adding to contract reserves for non-dollar-backed token");
                contractReserves[msg.sender][token] += principalRepaid;
                totalSupply[token] += principalRepaid;
                uint256 totalReserves = totalSupply[token];
                if (totalReserves >= minReserveThreshold[token] && isBorrowingPaused[token]) {
                    isBorrowingPaused[token] = false;
                    emit BorrowingPaused(token, false);
                    emit DebugString("repay: reserves restored, borrowing unpaused");
                }
            }
            userBorrows[msg.sender][token] = sub(userBorrows[msg.sender][token], principalRepaid);
            totalBorrows[token] = sub(totalBorrows[token], principalRepaid);
        }

        if (repayAmount >= totalRepay) {
            borrowStartTime[msg.sender][token] = 0;
        }
        emit Repaid(msg.sender, token, principalRepaid, interestRepaid);
    }

    function withdraw(address token, uint256 amount) external {
        emit DebugString("withdraw: start");
        emit DebugAddress("withdraw: token", token);
        emit DebugUint("withdraw: amount", amount);

        require(amount > 0, "Amount must be greater than 0");
        for (uint256 i = 0; i < supportedStablecoins.length; i++) {
            require(userBorrows[msg.sender][supportedStablecoins[i]] == 0, "Repay loans before withdrawing");
        }

        uint256 interest = 0;
        if (isDollarBacked(token) && userCollateral[msg.sender][token] >= amount) {
            emit DebugString("withdraw: withdrawing collateral from Aave");
            try aavePool.withdraw(token, amount, msg.sender) {
                userCollateral[msg.sender][token] = sub(userCollateral[msg.sender][token], amount);
                emit CollateralWithdrawn(msg.sender, token, amount);
            } catch Error(string memory reason) {
                emit DebugString(string.concat("withdraw: Aave withdraw failed: ", reason));
                revert(string.concat("Aave withdraw failed: ", reason));
            }
        } else {
            emit DebugString("withdraw: withdrawing deposit");
            require(userDeposits[msg.sender][token] >= amount, "Insufficient deposit balance");
            require(block.timestamp >= depositLockEnd[msg.sender][token], "Deposit still locked");
            if (!isDollarBacked(token)) {
                require(contractReserves[msg.sender][token] >= amount, "Insufficient contract reserve");
                uint256 totalDeposits = totalSupply[token];
                if (totalDeposits > 0) {
                    interest = (accumulatedInterest[token] * userDeposits[msg.sender][token]) / totalDeposits;
                    accumulatedInterest[token] = sub(accumulatedInterest[token], interest);
                    IERC20(token).safeTransfer(msg.sender, interest);
                }
                contractReserves[msg.sender][token] = sub(contractReserves[msg.sender][token], amount);
                totalSupply[token] = sub(totalSupply[token], amount);
                uint256 totalReserves = totalSupply[token];
                if (totalReserves < minReserveThreshold[token]) {
                    isBorrowingPaused[token] = true;
                    emit BorrowingPaused(token, true);
                    emit DebugString("withdraw: reserves below threshold, borrowing paused");
                }
                IERC20(token).safeTransfer(msg.sender, amount);
            } else {
                try aavePool.withdraw(token, amount, msg.sender) {
                    emit DebugString("withdraw: Aave withdraw succeeded");
                } catch Error(string memory reason) {
                    emit DebugString(string.concat("withdraw: Aave withdraw failed: ", reason));
                    revert(string.concat("Aave withdraw failed: ", reason));
                }
                totalSupply[token] = sub(totalSupply[token], amount);
            }
            userDeposits[msg.sender][token] = sub(userDeposits[msg.sender][token], amount);
            if (userDeposits[msg.sender][token] == 0) {
                depositLockEnd[msg.sender][token] = 0;
            }
            emit Withdrawn(msg.sender, token, amount, interest);
        }
    }

    function liquidate(address user, address token, address collateralToken) external {
        emit DebugString("liquidate: start");
        emit DebugAddress("liquidate: user", user);
        emit DebugAddress("liquidate: token", token);
        emit DebugAddress("liquidate: collateralToken", collateralToken);

        require(isSupportedStablecoin(token), "Unsupported stablecoin");
        require(isSupportedCollateral(collateralToken), "Unsupported collateral");
        uint256 userDebt = userBorrows[user][token];
        require(userDebt > 0, "No outstanding debt");
        uint256 userCollateralAmount = userCollateral[user][collateralToken];
        require(userCollateralAmount > 0, "No collateral to seize");

        (uint256 tokenPrice, uint256 collateralPrice) = validateOraclePrices(token, collateralToken);

        uint256 interest = calculateInterest(userDebt, borrowStartTime[user][token], token);
        uint256 totalDebt = userDebt + interest;
        uint256 collateralValue = (userCollateralAmount * collateralPrice) / 1e6;
        uint256 loanValue = (totalDebt * tokenPrice) / 1e18;
        emit DebugUint("liquidate: loanValue", loanValue);
        emit DebugUint("liquidate: collateralValue", collateralValue);
        require(collateralValue < (loanValue * LIQUIDATION_THRESHOLD) / 100, "Not undercollateralized");

        (uint256 collateralToSeize, uint256 feeAmount) = calculateCollateralToSeize(totalDebt, tokenPrice, collateralPrice);
        require(collateralToSeize <= userCollateralAmount, "Insufficient collateral to seize");

        uint256 userReturn = sub(collateralToSeize, feeAmount);
        userCollateral[user][collateralToken] = sub(userCollateralAmount, collateralToSeize);
        userBorrows[user][token] = 0;
        totalBorrows[token] = sub(totalBorrows[token], userDebt);
        borrowStartTime[user][token] = 0;

        if (isDollarBacked(collateralToken)) {
            emit DebugString("liquidate: withdrawing collateral from Aave");
            try aavePool.withdraw(collateralToken, collateralToSeize, address(this)) {
                emit DebugString("liquidate: Aave withdraw succeeded");
            } catch Error(string memory reason) {
                emit DebugString(string.concat("liquidate: Aave withdraw failed: ", reason));
                revert(string.concat("Aave withdraw failed: ", reason));
            }
        }

        IERC20(collateralToken).safeTransfer(treasury, feeAmount);
        if (userReturn > 0) {
            IERC20(collateralToken).safeTransfer(user, userReturn);
        }

        if (interest > 0) {
            uint256 protocolShare = (interest * INTEREST_SHARE_PROTOCOL) / 100;
            uint256 providerShare = interest - protocolShare;
            IERC20(token).safeTransfer(treasury, protocolShare);
            if (isDollarBacked(token)) {
                IERC20(token).forceApprove(address(aavePool), providerShare);
                try aavePool.supply(token, providerShare, address(this), 0) {
                    emit DebugString("liquidate: interest supplied to Aave");
                } catch Error(string memory reason) {
                    emit DebugString(string.concat("liquidate: Aave supply failed: ", reason));
                    revert(string.concat("Aave supply failed: ", reason));
                }
            } else {
                accumulatedInterest[token] += providerShare;
                emit DebugString("liquidate: interest added to accumulatedInterest");
            }
        }

        if (isDollarBacked(token)) {
            IERC20(token).forceApprove(address(aavePool), userDebt);
            try aavePool.repay(token, userDebt, 2, address(this)) returns (uint256 result) {
                emit DebugUint("liquidate: aavePool.repay result", result);
            } catch Error(string memory reason) {
                emit DebugString(string.concat("liquidate: Aave repay failed: ", reason));
                revert(string.concat("Aave repay failed: ", reason));
            }
        } else {
            contractReserves[user][token] += userDebt;
            totalSupply[token] += userDebt;
            uint256 totalReserves = totalSupply[token];
            if (totalReserves >= minReserveThreshold[token] && isBorrowingPaused[token]) {
                isBorrowingPaused[token] = false;
                emit BorrowingPaused(token, false);
                emit DebugString("liquidate: reserves restored, borrowing unpaused");
            }
        }

        emit Liquidated(user, token, totalDebt, collateralToSeize, collateralToken);
    }

    function isUndercollateralized(address user, address token, address collateralToken) public view returns (bool) {
        uint256 userDebt = userBorrows[user][token];
        if (userDebt == 0) return false;
        uint256 userCollateralAmount = userCollateral[user][collateralToken];
        if (userCollateralAmount == 0) return true;

        (uint256 tokenPrice, uint256 timestamp) = oracles.getMedianRate(token);
        require(tokenPrice > 0, "Invalid token price");
        require(timestamp >= block.timestamp - 1 hours, "Stale token price");
        (uint256 collateralPrice, uint256 collateralTimestamp) = oracles.getMedianRate(collateralToken);
        require(collateralPrice > 0, "Invalid collateral price");
        require(collateralTimestamp >= block.timestamp - 1 hours, "Stale collateral price");

        uint256 interest = calculateInterest(userDebt, borrowStartTime[user][token], token);
        uint256 totalDebt = userDebt + interest;
        uint256 loanValue = (totalDebt * tokenPrice) / 1e18;
        uint256 collateralValue = (userCollateralAmount * collateralPrice) / 1e6;
        return collateralValue < (loanValue * LIQUIDATION_THRESHOLD) / 100;
    }

    function getUserBalance(address user, address token) external returns (uint256) {
        uint256 balance;
        uint256 yield;
        if (isDollarBacked(token)) {
            DataTypes.ReserveData memory reserveData = aavePool.getReserveData(token);
            address aTokenAddress = reserveData.aTokenAddress;
            uint256 aTokenBalance = IERC20(aTokenAddress).balanceOf(address(this));
            balance = userDeposits[user][token];
            yield = balance > 0 ? (aTokenBalance * balance) / IERC20(token).balanceOf(address(this)) - balance : 0;
        } else {
            balance = userDeposits[user][token];
            uint256 totalDeposits = totalSupply[token];
            yield = totalDeposits > 0 ? (accumulatedInterest[token] * balance) / totalDeposits : 0;
        }
        emit BalanceUpdated(user, token, balance, yield);
        return balance + yield;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(a >= b, "Subtraction underflow");
        return a - b;
    }
}
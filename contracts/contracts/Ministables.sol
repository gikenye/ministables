// SPDX-License-Identifier: MIT
// Author: 0xth3gh05t0fw1nt3r
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";

interface ISortedOracles {
    function getMedianRate(address token) external view returns (uint256 rate, uint256 timestamp);
}

contract Ministables is Initializable, UUPSUpgradeable, OwnableUpgradeable, AccessControlUpgradeable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // All state variables must be declared here and never reordered in future upgrades
    IPool public aavePool;
    ISortedOracles public oracles; 
    IERC20 public usdc;
    address public treasury;

    address[] public supportedStablecoins;
    address[] public supportedCollateral;
    address[] public dollarBackedTokens;
    uint256[] public defaultLockPeriods;

    uint256 public constant MIN_LOCK_PERIOD = 60;
    uint256 public constant MAX_LOCK_PERIOD = 365 days;
    uint256 public constant LIQUIDATION_THRESHOLD = 150;
    uint256 public constant LIQUIDATION_FEE = 5;
    uint256 public constant INTEREST_SHARE_PROTOCOL = 20;
    uint256 public constant INTEREST_SHARE_PROVIDERS = 80;
    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    uint256 public constant PRECISION = 1e18;

    struct Deposit {
        uint256 amount;
        uint256 lockEnd;
    }

    mapping(address => mapping(address => Deposit[])) public userDeposits;
    // Track if a specific deposit is pledged as collateral: user => token => depositIndex => isPledged
    mapping(address => mapping(address => mapping(uint256 => bool))) public depositPledgedStatus;
    mapping(address => mapping(address => uint256)) public userBorrows;
    mapping(address => mapping(address => uint256)) public userCollateral;
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
    event InterestRateParamsUpdated(address indexed token, uint256 optimalUtilization, uint256 baseRate, uint256 slope1, uint256 slope2);
    event OraclesUpdated(address indexed oldOracles, address indexed newOracles);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event BalanceUpdated(address indexed user, address indexed token, uint256 balance, uint256 yield);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
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
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __AccessControl_init();

        require(_poolAddressProvider != address(0), "E1"); // Invalid pool address provider
        require(_oracles != address(0), "E2"); // Invalid oracle address
        require(_usdc != address(0), "E3"); // Invalid USDC address
        require(_treasury != address(0), "E4"); // Invalid treasury address
        require(_supportedStablecoins.length > 0, "E5"); // No stablecoins provided
        require(_supportedCollateral.length > 0, "E6"); // No collateral provided
        require(_dollarBackedTokens.length > 0, "E7"); // No dollar-backed tokens provided
        require(_supportedStablecoins.length == _maxBorrowPerToken.length, "E8"); // Invalid borrow caps
        require(_supportedStablecoins.length == _minReserveThreshold.length, "E9"); // Invalid reserve thresholds
        require(_supportedStablecoins.length == _optimalUtilizations.length, "E10"); // Invalid optimal utilizations
        require(_supportedStablecoins.length == _baseRates.length, "E11"); // Invalid base rates
        require(_supportedStablecoins.length == _slope1s.length, "E12"); // Invalid slope1s
        require(_supportedStablecoins.length == _slope2s.length, "E13"); // Invalid slope2s

        IPoolAddressesProvider provider = IPoolAddressesProvider(_poolAddressProvider);
        aavePool = IPool(provider.getPool());
        oracles = ISortedOracles(_oracles);
        usdc = IERC20(_usdc);
        treasury = _treasury;

        supportedStablecoins = _supportedStablecoins;
        supportedCollateral = _supportedCollateral;
        dollarBackedTokens = _dollarBackedTokens;

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
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function updateOracles(address newOracles) external onlyOwner {
        require(newOracles != address(0), "E1"); // Invalid oracle address
        emit OraclesUpdated(address(oracles), newOracles);
        oracles = ISortedOracles(newOracles);
    }

    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "E1"); // Invalid treasury address
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
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
        require(isSupportedStablecoin(token), "E1"); // Unsupported stable
        require(newCap > 0, "E2"); // Cap must be greater than 0
        if (!isDollarBacked(token)) {
            uint256 totalReserves = totalSupply[token];
            require(newCap <= totalReserves, "E3"); // Cap exceeds available reserves
            require(newCap >= minReserveThreshold[token], "E4"); // Cap below reserve threshold
        }
        emit BorrowCapUpdated(token, maxBorrowPerToken[token], newCap);
        maxBorrowPerToken[token] = newCap;
    }

    function updateReserveThreshold(address token, uint256 newThreshold) external onlyOwner {
        require(isSupportedStablecoin(token), "E1"); // Unsupported stable
        require(!isDollarBacked(token), "E2"); // Only for non-dollar-backed tokens
        uint256 totalReserves = totalSupply[token];
        require(newThreshold <= totalReserves, "E3"); // Threshold exceeds reserves
        require(newThreshold <= maxBorrowPerToken[token], "E4"); // Threshold exceeds borrow cap
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
        require(isSupportedStablecoin(token), "E1"); // Unsupported stable
        require(optimalUtilization <= PRECISION, "E2"); // Invalid optimal utilization
        require(baseRate <= PRECISION, "E3"); // Invalid base rate
        require(slope1 <= PRECISION, "E4"); // Invalid slope1
        require(slope2 <= PRECISION, "E5"); // Invalid slope2
        interestRateParams[token] = InterestRateParams({
            optimalUtilization: optimalUtilization,
            baseRate: baseRate,
            slope1: slope1,
            slope2: slope2
        });
        emit InterestRateParamsUpdated(token, optimalUtilization, baseRate, slope1, slope2);
    }

    function pauseBorrowing(address token, bool paused) external onlyOwner {
        require(isSupportedStablecoin(token), "E1"); // Unsupported stable
        require(!isDollarBacked(token), "E2"); // Only for non-dollar-backed tokens
        isBorrowingPaused[token] = paused;
        emit BorrowingPaused(token, paused);
    }

    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "E1"); // Zero address
        emit OwnershipTransferred(owner(), newOwner);
        _transferOwnership(newOwner);
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

    function validateOraclePrices(address token, address collateralToken) view
        internal
        returns (uint256 tokenPrice, uint256 collateralPrice)
    {
        uint256 timestamp;
        uint256 collateralTimestamp;
        (tokenPrice, timestamp) = oracles.getMedianRate(token);
        require(tokenPrice > 0, "E1"); // Invalid token price
        require(timestamp >= block.timestamp - 1 hours, "E2"); // Stale token price
        (collateralPrice, collateralTimestamp) = oracles.getMedianRate(collateralToken);
        require(collateralPrice > 0, "E3"); // Invalid collateral price
        require(collateralTimestamp >= block.timestamp - 1 hours, "E4"); // Stale collateral price
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
        require(amount > 0, "E1"); // Amount must be greater than 0
        require(isSupportedCollateral(token), "E2"); // Unsupported collateral
        require(IERC20(token).balanceOf(msg.sender) >= amount, "E3"); // Insufficient balance
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if (isDollarBacked(token)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            try aavePool.supply(token, amount, address(this), 0) {
                userCollateral[msg.sender][token] += amount;
            } catch Error(string memory reason) {
                revert(string.concat("E4: ", reason)); // Aave supply failed
            }
        }
        emit CollateralDeposited(msg.sender, token, amount);
    }

    function depositUSDCollateral(uint256 amount) external {
        depositCollateral(address(usdc), amount);
    }

    function supply(address token, uint256 amount, uint256 lockPeriod) public {
        require(amount > 0, "E1"); // Amount must be greater than 0
        require(isValidLockPeriod(lockPeriod), "E2"); // Invalid lock period
        require(isSupportedStablecoin(token), "E3"); // Unsupported stablecoin
        require(IERC20(token).balanceOf(msg.sender) >= amount, "E4"); // Insufficient balance
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if (isDollarBacked(token)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            try aavePool.supply(token, amount, address(this), 0) {
            } catch Error(string memory reason) {
                revert(string.concat("E5: ", reason)); // Aave supply failed
            }
        } else {
            contractReserves[msg.sender][token] += amount;
        }
        userDeposits[msg.sender][token].push(Deposit({
            amount: amount,
            lockEnd: block.timestamp + lockPeriod
        }));
        totalSupply[token] += amount;
        emit Supplied(msg.sender, token, amount, lockPeriod);
    }

    function borrow(address token, uint256 amount, address collateralToken) external {
        require(isSupportedStablecoin(token), "E1"); // Unsupported stablecoin
        require(isSupportedCollateral(collateralToken), "E2"); // Unsupported collateral
        require(amount > 0, "E3"); // Amount must be greater than 0
        require(userCollateral[msg.sender][collateralToken] > 0, "E4"); // No collateral deposited
        require(userBorrows[msg.sender][token] + amount <= maxBorrowPerToken[token], "E5"); // Token borrow cap exceeded
        require(!isBorrowingPaused[token], "E6"); // Borrowing paused for token

        (uint256 tokenPrice, uint256 timestamp) = oracles.getMedianRate(token);
        require(tokenPrice > 0, "E7"); // Invalid oracle price
        require(timestamp >= block.timestamp - 1 hours, "E8"); // Stale oracle price

        uint256 collateralValue = userCollateral[msg.sender][collateralToken] * 1e12;
        uint256 loanValue = (amount * tokenPrice) / 1e18;
        require(collateralValue >= (loanValue * LIQUIDATION_THRESHOLD) / 100, "E9"); // Insufficient collateral

        if (isDollarBacked(token)) {
            IERC20(token).forceApprove(address(aavePool), amount);
            try aavePool.borrow(token, amount, 2, 0, address(this)) {
                IERC20(token).safeTransfer(msg.sender, amount);
            } catch Error(string memory reason) {
                revert(string.concat("E10: ", reason)); // Aave borrow failed
            }
        } else {
            uint256 totalReserves = totalSupply[token];
            require(totalReserves >= amount, "E11"); // Insufficient contract reserves
            require(totalReserves - amount >= minReserveThreshold[token], "E12"); // Below reserve threshold
            contractReserves[msg.sender][token] = sub(contractReserves[msg.sender][token], amount);
            IERC20(token).safeTransfer(msg.sender, amount);
        }
        userBorrows[msg.sender][token] += amount;
        totalBorrows[token] += amount;
        borrowStartTime[msg.sender][token] = block.timestamp;
        emit Borrowed(msg.sender, token, amount, userCollateral[msg.sender][collateralToken]);
    }

    function repay(address token, uint256 amount) external {
        require(isSupportedStablecoin(token), "E1"); // Unsupported stablecoin
        require(amount > 0, "E2"); // Amount must be greater than 0
        uint256 userDebt = userBorrows[msg.sender][token];
        require(userDebt > 0, "E3"); // No outstanding debt
        uint256 interest = calculateInterest(userDebt, borrowStartTime[msg.sender][token], token);
        uint256 totalRepay = userDebt + interest;
        uint256 repayAmount = amount > totalRepay ? totalRepay : amount;
        require(IERC20(token).balanceOf(msg.sender) >= repayAmount, "E4"); // Insufficient balance
        IERC20(token).safeTransferFrom(msg.sender, address(this), repayAmount);
        uint256 principalRepaid = repayAmount > interest ? repayAmount - interest : 0;
        uint256 interestRepaid = repayAmount > interest ? interest : repayAmount;
        if (interestRepaid > 0) {
            uint256 protocolShare = (interestRepaid * INTEREST_SHARE_PROTOCOL) / 100;
            uint256 providerShare = interestRepaid - protocolShare;
            IERC20(token).safeTransfer(treasury, protocolShare);
            if (isDollarBacked(token)) {
                IERC20(token).forceApprove(address(aavePool), providerShare);
                try aavePool.supply(token, providerShare, address(this), 0) {
                } catch Error(string memory reason) {
                    revert(string.concat("E5: ", reason)); // Aave supply failed
                }
            } else {
                accumulatedInterest[token] += providerShare;
            }
        }
        if (principalRepaid > 0) {
            if (isDollarBacked(token)) {
                IERC20(token).forceApprove(address(aavePool), principalRepaid);
                try aavePool.repay(token, principalRepaid, 2, address(this)) returns (uint256) {
                } catch Error(string memory reason) {
                    revert(string.concat("E6: ", reason)); // Aave repay failed
                }
            } else {
                contractReserves[msg.sender][token] += principalRepaid;
                totalSupply[token] += principalRepaid;
                uint256 totalReserves = totalSupply[token];
                if (totalReserves >= minReserveThreshold[token] && isBorrowingPaused[token]) {
                    isBorrowingPaused[token] = false;
                    emit BorrowingPaused(token, false);
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
        require(amount > 0, "E1"); // Amount must be greater than 0
        for (uint256 i = 0; i < supportedStablecoins.length; i++) {
            require(userBorrows[msg.sender][supportedStablecoins[i]] == 0, "E2"); // Repay loans before withdrawing
        }
        uint256 interest = 0;
        if (isDollarBacked(token) && userCollateral[msg.sender][token] >= amount) {
            try aavePool.withdraw(token, amount, msg.sender) {
                userCollateral[msg.sender][token] = sub(userCollateral[msg.sender][token], amount);
                emit CollateralWithdrawn(msg.sender, token, amount);
            } catch Error(string memory reason) {
                revert(string.concat("E3: ", reason)); // Aave withdraw failed
            }
        } else {
            uint256 totalWithdrawable = 0;
            Deposit[] storage deposits = userDeposits[msg.sender][token];
            for (uint256 i = 0; i < deposits.length; i++) {
                if (block.timestamp >= deposits[i].lockEnd) {
                    totalWithdrawable += deposits[i].amount;
                }
            }
            require(totalWithdrawable >= amount, "E4"); // Insufficient matured deposit balance
            if (!isDollarBacked(token)) {
                require(contractReserves[msg.sender][token] >= amount, "E5"); // Insufficient contract reserve
                uint256 totalDeposits = totalSupply[token];
                if (totalDeposits > 0) {
                    interest = (accumulatedInterest[token] * totalWithdrawable) / totalDeposits;
                    accumulatedInterest[token] = sub(accumulatedInterest[token], interest);
                    IERC20(token).safeTransfer(msg.sender, interest);
                }
                contractReserves[msg.sender][token] = sub(contractReserves[msg.sender][token], amount);
                totalSupply[token] = sub(totalSupply[token], amount);
                if (totalSupply[token] < minReserveThreshold[token]) {
                    isBorrowingPaused[token] = true;
                    emit BorrowingPaused(token, true);
                }
                IERC20(token).safeTransfer(msg.sender, amount);
            } else {
                try aavePool.withdraw(token, amount, msg.sender) {
                } catch Error(string memory reason) {
                    revert(string.concat("E6: ", reason)); // Aave withdraw failed
                }
                totalSupply[token] = sub(totalSupply[token], amount);
            }
            uint256 remainingAmount = amount;
            for (uint256 i = 0; i < deposits.length && remainingAmount > 0; i++) {
                if (block.timestamp >= deposits[i].lockEnd && !depositPledgedStatus[msg.sender][token][i]) {
                    if (deposits[i].amount <= remainingAmount) {
                        remainingAmount -= deposits[i].amount;
                        deposits[i].amount = 0;
                    } else {
                        deposits[i].amount -= remainingAmount;
                        remainingAmount = 0;
                    }
                }
            }
            require(remainingAmount == 0, "E7"); // Insufficient unpledged balance
            for (uint256 i = deposits.length; i > 0; i--) {
                if (deposits[i - 1].amount == 0) {
                    deposits[i - 1] = deposits[deposits.length - 1];
                    deposits.pop();
                }
            }
            emit Withdrawn(msg.sender, token, amount, interest);
        }
    }

    function liquidate(address user, address token, address collateralToken) external {
        require(isSupportedStablecoin(token), "E1"); // Unsupported stablecoin
        require(isSupportedCollateral(collateralToken), "E2"); // Unsupported collateral
        uint256 userDebt = userBorrows[user][token];
        require(userDebt > 0, "E3"); // No outstanding debt
        uint256 userCollateralAmount = userCollateral[user][collateralToken];
        require(userCollateralAmount > 0, "E4"); // No collateral to seize
        (uint256 tokenPrice, uint256 collateralPrice) = validateOraclePrices(token, collateralToken);
        uint256 interest = calculateInterest(userDebt, borrowStartTime[user][token], token);
        uint256 totalDebt = userDebt + interest;
        uint256 collateralValue = (userCollateralAmount * collateralPrice) / 1e6;
        uint256 loanValue = (totalDebt * tokenPrice) / 1e18;
        require(collateralValue < (loanValue * LIQUIDATION_THRESHOLD) / 100, "E5"); // Not undercollateralized
        (uint256 collateralToSeize, uint256 feeAmount) = calculateCollateralToSeize(totalDebt, tokenPrice, collateralPrice);
        require(collateralToSeize <= userCollateralAmount, "E6"); // Insufficient collateral to seize
        uint256 userReturn = sub(collateralToSeize, feeAmount);
        userCollateral[user][collateralToken] = sub(userCollateralAmount, collateralToSeize);
        userBorrows[user][token] = 0;
        totalBorrows[token] = sub(totalBorrows[token], userDebt);
        borrowStartTime[user][token] = 0;
        if (isDollarBacked(collateralToken)) {
            try aavePool.withdraw(collateralToken, collateralToSeize, address(this)) {
            } catch Error(string memory reason) {
                revert(string.concat("E7: ", reason)); // Aave withdraw failed
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
                } catch Error(string memory reason) {
                    revert(string.concat("E8: ", reason)); // Aave supply failed
                }
            } else {
                accumulatedInterest[token] += providerShare;
            }
        }
        if (isDollarBacked(token)) {
            IERC20(token).forceApprove(address(aavePool), userDebt);
            try aavePool.repay(token, userDebt, 2, address(this)) returns (uint256) {
            } catch Error(string memory reason) {
                revert(string.concat("E9: ", reason)); // Aave repay failed
            }
        } else {
            contractReserves[user][token] += userDebt;
            totalSupply[token] += userDebt;
            uint256 totalReserves = totalSupply[token];
            if (totalReserves >= minReserveThreshold[token] && isBorrowingPaused[token]) {
                isBorrowingPaused[token] = false;
                emit BorrowingPaused(token, false);
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
        require(tokenPrice > 0, "E1"); // Invalid token price
        require(timestamp >= block.timestamp - 1 hours, "E2"); // Stale token price
        (uint256 collateralPrice, uint256 collateralTimestamp) = oracles.getMedianRate(collateralToken);
        require(collateralPrice > 0, "E3"); // Invalid collateral price
        require(collateralTimestamp >= block.timestamp - 1 hours, "E4"); // Stale collateral price
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
            balance = 0;
            Deposit[] storage deposits = userDeposits[user][token];
            for (uint256 i = 0; i < deposits.length; i++) {
                balance += deposits[i].amount;
            }
            yield = balance > 0 ? (aTokenBalance * balance) / IERC20(token).balanceOf(address(this)) - balance : 0;
        } else {
            balance = 0;
            Deposit[] storage deposits = userDeposits[user][token];
            for (uint256 i = 0; i < deposits.length; i++) {
                balance += deposits[i].amount;
            }
            uint256 totalDeposits = totalSupply[token];
            yield = totalDeposits > 0 ? (accumulatedInterest[token] * balance) / totalDeposits : 0;
        }
        emit BalanceUpdated(user, token, balance, yield);
        return balance + yield;
    }

    // ========== SAVINGS COLLATERAL BRIDGE FUNCTIONS ==========
    
    /**
     * @notice Set the bridge contract role
     * @param bridge The bridge contract address
     */
    function grantBridgeRole(address bridge) external onlyOwner {
        require(bridge != address(0), "E1"); // Invalid bridge address
        _grantRole(BRIDGE_ROLE, bridge);
    }
    
    /**
     * @notice Revoke bridge role
     * @param bridge The bridge contract address
     */
    function revokeBridgeRole(address bridge) external onlyOwner {
        _revokeRole(BRIDGE_ROLE, bridge);
    }
    
    /**
     * @notice Get user deposits for a token (called by bridge)
     * @param user The user address
     * @param token The token address
     * @return deposits Array of deposits
     */
    function getUserDeposits(address user, address token) external view returns (Deposit[] memory) {
        return userDeposits[user][token];
    }
    
    /**
     * @notice Set pledge status for a deposit (only bridge can call)
     * @param user The user address
     * @param token The token address
     * @param depositIndex The index of the deposit
     * @param pledged True if pledged, false if unpledged
     */
    function setPledgeStatus(
        address user,
        address token,
        uint256 depositIndex,
        bool pledged
    ) external onlyRole(BRIDGE_ROLE) {
        require(depositIndex < userDeposits[user][token].length, "E1"); // Invalid deposit index
        depositPledgedStatus[user][token][depositIndex] = pledged;
    }
    
    /**
     * @notice Get pledge status for a deposit
     * @param user The user address
     * @param token The token address
     * @param depositIndex The index of the deposit
     * @return isPledged True if pledged, false otherwise
     */
    function getPledgeStatus(
        address user,
        address token,
        uint256 depositIndex
    ) external view returns (bool) {
        return depositPledgedStatus[user][token][depositIndex];
    }
    
    /**
     * @notice Withdraw a pledged deposit (only bridge can call during liquidation)
     * @param user The user whose deposit to withdraw
     * @param token The token address
     * @param amount The amount to withdraw
     * @param recipient The recipient address
     * @return interestEarned The interest earned on the withdrawal
     */
    function withdrawPledgedDeposit(
        address user,
        address token,
        uint256 amount,
        address recipient
    ) external onlyRole(BRIDGE_ROLE) returns (uint256 interestEarned) {
        require(amount > 0, "E1"); // Amount must be greater than 0
        require(recipient != address(0), "E2"); // Invalid recipient
        
        Deposit[] storage deposits = userDeposits[user][token];
        uint256 remainingAmount = amount;
        
        // Calculate and withdraw interest
        if (!isDollarBacked(token)) {
            uint256 totalDeposits = totalSupply[token];
            if (totalDeposits > 0 && contractReserves[user][token] >= amount) {
                interestEarned = (accumulatedInterest[token] * amount) / totalDeposits;
                if (interestEarned > 0) {
                    accumulatedInterest[token] = sub(accumulatedInterest[token], interestEarned);
                    IERC20(token).safeTransfer(recipient, interestEarned);
                }
            }
            contractReserves[user][token] = sub(contractReserves[user][token], amount);
            totalSupply[token] = sub(totalSupply[token], amount);
        }
        
        // Reduce deposit amounts (prioritize pledged deposits)
        for (uint256 i = 0; i < deposits.length && remainingAmount > 0; i++) {
            if (depositPledgedStatus[user][token][i] && block.timestamp >= deposits[i].lockEnd) {
                if (deposits[i].amount <= remainingAmount) {
                    remainingAmount -= deposits[i].amount;
                    deposits[i].amount = 0;
                    depositPledgedStatus[user][token][i] = false;
                } else {
                    deposits[i].amount -= remainingAmount;
                    remainingAmount = 0;
                }
            }
        }
        
        // Clean up empty deposits
        for (uint256 i = deposits.length; i > 0; i--) {
            if (deposits[i - 1].amount == 0) {
                deposits[i - 1] = deposits[deposits.length - 1];
                deposits.pop();
            }
        }
        
        // Transfer principal
        if (isDollarBacked(token)) {
            try aavePool.withdraw(token, amount, recipient) {
                totalSupply[token] = sub(totalSupply[token], amount);
            } catch Error(string memory reason) {
                revert(string.concat("E3: ", reason)); // Aave withdraw failed
            }
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
        
        return interestEarned;
    }
    
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(a >= b, "E1"); // Subtraction underflow
        return a - b;
    }
}

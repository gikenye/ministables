// SPDX-License-Identifier: MIT
// Author: hagiasofia

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/DataTypes.sol";

interface IOracleManager {
    function getPrice(address token) external view returns (uint256);
}

interface ISupplierVault {
    function lend(address borrower, uint256 amount) external returns (bool);
    function receiveRepayment(uint256 amount) external returns (bool);
    function getBorrowRate() external view returns (uint256);
    function asset() external view returns (address);
    function treasury() external view returns (address);
}

interface ISavingsCollateralBridge {
    function getSavingsCollateralValue(
        address user
    ) external view returns (uint256);
    function liquidateSavingsCollateral(
        address borrower,
        uint256 amountNeeded
    ) external returns (uint256);
}

contract BorrowerVault is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    uint256 public constant PRECISION = 1e18;
    uint256 public constant LIQUIDATION_BONUS_BPS = 1000;
    uint256 public constant PROTOCOL_LIQUIDATION_FEE_BPS = 500;

    IOracleManager public oracleManager;
    ISupplierVault public supplierVault;
    ISavingsCollateralBridge public savingsCollateralBridge;

    address public constant SAVINGS_COLLATERAL = address(1);

    mapping(address => mapping(address => DataTypes.CollateralDeposit))
        public collateral;
    mapping(address => mapping(uint256 => DataTypes.LoanPosition)) public loans;
    mapping(address => uint256) public loanCount;

    mapping(address => DataTypes.CollateralConfig) public collateralConfigs;
    address[] public supportedCollateralTokens;

    mapping(address => uint256) public maxBorrowPerUser;
    uint256 public globalDebtCeiling;
    uint256 public currentTotalDebt;

    mapping(address => bool) public supportedBorrowTokens;
    mapping(address => uint256) public borrowTokenLiquidity;

    event CollateralDeposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event CollateralWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event LoanOpened(
        address indexed user,
        uint256 indexed loanId,
        uint256 amount,
        address collateralToken
    );
    event LoanRepaid(
        address indexed user,
        uint256 indexed loanId,
        uint256 principal,
        uint256 interest
    );
    event Liquidated(
        address indexed user,
        uint256 indexed loanId,
        address indexed liquidator,
        uint256 debtCleared,
        uint256 collateralSeized
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _oracleManager,
        address _supplierVault,
        address _savingsCollateralBridge
    ) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        oracleManager = IOracleManager(_oracleManager);
        supplierVault = ISupplierVault(_supplierVault);
        savingsCollateralBridge = ISavingsCollateralBridge(
            _savingsCollateralBridge
        );

        globalDebtCeiling = 10_000_000e18;

        collateralConfigs[SAVINGS_COLLATERAL] = DataTypes.CollateralConfig({
            ltv: 75,
            liquidationThreshold: 80,
            liquidationPenalty: 10,
            enabled: true
        });
        supportedCollateralTokens.push(SAVINGS_COLLATERAL);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CORE_ROLE, msg.sender);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function depositCollateral(
        address token,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(collateralConfigs[token].enabled, "Unsupported");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        collateral[msg.sender][token].amount += amount;
        collateral[msg.sender][token].depositTime = block.timestamp;

        emit CollateralDeposited(msg.sender, token, amount);
    }

    function withdrawCollateral(
        address token,
        uint256 amount
    ) external nonReentrant {
        DataTypes.CollateralDeposit storage dep = collateral[msg.sender][token];
        require(dep.amount >= amount, "Insufficient");
        require(!dep.usedForBorrowing, "Locked");

        _checkCollateralSufficiency(msg.sender, token, amount);

        dep.amount -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, token, amount);
    }

    function borrow(
        address borrowToken,
        uint256 borrowAmount,
        address collateralToken
    ) external nonReentrant returns (uint256 loanId) {
        require(borrowAmount > 0, "Zero amount");
        require(supportedBorrowTokens[borrowToken], "Borrow token unsupported");
        require(collateralConfigs[collateralToken].enabled, "Collateral unsupported");
        require(borrowTokenLiquidity[borrowToken] >= borrowAmount, "Insufficient liquidity");

        uint256 availableCollateral;
        if (collateralToken == SAVINGS_COLLATERAL) {
            availableCollateral = savingsCollateralBridge
                .getSavingsCollateralValue(msg.sender);
            require(availableCollateral > 0, "No savings");
        } else {
            availableCollateral = collateral[msg.sender][collateralToken]
                .amount;
            require(availableCollateral > 0, "No collateral");
        }

        require(
            currentTotalDebt + borrowAmount <= globalDebtCeiling,
            "Debt ceiling"
        );

        uint256 collateralValue = _getCollateralValue(
            msg.sender,
            collateralToken
        );
        uint256 borrowValue = _getBorrowValue(borrowToken, borrowAmount);
        uint256 requiredCollateral = (borrowValue * 100) /
            collateralConfigs[collateralToken].ltv;

        require(
            collateralValue >= requiredCollateral,
            "Insufficient collateral"
        );

        uint256 borrowRate = supplierVault.getBorrowRate();

        IERC20(borrowToken).safeTransfer(msg.sender, borrowAmount);
        borrowTokenLiquidity[borrowToken] -= borrowAmount;

        loanId = loanCount[msg.sender]++;
        loans[msg.sender][loanId] = DataTypes.LoanPosition({
            principal: borrowAmount,
            accruedInterest: 0,
            lastUpdateTime: block.timestamp,
            interestRateAtBorrow: borrowRate,
            collateralToken: collateralToken,
            collateralAmount: requiredCollateral,
            active: true
        });

        if (collateralToken != SAVINGS_COLLATERAL) {
            collateral[msg.sender][collateralToken].usedForBorrowing = true;
        }

        currentTotalDebt += borrowAmount;

        emit LoanOpened(msg.sender, loanId, borrowAmount, collateralToken);
    }

    function repay(uint256 loanId, uint256 amount, address borrowToken) external nonReentrant {
        DataTypes.LoanPosition storage loan = loans[msg.sender][loanId];
        require(loan.active, "Inactive");

        _accrueInterest(msg.sender, loanId);

        uint256 totalDebt = loan.principal + loan.accruedInterest;
        uint256 repayAmount = amount > totalDebt ? totalDebt : amount;

        IERC20(borrowToken).safeTransferFrom(
            msg.sender,
            address(this),
            repayAmount
        );
        borrowTokenLiquidity[borrowToken] += repayAmount;

        uint256 interestPaid = repayAmount > loan.accruedInterest
            ? loan.accruedInterest
            : repayAmount;
        uint256 principalPaid = repayAmount - interestPaid;

        loan.accruedInterest -= interestPaid;
        loan.principal -= principalPaid;
        currentTotalDebt -= principalPaid;

        if (loan.principal == 0 && loan.accruedInterest == 0) {
            loan.active = false;
            collateral[msg.sender][loan.collateralToken]
                .usedForBorrowing = false;
        }

        emit LoanRepaid(msg.sender, loanId, principalPaid, interestPaid);
    }

    function repayWithSavings(uint256 loanId, address borrowToken) external nonReentrant {
        DataTypes.LoanPosition storage loan = loans[msg.sender][loanId];
        require(loan.active, "Inactive");
        require(loan.collateralToken == SAVINGS_COLLATERAL, "Not savings loan");

        _accrueInterest(msg.sender, loanId);

        uint256 totalDebt = loan.principal + loan.accruedInterest;
        uint256 borrowTokenPrice = oracleManager.getPrice(borrowToken);
        uint256 usdcPrice = oracleManager.getPrice(supplierVault.asset());
        
        // Calculate USDC needed to cover the debt value
        uint256 debtValueUSD = (totalDebt * borrowTokenPrice) / PRECISION;
        uint256 usdcNeeded = (debtValueUSD * PRECISION) / usdcPrice;

        // Seize USDC from user's savings (usdcNeeded is in 18 decimals, convert to 6, round up)
        uint256 usdcNeeded6Decimals = (usdcNeeded + 1e12 - 1) / 1e12;
        uint256 usdcSeized6Decimals = savingsCollateralBridge.liquidateSavingsCollateral(
            msg.sender,
            usdcNeeded6Decimals
        );

        // Convert seized USDC from 6 decimals to 18 decimals for calculation
        uint256 usdcSeized = usdcSeized6Decimals * 1e12;

        // Verify we seized enough USDC to cover the debt
        uint256 usdcSeizedValue = (usdcSeized * usdcPrice) / PRECISION;
        uint256 debtCovered = (usdcSeizedValue * PRECISION) / borrowTokenPrice;
        
        require(debtCovered >= totalDebt, "Insufficient USDC value");

        // Return the borrowToken to liquidity pool
        borrowTokenLiquidity[borrowToken] += totalDebt;

        // Send USDC to SupplierVault (protocol accepts USDC for cKES debt)
        address usdcToken = supplierVault.asset();
        IERC20(usdcToken).forceApprove(address(supplierVault), usdcSeized6Decimals);
        supplierVault.receiveRepayment(usdcSeized6Decimals);

        currentTotalDebt -= loan.principal;
        
        uint256 principalPaid = loan.principal;
        uint256 interestPaid = loan.accruedInterest;
        
        loan.principal = 0;
        loan.accruedInterest = 0;
        loan.active = false;

        emit LoanRepaid(msg.sender, loanId, principalPaid, interestPaid);
    }

    function liquidate(address borrower, uint256 loanId) external nonReentrant {
        DataTypes.LoanPosition storage loan = loans[borrower][loanId];
        require(loan.active, "Inactive");

        _accrueInterest(borrower, loanId);

        uint256 healthFactor = _getHealthFactor(borrower, loanId);
        require(healthFactor < PRECISION, "Healthy");

        uint256 totalDebt = loan.principal + loan.accruedInterest;

        uint256 collateralPrice;
        if (loan.collateralToken == SAVINGS_COLLATERAL) {
            collateralPrice = PRECISION;
        } else {
            collateralPrice = oracleManager.getPrice(loan.collateralToken);
        }

        uint256 borrowPrice = oracleManager.getPrice(supplierVault.asset());

        uint256 debtValueUSD = (totalDebt * borrowPrice) / PRECISION;
        uint256 collateralToSeize = (debtValueUSD * PRECISION) /
            collateralPrice;

        uint256 bonusAmount = (collateralToSeize * LIQUIDATION_BONUS_BPS) /
            10000;
        uint256 protocolFee = (collateralToSeize *
            PROTOCOL_LIQUIDATION_FEE_BPS) / 10000;
        uint256 totalSeized = collateralToSeize + bonusAmount + protocolFee;

        require(
            totalSeized <= loan.collateralAmount,
            "Insufficient collateral"
        );

        address borrowToken = supplierVault.asset();
        IERC20(borrowToken).safeTransferFrom(
            msg.sender,
            address(this),
            totalDebt
        );
        IERC20(borrowToken).forceApprove(address(supplierVault), totalDebt);
        supplierVault.receiveRepayment(totalDebt);

        if (loan.collateralToken == SAVINGS_COLLATERAL) {
            savingsCollateralBridge.liquidateSavingsCollateral(
                borrower,
                totalSeized
            );

            address asset = supplierVault.asset();
            IERC20(asset).safeTransfer(
                msg.sender,
                collateralToSeize + bonusAmount
            );
            IERC20(asset).safeTransfer(supplierVault.treasury(), protocolFee);
        } else {
            IERC20(loan.collateralToken).safeTransfer(
                msg.sender,
                collateralToSeize + bonusAmount
            );
            IERC20(loan.collateralToken).safeTransfer(
                supplierVault.treasury(),
                protocolFee
            );

            uint256 remaining = loan.collateralAmount - totalSeized;
            if (remaining > 0) {
                IERC20(loan.collateralToken).safeTransfer(borrower, remaining);
            }

            collateral[borrower][loan.collateralToken].amount -= loan
                .collateralAmount;
            collateral[borrower][loan.collateralToken].usedForBorrowing = false;
        }

        currentTotalDebt -= loan.principal;
        loan.active = false;

        emit Liquidated(borrower, loanId, msg.sender, totalDebt, totalSeized);
    }

    function _accrueInterest(address user, uint256 loanId) internal {
        DataTypes.LoanPosition storage loan = loans[user][loanId];

        uint256 timeDelta = block.timestamp - loan.lastUpdateTime;
        if (timeDelta == 0) return;

        uint256 interest = (loan.principal *
            loan.interestRateAtBorrow *
            timeDelta) / (PRECISION * 365 days);

        loan.accruedInterest += interest;
        loan.lastUpdateTime = block.timestamp;
    }

    function _getHealthFactor(
        address user,
        uint256 loanId
    ) internal view returns (uint256) {
        DataTypes.LoanPosition memory loan = loans[user][loanId];

        uint256 collateralValue = _getCollateralValue(
            user,
            loan.collateralToken
        );
        uint256 totalDebt = loan.principal + loan.accruedInterest;
        uint256 debtValue = _getBorrowValue(supplierVault.asset(), totalDebt);

        uint256 liquidationThreshold = collateralConfigs[loan.collateralToken]
            .liquidationThreshold;
        uint256 maxDebt = (collateralValue * liquidationThreshold) / 100;

        return (maxDebt * PRECISION) / debtValue;
    }

    function _getCollateralValue(
        address user,
        address token
    ) internal view returns (uint256) {
        if (token == SAVINGS_COLLATERAL) {
            return savingsCollateralBridge.getSavingsCollateralValue(user);
        } else {
            uint256 amount = collateral[user][token].amount;
            uint256 price = oracleManager.getPrice(token);
            return (amount * price) / PRECISION;
        }
    }

    function _getBorrowValue(
        address token,
        uint256 amount
    ) internal view returns (uint256) {
        uint256 price = oracleManager.getPrice(token);
        return (amount * price) / PRECISION;
    }

    function _checkCollateralSufficiency(
        address user,
        address token,
        uint256 withdrawAmount
    ) internal view {
        uint256 count = loanCount[user];
        for (uint256 i = 0; i < count; i++) {
            if (
                loans[user][i].active && loans[user][i].collateralToken == token
            ) {
                uint256 remainingCollateral = collateral[user][token].amount -
                    withdrawAmount;
                uint256 remainingValue = (remainingCollateral *
                    oracleManager.getPrice(token)) / PRECISION;

                uint256 debtValue = _getBorrowValue(
                    supplierVault.asset(),
                    loans[user][i].principal + loans[user][i].accruedInterest
                );

                uint256 requiredValue = (debtValue * 100) /
                    collateralConfigs[token].ltv;
                require(remainingValue >= requiredValue, "Undercollateralized");
            }
        }
    }

    function addCollateralToken(
        address token,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationPenalty
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!collateralConfigs[token].enabled, "Exists");

        collateralConfigs[token] = DataTypes.CollateralConfig({
            ltv: ltv,
            liquidationThreshold: liquidationThreshold,
            liquidationPenalty: liquidationPenalty,
            enabled: true
        });

        supportedCollateralTokens.push(token);
    }

    function setSavingsCollateralBridge(
        address _bridge
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bridge != address(0), "Invalid address");
        savingsCollateralBridge = ISavingsCollateralBridge(_bridge);
    }

    function addBorrowToken(
        address token
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "Invalid address");
        supportedBorrowTokens[token] = true;
    }

    function depositLiquidity(
        address token,
        uint256 amount
    ) external onlyRole(CORE_ROLE) {
        require(supportedBorrowTokens[token], "Unsupported token");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        borrowTokenLiquidity[token] += amount;
    }

    function withdrawLiquidity(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(borrowTokenLiquidity[token] >= amount, "Insufficient liquidity");
        borrowTokenLiquidity[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    function getUserLoan(
        address user,
        uint256 loanId
    )
        external
        view
        returns (
            uint256 principal,
            uint256 interest,
            uint256 healthFactor,
            bool active
        )
    {
        DataTypes.LoanPosition memory loan = loans[user][loanId];

        uint256 timeDelta = block.timestamp - loan.lastUpdateTime;
        uint256 currentInterest = loan.accruedInterest +
            (loan.principal * loan.interestRateAtBorrow * timeDelta) /
            (PRECISION * 365 days);

        return (
            loan.principal,
            currentInterest,
            _getHealthFactor(user, loanId),
            loan.active
        );
    }
}

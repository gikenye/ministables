// SPDX-License-Identifier: MIT
// Author: hagiasofia

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISupplierVault {
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
        );
    function depositCount(address user) external view returns (uint256);
    function setDepositPledged(
        address user,
        uint256 depositId,
        bool pledged
    ) external;
    function withdrawForLiquidation(
        address user,
        uint256 depositId,
        uint256 amount
    ) external returns (uint256);
    function asset() external view returns (address);
}

interface IBorrowerVault {
    function loanCount(address user) external view returns (uint256);
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
        );
}

contract SavingsCollateralBridge is
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant BORROWER_VAULT_ROLE =
        keccak256("BORROWER_VAULT_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    uint256 public constant PRECISION = 1e18;

    ISupplierVault public supplierVault;
    IBorrowerVault public borrowerVault;

    mapping(address => uint256) public totalPledgedAmount;
    mapping(address => mapping(uint256 => uint256)) public pledgedByDeposit;
    mapping(address => mapping(uint256 => bool)) public isDepositPledged;

    bool public pledgingPaused;
    bool public unpledgingPaused;
    
    uint256 public constant MIN_HEALTH_FACTOR = 1e18;

    event SavingsPledged(
        address indexed user,
        uint256[] depositIds,
        uint256 totalAmount,
        uint256 collateralValue
    );
    event SavingsUnpledged(
        address indexed user,
        uint256[] depositIds,
        uint256 totalAmount
    );
    event SavingsLiquidated(
        address indexed borrower,
        address indexed liquidator,
        uint256 amount,
        uint256[] depositIds
    );
    event PledgingPaused(bool paused);
    event UnpledgingPaused(bool paused);
    event BorrowerVaultUpdated(address indexed newVault);
    event SupplierVaultUpdated(address indexed newVault);
    event EmergencyWithdrawal(address indexed token, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _supplierVault,
        address _borrowerVault
    ) external initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        require(
            _supplierVault != address(0) && _borrowerVault != address(0),
            "Invalid input"
        );

        supplierVault = ISupplierVault(_supplierVault);
        borrowerVault = IBorrowerVault(_borrowerVault);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function pledgeSavingsAsCollateral(
        uint256[] calldata depositIds,
        uint256[] calldata amounts
    ) external nonReentrant returns (uint256 totalCollateralValue) {
        require(!pledgingPaused, "Paused");
        require(
            depositIds.length > 0 && depositIds.length == amounts.length,
            "Invalid input"
        );

        uint256 totalPledged = 0;

        for (uint256 i = 0; i < depositIds.length; i++) {
            uint256 depositId = depositIds[i];
            uint256 amount = amounts[i];

            require(amount > 0, "Zero amount");

            (, uint256 currentValue, , , bool canWithdraw) = supplierVault
                .getUserDeposit(msg.sender, depositId);

            require(canWithdraw, "Locked");
            require(currentValue > 0, "Not found");

            uint256 alreadyPledged = pledgedByDeposit[msg.sender][depositId];
            uint256 available = currentValue > alreadyPledged
                ? currentValue - alreadyPledged
                : 0;

            require(available >= amount, "Insufficient");

            pledgedByDeposit[msg.sender][depositId] += amount;
            totalPledged += amount;

            if (!isDepositPledged[msg.sender][depositId]) {
                isDepositPledged[msg.sender][depositId] = true;
                supplierVault.setDepositPledged(msg.sender, depositId, true);
            }
        }

        totalPledgedAmount[msg.sender] += totalPledged;
        totalCollateralValue = totalPledged;

        emit SavingsPledged(
            msg.sender,
            depositIds,
            totalPledged,
            totalCollateralValue
        );
    }

    function unpledgeSavingsCollateral(
        uint256[] calldata depositIds,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(!unpledgingPaused, "Paused");
        require(
            depositIds.length > 0 && depositIds.length == amounts.length,
            "Invalid input"
        );

        uint256 totalUnpledged = 0;

        for (uint256 i = 0; i < depositIds.length; i++) {
            uint256 depositId = depositIds[i];
            uint256 amount = amounts[i];

            require(amount > 0, "Zero amount");
            require(isDepositPledged[msg.sender][depositId], "Not pledged");

            uint256 pledged = pledgedByDeposit[msg.sender][depositId];
            require(pledged >= amount, "Insufficient");

            pledgedByDeposit[msg.sender][depositId] -= amount;
            totalUnpledged += amount;

            if (pledgedByDeposit[msg.sender][depositId] == 0) {
                isDepositPledged[msg.sender][depositId] = false;
                supplierVault.setDepositPledged(msg.sender, depositId, false);
            }
        }

        totalPledgedAmount[msg.sender] -= totalUnpledged;

        _checkCollateralSufficiency(msg.sender);

        emit SavingsUnpledged(msg.sender, depositIds, totalUnpledged);
    }

    function liquidateSavingsCollateral(
        address borrower,
        uint256 amountNeeded
    )
        external
        onlyRole(BORROWER_VAULT_ROLE)
        nonReentrant
        returns (uint256 amountSeized)
    {
        require(amountNeeded > 0, "Zero amount");
        require(totalPledgedAmount[borrower] > 0, "No collateral");

        uint256 remainingToSeize = amountNeeded;
        uint256 totalSeized = 0;
        uint256 depositCount = supplierVault.depositCount(borrower);
        require(depositCount <= 500, "Too many deposits");
        
        uint256[] memory seizedDepositIds = new uint256[](depositCount);
        uint256 seizedCount = 0;

        for (uint256 i = 0; i < depositCount && remainingToSeize > 0; i++) {
            if (isDepositPledged[borrower][i]) {
                uint256 pledgedAmount = pledgedByDeposit[borrower][i];

                if (pledgedAmount > 0) {
                    (, uint256 currentValue, , , ) = supplierVault
                        .getUserDeposit(borrower, i);

                    uint256 seizeAmount = remainingToSeize > currentValue
                        ? currentValue
                        : remainingToSeize;

                    uint256 withdrawn = supplierVault.withdrawForLiquidation(
                        borrower,
                        i,
                        seizeAmount
                    );

                    require(withdrawn <= pledgedAmount, "Withdrawal exceeds pledged");
                    pledgedByDeposit[borrower][i] -= withdrawn;

                    if (pledgedByDeposit[borrower][i] == 0) {
                        isDepositPledged[borrower][i] = false;
                    }

                    totalSeized += withdrawn;
                    remainingToSeize -= withdrawn;
                    seizedDepositIds[seizedCount++] = i;
                }
            }
        }

        require(totalSeized <= totalPledgedAmount[borrower], "Seized exceeds pledged");
        totalPledgedAmount[borrower] -= totalSeized;

        uint256[] memory finalSeizedIds = new uint256[](seizedCount);
        for (uint256 i = 0; i < seizedCount; i++) {
            finalSeizedIds[i] = seizedDepositIds[i];
        }

        emit SavingsLiquidated(
            borrower,
            msg.sender,
            totalSeized,
            finalSeizedIds
        );

        return totalSeized;
    }

    function getSavingsCollateralValue(
        address user
    ) external view returns (uint256 totalValue) {
        return totalPledgedAmount[user];
    }

    function getDepositPledgeInfo(
        address user,
        uint256 depositId
    )
        external
        view
        returns (
            uint256 pledgedAmount,
            uint256 currentValue,
            uint256 availableToPledge
        )
    {
        pledgedAmount = pledgedByDeposit[user][depositId];

        (, currentValue, , , ) = supplierVault.getUserDeposit(user, depositId);

        availableToPledge = currentValue > pledgedAmount
            ? currentValue - pledgedAmount
            : 0;
    }

    function getUserPledgedDeposits(
        address user
    )
        external
        view
        returns (uint256[] memory depositIds, uint256[] memory amounts)
    {
        uint256 depositCount = supplierVault.depositCount(user);

        uint256 pledgedCount = 0;
        for (uint256 i = 0; i < depositCount; i++) {
            if (isDepositPledged[user][i]) {
                pledgedCount++;
            }
        }

        depositIds = new uint256[](pledgedCount);
        amounts = new uint256[](pledgedCount);

        uint256 index = 0;
        for (uint256 i = 0; i < depositCount; i++) {
            if (isDepositPledged[user][i]) {
                depositIds[index] = i;
                amounts[index] = pledgedByDeposit[user][i];
                index++;
            }
        }
    }

    function _checkCollateralSufficiency(address user) internal view {
        uint256 loanCount = borrowerVault.loanCount(user);
        bool hasActiveLoan = false;

        for (uint256 i = 0; i < loanCount; i++) {
            (, , uint256 healthFactor, bool active) = borrowerVault.getUserLoan(
                user,
                i
            );

            if (active) {
                hasActiveLoan = true;
                require(healthFactor >= MIN_HEALTH_FACTOR, "Undercollateralized");
            }
        }
        
        require(hasActiveLoan || totalPledgedAmount[user] == 0, "Cannot unpledge without active loan");
    }

    function setPledgingPaused(
        bool _paused
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        pledgingPaused = _paused;
        emit PledgingPaused(_paused);
    }

    function setUnpledgingPaused(
        bool _paused
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        unpledgingPaused = _paused;
        emit UnpledgingPaused(_paused);
    }

    function setBorrowerVault(
        address _borrowerVault
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_borrowerVault != address(0), "Invalid address");
        borrowerVault = IBorrowerVault(_borrowerVault);
        emit BorrowerVaultUpdated(_borrowerVault);
    }

    function setSupplierVault(
        address _supplierVault
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_supplierVault != address(0), "Invalid address");
        supplierVault = ISupplierVault(_supplierVault);
        emit SupplierVaultUpdated(_supplierVault);
    }

    function grantBorrowerVaultRole(
        address _borrowerVault
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BORROWER_VAULT_ROLE, _borrowerVault);
    }

    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "Invalid token");
        IERC20(token).safeTransfer(msg.sender, amount);
        emit EmergencyWithdrawal(token, amount);
    }
}

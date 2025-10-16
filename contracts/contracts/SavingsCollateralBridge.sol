// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface ISupplierVault {
    struct Deposit {
        uint256 amount;
        uint256 lockEnd;
    }
    
    function getUserDeposits(address user, address token) external view returns (Deposit[] memory);
    function totalSupply(address token) external view returns (uint256);
    function accumulatedInterest(address token) external view returns (uint256);
    function setPledgeStatus(address user, address token, uint256 depositIndex, bool pledged) external;
    function getPledgeStatus(address user, address token, uint256 depositIndex) external view returns (bool);
    function withdrawPledgedDeposit(address user, address token, uint256 amount, address recipient) external returns (uint256);
}

interface ISortedOracles {
    function getMedianRate(address token) external view returns (uint256 rate, uint256 timestamp);
}

contract SavingsCollateralBridge is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;
    
    bytes32 public constant BORROWER_VAULT_ROLE = keccak256("BORROWER_VAULT_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");
    
    ISupplierVault public immutable supplierVault;
    ISortedOracles public oracles;
    
    uint256 public constant SAVINGS_LTV = 75; // 75% LTV for savings collateral
    uint256 public constant PRECISION = 1e18;
    
    struct PledgedDeposit {
        address token;
        uint256 depositIndex;
        uint256 amount;
    }
    
    // user => array of pledged deposits
    mapping(address => PledgedDeposit[]) public userPledgedDeposits;
    
    // user => total pledged value in USD (18 decimals)
    mapping(address => uint256) public userPledgedValue;
    
    event SavingsPledged(address indexed user, address indexed token, uint256 depositIndex, uint256 amount);
    event SavingsUnpledged(address indexed user, address indexed token, uint256 depositIndex, uint256 amount);
    event SavingsLiquidated(address indexed borrower, address indexed liquidator, uint256 amount, address recipient);
    event OraclesUpdated(address indexed oldOracles, address indexed newOracles);
    
    constructor(address _supplierVault, address _oracles) {
        require(_supplierVault != address(0), "Invalid supplier vault");
        require(_oracles != address(0), "Invalid oracles");
        
        supplierVault = ISupplierVault(_supplierVault);
        oracles = ISortedOracles(_oracles);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    function updateOracles(address newOracles) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newOracles != address(0), "Invalid oracle address");
        emit OraclesUpdated(address(oracles), newOracles);
        oracles = ISortedOracles(newOracles);
    }
    
    /**
     * @notice Pledge savings deposits as collateral for borrowing
     * @param token The token address of the deposits
     * @param depositIndices Array of deposit indices to pledge
     * @param amounts Array of amounts to pledge from each deposit
     * @return collateralValue The total collateral value provided (with LTV applied)
     */
    function pledgeSavingsAsCollateral(
        address token,
        uint256[] calldata depositIndices,
        uint256[] calldata amounts
    ) external nonReentrant returns (uint256 collateralValue) {
        require(depositIndices.length > 0, "No deposits specified");
        require(depositIndices.length == amounts.length, "Length mismatch");
        
        ISupplierVault.Deposit[] memory deposits = supplierVault.getUserDeposits(msg.sender, token);
        
        uint256 totalPledgedAmount = 0;
        
        for (uint256 i = 0; i < depositIndices.length; i++) {
            uint256 depositIndex = depositIndices[i];
            uint256 amount = amounts[i];
            
            require(depositIndex < deposits.length, "Invalid deposit index");
            require(amount > 0, "Amount must be greater than 0");
            
            ISupplierVault.Deposit memory deposit = deposits[depositIndex];
            
            // Only unlocked deposits can be pledged
            require(block.timestamp >= deposit.lockEnd, "Deposit still locked");
            
            // Check if already pledged
            require(!supplierVault.getPledgeStatus(msg.sender, token, depositIndex), "Already pledged");
            
            // Get current pledged amount for this deposit
            uint256 currentPledged = _getPledgedAmountForDeposit(msg.sender, token, depositIndex);
            require(currentPledged + amount <= deposit.amount, "Exceeds deposit amount");
            
            // Mark as pledged in supplier vault
            supplierVault.setPledgeStatus(msg.sender, token, depositIndex, true);
            
            // Record the pledge
            userPledgedDeposits[msg.sender].push(PledgedDeposit({
                token: token,
                depositIndex: depositIndex,
                amount: amount
            }));
            
            totalPledgedAmount += amount;
            
            emit SavingsPledged(msg.sender, token, depositIndex, amount);
        }
        
        // Calculate collateral value with LTV
        (uint256 tokenPrice, uint256 timestamp) = oracles.getMedianRate(token);
        require(tokenPrice > 0, "Invalid token price");
        require(timestamp >= block.timestamp - 1 hours, "Stale token price");
        
        // Include accrued interest in collateral value
        uint256 valueWithInterest = _calculateValueWithInterest(msg.sender, token, totalPledgedAmount);
        
        // Apply LTV ratio
        collateralValue = (valueWithInterest * tokenPrice * SAVINGS_LTV) / (100 * PRECISION);
        
        userPledgedValue[msg.sender] += collateralValue;
        
        return collateralValue;
    }
    
    /**
     * @notice Unpledge savings collateral (requires sufficient other collateral or repaid loan)
     * @param token The token address of the deposits
     * @param depositIndices Array of deposit indices to unpledge
     * @param amounts Array of amounts to unpledge from each deposit
     */
    function unpledgeSavingsCollateral(
        address token,
        uint256[] calldata depositIndices,
        uint256[] calldata amounts
    ) external nonReentrant {
        require(depositIndices.length > 0, "No deposits specified");
        require(depositIndices.length == amounts.length, "Length mismatch");
        
        uint256 totalUnpledgedAmount = 0;
        
        for (uint256 i = 0; i < depositIndices.length; i++) {
            uint256 depositIndex = depositIndices[i];
            uint256 amount = amounts[i];
            
            require(amount > 0, "Amount must be greater than 0");
            
            // Find and remove from pledged deposits
            bool found = false;
            for (uint256 j = 0; j < userPledgedDeposits[msg.sender].length; j++) {
                PledgedDeposit storage pledged = userPledgedDeposits[msg.sender][j];
                if (pledged.token == token && pledged.depositIndex == depositIndex) {
                    require(pledged.amount >= amount, "Exceeds pledged amount");
                    
                    pledged.amount -= amount;
                    totalUnpledgedAmount += amount;
                    
                    // Remove if fully unpledged
                    if (pledged.amount == 0) {
                        supplierVault.setPledgeStatus(msg.sender, token, depositIndex, false);
                        
                        // Remove from array by swapping with last element
                        userPledgedDeposits[msg.sender][j] = userPledgedDeposits[msg.sender][userPledgedDeposits[msg.sender].length - 1];
                        userPledgedDeposits[msg.sender].pop();
                    }
                    
                    found = true;
                    emit SavingsUnpledged(msg.sender, token, depositIndex, amount);
                    break;
                }
            }
            
            require(found, "Deposit not pledged");
        }
        
        // Update total pledged value
        (uint256 tokenPrice, uint256 timestamp) = oracles.getMedianRate(token);
        require(tokenPrice > 0, "Invalid token price");
        require(timestamp >= block.timestamp - 1 hours, "Stale token price");
        
        uint256 valueWithInterest = _calculateValueWithInterest(msg.sender, token, totalUnpledgedAmount);
        uint256 valueReduction = (valueWithInterest * tokenPrice * SAVINGS_LTV) / (100 * PRECISION);
        
        userPledgedValue[msg.sender] -= valueReduction;
    }
    
    /**
     * @notice Get total savings collateral value for a user (includes accrued interest)
     * @param user The user address
     * @return totalValue The total collateral value with LTV applied
     */
    function getSavingsCollateralValue(address user) external view returns (uint256 totalValue) {
        PledgedDeposit[] memory pledged = userPledgedDeposits[user];
        
        if (pledged.length == 0) {
            return 0;
        }
        
        // Calculate per deposit
        for (uint256 i = 0; i < pledged.length; i++) {
            (uint256 tokenPrice, uint256 timestamp) = oracles.getMedianRate(pledged[i].token);
            
            if (tokenPrice > 0 && timestamp >= block.timestamp - 1 hours) {
                uint256 valueWithInterest = _calculateValueWithInterest(user, pledged[i].token, pledged[i].amount);
                uint256 value = (valueWithInterest * tokenPrice * SAVINGS_LTV) / (100 * PRECISION);
                totalValue += value;
            }
        }
        
        return totalValue;
    }
    
    /**
     * @notice Liquidate savings collateral for an undercollateralized borrower
     * @param borrower The borrower whose collateral to liquidate
     * @param requiredAmount The amount of value needed to seize (in USD, 18 decimals)
     * @param recipient The address to receive the liquidated collateral
     * @return amountSeized The actual amount of value seized
     */
    function liquidateSavingsCollateral(
        address borrower,
        uint256 requiredAmount,
        address recipient
    ) external onlyRole(LIQUIDATOR_ROLE) nonReentrant returns (uint256 amountSeized) {
        require(recipient != address(0), "Invalid recipient");
        require(requiredAmount > 0, "Invalid amount");
        
        PledgedDeposit[] storage pledged = userPledgedDeposits[borrower];
        require(pledged.length > 0, "No pledged collateral");
        
        uint256 remainingToSeize = requiredAmount;
        
        // Liquidate pledged deposits until required amount is met
        while (pledged.length > 0 && remainingToSeize > 0) {
            PledgedDeposit storage deposit = pledged[pledged.length - 1];
            
            (uint256 tokenPrice, uint256 timestamp) = oracles.getMedianRate(deposit.token);
            require(tokenPrice > 0 && timestamp >= block.timestamp - 1 hours, "Invalid price");
            
            uint256 valueWithInterest = _calculateValueWithInterest(borrower, deposit.token, deposit.amount);
            uint256 depositValue = (valueWithInterest * tokenPrice) / PRECISION;
            
            uint256 amountToWithdraw;
            if (depositValue <= remainingToSeize) {
                // Seize entire deposit
                amountToWithdraw = deposit.amount;
                remainingToSeize -= depositValue;
                amountSeized += depositValue;
                
                // Unmark pledge status
                supplierVault.setPledgeStatus(borrower, deposit.token, deposit.depositIndex, false);
                
                // Remove from array
                pledged.pop();
            } else {
                // Partial seizure
                uint256 partialAmount = (deposit.amount * remainingToSeize) / depositValue;
                amountToWithdraw = partialAmount;
                amountSeized += remainingToSeize;
                
                deposit.amount -= partialAmount;
                remainingToSeize = 0;
                
                // If fully depleted, unmark
                if (deposit.amount == 0) {
                    supplierVault.setPledgeStatus(borrower, deposit.token, deposit.depositIndex, false);
                    pledged.pop();
                }
            }
            
            // Withdraw from supplier vault and transfer to recipient
            supplierVault.withdrawPledgedDeposit(borrower, deposit.token, amountToWithdraw, recipient);
        }
        
        // Update total pledged value
        userPledgedValue[borrower] = _recalculatePledgedValue(borrower);
        
        emit SavingsLiquidated(borrower, msg.sender, amountSeized, recipient);
        
        return amountSeized;
    }
    
    /**
     * @notice Get all pledged deposits for a user
     * @param user The user address
     * @return deposits Array of pledged deposits
     */
    function getUserPledgedDeposits(address user) external view returns (PledgedDeposit[] memory) {
        return userPledgedDeposits[user];
    }
    
    /**
     * @notice Calculate value including accrued interest
     */
    function _calculateValueWithInterest(
        address user,
        address token,
        uint256 amount
    ) internal view returns (uint256) {
        uint256 totalSupply = supplierVault.totalSupply(token);
        uint256 accruedInterest = supplierVault.accumulatedInterest(token);
        
        if (totalSupply == 0) {
            return amount;
        }
        
        // Calculate proportional interest
        uint256 interest = (accruedInterest * amount) / totalSupply;
        return amount + interest;
    }
    
    /**
     * @notice Get pledged amount for a specific deposit
     */
    function _getPledgedAmountForDeposit(
        address user,
        address token,
        uint256 depositIndex
    ) internal view returns (uint256) {
        PledgedDeposit[] memory pledged = userPledgedDeposits[user];
        uint256 total = 0;
        
        for (uint256 i = 0; i < pledged.length; i++) {
            if (pledged[i].token == token && pledged[i].depositIndex == depositIndex) {
                total += pledged[i].amount;
            }
        }
        
        return total;
    }
    
    /**
     * @notice Recalculate total pledged value for a user
     */
    function _recalculatePledgedValue(address user) internal view returns (uint256) {
        PledgedDeposit[] memory pledged = userPledgedDeposits[user];
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < pledged.length; i++) {
            (uint256 tokenPrice, uint256 timestamp) = oracles.getMedianRate(pledged[i].token);
            
            if (tokenPrice > 0 && timestamp >= block.timestamp - 1 hours) {
                uint256 valueWithInterest = _calculateValueWithInterest(user, pledged[i].token, pledged[i].amount);
                uint256 value = (valueWithInterest * tokenPrice * SAVINGS_LTV) / (100 * PRECISION);
                totalValue += value;
            }
        }
        
        return totalValue;
    }
}

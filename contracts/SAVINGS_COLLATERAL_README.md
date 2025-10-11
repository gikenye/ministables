# Savings as Collateral Feature

## Quick Start

### What is it?
Users can now use their savings deposits in SupplierVault as collateral for loans, **without withdrawing funds**. This means:
- ✅ Keep earning yield on deposits
- ✅ Borrow against unlocked savings  
- ✅ No need to move funds between contracts
- ✅ Better capital efficiency

### Key Parameters
- **LTV Ratio**: 75% for stablecoin savings
- **Eligible Deposits**: Only unlocked deposits (past lockEnd)
- **Interest**: Continues to accrue on pledged deposits
- **Liquidation**: Supports partial liquidation

## Files Added

```
contracts/
├── contracts/
│   ├── SavingsCollateralBridge.sol          # Main bridge contract
│   ├── Ministables.sol                       # Modified with bridge support
│   └── mocks/
│       ├── MockERC20.sol                     # For testing
│       └── MockSortedOracles.sol             # For testing
├── scripts/
│   └── deploySavingsCollateralBridge.js      # Deployment script
├── tests/
│   └── savingsCollateral.test.js             # Test suite
├── SAVINGS_COLLATERAL_INTEGRATION.md         # Detailed guide
└── SAVINGS_COLLATERAL_README.md              # This file
```

## Deployment

### Prerequisites
1. Ministables contract deployed
2. SortedOracles contract deployed
3. Owner access to Ministables contract

### Deploy Bridge

```bash
# Set environment variables
export MINISTABLES_ADDRESS="0x..."
export ORACLES_ADDRESS="0x..."
export LIQUIDATOR_ADDRESS="0x..."  # Optional, defaults to deployer

# Deploy
cd contracts
npx hardhat run scripts/deploySavingsCollateralBridge.js --network celo
```

### Manual Setup (if deployment script fails)

```javascript
// 1. Deploy bridge
const SavingsCollateralBridge = await ethers.getContractFactory("SavingsCollateralBridge");
const bridge = await SavingsCollateralBridge.deploy(ministablesAddress, oraclesAddress);
await bridge.deployed();

// 2. Grant bridge role (as Ministables owner)
const ministables = await ethers.getContractAt("Ministables", ministablesAddress);
await ministables.grantBridgeRole(bridge.address);

// 3. Grant liquidator role (as bridge owner)
const LIQUIDATOR_ROLE = await bridge.LIQUIDATOR_ROLE();
await bridge.grantRole(LIQUIDATOR_ROLE, liquidatorAddress);
```

## Usage Examples

### User Flow: Pledge & Borrow

```javascript
// 1. User deposits in Ministables (existing flow)
await cKES.approve(ministables.address, amount);
await ministables.deposit(cKES.address, amount, lockPeriod);

// 2. Wait for lock period to expire
// ... time passes ...

// 3. Pledge deposit as collateral
const depositIndices = [0]; // First deposit
const amounts = [ethers.utils.parseEther("1000")];
await bridge.pledgeSavingsAsCollateral(cKES.address, depositIndices, amounts);

// 4. Check collateral value
const collateralValue = await bridge.getSavingsCollateralValue(userAddress);
console.log("Can borrow up to:", ethers.utils.formatEther(collateralValue), "USD");

// 5. Borrow from BorrowerVault (future integration)
// await borrowerVault.borrow(usdc.address, borrowAmount, "SAVINGS");
```

### Liquidator Flow

```javascript
// 1. Check if position is undercollateralized
// const isUnder = await borrowerVault.isUndercollateralized(borrower);

// 2. Liquidate
const requiredAmount = ethers.utils.parseEther("50"); // $50 worth
await bridge.connect(liquidator).liquidateSavingsCollateral(
  borrowerAddress,
  requiredAmount,
  liquidator.address
);
```

### User Flow: Unpledge & Withdraw

```javascript
// 1. Repay loan first (BorrowerVault integration)
// await borrowerVault.repay(usdc.address, amount);

// 2. Unpledge collateral
await bridge.unpledgeSavingsCollateral(cKES.address, [0], [ethers.utils.parseEther("1000")]);

// 3. Withdraw from Ministables
await ministables.withdraw(cKES.address, ethers.utils.parseEther("1000"));
```

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    User Workflow                          │
└────────────┬────────────────────────────┬────────────────┘
             │                            │
             ▼                            ▼
    ┌────────────────┐          ┌──────────────────┐
    │   Deposit      │          │   Borrow         │
    │   in Supplier  │          │   from Borrower  │
    │   Vault        │          │   Vault          │
    └────────┬───────┘          └────────┬─────────┘
             │                            │
             └──────────┬─────────────────┘
                        ▼
          ┌──────────────────────────────┐
          │  SavingsCollateralBridge     │
          │  • Track pledged deposits    │
          │  • Calculate collateral      │
          │  • Handle liquidations       │
          └──────────────────────────────┘
```

## Key Features

### 1. Only Unlocked Deposits
```solidity
require(block.timestamp >= deposit.lockEnd, "Deposit still locked");
```

### 2. Interest Accrual
Pledged deposits continue earning yield, which increases collateral value over time.

### 3. Withdrawal Protection
```solidity
// In Ministables.sol withdraw()
if (depositPledgedStatus[msg.sender][token][i]) {
    // Skip pledged deposits
}
```

### 4. Partial Operations
- Pledge 500 out of 1000 cKES deposit
- Unpledge 200 cKES later
- Liquidate only required amount

### 5. Multiple Deposits
Users can pledge multiple deposits across different tokens.

## Security Features

### Access Control
- **BRIDGE_ROLE**: Only bridge can modify pledge status in Ministables
- **LIQUIDATOR_ROLE**: Only authorized addresses can liquidate
- **DEFAULT_ADMIN_ROLE**: Owner can manage roles

### Reentrancy Protection
All state-changing functions use `nonReentrant` modifier.

### Oracle Validation
Prices must be fresh (< 1 hour old) to prevent using stale data.

### Atomic Operations
Liquidation is atomic - either fully succeeds or reverts.

## Integration with BorrowerVault

The BorrowerVault (or any lending protocol) needs to:

1. **Add SAVINGS collateral type**
2. **Query bridge for collateral values**:
   ```solidity
   uint256 savingsCollateral = savingsCollateralBridge.getSavingsCollateralValue(user);
   ```
3. **Verify collateral before allowing unpledge**
4. **Call bridge during liquidation**:
   ```solidity
   bridge.liquidateSavingsCollateral(borrower, requiredAmount, liquidator);
   ```

See `SAVINGS_COLLATERAL_INTEGRATION.md` for detailed integration guide.

## Testing

### Run Tests
```bash
cd contracts
npx hardhat test tests/savingsCollateral.test.js
```

### Test Coverage
- ✅ Pledge/unpledge flows
- ✅ Withdrawal prevention
- ✅ Liquidation (full and partial)
- ✅ Interest accrual
- ✅ Multiple deposits
- ✅ Access control
- ✅ Edge cases

## Common Issues

### "Deposit still locked"
Wait for lock period to expire before pledging.

### "Already pledged"
Cannot pledge same deposit twice. Unpledge first if you want to adjust amount.

### "E7: Insufficient unpledged balance"
You're trying to withdraw pledged deposits. Unpledge them first.

### "Stale token price"
Oracle price is > 1 hour old. Update oracle or wait for fresh price.

## Constants

```solidity
uint256 public constant SAVINGS_LTV = 75; // 75% LTV
uint256 public constant PRECISION = 1e18;
```

## Events

```solidity
event SavingsPledged(address indexed user, address indexed token, uint256 depositIndex, uint256 amount);
event SavingsUnpledged(address indexed user, address indexed token, uint256 depositIndex, uint256 amount);
event SavingsLiquidated(address indexed borrower, address indexed liquidator, uint256 amount, address recipient);
event OraclesUpdated(address indexed oldOracles, address indexed newOracles);
```

## Support

For detailed integration guide, see `SAVINGS_COLLATERAL_INTEGRATION.md`.

For questions or issues:
1. Check the integration guide
2. Review test cases in `tests/savingsCollateral.test.js`
3. Open an issue on GitHub

## License

MIT

# AI Coding Agent Instructions for Minilend

## Architecture Overview

Minilend is a multi-chain DeFi savings & lending protocol built with Next.js 14, supporting Celo, Base, and Scroll networks. The application centers around user-defined savings goals with vault-backed deposits and borrowing capabilities.

### Core Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Blockchain**: Thirdweb SDK for wallet connections and contract interactions
- **Database**: MongoDB with custom models for users, goals, and transactions
- **Authentication**: NextAuth.js with wallet-based auth
- **State**: React hooks pattern with custom API hooks

## Critical Configuration Pattern: ALWAYS USE CHAINCONFIG

**NEVER hardcode token symbols, addresses, or chain data.** Always reference `/config/chainConfig.ts`:

```typescript
// ✅ CORRECT - Use chainConfig
import { getTokenInfo, getVaultAddress, CHAINS, TOKENS } from "@/config/chainConfig";

// ❌ WRONG - Never hardcode
const tokenSymbol = "USDC"; // Don't do this
const address = "0x123..."; // Don't do this
```

### Key chainConfig Functions
- `getTokens(chainId)` - Get all tokens for a chain
- `getTokenInfo(chainId, address)` - Get specific token metadata
- `getVaultAddress(chainId, symbol)` - Get vault contract address
- `getAaveContract(chainId, contractName)` - Get Aave integration contracts

## Component Architecture Patterns

### 1. Chain Context Provider Pattern
All blockchain interactions flow through `ChainProvider` which manages active chain, tokens, and contract addresses:

```typescript
const { chain, tokens, tokenInfos, contractAddress } = useChain();
```

### 2. Goal-Centric Data Flow
The app revolves around user goals managed through hooks:

```typescript
// Primary goal hooks
const { goals, stats, loading, refetch } = useGoals();
const { createGoal } = useCreateGoal();
const { user } = useUser();

// Auto-initialize Quick Save goal for new users
useInitializeUserGoals(defaultToken, chain);
```

### 3. Modal System Pattern
Consistent modal structure across all transaction flows (`SaveMoneyModal`, `BorrowMoneyModal`, etc.):
- Multi-step wizards with step enums
- Thirdweb transaction handling
- Error boundary integration
- Responsive bottom-sheet on mobile

### 4. Wallet Integration Pattern
Thirdweb-based wallet connections with multiple providers:

```typescript
import { useActiveAccount, useSendTransaction, useWalletBalance } from "thirdweb/react";

const account = useActiveAccount();
const { mutateAsync: sendTransaction } = useSendTransaction({ payModal: false });
```

## Critical Development Workflows

### Running the App
```bash
yarn dev          # Start development server with Turbopack
yarn build        # Production build
yarn worker:dev   # Start background disbursement worker
```

### Contract Development
```bash
cd contracts
yarn compile      # Compile smart contracts
yarn test         # Run contract tests
yarn deploy       # Deploy to configured networks
```

### Oracle Management
```bash
yarn oracle:push  # Push price data to oracle
yarn oracle:read  # Read current oracle prices
```

## Project-Specific Conventions

### 1. Hook Naming & Usage
- **API Hooks**: `useGoals()`, `useUser()`, `useCreateGoal()` for backend data
- **Blockchain Hooks**: `useChain()`, `useChainContract()`, `useWithdraw()` for on-chain operations
- **Utility Hooks**: `useInitializeUserGoals()`, `useEnhancedDashboard()` for app logic

### 2. File Organization
```
/hooks/           - Custom React hooks for API and blockchain
/lib/services/    - Service layers (goalService, vaultService, thirdwebService)
/components/ui/   - Reusable UI components (shadcn/ui based)
/components/common/ - App-specific shared components
/config/          - Chain configurations and constants
/app/             - Next.js app router pages
```

### 3. Error Handling Pattern
Always wrap thirdweb operations with proper error handling:

```typescript
try {
  const result = await sendTransaction(transaction);
  await waitForReceipt({ ...result, chain });
} catch (error) {
  console.error("Transaction failed:", error);
  // Handle error appropriately
}
```

### 4. Responsive Design Pattern
Mobile-first approach with specific breakpoints:
- Use `useMediaQuery` for responsive behavior
- Modal → Bottom Sheet pattern on mobile
- Card layouts collapse on smaller screens

## Integration Points & Dependencies

### 1. Thirdweb Integration
- Client configuration in `/lib/thirdweb/client.ts`
- Contract interactions use `getContract()` + `prepareContractCall()`
- Wallet connections support in-app wallets, MetaMask, WalletConnect

### 2. MongoDB Models
- **User Model**: `/lib/models/user.ts` - user profiles and settings
- **Goal Model**: `/lib/models/goal.ts` - savings goals with vault integration
- **Transaction Model**: tracking deposits/withdrawals

### 3. Vault Service Layer
Critical abstraction in `/lib/services/vaultService.ts`:
- Handles Aave vault interactions
- Goal-vault integration methods
- Position tracking and yield calculations

### 4. Goal Service Layer
Main business logic in `/lib/services/goalService.ts`:
- CRUD operations for user goals
- Vault deposit/withdrawal integration
- Transaction history management

## Key Files to Understand

- `/config/chainConfig.ts` - **MOST IMPORTANT** - All chain/token configuration
- `/components/ChainProvider.tsx` - Chain context and state management
- `/app/page.tsx` - Main homepage with expandable Quick Save card
- `/app/dashboard/page.tsx` - User dashboard with vault positions
- `/hooks/useGoals.ts` - Primary data fetching for goals
- `/lib/services/goalService.ts` - Core business logic layer

## Common Development Tasks

### Adding New Token Support
1. Update `TOKENS` array in chainConfig for specific chain
2. Add vault contract if applicable to `VAULT_CONTRACTS`
3. Test token selection in UI components

### Creating New Modals
1. Follow existing modal patterns (`SaveMoneyModal.tsx`)
2. Implement step-based wizard with enum
3. Use thirdweb transaction hooks
4. Add to modal state management in main pages

### Blockchain Interactions
1. Always get contract via `useChain()` and `getContract()`
2. Use `prepareContractCall()` for transaction preparation
3. Handle transaction state with `useSendTransaction()`
4. Update UI state after successful transactions

## Testing & Debugging

### Chain Debugging
Use `<ChainDebug />` component for wallet/chain state inspection in development.

### Development Environment
- Set `NODE_ENV=development` for detailed console logging
- Use browser dev tools for thirdweb transaction inspection
- Oracle data can be mocked locally with scripts

Remember: This codebase prioritizes chain configuration abstraction - always reference chainConfig rather than hardcoding blockchain-specific values.
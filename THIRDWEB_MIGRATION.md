# Thirdweb API Migration Guide

This guide explains how to migrate from the current contract.tsx implementation to the new thirdweb API-based service.

## Overview

The migration replaces the direct viem-based contract interactions with thirdweb's API service, which provides better reliability, caching, and performance.

## Key Changes

### 1. New Files Created

- `lib/services/thirdwebService.ts` - Core thirdweb API service
- `lib/thirdweb-contract.tsx` - New contract provider using thirdweb SDK
- `THIRDWEB_MIGRATION.md` - This migration guide

### 2. Contract Address Update

The contract address has been updated to the new deployment:
- **Old**: `0x89E356E80De29B466E774A5Eb543118B439EE41E`
- **New**: `0xf33eF5fEBB702665648363D7fC36Ccd1CCC8a522`

### 3. Environment Variables

Make sure you have the following environment variable set:
```env
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
```

## Migration Steps

### Option 1: Gradual Migration with Wrapper (Recommended)

Use the ContractWrapper to switch between implementations:

1. **Set Environment Variable**:
   ```env
   # Use old implementation (default)
   NEXT_PUBLIC_USE_THIRDWEB_API=false
   
   # Use new thirdweb implementation
   NEXT_PUBLIC_USE_THIRDWEB_API=true
   ```

2. **Update Component Imports**:
   ```tsx
   // Before
   import { useContract } from "@/lib/contract";
   
   // After (works with both implementations)
   import { useContractWrapper } from "@/lib/contract-wrapper";
   
   // In component:
   const contract = useContractWrapper();
   ```

3. **Test Both Implementations**:
   - Set `NEXT_PUBLIC_USE_THIRDWEB_API=false` to test old implementation
   - Set `NEXT_PUBLIC_USE_THIRDWEB_API=true` to test new implementation

### Option 2: Direct Migration

Replace the old ContractProvider with the new ThirdwebContractProvider:

```tsx
// Before
import { ContractProvider } from "@/lib/contract";

// After  
import { ThirdwebContractProvider } from "@/lib/thirdweb/minilend-contract";

// In the component tree, replace:
<ContractProvider>
  {children}
</ContractProvider>

// With:
<ThirdwebContractProvider>
  {children}
</ThirdwebContractProvider>
```

### Step 3: Update Wallet Connection

The new implementation uses thirdweb's wallet connection system. Make sure components use:

```tsx
import { useActiveAccount } from "thirdweb/react";

// In component:
const account = useActiveAccount();
const userAddress = account?.address;
```

## Benefits of Migration

1. **Better Performance**: Thirdweb API provides optimized RPC calls and caching
2. **Improved Reliability**: Built-in retry logic and fallback mechanisms
3. **Reduced Bundle Size**: Less client-side RPC configuration needed
4. **Better Error Handling**: More descriptive error messages
5. **Automatic Caching**: Built-in caching for read operations

## API Differences

### Read Operations
All read operations now use the thirdweb API service:
- Automatic caching (5-minute cache duration)
- Batch operations for better performance
- Fallback to mock data when needed

### Write Operations  
Write operations use thirdweb SDK:
- Improved transaction preparation
- Better gas estimation
- Enhanced error messages

## Testing

After migration, test the following functionality:
1. Wallet connection
2. Token balance reading
3. Deposit operations
4. Borrow operations
5. Repay operations
6. Withdraw operations
7. Oracle rate fetching

## Rollback Plan

### With Wrapper (Easy)
Simply change the environment variable:
```env
NEXT_PUBLIC_USE_THIRDWEB_API=false
```

### Without Wrapper
If issues occur, you can quickly rollback by:
1. Reverting ClientLayout.tsx changes
2. Updating component imports back to the old contract provider
3. The old contract.tsx file remains unchanged as a fallback

## Support

For issues with the migration, check:
1. Environment variables are set correctly
2. Thirdweb client ID is valid
3. Network connectivity for API calls
4. Console logs for detailed error messages
// SPDX-License-Identifier: MIT
// Author: hagiasofia

pragma solidity ^0.8.24;

library DataTypes {
    // ============= Supplier Vault Structs =============
    
    struct SupplierDeposit {
        uint256 shares;
        uint256 principal;
        uint256 depositTime;
        uint256 lockEnd;
        uint256 lastInterestIndex;
        bool pledgedAsCollateral;    // For savings-as-collateral
    }
    
    struct LockTier {
        uint256 duration;
        uint256 yieldBoostBps;
        bool active;
    }
    
    // ============= Borrower Vault Structs =============
    
    struct CollateralDeposit {
        uint256 amount;
        uint256 depositTime;
        bool usedForBorrowing;
    }
    
    struct LoanPosition {
        uint256 principal;
        uint256 accruedInterest;
        uint256 lastUpdateTime;
        uint256 interestRateAtBorrow;
        address collateralToken;
        uint256 collateralAmount;
        bool active;
    }
    
    struct CollateralConfig {
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 liquidationPenalty;
        bool enabled;
    }
    
    // ============= Reserve Management =============
    
    struct ReserveData {
        uint256 totalSupply;
        uint256 totalBorrows;
        uint256 totalReserves;
        uint256 liquidityBuffer;
        uint256 lastUpdateTime;
        uint256 interestIndex;
    }
    
    struct InterestRateModel {
        uint256 baseRateBps;
        uint256 optimalUtilization;
        uint256 slope1;
        uint256 slope2;
    }
    
    // ============= Aave Strategy =============
    
    struct AavePosition {
        uint256 supplied;
        uint256 aTokenBalance;
        uint256 lastHarvestTime;
        uint256 totalYieldHarvested;
    }
    
    // ============= Oracle Data =============
    
    enum AssetType {
        USD_BACKED,
        LOCAL_CURRENCY,
        DUAL_SOURCE
    }
    
    struct AssetConfig {
        AssetType assetType;
        address chainlinkFeed;
        string pretiumCurrency;
        uint8 decimals;
        bool enabled;
    }
}
// SPDX-License-Identifier: MIT
// Author: hagiasofia

pragma solidity ^0.8.24;

interface ISavingsCollateralBridge {
    function pledgeSavingsAsCollateral(
        uint256[] calldata depositIds,
        uint256[] calldata amounts
    ) external returns (uint256 totalCollateralValue);
    
    function unpledgeSavingsCollateral(
        uint256[] calldata depositIds,
        uint256[] calldata amounts
    ) external;
    
    function getSavingsCollateralValue(
        address user
    ) external view returns (uint256 totalValue);
    
    function liquidateSavingsCollateral(
        address borrower,
        uint256 amountNeeded
    ) external returns (uint256 amountSeized);
    
    function getDepositPledgeInfo(
        address user,
        uint256 depositId
    ) external view returns (
        uint256 pledgedAmount,
        uint256 currentValue,
        uint256 availableToPledge
    );
    
    function getUserPledgedDeposits(
        address user
    ) external view returns (
        uint256[] memory depositIds,
        uint256[] memory amounts
    );
}
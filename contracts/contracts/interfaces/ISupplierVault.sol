// SPDX-License-Identifier: MIT
// Author: hagiasofia

pragma solidity ^0.8.24;

interface ISupplierVault {
    function deposit(
        uint256 amount,
        uint256 lockTierId
    ) external returns (uint256 depositId);
    function withdraw(
        uint256 depositId
    ) external returns (uint256 amountWithdrawn);

    function lend(address borrower, uint256 amount) external returns (bool);
    function receiveRepayment(uint256 amount) external returns (bool);
    function distributeYield(uint256 yieldAmount) external;

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
    function getBorrowRate() external view returns (uint256);
    function treasury() external view returns (address);
    function asset() external view returns (address);

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
    function isDepositPledged(
        address user,
        uint256 depositId
    ) external view returns (bool);
}

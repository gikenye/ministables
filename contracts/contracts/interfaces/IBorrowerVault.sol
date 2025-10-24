// SPDX-License-Identifier: MIT
// Author: hagiasofia

pragma solidity ^0.8.24;

interface IBorrowerVault {
    function depositCollateral(address token, uint256 amount) external;
    function withdrawCollateral(address token, uint256 amount) external;
    
    function borrow(address borrowToken, uint256 borrowAmount, address collateralToken) external returns (uint256 loanId);
    function repay(uint256 loanId, uint256 amount) external;
    function liquidate(address borrower, uint256 loanId) external;
    
    function loanCount(address user) external view returns (uint256);
    
    function getUserLoan(address user, uint256 loanId) external view returns (
        uint256 principal,
        uint256 interest,
        uint256 healthFactor,
        bool active
    );
}
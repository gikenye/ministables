// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAaveStrategy {
    function withdraw(uint256 amount) external;
    function totalDeployed() external view returns (uint256);
}

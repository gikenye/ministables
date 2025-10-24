// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "../interfaces/ISupplierVault.sol";

contract AaveStrategy is AccessControlUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    ISupplierVault public supplierVault;
    IPool public aavePool;
    IERC20 public asset;

    uint256 public totalDeployed;
    uint256 public totalYieldHarvested;
    uint256 public lastHarvestTime;

    uint256 public minDeployAmount;
    uint256 public harvestInterval;
    
    address public aToken;

    event Deployed(uint256 amount, uint256 totalDeployed);
    event Withdrawn(uint256 amount, uint256 totalDeployed);
    event YieldHarvested(uint256 yieldAmount, uint256 totalHarvested);

    function initialize(
        address _supplierVault,
        address _aavePool,
        address _asset
    ) external initializer {
        __AccessControl_init();

        supplierVault = ISupplierVault(_supplierVault);
        aavePool = IPool(_aavePool);
        asset = IERC20(_asset);

        minDeployAmount = 0;
        harvestInterval = 1 days;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deploy(uint256 amount) external onlyRole(KEEPER_ROLE) {
        require(amount >= minDeployAmount, "Amount too small");
        require(amount <= asset.balanceOf(address(this)), "Insufficient balance");

        asset.forceApprove(address(aavePool), amount);
        aavePool.supply(address(asset), amount, address(this), 0);
        totalDeployed += amount;

        emit Deployed(amount, totalDeployed);
    }

    function withdraw(uint256 amount) external onlyRole(VAULT_ROLE) {
        require(amount <= totalDeployed, "Insufficient deployed");

        aavePool.withdraw(address(asset), amount, address(this));
        asset.safeTransfer(address(supplierVault), amount);
        totalDeployed -= amount;

        emit Withdrawn(amount, totalDeployed);
    }

    function harvest() external onlyRole(KEEPER_ROLE) {
        require(
            block.timestamp >= lastHarvestTime + harvestInterval,
            "Too soon"
        );

        uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
        require(aTokenBalance > totalDeployed, "No yield");
        
        uint256 yieldAmount = aTokenBalance - totalDeployed;
        
        aavePool.withdraw(address(asset), yieldAmount, address(this));
        asset.forceApprove(address(supplierVault), yieldAmount);
        supplierVault.distributeYield(yieldAmount);

        totalYieldHarvested += yieldAmount;
        lastHarvestTime = block.timestamp;

        emit YieldHarvested(yieldAmount, totalYieldHarvested);
    }

    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 aTokenBalance = IERC20(aToken).balanceOf(address(this));
        if (aTokenBalance > 0) {
            aavePool.withdraw(address(asset), type(uint256).max, address(this));
            uint256 balance = asset.balanceOf(address(this));
            asset.safeTransfer(address(supplierVault), balance);
        }
        totalDeployed = 0;
    }

    function setMinDeployAmount(uint256 _minAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minDeployAmount = _minAmount;
    }

    function setHarvestInterval(uint256 _interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        harvestInterval = _interval;
    }

    function setAToken(address _aToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        aToken = _aToken;
    }
}

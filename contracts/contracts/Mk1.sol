// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMorphoMarket {
    function supply(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
    function getYield(address token) external view returns (uint256);
}

interface IRewardsDistributor {
    function claim(address user, bytes32[] calldata proof) external;
    function pendingRewards(address user) external view returns (uint256);
}

contract MK1Vault is ERC4626, Ownable {
    address public curator;
    IMorphoMarket public morphoMarket;
    IRewardsDistributor public rewardsDistributor;

    constructor(
        IERC20 asset_,
        address _curator,
        IMorphoMarket _morphoMarket,
        IRewardsDistributor _rewardsDistributor
    ) ERC4626(asset_) ERC20("Morpho-K1 Vault Share", "M-K1") {
        curator = _curator;
        morphoMarket = _morphoMarket;
        rewardsDistributor = _rewardsDistributor;
    }

    modifier onlyCurator() {
        require(msg.sender == curator, "Not curator");
        _;
    }

    function deposit(uint256 amount, address receiver) public override returns (uint256) {
        require(amount > 0, "Zero deposit");
        asset().transferFrom(msg.sender, address(this), amount);
        _approve(address(this), address(morphoMarket), amount);
        morphoMarket.supply(address(asset()), amount);
        return super.deposit(amount, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_) public override returns (uint256) {
        require(assets > 0, "Zero withdrawal");
        morphoMarket.withdraw(address(asset()), assets);
        return super.withdraw(assets, receiver, owner_);
    }

    function claimRewards(bytes32[] calldata proof) external {
        rewardsDistributor.claim(msg.sender, proof);
    }

    function viewPendingRewards(address user) external view returns (uint256) {
        return rewardsDistributor.pendingRewards(user);
    }

    function setCurator(address newCurator) external onlyOwner {
        curator = newCurator;
    }

    function totalYield() public view returns (uint256) {
        return morphoMarket.getYield(address(asset()));
    }

    // Optional: emergency withdrawal
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        morphoMarket.withdraw(address(asset()), amount);
        asset().transfer(owner(), amount);
    }
}

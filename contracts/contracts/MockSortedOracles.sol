// SPDX-License-Identifier: MIT
// Author: 0xth3gh05t0fw1nt3r
pragma solidity ^0.8.24;

contract MockSortedOracles {
    mapping(address => uint256) public rates;
    address public owner;

    event RateUpdated(address indexed token, uint256 newRate);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Mock prices in CELO (1e18 scale, assuming 1 CELO ≈ 0.7 USD)
        rates[0x471EcE3750Da237f93B8E339c536989b8978a438] = 1e18;                // CELO
        rates[0x765DE816845861e75A25fCA122bb6898B8B1282a] = 1428571428571428571; // cUSD
        rates[0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73] = 1571428571428571428; // cEUR
        rates[0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787] = 285714285714285714;  // cREAL
        rates[0x73F93dcc49cB8A239e2032663e9475dd5ef29A08] = 2380952380952381;    // eXOF
        rates[0x456a3D042C0DbD3db53D5489e98dFb038553B0d0] = 10989010989010989;   // cKES
        rates[0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B] = 24571428571428571;   // PUSO
        rates[0x8A567e2aE79CA692Bd748aB832081C45de4041eA] = 357142857142857;     // cCOP
        rates[0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313] = 95238095238095238;   // cGHS
        rates[0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e] = 1428571428571428571; // USDT
        rates[0xcebA9300f2b948710d2653dD7B07f33A8B32118C] = 1428571428571428571; // USDC
        rates[0x4F604735c1cF31399C6E711D5962b2B3E0225AD3] = 1428571428571428571; // USDGLO
    }

    function setRate(address token, uint256 newRate) external onlyOwner {
        rates[token] = newRate;
        emit RateUpdated(token, newRate);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function getMedianRate(address token) external view returns (uint256 rate, uint256 timestamp) {
        rate = rates[token];
        timestamp = block.timestamp;
        require(rate != 0, "No price feed");
    }
}

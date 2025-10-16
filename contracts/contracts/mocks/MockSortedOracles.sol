// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockSortedOracles {
    mapping(address => uint256) public rates;
    mapping(address => uint256) public timestamps;

    function setMedianRate(address token, uint256 rate) external {
        rates[token] = rate;
        timestamps[token] = block.timestamp;
    }

    function setMedianRateWithTimestamp(
        address token,
        uint256 rate,
        uint256 timestamp
    ) external {
        rates[token] = rate;
        timestamps[token] = timestamp;
    }

    function getMedianRate(address token) external view returns (uint256, uint256) {
        return (rates[token], timestamps[token]);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol"; 
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract PretiumOracle is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    constructor(address initialOwner) Ownable(initialOwner) {}

    struct RateData {
        uint256 quotedRate;
        uint256 timestamp;
    }
    mapping(string => RateData) public rates;

    address public trustedSigner;

    event RateUpdated(string indexed currencyCode, uint256 quotedRate, uint256 timestamp);
    event TrustedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    function setTrustedSigner(address signer) external onlyOwner {
        require(signer != address(0), "Zero address");
        emit TrustedSignerUpdated(trustedSigner, signer);
        trustedSigner = signer;
    }

    function updateRateSigned(
        string calldata currency_code,
        uint256 quotedRate,
        uint256 timestamp,
        bytes calldata signature
    ) external {
        require(trustedSigner != address(0), "Signer not set");
        require(quotedRate > 0, "Zero rate");
        require(timestamp >= block.timestamp - 10 minutes, "Stale timestamp");
        bytes32 messageHash = keccak256(abi.encode(currency_code, quotedRate, timestamp)).toEthSignedMessageHash();
        address signer = ECDSA.recover(messageHash, signature);
        require(signer == trustedSigner, "Invalid signature");
        rates[currency_code] = RateData({quotedRate: quotedRate, timestamp: timestamp});
        emit RateUpdated(currency_code, quotedRate, timestamp);
    }

    function getRate(string calldata currency_code) external view returns (uint256 rate, uint256 timestamp) {
        RateData memory r = rates[currency_code];
        return (r.quotedRate, r.timestamp);
    }
}
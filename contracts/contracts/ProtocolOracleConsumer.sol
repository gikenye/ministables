// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PretiumOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ProtocolOracleConsumer is Ownable {
    PretiumOracle public pretiumOracle;

    constructor(address _oracle, address initialOwner) Ownable(initialOwner) {
        require(_oracle != address(0), "Invalid oracle address");
        pretiumOracle = PretiumOracle(_oracle);
    }

    function setPretiumOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        pretiumOracle = PretiumOracle(_oracle);
    }

    function getKESRate() external view returns (uint256 rate, uint256 timestamp) {
        return pretiumOracle.getRate("KES");
    }
}
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28", // Matches deployed contract
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true // For stack-too-deep errors
    }
  },
  networks: {
    celo: {
      url: "https://forno.celo.org",
      accounts: [process.env.PRIVATE_KEY ?? ""],
      chainId: 42220
    },
    alfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: [process.env.PRIVATE_KEY ?? ""],
      chainId: 44787
    }
  },
  etherscan: {
    apiKey: process.env.CELOSCAN_API_KEY ?? "", // Single key for v2 API
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io"
        }
      },
      {
        network: "alfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io"
        }
      }
    ]
  },
  sourcify: {
    enabled: true // Enabled for Sourcify verification
  }
};
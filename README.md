<p align="center">
  <img src="public/minilend-logo.png" alt="Minilend Logo" width="200"/>
</p>

# Minilend


Minilend is a decentralized lending protocol built on the Celo blockchain that enables users to borrow and lend various stablecoins with robust compliance mechanisms powered by zkSelf.

## Overview

Minilend addresses the challenge of accessible, compliant lending in decentralized finance by providing a platform where users can:

- Borrow stablecoins using other stablecoins as collateral
- Lend stablecoins to earn interest
- Swap between different stablecoins
- Maintain regulatory compliance through zkSelf identity verification

## Key Features

- **Multi-Stablecoin Support**: Compatible with various stablecoins on the Celo network
- **Compliance-First Approach**: Integration with zkSelf for KYC/AML compliance
- **Oracle-Based Pricing**: Reliable price feeds through SortedOracles
- **User-Friendly Interface**: Modern React/Next.js frontend for seamless interaction
- **Proof of Human Verification**: Protection against bot manipulation

## Architecture

Minilend consists of the following core components:

### Smart Contracts

- **Minilend.sol**: Main lending protocol contract that handles borrowing, lending, and interest rate calculations
- **MiniMentoSwapStables.sol**: Facilitates swapping between different stablecoins
- **MockSortedOracles.sol**: Provides price feed data for supported assets
- **ProofOfHuman.sol**: Implements human verification to prevent bot manipulation

### Frontend

Built with Next.js and React, featuring:
- Wallet connection (MetaMask support)
- Dashboard for monitoring positions
- Modals for borrowing, lending, and repayment
- Real-time oracle rate display

## Deployed Contracts (Celo Mainnet)

| Contract | Address |
|----------|---------|
| Minilend | [0x89E356E80De29B466E774A5Eb543118B439EE41E](https://celoscan.io/address/0x89E356E80De29B466E774A5Eb543118B439EE41E) |
| SortedOracles | [0x96D7E17a4Af7af46413A7EAD48f01852C364417A](https://celoscan.io/address/0x96D7E17a4Af7af46413A7EAD48f01852C364417A) |
| PoolAddressProvider | [0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5](https://celoscan.io/address/0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5) |

### Supported Stablecoins

#### Borrowable Stablecoins
- USDC: [0xcebA9300f2b948710d2653dD7B07f33A8B32118C](https://celoscan.io/address/0xcebA9300f2b948710d2653dD7B07f33A8B32118C)
- cUSD: [0x765DE816845861e75A25fCA122bb6898B8B1282a](https://celoscan.io/address/0x765DE816845861e75A25fCA122bb6898B8B1282a)
- cEUR: [0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73](https://celoscan.io/address/0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73)
- cREAL: [0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787](https://celoscan.io/address/0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787)
- USDT: [0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e](https://celoscan.io/address/0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e)
- cKES: [0x456a3D042C0DbD3db53D5489e98dFb038553B0d0](https://celoscan.io/address/0x456a3D042C0DbD3db53D5489e98dFb038553B0d0)
- USDGLO: [0x4F604735c1cF31399C6E711D5962b2B3E0225AD3](https://celoscan.io/address/0x4F604735c1cF31399C6E711D5962b2B3E0225AD3)

Additional supported stablecoins can be found in the deployment configuration.

## Compliance with zkSelf

Minilend integrates zkSelf for regulatory compliance, allowing:

- Privacy-preserving KYC/AML checks
- Zero-knowledge proof verification of user identity
- Compliance with regulatory requirements without compromising user privacy

## Development

### Prerequisites

- Node.js (v16+)
- Yarn
- MetaMask or compatible wallet

### Installation

1. Clone the repository:
---
```bash
git clone https://github.com/gikenye/ministables.git
cd ministables
```
---

2. Install dependencies:
---
```bash
yarn install
```
---

3. Run the development server:
---
```bash
yarn dev
```
---

### Smart Contract Development

To work with the smart contracts:

---
```bash
cd contracts
yarn install
yarn compile
```
---

To run tests:
---
```bash
yarn test
```
---

To deploy to Celo mainnet (requires proper configuration):
---
```bash
yarn deploy
```
---

## License

ISC

## Links

- GitHub: [https://github.com/gikenye/ministables.git](https://github.com/gikenye/ministables.git)

<p align="center">
  <img src="public/new-logo.png" alt="Minilend Logo" width="200"/>
</p>

# Minilend


Minilend is a  savings protocol that enables users to save in groups using various stablecoins with robust compliance mechanisms powered by zkSelf.

## Overview

Minilend addresses the challenge of accessible, compliant lending in decentralized finance by providing a platform where users can:

- Borrow stablecoins using other stablecoins as collateral
- Convert fiat savings to stablecoins and earn interest.
- Swap between different stablecoins
- Maintain regulatory compliance through zkSelf identity verification

## Key Features

- **Multi-Stablecoin Support**: Compatible with various stablecoins on the Celo, Base and Scroll networks
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
| Minilend | [0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c](https://celoscan.io/address/0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c) |
| SortedOracles | [0x66b2Ed926b810ca5296407d0fE8F1dB73dFe5924](https://celoscan.io/address/0x66b2Ed926b810ca5296407d0fE8F1dB73dFe5924) |
| PoolAddressProvider | [0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5](https://celoscan.io/address/0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5) |

### Supported Stablecoins

#### Per Chain Stablecoins

## SCROLL
- USDC, USDT
- BKES
  
## CELO
- USDC, USDT, cUSD
- cKES, cNGN
  
## BASE
- USDC, USDT


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
---
```bash
git clone https://github.com/gikenye/ministables.git
cd ministables
```
---
2. Install dependencies:
---
---
```bash
yarn install
```
---
3. Run the development server:
---
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
---
```bash
yarn test
```
---
To deploy to Celo mainnet (requires proper configuration):
---
---
```bash
yarn deploy
```
---
## License

ISC

## Links

- GitHub: [https://github.com/gikenye/ministables.git](https://github.com/gikenye/ministables.git)

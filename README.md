

# Simple DEX - Decentralized Exchange

A beginner-friendly decentralized exchange for swapping tokens on the blockchain.

## Overview

This is a simple DEX where users can swap tokens directly from their crypto wallets. No sign-up needed - just connect your wallet and start trading!

## Features

- **Swap Tokens**: Exchange one token for another instantly
- **Connect Wallet**: Works with MetaMask
- **See Prices**: View current token prices before swapping
- **Transaction History**: See your past swaps
- **Add Liquidity**: Provide tokens to earn trading fees
- **View Pool Stats**: Check liquidity and trading volume

## Tech Stack

### Smart Contract
- **Solidity**: Smart contract language
- **Hardhat**: For writing and testing smart contracts
- **OpenZeppelin**: Pre-built secure contract code

### Frontend (MERN)
- **React**: Building the user interface
- **Node.js + Express**: Backend API server
- **MongoDB**: Store transaction history and pool data
- **Web3.js**: Connect frontend to blockchain

### Tools
- **MetaMask**: Wallet connection
- **Infura/Alchemy**: Connect to Ethereum network

## Project Structure

```
dex-project/
├── contracts/           # Smart contracts
│   ├── DEX.sol         # Main DEX contract
│   └── Token.sol       # ERC20 token contract
├── scripts/            # Deployment scripts
├── test/               # Smart contract tests
├── backend/            # Express server
│   ├── models/         # MongoDB models
│   ├── routes/         # API routes
│   └── server.js       # Main server file
└── frontend/           # React app
    ├── src/
    │   ├── components/ # React components
    │   ├── pages/      # Pages
    │   └── utils/      # Web3 helper functions
    └── public/
```

## How It Works

### 1. Smart Contract (Blockchain)
- **DEX.sol**: Main contract that handles token swaps
  - Users deposit tokens into liquidity pools
  - Contract calculates exchange rates using AMM formula
  - Performs the swap and sends tokens back
  - Distributes trading fees to liquidity providers

### 2. Backend (Express + MongoDB)
- Stores user transaction history
- Caches pool data and token prices
- Provides REST API for frontend
- Tracks liquidity provider positions

### 3. Frontend (React + Web3)
- Connect wallet button (MetaMask)
- Swap interface (select tokens, enter amounts)
- Shows estimated price and fees
- Transaction confirmation and status
- Pool stats dashboard

## Design Choices

### Why This Stack?

**Hardhat**: Easy to learn, great testing tools, perfect for beginners.

**MERN Stack**: JavaScript everywhere - one language for everything.

**Web3.js**: Simple library to connect React to blockchain.

**MongoDB**: Fast and flexible for storing transaction data.

### Simple AMM Model

Using a basic **constant product formula**: `x * y = k`

- Two tokens in a liquidity pool (like ETH and USDC)
- When you swap, the ratio changes but product stays constant
- Prices are determined by the ratio of tokens in the pool
- Simple to understand and implement

### Security Features

- **Slippage Protection**: User sets max price change they accept
- **Reentrancy Guard**: Prevents hacking attacks
- **Access Control**: Owner-only functions for critical operations
- **Input Validation**: All user inputs are checked

## Core Functionality

### Smart Contract
- Add/remove liquidity from pools
- Swap tokens with slippage protection
- Calculate exchange rates automatically
- Distribute trading fees to liquidity providers

### Backend API
- Store and retrieve transaction history
- Cache token prices and pool data
- Provide statistics and analytics

## Frontend Components

- **Wallet Connection**: Connect MetaMask
- **Swap Interface**: Select tokens and enter amounts
- **Price Display**: Shows current rates and estimated output
- **Transaction Status**: Real-time updates
- **Pool Management**: Add/remove liquidity
- **History Dashboard**: View past transactions

## Development Approach

1. **Smart Contract Layer**
   - Write core DEX logic with swap and liquidity functions
   - Test thoroughly with Hardhat
   - Deploy to testnet

2. **Backend Layer**
   - Set up Express API server
   - Connect to MongoDB for data storage
   - Build REST API endpoints

3. **Frontend Layer**
   - Create React UI components
   - Integrate Web3.js for blockchain interaction
   - Connect to backend API for data

4. **Integration & Testing**
   - Connect all layers together
   - Test complete user flows
   - Optimize and fix issues

## How Pricing Works

Uses **constant product formula**: `x * y = k`

- Pool maintains two tokens (like ETH and USDC)
- Price is determined by the ratio of tokens
- Trading fee: 0.3% per swap
- Liquidity providers earn fees proportional to their share

## Data Storage

- **Transactions**: User swaps and liquidity actions
- **Pools**: Token reserves and trading volume
- **User Stats**: Portfolio and earnings tracking

## Future Improvements

- Support for multiple token pairs
- Price charts and historical data
- Limit orders
- Mobile app version
- Token farming/staking
- Gasless transactions (meta-transactions)

## License

MIT License

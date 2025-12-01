# CryptoCast Desktop - Professional Batch Airdrop Tool

> 🚀 Multi-chain Cryptocurrency Batch Reward Distribution Platform - Secure, Efficient, and User-Friendly Desktop Application

**🌍 Languages / 语言 / Idiomas / Langues / Sprachen / языки / اللغة / 언어 / 言語 / Tiếng Việt / Türkçe:**
[🇺🇸 English](../../README.md) | [🇨🇳 中文](../zh/README.md) | [🇪🇸 Español](../es/README.md) | [🇫🇷 Français](../fr/README.md) | [🇩🇪 Deutsch](../de/README.md) | [🇵🇹 Português](../pt/README.md) | [🇷🇺 Русский](../ru/README.md) | [🇸🇦 العربية](../ar/README.md) | [🇰🇷 한국어](../ko/README.md) | [🇯🇵 日本語](../ja/README.md) | [🇻🇳 Tiếng Việt](../vi/README.md) | [🇹🇷 Türkçe](../tr/README.md)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](../../.github/workflows/build.yml)
[![Version](https://img.shields.io/badge/version-1.4.2-blue.svg)](https://github.com/viaweb3/cryptocast-desktop/releases)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue.svg)](../../.github/workflows/build.yml)

---

## 📖 Project Overview

CryptoCast Desktop is a professional cross-platform desktop application built on Electron, designed for marketing campaigns, airdrop distribution, and community rewards, supporting batch token distribution on EVM-compatible chains and Solana.

### ✨ Core Features

#### 🔗 **Multi-Chain Support**
- **EVM Chains**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche, etc.
- **Solana**: Mainnet and devnet support
- **Smart Contracts**: Pre-deployed batch transfer contracts, optimized for gas fees

#### 📦 **Batch Operations**
- **Large-Scale Processing**: Import addresses and amounts from CSV files
- **Batch Transfers**: ERC-20 and Solana (SPL) Token batch sending
- **Real-Time Progress**: Visualized distribution progress and status monitoring

#### 🔒 **Security and Privacy**
- **Local-First**: All sensitive data (such as private keys) are encrypted and stored locally, never passing through any server
- **Isolated Wallets**: Each campaign uses an independent derived wallet, isolating fund risks
- **Fully Offline**: Core functions can operate in offline mode (transaction signing, etc.)

#### 💡 **User Experience**
- **Cross-Platform**: Supports Windows and macOS (Intel & Apple Silicon)
- **Intuitive Interface**: Modern design with simple and clear interaction
- **Cost Estimation**: Real-time gas fee and total cost estimation
- **Transaction History**: Complete transaction history and status tracking
- **Structured Logging**: Winston logging system for easy debugging and issue tracking

---

## 📚 Documentation

- **[Architecture Design](../../ARCHITECTURE.md)** - System architecture and technical decisions
- **[Development Guide](../../DEVELOPMENT.md)** - Development environment setup and workflow
- **[API Documentation](../../API_DOCS.md)** - Internal API documentation
- **[Testing Guide](../../TESTING.md)** - Testing strategy and execution
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project
- **[Changelog](../../CHANGELOG.md)** - Version update history
- **[Development Roadmap](../../ROADMAP.md)** - Feature planning and development plan

---

## 💾 Download and Installation

| Platform | Download Link | Description |
|---------|---------------|-------------|
| **Windows (x64)** | [📥 Download Installer](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | Supports Windows 10 and above |
| **macOS (Intel)** | [📥 Download DMG](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | x64 architecture Mac |
| **macOS (Apple Silicon)** | [📥 Download DMG](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | M1/M2/M3 chip Mac |

👉 [Visit the Releases page to view all versions](https://github.com/viaweb3/cryptocast-desktop/releases)

### 📋 Installation Instructions

**Windows:**
1. Download `CryptoCast Setup *.exe` from the [Releases page](https://github.com/viaweb3/cryptocast-desktop/releases)
2. Run the installer and follow the prompts to complete installation

**macOS:**
1. Download the corresponding architecture `.dmg` file from the [Releases page](https://github.com/viaweb3/cryptocast-desktop/releases)
   - Intel Mac: Download `*-x64.dmg` or `*-mac.dmg`
   - Apple Silicon Mac: Download `*-arm64.dmg`
2. Double-click to open the DMG file and drag `CryptoCast` to the `Applications` folder
3. On first run, you need to allow it in System Preferences (System Preferences → Security & Privacy)

> **Note**: The current version is an unsigned build, intended for development and testing purposes only.

### Resolving Unsigned Application Launch Issues

As the application is not code-signed, the operating system may block it from running. Please follow these steps according to your operating system:

**Windows:**
1. If you encounter the "Windows protected your PC" prompt when running the installer, click "More info" in the popup.
2. Then click "Run anyway".

**macOS:**

*Method 1: Shortcut (Recommended)*
1. Find the CryptoCast application in Finder.
2. **Right-click** (or hold Control and click) on the application icon.
3. Select **"Open"** from the menu.
4. In the warning dialog, click **"Open"**.

*Method 2: System Settings*
1. If you encounter the "Cannot open..." warning when double-clicking, click "Cancel".
2. Open "System Settings" > "Privacy & Security".
3. Find the blocking prompt at the bottom of the page and click **"Open Anyway"**.

> ❓ **If prompted "App is damaged"**:
> This is a common blocking mechanism by macOS for unsigned applications. There are two solutions:
>
> *Method 1: Local Installation without root permissions (Recommended)*
> 1. Drag CryptoCast.app to the user home directory Applications folder (`~/Applications`)
> 2. Open Terminal and execute the following command (no sudo required):
>    ```bash
>    xattr -cr ~/Applications/CryptoCast.app
>    ```
> 3. Now you can launch the application normally from the `~/Applications` folder
> 4. It's recommended to create a Dock icon for the application: drag the application to the Dock bar
>
> *Method 2: System-level Installation (requires administrator privileges)*
> 1. Drag the application to the `/Applications` folder
> 2. Open Terminal and execute the following command:
>    ```bash
>    sudo xattr -cr /Applications/CryptoCast.app
>    ```
> 3. Enter the administrator password to open normally

---

## 🛠️ Development Environment Setup

### Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)
- Git

### 1. Clone the Project

```bash
git clone https://github.com/viaweb3/cryptocast-desktop.git
cd cryptocast-desktop
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run in Development Mode

```bash
npm run dev
```

### 4. Build the Application

```bash
# Build application for current platform
npm run build

# Build for specific platforms
npm run build:win              # Windows x64
npm run build:mac-intel        # macOS Intel (x64)
npm run build:mac-arm          # macOS Apple Silicon (arm64)
```

Build artifacts are located in the `release/` directory.

### 5. Testing Tool Scripts

```bash
# Generate EVM test airdrop list (333 addresses)
node scripts/generate-evm-airdrop.js

# Generate Solana test airdrop list (333 addresses)
node scripts/generate-solana-airdrop.js
```

---

## 📁 Project Structure

```
cryptocast-desktop/
├── 📂 src/
│   ├── 📂 main/                     # Electron main process (Node.js backend)
│   │   ├── 📄 index.ts              # Application entry point
│   │   ├── 📄 preload.ts            # Preload script (IPC security bridge)
│   │   ├── 📂 database/             # SQLite database
│   │   │   ├── 📄 db-adapter.ts     # Database adapter
│   │   │   └── 📄 sqlite-schema.ts  # Database structure and migrations
│   │   ├── 📂 ipc/                  # IPC communication handlers
│   │   │   └── 📄 handlers.ts       # Implementation of all IPC channels
│   │   ├── 📂 services/             # Core business logic
│   │   │   ├── 📄 CampaignService.ts   # Campaign management
│   │   │   ├── 📄 WalletService.ts     # Wallet management
│   │   │   ├── 📄 BlockchainService.ts # Generic blockchain service
│   │   │   ├── 📄 SolanaService.ts     # Solana-specific service
│   │   │   ├── 📄 GasService.ts        # Gas estimation service
│   │   │   └── 📄 ...                # Other services
│   │   └── 📂 utils/                # Utility functions
│   │
│   └── 📂 renderer/                 # Electron renderer process (React frontend)
│       └── 📂 src/
│           ├── 📄 App.tsx           # Application root component
│           ├── 📄 main.tsx          # React entry point
│           ├── 📂 components/       # UI components
│           ├── 📂 pages/            # Page-level components
│           ├── 📂 hooks/            # Custom React Hooks
│           ├── 📂 contexts/         # React Context
│           └── 📂 utils/            # Frontend utility functions
│
├── 📂 contracts/                    # Smart contracts (Solidity)
│   ├── 📂 src/
│   │   └── 📄 BatchAirdropContract.sol # EVM batch airdrop contract
│   └── 📄 foundry.toml              # Foundry configuration
│
├── 📄 package.json                  # Project configuration and dependencies
├── 📄 vite.config.ts                # Vite configuration
├── 📄 electron-builder.json         # Electron Builder packaging configuration
├── 📄 jest.config.mjs               # Jest testing configuration
```

---

## 🛠️ Technology Stack

### 🎨 Frontend
- **React**: UI framework
- **TypeScript**: Type system
- **Vite**: Build tool
- **TailwindCSS**: CSS framework
- **DaisyUI**: TailwindCSS component library
- **React Router**: Routing

### ⚙️ Backend & Application Core
- **Node.js 18+**: Runtime environment
- **Electron 39.2.2**: Cross-platform desktop application framework
- **SQLite**: Local database
- **TypeScript 5.7.3**: Type system
- **Winston 3.18.3**: Structured logging system

### 🔗 Blockchain
- **ethers.js**: EVM chain interaction library
- **@solana/web3.js**: Solana chain interaction library
- **Foundry**: Solidity development and testing framework

### 🧪 Testing
- **Jest**: Unit/integration testing
- **@testing-library/react**: React component testing

---

## 🏗️ Architecture Design

### Core Services
The application backend logic is split into multiple services located in `src/main/services/`, including:

- **CampaignService**: Responsible for creating, managing, and executing airdrop campaigns
- **WalletManagementService / WalletService**: Manages user wallets, including creation, import, and secure storage
- **ChainManagementService / ChainService**: Manages and connects to different blockchain networks (EVM & Solana)
- **ContractService**: Responsible for deploying and interacting with smart contracts
- **GasService / PriceService**: Estimates transaction fees and retrieves token prices
- **SolanaService**: Handles all Solana-specific logic
- **CampaignEstimator / CampaignExecutor**: Responsible for campaign cost estimation and execution, respectively

### Data Storage
The application uses **SQLite** as the local database, with table structures defined in `src/main/database/sqlite-schema.ts`.

#### Main Data Tables
```sql
-- Campaigns Table
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
  chain_id INTEGER,
  token_address TEXT NOT NULL,
  status TEXT NOT NULL,
  total_recipients INTEGER NOT NULL,
  wallet_address TEXT,
  contract_address TEXT,
  ...
);

-- Recipients Table
CREATE TABLE recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  address TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  tx_hash TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- Transactions Table
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  tx_type TEXT NOT NULL,
  status TEXT NOT NULL,
  ...
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- Blockchain Networks Table
CREATE TABLE chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('evm', 'solana')),
  name TEXT NOT NULL UNIQUE,
  rpc_url TEXT NOT NULL,
  ...
);
```

### Data Storage Location
- **Windows**: `%APPDATA%\\cryptocast\\`
- **macOS**: `~/Library/Application Support/cryptocast/`
- **Linux**: `~/.config/cryptocast/`

---

## 🧪 Testing

### Run Tests

```bash
# Run all unit and integration tests
npm test

# Generate coverage report
npm run test:coverage
```

---

## 🤝 Contributing

We welcome all forms of contribution! Please read the **[CONTRIBUTING.md](./CONTRIBUTING.md)** file for details.

---

## 📄 License

This project is licensed under the [MIT License](../../LICENSE).

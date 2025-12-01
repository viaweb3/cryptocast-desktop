# CryptoCast Desktop - 专业级批量空投工具

> 🚀 支持多链的加密货币批量奖励分发平台 - 安全、高效、易用的桌面应用

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](.github/workflows/build.yml)
[![Version](https://img.shields.io/badge/version-1.4.1-blue.svg)](https://github.com/viaweb3/cryptocast-desktop/releases)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue.svg)](.github/workflows/build.yml)

---

## 📖 项目简介

CryptoCast Desktop 是一个基于 Electron 的专业级跨平台桌面应用，专为营销活动、空投分发、社区奖励等场景设计，支持 EVM 兼容链和 Solana 的批量代币分发。

### ✨ 核心特性

#### 🔗 **多链支持**
- **EVM 链**: Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche 等
- **Solana**: 主网和开发网支持
- **智能合约**: 预部署批量转账合约，优化 Gas 费用

#### 📦 **批量操作**
- **大规模处理**: 从 CSV 文件导入地址和金额
- **批量转账**: ERC-20, Solana (SPL) Token 批量发送
- **实时进度**: 可视化分发进度和状态监控

#### 🔒 **安全与隐私**
- **本地优先**: 所有敏感数据（如私钥）均在本地加密存储，不经过任何服务器。
- **独立钱包**: 每个活动使用独立的派生钱包，隔离资金风险。
- **完全离线**: 核心功能可在离线模式下操作（交易签名等）。

#### 💡 **用户体验**
- **跨平台**: 支持 Windows 和 macOS (Intel & Apple Silicon)
- **直观界面**: 现代化设计，交互简单清晰
- **成本估算**: 实时 Gas 费用和总成本估算
- **历史记录**: 完整的交易历史和状态追踪
- **结构化日志**: Winston 日志系统，便于调试和问题追踪

---

## 📚 文档

- **[架构设计](./ARCHITECTURE.md)** - 系统架构和技术决策
- **[开发指南](./DEVELOPMENT.md)** - 开发环境设置与流程
- **[API 文档](./API_DOCS.md)** - 内部 API 文档
- **[测试指南](./TESTING.md)** - 测试策略与执行
- **[贡献指南](./CONTRIBUTING.md)** - 如何参与项目贡献
- **[更新日志](./CHANGELOG.md)** - 版本更新记录
- **[开发路线图](./ROADMAP.md)** - 功能规划和开发计划

---

## 💾 下载和安装

**最新版本：v1.4.2**

| 平台 | 下载链接 | 说明 |
|------|----------|------|
| **Windows (x64)** | [📥 下载安装包](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | 支持 Windows 10 及以上 |
| **macOS (Intel)** | [📥 下载 DMG](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | x64 架构 Mac |
| **macOS (Apple Silicon)** | [📥 下载 DMG](https://github.com/viaweb3/cryptocast-desktop/releases/latest) | M1/M2/M3 芯片 Mac |

👉 [访问 Releases 页面查看所有版本](https://github.com/viaweb3/cryptocast-desktop/releases)

### 📋 安装说明

**Windows:**
1. 从 [Releases 页面](https://github.com/viaweb3/cryptocast-desktop/releases) 下载 `CryptoCast Setup *.exe`
2. 运行安装程序并按提示完成安装

**macOS:**
1. 从 [Releases 页面](https://github.com/viaweb3/cryptocast-desktop/releases) 下载对应架构的 `.dmg` 文件
   - Intel Mac：下载 `*-x64.dmg` 或 `*-mac.dmg`
   - Apple Silicon Mac：下载 `*-arm64.dmg`
2. 双击打开 DMG 文件，将 `CryptoCast` 拖拽到 `Applications` 文件夹
3. 首次运行时需要在系统偏好设置中允许（系统偏好设置 → 安全性与隐私）

> **注意**: 当前版本为未签名构建，仅用于开发和测试目的。

### 解决未签名应用的启动问题

由于应用未进行代码签名，操作系统可能会阻止其运行。请根据您的操作系统，按照以下步骤操作：

**Windows:**
1.  如果在运行安装包时遇到“Windows 已保护你的电脑”提示，请点击弹窗中的“更多信息” (More info)。
2.  然后点击“仍要运行” (Run anyway)。

**macOS:**

*方法一：快捷方式（推荐）*
1.  在 Finder 中找到 CryptoCast 应用。
2.  **右键点击** (或按住 Control 键点击) 应用图标。
3.  在菜单中选择 **“打开”**。
4.  在弹出的警告对话框中，点击 **“打开”**。

*方法二：系统设置*
1.  如果在直接双击打开时遇到“无法打开...”警告，点击“取消”。
2.  打开“系统设置” (System Settings) > “隐私与安全性” (Privacy & Security)。
3.  在页面下方找到拦截提示，点击 **“仍要打开”** (Open Anyway)。

> ❓ **如果提示"应用已损坏" (App is damaged)**:
>这是 macOS 对未签名应用的常见拦截机制。有两种解决方法：
>
>*方法一：无 root 权限的本地安装（推荐）*
>1.  将 CryptoCast.app 拖拽到用户主目录的应用文件夹 (`~/Applications`)
>2.  打开终端 (Terminal)，执行以下命令（不需要 sudo）：
>    ```bash
>    xattr -cr ~/Applications/CryptoCast.app
>    ```
>3.  现在可以从 `~/Applications` 文件夹正常启动应用
>4.  建议为应用创建 Dock 图标：将应用拖拽到 Dock 栏
>
>*方法二：系统级安装（需要管理员权限）*
>1.  将应用拖拽到 `/Applications` 文件夹
>2.  打开终端 (Terminal)，执行以下命令：
>    ```bash
>    sudo xattr -cr /Applications/CryptoCast.app
>    ```
>3.  输入管理员密码即可正常打开

---

## 🛠️ 开发环境设置

### 前置要求

- Node.js 24+
- npm (或 yarn/pnpm)
- Git

### 1. 克隆项目

```bash
git clone https://github.com/viaweb3/cryptocast-desktop.git
cd cryptocast-desktop
```

### 2. 安装依赖

```bash
npm install
```

### 3. 开发模式运行

```bash
npm run dev
```

### 4. 构建应用

```bash
# 构建当前平台的应用
npm run build

# 分别构建特定平台的应用
npm run build:win              # Windows x64
npm run build:mac-intel        # macOS Intel (x64)
npm run build:mac-arm          # macOS Apple Silicon (arm64)
```

构建产物位于 `release/` 目录。

### 5. 测试工具脚本

```bash
# 生成 EVM 测试空投列表（333个地址）
node scripts/generate-evm-airdrop.js

# 生成 Solana 测试空投列表（333个地址）
node scripts/generate-solana-airdrop.js
```

---

## 📁 项目结构

```
cryptocast-desktop/
├── 📂 src/
│   ├── 📂 main/                     # Electron 主进程 (Node.js 后端)
│   │   ├── 📄 index.ts              # 应用主入口
│   │   ├── 📄 preload.ts            # Preload 脚本 (IPC 安全桥接)
│   │   ├── 📂 database/             # SQLite 数据库
│   │   │   ├── 📄 db-adapter.ts     # 数据库适配器
│   │   │   └── 📄 sqlite-schema.ts  # 数据库结构与迁移
│   │   ├── 📂 ipc/                  # IPC 通信处理器
│   │   │   └── 📄 handlers.ts       # 所有 IPC Channel 的实现
│   │   ├── 📂 services/             # 核心业务逻辑
│   │   │   ├── 📄 CampaignService.ts   # 活动管理
│   │   │   ├── 📄 WalletService.ts     # 钱包管理
│   │   │   ├── 📄 BlockchainService.ts # 区块链通用服务
│   │   │   ├── 📄 SolanaService.ts     # Solana 特定服务
│   │   │   ├── 📄 GasService.ts        # Gas 估算服务
│   │   │   └── 📄 ...                # 其他服务
│   │   └── 📂 utils/                # 工具函数
│   │
│   └── 📂 renderer/                 # Electron 渲染进程 (React 前端)
│       └── 📂 src/
│           ├── 📄 App.tsx           # 应用根组件
│           ├── 📄 main.tsx          # React 入口
│           ├── 📂 components/       # UI 组件
│           ├── 📂 pages/            # 页面级组件
│           ├── 📂 hooks/            # 自定义 React Hooks
│           ├── 📂 contexts/         # React Context
│           └── 📂 utils/            # 前端工具函数
│
├── 📂 contracts/                    # 智能合约 (Solidity)
│   ├── 📂 src/
│   │   └── 📄 BatchAirdropContract.sol # EVM 批量空投合约
│   └── 📄 foundry.toml              # Foundry 配置
│
├── 📄 package.json                  # 项目配置与依赖
├── 📄 vite.config.ts                # Vite 配置
├── 📄 electron-builder.json         # Electron Builder 打包配置
├── 📄 jest.config.mjs               # Jest 测试配置
```

---

## 🛠️ 技术栈

### 🎨 前端
- **React**: UI 框架
- **TypeScript**: 类型系统
- **Vite**: 构建工具
- **TailwindCSS**: CSS 框架
- **DaisyUI**: TailwindCSS 组件库
- **React Router**: 路由

### ⚙️ 后端 & 应用核心
- **Node.js 24+**: 运行时环境
- **Electron 39.2.2**: 跨平台桌面应用框架
- **SQLite**: 本地数据库
- **TypeScript 5.7.3**: 类型系统
- **Winston 3.18.3**: 结构化日志系统

### 🔗 区块链
- **ethers.js**: EVM 链交互库
- **@solana/web3.js**: Solana 链交互库
- **Foundry**: Solidity 开发和测试框架

### 🧪 测试
- **Jest**: 单元/集成测试
- **@testing-library/react**: React 组件测试

---

## 🏗️ 架构设计

### 核心服务
应用后端逻辑被拆分为多个服务，位于 `src/main/services/`，主要包括：

- **CampaignService**: 负责创建、管理和执行空投活动。
- **WalletManagementService / WalletService**: 管理用户钱包，包括创建、导入和安全存储。
- **ChainManagementService / ChainService**: 管理和连接到不同的区块链网络 (EVM & Solana)。
- **ContractService**: 负责部署和交互智能合约。
- **GasService / PriceService**: 估算交易费用和获取代币价格。
- **SolanaService**: 处理所有与 Solana 相关的特定逻辑。
- **CampaignEstimator / CampaignExecutor**: 分别负责活动成本估算和执行。

### 数据存储
应用使用 **SQLite** 作为本地数据库，表结构定义于 `src/main/database/sqlite-schema.ts`。

#### 主要数据表
```sql
-- 活动表 (Campaigns)
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

-- 接收地址表 (Recipients)
CREATE TABLE recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  address TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  tx_hash TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- 交易记录表 (Transactions)
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  tx_type TEXT NOT NULL,
  status TEXT NOT NULL,
  ...
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- 区块链网络表 (Chains)
CREATE TABLE chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('evm', 'solana')),
  name TEXT NOT NULL UNIQUE,
  rpc_url TEXT NOT NULL,
  ...
);
```

### 数据存储位置
- **Windows**: `%APPDATA%\\cryptocast\\`
- **macOS**: `~/Library/Application Support/cryptocast/`
- **Linux**: `~/.config/cryptocast/`

---

## 🧪 测试

### 运行测试

```bash
# 运行所有单元和集成测试
npm test

# 生成覆盖率报告
npm run test:coverage
```

---

## 🤝 贡献

欢迎任何形式的贡献！请阅读 **[CONTRIBUTING.md](./CONTRIBUTING.md)** 文件了解详情。

---

## 📄 许可证

本项目基于 [MIT License](./LICENSE) 授权。

# CryptoCast Desktop 技术架构

## 1. 系统架构概览

CryptoCast Desktop 是一个基于 Electron 的跨平台桌面应用。其架构在逻辑上分为两个主要部分：**主进程 (Main Process)** 和 **渲染进程 (Renderer Process)**。

-   **主进程**: 作为后端，使用 Node.js 运行。它负责处理核心业务逻辑、文件系统访问、数据库操作以及与区块链的所有交互。
-   **渲染进程**: 作为前端，负责渲染UI界面。它是一个使用 React 和 Vite 构建的单页应用 (SPA)。
-   **IPC 通信**: 主进程和渲染进程通过 Electron 的进程间通信 (IPC) 机制进行安全通信。渲染进程通过 `preload.ts` 脚本暴露的接口调用主进程提供的服务。

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    CryptoCast Desktop App                  │
├─────────────────────────────────────────────────────────────┤
│  🎨 渲染进程 (React UI)                                    │
│  ┌───────────┬────────────┬───────────┬────────────┐      │
│  │ Dashboard │ Campaigns  │ Wallets   │ Settings   │      │
│  └───────────┴────────────┴───────────┴────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ▲
                         🔄 IPC Bridge (preload.ts)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ 主进程 (Node.js Backend)                               │
│  ┌────────────┬───────────┬───────────┬───────────┐      │
│  │ Campaign-  │ Wallet-   │ Chain-    │ Solana-   │      │
│  │ Service    │ Service   │ Service   │ Service   │      │
│  └────────────┴───────────┴───────────┴───────────┘      │
├─────────────────────────────────────────────────────────────┤
│  💾 数据层 (SQLite & File System)                           │
├─────────────────────────────────────────────────────────────┤
│  🌐 区块链集成 (ethers.js & @solana/web3.js)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 核心模块设计

### 2.1. 渲染进程 (Frontend)

-   **技术栈**: 使用 **React**、**Vite** 和 **TypeScript** 构建。
-   **UI**: 采用 **TailwindCSS** 和 **DaisyUI** 构建现代化、响应式的用户界面。
-   **路由**: 使用 **React Router** 管理页面导航。
-   **目录结构** (`src/renderer/src/`):
    -   `pages/`: 存放顶层页面组件，如仪表盘、活动列表、设置等。
    -   `components/`: 存放可复用的UI组件。
    -   `hooks/`: 存放自定义 React Hooks，用于封装业务逻辑和状态。
    -   `contexts/`: 存放 React Context，用于全局状态管理。
    -   `utils/`: 存放前端专用的工具函数。
-   **状态管理**: 主要通过自定义 Hooks (`use...`) 和 React Context 实现，用于管理UI状态、表单数据和从主进程获取的数据。

### 2.2. 主进程 (Backend)

主进程采用面向服务的架构 (SOA)，将核心逻辑封装在不同的服务模块中。所有服务和IPC处理器均位于 `src/main/`。

#### 服务层 (`src/main/services/`)

这是应用的核心，每个服务都有明确的职责：

-   `CampaignService`: 管理空投活动的整个生命周期，包括创建、状态更新、执行和查询。它是核心协调者。
-   `WalletManagementService`: **有状态**的服务，负责管理活动钱包的数据库记录、余额追踪和私钥的安全存储（通过数据库）。
-   `WalletService`: **无状态**的工具服务，仅负责生成密钥对（EVM 和 Solana）和进行简单的密钥格式转换，不直接操作数据库。
-   `ChainService`: 管理和维护支持的区块链网络配置（EVM 和 Solana），包括增删改查和延迟测试。
-   `BlockchainService`: 提供区块链交互的通用门面接口。虽然设计为通用，但在实际实现中，它主要处理 EVM 链的通用逻辑（如余额查询），并包含部分 Solana 的特定逻辑（如 `withdrawRemainingSPLTokens`）。
-   `SolanaService`: 专注于 Solana 链的特定交互逻辑（如构建交易、SPL 代币操作），以处理 Solana 独特的账户模型。
-   `ContractService`: 专注于 EVM 智能合约的部署和交互（如 `withdrawRemainingTokens`, `batchTransfer`）。
-   `GasService`: 负责从链上获取实时 Gas 价格，计算 EIP-1559 费用，并提供交易成本估算。
-   `TokenService`: 负责获取代币的元数据（名称、符号、精度），支持 ERC20 和 SPL Token。
-   `CampaignEstimator`: 在活动开始前估算所需成本（Gas费等）。
-   `PriceService`: 从外部API获取和缓存加密货币的价格。
-   `FileService`: 处理文件操作，如读取 CSV 地址列表和导出报告。

#### IPC 通信 (`src/main/ipc/handlers.ts`)

主进程通过 IPC 向渲染进程暴露其服务能力。

-   **实现方式**: `src/main/ipc/handlers.ts` 文件中的 `setupIPCHandlers` 函数负责初始化所有服务，并使用 `ipcMain.handle` 为每个 API 端点注册一个处理器。
-   **API 分类**: API 按功能进行分组，使用 `:` 作为命名空间，例如：
    -   `campaign:*` (创建/查询活动)
    -   `wallet:*` (管理钱包)
    -   `chain:*` (管理网络配置)
    -   `file:*` (文件操作)
    -   `price:*` (获取价格)
-   **安全性**: 渲染进程只能通过 `preload.ts` 脚本中显式暴露的函数来调用这些IPC处理器，这可以防止渲染进程中的第三方脚本直接访问主进程的 Node.js API。

---

## 3. 数据存储架构

应用使用 **SQLite** 作为本地数据库，通过 `sqlite` 和 `sqlite3` 包进行操作。数据库的初始化、表结构定义和迁移逻辑位于 `src/main/database/sqlite-schema.ts`。

### 数据库表结构 (Schema)

以下是核心数据表的简化结构：

```sql
-- 活动表 (Campaigns)
-- 存储每个空投活动的核心信息
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
  chain_id INTEGER,
  token_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'FUNDED', 'READY', 'SENDING', 'PAUSED', 'COMPLETED', 'FAILED')),
  total_recipients INTEGER NOT NULL,
  completed_recipients INTEGER DEFAULT 0,
  wallet_address TEXT,
  contract_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 接收地址表 (Recipients)
-- 存储每个活动的接收者地址和金额
CREATE TABLE recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  address TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  tx_hash TEXT,
  error_message TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  UNIQUE(campaign_id, address)
);

-- 交易记录表 (Transactions)
-- 记录与活动相关的每一笔链上交易
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('DEPLOY_CONTRACT', 'TRANSFER_TO_CONTRACT', ...)),
  from_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
  gas_used REAL DEFAULT 0,
  FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE
);

-- 区块链网络表 (Chains)
-- 存储用户自定义和默认的区块链网络配置
CREATE TABLE chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('evm', 'solana')),
  name TEXT NOT NULL UNIQUE,
  rpc_url TEXT NOT NULL,
  explorer_url TEXT,
  symbol TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT 0
);
```

### 数据存储位置

-   **Windows**: `%APPDATA%\cryptocast\`
-   **macOS**: `~/Library/Application Support/cryptocast/`
-   **Linux**: `~/.config/cryptocast/`

---

## 4. 区块链集成

-   **EVM 链**: 使用 **ethers.js** 库与所有 EVM 兼容链（如 Ethereum, Polygon, BSC）进行交互。`BlockchainService` 和 `ContractService` 封装了相关操作，例如查询余额、发送交易和部署合约。
-   **Solana**: 使用 **@solana/web3.js** 和 **@solana/spl-token** 库与 Solana 网络进行交互。所有 Solana 特定的逻辑都封装在 `SolanaService` 中，以将其与 EVM 逻辑解耦。
-   **多链管理**: `ChainService` 负责管理不同链的 RPC 端点和其他配置信息，允许用户添加和切换网络。

---

## 5. 智能合约 (Smart Contracts)

项目包含一个高度优化的 EVM 批量转账合约 `BatchAirdropContract`。

-   **设计目标**: 极简、省 Gas、安全。
-   **特性**:
    -   **无依赖**: 不依赖 OpenZeppelin 等外部库，减少合约体积和部署成本。
    -   **Gas 优化**: 使用 `calldata` 代替 `memory`，缓存数组长度，使用 `unchecked` 进行循环计数，自定义 Error 替代 require 字符串。
    -   **原子性**: 批量转账操作是原子的，只要有一笔失败，整个交易回滚，确保资金安全。
    -   **功能**: 支持 `batchTransfer` (ERC20) 和 `batchTransferNative` (原生代币)。
-   **位置**: `contracts/src/BatchAirdropContract.sol`。

---

## 6. 安全设计

-   **私钥管理**:
    -   私钥 **永远不会离开用户本地设备**。
    -   为每个活动创建的派生钱包，其私钥以 Base64 编码后存储在本地 SQLite 数据库中。
    -   未来的版本计划对存储的私钥进行强加密。
-   **进程隔离**: Electron 的架构天然提供了进程隔离。渲染进程运行在沙箱环境中，对系统资源的访问受限，所有需要访问文件系统或执行敏感操作的请求都必须通过主进程的 IPC 接口。
-   **数据验证**: 所有从渲染进程传入的数据（例如，用户输入、CSV文件内容）在主进程中都会经过严格的验证，以防止格式错误或恶意数据。

---

## 6. 测试策略

-   **单元测试**: 使用 **Jest** 框架对主进程中的各个服务 (`/services`) 进行单元测试，以确保每个模块的业务逻辑正确。
-   **组件测试**: 使用 **Jest** 和 **React Testing Library** 对前端组件进行测试。
-   **集成测试**: 使用 **Jest** 测试服务与数据库或服务之间的交互。
-   **测试命令**: `package.json` 中定义了多种测试脚本，如 `npm test` (运行所有测试), `npm run test:unit` (运行单元测试), `npm run test:integration` (集成测试) 等。
-   **测试覆盖率**: `npm run test:coverage` 命令可以生成代码覆盖率报告。

---

## 7. 技术债务与未来改进

-   **代码结构**: `ipc/handlers.ts` 文件过于庞大，未来可以考虑将其按功能域拆分为多个文件。部分服务类的职责也可以进一步细化。
-   **安全性**: 目前私钥仅以 Base64 存储，需要尽快实现基于用户密码派生密钥的强加密方案 (AES-256-GCM)。
-   **性能**: 对于超大规模的空投（数万地址），当前的串行/并行处理逻辑可能需要优化，例如引入更精细的队列和并发控制。
-   **错误处理**: 当前的错误处理和重试机制可以进一步标准化和增强。
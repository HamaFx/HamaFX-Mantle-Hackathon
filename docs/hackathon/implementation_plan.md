# HamaFX-Ai → Mantle Alpha Agent — Implementation Plan

> **Target**: Track 2 — AI Alpha & Data, Mantle Turing Test Hackathon 2026  
> **Deadline**: June 15, 2026 (9 days from June 6)  
> **Approach**: Extend the existing monorepo, do NOT rewrite — every existing capability is an advantage  
> **Execution mode**: AI-agent vibecodeable — every task has exact file paths, interfaces, and logic

---

## High-Level Architecture (After Adaptation)

```
┌──────────────────────────────────────────────────────────────┐
│                  apps/web (Vercel)                            │
│  Existing: /chat, /chart, /news, /calendar, /journal         │
│  NEW:      /signals     → on-chain alpha signal feed         │
│  NEW:      /dashboard   → agent performance + Mantle stats   │
│  ADAPTED:  /api/chat    → crypto-aware system prompt         │
│  NEW:      /api/signals → signal CRUD + on-chain logging     │
│  NEW:      /api/cron/onchain-scan → periodic chain scanner   │
└──────────────────────────────────────────────────────────────┘
                      ↕ Postgres (Supabase)    ↕ Mantle RPC
┌──────────────────────────────────────────────────────────────┐
│              apps/worker (GCE VM)                            │
│  Existing: MT5 bridge + BiQuote SignalR (keep running)       │
│  NEW:      Mantle block watcher (poll new blocks every ~5s)  │
│  NEW:      Whale/DEX event detector → onchain_events table   │
│  NEW:      Signal generator → runs AI analysis pipeline      │
│  NEW:      On-chain logger → writes signals to smart contract│
└──────────────────────────────────────────────────────────────┘
                      ↕
┌──────────────────────────────────────────────────────────────┐
│            contracts/ (NEW — project root)                    │
│  MantleAlphaLogger.sol → logs signals as on-chain events     │
│  Deployed to Mantle Sepolia testnet                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Workstream 1: Smart Contract (Day 1)

### 1.1 Create contract directory

**Create**: `contracts/` at project root  
**Create**: `contracts/hardhat.config.ts`  
**Create**: `contracts/package.json`  
**Create**: `contracts/contracts/MantleAlphaLogger.sol`  
**Create**: `contracts/scripts/deploy.ts`  
**Create**: `contracts/test/MantleAlphaLogger.test.ts`  
**Create**: `contracts/.env.example`

> [!IMPORTANT]
> Do NOT add `contracts/` to `pnpm-workspace.yaml`. It's a standalone Hardhat project with its own `node_modules`. This avoids polluting the monorepo dependency graph.

### 1.2 Smart Contract: `MantleAlphaLogger.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MantleAlphaLogger {
    address public owner;
    uint256 public signalCount;

    struct Signal {
        uint256 id;
        uint256 timestamp;
        string signalType;     // "whale_alert" | "defi_anomaly" | "alpha_signal" | "macro_event"
        string asset;          // "MNT" | "WETH" | "USDT" | "mETH"
        string direction;      // "bullish" | "bearish" | "neutral"
        uint8  confidence;     // 1-10
        string committeeGrade; // "A" | "B" | "C" | "D" | "F"
        string goNoGo;         // "go" | "caution" | "no-go"
        string ipfsHash;       // IPFS hash of full analysis JSON (optional)
        string summary;        // Short on-chain summary (max 280 chars)
    }

    mapping(uint256 => Signal) public signals;

    event SignalLogged(
        uint256 indexed id,
        uint256 timestamp,
        string signalType,
        string asset,
        string direction,
        uint8  confidence,
        string committeeGrade,
        string goNoGo,
        string summary
    );

    event AgentRegistered(address indexed agent, string name, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit AgentRegistered(msg.sender, "HamaFX-Alpha-Agent", block.timestamp);
    }

    function logSignal(
        string calldata signalType,
        string calldata asset,
        string calldata direction,
        uint8  confidence,
        string calldata committeeGrade,
        string calldata goNoGo,
        string calldata ipfsHash,
        string calldata summary
    ) external onlyOwner returns (uint256) {
        signalCount++;
        signals[signalCount] = Signal({
            id: signalCount,
            timestamp: block.timestamp,
            signalType: signalType,
            asset: asset,
            direction: direction,
            confidence: confidence,
            committeeGrade: committeeGrade,
            goNoGo: goNoGo,
            ipfsHash: ipfsHash,
            summary: summary
        });

        emit SignalLogged(
            signalCount,
            block.timestamp,
            signalType,
            asset,
            direction,
            confidence,
            committeeGrade,
            goNoGo,
            summary
        );

        return signalCount;
    }

    function getSignal(uint256 id) external view returns (Signal memory) {
        require(id > 0 && id <= signalCount, "Invalid signal ID");
        return signals[id];
    }

    function getLatestSignals(uint256 count) external view returns (Signal[] memory) {
        uint256 resultCount = count > signalCount ? signalCount : count;
        Signal[] memory result = new Signal[](resultCount);
        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = signals[signalCount - i];
        }
        return result;
    }
}
```

### 1.3 Hardhat config

```typescript
// contracts/hardhat.config.ts
import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    mantleSepolia: {
      url: "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
    mantleMainnet: {
      url: "https://rpc.mantle.xyz",
      chainId: 5000,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
};
export default config;
```

### 1.4 Deploy script

```typescript
// contracts/scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const factory = await ethers.getContractFactory("MantleAlphaLogger");
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`MantleAlphaLogger deployed to: ${address}`);
  // Save address to a file for the monorepo to read
  const fs = require("fs");
  fs.writeFileSync(
    "./deployed-address.json",
    JSON.stringify({ address, network: "mantleSepolia", deployedAt: new Date().toISOString() })
  );
}
main().catch(console.error);
```

### 1.5 Deployment steps (run manually or via script)

```bash
cd contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
npx hardhat compile
# Create .env with DEPLOYER_PRIVATE_KEY=<your-mantle-sepolia-funded-wallet>
# Get testnet MNT from https://faucet.sepolia.mantle.xyz
npx hardhat run scripts/deploy.ts --network mantleSepolia
```

---

## Workstream 2: New `packages/web3` Package (Days 1-2)

### 2.1 Package scaffold

**Create**: `packages/web3/package.json`

```json
{
  "name": "@hamafx/web3",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "viem": "^2.21.0",
    "@hamafx/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.0"
  }
}
```

**Add** `"packages/*"` is already in `pnpm-workspace.yaml` — `packages/web3` is auto-included.

**Create**: `packages/web3/tsconfig.json` (extend `../../tsconfig.base.json`)  
**Create**: `packages/web3/eslint.config.js` (copy from any sibling)  
**Create**: `packages/web3/vitest.config.ts` (copy from any sibling)

### 2.2 Mantle client: `packages/web3/src/client.ts`

```typescript
import { createPublicClient, http, type PublicClient, type Chain } from "viem";

export const mantleSepolia: Chain = {
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia.mantle.xyz"] } },
  blockExplorers: {
    default: { name: "Mantle Sepolia Explorer", url: "https://sepolia.mantlescan.xyz" },
  },
};

export const mantleMainnet: Chain = {
  id: 5000,
  name: "Mantle",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mantle.xyz"] } },
  blockExplorers: {
    default: { name: "MantleScan", url: "https://mantlescan.xyz" },
  },
};

let client: PublicClient | null = null;

export function getMantleClient(): PublicClient {
  if (!client) {
    const rpcUrl = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
    const chain = rpcUrl.includes("sepolia") ? mantleSepolia : mantleMainnet;
    client = createPublicClient({ chain, transport: http(rpcUrl) });
  }
  return client;
}

export function getExplorerUrl(type: "tx" | "address", hash: string): string {
  const baseUrl = (process.env.MANTLE_RPC_URL || "").includes("sepolia")
    ? "https://sepolia.mantlescan.xyz"
    : "https://mantlescan.xyz";
  return `${baseUrl}/${type}/${hash}`;
}
```

### 2.3 Contract bindings: `packages/web3/src/alpha-logger.ts`

```typescript
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getMantleClient, mantleSepolia, getExplorerUrl } from "./client.js";

// ABI — only the functions we call. Paste the full ABI from Hardhat compilation.
export const ALPHA_LOGGER_ABI = [
  /* paste compiled ABI here after deploying */
] as const;

export function getAlphaLoggerAddress(): `0x${string}` {
  const addr = process.env.MANTLE_ALPHA_LOGGER_ADDRESS;
  if (!addr) throw new Error("MANTLE_ALPHA_LOGGER_ADDRESS env not set");
  return addr as `0x${string}`;
}

function getWalletClient(): WalletClient {
  const pk = process.env.MANTLE_AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("MANTLE_AGENT_PRIVATE_KEY env not set");
  const account = privateKeyToAccount(pk as `0x${string}`);
  const rpcUrl = process.env.MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz";
  return createWalletClient({
    account,
    chain: mantleSepolia,
    transport: http(rpcUrl),
  });
}

export interface LogSignalArgs {
  signalType: "whale_alert" | "defi_anomaly" | "alpha_signal" | "macro_event";
  asset: string;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 1-10
  committeeGrade: string;
  goNoGo: "go" | "caution" | "no-go";
  ipfsHash: string;
  summary: string; // max 280 chars
}

export interface LogSignalResult {
  txHash: string;
  signalId: number;
  explorerUrl: string;
}

export async function logSignalOnChain(args: LogSignalArgs): Promise<LogSignalResult> {
  const wallet = getWalletClient();
  const publicClient = getMantleClient();
  const address = getAlphaLoggerAddress();

  const txHash = await wallet.writeContract({
    address,
    abi: ALPHA_LOGGER_ABI,
    functionName: "logSignal",
    args: [
      args.signalType,
      args.asset,
      args.direction,
      args.confidence,
      args.committeeGrade,
      args.goNoGo,
      args.ipfsHash,
      args.summary.slice(0, 280),
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Parse SignalLogged event to get the signal ID
  let signalId = 0;
  for (const log of receipt.logs) {
    // Parse the event — signalId is the first indexed topic
    if (log.topics[1]) {
      signalId = Number(BigInt(log.topics[1]));
    }
  }

  return {
    txHash,
    signalId,
    explorerUrl: getExplorerUrl("tx", txHash),
  };
}

export async function getSignalCount(): Promise<number> {
  const client = getMantleClient();
  const count = await client.readContract({
    address: getAlphaLoggerAddress(),
    abi: ALPHA_LOGGER_ABI,
    functionName: "signalCount",
  });
  return Number(count);
}
```

### 2.4 On-chain data reader: `packages/web3/src/chain-reader.ts`

```typescript
import { formatEther, parseAbiItem, type Log } from "viem";
import { getMantleClient } from "./client.js";

export interface WhaleTransfer {
  from: string;
  to: string;
  value: string;       // human readable
  valueRaw: bigint;
  token: string;       // "MNT" | "WETH" | "USDT" | "mETH"
  tokenAddress: string;
  txHash: string;
  blockNumber: bigint;
  timestamp: number;
}

export interface OnChainActivity {
  blockNumber: bigint;
  timestamp: number;
  transactionCount: number;
  whaleTransfers: WhaleTransfer[];
  totalVolumeUsd: number; // estimated
}

// Well-known token addresses on Mantle (update for sepolia vs mainnet)
export const MANTLE_TOKENS: Record<string, { address: `0x${string}`; symbol: string; decimals: number }> = {
  WETH:  { address: "0xdEAddEaDdeadDEadDEADDEaDDeaDDeAd00000000", symbol: "WETH",  decimals: 18 },
  USDT:  { address: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE", symbol: "USDT",  decimals: 6  },
  USDC:  { address: "0x09Bc4E0D10E52d8DA52E4f45D34B08B98F0ED2e0", symbol: "USDC",  decimals: 6  },
  WMNT:  { address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8", symbol: "WMNT",  decimals: 18 },
  mETH:  { address: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0", symbol: "mETH",  decimals: 18 },
};

// Whale threshold: transfers above this USD value are flagged
const WHALE_THRESHOLD_USD = 50_000;

const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/**
 * Scan recent blocks for whale transfers on known Mantle tokens.
 * Returns transfers above the whale threshold.
 */
export async function scanRecentBlocks(blockRange: number = 100): Promise<OnChainActivity> {
  const client = getMantleClient();
  const latestBlock = await client.getBlockNumber();
  const fromBlock = latestBlock - BigInt(blockRange);

  const whaleTransfers: WhaleTransfer[] = [];

  // Scan ERC-20 Transfer events for each tracked token
  for (const [name, token] of Object.entries(MANTLE_TOKENS)) {
    try {
      const logs = await client.getLogs({
        address: token.address,
        event: ERC20_TRANSFER_EVENT,
        fromBlock,
        toBlock: latestBlock,
      });

      for (const log of logs) {
        const value = log.args.value ?? 0n;
        const humanValue = Number(value) / 10 ** token.decimals;

        // Simple USD estimation (rough — for hackathon purposes)
        const estimatedUsd = estimateUsd(name, humanValue);

        if (estimatedUsd >= WHALE_THRESHOLD_USD) {
          whaleTransfers.push({
            from: log.args.from ?? "0x0",
            to: log.args.to ?? "0x0",
            value: humanValue.toFixed(4),
            valueRaw: value,
            token: name,
            tokenAddress: token.address,
            txHash: log.transactionHash ?? "0x0",
            blockNumber: log.blockNumber ?? 0n,
            timestamp: Date.now(), // Approximate — could fetch block timestamp
          });
        }
      }
    } catch (err) {
      // Best-effort per token; don't let one failure stop all scanning
      console.warn(`[web3] Failed scanning ${name}:`, err);
    }
  }

  // Get block details for transaction count
  const block = await client.getBlock({ blockNumber: latestBlock });

  return {
    blockNumber: latestBlock,
    timestamp: Number(block.timestamp) * 1000,
    transactionCount: block.transactions.length,
    whaleTransfers,
    totalVolumeUsd: whaleTransfers.reduce(
      (sum, w) => sum + estimateUsd(w.token, Number(w.value)),
      0
    ),
  };
}

function estimateUsd(token: string, amount: number): number {
  // Rough price estimates — in production, read from DEX oracle
  const prices: Record<string, number> = {
    WETH: 3800, USDT: 1, USDC: 1, WMNT: 0.75, mETH: 3900,
  };
  return amount * (prices[token] ?? 0);
}
```

### 2.5 Package exports: `packages/web3/src/index.ts`

```typescript
export { getMantleClient, getExplorerUrl, mantleSepolia, mantleMainnet } from "./client.js";
export {
  logSignalOnChain,
  getSignalCount,
  getAlphaLoggerAddress,
  type LogSignalArgs,
  type LogSignalResult,
} from "./alpha-logger.js";
export {
  scanRecentBlocks,
  MANTLE_TOKENS,
  type WhaleTransfer,
  type OnChainActivity,
} from "./chain-reader.js";
```

---

## Workstream 3: Crypto Symbol Expansion (Day 2)

### 3.1 Extend `packages/shared/src/symbols.ts`

Add a **parallel** crypto symbol set. Do NOT remove the existing forex symbols — the forex engine stays intact.

```typescript
// Add below existing SYMBOLS definition:

export const CRYPTO_SYMBOLS = ['MNT', 'WETH', 'USDT', 'mETH'] as const;
export type CryptoSymbol = (typeof CRYPTO_SYMBOLS)[number];
export const CryptoSymbolSchema = z.enum(CRYPTO_SYMBOLS);
export function isCryptoSymbol(value: unknown): value is CryptoSymbol {
  return typeof value === 'string' && (CRYPTO_SYMBOLS as readonly string[]).includes(value);
}

// Combined type for the entire agent
export const ALL_SYMBOLS = [...SYMBOLS, ...CRYPTO_SYMBOLS] as const;
export type AnySymbol = Symbol | CryptoSymbol;
```

### 3.2 New schema: `packages/shared/src/schemas/onchain-signal.ts`

```typescript
import { z } from 'zod';

export const OnChainSignalSchema = z.object({
  id: z.string(),
  signalType: z.enum(['whale_alert', 'defi_anomaly', 'alpha_signal', 'macro_event']),
  asset: z.string(),
  direction: z.enum(['bullish', 'bearish', 'neutral']),
  confidence: z.number().int().min(1).max(10),
  committeeGrade: z.enum(['A', 'B', 'C', 'D', 'F']).nullable(),
  goNoGo: z.enum(['go', 'caution', 'no-go']).nullable(),
  summary: z.string(),
  fullAnalysis: z.string().nullable(), // Full AI analysis text
  // On-chain proof
  txHash: z.string().nullable(),
  onChainSignalId: z.number().nullable(),
  explorerUrl: z.string().nullable(),
  // Trigger data
  triggerData: z.record(z.unknown()).nullable(), // The raw whale/DEX data that triggered this
  // Meta
  createdAt: z.number().int(), // ms epoch
  source: z.string(), // "onchain-scanner" | "user-request" | "cron"
});
export type OnChainSignal = z.infer<typeof OnChainSignalSchema>;
```

### 3.3 New tool output schemas

**Create**: `packages/shared/src/schemas/tool-outputs/get-onchain-activity.ts`  
**Create**: `packages/shared/src/schemas/tool-outputs/get-whale-alerts.ts`  
**Create**: `packages/shared/src/schemas/tool-outputs/get-defi-pools.ts`  
**Create**: `packages/shared/src/schemas/tool-outputs/analyze-alpha-signal.ts`  
**Create**: `packages/shared/src/schemas/tool-outputs/log-signal-onchain.ts`  
**Create**: `packages/shared/src/schemas/tool-outputs/get-agent-performance.ts`

Each file defines `InputSchema`, `OutputSchema`, and `declare module` augmentation following the pattern of existing tool output files.

---

## Workstream 4: Database Migrations (Day 2)

### 4.1 New migration: `packages/db/drizzle/0009_mantle_alpha.sql`

```sql
-- On-chain alpha signals
CREATE TABLE IF NOT EXISTS onchain_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type TEXT NOT NULL,          -- whale_alert | defi_anomaly | alpha_signal | macro_event
  asset TEXT NOT NULL,                 -- MNT | WETH | USDT | mETH
  direction TEXT NOT NULL,             -- bullish | bearish | neutral
  confidence SMALLINT NOT NULL,        -- 1-10
  committee_grade TEXT,                -- A-F
  go_no_go TEXT,                       -- go | caution | no-go
  summary TEXT NOT NULL,
  full_analysis TEXT,
  trigger_data JSONB,
  -- On-chain proof
  tx_hash TEXT,
  onchain_signal_id INTEGER,
  explorer_url TEXT,
  -- Meta
  source TEXT NOT NULL DEFAULT 'onchain-scanner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_onchain_signals_created_at ON onchain_signals (created_at DESC);
CREATE INDEX idx_onchain_signals_asset ON onchain_signals (asset);
CREATE INDEX idx_onchain_signals_type ON onchain_signals (signal_type);

-- On-chain events (raw whale/DEX activity before analysis)
CREATE TABLE IF NOT EXISTS onchain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,            -- whale_transfer | dex_swap | liquidity_add | liquidity_remove
  token TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  value_human TEXT,
  value_usd NUMERIC,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_onchain_events_detected ON onchain_events (detected_at DESC);
CREATE INDEX idx_onchain_events_type ON onchain_events (event_type);
```

### 4.2 New Drizzle schema files

**Create**: `packages/db/src/schema/onchain-signals.ts` — Drizzle table definition matching the SQL above  
**Create**: `packages/db/src/schema/onchain-events.ts` — Drizzle table definition matching the SQL above  
**Modify**: `packages/db/src/schema/index.ts` — Add exports for both new tables

---

## Workstream 5: New AI Tools (Days 3-5)

### 5.1 Tool: `get_onchain_activity`

**Create**: `packages/ai/src/tools/get-onchain-activity.ts`

- **Input**: `{ blockRange?: number }` (default 200)
- **Logic**: Call `scanRecentBlocks()` from `@hamafx/web3`, return the structured activity data
- **Output**: `{ blockNumber, transactionCount, whaleTransfers[], totalVolumeUsd }`

### 5.2 Tool: `get_whale_alerts`

**Create**: `packages/ai/src/tools/get-whale-alerts.ts`

- **Input**: `{ token?: string, minUsd?: number, limit?: number }`
- **Logic**: Query `onchain_events` table (populated by the worker scanner), filtered by token and threshold
- **Output**: Array of whale transfers with from/to addresses, values, tx hashes, explorer links

### 5.3 Tool: `get_defi_pools`

**Create**: `packages/ai/src/tools/get-defi-pools.ts`

- **Input**: `{ protocol?: "merchant-moe" | "agni" }`
- **Logic**: Read top pool TVLs from Mantle DeFi protocols via their subgraph or REST APIs
- **Output**: Array of pool stats (pair, TVL, volume24h, APR)
- **Fallback**: If API unavailable, return cached/hardcoded top pools for demo

### 5.4 Tool: `analyze_alpha_signal`

**Create**: `packages/ai/src/tools/analyze-alpha-signal.ts`

- **Input**: `{ asset: string, context: string }` — the raw on-chain event plus any context
- **Logic**: 
  1. Gather data: call `get_onchain_activity`, `get_news` (filtered for crypto), existing `get_indicators` if price data available
  2. Run the **existing `convene_committee`** pattern (Economist + Technician + Risk Manager) but adapted for crypto
  3. Produce a graded signal with direction, confidence, committee verdict
- **Output**: Full `OnChainSignal` object (without on-chain proof — that comes from `log_signal_onchain`)

### 5.5 Tool: `log_signal_onchain`

**Create**: `packages/ai/src/tools/log-signal-onchain.ts`

- **Input**: `{ signalId: string }` — UUID from the `onchain_signals` table
- **Logic**:
  1. Read the signal from Postgres
  2. Call `logSignalOnChain()` from `@hamafx/web3`
  3. Update the Postgres row with `tx_hash`, `onchain_signal_id`, `explorer_url`
  4. Return the explorer URL and tx hash
- **Output**: `{ txHash, onChainSignalId, explorerUrl, success: true }`

### 5.6 Tool: `get_agent_performance`

**Create**: `packages/ai/src/tools/get-agent-performance.ts`

- **Input**: `{ days?: number }` (default 7)
- **Logic**: Query `onchain_signals` table, compute stats:
  - Total signals generated
  - Breakdown by type, direction, grade
  - On-chain logged count
  - Signal count on Mantle contract vs Postgres (consistency check)
- **Output**: Performance dashboard data

### 5.7 Register all new tools

**Modify**: `packages/ai/src/tools/index.ts`

Add imports and registrations for all 6 new tools, each wrapped in `withTelemetry()`:

```typescript
import { getOnchainActivityTool } from './get-onchain-activity';
import { getWhaleAlertsTool } from './get-whale-alerts';
import { getDefiPoolsTool } from './get-defi-pools';
import { analyzeAlphaSignalTool } from './analyze-alpha-signal';
import { logSignalOnchainTool } from './log-signal-onchain';
import { getAgentPerformanceTool } from './get-agent-performance';

// Inside the tools object:
get_onchain_activity: withTelemetry('get_onchain_activity', getOnchainActivityTool),
get_whale_alerts: withTelemetry('get_whale_alerts', getWhaleAlertsTool),
get_defi_pools: withTelemetry('get_defi_pools', getDefiPoolsTool),
analyze_alpha_signal: withTelemetry('analyze_alpha_signal', analyzeAlphaSignalTool),
log_signal_onchain: withTelemetry('log_signal_onchain', logSignalOnchainTool),
get_agent_performance: withTelemetry('get_agent_performance', getAgentPerformanceTool),
```

---

## Workstream 6: System Prompt & Routing Adaptation (Day 4)

### 6.1 Modify system prompt: `packages/ai/src/prompt/system.ts`

Add a new section to `BASE_PROMPT` (append, do not replace):

```
# Mantle On-Chain Alpha

You are also an on-chain alpha agent for the **Mantle Network** (Ethereum L2). You monitor whale movements, DeFi pool activity, and on-chain anomalies on Mantle, and generate verified alpha signals.

## Crypto capabilities

- Use \`get_onchain_activity\` to scan recent Mantle blocks for whale transfers and unusual activity.
- Use \`get_whale_alerts\` to query detected whale movements above threshold.
- Use \`get_defi_pools\` to check Merchant Moe and Agni Finance pool stats on Mantle.
- Use \`analyze_alpha_signal\` to run the multi-agent committee on any crypto/on-chain finding.
- Use \`log_signal_onchain\` to permanently record a signal on the Mantle blockchain for verifiable proof.
- Use \`get_agent_performance\` to show your signal track record.

## Crypto rules

1. When analyzing on-chain data, always cite the block number, tx hash, and explorer link.
2. You support Mantle ecosystem tokens: MNT, WETH, USDT, USDC, mETH.
3. Your traditional forex analysis (XAUUSD, EURUSD, GBPUSD) still works — use it for macro context when analyzing crypto.
4. Always offer to log high-confidence signals on-chain for permanent verification.
```

### 6.2 Extend `LiveSnapshot` interface

Add an optional `mantleBlock` field to `LiveSnapshot`:

```typescript
mantleBlock?: {
  number: number;
  timestamp: number;
  recentWhaleCount: number;
};
```

### 6.3 Modify `buildLiveSnapshot` in `packages/ai/src/context.ts`

Add a best-effort Mantle block fetch alongside existing price fetches:

```typescript
// Add to the Promise.all array:
(async () => {
  try {
    const { getMantleClient } = await import('@hamafx/web3');
    const client = getMantleClient();
    const block = await client.getBlock();
    // Store in snapshot
  } catch { /* Mantle offline — not critical */ }
})(),
```

### 6.4 Extend routing: `packages/ai/src/routing.ts`

Add new keyword patterns for crypto/on-chain domain that route to `fundamental` model (reuses the same model tier):

```typescript
// Add to FUNDAMENTAL_PATTERNS:
{ re: /\b(whale|whales|smart money|on-?chain|mantle|mnt|defi|dex|pool|liquidity|tvl)\b/, weight: 3 },
{ re: /\b(alpha|signal|anomaly|unusual|transfer|swap)\b/, weight: 2 },
```

---

## Workstream 7: Worker — On-Chain Scanner (Days 4-5)

### 7.1 New scanner module: `apps/worker/src/onchain-scanner.ts`

```typescript
import { scanRecentBlocks, type WhaleTransfer } from '@hamafx/web3';
import { getDb, schema } from '@hamafx/db';
import type { Logger } from './log.js';

export interface OnChainScannerOptions {
  log: Logger;
  intervalMs: number; // How often to scan (default 30_000 = 30s)
  blockRange: number; // How many blocks back to scan (default 50)
}

export interface OnChainScannerHandle {
  stop(): void;
}

export function startOnChainScanner(opts: OnChainScannerOptions): OnChainScannerHandle {
  const { log, intervalMs, blockRange } = opts;
  let lastScannedBlock = 0n;

  const timer = setInterval(async () => {
    try {
      const activity = await scanRecentBlocks(blockRange);

      // Skip if we've already scanned this block
      if (activity.blockNumber <= lastScannedBlock) return;
      lastScannedBlock = activity.blockNumber;

      if (activity.whaleTransfers.length > 0) {
        log.info('whale transfers detected', {
          count: activity.whaleTransfers.length,
          block: Number(activity.blockNumber),
        });

        // Persist to onchain_events table
        const db = getDb();
        for (const wt of activity.whaleTransfers) {
          await db.insert(schema.onchainEvents).values({
            eventType: 'whale_transfer',
            token: wt.token,
            fromAddress: wt.from,
            toAddress: wt.to,
            valueHuman: wt.value,
            valueUsd: String(estimateUsd(wt.token, Number(wt.value))),
            txHash: wt.txHash,
            blockNumber: Number(wt.blockNumber),
          }).onConflictDoNothing(); // idempotent
        }
      }
    } catch (err) {
      log.error('onchain scan failed', { err: String(err) });
    }
  }, intervalMs);

  return {
    stop() {
      clearInterval(timer);
      log.info('onchain scanner stopped');
    },
  };
}
```

### 7.2 Integrate scanner into worker: `apps/worker/src/index.ts`

**Modify** the `runWorker` function to start the on-chain scanner alongside the existing tick pipeline:

```typescript
import { startOnChainScanner } from './onchain-scanner.js';

// Inside runWorker(), after starting MT5 + SignalR:
const onchainScanner = startOnChainScanner({
  log: log.with({ module: 'onchain-scanner' }),
  intervalMs: env.ONCHAIN_SCAN_INTERVAL_MS ?? 30_000,
  blockRange: 50,
});

// Add to stop():
await onchainScanner.stop();
```

### 7.3 Add env vars to `apps/worker/src/env.ts`

```typescript
MANTLE_RPC_URL: z.string().url().optional().default('https://rpc.sepolia.mantle.xyz'),
MANTLE_ALPHA_LOGGER_ADDRESS: z.string().optional(),
MANTLE_AGENT_PRIVATE_KEY: z.string().optional(),
ONCHAIN_SCAN_INTERVAL_MS: z.number().int().optional().default(30_000),
```

---

## Workstream 8: Frontend — Signals Page & Dashboard (Days 5-7)

### 8.1 New page: `apps/web/src/app/(app)/signals/page.tsx`

A new `/signals` route that displays:

1. **Signal feed** — reverse-chronological list of all generated alpha signals
2. **Each signal card** shows:
   - Signal type badge (whale_alert, defi_anomaly, alpha_signal, macro_event)
   - Asset + direction with color coding
   - Confidence meter (1-10 progress bar)
   - Committee grade badge (A-F)
   - Go/No-Go badge
   - Summary text
   - **On-chain proof**: clickable link to Mantle explorer if `tx_hash` exists, or "Not yet logged" with a button to trigger logging
   - Timestamp
3. **Filter chips** — by type, asset, direction
4. **Stats header** — total signals, on-chain logged count, average confidence

**Design**: Follow existing premium-dark aesthetic. Use glass cards (`card-premium` class), champagne accent for high-confidence signals, existing `Segmented` component for filters.

### 8.2 New page: `apps/web/src/app/(app)/dashboard/page.tsx`

Agent performance dashboard:

1. **On-chain stats** — signals logged on Mantle, latest block, contract address with explorer link
2. **Performance breakdown** — pie chart of signal types, bar chart of grades over time
3. **Agent identity** — show ERC-8004 identity info (address, name, registration tx)
4. **Mantle network status** — current block, gas price, transaction count

### 8.3 New API routes

**Create**: `apps/web/src/app/api/signals/route.ts`
- `GET` — list signals from `onchain_signals` table, paginated
- `POST` — create a new signal (called by the AI agent or cron)

**Create**: `apps/web/src/app/api/signals/[id]/log/route.ts`
- `POST` — trigger on-chain logging for a specific signal

**Create**: `apps/web/src/app/api/cron/onchain-scan/route.ts`
- `POST` — alternative to worker-based scanning; can be called by systemd timer

### 8.4 New hook: `apps/web/src/hooks/use-signals.ts`

TanStack Query hook to fetch signals from `/api/signals`, with auto-refresh every 30s.

### 8.5 Add navigation entry

**Modify**: The nav drawer component to add "🔗 Signals" and "📊 Dashboard" links pointing to `/signals` and `/dashboard`.

---

## Workstream 9: Telegram Adaptation (Day 6)

### 9.1 Modify existing Telegram webhook

**Modify**: `packages/ai/src/telegram/webhook.ts`

Add command handlers for crypto-related queries:
- `/alpha` — Show latest alpha signals
- `/whale` — Show recent whale alerts
- `/status` — Show agent on-chain status (signal count, latest block)

### 9.2 New Telegram notification for high-confidence signals

**Create**: `packages/ai/src/push/signal-notify.ts`

When a signal with `confidence >= 7` or `committeeGrade in ['A', 'B']` is generated, auto-send a formatted Telegram message:

```
🐋 WHALE ALERT — MNT

$2.4M MNT transferred to Merchant Moe LP
Committee: A (Go) | Confidence: 9/10

📊 Economist: Bullish — aligned with MNT staking inflows
📈 Technician: Bullish — breakout above 4h resistance
⚠️ Risk Mgr: Caution — high exposure to single token

🔗 On-chain proof: mantlescan.xyz/tx/0x...
📱 View details: hama-fx-ai.app/signals/...
```

---

## Workstream 10: Environment Variables (Day 1-2)

### New variables to add to `.env.example` and `.env.local`:

```bash
# ── Mantle / Web3 ──
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
MANTLE_ALPHA_LOGGER_ADDRESS=0x...    # Deployed contract address
MANTLE_AGENT_PRIVATE_KEY=0x...       # Agent wallet private key (funded with testnet MNT)
MANTLE_CHAIN_ID=5003                  # 5003 = Sepolia, 5000 = Mainnet
ONCHAIN_SCAN_INTERVAL_MS=30000       # How often to scan for on-chain events
```

---

## Workstream 11: ERC-8004 Agent Identity (Day 2)

### 11.1 Register with Mantle's official ERC-8004 issuer

This is a manual/semi-manual process:
1. Go to the Mantle hackathon resources page
2. Find the ERC-8004 agent identity registration tool
3. Register your agent wallet address
4. Receive the identity NFT
5. Store the NFT token ID in env: `MANTLE_AGENT_IDENTITY_TOKEN_ID`

### 11.2 Display identity in the dashboard

Show the ERC-8004 identity NFT info on the `/dashboard` page — token ID, wallet address, registration tx.

---

## Workstream 12: Submission Materials (Days 8-9)

### 12.1 Update `README.md`

Add a new section at the top:

```markdown
## 🏆 Mantle Turing Test Hackathon 2026 — Track 2: AI Alpha & Data

HamaFX-Ai is an **AI-powered on-chain alpha signal engine** for the Mantle Network. It combines:
- 🤖 38 AI tools with multi-agent committee analysis
- 🐋 Real-time whale and DEX activity monitoring on Mantle
- 🔗 Verifiable on-chain signal logging via smart contract
- 📱 Telegram bot for instant alpha delivery
- 📊 Premium web dashboard with TradingView charts
- 🧠 Hybrid RAG with time-decayed memory for contextual analysis
```

### 12.2 Create demo video script

**Create**: `docs/hackathon/demo-script.md`

5-minute demo flow:
1. **Open Dashboard** → show agent identity, on-chain stats, Mantle connection
2. **Chat**: "What whale activity has happened on Mantle in the last hour?" → AI calls `get_whale_alerts`, shows formatted response with explorer links
3. **Chat**: "Analyze this whale movement and generate an alpha signal" → AI calls `analyze_alpha_signal`, runs multi-agent committee, produces graded signal
4. **Chat**: "Log this signal on-chain" → AI calls `log_signal_onchain`, shows tx hash and explorer link
5. **Show Telegram** → demonstrate the auto-notification for the signal
6. **Show Signals page** → filtered list of all signals with on-chain proof badges
7. **Show MantleScan** → verify the logged signal on the blockchain explorer

### 12.3 DoraHacks BUIDL submission

**Create**: `docs/hackathon/submission.md`

Prepare:
- Project name: "HamaFX Alpha Agent — AI-Powered On-Chain Alpha for Mantle"
- Track: AI Alpha & Data
- GitHub repo link
- Demo URL (Vercel deploy)
- Smart contract address on Mantle (testnet)
- 3-minute pitch video
- Team info

---

## Day-by-Day Sprint Schedule

| Day | Date | Focus | Deliverable |
|-----|------|-------|-------------|
| 1 | Jun 7 | Smart contract + web3 package scaffold | `MantleAlphaLogger.sol` deployed on Mantle Sepolia, `packages/web3` with client + bindings |
| 2 | Jun 8 | DB migration + symbol expansion + chain reader | New tables, crypto symbols, on-chain data reader working |
| 3 | Jun 9 | AI tools (1/2): `get_onchain_activity`, `get_whale_alerts`, `get_defi_pools` | 3 tools working in chat |
| 4 | Jun 10 | AI tools (2/2): `analyze_alpha_signal`, `log_signal_onchain`, `get_agent_performance` + system prompt | Full tool suite + adapted routing |
| 5 | Jun 11 | Worker on-chain scanner + Telegram alpha notifications | Auto-scanning + auto-notifying |
| 6 | Jun 12 | Frontend: `/signals` page + `/dashboard` page + API routes | Full UI working |
| 7 | Jun 13 | Polish: nav integration, signal cards, explorer links, error states | Cohesive UX |
| 8 | Jun 14 | Demo video + README + submission materials | All materials ready |
| 9 | Jun 15 | Submit on DoraHacks + final testing | **SUBMITTED** ✅ |

---

## Verification Plan

### Automated tests
- `pnpm turbo run test` — existing tests still pass
- `pnpm turbo run typecheck` — no type errors
- New tests in `packages/web3/test/` for contract bindings
- New tests in `packages/ai/test/` for new tools

### Manual verification
1. Chat: "Show me whale activity on Mantle" → `get_onchain_activity` returns data
2. Chat: "Generate an alpha signal for MNT" → `analyze_alpha_signal` runs committee
3. Chat: "Log this signal on-chain" → `log_signal_onchain` writes to Mantle, returns explorer URL
4. Visit explorer URL → signal data visible on MantleScan
5. Visit `/signals` page → signal appears with on-chain badge
6. Check Telegram → notification received
7. Visit `/dashboard` → stats accurate, contract address links work

### Hackathon checklist
- [ ] Smart contract deployed on Mantle (Sepolia or Mainnet)
- [ ] ERC-8004 identity NFT registered
- [ ] GitHub repo is public (or accessible to judges)
- [ ] Demo URL live on Vercel
- [ ] Demo video recorded
- [ ] DoraHacks BUIDL submitted before June 15 deadline

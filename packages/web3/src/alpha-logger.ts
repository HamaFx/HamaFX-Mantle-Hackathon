import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getMantleClient, mantleSepolia, getExplorerUrl } from "./client";

// Full compiled ABI from Hardhat
export const ALPHA_LOGGER_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "agent", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "AgentRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "signalType", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "asset", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "direction", "type": "string" },
      { "indexed": false, "internalType": "uint8", "name": "confidence", "type": "uint8" },
      { "indexed": false, "internalType": "string", "name": "committeeGrade", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "goNoGo", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "summary", "type": "string" }
    ],
    "name": "SignalLogged",
    "type": "event"
  },
  {
    "inputs": [
      {
        "components": [
          { "internalType": "string", "name": "signalType", "type": "string" },
          { "internalType": "string", "name": "asset", "type": "string" },
          { "internalType": "string", "name": "direction", "type": "string" },
          { "internalType": "uint8", "name": "confidence", "type": "uint8" },
          { "internalType": "string", "name": "committeeGrade", "type": "string" },
          { "internalType": "string", "name": "goNoGo", "type": "string" },
          { "internalType": "string", "name": "ipfsHash", "type": "string" },
          { "internalType": "string", "name": "summary", "type": "string" }
        ],
        "internalType": "struct MantleAlphaLogger.LogSignalParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "logSignal",
    "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [ { "internalType": "address", "name": "", "type": "address" } ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "signalCount",
    "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
    "stateMutability": "view",
    "type": "function"
  }
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
    chain: mantleSepolia,
    account: wallet.account!,
    abi: ALPHA_LOGGER_ABI,
    functionName: "logSignal",
    args: [{
      signalType: args.signalType,
      asset: args.asset,
      direction: args.direction,
      confidence: args.confidence,
      committeeGrade: args.committeeGrade,
      goNoGo: args.goNoGo,
      ipfsHash: args.ipfsHash,
      summary: args.summary.slice(0, 280),
    }],
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

export function getAgentWalletAddress(): `0x${string}` {
  try {
    const wallet = getWalletClient();
    return wallet.account!.address;
  } catch {
    return "0x0000000000000000000000000000000000000000";
  }
}

export async function getAgentBalance(): Promise<number> {
  try {
    const client = getMantleClient();
    const address = getAgentWalletAddress();
    if (address === "0x0000000000000000000000000000000000000000") return 0;
    const balance = await client.getBalance({ address });
    return Number(balance) / 1e18; // Convert Wei to MNT
  } catch {
    return 0;
  }
}


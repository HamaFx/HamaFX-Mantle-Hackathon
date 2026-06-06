import { formatEther, parseAbiItem, type Log } from "viem";
import { getMantleClient } from "./client";

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

// Well-known token addresses on Mantle Sepolia (update for mainnet if needed)
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

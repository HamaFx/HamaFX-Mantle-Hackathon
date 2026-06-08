import { createPublicClient, fallback, http, type PublicClient, type Chain } from "viem";

export const mantleSepolia: Chain = {
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.mantle.xyz", "https://rpc.ankr.com/mantle_sepolia"] },
  },
  blockExplorers: {
    default: { name: "Mantle Sepolia Explorer", url: "https://sepolia.mantlescan.xyz" },
  },
};

export const mantleMainnet: Chain = {
  id: 5000,
  name: "Mantle",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mantle.xyz", "https://mantle-rpc.publicnode.com", "https://rpc.ankr.com/mantle"] },
  },
  blockExplorers: {
    default: { name: "MantleScan", url: "https://mantlescan.xyz" },
  },
};

let client: PublicClient | null = null;

const RPC_FALLBACKS: Record<'sepolia' | 'mainnet', string[]> = {
  sepolia: [
    "https://rpc.sepolia.mantle.xyz",
    "https://rpc.ankr.com/mantle_sepolia",
  ],
  mainnet: [
    "https://rpc.mantle.xyz",
    "https://mantle-rpc.publicnode.com",
    "https://rpc.ankr.com/mantle",
  ],
};

export function getMantleClient(): PublicClient {
  if (!client) {
    const rpcUrl = process.env.MANTLE_RPC_URL || "";
    const isSepolia = rpcUrl.includes("sepolia") || !rpcUrl;
    const mode: 'sepolia' | 'mainnet' = isSepolia ? 'sepolia' : 'mainnet';
    const chain = mode === 'sepolia' ? mantleSepolia : mantleMainnet;
    const urls = rpcUrl ? [rpcUrl, ...RPC_FALLBACKS[mode].filter(u => u !== rpcUrl)] : RPC_FALLBACKS[mode];
    const transports = urls.map((u) => http(u, { retryCount: 1 }));
    client = createPublicClient({ chain, transport: fallback(transports) });
  }
  return client;
}

export function getExplorerUrl(type: "tx" | "address", hash: string): string {
  const baseUrl = (process.env.MANTLE_RPC_URL || "").includes("sepolia")
    ? "https://sepolia.mantlescan.xyz"
    : "https://mantlescan.xyz";
  return `${baseUrl}/${type}/${hash}`;
}

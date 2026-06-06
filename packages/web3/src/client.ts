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

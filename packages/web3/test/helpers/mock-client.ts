/**
 * Test helpers for @hamafx/web3.
 *
 * Provides mock viem clients and stubbed chain data so tests don't
 * require a live Mantle RPC endpoint.
 */
import { vi } from 'vitest';
import type { PublicClient, WalletClient, TransactionReceipt, Log, Block } from 'viem';

// ---- mock chain data factories --------------------------------------

export function createMockBlock(overrides: Partial<Block> = {}): Block {
  return {
    hash: '0xabc123',
    parentHash: '0xdef456',
    number: 12345678n,
    timestamp: 1700000000n,
    transactions: ['0xtx1', '0xtx2'],
    nonce: '0x1',
    difficulty: 0n,
    gasLimit: 30000000n,
    gasUsed: 15000000n,
    miner: '0xminer',
    extraData: '0x',
    baseFeePerGas: 1000000000n,
    logsBloom: '0x',
    stateRoot: '0x',
    receiptsRoot: '0x',
    transactionsRoot: '0x',
    mixHash: '0x',
    sha3Uncles: '0x',
    size: 1000n,
    totalDifficulty: 0n,
    uncles: [],
    ...overrides,
  } as Block;
}

export function createMockTransactionReceipt(
  overrides: Partial<TransactionReceipt> = {},
): TransactionReceipt {
  return {
    transactionHash: '0xtxhash123',
    transactionIndex: 0,
    blockHash: '0xblockhash',
    blockNumber: 12345678n,
    from: '0xfrom',
    to: '0xto',
    cumulativeGasUsed: 21000n,
    gasUsed: 21000n,
    contractAddress: null,
    logs: [],
    logsBloom: '0x',
    status: 'success',
    effectiveGasPrice: 1000000000n,
    type: 'eip1559',
    ...overrides,
  } as TransactionReceipt;
}

export function createMockLog(overrides: Partial<Log> = {}): Log {
  return {
    address: '0xtoken',
    blockHash: '0xblockhash',
    blockNumber: 12345678n,
    data: '0xdata',
    logIndex: 0,
    removed: false,
    topics: [
      '0xtransfer',
      '0x000000000000000000000000sender',
      '0x000000000000000000000000receiver',
    ],
    transactionHash: '0xtxhash',
    transactionIndex: 0,
    args: {
      from: '0xfrom',
      to: '0xto',
      value: 1000000000000000000n,
    },
    ...overrides,
  } as unknown as Log;
}

// ---- mock client factories ------------------------------------------

export interface MockPublicClientOptions {
  blockNumber?: bigint;
  block?: Block;
  logs?: Log[];
  balance?: bigint;
  txReceipt?: TransactionReceipt;
  contractResult?: unknown;
  shouldThrow?: boolean;
}

export function createMockPublicClient(opts: MockPublicClientOptions = {}): PublicClient {
  if (opts.shouldThrow) {
    return {
      getBlockNumber: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
      getBlock: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
      getLogs: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
      getBalance: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
      readContract: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
      waitForTransactionReceipt: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
    } as unknown as PublicClient;
  }

  return {
    getBlockNumber: vi.fn().mockResolvedValue(opts.blockNumber ?? 12345678n),
    getBlock: vi.fn().mockResolvedValue(opts.block ?? createMockBlock()),
    getLogs: vi.fn().mockResolvedValue(opts.logs ?? []),
    getBalance: vi.fn().mockResolvedValue(opts.balance ?? 0n),
    readContract: vi.fn().mockResolvedValue(opts.contractResult ?? 0),
    waitForTransactionReceipt: vi
      .fn()
      .mockResolvedValue(opts.txReceipt ?? createMockTransactionReceipt()),
  } as unknown as PublicClient;
}

export interface MockWalletClientOptions {
  txHash?: `0x${string}`;
  shouldThrow?: boolean;
}

export function createMockWalletClient(opts: MockWalletClientOptions = {}): WalletClient {
  if (opts.shouldThrow) {
    return {
      account: { address: '0xdeadbeef' },
      writeContract: vi.fn().mockRejectedValue(new Error('Transaction failed')),
    } as unknown as WalletClient;
  }

  return {
    account: { address: '0xF73BA9f4Fc94F4B648B10FBBc6dE9a708519D3D0' },
    writeContract: vi
      .fn()
      .mockResolvedValue(opts.txHash ?? '0xabcdef1234567890abcdef1234567890abcdef12'),
  } as unknown as WalletClient;
}

/** Call in afterEach to clean up vi mocks. */
export function cleanupWeb3Mocks(): void {
  vi.clearAllMocks();
}
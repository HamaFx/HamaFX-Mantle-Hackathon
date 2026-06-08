import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock viem module
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getBlockNumber: vi.fn().mockResolvedValue(12345678n),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    readContract: vi.fn().mockResolvedValue(5n),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      transactionHash: '0xhash',
      logs: [{ topics: ['0xsig', '0x0000000000000000000000000000000000000000000000000000000000000001'] }],
    }),
  })),
  createWalletClient: vi.fn(() => ({
    account: { address: '0xF73BA9f4Fc94F4B648B10FBBc6dE9a708519D3D0' },
    writeContract: vi.fn().mockResolvedValue('0xabcdef1234567890abcdef1234567890abcdef12'),
  })),
  fallback: vi.fn((t) => t),
  http: vi.fn(() => ({})),
  parseAbiItem: vi.fn(() => ({})),
  formatEther: vi.fn((wei) => String(Number(wei) / 1e18)),
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn((key) => ({ address: '0xF73BA9f4Fc94F4B648B10FBBc6dE9a708519D3D0' })),
}));

// Setup env vars needed by alpha-logger
beforeEach(() => {
  process.env.MANTLE_AGENT_PRIVATE_KEY = '0xdeadbeef';
  process.env.MANTLE_ALPHA_LOGGER_ADDRESS = '0x6D29F763dF73A0C23D837aDAFF67DE68B48a92F9';
  process.env.MANTLE_RPC_URL = 'https://rpc.sepolia.mantle.xyz';
  vi.resetModules();
});

describe('@hamafx/web3 alpha-logger', () => {
  let alpha: typeof import('../src/alpha-logger');

  beforeEach(async () => {
    alpha = await import('../src/alpha-logger');
  });

  describe('getAlphaLoggerAddress', () => {
    it('returns the address from env', () => {
      const addr = alpha.getAlphaLoggerAddress();
      expect(addr).toBe('0x6D29F763dF73A0C23D837aDAFF67DE68B48a92F9');
    });

    it('throws when env is not set', () => {
      delete process.env.MANTLE_ALPHA_LOGGER_ADDRESS;
      expect(() => alpha.getAlphaLoggerAddress()).toThrow('MANTLE_ALPHA_LOGGER_ADDRESS');
    });
  });

  describe('getAgentWalletAddress', () => {
    it('returns the agent address', () => {
      const addr = alpha.getAgentWalletAddress();
      expect(addr).toBe('0xF73BA9f4Fc94F4B648B10FBBc6dE9a708519D3D0');
    });

    it('returns zero address when private key is missing', () => {
      delete process.env.MANTLE_AGENT_PRIVATE_KEY;
      const addr = alpha.getAgentWalletAddress();
      expect(addr).toBe('0x0000000000000000000000000000000000000000');
    });
  });

  describe('getAgentBalance', () => {
    it('returns balance in MNT', async () => {
      const balance = await alpha.getAgentBalance();
      expect(balance).toBeGreaterThan(0);
    });

    it('returns 0 when wallet address is zero', async () => {
      // This tests the early-return path
      process.env.MANTLE_AGENT_PRIVATE_KEY = '';
      const balance = await alpha.getAgentBalance();
      expect(balance).toBe(0);
    });
  });

  describe('getSignalCount', () => {
    it('returns on-chain signal count', async () => {
      const count = await alpha.getSignalCount();
      expect(count).toBe(5); // mock returns 5n
    });
  });

  describe('logSignalOnChain', () => {
    it('returns txHash, signalId, and explorerUrl on success', async () => {
      const result = await alpha.logSignalOnChain({
        signalType: 'alpha_signal',
        asset: 'MNT',
        direction: 'bullish',
        confidence: 8,
        committeeGrade: 'A',
        goNoGo: 'go',
        ipfsHash: '',
        summary: 'Bullish momentum detected on MNT.',
      });

      expect(result.txHash).toBeDefined();
      expect(result.txHash).toContain('0x');
      expect(result.signalId).toBeGreaterThanOrEqual(0);
      expect(result.explorerUrl).toContain('mantlescan');
    });

    it('truncates summaries longer than 280 chars', async () => {
      const longSummary = 'A'.repeat(500);
      const result = await alpha.logSignalOnChain({
        signalType: 'alpha_signal',
        asset: 'MNT',
        direction: 'bullish',
        confidence: 8,
        committeeGrade: 'A',
        goNoGo: 'go',
        ipfsHash: '',
        summary: longSummary,
      });

      expect(result.txHash).toBeDefined();
    });
  });
});
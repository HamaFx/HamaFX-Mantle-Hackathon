import { describe, it, expect } from 'vitest';
import { mantleSepolia, mantleMainnet, getExplorerUrl } from '../src/client';
import { MANTLE_TOKENS_SEPOLIA, getTokens } from '../src/chain-reader';

describe('@hamafx/web3 config', () => {
  describe('mantleSepolia chain', () => {
    it('chain ID is 5003', () => expect(mantleSepolia.id).toBe(5003));
    it('MNT has 18 decimals', () => expect(mantleSepolia.nativeCurrency.decimals).toBe(18));
    it('has RPC URLs', () => expect(mantleSepolia.rpcUrls.default.http.length).toBeGreaterThan(0));
    it('has MantleScan explorer', () => {
      expect(mantleSepolia.blockExplorers?.default.url).toContain('mantlescan');
    });
  });

  describe('mantleMainnet chain', () => {
    it('chain ID is 5000', () => expect(mantleMainnet.id).toBe(5000));
    it('MNT symbol', () => expect(mantleMainnet.nativeCurrency.symbol).toBe('MNT'));
  });

  describe('getExplorerUrl', () => {
    it('generates tx explorer URL', () => {
      const url = getExplorerUrl('tx', '0xabc');
      expect(url).toContain('0xabc');
      expect(url).toContain('/tx/');
    });
    it('generates address explorer URL', () => {
      const url = getExplorerUrl('address', '0xdef');
      expect(url).toContain('/address/');
    });
  });

  describe('token registry', () => {
    it('WETH on sepolia has 18 decimals', () => {
      expect(MANTLE_TOKENS_SEPOLIA.WETH.decimals).toBe(18);
    });
    it('USDT on sepolia has 6 decimals', () => {
      expect(MANTLE_TOKENS_SEPOLIA.USDT.decimals).toBe(6);
    });
    it('WMNT and mETH exist', () => {
      expect(MANTLE_TOKENS_SEPOLIA.WMNT).toBeDefined();
      expect(MANTLE_TOKENS_SEPOLIA.mETH).toBeDefined();
    });
    it('getTokens returns WETH', () => {
      expect(getTokens().WETH).toBeDefined();
    });
  });
});
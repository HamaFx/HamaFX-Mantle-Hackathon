import { describe, it, expect } from 'vitest';
import {
  HamaFxError,
  DatabaseError,
  DatabaseConnectionError,
  BlockchainError,
  RpcUnavailableError,
  TransactionFailedError,
  DataProviderError,
  ProviderHttpError,
  AIProviderError,
  AIBudgetExceededError,
  ValidationError,
  ConfigError,
  isHamaFxError,
  toHamaFxError,
} from '../src/errors/index';

describe('HamaFxError hierarchy', () => {
  it('HamaFxError is an Error instance', () => {
    const err = new HamaFxError('test', 'TEST', true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HamaFxError);
  });

  it('stores code and recoverable flag', () => {
    const err = new HamaFxError('msg', 'E001', false);
    expect(err.code).toBe('E001');
    expect(err.recoverable).toBe(false);
    expect(err.message).toBe('msg');
  });

  it('DatabaseError defaults to recoverable', () => {
    const err = new DatabaseError('pool exhausted');
    expect(err.recoverable).toBe(true);
    expect(err.code).toBe('DB_ERROR');
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err).toBeInstanceOf(HamaFxError);
  });

  it('DatabaseConnectionError is non-recoverable by default', () => {
    const err = new DatabaseConnectionError();
    expect(err.code).toBe('DB_CONNECTION_FAILED');
  });

  it('BlockchainError preserves provider info', () => {
    const err = new DataProviderError('bad', 'PROV_ERR', true, 'finnhub');
    expect(err.provider).toBe('finnhub');
    expect(err).toBeInstanceOf(DataProviderError);
    expect(err).toBeInstanceOf(HamaFxError);
  });

  it('ProviderHttpError includes status code', () => {
    const err = new ProviderHttpError('biquote', 503);
    expect(err.message).toContain('503');
    expect(err.message).toContain('biquote');
  });

  it('AIBudgetExceededError formats spent/max', () => {
    const err = new AIBudgetExceededError(4.75, 5);
    expect(err.message).toContain('$4.7500');
    expect(err.message).toContain('$5');
    expect(err.recoverable).toBe(false);
  });

  it('ValidationError stores issues', () => {
    const err = new ValidationError('bad input', ['field x missing', 'field y too long']);
    expect(err.issues).toEqual(['field x missing', 'field y too long']);
  });

  it('ConfigError is terminal', () => {
    const err = new ConfigError('missing env var');
    expect(err.recoverable).toBe(false);
    expect(err.code).toBe('CONFIG_ERROR');
  });

  it('TransactionFailedError stores txHash', () => {
    const err = new TransactionFailedError('reverted', '0xabc');
    expect(err.txHash).toBe('0xabc');
    expect(err.recoverable).toBe(false);
  });
});

describe('isHamaFxError', () => {
  it('returns true for HamaFxError instances', () => {
    expect(isHamaFxError(new HamaFxError('x', 'X', true))).toBe(true);
    expect(isHamaFxError(new DatabaseError('x'))).toBe(true);
    expect(isHamaFxError(new BlockchainError('x'))).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isHamaFxError(new Error('plain'))).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isHamaFxError('a string')).toBe(false);
  });
});

describe('toHamaFxError', () => {
  it('returns HamaFxError instances as-is', () => {
    const original = new DatabaseError('db down');
    const result = toHamaFxError(original);
    expect(result).toBe(original);
  });

  it('wraps plain Error with code UNKNOWN', () => {
    const result = toHamaFxError(new Error('something broke'));
    expect(result).toBeInstanceOf(HamaFxError);
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('something broke');
  });

  it('wraps string throws', () => {
    const result = toHamaFxError('raw string');
    expect(result).toBeInstanceOf(HamaFxError);
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('raw string');
  });
});
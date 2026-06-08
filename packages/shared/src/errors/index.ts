/**
 * Structured error hierarchy for HamaFX-Ai.
 *
 * Every error that crosses a package boundary should extend HamaFxError
 * so callers can discriminate between recoverable/terminal failures and
 * never catch-swallow an unexpected error thinking it was an expected one.
 *
 * Usage:
 *   throw new DatabaseError('Connection pool exhausted', 'DB_POOL_EXHAUSTED', false);
 *
 * Each error carries:
 *   - `code`   — machine-readable string for metrics/alerts (e.g., 'RPC_UNAVAILABLE')
 *   - `recoverable` — true = caller can retry; false = terminal (config bug, schema mismatch)
 *   - `name`   — set automatically by JS to the class name (e.g., 'DatabaseError')
 */

/** Base error with a machine-readable code and recoverability flag. */
export class HamaFxError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    /** true = caller can retry; false = terminal (config bug, schema mismatch) */
    public readonly recoverable: boolean,
  ) {
    super(message);
  }
}

// ---- Database errors --------------------------------------------------

export class DatabaseError extends HamaFxError {
  constructor(message: string, code = 'DB_ERROR', recoverable = true) {
    super(message, code, recoverable);
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(message = 'Database connection failed') {
    super(message, 'DB_CONNECTION_FAILED', true);
  }
}

export class DatabaseMigrationError extends DatabaseError {
  constructor(message: string) {
    super(message, 'DB_MIGRATION_FAILED', false);
  }
}

// ---- Blockchain errors ------------------------------------------------

export class BlockchainError extends HamaFxError {
  constructor(message: string, code = 'BLOCKCHAIN_ERROR', recoverable = true) {
    super(message, code, recoverable);
  }
}

export class RpcUnavailableError extends BlockchainError {
  constructor(message = 'Mantle RPC endpoint unavailable') {
    super(message, 'RPC_UNAVAILABLE', true);
  }
}

export class TransactionFailedError extends BlockchainError {
  constructor(
    message: string,
    public readonly txHash?: string,
  ) {
    super(message, 'TX_FAILED', false);
  }
}

export class ContractCallError extends BlockchainError {
  constructor(message: string) {
    super(message, 'CONTRACT_CALL_FAILED', true);
  }
}

// ---- Data provider errors ---------------------------------------------

export class DataProviderError extends HamaFxError {
  constructor(
    message: string,
    code = 'PROVIDER_ERROR',
    recoverable = true,
    public readonly provider?: string,
  ) {
    super(message, code, recoverable);
  }
}

export class ProviderHttpError extends DataProviderError {
  constructor(provider: string, status: number) {
    super(`HTTP ${status} from ${provider}`, 'PROVIDER_HTTP_ERROR', true, provider);
  }
}

export class ProviderTimeoutError extends DataProviderError {
  constructor(provider: string) {
    super(`${provider} request timed out`, 'PROVIDER_TIMEOUT', true, provider);
  }
}

export class ProviderEmptyError extends DataProviderError {
  constructor(provider: string, reason = 'no data available') {
    super(`${provider}: ${reason}`, 'PROVIDER_EMPTY', true, provider);
  }
}

// ---- AI provider errors -----------------------------------------------

export class AIProviderError extends HamaFxError {
  constructor(message: string, code = 'AI_PROVIDER_ERROR', recoverable = true) {
    super(message, code, recoverable);
  }
}

export class AIQuotaExceededError extends AIProviderError {
  constructor(model: string) {
    super(`Quota exceeded for model ${model}`, 'AI_QUOTA_EXCEEDED', false);
  }
}

export class AIBudgetExceededError extends AIProviderError {
  constructor(spent: number, max: number) {
    super(`Daily AI spend cap reached: $${spent.toFixed(4)} / $${max}`, 'AI_BUDGET_EXCEEDED', false);
  }
}

// ---- Validation errors ------------------------------------------------

export class ValidationError extends HamaFxError {
  constructor(message: string, public readonly issues?: string[]) {
    super(message, 'VALIDATION_ERROR', false);
  }
}

export class ConfigError extends HamaFxError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', false);
  }
}

// ---- Type guard helpers -----------------------------------------------

/** Returns true when `err` is a known HamaFxError. */
export function isHamaFxError(err: unknown): err is HamaFxError {
  return err instanceof HamaFxError;
}

/** Coerce any thrown value to a HamaFxError for predictable catch blocks. */
export function toHamaFxError(err: unknown): HamaFxError {
  if (err instanceof HamaFxError) return err;
  if (err instanceof Error) {
    return new HamaFxError(err.message, 'UNKNOWN', false);
  }
  return new HamaFxError(String(err), 'UNKNOWN', false);
}
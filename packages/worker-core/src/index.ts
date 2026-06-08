export { runDaemon } from './runner.js';
export type { RunDaemonArgs, RunningDaemon } from './runner.js';

export { createLogger } from './logger.js';
export type { Logger, LoggerOptions } from './logger.js';

export { SignalRConsumer, createDefaultBuildConnection } from './signalr/consumer.js';
export type { NormalizedTick, MinimalHubConnection, BuildConnection, ConsumerOptions } from './signalr/consumer.js';

export { TickBuffer } from './signalr/tick-buffer.js';

export { Candle1mAggregator } from './aggregator/candle-1m.js';
export type { ClosedCandle } from './aggregator/candle-1m.js';

export { FinnhubTickSource } from './sources/finnhub.js';

export { OnChainScanner } from './onchain-scanner.js';

export { flushLiveTicks } from './persistence/live-ticks.js';
export { flushClosedCandle } from './persistence/candles-1m.js';

export { ping, withHeartbeat } from './healthchecks.js';

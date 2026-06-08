import * as net from 'net';
import { isSymbol, type Symbol } from '@hamafx/shared';
import type { Logger } from './log.js';
import type { NormalizedTick } from './signalr/consumer.js';

const MAX_BUFFER_BYTES = 65_536;

export interface MT5ServerOptions {
  port: number;
  log: Logger;
  onTick: (tick: NormalizedTick) => void;
}

export interface MT5ServerHandle {
  stop(): Promise<void>;
}

export function startMT5Server(opts: MT5ServerOptions): MT5ServerHandle {
  const { port, log, onTick } = opts;

  const sockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    log.info('MT5 Terminal connected to Linux bridge');
    sockets.add(socket);
    let buffer = '';

    const cleanup = () => {
      sockets.delete(socket);
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      // Cap buffer to prevent OOM from a malfunctioning client
      if (buffer.length > MAX_BUFFER_BYTES) {
        log.error('MT5 Bridge buffer overflow — disconnecting client');
        socket.destroy(new Error('buffer overflow'));
        return;
      }

      // Handle newline-delimited JSON frames
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const frame = buffer.substring(0, boundary).trim();
        buffer = buffer.substring(boundary + 1);

        if (frame) {
          try {
            const raw = JSON.parse(frame);
            const symbol = String(raw.symbol).toUpperCase();

            if (!isSymbol(symbol)) {
              log.warn('MT5 Bridge received unsupported symbol', { symbol });
              boundary = buffer.indexOf('\n');
              continue;
            }

            const bid = Number(raw.bid);
            const ask = Number(raw.ask);
            if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
              log.warn('MT5 Bridge received invalid bid/ask', { bid, ask, symbol });
              boundary = buffer.indexOf('\n');
              continue;
            }

            const mid = (bid + ask) / 2;
            const ts = Number.isFinite(Number(raw.ts)) ? Number(raw.ts) : Date.now();

            const tick: NormalizedTick = {
              symbol: symbol as Symbol,
              bid,
              ask,
              mid,
              ts,
              source: 'mt5-local',
            };

            onTick(tick);
          } catch (e) {
            log.error('Failed to parse frame from MT5', { error: String(e), frame });
          }
        }
        boundary = buffer.indexOf('\n');
      }
    });

    socket.on('close', () => {
      log.warn('MT5 Bridge client disconnected');
      cleanup();
    });

    socket.on('error', (err) => {
      log.error('MT5 Bridge socket error', { error: String(err) });
      cleanup();
    });
  });

  server.listen(port, '127.0.0.1', () => {
    log.info('Headless MT5 Bridge Server active', { address: '127.0.0.1', port });
  });

  return {
    async stop(): Promise<void> {
      // Destroy all connected sockets first
      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();

      return new Promise<void>((resolve) => {
        server.close(() => {
          log.info('Headless MT5 Bridge Server closed');
          resolve();
        });
      });
    },
  };
}

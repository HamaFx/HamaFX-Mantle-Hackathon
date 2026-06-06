import { ServerEnv } from '@hamafx/shared';

export interface SignalNotifyArgs {
  asset: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  committeeGrade: string;
  goNoGo: string;
  summary: string;
  explorerUrl?: string;
  signalType: string;
}

export async function sendSignalPushNotification(signal: SignalNotifyArgs, env: ServerEnv) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }

  const { asset, direction, confidence, committeeGrade, summary, explorerUrl, signalType } = signal;

  const emoji = 
    signalType === 'whale_alert' ? '🐋' : 
    signalType === 'defi_anomaly' ? '🏦' :
    signalType === 'macro_event' ? '📰' : '🔮';

  const typeName = signalType.replace('_', ' ').toUpperCase();
  const dirEmoji = direction === 'bullish' ? '📈' : direction === 'bearish' ? '📉' : '➖';

  const text = `${emoji} ${typeName} — ${asset}

${summary}

${dirEmoji} Committee: ${committeeGrade} | Confidence: ${confidence}/10
${explorerUrl ? `\n🔗 On-chain proof: ${explorerUrl}` : ''}
📱 View details: https://hama-fx-ai.app/signals`;

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('Failed to send signal notification:', err);
  }
}

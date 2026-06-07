// Tool registry. Adding a new tool: implement it in a sibling file then
// export it from here. Keep names in sync with `@hamafx/shared` TOOL_NAMES.
//
// Phase 3 hardening §2 — every tool flows through `withTelemetry()` so
// each invocation produces exactly one `chat_tool_telemetry` row and
// the per-turn AbortSignal is piped through to the tool's `execute`.
// The agent's pre-fix `onStepFinish` parts-walker is now redundant and
// the `errorCode` column is populated uniformly on failures.

import { analyzeChartImageTool } from './analyze-chart-image';
import { analyzeFundamentalTool } from './analyze-fundamental';
import { analyzeTechnicalTool } from './analyze-technical';
import { annotateChartTool } from './annotate-chart';
import { computePositionHealthTool } from './compute-position-health';
import { computeRiskTool } from './compute-risk';
import { forecastVolatilityTool } from './forecast-volatility';
import { getCalendarTool } from './get-calendar';
import { getCandlesTool } from './get-candles';
import { getCorrelationTool } from './get-correlation';
import { getIndicatorsTool } from './get-indicators';
import { getIntermarketTool } from './get-intermarket';
import { getMarketStructureTool } from './get-market-structure';
import { getNewsTool } from './get-news';
import { getPriceTool } from './get-price';
import { getSeasonalityTool } from './get-seasonality';
import { searchKnowledgeTool } from './search-knowledge';
import { setAlertTool } from './set-alert';
import { shareSnapshotTool } from './share-snapshot';
import { summarizeThreadTool } from './summarize-thread';
import { verifyCallTool } from './verify-call';
import type { Tool } from 'ai';
import { withTelemetry } from './with-telemetry';
import { conveneCommitteeTool } from './convene-committee';
import { getIntermarketResonanceTool } from './get-intermarket-resonance';
import { getSystemDiagnosticsTool } from './get-system-diagnostics';
import { runSystemActionTool } from './run-system-action';

// Hackathon: Mantle AI
import { getOnchainActivityTool } from './get-onchain-activity';
import { getWhaleAlertsTool } from './get-whale-alerts';
import { getDefiPoolsTool } from './get-defi-pools';
import { analyzeAlphaSignalTool } from './analyze-alpha-signal';
import { logSignalOnchainTool } from './log-signal-onchain';
import { getAgentPerformanceTool } from './get-agent-performance';

export const tools = {
  get_price: withTelemetry('get_price', getPriceTool),
  get_candles: withTelemetry('get_candles', getCandlesTool),
  get_indicators: withTelemetry('get_indicators', getIndicatorsTool),
  get_market_structure: withTelemetry('get_market_structure', getMarketStructureTool),
  get_news: withTelemetry('get_news', getNewsTool),
  get_calendar: withTelemetry('get_calendar', getCalendarTool),
  set_alert: withTelemetry('set_alert', setAlertTool),
  // Phase 2 tools
  search_knowledge: withTelemetry('search_knowledge', searchKnowledgeTool),
  analyze_technical: withTelemetry('analyze_technical', analyzeTechnicalTool),
  analyze_fundamental: withTelemetry('analyze_fundamental', analyzeFundamentalTool),
  annotate_chart: withTelemetry('annotate_chart', annotateChartTool),
  // Phase 3 tools
  analyze_chart_image: withTelemetry('analyze_chart_image', analyzeChartImageTool as unknown as Tool<string, unknown>),
  get_correlation: withTelemetry('get_correlation', getCorrelationTool),
  share_snapshot: withTelemetry('share_snapshot', shareSnapshotTool),
  // Phase 7b tools
  compute_risk: withTelemetry('compute_risk', computeRiskTool),
  get_intermarket: withTelemetry('get_intermarket', getIntermarketTool),
  forecast_volatility: withTelemetry('forecast_volatility', forecastVolatilityTool),
  get_seasonality: withTelemetry('get_seasonality', getSeasonalityTool),
  compute_position_health: withTelemetry('compute_position_health', computePositionHealthTool),
  summarize_thread: withTelemetry('summarize_thread', summarizeThreadTool as unknown as Tool<string, unknown>),
  // Phase 7c tools
  verify_call: withTelemetry('verify_call', verifyCallTool),
  convene_committee: withTelemetry('convene_committee', conveneCommitteeTool),
  get_intermarket_resonance: withTelemetry('get_intermarket_resonance', getIntermarketResonanceTool),
  get_system_diagnostics: withTelemetry('get_system_diagnostics', getSystemDiagnosticsTool),
  run_system_action: withTelemetry('run_system_action', runSystemActionTool),

  // Hackathon: Mantle AI
  get_onchain_activity: withTelemetry('get_onchain_activity', getOnchainActivityTool),
  get_whale_alerts: withTelemetry('get_whale_alerts', getWhaleAlertsTool),
  get_defi_pools: withTelemetry('get_defi_pools', getDefiPoolsTool),
  analyze_alpha_signal: withTelemetry('analyze_alpha_signal', analyzeAlphaSignalTool),
  log_signal_onchain: withTelemetry('log_signal_onchain', logSignalOnchainTool),
  get_agent_performance: withTelemetry('get_agent_performance', getAgentPerformanceTool),
};

export type ToolRegistry = typeof tools;

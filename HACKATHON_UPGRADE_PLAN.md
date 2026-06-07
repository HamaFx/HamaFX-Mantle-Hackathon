# HamaFX-Ai — Mantle Turing Test Hackathon Upgrade Plan

**Version:** 1.0  
**Date:** 2026-06-07  
**Goal:** Polish, upgrade, and adapt all UI surfaces for the Mantle DeFAI Hackathon (Track 2: AI Alpha & Data)

---

## Executive Summary

The app currently has a hybrid identity — half FX trading copilot (gold/EUR/GBP focus), half Mantle DeFAI agent. The Mantle hackathon submission needs a **unified, crypto-native identity** throughout. Every surface should communicate: *"This is an autonomous on-chain alpha agent running on Mantle."*

The 6 upgrade areas are sequenced below by dependency order and hackathon impact.

---

## 1. Quick Prompts (Chat Empty State)

**File:** `apps/web/src/components/chat/quick-prompts.tsx`

### Current State
5 hardcoded FX prompts referencing gold, EUR/GBP, and generic trading terms. No crypto identity.

### Problems
- `"What's the bias on Mantle?"` — Mantle is crypto; the question format is still FX-adjacent
- `"Top-down MNTUSDT 4H→15M"` — Technical, good, but isolated from alpha narrative
- `"Show me the structure"` — Too generic
- `"Today's calendar"` — Calendar feature exists but the page may be deleted or heavily modified
- `"Alert MNTUSDT above 2.4"` — Useful but lacks DeFAI narrative

### Recommended New Prompts

| # | Label | Prompt | Rationale |
|---|-------|--------|------------|
| 1 | 🐋 Whale Signal | "Scan Mantle for whale activity and generate an alpha signal" | Activates the full `analyze_alpha_signal` → `log_signal_onchain` pipeline — the core hackathon demo |
| 2 | 📊 MNT On-Chain Bias | "What's the current bias on MNT? Show me on-chain metrics" | Crypto-first, activates `get_onchain_activity` + `get_whale_alerts` |
| 3 | 🔮 Analyze DeFi Pools | "What's the TVL and APR situation on Mantle? Any anomalies?" | Activates `get_defi_pools` tool, showcases Mantle DeFi depth |
| 4 | ⛓️ Agent Identity | "Show me the agent dashboard and recent on-chain signals" | Direct link to the ERC-8004 identity card and signal feed |
| 5 | 📈 ETHBTC Structure | "Top-down ETHUSDT 4H→15M structure with key levels" | Keeps technical analysis capability, crypto-native framing |

### Design Notes
- All 5 prompts should visually reinforce the **DeFAI / On-Chain Alpha** narrative
- The `bg` and `fg` color tints should align with the Mantle brand color palette (purple/indigo tones match the Mantle identity)
- The icon set should use crypto-native icons (Activity, TrendingUp, Zap, Shield, BarChart3)

### Implementation Notes
- Replace the `PROMPTS` array entirely
- Add crypto-relevant `bg` values using Mantle's color tokens
- Verify the `Alert` prompt triggers the correct alert API (currently likely uses FX alert system — needs verifying)

---

## 2. AI Response System Upgrade

**Files:** 
- `packages/ai/src/prompt/system.ts`
- `apps/web/src/app/api/chat/route.ts`
- `packages/ai/src/agent.ts`

### Current State
The system prompt says: *"You are HamaFX-Ai, a focused trading copilot for XAUUSD (gold), EURUSD, GBPUSD, and Crypto (MNT, WETH, USDT, mETH)."* — This is an identity crisis. The project claims to be about Mantle DeFAI but the AI thinks it's an FX copilot.

### Problems
1. **Identity mismatch:** System prompt front-loads gold/EUR/GBP, crypto is an afterthought
2. **Tool framing is wrong:** `get_indicators`, `get_candles` are fine for FX but the emphasis should be on `get_onchain_activity`, `get_whale_alerts`, `analyze_alpha_signal`, `log_signal_onchain`
3. **Output format is FX-oriented:** Numbers: "1 decimal place for XAU (gold)" is irrelevant
4. **Missing Mantle-specific context:** No mention of ERC-8008, no mention of the agent wallet, no mention of the hackathon narrative
5. **Bias/Setup language is generic FX:** Needs to be updated for crypto market structure language

### Recommended System Prompt Overhaul

**New Base Prompt Identity:**
```
You are Hama Alpha, an autonomous on-chain alpha intelligence agent operating on the Mantle blockchain (chain ID 5003, Mantle Sepolia testnet).

Your core mission is to generate, validate, and log high-confidence trading alpha signals to the Mantle blockchain using the ERC-8008 standard, acting as a verifiable on-chain AI trading agent identity.

**Your Instruments:**
- MNTUSDT (primary — native Mantle token)
- ETHUSDT, BTCUSDT (major crypto pairs)
- WETH, USDT, USDC, WMNT, mETH (on-chain assets on Mantle)
```

**Mantle-Native Tool Priority (reorder):**
1. `get_onchain_activity` — Mantle network health, gas, TVL
2. `get_whale_alerts` — Large transfers ≥$50K on Mantle tokens
3. `analyze_alpha_signal` — Run the full 3-agent committee (Economist + Technician + Risk Manager → Moderator) for a structured grade
4. `log_signal_onchain` — Sign and submit the signal to the MantleAlphaLogger contract (ERC-8008)
5. `get_defi_pools` — Merchant Moe, Agni pool data for DeFi alpha
6. `get_candles` / `get_indicators` — Price charts (secondary to on-chain)
7. `get_price` — Live price for supported symbols

**New Output Format Language:**
- Remove all "XAU (gold) 1 decimal, EURUSD 4 decimal" rules
- Replace with: "MNTUSDT: quote prices at 4–6 decimals depending on volatility; show $ value for on-chain amounts"
- Replace "bias vs setup" with "Swing bias (multi-day) vs Intraday structure setup"
- Add mandatory section in responses: **"🔗 On-Chain Proof:"** with MantleScan link when a signal is logged

**New Rules:**
```
11. **On-Chain Logging**: Any alpha signal with confidence ≥ 7/10 MUST be logged on-chain using `log_signal_onchain`. Say: "Logging this signal to the Mantle blockchain…" and include the tx hash and MantleScan URL.
12. **Hackathon Demo Mode**: When the user asks to "show me what you can do" or "demo", run a full pipeline: scan whale activity → analyze → log on-chain → show the explorer link.
13. **No Financial Advice**: Always use "scenario language" — "If [condition] then [outcome]" — never "you should buy".
14. **Agent Identity**: When asked about the agent, reference the ERC-8008 contract at 0x6D29F763dF73A0C23D837aDAFF67DE68B48a92F9 on Mantle Sepolia (chain 5003).
```

### Implementation Notes
- Do NOT delete the old FX code — wrap it behind a model preference or keep it dormant
- The `env` override mechanism in `/api/chat` (X-AI-Prefs header) already supports per-user model selection — leverage this
- The `useChat` transport already handles streaming — no frontend changes needed
- Update `apps/web/src/app/(app)/chat/page.tsx` if it has hardcoded FX references in its empty state

---

## 3. Chart Page Upgrades

**Files:**
- `apps/web/src/app/(app)/chart/[symbol]/_components/chart-view.tsx`
- `apps/web/src/components/chart/chart.tsx`
- `apps/web/src/components/chart/timeframe-picker.tsx`
- `apps/web/src/components/chart/symbol-picker.tsx`

### Current State
Already significantly upgraded with indicators, overlays, themes, and live price streaming. Has a good foundation.

### Problems
1. **Symbol picker still includes FX symbols** that may not have data — need to verify which symbols actually work
2. **Timeframe picker** has standard FX timeframes — should verify crypto relevance (1m, 5m, 15m, 1H, 4H, 1D are fine for crypto)
3. **Mantle brand identity is absent** from the chart page header/branding
4. **"BiQuote"** source attribution in the footer is FX-centric — should be removed or updated
5. **No on-chain data integration** on the chart page — a crypto chart should show whale transfer markers directly on the chart

### Recommended Upgrades

**A. On-Chain Whale Markers on Chart**
- Add a `whaleMarkers` prop to the `Chart` component
- Render whale transfer events as vertical lines or annotation markers on the main chart
- Color-code: large buy (green), large sell (red), with tooltip showing amount + token
- This creates a unique differentiating feature vs. generic trading platforms

**B. Mantle Brand Overlay**
- Add a subtle Mantle logo/watermark in the corner of the chart (toggleable)
- Update the chart footer to say "Mantle Sepolia · Real-time candles" instead of "BiQuote"

**C. Symbol Picker Cleanup**
- Remove any symbols that don't have real data (verify which FX pairs actually have candles)
- Ensure MNTUSDT, ETHUSDT, BTCUSDT are prominent at the top
- Consider adding a "Favorites" star feature for symbols

**D. New Timeframe Additions**
- Add "12h" and "3D" timeframes which are important for crypto swing trading
- Consider "15m" as default instead of current default (verify current default)

**E. Chart Settings Drawer — Add DeFi Panel**
- Extend the `ChartSettingsDrawer` to include a section for "On-Chain Overlays"
- Toggle: Show whale transfer markers on chart
- Toggle: Show protocol TVL changes
- Toggle: Show pool liquidity events

**F. DeFAI Quick-Action Bar**
- Below the chart header, add a row of quick-action chips:
  - "🐋 Scan Whales" → triggers whale scan and highlights on chart
  - "🔮 Analyze" → runs `analyze_alpha_signal` on current symbol
  - "📝 Log Signal" → directly calls `log_signal_onchain` with current bias

---

## 4. Alpha Signals & Dashboard Pages

**Files:**
- `apps/web/src/app/(app)/signals/page.tsx`
- `apps/web/src/app/(app)/dashboard/page.tsx`

### Current State
Signals page: Has a clean card-based layout with confidence bars, grade badges, direction badges, and MantleScan links. Shows stats (total, logged, avg confidence). Good foundation.

Dashboard page: ERC-8008 Agent Identity card, direction/type breakdowns, agent wallet address display.

### Problems — Signals Page
1. **Empty state prompt** says "Ask the AI: 'Analyze MNT on-chain activity and generate an alpha signal'" — this is correct but the prompt should be more prominent
2. **No filtering/sorting** — user can't filter by asset, direction, grade, or time range
3. **No "Log New Signal" CTA** — there's no button to manually trigger a new signal analysis
4. **Stats row is minimal** — could show more interesting metrics (win rate if tracked, best grade distribution)
5. **No "Share" or "Copy" functionality** for individual signal cards
6. **Explorer link label** "MantleScan ↗" is correct but the explorer URL should use the actual MantleScan URL format for Sepolia
7. **No pagination** — loads 50 signals, no load-more or infinite scroll
8. **No grade distribution chart** — a simple A/B/C/D/F bar chart would make the page much more visually impressive for a hackathon demo

### Recommended Upgrades — Signals Page

**A. Filter Bar**
Add a filter row above the signal list:
- Asset filter: All / MNT / ETH / BTC / WETH / USDT
- Direction: All / 📈 Bullish / 📉 Bearish / ➖ Neutral  
- Grade: All / A / B / C / D / F
- Sort: Newest first / Highest confidence / Highest grade

**B. Stats Dashboard Row (expand the 3 stat cards)**
Current 3 cards → 6 cards:
1. Total Signals
2. On-Chain Logged
3. Avg Confidence
4. **Grade A Rate** (signals graded A / total signals)
5. **Bullish %** (bullish signals / total)
6. **Last Signal** (relative time, e.g., "2h ago")

**C. Grade Distribution Chart**
Simple horizontal bar showing % of signals at each grade (A–F). Rendered as a CSS bar chart, no external chart lib needed.

**D. "Generate Signal" CTA**
A prominent button/card at the top: "🐋 Generate New Signal →" that navigates to the chat with a pre-filled prompt to run `analyze_alpha_signal`.

**E. Signal Card Improvements**
- Add a "Copy Signal Summary" button on each card (for sharing)
- Add a "View on MantleScan" block for on-chain signals — show block number, gas used
- Show the committee consensus reasoning (the full `committeeReasoning` field) in a collapsible "Details" section
- Show which tokens were involved (for whale_alert type signals)

### Problems — Dashboard Page
1. **Title says "ERC-8008 Agent Identity"** — should be updated to reflect the Mantle hackathon context
2. **No recent signal feed** — the dashboard shows stats but no recent signal cards
3. **"Direction/Type Breakdown"** uses generic emojis — could be more visually rich
4. **No "Run Agent" action** — no button to trigger a manual agent run or signal generation
5. **Agent wallet address** displayed but there's no "Copy Address" button
6. **No live indicators** — no showing of current Mantle block height, gas price, or recent whale count

### Recommended Upgrades — Dashboard Page

**A. Live Mantle Status Header**
Add a live-status strip at the top:
```
Mantle Sepolia · Block #12345678 · Gas: 12 gwei · 3 whale transfers in last hour
[▶ Run Agent] [📊 View Signals]
```

**B. Agent Identity Card (keep + upgrade)**
- Show agent name "Hama Alpha" prominently
- Show contract address with copy button
- Show agent wallet address with copy button  
- Add MantleScan link directly on the card
- Show "Agent Status: Active" with a pulsing green dot

**C. Recent Signals Feed**
Replace or supplement the "Direction/Type Breakdown" with a live feed of the 5 most recent signals (same card style as the signals page, but compact).

**D. Agent Action Panel**
- "🐋 Run Whale Scan" — triggers onchain scanner manually
- "🔮 Generate Alpha Signal" — runs the full committee
- "⛓️ View On-Chain Logs" — links to MantleScan for the agent wallet

**E. Performance Metrics Card**
New card: "Committee Performance" showing:
- Average grade (last 7 days)
- Signals by grade (A–F mini chart)
- Most common signal type

**F. Rename "Dashboard" to "Agent" in Nav**
The nav item currently says "Dashboard" — for hackathon branding, consider renaming to "Agent" or "Alpha Agent" to reinforce the DeFAI narrative.

---

## 5. News & Calendar Pages — Resolve Keep or Delete

**Files:**
- `apps/web/src/app/(app)/news/page.tsx` + `_components/`
- `apps/web/src/app/(app)/calendar/page.tsx` + `_components/`

### Current State
Both pages exist and are server-rendered. News uses Finnhub + Marketaux and filters for "XAU / EUR / GBP / USD". Calendar shows macro events for "XAU / EUR / GBP / USD".

### Analysis

**Keep if:**
- The AI agent can still use news/calendar tools for crypto-adjacent macro events (Fed decisions, ETF approvals, etc. affect crypto)
- There's value in showing macro backdrop even for a crypto agent

**Delete/replace if:**
- They create confusion about the app's identity (FX-centric pages don't belong in a Mantle DeFAI app)
- The backend dependencies (Finnhub, Marketaux) may not be configured in the hackathon deployment
- Maintenance burden outweighs value

### Recommendation: **Rebuild as "Macro Intelligence" — Crypto-Native**

Rather than delete, retheme these pages as crypto-native macro tools:

**News → "Macro Intelligence"**
- Change description to "Macro events and news that move crypto markets"
- Filter/tag for: Fed/FOMC, ETF approvals, Layer-2 news, Mantle ecosystem news, Ethereum upgrades
- Add Mantle-specific news tagging if possible
- Update the AI tools (`listRecentArticles`) to optionally tag for crypto-relevant events
- Show sentiment (bearish/bullish) per article with a small indicator

**Calendar → "Event Calendar"**  
- Change description to "High-impact events for crypto traders"
- Tag events as: 🔴 High Impact / 🟡 Medium / 🟢 Low for crypto markets specifically
- Highlight events that typically move ETH/BTC (FOMC, ETF decisions, network upgrades)
- Add Mantle-specific events if any are known (hackathon demo events, token unlocks)
- Show "Next high-impact event" prominently at the top

**AI Tool Updates:**
- In `packages/ai/src/prompt/system.ts`, the `nextHighImpactEvent` field should include crypto-relevant events (not just FX events)
- The `listRecentArticles` and `listUpcomingEvents` tools should be updated to accept an optional `scope: 'crypto' | 'fx'` parameter (or default to crypto)

**If Backend Dependencies Are Missing:**
If Finnhub/Marketaux API keys aren't configured for the hackathon, both pages will show empty states. In that case:
1. Add a "Demo Mode" banner when data sources fail
2. Consider hardcoding 3–5 sample news articles and 2–3 sample events for demo purposes (clearly labeled as "Sample Data")
3. Or remove the cron dependencies and render static "coming soon" pages with a waitlist CTA

**Nav Impact:**
If kept, rename in nav drawer from "News" → "Macro" or "Intelligence" and "Calendar" stays "Calendar" but with updated description.

---

## 6. Settings Page Upgrade

**Files:**
- `apps/web/src/app/(app)/settings/page.tsx`
- `apps/web/src/app/(app)/settings/_components/*.tsx`
- `apps/web/src/app/(app)/settings/usage/page.tsx`

### Current State
Settings has 8 sub-cards: SystemStatus, UsageGlance, AgentCard, AIPrefsCard, NotificationsCard, PreferencesCard, DataCard, AboutCard. A solid foundation.

### Problems
1. **AboutCard** says "MNTUSDT · BTCUSDT · ETHUSDT — Web3 AI Agent" — this is fine but should also reference the Mantle hackathon
2. **AgentCard** links to `/settings/agent` which may not exist — needs checking
3. **AIPrefsCard** may have FX-specific model defaults — verify
4. **SystemStatusCard** — what does it show? Needs verification for Mantle-specific metrics
5. **Usage page** shows "last 30d" token counts — for a hackathon demo, this is fine
6. **No Mantle-specific settings** — should there be a "Network" section to switch between Mantle Sepolia and mainnet (for post-hackathon)?

### Recommended Upgrades — Settings Page

**A. Add "Mantle Network" Section**
New card: **NetworkCard**
- Shows current network: Mantle Sepolia (Chain ID: 5003)
- Shows MantleAlphaLogger contract address with copy button
- Shows agent wallet address with copy button
- Shows recent gas spent (if trackable)
- Link to MantleScan for contract and wallet

**B. Verify/Add `/settings/agent` Page**
The AgentCard links to `/settings/agent` but this page may not exist. Create or link to the dashboard instead if the agent catalogue page doesn't exist.

**C. AIPrefsCard — Crypto Model Defaults**
Ensure default model selection is appropriate for the hackathon demo:
- Verify `AI_FUNDAMENTAL_MODEL` and `AI_TECHNICAL_MODEL` are set appropriately
- Add a "Demo Mode" toggle that forces cheaper/faster models

**D. SystemStatusCard — Add Mantle Metrics**
If the system status card shows DB latency and sync status, add:
- Mantle RPC connection status
- Recent whale scan status
- On-chain signal logging queue depth

**E. DataCard — Export/Import**
- Add "Export All Signals" as JSON/CSV
- Add "Export Agent Wallet Transactions" link to MantleScan

**F. AboutCard — Hackathon Branding**
Update the footer to:
```
HamaFX-Ai · Mantle Turing Test Hackathon 2026
Track 2: AI Alpha & Data
Built on Mantle · ERC-8008 On-Chain Identity
```

**G. Nav Drawer Updates**
Review `PRIMARY` and `SECONDARY` nav items:
- Consider renaming "Dashboard" → "Agent" or "Alpha Agent"
- Consider renaming "Chart" → "Charts" or keep as is
- Confirm "Alerts" and "Journal" pages exist and are functional (or hide them if not)
- Update descriptions to be crypto-native:
  - "Chat" → "DeFAI Chat with On-Chain Alpha Tools"
  - "Alpha Signals" → "Verified On-Chain Alpha Feed"
  - "Dashboard" → "Agent Identity & Performance"

---

## Cross-Cutting Concerns

### A. Branding & Visual Identity
- App name in Nav: "Hama **DeFAI**" should be prominent
- Subtitle: "Mantle AI Agent" (already there)
- Mantle's brand color is purple/indigo — ensure `text-brand` CSS variable uses Mantle purple
- Consider adding Mantle logo SVG to the Nav identity strip
- Page titles should all follow: "Page Name · Hama DeFAI · Mantle"

### B. Navigation Consistency
After the chart page upgrade, the nav should reflect:
```
Chat → "DeFAI Chat"
Chart → "Charts" 
Signals → "Alpha Signals"  
Dashboard → "Agent" (or "Alpha Agent")
News → "Macro" (if kept)
Calendar → "Events" (if kept)
Settings → "Settings"
```

### C. Empty States
Every page with an empty state should have a clear CTA to generate content:
- Signals: "Run Agent to Generate First Signal"
- Dashboard: "Start a Chat to Generate Your First Signal"
- News/Calendar: "Refresh data" or "Coming soon" with demo data option

### D. API Routes to Verify
- `/api/cron/news` — needs Finnhub/Marketaux keys
- `/api/cron/calendar` — needs news API keys
- `/api/cron/onchain-scan` — whale scanner cron (important, must work)
- `/api/signals/[id]/log` — manual signal logging trigger (important, must work)
- `/api/chat/threads/[id]` — thread title update (needs verification)

### E. Environment Variables to Verify
Critical env vars for hackathon demo:
```
# AI
AI_GATEWAY_API_KEY
GOOGLE_GENERATIVE_AI_API_KEY
AI_FUNDAMENTAL_MODEL=google-vertex/gemini-2.5-flash
AI_TECHNICAL_MODEL=google-vertex/gemini-2.5-flash
AI_SUMMARY_MODEL=google-vertex/gemini-2.5-flash-lite

# Web3
MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
MANTLE_AGENT_PRIVATE_KEY=  (HACKATHON WALLET - MINIMUM BALANCE NEEDED)
ALPHA_LOGGER_ADDRESS=0x6D29F763dF73A0C23D837aDAFF67DE68B48a92F9

# DB
DATABASE_URL=  (Supabase connection string)

# Cron
CRON_SECRET=  (Vercel cron job secret)
```

### F. Error Handling & Graceful Degradation
For the hackathon demo, every external dependency should fail gracefully:
- Mantle RPC fails → show "On-chain data unavailable" with last known state
- AI models fail → show error with retry button
- DB fails → show cached data or "Signals temporarily unavailable"
- Finnhub/Marketaux fail → show empty state with manual refresh option

---

## Suggested Execution Order

```
Phase 1 (Foundation — 1-2 hours)
├── Update system prompt + tool priority (packages/ai/src/prompt/system.ts)
├── Update quick prompts (apps/web/src/components/chat/quick-prompts.tsx)
├── Update nav drawer labels/descriptions
└── Verify env vars are set

Phase 2 (Signals + Dashboard — 2-3 hours)
├── Signals page: add filters, stats expansion, grade chart, CTA
├── Dashboard page: add live Mantle status, agent action panel, recent signals
├── Update AboutCard hackathon footer text
└── Verify /settings/agent route exists or redirect

Phase 3 (Chart — 1-2 hours)
├── Add whale marker overlays to chart
├── Verify symbol picker data coverage
├── Add DeFi quick-action chips below chart
└── Update chart footer attribution

Phase 4 (News/Calendar — 1 hour)
├── Decide: keep + retheme or remove
├── If keep: update filtering and descriptions
└── Add demo data fallback if APIs unavailable

Phase 5 (Settings — 1 hour)
├── Add NetworkCard (Mantle contract/wallet info)
├── Update AboutCard hackathon footer
├── Verify SystemStatusCard has Mantle metrics
└── Verify AIPrefsCard crypto model defaults

Phase 6 (Polish — 1-2 hours)
├── Run full UI smoke test
├── Verify streaming chat works end-to-end
├── Verify on-chain signal logging works end-to-end
├── Verify whale scanner cron fires correctly
└── Demo run: full flow from chat → analyze → log on-chain → view in signals page
```

---

## Open Questions to Resolve Before Implementation

1. **Does `/settings/agent` route exist?** If not, should AgentCard link to `/dashboard` instead?
2. **Are the Finnhub/Marketaux API keys configured?** If not, should news/calendar pages be removed or replaced with static demo content?
3. **What is the default symbol for the chart page?** Currently `MNTUSDT` — is this correct for the hackathon demo, or should BTCUSDT or ETHUSDT be the default?
4. **Does the `log_signal_onchain` tool work end-to-end?** The agent needs test MNT for gas. What's the current test wallet balance?
5. **Should the app name in the nav be "Hama DeFAI" or "HamaFX-Ai"?** Both appear — pick one and be consistent
6. **Is there a `/alerts` page?** It appears in the nav but needs verification it exists and works
7. **Is there a `/journal` page?** Also in nav — needs verification
8. **Should "Journal" be removed from nav for the hackathon?** It's not part of the core DeFAI alpha narrative

---

## Success Criteria

A judge visiting the app should be able to:
1. Open the app and immediately understand it's a Mantle DeFAI agent
2. Ask "show me whale activity on Mantle" and get a full response with on-chain data
3. Ask "generate an alpha signal" and watch it get logged on-chain with a MantleScan link
4. View the signals page and see the on-chain proof of logged signals
5. View the agent dashboard and see the ERC-8008 identity card with live Mantle status
6. Navigate without ever seeing an FX reference (gold/EUR/GBP) that breaks the crypto narrative

---
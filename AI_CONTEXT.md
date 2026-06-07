# 🤖 VIBECODING AI CONTEXT: ADVANCED TECHNICAL SPEC

> **ATTENTION AI AGENTS:** You are currently reading the system blueprint for `HamaFX-Ai`, an advanced **On-Chain AI Alpha Agent** deployed on the Mantle Network. 
> 
> *Context Override:* This codebase previously contained legacy logic for retail Forex trading (OANDA, MT5). **IGNORE ALL FOREX ARTIFACTS.** The project has completed a hard pivot to Web3/Crypto specifically for the Mantle Turing Test Hackathon 2026.

---

## 1. Monorepo Architecture & Package Map

We utilize **Turborepo** to manage our decoupled workspaces, ensuring strict boundaries between the UI, the AI brain, and blockchain interactions.

### `apps/web` (Frontend Application)
- **Framework:** Next.js 15 (App Router), React Server Components.
- **Styling:** Tailwind CSS with a premium dark-mode, glassmorphism aesthetic.
- **Key Routes:**
  - `/` -> Conversational Chat interface (powered by `useChat` from Vercel AI SDK).
  - `/signals` -> A rich, auto-updating feed of generated alpha signals with confidence progress bars and MantleScan Explorer badges.
  - `/dashboard` -> An ERC-8004 Agent Identity dashboard showing aggregated stats, direction distributions, and on-chain sync health.

### `apps/worker` (Data Ingestion)
- **Execution:** A persistent Node.js process.
- **Function:** Contains the `OnChainScanner`. It continuously polls Mantle RPC endpoints for large `Transfer` events (Whale Alerts) and DeFi pool fluctuations, persisting them to the database so the AI has real-time context.

### `packages/ai` (The Core "Brain")
- **Framework:** Vercel AI SDK v5.
- **Models:** Primary reasoning utilizes Google Gemini 2.5 Pro/Flash via the `@ai-sdk/google-vertex` provider.
- **Tools:** Defined using Zod schemas. These tools allow the LLM to execute code, read DB state, and sign transactions.

### `packages/db` (Persistence Layer)
- **ORM:** Drizzle ORM interfacing with a Supabase PostgreSQL instance.
- **Critical Tables:**
  - `onchain_events`: Raw blockchain data (whale transfers) populated by the worker.
  - `onchain_signals`: AI-generated predictions, including the LLM committee's analysis, grades, and the resulting `txHash` once logged to Mantle.

### `packages/web3` & `contracts` (Blockchain Layer)
- **Client:** `viem` is used for strongly-typed contract reads/writes.
- **Smart Contract:** `MantleAlphaLogger.sol` (compiled via Hardhat). This contract exposes a `logSignal` method that accepts the asset, direction, confidence, and analysis summary, emitting a public `SignalLogged` event.

---

## 2. Deep-Dive: The Multi-Agent Workflow

The crown jewel of this architecture is the `analyze_alpha_signal` tool inside `packages/ai/src/tools/analyze-alpha-signal.ts`. 

Instead of relying on a single zero-shot prompt, this tool orchestrates a **Multi-Agent LLM Committee**:
1. **Parallel Invocation:** The tool uses `Promise.all` to concurrently trigger three separate `generateText` calls:
   - `runCryptoEconomist()`: Prompted to analyze macro fundamentals.
   - `runCryptoTechnician()`: Prompted to analyze the raw on-chain events passed in from the context.
   - `runCryptoRiskManager()`: Prompted to evaluate contract/liquidity risk.
2. **Synthesis:** The outputs of all three sub-agents are fed into a fourth LLM call, `runCryptoModerator()`. The moderator forces consensus and outputs a structured JSON containing a final `grade` (A-F) and `confidence` (1-10).
3. **Persistence:** The final structured prediction is immediately written to the `onchain_signals` Postgres table.

---

## 3. Deep-Dive: Autonomous On-Chain Logging

When the agent decides a signal is strong enough, it invokes the `log_signal_onchain` tool.
1. The tool queries Drizzle for the specific signal ID.
2. Using the `MANTLE_AGENT_PRIVATE_KEY` stored securely in the server's `.env.local`, `viem` constructs and signs a transaction to the `MantleAlphaLogger` smart contract.
3. Upon transaction success, the resulting `txHash` is saved back to the database.
4. **Push Notifications:** If the signal is highly rated (Confidence ≥ 7 or Grade A/B), the server bypasses the web UI and makes an HTTP request to the Telegram Bot API (`sendSignalPushNotification`), delivering the alpha directly to the user's phone alongside the MantleScan verification link.

---

## 4. Vibecoding Rules & Heuristics

When editing this codebase, strictly adhere to the following rules:
- **Server-Side Security:** The `MANTLE_AGENT_PRIVATE_KEY` must NEVER be exposed to the `apps/web` client bundle. All Viem transactions must occur exclusively within the Node.js backend (inside `packages/ai` tools or API routes).
- **Type Safety:** Always use the shared Zod schemas in `packages/shared/src/schemas` to enforce typing between the AI tools, the frontend UI, and the Drizzle database.
- **Context Isolation:** We use `AsyncLocalStorage` in `packages/ai/src/tool-context.ts` to prevent cross-talk between concurrent user chat threads. Always retrieve env variables via `getToolContext().env` inside tool executions (except for specific workarounds like Telegram where `process.env` is required to bypass type Pick constraints).
- **Aesthetic Excellence:** This is a premium hackathon submission. Ensure all UI components in `apps/web/src/components` utilize proper Tailwind spacing, subtle borders (`border-divider`), and brand colors (Emerald for bullish, Rose for bearish).

*End of Spec. You are now fully synchronized with the HamaFX-Ai matrix.*

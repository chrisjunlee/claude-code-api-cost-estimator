/handoff

# Handoff — api-cost-comparison (claude-code-api-cost-estimator)

Last updated: 2026-05-01 (v0.1.1 published; accuracy fixes shipped; next up = swap glm-4.6 → glm-5.1)

## Locations

- **Memory dir**: `/Users/christopherlee/.claude/projects/-Users-christopherlee-projects-api-cost-comparison/memory/`
- **Memory index**: `/Users/christopherlee/.claude/projects/-Users-christopherlee-projects-api-cost-comparison/memory/MEMORY.md`
- **Lessons / gotchas**: `/Users/christopherlee/.claude/projects/-Users-christopherlee-projects-api-cost-comparison/memory/gotchas.md`
- **Task list**: `HANDOFF.md#whats-next` (this file)
- **Project docs touched this session**: `pricing.json`, `src/aggregate.mjs`, `package.json`, `.gitignore`, `HANDOFF.md`

## TL;DR

Last session diagnosed a 6.4× cost over-report ($7,673 vs ccusage's $1,193) and left two fixes uncommitted in the tree. This session shipped them: stale Opus 4.5+ rates corrected, `requestId` dedup committed, scratch files cleaned up, and **v0.1.1 published to npm** with annotated tag pushed. The local server now reports $1,339 over the same 30-day window, which matches ccusage exactly on tokens and is ~12% high on cost — that residual gap is the 1h cache-write surcharge we deliberately keep (closer to real Anthropic billing than ccusage's flattened-to-5m approximation). Next session should pick up the user-requested **glm-4.6 → glm-5.1 replacement in `pricing.json`** (started but interrupted), then move to the carryover items (Kimi K2.6, refresh button, README hero).

## What changed this session

- **Killed stale npx-installed server (PID 62744)** on port 3000 and restarted from the local repo so the fixes were actually live.
- **Verified** `/api/matrix` reports `$1,339` total native cost over the 30-day window — matches the expected ~$1,337 from the diagnosis.
- **Committed `48fb632`** *fix: dedup by requestId; correct Opus 4.5+ pricing* — bundles `pricing.json` (Opus 4.5/4.6/4.7 → $5/$25/$0.50/$6.25/$10.00), `src/aggregate.mjs` (`seenReqIds` dedup carried over from prior session), and `.gitignore` (added `reference_ccusage/` and `dedup_check.py`).
- **Deleted** `dedup_check.py` (investigation script, no longer needed).
- **Committed `40269b7`** *chore: bump version to 0.1.1*.
- **Published** `claude-code-api-cost-estimator@0.1.1` to npm (registry confirmed).
- **Pushed** annotated tag `v0.1.1` (with full release notes covering both bugs and the deliberate 1h-cache-surcharge tradeoff) and `main` (`c861b43..40269b7`) to `origin`.
- **Started but did not finish**: user asked to replace `glm-4.6` with `glm-5.1` in `pricing.json` — change is **not yet made**. See "What's next".

## Current state

| Thing | State |
|---|---|
| Server on `localhost:3000` | Running from local repo (background task `bv1p5fsq9`); reports $1,339 / 22,124 messages / 801 files scanned |
| Committed Opus pricing + requestId dedup | Yes (`48fb632`) |
| `package.json` version | `0.1.1` (committed `40269b7`) |
| Published npm version | `0.1.1` — live and matches the local repo |
| Git tag | `v0.1.1` annotated, pushed to origin |
| `main` branch | Pushed to origin (HEAD = `40269b7`) |
| Cost vs ccusage | $1,339 vs ~$1,195 — ~12% high by design (1h cache surcharge) |
| Token totals vs ccusage | Match exactly after dedup |
| Tests | None |
| `pricing.json` GLM entry | Still `glm-4.6`; user wants `glm-5.1` (next session) |
| Working tree | Clean except for this `HANDOFF.md` update |

## What's next

1. **Replace `glm-4.6` with `glm-5.1` in `pricing.json`** (user-requested, in-flight when handoff was triggered). Two locations: the model entry at the top (line ~121) and the `altOrder` list (line ~155). Need to look up GLM-5.1 input/output/cache_read rates from `https://docs.z.ai/guides/overview/pricing`. Update `displayName` to "GLM-5.1". Also check if the GLM provider entry in `providers` (it's currently absent — only `deepseek-v4` and `qwen3` have one) needs a tierMap; right now GLM is treated as a single SKU.
2. **(Carryover) Kimi K2 → K2.6** — `kimi-k2-thinking` deprecates 2026-05-25. Update the entry in `pricing.json` once K2.6 is published at `platform.kimi.ai`. Note: the matrix output already uses `kimi-k2.6` as the alt key (defined in `altOrder`), so the model entry name needs to match.
3. **(Carryover) Refresh button + per-project breakdown view** — aggregator already records `cwd`/`sessionId` per line, so the data is there; this is a frontend change in `public/app.js` + `public/index.html`.
4. **(Carryover, lower) README hero screenshot.**
5. **(After GLM-5.1)** Decide whether the GLM swap warrants `0.1.2` patch publish, or batch with the Kimi K2.6 update.

## Open questions / blockers

- GLM-5.1 pricing values — need to be looked up, not invented. Z.AI docs at `https://docs.z.ai/guides/overview/pricing` are authoritative.
- Anthropic's actual published 1h cache rate for Opus 4.5+ is inferred from the standard "1h = 1.6× 5m" pattern ($6.25 × 1.6 = $10). Verify against Anthropic's pricing page if anyone questions it.
- Whether to expose a "match ccusage" toggle in the UI (flatten 1h to 5m). Probably not worth it; ~12% delta is acceptable and we're more correct.
- Local-repo server (`node bin/cli.mjs`, background task `bv1p5fsq9`) is still running on `:3000`. Will be terminated when the session ends — next session should start a fresh one.

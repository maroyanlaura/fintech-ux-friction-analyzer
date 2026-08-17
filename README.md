# Fintech UX Friction Analyzer

A tool for product managers to catch UX friction in a fintech user flow before it
reaches engineering. Describe a flow in plain text and get a friction score, a
metric breakdown, flagged friction points tied to specific steps, and actionable
recommendations.

## How analysis works

Friction Analyzer does **not** call an external AI model. It runs a deterministic,
rule-based heuristic locally in the browser: the same input always produces the
same output. The flow text is split into steps, then checked against a fixed set
of UX heuristics (OTP usage, repeated authentication, payment steps without error
recovery, missing success confirmation, external dependencies, manual entry load,
total step count). See [`src/lib/analyzeFlow.ts`](src/lib/analyzeFlow.ts) for the
full rule set.

## Design

Built against four Claude Code design skills (`impeccable-design`, `design-tokens`,
`frontend-craft`, `accessibility-audit`). Direction: an audit-instrument aesthetic
(precise, clinical) rather than a consumer fintech app — cool-tinted graphite
neutrals, a warm copper/signal-amber accent used sparingly, Public Sans for UI
text, Martian Mono for numeric/tabular data. Full OKLCH 3-tier token system
(primitive → semantic → component) in [`src/styles/tokens.css`](src/styles/tokens.css)
with light and dark themes.

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`).

To type-check and build for production:

```bash
npm run build
npm run preview
```

## Stack

React 19 + TypeScript + Vite 6 + Tailwind CSS v4. No backend, no external API —
everything runs client-side.

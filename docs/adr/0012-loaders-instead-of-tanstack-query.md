# 0012 — React Router loaders instead of TanStack Query and Zustand

**Status:** Accepted · 2026-11-19

## Context
SPEC §5 suggests TanStack Query for server data and Zustand for transient UI state. React Router v8 loaders already fetch server data during SSR and client navigation, and SPEC §11 requires every view state to live in the URL.

## Decision
Pages get their data from route loaders, which call `apps/web/server/data/*` directly. View state (route, journey mode, direction, step, selected node, speed) lives in the query string. Transient state (hover, playing) is component state. The narrator pane fetches versioned, immutable API URLs (`/api/v1/d/:dataVersion/…`), so the browser and edge cache serve repeats. Neither TanStack Query nor Zustand is installed.

## Consequences
- About 15 KB gzip less initial JS; a hadith page loads 162.7 KB against the 180 KB budget.
- If Phase 3's network view needs shared client caching across many requests, revisit TanStack Query then.

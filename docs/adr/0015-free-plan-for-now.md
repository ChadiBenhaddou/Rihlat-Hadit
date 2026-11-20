# 0015 — Run on the Workers Free plan for now

**Status:** Accepted · 2026-11-20 (a decision by the project owner; reversible)

## Context
SPEC §4 chooses Workers Paid: Free allows 10 ms of CPU per request and rejects `limits.cpu_ms`. The deploy to the owner's account failed on that setting (API code 100328). A test deploy of preview without the setting served every page with no CPU errors and about 0.3 s time to first byte (measured 2026-11-20).

## Decision
Production runs on the Free plan for now. The `limits` line is removed from `wrangler.jsonc`, with a comment saying how to restore it.

## Consequences
- Requests needing more than 10 ms of CPU fail with Cloudflare error 1102. The heaviest candidates are the all-routes graph of a large group, depth-2 narrator networks, and big كتاب pages. Watch Workers Logs for exceeded-CPU errors.
- Free also caps the plan at 100,000 requests per day and 5 GB of D1 storage per account; Bukhari uses far less.
- To move to Paid: subscribe in the dashboard, restore `"limits": { "cpu_ms": 5000 }`, and deploy.

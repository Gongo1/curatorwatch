# CuratorWatch — app repo

DeFi vault intelligence platform ("Bloomberg Terminal for DeFi vaults"). Next.js
(App Router, all-`'use client'` pages), Prisma + Postgres (Supabase), Redis cache,
Vercel cron. `main` deploys to curatorwatch.com.

## Turtle data: sanctioned API scope

CuratorWatch consumes two Turtle surfaces, and only these:

1. **Public opportunities (ingestion).** `GET earn.turtle.xyz/v1/opportunities/`,
   unauthenticated, pulled by the cron into the `Vault` table for display
   (`src/lib/turtle/client.ts`).

2. **Public Earn API (distributor deposit flow).** `earn.turtle.xyz/v1/*` with a
   **publishable `pk_live_` key** (`Authorization: Bearer`, origin-validated —
   browser-safe). This powers the attributed deposit embed at `/deposit`
   (`src/lib/turtle/earn-client.ts`, `src/app/deposit/*`): discover → membership
   (SIWE) → deposit → verify → track, attributed to CuratorWatch's distributor ID.
   This is a sanctioned, intended distributor integration — not the "auth endpoints"
   boundary below.

**Hard boundary:** the **internal `api.turtle.xyz` admin surface remains off-limits.**
Use only the public `earn.turtle.xyz` Earn API with the publishable key.

## /deposit feature flag

The deposit embed is gated behind `NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT`. When it is
anything other than `"true"`, `/deposit` 404s and nothing reaches users. Credentials
live in env (`NEXT_PUBLIC_TURTLE_API_KEY`, `NEXT_PUBLIC_TURTLE_DISTRIBUTOR_ID`) —
never hardcode or commit them. The `pk_live_` key's origin allowlist must include
`localhost:3000`, the Vercel preview domains, and `curatorwatch.com`.

Note on the docs vs. the live API (validated 2026-06-03): there is no `earn_enabled`
field — the list endpoints already return only depositable opportunities. Membership
register uses `nonce` + snake_case `distributor_id`; deposit uses camelCase
`distributorId`; verify returns the distributor under `metadata.distributorId`;
deposit transactions are nested at `item.transaction.{to,data,value,gasLimit,chainId}`.

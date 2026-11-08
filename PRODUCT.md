# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — institutional allocators** (confirmed 2026-11-07: "allocators first").
Portfolio managers at family offices, DAO treasuries, and crypto funds placing
$1M–100M into curated DeFi vaults. Their job runs discovery (which curators fit
the mandate) → due diligence (who is behind this vault, how concentrated, how
stressed) → monitoring (what changed since last check). They check weekly or
daily, at a desk, often on a second monitor, and forward findings to an
investment committee.

**Secondary — curators and their risk teams.** Benchmark against peers; the
Curator Pro offer (2026-09-29 go-to-market) is aimed at them. **Tertiary —
DeFi researchers** who export and cite the data.

## Product Purpose

CuratorWatch tracks the firms that curate DeFi vaults (Morpho, Euler,
tokenized funds, Hyperliquid and other listed products): what each one
manages, the TVL and yields behind it, the fees, the asset concentration, the
day's stress, and what changed. Data refreshes every 6 hours from public and
on-chain sources and is precomputed, so pages read a database, not live APIs.
Success: an allocator can answer "whose judgment am I trusting with this
deposit, and has anything moved?" in one visit, then comes back.

## Positioning

Curator-level, behavioral intelligence across protocols in one place. Rating
incumbents (Credora) score single vaults at a point in time; research entrants
(Vault Street) publish hand-written notes on a few products. CuratorWatch
covers every tracked curator, nightly, and shows how they behave over time.

## Operating Context

- Account wall (live since 2026-07-28): anonymous visitors see the home page
  (top-3 ranking rows plus public aggregates), /docs and /changelog. Every
  other route redirects to `/?join=1&next=<path>`, which opens sign-up.
- Sign-up is passwordless: email → 6-digit code (Clerk) → handle. Existing
  emails fall through to sign-in with the same UI. Google OAuth exists, dark
  behind `NEXT_PUBLIC_FEATURE_GOOGLE_AUTH`.
- Curator Daily digest (05:00 UTC) with a stress index; email alerts per
  curator; newswire of curator-tagged press.
- Product docs are written in Simplified Technical English (ASD-STE100).

## Capabilities and Constraints

- Routes: home (curator ranking + market overview), /curator/[address],
  /vault/[address], /compare, /yields, /fees, /liquidations, /calculator,
  /digest, /alerts, /changes, /changelog, /docs. /portfolio is flag-dark.
- **No risk scores or grades anywhere** (removed 2026-07, PR #30, product
  decision — do not re-add).
- **No deposit flows** (removed PR #53 — do not re-add).
- The UI talks about curators and the vaults they manage, not about data
  vendors (no Morpho/Turtle source framing).
- Feature flags are `NEXT_PUBLIC_*` build-time constants.
- Stack: Next.js 16 App Router, Tailwind v4, Prisma/Supabase, Clerk, AG Grid,
  Recharts, lucide-react icons.

## Brand Commitments

- Name **CuratorWatch**; tagline "The Bloomberg Terminal for DeFi vaults";
  logo `public/logo.png`; X handle @curator_watch.
- Voice: lead with data, confident not hype, no jargon without context,
  utility first.
- **Bloomberg Terminal feel** — pinned by Austin 2026-11-07 (chose "The
  Terminal" over an institutional-research or refined-dark reading).

## Evidence on Hand

- Live production data: tracked TVL, curator/vault counts, stress index,
  asset mix, newswire (all rendered from the DB).
- No testimonials, customer logos, or published benchmarks exist. Do not
  invent them. Outward copy avoids a fixed $ total (the number moves); use the
  live figure or none.

## Product Principles

1. Data first, chrome last: every pixel on a data page should be a number,
   a label for one, or a way to reach one.
2. Curators are the subject; vaults and protocols are lenses on them.
3. Honest about freshness: show when each figure was last updated.
4. The wall gates depth, never the first impression: public aggregates stay
   public.
5. Signing up should cost seconds, not steps.

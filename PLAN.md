# CuratorWatch: One-Stop Shop for Curation — Engagement Plan

Status: **Phase 1 implemented on branch `phase1-clean-fast` — needs preview-deploy
verification, then merge approval.** (Phase 0 approved 2026-06-09; protocol
integrations beyond Morpho/Turtle confirmed out of scope; /deposit flag stays on.)
Baseline captured 2026-06-09 against production (curatorwatch.com), repo at `main` = `31698c5`.

North star: Curator → Vaults → Deals → Returns → Deposit, as one continuous flow,
every deposit attributed to distributor `tsn83sYR`.

---

## Phase 0 — Audit findings

### 0.1 Repo state (important context)

- `curator-first-redesign` is **fully merged into main** — the Slate Terminal design
  system, curators-led shell, and trust-dossier curator profile are already live.
  Main is 12 commits ahead of that branch tip, including the entire `/deposit`
  feature (wallet connect → SIWE membership → deposit → attribution verify →
  deposits tracker, commits `80e7317..31698c5`).
- Stack is **Next.js 16.1.6** (App Router, Turbopack builds), Prisma + Postgres
  (Supabase, transaction pooler :6543), ioredis cache with in-memory fallback,
  Vercel crons.
- Untracked strays in the repo: `CURATORWATCHPITCH.docx`, `docs/CURATORWATCH_CONTEXT.md`,
  `morpho-v2-aum-by-curator.png`, `src/scripts/triage-synthetic-curators.ts` — need a
  keep/ignore decision before serious branch work.

### 0.2 Route map

Pages (all under `src/app/`): `/` (curators home), `/curator/[address]`,
`/vault/[address]`, `/vaults` + `/vaults/morpho` + `/vaults/turtle`, `/yields`,
`/fees`, `/liquidations`, `/calculator`, `/alerts`, `/changelog`, `/docs`,
`/deposit` (feature-flagged via `NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT`), `/share`,
`/changes` (redirect → /alerts). Routes missed in the brief: the curator/vault
detail pages, the three /vaults index pages, and /share.

Plus 32 API routes: `/api/dashboard`, `/api/curators*`, `/api/vaults*` (11
sub-resources per vault), `/api/stats/*` (9), `/api/changes`, `/api/health`,
`/api/track-*`, `/api/users/[address]/exposure`, and two cron routes.

### 0.3 Rendering strategy

Every data page is `'use client'` + `useEffect` fetch to `/api/*` — Next prerenders
an empty static shell, then content arrives client-side. Only `/docs`, `/changelog`,
`/changes` are server components. **No ISR anywhere.**

The 6h cadence lives entirely at ingestion (`vercel.json`):
`/api/cron/collect` `0 */6 * * *`, full sync `0 3 * * *`, `/api/cron/collect-turtle`
`0 */12 * * *`. Pages read precomputed DB rows through API routes cached with
`s-maxage=60, stale-while-revalidate=300` + Redis TTL 120s. So serving is
over-fresh (60–120s TTLs) relative to data that only changes every 6h — wasted
recomputation and a client-fetch waterfall on every view.

### 0.4 Performance baseline (Lighthouse, mobile emulation, prod)

| Page | Perf | A11y | BP | SEO | LCP | FCP | CLS | TBT | JS transferred |
|---|---|---|---|---|---|---|---|---|---|
| `/` | **60** | 89 | 100 | 100 | **8.0s** | 2.3s | 0.089 | 140ms | 408 KB |
| `/curator/[address]` (Sentora) | **62** | 91 | 100 | 100 | **7.6s** | 2.3s | 0.089 | 40ms | 307 KB |

Targets: Perf/A11y ≥95, LCP <2.0s, CLS <0.05. Gaps to close: **LCP 4× over target,
Perf ~35 points, CLS ~2× over, A11y 4–6 points.**

- LCP root cause: the client-fetch waterfall (shell → hydrate → fetch `/api/dashboard`
  → render). FCP 2.3s vs LCP 8.0s is the smoking gun; TBT is fine.
- CLS culprit: footer/layout shift when content pops in (`footer.border-t` shift 0.089).
- A11y failures: `aria-allowed-attr`, `button-name` (buttons without accessible names).
- Bundles (`.next/static/chunks`, 3.5 MB total): **ag-grid = 1.06 MB** chunk;
  **recharts ≈ 340 KB appearing in 3 separate chunks** (duplicated per route);
  next-largest 219 KB.

### 0.5 Data sources (all real; what's hardcoded is identity metadata)

- **Morpho GraphQL** `api.morpho.org/graphql`, unauthenticated — vaults, transactions,
  reallocations, positions, markets, liquidations (`src/lib/graphql/`).
- **Turtle Earn API** `earn.turtle.xyz/v1`:
  - Unauthenticated `/opportunities` for ingestion (`src/lib/turtle/client.ts`).
  - Authenticated (`Bearer pk_live_…` via `NEXT_PUBLIC_TURTLE_API_KEY`) browser client
    for the deposit flow (`src/lib/turtle/earn-client.ts`): distributor opportunities,
    SIWE membership, deposit build, `actions/verify`, distributor deposits.
  - `tsn83sYR` (`NEXT_PUBLIC_TURTLE_DISTRIBUTOR_ID`) is injected at membership
    registration, deposit creation, attribution verification, and the deposits
    tracker. Attribution path is wired end-to-end and was flight-tested in prod.
- **No direct Aave/Euler/Compound/Spark integrations.** Those protocols appear only
  via Turtle opportunities (and in marketing copy). Flagged honestly below.
- Hardcoded identity layers (the known debt): `curator-aliases.ts` (5 alias groups +
  5 vault overrides), `curator-data.ts` (12 manual profiles + ~15 manually dated
  news items — staleness risk), `turtle/known-curators.ts` (6 allowlisted `tc:`
  curators + protocol denylist). `ALLOW_MOCK_BLEND` chart synthesis exists but is
  **off by default**. No fabricated APYs/TVLs anywhere else.

### 0.6 Curator → Vaults → Deals data model

Strong: Curator↔Vault (FK, bidirectional), Vault↔Snapshots/Changes,
Curator↔Snapshots/PlatformAlerts.

Weak or missing — this is the core gap for Phases 3–4:

1. **Vault ↔ Deal is disconnected.** `/deposit` fetches live distributor
   opportunities and never joins them to DB Vault rows. Turtle-sourced vaults carry
   `turtleId` (opportunity UUID) so a join exists in principle; Morpho-sourced vaults
   have no opportunity linkage at all. Same entity can appear twice, described two ways.
2. **Deposits are never persisted** — the tracker polls the Earn API live; no DB
   model, no per-curator/per-vault deposit history.
3. **Curator duplication risk** across pipelines: Morpho curators keyed `0x…`,
   Turtle-only curators keyed `tc:<slug>`; matching is name-based.
4. **Alerts lack vault drill-down** (`PlatformAlert.curatorId` only, no `vaultId`).
5. **Curator news/profiles are hardcoded** and will silently go stale.

---

## Proposed plan

Recommended order: **1 → 2 → 3 → 4**, with one amendment — the canonical
vault↔opportunity mapping layer (3a) starts alongside Phase 2, since it's pure
data-layer work and Phase 2's "deals on the curator page" lands faster if the
mapping is already ingesting.

### Phase 1 — Clean and fast (perf/a11y to ≥95)

1a. **Server-render the data pages.** Convert `/`, `/curator/[address]`,
    `/vault/[address]`, and the lens pages to server components fetching from the
    DB directly, with ISR aligned to the data cadence: `revalidate` plus
    **on-demand `revalidatePath()` fired at the end of each cron run** — pages serve
    cached HTML and refresh exactly when data refreshes. Kills the 8s LCP waterfall.
    Interactive islands (sorting, tabs, tracking) stay client components fed by
    server props.
1b. **Bundle surgery.** Lazy-load ag-grid (1.06 MB) and recharts (~340 KB ×3 dup)
    behind `next/dynamic` with skeletons; ensure wallet/deposit code loads only when
    a deposit flow opens; dedupe the recharts chunks; remove dead deps.
1c. **CLS + skeletons.** Reserve layout for async content (fix the footer shift);
    real content-shaped skeletons for curator and deals views.
1d. **A11y fixes**: `button-name`, `aria-allowed-attr`, then sweep to ≥95.
1e. **Fonts/images**: self-host + subset fonts, `next/image` audit.
1f. Re-run Lighthouse; record before/after here. Verify cadence + attribution intact.

### Phase 2 — Curator as the hub

2a. **Track record**: AUM + vault-count history from `CuratorSnapshot`, per-vault APY
    history from `VaultSnapshot` — real data only, honest about history depth.
2b. **Managed vaults table**: all vaults across sources, comparable at a glance
    (asset, protocol, TVL, yield, fees, grade/risk signals).
2c. **Inline lenses**: per-curator yields/fees/liquidations modules on the profile
    (reusing the lens queries scoped by curatorId), so /yields /fees /liquidations
    become views of the same tools.
2d. **Per-curator changelog/alerts**: join `VaultChange` (via vaults) +
    `PlatformAlert` into one timeline on the profile; add `vaultId` to PlatformAlert
    for drill-down (additive migration).
2e. **Curator comparison** view (pick 2–4, compare AUM, yield dist., fees, risk, tenure).
2f. Education layer: "what is a curator" intro woven into the home + profile pages.

### Phase 3 — Deals and returns, reconciled

3a. **Canonical mapping layer** (can start during Phase 2): ingest distributor
    opportunities (`/opportunities/distributors/tsn83sYR`) in the Turtle cron; match
    to Vault rows — by `turtleId` for Turtle-sourced vaults, by vault contract
    address/chain for Morpho-sourced ones where the opportunity exposes it; persist
    as a `dealOpportunityId` (or join table) + `depositable` flag. Unmatched
    opportunities get logged, never silently dropped; vaults without a deal say
    "not available as a deal" honestly.
4b. **Persist attributed deposits**: small `DepositRecord` model fed by cron from
    `GET /v1/deposit/tsn83sYR` — gives deposit history per curator/vault.
3c. **Deals on curator + vault pages**: side-by-side returns comparison across a
    curator's depositable deals (current + historical from our own snapshots),
    asset, protocol, source of yield.

### Phase 4 — Deposit woven into the workflow

4a. **Extract the deposit panel** from `/deposit` into a reusable component (modal/
    drawer) that takes a canonical deal and opens from any deal card; wallet code
    stays lazy-loaded.
4b. **Wallet UX**: graceful connect flow (no "no Ethereum wallet detected" dead end),
    explain steps (connect → sign membership → approve → deposit), chain display +
    switch, clean mobile/no-wallet degradation.
4c. **Context at the moment of action**: curator, vault, deal, return, asset shown in
    the confirmation — the deal researched is the deal deposited.
4d. **End-to-end attribution verification** on a real deposit (existing
    `actions/verify` path) from a curator-page entry point. `/deposit` stays as the
    full deals index.

### Guardrails (standing)

- 6h cadence and `tsn83sYR` attribution untouched; no route breaks; real data only —
  honest empty states; a11y + mobile parity on every new view; small reviewable
  commits on a branch off `main`; Lighthouse re-run after each phase, recorded here.

### Flags / decisions needed from Austin

1. **Multi-protocol claim**: direct Aave/Euler/Compound/Spark ingestion doesn't
   exist (only via Turtle). Treating new protocol integrations as **out of scope**
   for this engagement unless you say otherwise.
2. `/deposit` is feature-flagged — confirm the flag stays on in prod throughout.
3. RLS is still disabled on all public tables (Supabase critical advisor) — separate
   security item, not in this plan, but it shouldn't be forgotten.
4. Untracked repo strays (0.1) — tell me which to keep/ignore.

---

## Phase 1 results (2026-06-09)

Measured with Lighthouse mobile emulation. Baseline = production; "after" =
local `next start` (no CDN/H2 edge — prod numbers should come in better; verify
on the Vercel preview before merge).

| Metric | Home before (prod) | Home after (local) | Curator before | Curator after |
|---|---|---|---|---|
| Performance | 60 | **90** | 62 | **92** |
| Accessibility | 89 | **100** | 91 | **96→100 expected**¹ |
| Best practices | 100 | 96² | 100 | 96² |
| SEO | 100 | **100** | 100 | **100** |
| LCP (simulated) | 8.0s | **3.5s** | 7.6s | **3.4s** |
| FCP | 2.3s | **0.9s** | 2.3s | **0.9s** |
| CLS | 0.089 | **0** | 0.089 | **0** |
| JS transferred | 408KB | **259KB** | 307KB | **159KB** |

¹ the remaining contrast failure (risk-profile labels) was fixed after the last
measured run. ² localhost-only: the Vercel Analytics script 500s off-platform.

What landed (10 commits, each building + smoke-tested):
- **ISR everywhere it matters**: `/`, `/curator/[address]`, `/vault/[address]` are
  server components rendering from the DB with `revalidate = 21600`, per-path
  caching (`generateStaticParams([])`, verified MISS→HIT), and **cron-triggered
  `revalidatePath()`** after every collection — served HTML now refreshes exactly
  when data does. Detail queries extracted to `lib/curator-detail.ts` /
  `lib/vault-detail.ts`; API routes delegate to them (no behavior change).
- **731KB favicon eliminated** — metadata.icons pointed at the raw 1024px logo;
  file-convention icons (2.9KB) now serve.
- **Eager nav prefetch removed** (9 route payloads were fetched on every load) and
  the homepage TVL chart (recharts, ~200KB) mounts only when scrolled into view.
- **Fonts self-hosted**: Cabinet Grotesk via next/font/local (was a render-blocking
  Fontshare stylesheet); unused 500 weight dropped.
- **A11y**: aria-labels on icon-only nav buttons, invalid `aria-sort` →
  `aria-pressed`, contrast fix on 10px muted labels.
- **SEO**: robots.ts; per-curator and per-vault generateMetadata (real titles/
  descriptions on every detail page).
- Curator + vault loading skeletons; unused `svix` dependency removed.

Notes / residual:
- LCP <2.0s target: local next start serves HTTP/1.1 without CDN; remaining gap is
  mostly fonts+JS on a simulated 1.6Mbps link. Re-measure on the Vercel preview —
  if still >2.0s, next levers are font `display: optional` (design tradeoff — ask
  Austin) and trimming the hydration payload of CuratorIndex.
- `/` is now prerendered at build → builds need a reachable DATABASE_URL.
- Lens pages (/yields /fees /liquidations /calculator /alerts) still client-fetch;
  they're Phase 2 material (they become curator-scoped lenses anyway).
- The repo sits in an iCloud-synced Desktop folder; sync keeps minting
  `.next/types/routes.d 2.ts` duplicates that intermittently break `tsc`. Consider
  moving the repo out of Desktop or excluding `.next/` from sync.

## Status log

- 2026-06-09 — Phase 0 audit complete; baseline recorded; plan approved.
- 2026-06-09 — Phase 1 implemented on `phase1-clean-fast` (10 commits); local
  verification done; awaiting preview-deploy verification + merge approval.

# Applying the loss-anchored EL curator grades (beta)

Built on branch `feat/risk-engine-grades`. **Nothing is live or deployed.** The grade
renders only when `NEXT_PUBLIC_FEATURE_RISK_GRADES=true` AND a `CuratorRating` row
exists for that curator. It coexists above the existing 7-factor profile (nothing
removed). These are the explicit, operator-run steps to ship it.

## 1. Create the tables (additive, 0 destructive ops)

The repo uses `prisma db push`. The change is two new standalone tables
(`CuratorRating`, `VaultRating`) — the Curator/Vault models are untouched. SQL preview:
`prisma/manual-sql/2026-06-10-add-risk-engine-ratings.sql`.

```bash
npx prisma db push          # creates CuratorRating + VaultRating on the DB in DATABASE_URL
```
Reversible: `DROP TABLE "CuratorRating"; DROP TABLE "VaultRating";`

## 2. Import the ratings

```bash
npx tsx src/scripts/import-risk-engine-ratings.ts
# -> "Imported 21 curator ratings (N matched to site curators, ...), 158 vault ratings."
```
Reads `data/risk-engine/ratings.json`. Curators join to site curators by address; any
unmatched import under the engine address (no page join until a matching Curator
exists) — they are listed in the output, none are dropped.

## 3. Turn on the flag (preview first)

Set `NEXT_PUBLIC_FEATURE_RISK_GRADES=true` in Vercel **Preview**, redeploy, and check a
few curator pages (Steakhouse = A+, MEV Capital = C, Gauntlet = A). Then promote to
**Production** when satisfied. Leaving it unset/`""` keeps the grade hidden in prod.

## 4. Refresh cadence (ratings are slow-moving by design)

The engine (`~/dev/curatorwatch-risk-engine`, Python/PyMC — cannot run in Vercel) is
offline. To refresh:
```bash
# in the engine repo: re-run the pipeline, then
cp outputs/ratings_<run>.json  <this-repo>/data/risk-engine/ratings.json
# in this repo: re-import
npx tsx src/scripts/import-risk-engine-ratings.ts
```
Weekly (or on a material event) is plenty — the curator grade is meant to be durable.
Optionally wire step 2 into the existing collect cron once cadence is settled.

## Honest caveats (carried from the engine)

- Every confidence band is **Wide** (6 events of history) — the component shows this
  prominently; that is a credibility feature, not a bug. Keep the **Beta** badge until
  the data deepens.
- The realized base rate does not yet include Euler/Silo losses (Tier 2 needs a The
  Graph API key). Grades are loss-axis-only and TVL-weighted across the live book.
- Every row is traceable: `methodologyVersion` / `schemaVersion` / `modelGit` /
  `generatedAt` are stored and shown.

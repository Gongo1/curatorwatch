# Personalized digest (v2) — gap map + build plan

The "your watched curators moved today" edition is build-order item 5 and the one
piece that genuinely **needs accounts**. This documents what exists, what's missing,
and the minimal path — so the identity decision can be made before any code.

## What ships today (no accounts)

- **Watchlist** is device-local: `usePortfolio()` persists `{trackedVaults:[{address,name}],
  trackedCurators:[{id,name}]}` to `localStorage["cw-portfolio"]`. No server, no auth.
- **Personalized alerts already work** client-side: the `/alerts` "My Alerts" tab passes the
  localStorage watchlist to `/api/changes?vaultAddresses=&curatorIds=` (the route already
  filters by them).
- **Personalized digest preview** (this session): `src/lib/digest/personalize.ts` +
  `PersonalDigestPanel` on `/digest` highlight which of today's top movers / concentration
  flags involve the user's tracked curators — powered entirely by the localStorage watchlist.

## What's missing for the full delivered edition

1. **Durable, per-user watchlists.** `User`/`TrackedVault`/`TrackedCurator` models exist but are
   Clerk-shaped (`User.clerkId`, Tracked* FK → `User.clerkId`) and 100% unused (0 rows). The
   `/api/track-vault` + `/api/track-curator` routes are no-op stubs ("Tracking disabled without
   auth"). Nothing reads/writes these tables.
2. **An identity.** No auth dependency is installed (no Clerk/next-auth/SIWE/wagmi). A "user" is
   not a wallet or a login anywhere.
3. **A per-user build pass.** Today's `DigestData` carries only the global top-5 movers, so the
   preview can only match watched curators that land in the top movers. The full edition needs a
   build that queries each user's tracked set directly (reusing the same `/api/changes` filter or
   a personalized `buildDigest` variant), independent of global rank.
4. **A delivery channel.** No email transport (no resend/nodemailer/etc.). `User.email` exists but
   is unused.

## Decision required (Austin)

**Identity model** — pick one before writing rows:
- **Wallet (SIWE)** → a "user" = wallet address. Fits the audience; no email needed; but digests
  can only be in-app/feed, not delivered.
- **Email / magic-link** → digests are deliverable; matches the existing `User.email` field; needs
  an email transport dep.
- **Anonymous device id** → cheapest server-sync of the existing localStorage watchlist (claim on
  later sign-up), but no delivery.

`TrackedCurator` is also misnamed: the column is `curatorAddress`, but the UI stores `curator.id`
(cuid). Reconcile the key when wiring persistence.

## Minimal v2 plan (once identity is chosen)

1. Replace `User.clerkId` with the chosen identity field; point Tracked* FKs at it.
2. Make `/api/track-*` persist (upsert/delete a row for the caller's identity); `GET` returns the
   caller's list. Add an optional server-sync path in `usePortfolio` (hydrate from the API when
   signed in, mirror mutations; keep localStorage as the anonymous fallback).
3. Add `/api/cron/digest/personal` (or extend the digest cron): for each user, run the
   `vaultAddresses in / curatorId in` query over the last 24h and render a per-user digest via the
   existing `personalizeDigest` + `render` modules.
4. Add an email transport (only if the email/magic-link identity is chosen) and send.

The engine (`personalizeDigest`, the deterministic renderer, the alert filter) is already in place
— v2 is identity + persistence + a per-user build loop, not new analytics.

## Known limitation (preview)

`personalizeDigest` matches flows by `curatorId` (correct) but matches concentration flags by
the curator's **display name**, because the localStorage watchlist stores only `{id, name}` and a
concentration flag carries `{topCuratorAddress, topCurator(name)}` — no shared id. So a dominant
curator with a null `name` won't surface in the concentration slice (a narrow corner: it needs
≥84% of a ≥$50M stablecoin asset *and* a null directory name). When the watchlist gains durable
rows in v2, store the curator **address** and match concentration on `topCuratorAddress` (also
avoids same-name collisions).

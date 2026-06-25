---
name: curator-disclosure
description: "Add or update a material off-chain disclosure (litigation, regulatory action, governance/fraud event) for a tracked curator, and surface it on the product. Use when given a news article, court filing, SEC/EDGAR link, or press release about a curator and asked to flag it, post a disclosure, 'update the product', or reflect a legal/regulatory event. Codifies the RockawayX (Brera/Solmate suit + SEC 13(d)) workflow."
version: 1.0.0
---

# Curator Disclosure

Turn a news/legal/regulatory event about a tracked curator into a live, sourced
disclosure on CuratorWatch — the on-chain Expected-Loss engine cannot price off-chain
events (litigation, regulatory action, governance/fraud), so we surface them as
human-verified disclosures that **withhold the letter grade and show a flag instead**.

This skill operates on the `morpho-vault-analytics` repo (app + prod DB) and, when the
curator is general-DeFi research, the Obsidian KB at `KB/DeFi/wiki/curators/`.

## Inputs

- A **primary source**: SEC/EDGAR URL, court filing, regulator notice, or a reputable
  news article. (Pasted text is OK if no URL.)
- The **curator** it concerns (resolve it if not stated).

## Hard rules (read first)

1. **Primary source required.** Never publish a disclosure off a rumor or a single
   low-quality blog. Prefer the filing/regulator/issuer; news is corroboration.
2. **Allegations are allegations.** If it's an unproven claim (complaint, demand
   letter, investigation), say so explicitly in the disclosure text. Do not assert
   guilt. This is a public, defamation-sensitive surface.
3. **Human approves before deploy.** Generate the change, show it, get explicit
   go-ahead before merging/deploying or writing to the prod DB. (Austin's rule:
   audit → plan → approval → execute; explicit approval before anything deploy-affecting.)
4. **Targeted.** Touch only the curator in question. Do not re-run the rating engine
   or re-import all ratings (a full re-fit moves other curators — see the RockawayX
   re7-labs spillover in `KB/CuratorWatch/wiki/technical/rating-engine-operations.md`).

## Procedure

1. **Read the source.**
   - SEC/EDGAR blocks generic fetchers — use curl with a UA:
     `curl -s -A "CuratorWatch Research <email>" "<url>"` then strip tags.
   - News: WebFetch is fine.
   - Extract: parties (who sued/charged whom), the curator legal entity, claims/counts,
     court or regulator, filing date, dollar amounts (note if redacted), and whether it's
     an allegation vs a finding.

2. **Resolve the curator → address.** Query prod: `select id, address, name from "Curator"
   where lower(name) like '%<x>%'`. The disclosure map is keyed by the lowercased 0x
   address (or `tc:<slug>`). Helpers: `src/lib/curator-aliases.ts`.

3. **Write the disclosure entry** in `src/lib/curator-disclosures.ts`
   (`CURATOR_DISCLOSURES[address]`), schema:
   ```ts
   { title, detail, date /* ISO */, sourceUrl, sourceTitle, severity: "warning" | "critical" }
   ```
   `detail` = 1–3 neutral sentences with the allegations caveat + a line noting the EL
   grade reflects on-chain channels only. This alone makes every grade surface render a
   **"Flagged"** indicator + "View disclosure" link instead of the letter (profile,
   `/ratings`, directory, `/compare`) via `hasCuratorDisclosure()` + `<DisclosureFlag>`,
   and renders the banner on the profile (`<CuratorDisclosureBanner>`).

4. **Decide the rating impact (optional).** The disclosure flag already hides the letter.
   If you also want the engine to reflect it:
   - Engine source of truth: add the curator to `data/curated/behavioral.json` (in the
     `curatorwatch-risk-engine` repo) with `diligence_conflict: true` + provenance
     (so the next full re-fit penalizes EL). Note: this rarely moves the *letter* for a
     clean on-chain book (RockawayX: EL 2.16→8.48 bps, still A+).
   - For an immediate visible EL bump without a full re-fit: bump the curator's entry in
     the bundled `data/risk-engine/ratings.json` AND do a **targeted single-row** update
     of its `CuratorRating` prod row (`elMedian`, `elCi*`, `pLossAnnual`, `channels`,
     `flags.diligence_conflict`). Leave grade as-is. Never touch other rows.

5. **Update the KB** (if the curator is general-DeFi research):
   - `KB/DeFi/wiki/curators/<slug>.md` (create or extend) with the event + source link;
     update `_directory.md`, `index.md`, `_summaries.md`.
   - Note the product treatment in `KB/CuratorWatch/wiki/technical/rating-engine-operations.md`.

6. **Ship (with approval).** Branch → `npx tsc --noEmit` (ignore stale `.next/* 2.ts`
   dupes) → `npm run build` → PR → merge to `main` (Vercel auto-deploys). If you bumped
   the EL, do the targeted prod-DB row update so it shows immediately (pages read the DB;
   the `collect` cron also re-upserts `ratings.json` post-deploy).

7. **Verify live** with a cache-busted URL (`/curator/<slug>?cb=1`): confirm the flag +
   banner render and the letter grade is withheld.

## Reference implementation

The RockawayX case (June 2026) is the worked example end-to-end:
`KB/CuratorWatch/wiki/technical/rating-engine-operations.md` (the "RockawayX governance
flag" callout) and PRs #7 (disclosure + EL bump) and #8 (grade→flag display).

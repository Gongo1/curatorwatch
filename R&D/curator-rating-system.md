# Curator Rating System — R&D

## Objective

Build a curator-level risk and trust rating for CuratorWatch. No one in the market rates curators — everyone rates vaults or assets. This is our differentiator.

> "Credora tells you if a vault is safe. CuratorWatch tells you if the person managing it is trustworthy."

---

## Market Landscape: Existing Vault/Asset Rating Systems

### Credora (by RedStone)
- **What they rate:** Vaults + Markets on Morpho and Spark
- **Scale:** A+ to D
- **Methodology:** 3-layer assessment (Collateral → Market → Vault)
  - **Collateral:** Off-chain and on-chain risks for stablecoins, wrapped tokens, LSTs, LRTs
  - **Markets:** Simulations on active loans using collateral risk, volatility, liquidity, oracle risk, protocol risk
  - **Vaults:** Curator's Morpho experience/track record, depositor protection configs (guardians, timelocks)
- **Scoring:** Probability of Default (PD) for collateral/assets, Probability of Significant Loss (PSL) for markets/vaults
- **Process:** Consensus-based — qualified analysts from Jump Crypto, GSR, XBTO provide inputs; system derives consensus scores
- **Automation:** >90% automated, dynamic (reacts to live market conditions)
- **Key insight:** Rated vaults grow 25% faster than unrated ones
- **Sources:**
  - https://docs.redstone.finance/docs/redstone-credora/methodologies/defi-rating-scale/
  - https://forum.morpho.org/t/credora-network-risk-ratings-on-morpho/1652
  - https://blog.redstone.finance/2025/11/06/redstone-brings-credora-to-market-following-acquisition-introducing-defi-risk-ratings-to-morpho-and-spark/
  - https://blockworks.co/news/credora-crypto-risk-rating-system

### Steakhouse Financial (Internal Framework)
- **What they rate:** Collateral/Markets for their own vault curation decisions
- **Scale:** AA (1) to C (6)
- **Methodology:** 3-layer, worst-case aggregation (final rating = lowest score across all layers)
  - **Layer 1 — Asset Rating:** Issuer Risk (social, decentralization, technical), Credit Risk (qualitative), Operational Risk (Lindy, audit coverage, economic transparency)
  - **Layer 2 — Platform Rating:** Issuer Risk, Operational Risk (no credit risk — purely on-chain smart contract interactions)
  - **Layer 3 — Market Rating:** Oracle quality, Liquidity, Credit Enhancement (price fluctuation + LLTV bonus)
- **Product tiers:** AA/A = Prime eligible, BB/B = High Yield eligible, CC = constrained, C = excluded
- **Key insight:** Upstream risk mitigation philosophy — reject bad collateral rather than manage bad positions. "Constant open lines with issuers is a non-negotiable threshold."
- **Battle-tested:** Largest Morpho curator (~$1.45B), processed $108.5M in liquidations in a single day (Feb 2026)
- **Limitation:** Internal tool, not a public rating service. Rates markets/collateral, not vaults or curators.
- **Sources:**
  - https://www.steakhouse.financial/docs/risk-management
  - https://www.steakhouse.financial/docs/risk-management/collateral/layers-pillars-and-criteria
  - https://www.steakhouse.financial/docs/risk-management/collateral/final-market-rating
  - https://www.steakhouse.financial/docs/risk-management/collateral/layers-pillars-and-criteria/asset-rating-layer-1
  - https://www.steakhouse.financial/docs/risk-management/collateral/layers-pillars-and-criteria/platform-rating-layer-2

### Gauntlet (VaultBook)
- **What they rate:** Their own vaults across Morpho, Drift, Symbiotic
- **Scale:** A+ to D (also tiered as Prime / Core / Frontier)
  - **Prime:** Conservative, low-risk yields, minimal insolvency risk even under extreme conditions
  - **Core:** Blend of large and lower-cap collateral, bounded exposure per asset
  - **Frontier:** Higher volatility markets, greater liquidity risks, higher potential returns
- **Methodology:** Agent-Based Simulations (ABS) modeling market scenarios and user interactions; risk-adjusted yield optimization
- **Coverage:** 40+ curated vaults, $700M+ AUM
- **Limitation:** Only rates their own vaults. Not a general-purpose rating.
- **Source:** https://www.gauntlet.xyz/resources/introducing-the-gauntlet-vaultbook-demystifying-vault-curation

### Webacy (Depeg Monitor)
- **What they rate:** ERC-4626 vault smart contracts on Ethereum
- **Scale:** 0-100 numeric + confidence metric (90%+ = verified)
- **Methodology:** Automated smart contract scanning
  - Code vulnerabilities (reentrancy, integer overflow, access control)
  - Contract structure (upgradeability, proxy patterns, admin key risks)
  - Deployer reputation (historical behavior)
  - Protocol risk labels (Negligible → Blacklisted)
  - Market signals (TVL outflows, inactivity, depeg indicators)
- **Coverage:** 1,977+ verified vaults
- **Unique features:** "Graveyard" for failed vaults, "Freeze Intelligence"
- **Limitation:** No economic/financial risk. No collateral quality, LLTV, oracle, or curator assessment.
- **Source:** https://depeg-monitor.webacy.co/vaults

### Particula (PDARF)
- **What they rate:** Asset-backed tokens (tokenized treasuries, structured/wrapped/vault tokens)
- **Scale:** AAA to D with +/- modifiers
- **Methodology:** 3-pillar, rules-based, data-driven
  - **Counterparty Risk:** Issuer and stakeholder creditworthiness
  - **Structural Risk:** Token design, smart contract integrity, blockchain infrastructure
  - **Underlying Asset Risk:** Quality and composition of backing assets
- **Process:** 4-6 week assessment, continuous monitoring, quarterly reviews minimum
- **Key features:** Trend detectors, red flags, near real-time on-chain monitoring
- **Excludes:** Speculative, algorithmic, or utility tokens without verifiable asset backing
- **Source:** https://particula.io/risk-ratings

### Philidor Analytics
- **What they rate:** Protocols
- **Methodology:** On-chain state only, automated, same methodology for every protocol
- **Source:** https://analytics.philidor.io/

---

## Gap Analysis: Why Curator Ratings

| Dimension | Credora | Steakhouse | Gauntlet | Webacy | Particula | CuratorWatch |
|-----------|---------|------------|----------|--------|-----------|-------------|
| Vault-level risk | Yes | Partial | Yes (own) | Yes | Yes | **No (not needed)** |
| Collateral quality | Yes | Yes | Yes | No | Yes | No |
| Smart contract security | No | No | No | Yes | Partial | No |
| **Curator trustworthiness** | **Partial** | **No** | **No** | **No** | **No** | **Target** |
| Curator track record | Minimal | No | No | No | No | **Yes (have data)** |
| Curator economics | No | No | No | No | No | **Yes (have data)** |
| Cross-protocol view | No | No | Partial | Ethereum only | No | **Yes (10+ protocols)** |
| Fee transparency | No | No | No | No | No | **Yes (have data)** |

**Key insight:** Everyone rates the vault or the asset. Nobody systematically rates the entity managing it.

---

## Proposed Curator Rating Framework

### Dimensions (7 pillars)

| # | Dimension | What it measures | Data source | Status |
|---|-----------|-----------------|-------------|--------|
| 1 | **Risk Management Quality** | Do their vaults get good external ratings? Average Credora/Gauntlet grades across vaults | Credora ratings (public on Morpho) | Need to ingest |
| 2 | **Track Record** | AUM growth trajectory, time in market, historical stability | CuratorWatch snapshots | Already have |
| 3 | **Operational Maturity** | Regulated entity, team size, jurisdiction, legal name, entity type | Curator profile fields | Already have |
| 4 | **Transparency** | Public website, Twitter/X presence, documentation, communication | Curator profile fields | Already have |
| 5 | **Performance** | Weighted APY across vaults, fee fairness vs peers, net-to-LP ratio | CuratorWatch economics | Already have |
| 6 | **Diversification** | Multi-chain, multi-asset, multi-protocol spread | Vault data | Already have |
| 7 | **Stress Resilience** | Liquidation history, bad debt events, behavior during market stress | Liquidation records | Already have |

### Piggybacking on Public Vault Ratings

Rather than building our own vault-level risk engine (which Credora/Webacy already do better), we can:

1. **Ingest Credora ratings** for Morpho vaults (publicly displayed on Morpho UI)
2. **Aggregate vault ratings per curator** — a curator whose vaults are mostly A/A+ scores higher than one with B/C vaults
3. **Use vault ratings as ONE input** to the curator score, not the whole score

This gives us institutional-grade vault risk data without building simulation infrastructure.

### Rating Scale (TBD)

Options to evaluate:
- **Letter grades** (A+ → D) — familiar, matches Credora/Steakhouse/Gauntlet conventions
- **Numeric** (0-100) — more granular, like Webacy
- **Tier-based** (Institutional / Established / Emerging / Unverified) — more descriptive, less judgmental
- **Hybrid** — letter grade + descriptive tier label

### Aggregation Method (TBD)

Options:
- **Worst-case** (Steakhouse approach) — final = lowest pillar score. Conservative but harsh.
- **Weighted average** — different weights per dimension. More nuanced but weights are subjective.
- **Tiered floor** — must meet minimum in each dimension, then weighted average for final grade.

---

## Open Questions

1. Should the rating be fully automated or include manual review?
2. How do we handle curators with mixed Morpho + Turtle vaults (Credora only covers Morpho)?
3. Should we publish methodology publicly (builds trust) or keep it proprietary?
4. Do we let curators dispute/appeal ratings?
5. How often should ratings update? (Real-time vs daily vs weekly)
6. Should we weight recent performance more heavily than historical?
7. Legal considerations — are there regulatory implications of publishing credit-like ratings?

---

## Reference Reading

- [Evaluating DeFi Vault Curators — Phemex](https://phemex.com/news/article/evaluating-defi-vault-curators-key-considerations-48441)
- [DeFi Curators in 2025: Navigating Chaos — Chorus One](https://chorus.one/reports-research/defi-curators-in-2025-navigating-chaos-building-resilience)
- [Identifying Curators: Safeguarding or Gatekeeping DeFi?](https://medium.com/@kaishinaw/identifying-curators-safeguarding-or-gatekeeping-defi-ec5f24bc92af)
- [Curators: The Guardians of Decentralization — OAK Research](https://oakresearch.io/en/analyses/investigations/curators-guardians-decentralization-defi)
- [Institutionalizing Risk Curation in Decentralized Credit — arXiv](https://arxiv.org/html/2512.11976v1)

---

---

## Implemented Methodology (v1 — Live)

### Overview

The live rating system uses a **relative peer comparison** model with a weighted additive score. Each curator starts at 50/100 and is adjusted up or down by 8 independent factors. The final score maps to a letter tier (AAA–CCC).

This is intentionally **curator-level**, not vault-level. We rate the entity, not the product.

### Scoring Model

**Base score:** 50 (median)
**Range:** 0–100 (clamped)

| Factor | What it measures | Max bonus | Max penalty | Data source |
|--------|-----------------|-----------|-------------|-------------|
| 1. Bad Debt History | Actual losses from events like Stream Finance collapse | +20 (zero bad debt w/ 12mo+ track record) | -45 (catastrophic) | Hardcoded known events |
| 2. Time in Operation | How long the curator has been active | +15 (24mo+) | -20 (<3mo) | `foundedYear` field, falls back to DB `createdAt` |
| 3. Collateral Quality | Blue-chip vs exotic/synthetic collateral in lending markets | +15 (blue chip only) | -25 (>50% exotic) | MarketAllocation data (skipped if no data) |
| 4. APY vs Peers | Ponzi detector — flags yields far above peer average | — | -30 (2x+ peers) | VaultSnapshot APY data |
| 5. ~~Concentration Risk~~ | ~~Single-position exposure~~ | ~~+10~~ | ~~-20~~ | **DISABLED** — adapter data is 1 entry per Morpho vault (100%), not meaningful |
| 6. Governance & Legal | Regulated entity, registered legal name, jurisdiction | +20 (regulated + legal entity) | -5 (no legal entity) | Curator profile fields |
| 7. Scale | Total AUM relative to DeFi market | +15 ($500M+) | -10 (<$1M) | `totalAssetsManaged` |
| 8. Vault Count | Operational breadth | +5 (5+ vaults) | -5 (single vault, <$10M) | Vault count |
| 9. AAA Benchmark | Known industry leaders (Gauntlet, Steakhouse, Block Analitica) | +10 | — | Hardcoded list |

### Tier Thresholds

| Tier | Min Score | Allocation Guidance |
|------|-----------|-------------------|
| AAA | 85 | $10M+ institutional allocations |
| AA | 75 | $1M–10M allocations |
| A | 65 | $250k–1M allocations |
| BBB | 50 | $100k–250k with monthly review |
| BB | 35 | <$100k for risk-tolerant only |
| B | 20 | Test allocation only (<$25k) |
| CCC | 0 | ZERO — Do not allocate |

### Known Limitations & Data Gaps

**1. `foundedYear` is missing for many curators**
Curators without `foundedYear` fall back to `createdAt`, which is when they were added to CuratorWatch's DB (Feb 2026 for most). This causes `VERY_NEW_CURATOR` false positives for established curators like Sky (Maker), KPK, Telos, etc. **Fix:** Populate `foundedYear` for all curators.

**2. Market allocation data is sparse**
Only a handful of Morpho vaults have `MarketAllocation` records. Turtle-protocol vaults have none. When there's no data, the collateral quality factor is skipped entirely (neutral). **Fix:** Ensure the hourly cron collects market allocations for all Morpho vaults.

**3. Concentration factor is disabled**
`AdapterAllocation` data shows 1 entry per Morpho vault at 100% (the vault itself). This is architecturally correct — Morpho vaults are single-adapter — but useless for concentration analysis. Real diversification is at the market level. **Fix:** Re-enable when market allocation data is comprehensive, using market-level concentration instead of adapter-level.

**4. `isRegulated` is manually curated and incomplete**
Steakhouse and Gauntlet both have legal entities and jurisdictions but `isRegulated` is false, missing the +15 bonus. **Fix:** Audit and update `isRegulated` for all curators with known regulatory status.

**5. Collateral classification is case-sensitive list matching**
The blue-chip list is maintained manually. New legitimate tokens (e.g., protocol-wrapped variants) need to be added as they appear. The synthetic detection pattern (`xUSD`, `xETH`, etc.) may produce false positives on legitimate tokens with similar naming.

**6. Bad debt is hardcoded, not derived from data**
The system uses a hardcoded map of curator names → known bad debt events (Stream Finance collapse). It does not dynamically detect bad debt from liquidation records. **Fix:** Cross-reference with `LiquidationEvent.badDebtAssetsUsd` data.

### Validation Results (March 3, 2026)

**Test case targets:**
- Gauntlet → AAA ✅
- Steakhouse → AAA ✅
- Re7 Labs → CCC (bad debt) ✅

**Full results:**

| Curator | AUM | Tier | Score | Key Signals |
|---------|-----|------|-------|-------------|
| Sentora | $284M | AAA | 90 | Zero bad debt, veteran (2019), institutional scale |
| Steakhouse Financial | $220M | AAA | 90 | Zero bad debt, veteran (2022), benchmark curator. One red flag: HIGH_EXOTIC_EXPOSURE from sparse collateral data (single vault with ACRDX) |
| Gauntlet | $213M | AAA | 100 | Zero bad debt, veteran (2018), benchmark, legal entity, multi-vault. One minor flag: ELEVATED_YIELD (65% above peers) |
| August Digital | $38M | AAA | 90 | Zero bad debt, veteran (2021), legal entity |
| SUSDf | $151M | BB | 35 | No `foundedYear` → VERY_NEW_CURATOR penalty, no legal entity. Institutional scale bonus partially offsets |
| Sky (Maker) | $101M | CCC | 15 | No `foundedYear`, HIGH_EXOTIC_EXPOSURE, no legal entity. Despite $100M+ AUM |
| Re7 Labs | $13M | CCC | 15 | CATASTROPHIC_BAD_DEBT ($14.7M Stream exposure). Correctly penalized |
| K3 Capital | $33M | CCC | 0 | UNSUSTAINABLE_YIELD (2x+ peer avg), no `foundedYear`, no legal entity |

### Methodology Differences from Proposed Framework

The implemented system (v1) is a subset of the proposed 7-pillar framework from the R&D section above:

| Proposed Pillar | Status in v1 |
|-----------------|-------------|
| 1. Risk Management Quality (Credora ratings) | **Not implemented** — Credora data not yet ingested |
| 2. Track Record | ✅ Implemented (Factor 2 + Factor 1) |
| 3. Operational Maturity | ✅ Implemented (Factor 6) |
| 4. Transparency | **Not implemented** — website/Twitter presence not scored |
| 5. Performance | ✅ Partially (Factor 4 — APY vs peers) |
| 6. Diversification | **Disabled** (Factor 5 — data quality issue) |
| 7. Stress Resilience | ✅ Implemented (Factor 1 — bad debt history) |

### Next Steps

1. **Data quality:** Populate `foundedYear` and `isRegulated` for all curators
2. **Market allocations:** Fix cron to collect comprehensive market allocation data, then re-enable concentration scoring
3. **Credora integration:** Ingest public Credora vault ratings and aggregate per curator (Pillar 1)
4. **Dynamic bad debt:** Derive bad debt from liquidation event records instead of hardcoded map
5. **Transparency score:** Score curators on documentation, communication, and public engagement
6. **Backtesting:** Compare ratings against actual loss events to validate predictive power

*Last updated: March 3, 2026*

# CuratorWatch Documentation

> The Bloomberg Terminal for Institutional DeFi Allocation

**Live:** [curatorwatch.com](https://curatorwatch.com)

---

## Overview

CuratorWatch is the first institutional-grade intelligence platform for DeFi vault curators. We track 47+ curators managing $728M+ across Morpho, Yearn, and Aave protocols, providing real-time risk ratings, change detection, and peer benchmarking.

### Why This Matters

The November 2025 Stream Finance collapse resulted in **$285M in bad debt** spread across curators who accepted synthetic xUSD without proper due diligence. Steakhouse Financial survived with zero exposure due to conservative collateral standards. CuratorWatch encodes those failure patterns into automated monitoring.

### Current Metrics (Feb 2026)

| Metric | Value |
|--------|-------|
| Curators Tracked | 47 |
| Total AUM | $728M+ |
| Vaults Monitored | 70 |
| Transactions Analyzed | 2,161 |
| Alert Types | 4 |

---

## Documentation Index

### Product

- **[Vision](./product/vision.md)** - Mission, problem/solution, 2028 end state
- **[User Flows](./product/user-flows.md)** - Dashboard, curator pages, vault pages, alerts walkthrough
- **[Features](./product/features.md)** - Complete feature breakdown by page
- **[Roadmap](./product/roadmap.md)** - Q1 2026 through 2027+ timeline

### Business

- **[Market Analysis](./business/market-analysis.md)** - Curator business model, $50B+ market opportunity
- **[Competitive Landscape](./business/competitive-landscape.md)** - Why no direct competitors exist, our moats
- **[Monetization](./business/monetization.md)** - Free → Pro ($99/mo) → Institutional ($999-4,999/mo)
- **[Target Customers](./business/target-customers.md)** - Family offices, DAOs, institutional allocators

### Technical

- **[Architecture](./technical/architecture.md)** - Stack: Next.js, Prisma, Supabase, Morpho API, Vercel
- **[Alert Logic](./technical/alert-logic.md)** - 4 alert types with statistical significance thresholds
- **[Risk Scoring](./technical/risk-scoring.md)** - AAA to CCC relative rating methodology
- **[Strategy Classification](./technical/strategy-classification.md)** - 6 archetypes with TradFi analogs

### Research

- **[Stream Finance Case Study](./research/stream-finance-case-study.md)** - Nov 2025 collapse deep dive
- **[Curator Archetypes](./research/curator-archetypes.md)** - 6 strategy types explained
- **[Institutional Adoption](./research/institutional-adoption.md)** - DeFi maturity timeline 2020-2028+

### Marketing

- **[Pitch Deck Outline](./marketing/pitch-deck-outline.md)** - Investor deck structure
- **[One-Pager](./marketing/one-pager.md)** - Single-page product overview
- **[Launch Messaging](./marketing/launch-messaging.md)** - Twitter threads, blog drafts

---

## Quick Links

- **Repository:** [github.com/curatorwatch](https://github.com/curatorwatch)
- **Production:** [curatorwatch.com](https://curatorwatch.com)
- **Morpho API:** [api.morpho.org/graphql](https://api.morpho.org/graphql)

---

## Tech Stack

```
Frontend:     Next.js 16, React 19, TailwindCSS
Backend:      Next.js API Routes, Prisma ORM
Database:     Supabase (PostgreSQL)
Data Source:  Morpho GraphQL API
Hosting:      Vercel
Cron:         Vercel Cron Jobs (hourly collection)
```

---

## Key Concepts

### Curator Rating (AAA → CCC)

Relative peer comparison where Gauntlet and Steakhouse Financial represent the AAA benchmark. Ratings are based on:
- Bad debt history
- Time operating
- Collateral quality
- APY vs peers
- Concentration risk
- Governance/transparency

### Strategy Archetypes

| Archetype | TradFi Analog | Characteristics |
|-----------|---------------|-----------------|
| Quantitative Yield Optimizer | Two Sigma | High reallocation, algorithmic |
| Fixed Income Specialist | PIMCO | Blue-chip focus, conservative |
| Market Maker | Jane Street | Liquidity provision, stable APY |
| Multi-Strategy | Bridgewater | Diversified, opportunistic |
| Passive Index | Vanguard | Set-and-forget, low touch |
| Venture/High-Risk | Andreessen | Exotic collateral, high APY |

### Alert Philosophy

Only fire on statistically significant events (<5% frequency):
- APY changes >20% from 7-day average
- Flows >10% of vault TVL
- Concentration increases >15pp
- Lifecycle events (new vaults, curator changes)

---

## Contact

For questions about this documentation or CuratorWatch:
- Twitter: [@curatorwatch](https://twitter.com/curatorwatch)
- Email: team@curatorwatch.com

# CuratorWatch Vision

> Building the institutional infrastructure layer for DeFi capital allocation

---

## Mission Statement

**Enable institutional capital to flow into DeFi safely by providing the same quality of manager due diligence that exists in traditional finance.**

---

## The Problem

### DeFi Has a Trust Problem

Institutional allocators managing $50B+ in DeFi-adjacent capital face a critical challenge: **no standardized way to evaluate vault curators**.

Consider the November 2025 Stream Finance collapse:
- $285M in bad debt created overnight
- 6+ curators exposed with varying severity
- No early warning system existed
- Allocators discovered exposure via Twitter

### Current State of Curator Due Diligence

| What Institutions Need | What Currently Exists |
|------------------------|----------------------|
| Standardized risk ratings | Nothing |
| Real-time position monitoring | Manual Etherscan checks |
| Peer performance comparison | Scattered dashboards |
| Alert systems for changes | Twitter rumors |
| Historical track record data | Curator self-reporting |

### The Trust Gap

```
Traditional Finance          DeFi Today
─────────────────────────    ─────────────────────────
Morningstar ratings          ???
Bloomberg terminals          DefiLlama (protocol-level)
SEC filings                  ???
Audited track records        Self-reported APYs
Manager due diligence        Twitter reputation
```

---

## The Solution

### CuratorWatch: Bloomberg Terminal for DeFi Curators

We aggregate, normalize, and analyze curator behavior to provide:

1. **Real-time Risk Ratings (AAA → CCC)**
   - Relative peer comparison (not absolute TradFi standards)
   - Based on actual failure patterns (Stream Finance, Rari, Cream)
   - Updated with every on-chain action

2. **Change Detection & Alerts**
   - APY changes >20% from moving average
   - Large flows (>10% TVL)
   - Concentration increases (>15pp)
   - New vault launches, curator changes

3. **Strategy Classification**
   - 6 archetypes mapped to TradFi analogs
   - Observable behavior-based (not self-reported)
   - Helps allocators find managers matching their mandate

4. **Institutional Reports**
   - Board-ready PDF exports
   - Audit trail for compliance
   - White-label for fund administrators

---

## Why Now?

### Market Timing

| Year | Event | Implication |
|------|-------|-------------|
| 2020-2022 | DeFi Summer, exploits | Retail experimentation phase |
| 2023-2024 | Bear market, consolidation | Survivors = quality curators |
| 2025 | Stream Finance collapse | Proved need for monitoring |
| 2026 | Institutional infrastructure | **Our entry point** |
| 2027-2028 | Mainstream adoption | First-mover advantage |

### Convergence of Factors

1. **Curators are professionalizing** - Steakhouse raised $4M, Gauntlet is a $1B+ business
2. **Institutions are entering** - BlackRock, Fidelity, family offices exploring DeFi yield
3. **Regulation is clarifying** - MiCA in EU, SEC guidance emerging
4. **Infrastructure is maturing** - Morpho V2, EigenLayer, restaking protocols

---

## 2028 End State Vision

### What Success Looks Like

**CuratorWatch is the default due diligence layer for institutional DeFi allocation.**

```
Institutional Allocator Journey (2028)
───────────────────────────────────────
1. Receive curator pitch
2. Check CuratorWatch rating (like checking Morningstar)
3. Review strategy classification (Fixed Income? Quant?)
4. Analyze historical performance vs peers
5. Set up alerts for position changes
6. Generate quarterly board reports
7. Adjust allocation based on rating changes
```

### Key Metrics (2028 Target)

| Metric | Target |
|--------|--------|
| Curators Tracked | 500+ |
| AUM Monitored | $50B+ |
| Institutional Subscribers | 200+ |
| ARR | $12M+ |
| Market Position | Category leader |

### Product Evolution

**Phase 1 (2026): Intelligence Platform**
- Curator ratings and monitoring
- Alert system
- Basic reporting

**Phase 2 (2027): Workflow Integration**
- API for fund administrators
- Portfolio risk aggregation
- Compliance automation

**Phase 3 (2028): Network Effects**
- Curator verification/badges
- Allocator reviews
- Deal flow platform

---

## Core Beliefs

### 1. Relative > Absolute

DeFi curators shouldn't be judged by TradFi standards. A curator with 2% drawdown in a 50% market crash is excellent. We rate relative to peers in similar strategies.

### 2. Behavior > Promises

On-chain actions reveal true risk management. Reallocation frequency, collateral choices, concentration levels—these are observable and auditable.

### 3. Transparency Enables Trust

The same transparency that makes DeFi powerful should extend to curator monitoring. Every rating factor is explainable and verifiable.

### 4. Failures Are Teachers

Stream Finance, Rari Fuse, Cream Finance—each collapse revealed failure patterns. Our system encodes these lessons as automated red flags.

---

## Competitive Moats

### 1. Data Moat
- Historical curator behavior data
- Change detection corpus
- Failure pattern library

### 2. Methodology Moat
- First DeFi-native rating framework
- Peer comparison algorithms
- Strategy classification system

### 3. Network Moat
- Institutional relationships
- Curator partnerships
- Allocator community

### 4. Brand Moat
- "Check CuratorWatch" becoming standard practice
- Thought leadership on curator risk
- Stream Finance case study authority

---

## Non-Goals

What we explicitly choose NOT to do:

- **Protocol ratings** - DefiLlama, DeFiSafety cover this
- **Token analysis** - TokenTerminal, Messari own this
- **Yield aggregation** - We're intelligence, not execution
- **Custody** - We never touch user funds
- **Advisory** - We provide data, not recommendations

---

## Success Metrics

### North Star Metric
**Number of institutional allocation decisions informed by CuratorWatch**

### Leading Indicators
- Weekly active users (allocators checking curators)
- Alert engagement rate
- Report generation frequency
- API calls from fund administrators

### Lagging Indicators
- Subscriber revenue
- Curator coverage breadth
- Prevented loss attribution (if trackable)

---

## Related Documents

- [User Flows](./user-flows.md) - How users navigate the platform
- [Features](./features.md) - Detailed feature breakdown
- [Roadmap](./roadmap.md) - Implementation timeline
- [Market Analysis](../business/market-analysis.md) - Business opportunity

# User Flows

> How institutional allocators navigate CuratorWatch

---

## Overview

CuratorWatch serves three primary user journeys:

1. **Discovery** - Finding curators that match allocation criteria
2. **Due Diligence** - Deep-diving into specific curator/vault risk
3. **Monitoring** - Tracking changes to existing positions

---

## User Personas

### Primary: Institutional Allocator

- **Role:** Portfolio manager at family office, DAO treasury, or crypto fund
- **Goal:** Allocate $1M-100M to DeFi yield strategies safely
- **Pain:** No standardized way to evaluate curator quality
- **Behavior:** Checks weekly, needs board-ready reports

### Secondary: Curator/Risk Manager

- **Role:** Risk analyst at a vault curator (Gauntlet, Steakhouse, etc.)
- **Goal:** Monitor competitive landscape, benchmark performance
- **Pain:** No peer comparison tools exist
- **Behavior:** Daily monitoring, competitive intelligence

### Tertiary: DeFi Researcher

- **Role:** Analyst at research firm or media outlet
- **Goal:** Understand curator ecosystem dynamics
- **Pain:** Data scattered across protocols
- **Behavior:** Deep research sessions, exports data

---

## Flow 1: Dashboard Overview

### Entry Point
User lands on `curatorwatch.com` (home page)

### Information Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                      │
│  Logo | Dashboard | Vaults | Alerts | [Last updated: 2m ago]│
├─────────────────────────────────────────────────────────────┤
│  HERO KPIs (4 cards)                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Curators │ │Total AUM │ │  Vaults  │ │ Avg APY  │       │
│  │    47    │ │  $728M   │ │    70    │ │  8.2%    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  TABBED CHART                                               │
│  [AUM Growth] [APY Trends] [Vault Count]                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    📈 Chart                          │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  THREE CARDS ROW                                            │
│  ┌────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ Stablecoin │ │  Top Curators   │ │   Top Vaults    │    │
│  │ Breakdown  │ │  (by AUM)       │ │   (by TVL)      │    │
│  │            │ │  1. Gauntlet AA │ │  1. USDC Vault  │    │
│  │  USDC 45%  │ │  2. Steakh. AAA │ │  2. ETH Vault   │    │
│  │  USDT 30%  │ │  3. Re7 Labs BB │ │  3. DAI Vault   │    │
│  └────────────┘ └─────────────────┘ └─────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ALERTS BAR (if any)                                        │
│  🔴 3 critical | 🟡 5 warning changes in 24h → View all     │
├─────────────────────────────────────────────────────────────┤
│  ALL CURATORS TABLE                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Search: [________________] Sort: [AUM ▼]            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Curator    │ AUM      │ Vaults │ APY   │ Rating │30d│   │
│  │ Gauntlet   │ $245M    │ 12     │ 7.2%  │ AA     │+5%│   │
│  │ Steakhouse │ $180M    │ 8      │ 6.1%  │ AAA    │+2%│   │
│  │ ...        │ ...      │ ...    │ ...   │ ...    │...│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### User Actions

| Action | Outcome |
|--------|---------|
| Click curator name | Navigate to curator detail page |
| Click vault in Top Vaults | Navigate to vault detail page |
| Click rating badge | Tooltip explains rating factors |
| Click alerts bar | Navigate to alerts page |
| Search curators | Filter table in real-time |
| Sort by column | Re-order table |

---

## Flow 2: Curator Due Diligence

### Entry Point
Click curator name from dashboard or direct link `/curator/[address]`

### Page Structure: 5 Tabs

#### Tab 1: Overview (Default)

```
┌─────────────────────────────────────────────────────────────┐
│  CURATOR HEADER                                              │
│  [Logo] Steakhouse Financial                                │
│  0x1234...5678 [Copy] [Etherscan]                          │
│  "Institutional-grade DeFi yield strategies"               │
├─────────────────────────────────────────────────────────────┤
│  KEY METRICS (5 cards)                                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ $180M  │ │8 Vaults│ │ 6.1%   │ │ 2021   │ │ 12     │   │
│  │  AUM   │ │        │ │Avg APY │ │Founded │ │Team Sz │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
├─────────────────────────────────────────────────────────────┤
│  TABS: [Overview] [Vaults] [Performance] [Activity] [Risk] │
├─────────────────────────────────────────────────────────────┤
│  OVERVIEW CONTENT                                           │
│                                                             │
│  About                                                      │
│  Steakhouse Financial is an institutional-grade...         │
│                                                             │
│  Entity Information                                         │
│  • Legal Name: Steakhouse Financial Ltd                    │
│  • Jurisdiction: Cayman Islands                            │
│  • Entity Type: Investment Advisor                         │
│  • Regulated: Yes (CIMA)                                   │
│                                                             │
│  Asset Distribution [Pie Chart]                            │
│  USDC 45% | ETH 30% | DAI 25%                              │
│                                                             │
│  AUM History [Line Chart]                                  │
│  [Chart showing growth over time]                          │
└─────────────────────────────────────────────────────────────┘
```

#### Tab 2: Vaults

Lists all vaults managed by this curator with:
- Vault name and symbol
- TVL and APY
- Risk badge (Low/Med/High)
- 30-day performance
- Link to vault detail page

#### Tab 3: Performance

- APY over time chart
- AUM growth chart
- Comparison to peer curators
- Historical drawdowns (if any)

#### Tab 4: Activity

- Recent transactions table
- Deposit/withdrawal flows
- Reallocation events
- Timeline visualization

#### Tab 5: Risk Profile

```
┌─────────────────────────────────────────────────────────────┐
│  CURATOR RISK RATING                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                     AAA                              │   │
│  │                   Score: 92/100                      │   │
│  │            Top 5% of all curators                    │   │
│  │                                                      │   │
│  │  "Highest tier - institutional quality with         │   │
│  │   proven track record and conservative practices"   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  STRENGTHS ✅                                               │
│  • Zero bad debt exposure (Stream Finance survivor)        │
│  • 4+ years operating history                              │
│  • Blue-chip collateral only                               │
│  • Regulated entity (CIMA)                                 │
│  • Guardian mechanisms active                              │
│                                                             │
│  RISK FLAGS (none)                                         │
│  No critical or high-severity flags detected               │
│                                                             │
│  METHODOLOGY NOTE                                          │
│  "Lesson from Stream Finance Collapse (Nov 2025):          │
│   $285M in bad debt spread across curators who accepted    │
│   synthetic xUSD without proper due diligence..."          │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 3: Vault Analysis

### Entry Point
Click vault from curator page or `/vault/[address]`

### Page Structure: 5 Tabs

#### Tab 1: Overview

- Vault header (name, symbol, curator link)
- Key metrics (TVL, APY, share price, fees)
- Asset info and adapter breakdown
- Quick risk assessment badge

#### Tab 2: Markets

- Collateral exposure breakdown
- LLTV distribution
- Oracle types used
- Concentration analysis

#### Tab 3: Activity

- Transaction volume chart
- Recent deposits/withdrawals
- Large flow detection
- Reallocation history

#### Tab 4: Risk Analysis

5-pillar institutional risk assessment:
- Smart Contract Risk
- Oracle Risk
- Collateral Risk
- LLTV Risk
- Operational Risk

#### Tab 5: Strategy Intelligence

- Strategy archetype classification
- TradFi analog mapping
- Management style indicators
- Competitive positioning

---

## Flow 4: Alerts Monitoring

### Entry Point
Click "Alerts" in navigation or alerts bar

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ALERTS                                                     │
│  Real-time monitoring of significant changes                │
├─────────────────────────────────────────────────────────────┤
│  FILTERS                                                    │
│  Time: [24h ▼] Type: [All ▼] Severity: [All ▼]            │
├─────────────────────────────────────────────────────────────┤
│  SUMMARY CARDS                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ 🔴 3       │ │ 🟡 5       │ │ 🔵 12      │              │
│  │ Critical   │ │ Warning    │ │ Info       │              │
│  └────────────┘ └────────────┘ └────────────┘              │
├─────────────────────────────────────────────────────────────┤
│  ALERT FEED                                                 │
│                                                             │
│  🔴 CRITICAL | 2h ago                                      │
│  Vault "USDC Prime" concentration increased 45% → 72%      │
│  Curator: MEV Capital                                       │
│  [View Vault →]                                            │
│                                                             │
│  🟡 WARNING | 5h ago                                       │
│  APY dropped 25% on "ETH Yield" vault                      │
│  7-day avg: 8.2% → Current: 6.1%                          │
│  Curator: Re7 Labs                                         │
│  [View Vault →]                                            │
│                                                             │
│  🔵 INFO | 8h ago                                          │
│  New vault launched: "DAI Stable"                          │
│  Curator: Steakhouse Financial                             │
│  [View Vault →]                                            │
└─────────────────────────────────────────────────────────────┘
```

### Alert Types

| Type | Trigger | Severity |
|------|---------|----------|
| APY Change | >20% from 7-day average | Warning/Critical |
| Large Flow | >10% of vault TVL | Warning |
| Concentration | >15pp increase | Critical |
| New Vault | Vault created | Info |
| Curator Change | Ownership transfer | Critical |

---

## Flow 5: Search & Discovery

### Global Search

Available from any page via search bar:
- Search curators by name
- Search vaults by name or symbol
- Search by address (curator or vault)

### Filtered Discovery

Dashboard table supports:
- Sort by AUM, vaults, APY, rating, 30d change
- Filter by rating tier (AAA, AA, A, etc.)
- Filter by asset type (stablecoins, ETH, etc.)

---

## Mobile Considerations

### Responsive Behavior

| Element | Desktop | Mobile |
|---------|---------|--------|
| KPI cards | 4 columns | 2 columns |
| Charts | Full width | Scrollable |
| Tables | Full columns | Horizontal scroll |
| Tabs | Horizontal | Scrollable pills |

### Mobile-First Actions

- Curator cards are tap targets
- Swipe between tabs
- Pull-to-refresh on dashboard
- Sticky header with search

---

## Related Documents

- [Features](./features.md) - Detailed feature specs
- [Alert Logic](../technical/alert-logic.md) - How alerts are calculated
- [Risk Scoring](../technical/risk-scoring.md) - Rating methodology

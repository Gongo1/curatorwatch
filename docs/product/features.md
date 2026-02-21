# Features

> Complete feature breakdown by page and component

---

## Dashboard (Home Page)

### Hero KPIs

| Metric | Source | Update Frequency |
|--------|--------|------------------|
| Total Curators | Count of tracked curators | Real-time |
| Total AUM | Sum of all vault TVLs | Hourly |
| Total Vaults | Count of tracked vaults | Real-time |
| Average APY | Weighted avg by TVL | Hourly |

### Tabbed Metric Chart

Three visualization modes:

1. **AUM Growth** - Stacked area chart showing total AUM over time
2. **APY Trends** - Line chart showing average APY evolution
3. **Vault Count** - Bar chart showing vault creation over time

Time ranges: 7d, 30d, 90d, 1y, All

### Stablecoin Breakdown

Pie chart showing distribution of stablecoin assets:
- USDC percentage
- USDT percentage
- DAI percentage
- Other stablecoins

Click segment to filter curators by that asset.

### Top Performers Cards

**Top Curators (by AUM)**
- Rank 1-5 curators
- Shows: Name, AUM, Rating badge
- Clickable to curator page

**Top Vaults (by TVL)**
- Rank 1-5 vaults
- Shows: Name, TVL, APY, Risk badge
- Clickable to vault page

### Alerts Bar

Conditionally displayed when alerts exist:
- Count by severity (critical, warning, info)
- Link to full alerts page
- Dismissible after viewing

### All Curators Table

| Column | Description | Sortable |
|--------|-------------|----------|
| Curator | Name + avatar + rating | By name |
| Total AUM | USD value | Yes |
| # Vaults | Vault count | Yes |
| Avg APY | Weighted average | Yes |
| Assets | Top 3 asset badges | No |
| Rating | AAA-CCC tier | No |
| 30d Change | AUM % change | Yes |

Features:
- Real-time search filtering
- Pagination (20 per page)
- Click row to navigate to curator

---

## Curator Detail Page

### Header Section

- Curator avatar (generated or uploaded logo)
- Name and address (with copy button)
- Description/bio (if available)
- External links (website, Twitter, etc.)

### Key Metrics Row

| Metric | Description |
|--------|-------------|
| Total AUM | Sum of vault TVLs |
| Vaults | Number of managed vaults |
| Avg APY | Weighted by TVL |
| Founded | Year established |
| Team Size | Number of team members |

### Tab: Overview

**About Section**
- Curator description
- Investment philosophy
- Key differentiators

**Entity Information**
- Legal name
- Jurisdiction
- Entity type (LLC, Ltd, DAO, etc.)
- Regulatory status

**Asset Distribution**
- Pie chart of assets under management
- Breakdown by stablecoin, ETH, other

**AUM History**
- Line chart of AUM over time
- Key events annotated

### Tab: Vaults

Table of managed vaults:

| Column | Description |
|--------|-------------|
| Vault | Name + symbol |
| TVL | Total value locked |
| APY | Current net APY |
| Risk | Low/Med/High badge |
| 30d Change | TVL % change |
| Actions | View vault link |

### Tab: Performance

**APY Over Time**
- Line chart comparing vault APYs
- Benchmark line (market average)

**AUM Growth**
- Area chart showing growth trajectory
- Inflow/outflow annotations

**Peer Comparison**
- Table comparing to similar curators
- Metrics: AUM, APY, risk rating

### Tab: Activity

**Recent Transactions**
- Deposits, withdrawals, reallocations
- Timestamp, amount, vault affected
- Link to Etherscan

**Flow Analysis**
- Net flow chart (deposits - withdrawals)
- Large flow highlighting

### Tab: Risk Profile

**Rating Display**
- Large tier badge (AAA-CCC)
- Numeric score (0-100)
- Percentile rank

**Strengths (Green Flags)**
- Zero bad debt history
- Long operating history
- Conservative collateral
- Regulatory compliance
- Active governance

**Risk Flags (Red Flags)**
- Severity: Critical, High, Medium, Low
- Description of each flag
- Historical context

**Methodology Note**
- Stream Finance lesson callout
- Link to full methodology docs

---

## Vault Detail Page

### Header Section

- Vault name and symbol
- Address with copy/Etherscan links
- Curator link
- External link to Morpho UI

### Key Metrics Row

| Metric | Description |
|--------|-------------|
| TVL | Total value in USD |
| APY | Current net APY |
| Share Price | Current price per share |
| Performance Fee | % taken on profits |
| Management Fee | Annual % fee |

### Tab: Overview

**Asset Information**
- Underlying asset (USDC, ETH, etc.)
- Asset address
- Decimals

**Adapter Breakdown**
- Table of lending adapters
- Allocation percentage per adapter
- USD value in each

**Quick Risk Badge**
- Low/Moderate/High indicator
- Click for full risk analysis

### Tab: Markets

**Collateral Exposure**
- Table of collateral assets accepted
- LLTV for each market
- Allocation percentage
- Oracle type used

**Concentration Analysis**
- Top collateral concentration %
- Diversification score
- Risk implications

**Oracle Distribution**
- Chainlink vs other oracles
- Oracle risk assessment

### Tab: Activity

**Transaction Volume Chart**
- Daily/weekly volume bars
- Deposit vs withdrawal breakdown

**Recent Transactions**
- Type (deposit/withdraw/realloc)
- Amount and timestamp
- User address (truncated)

**Large Flow Detection**
- Highlighted transactions >10% TVL
- Impact analysis

### Tab: Risk Analysis

**5-Pillar Assessment**

Each pillar shows:
- Score (0-100)
- Level (Low/Moderate/High)
- Contributing factors
- Recommendations

| Pillar | Weight | Factors |
|--------|--------|---------|
| Smart Contract | 25% | Audit status, code age, exploit history |
| Oracle | 20% | Oracle types, manipulation resistance |
| Collateral | 20% | Asset quality, concentration |
| LLTV | 15% | Leverage exposure, liquidation risk |
| Operational | 20% | Curator quality, transparency |

**Overall Risk Score**
- Weighted composite score
- Risk level classification
- Comparison to vault category average

### Tab: Strategy Intelligence

**Strategy Classification**
- Archetype badge (Quant, Fixed Income, etc.)
- TradFi analog explanation
- Confidence score

**Management Style Indicators**
- Reallocation frequency
- Idle cash percentage
- Concentration tolerance
- LLTV preferences

**Competitive Position**
- Similar vaults comparison
- Performance vs strategy peers

---

## Alerts Page

### Filter Controls

| Filter | Options |
|--------|---------|
| Time Range | 24h, 7d, 30d, All |
| Alert Type | APY, Flow, Concentration, Lifecycle |
| Severity | Critical, Warning, Info |
| Curator | Dropdown of all curators |

### Summary Cards

- Critical count (red)
- Warning count (yellow)
- Info count (blue)
- Total count

### Alert Feed

Each alert displays:
- Severity icon and color
- Timestamp (relative)
- Alert title
- Description with metrics
- Affected curator/vault
- Action link

### Alert Types Detail

**APY Change Alert**
```
🟡 WARNING | 2h ago
APY dropped 25% on "ETH Yield" vault
Previous (7d avg): 8.2%
Current: 6.1%
Curator: Re7 Labs
[View Vault →]
```

**Large Flow Alert**
```
🟡 WARNING | 5h ago
Large withdrawal detected: $2.5M (12% of TVL)
Vault: USDC Prime
Remaining TVL: $18.3M
[View Vault →]
```

**Concentration Alert**
```
🔴 CRITICAL | 1h ago
Concentration increased significantly
Previous: 45%
Current: 72% (+27pp)
Top position: wstETH market
[View Vault →]
```

**Lifecycle Alert**
```
🔵 INFO | 8h ago
New vault launched
Name: DAI Stable Yield
Curator: Steakhouse Financial
Initial TVL: $5M
[View Vault →]
```

---

## Global Components

### Navigation Header

- Logo (links to home)
- Dashboard link
- Vaults link
- Alerts link (with badge if unread)
- Last updated timestamp
- Live indicator

### Search

- Global search bar
- Searches curators and vaults
- Address lookup support
- Keyboard shortcut (Cmd+K)

### Footer

- Data source attribution (Morpho API)
- Update frequency note
- Live status indicator

---

## Future Features (Roadmap)

### Q2 2026
- Email/Telegram alert notifications
- Custom alert thresholds
- Watchlist functionality

### Q3 2026
- API access for Pro users
- PDF report generation
- Historical data export

### Q4 2026
- Multi-protocol support (Yearn, Aave)
- Portfolio aggregation
- White-label reports

---

## Related Documents

- [User Flows](./user-flows.md) - Navigation patterns
- [Roadmap](./roadmap.md) - Feature timeline
- [Architecture](../technical/architecture.md) - Technical implementation

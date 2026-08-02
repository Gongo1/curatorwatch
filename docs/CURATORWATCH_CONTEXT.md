# CuratorWatch Development Context

> **Last Updated:** March 16, 2026  
> **Purpose:** Context document for resuming development across sessions  
> **Status:** Active development, post-MVP launch

---

## Project Overview

**CuratorWatch** is a DeFi vault intelligence platform tracking 130+ vaults across Morpho [TBA] and Turtle protocols. We provide institutional-grade risk analysis for vault curators and LPs.

**Live:** curatorwatch.com  
**Positioning:** "Bloomberg Terminal for DeFi vaults"  
**Target User:** Institutional allocators deploying $100K-$10M+ into vaults

---

## Current Architecture

### Tech Stack
- **Frontend:** Next.js 14, React, Tailwind CSS
- **Backend:** Prisma ORM, PostgreSQL
- **Deployment:** Vercel
- **Data Sources:** Morpho API, Turtle API (considering migration to blockchain-native via Dune)

### Key Features Live
- Vault explorer (130 vaults)
- Curator profiles (46 curators)
- Real-time TVL, APY/APR tracking
- Collateral analysis
- Strategy Intelligence tab
- Alert system

---

## In Progress: High-Priority Features

### 1. Vault Grading System (NEXT TO IMPLEMENT)

**Status:** Fully designed, ready for implementation  
**Spec:** `docs/implementation/high-grade-vault-scoring-implementation.md`

**Overview:**
- 3-tier grading: High Grade / Medium Grade / Other
- Based on 9 institutional requirements (must pass ALL for High Grade)
- Rules-based, not percentile-based

**9 Requirements:**
1. TVL ≥ $5M
2. Vault age ≥ 90 days
3. Curator has legal entity
4. Curator operating ≥ 6 months
5. Curator total AUM ≥ $10M
6. Zero bad debt (curator + vault)
7. APR ≤ 20%
8. Collateral ≥ 80% institutional
9. Lock period ≤ 30 days

**Grading Logic:**
- Pass all 9 requirements → **High Grade** 🛡️
- Pass 6-8 requirements → **Medium Grade** ⚖️
- Pass ≤5 requirements → **Other** ⚡

**Risk Score:** 0-100 composite score calculated from:
- Size & Liquidity: 25 points
- Vault Maturity: 15 points
- Curator Track Record: 35 points (biggest weight)
- Collateral Quality: 15 points
- Risk Indicators: 10 points

**Database Changes Needed:**
```prisma
model Vault {
  // Add these fields:
  riskScore          Float    @default(0)  // 0-100
  sizeScore          Float    @default(0)  // 0-25
  maturityScore      Float    @default(0)  // 0-15
  curatorScore       Float    @default(0)  // 0-35
  collateralScore    Float    @default(0)  // 0-15
  riskIndicatorScore Float    @default(0)  // 0-10
  grade              String?  // 'high-grade' | 'medium-grade' | 'other'
}

model Curator {
  // Add these fields:
  legalEntity        Boolean  @default(false)
  timeInOperation    Int      // Days since first vault
  badDebt            Float    @default(0)
  totalAUM           Float    @default(0)
  vaultCount         Int      @default(0)
}
```

**Implementation Files Created:**
- All scoring functions in `lib/scoring/` (see spec doc)
- Sync script: `scripts/update-vault-grades.ts`
- Components: `VaultRiskBadge`, `RequirementBreakdown`

**Where to Display:**
- Vault detail pages (Overview tab)
- Strategy Intelligence tab (NEW: add requirement breakdown)
- Vault tables (badge column)
- Featured Vaults (high-grade only)
- Homepage stats

**Known Issue to Fix:**
- Bug in bad debt check: $0 (stored as null/undefined) may incorrectly fail requirement
- Fix: Add defensive null handling `(vault.curator.badDebt || 0) > 0`

---

### 2. LP Return Calculator

**Status:** Designed, not yet implemented

**Route:** `/app/calculator/page.tsx`

**User Flow:**
1. Single-page filter interface (3 columns visible at once):
   - Column 1: Deposit Amount (input + quick buttons: $100K, $500K, $1M, $5M, $10M)
   - Column 2: Vault Grade (High/Medium/Other)
   - Column 3: Collateral Type (Blue-Chip/All)

2. Advanced filters (collapsible):
   - Protocol: All / Morpho / Turtle
   - Asset: USDC / USDT / PYUSD / wstETH / WBTC
   - Min/Max APR range
   - Curator dropdown

3. Results: Top 3 vault recommendations (🥇🥈🥉) + full table

4. Select vault → Results dashboard:
   - 4 metric cards: First Payment, Month 1 Earnings, Year 1 Total, Net APR
   - Cumulative earnings chart (12 months)
   - Monthly payment schedule table
   - Liquidity depth check (warning if deposit >10% of vault TVL)
   - Withdrawal terms display (🔒 locked / 🔓 no lock)
   - "Deposit on Morpho/Turtle" CTA button

**Calculations:**
- Turtle: Simple interest (APR × TVL)
- Morpho: Compound interest (APY formula)
- First payment: Day 30 for Turtle, Day 1 for Morpho

**Also Add:** LP Calculator tab on vault detail pages

---

### 3. Homepage Redesign

**Status:** Designed, needs implementation

**New Layout Order:**
1. Hero (title + tagline)
2. Top 3 Metrics (Total AUM, Yield Paid, Avg Fee)
3. Protocol Ecosystem section (replaces "Distributor Coverage")
4. Featured Vaults (3 high-grade vaults)
5. Quick Stats Row (4 small cards)
6. AUM Chart (300px height)
7. Top Curators & Vaults (side-by-side tables)

**Protocol Ecosystem Section:**
- 2-column card layout
- Morpho [TBA]: "The universal lending network" (blue accent)
- Turtle: "DeFi liquidity coordination platform" (green accent)
- Stats per protocol: Vaults, AUM, Curators
- "Explore →" links to `/vaults/morpho` and `/vaults/turtle`

**Featured Vaults:**
- Query: High Grade vaults only, top 3 by risk score
- Show: Net APR, $1M yearly earnings, withdrawal terms, curated reason
- Remove: Numbered rankings, "what $1M earns" subtitle
- Add: "Open LP Calculator" button top right

---

### 4. Vault Table Updates

**New Column Structure:**
```
ASSET | CURATOR | DEPOSITS | APY/APR | NET APY/APR | CHANGES
```

**Changes:**
- Removed vault name column entirely
- Asset column: asset name + protocol badge
- Curator column: clickable link to curator page
- Protocol badges: Morpho [TBA] (blue), Turtle (green)

**Separate Vault Pages:**
- `/vaults` → landing page with protocol selector
- `/vaults/morpho` → Morpho vaults (shows APY)
- `/vaults/turtle` → Turtle vaults (shows Est. Total APR)

---

### 5. Twitter Launch Content

**Status:** Ready to publish  
**Doc:** `docs/implementation/curatorwatch-twitter-announcements.md`

**Two Main Threads:**
1. LP Calculator launch (8 tweets)
2. Vault grading system announcement (12 tweets)

**Plus:** 10 standalone engagement tweets, quote tweet templates, content calendar

**Strategy:**
- LP Calculator thread: utility-focused ("see exactly what you'll earn")
- Grading thread: education-focused ("here's what institutions look for")
- Both avoid jargon, use concrete examples, clear CTAs

---

## Key Product Decisions Made

### 1. Data Architecture Strategy

**Decision:** Start with APIs, migrate to blockchain-native strategically

**Reasoning:**
- API dependency risk is NOT "APIs disappear" (low probability)
- Real risk is "can't build features users need" (high probability)
- Features requiring blockchain data: APY history, whale tracking, reallocation frequency

**Approach:**
1. Keep using Morpho/Turtle APIs for current vault data (cheap, reliable)
2. Add Dune Analytics for ONE historical feature first (90-day APY chart)
3. Validate if users care about historical depth
4. If validated: expand blockchain-native features incrementally
5. If not validated: APIs are sufficient

**When to go full blockchain-native:**
- When feature limitation blocks differentiation
- When API costs exceed $500/mo (rate limiting)
- When users demonstrate demand for deep analytics

**Hybrid approach (recommended):**
- 80% of data from APIs: vault metadata, current state
- 20% from blockchain: historical analysis, granular events

### 2. Grading System Philosophy

**Decision:** Rules-based (pass/fail on requirements), not ranking-based (top X%)

**Reasoning:**
- Institutional allocators have checklists, not relative preferences
- "High Grade" should mean "meets institutional standards" not "better than peers"
- Avoids grade inflation as ecosystem grows
- Clear, auditable criteria

**Example:** 
- Steakhouse Reservoir USDC: Passes all 9 requirements → High Grade
- K3 USDT Vault: Fails 7 requirements → Other
- No ambiguity, no subjective judgment

### 3. Curator Quality Over Vault Metrics

**Decision:** Weight curator track record at 35% of risk score

**Reasoning:**
- Vault is only as safe as team managing it
- Size/maturity can be gamed (Sybil vaults)
- Curator reputation is sticky and earned
- Institutional LPs deploy into curators, not individual vaults

### 4. APR vs APY Distinction

**Decision:** Show Est. Total APR for Turtle, APY for Morpho

**Reasoning:**
- Turtle uses simple interest (APR)
- Morpho compounds (APY)
- Mixing them creates false comparisons
- Separate vault pages per protocol maintains accuracy

---

## Technical Debt & Known Issues

### 1. Turtle Vault Data Quality
**Issue:** Turtle vaults showing 0 curators and no APR data  
**Cause:** Likely field name mismatch in API response  
**Fix:** Inspect Turtle API response, update sync script field mappings

### 2. Bad Debt Null Handling
**Issue:** Vaults with $0 bad debt may fail requirement check if stored as null  
**Fix:** Add defensive null coalescing in requirements.ts: `(badDebt || 0) > 0`

### 3. Performance Optimization Needed
**Current:** No loading states, no caching, full DB queries every page load  
**Plan:**
- Phase 1: Add loading.tsx, enable revalidate, prefetch nav links
- Phase 2: Database indexes on protocol/tvl, SWR client caching
- Phase 3: Virtual scrolling for tables, lazy load charts

---

## Naming Conventions & Branding

**Important Updates:**
- "Morpho V2" → "Morpho [TBA]" (per CEO announcement, use everywhere)
- "Distributor Coverage" → "Protocol Ecosystem"
- "Curated Vault Favorites" → "Featured Vaults"

**Tone:** Bloomberg Terminal meets crypto Twitter
- Professional but not stuffy
- Data-driven but accessible
- Institutional but not intimidating

---

## Next Steps (Priority Order)

### Week 1 (Immediate)
1. ✅ Fix bad debt null handling bug
2. ✅ Implement vault grading system (database migration + scoring functions)
3. ✅ Add grade display to vault pages and Strategy Intelligence tab
4. ✅ Run grading script on all vaults
5. ✅ Update Featured Vaults to show High Grade only

### Week 2
1. ✅ Build LP Calculator (single-page filter layout)
2. ✅ Add LP Calculator to Economics nav section
3. ✅ Add LP Calculator tab to vault detail pages
4. ✅ Split vault pages: /vaults/morpho and /vaults/turtle

### Week 3
1. ✅ Implement homepage redesign (Protocol Ecosystem section)
2. ✅ Update vault table columns (remove name, add protocol badges)
3. ✅ Add performance optimizations (loading states, caching)
4. ✅ Fix Turtle vault data sync issues

### Week 4
1. ✅ Launch Twitter campaign (grading system + LP calculator threads)
2. ✅ Monitor user engagement on new features
3. ✅ Decide: proceed with blockchain-native features or optimize current stack

---

## Reference Documentation

### Implementation Specs
- `docs/implementation/high-grade-vault-scoring-implementation.md` - Complete grading system spec with code
- `docs/implementation/curatorwatch-twitter-announcements.md` - Launch content and strategy

### User Stories to Validate
1. "Is this 8% APY stable or volatile?" → Need 90-day APY history (blockchain data)
2. "Who are the big depositors?" → Need whale tracking (blockchain data)
3. "How often does curator reallocate?" → Need reallocation frequency (blockchain data)
4. "What will I actually earn if I deposit $1M?" → Need LP Calculator (have API data)
5. "Is this vault institutional quality?" → Need grading system (have API data)

**Validate 4 & 5 first (can build with APIs). If successful, pursue 1-3 (require blockchain).**

---

## Database Schema Reference

### Current Core Models
```prisma
model Vault {
  id          String
  name        String
  asset       String
  tvl         Float
  netAPR      Float
  protocol    String  // 'morpho-tba' | 'turtle'
  curatorId   String
  curator     Curator
}

model Curator {
  id      String
  name    String
  address String
  vaults  Vault[]
}
```

### Pending Additions (for grading system)
See "Database Changes Needed" section above

---

## Contact & Context

**Project Owner:** Austin  
**Role:** Building CuratorWatch as institutional DeFi intelligence platform  
**Background:** Credit ratings for digital assets, DeFi risk analysis, product strategy  

**Other Projects:**
- Sombra Project LLC: Experiential events (house music, Burning Man community)

**Development Context:**
- Working with Claude Code for implementation
- This document serves as handoff between sessions
- Conversation history preserved in browser for reference
- All implementation details in linked spec documents

---

## Quick Start for New Session

1. Read this CONTEXT.md file
2. Review pending implementation docs in `docs/implementation/`
3. Check "Next Steps" section for current priorities
4. Reference grading system spec for technical details
5. Ask questions about any unclear context

**Most Important:** Grading system is next to implement. Full spec is ready, just needs execution.

---

*End of context document. Update this file as major decisions are made or features are completed.*

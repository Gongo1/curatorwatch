# Product Roadmap

> Q1 2026 through 2028 and beyond

---

## Current State (Feb 2026)

### What's Live

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard with KPIs | ✅ Live | 47 curators, $728M AUM |
| Curator detail pages | ✅ Live | 5 tabs, full profile |
| Vault detail pages | ✅ Live | 5 tabs, risk analysis |
| Curator ratings (AAA-CCC) | ✅ Live | Relative peer comparison |
| Strategy classification | ✅ Live | 6 archetypes |
| Risk assessment (5 pillars) | ✅ Live | Smart contract to operational |
| Alerts page | ✅ Live | 4 alert types |
| Real-time data | ✅ Live | Hourly updates |

### Tech Stack

- Frontend: Next.js 16, React 19, TailwindCSS
- Backend: Next.js API Routes, Prisma ORM
- Database: Supabase (PostgreSQL)
- Data: Morpho GraphQL API
- Hosting: Vercel

---

## Q1 2026 (Jan - Mar)

### Theme: Foundation & Polish

#### January ✅
- [x] Launch MVP at curatorwatch.com
- [x] Implement curator rating system
- [x] Build strategy classification
- [x] Create 5-pillar risk assessment

#### February (Current)
- [x] Add rating subscripts throughout UI
- [x] Remove legacy risk/strategy columns
- [x] Polish homepage cards (clickable)
- [ ] Add email capture for waitlist
- [ ] Implement basic analytics (Plausible/Posthog)

#### March
- [ ] User accounts (Privy/Web3 login)
- [ ] Watchlist functionality
- [ ] Custom alert preferences
- [ ] Mobile responsive polish

### Deliverables
- Production-ready free tier
- 100+ beta users
- Feedback collection system

---

## Q2 2026 (Apr - Jun)

### Theme: Alerts & Notifications

#### April
- [ ] Email notification system
- [ ] Telegram bot integration
- [ ] Custom alert thresholds
- [ ] Alert history/archive

#### May
- [ ] Webhook support for alerts
- [ ] Daily/weekly digest emails
- [ ] Alert severity customization
- [ ] Mute/snooze functionality

#### June
- [ ] Pro tier launch ($99/mo)
- [ ] Extended alert types
- [ ] API access (read-only)
- [ ] Usage dashboards

### Deliverables
- Notification infrastructure
- Pro tier with 50+ subscribers
- API v1 documentation

---

## Q3 2026 (Jul - Sep)

### Theme: Reporting & Export

#### July
- [ ] PDF report generation
- [ ] Curator comparison reports
- [ ] Historical data export (CSV)
- [ ] Custom date ranges

#### August
- [ ] Board-ready templates
- [ ] White-label report options
- [ ] Scheduled report delivery
- [ ] Compliance audit trails

#### September
- [ ] Portfolio aggregation view
- [ ] Multi-curator analysis
- [ ] Risk correlation matrix
- [ ] Benchmark comparisons

### Deliverables
- Institutional reporting suite
- 10+ institutional trial users
- Compliance documentation

---

## Q4 2026 (Oct - Dec)

### Theme: Multi-Protocol Expansion

#### October
- [ ] Yearn V3 integration
- [ ] Unified curator profiles
- [ ] Cross-protocol AUM tracking
- [ ] Protocol comparison views

#### November
- [ ] Aave V3 integration
- [ ] EigenLayer restaking
- [ ] Maker/Sky integration
- [ ] Protocol risk aggregation

#### December
- [ ] Institutional tier launch ($999-4,999/mo)
- [ ] White-label partnerships
- [ ] API v2 (full access)
- [ ] Enterprise SSO

### Deliverables
- 3+ protocol coverage
- Institutional tier revenue
- Enterprise sales pipeline

---

## 2027 Roadmap

### Q1 2027: Network Effects

- Curator verification badges
- Allocator reviews/ratings
- Curator messaging system
- Deal flow platform (beta)

### Q2 2027: Workflow Integration

- Fund admin integrations
- Compliance automation
- Portfolio management tools
- Risk limit monitoring

### Q3 2027: Intelligence Layer

- AI-powered insights
- Anomaly detection
- Predictive risk scoring
- Market correlation alerts

### Q4 2027: Platform Ecosystem

- Curator self-service
- Data marketplace
- Third-party integrations
- Developer ecosystem

---

## 2028+ Vision

### End State Features

| Category | Features |
|----------|----------|
| Coverage | 500+ curators, $50B+ AUM, 10+ protocols |
| Intelligence | AI risk scoring, predictive alerts |
| Workflow | Full portfolio management suite |
| Network | Verified curators, allocator community |
| Enterprise | White-label, API ecosystem |

### Market Position

- Category leader in curator intelligence
- "Check CuratorWatch" as standard practice
- $12M+ ARR
- 200+ institutional subscribers

---

## Feature Prioritization Framework

### Scoring Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| User Impact | 30% | How many users benefit |
| Revenue Potential | 25% | Monetization opportunity |
| Strategic Value | 25% | Moat building |
| Effort | 20% | Development complexity |

### Current Backlog (Prioritized)

1. **Email notifications** - High impact, enables Pro tier
2. **User accounts** - Required for watchlists
3. **PDF reports** - Institutional requirement
4. **API access** - Pro/Enterprise revenue
5. **Yearn integration** - Doubles coverage

### Parking Lot (Future Consideration)

- Mobile app (native)
- Real-time websockets
- Social features
- Token-gated access
- DAO governance

---

## Success Metrics by Quarter

| Quarter | North Star | Target |
|---------|------------|--------|
| Q1 2026 | Beta users | 100 |
| Q2 2026 | Pro subscribers | 50 |
| Q3 2026 | Institutional trials | 10 |
| Q4 2026 | ARR | $100k |
| Q1 2027 | Curators tracked | 200 |
| Q2 2027 | Protocol coverage | 5 |
| Q4 2027 | ARR | $1M |
| Q4 2028 | ARR | $12M |

---

## Dependencies & Risks

### External Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Morpho API | Rate limits, changes | Cache aggressively, multi-source |
| Supabase | Scaling limits | Migration plan to dedicated |
| Vercel | Cold starts | Edge functions, caching |

### Market Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| DeFi downturn | Medium | High | Multi-protocol diversification |
| Competitor entry | Low | Medium | Speed + data moat |
| Regulatory | Medium | Medium | Compliance-first approach |

---

## Related Documents

- [Vision](./vision.md) - Long-term direction
- [Features](./features.md) - Current feature set
- [Monetization](../business/monetization.md) - Revenue model
- [Architecture](../technical/architecture.md) - Technical foundation

/**
 * Curated curator dossier registry — the editorial half of the profile
 * "About" blurb. Live figures (vault count, AUM, chains, stables) are computed
 * from tracked data at render time; everything here is hand-verified fact with
 * a source trail, maintained for the top curators by AUM.
 *
 * (Distinct from the legacy curator-enrichment.ts seed list — this module is
 * display-only, sourced, and keyed by the live DB address.)
 *
 * Rules of the registry (institutional audience — a wrong fact is disqualifying):
 * - Every entry field must be backed by a URL in `sources`.
 * - Quotes are verbatim from third-party coverage (press, research notes,
 *   ratings), never the curator's own marketing, and always attributed + linked.
 * - Material negative events belong in `cautions` — honesty is the product.
 * - Unverifiable claims are omitted, not guessed.
 *
 * Keyed by the Curator.address in our DB (0x… or the tc:<slug> synthetic form).
 */

export interface DossierQuote {
  text: string;
  source: string;
  url: string;
  date?: string; // YYYY-MM
}

export interface CuratorDossier {
  /** Overrides/completes the sparse DB dossier fields for display. */
  foundedYear?: number;
  entity?: string; // legal entity + form, e.g. "Steakhouse Financial AG"
  hq?: string;
  backers?: string[]; // notable investors
  fundingNote?: string; // e.g. "Raised $23M Series A led by X (2023)"
  registrations?: string[]; // regulatory registrations / licenses
  highlights?: string[]; // short verifiable facts an allocator cares about
  research?: { name: string; url: string }; // curator-run research desk
  quotes?: DossierQuote[];
  cautions?: string[]; // material negative events
  sources?: string[]; // review trail; not rendered
}

export function getCuratorDossier(address: string): CuratorDossier | null {
  return CURATOR_DOSSIERS[address.toLowerCase()] ?? null;
}

export const CURATOR_DOSSIERS: Record<string, CuratorDossier> = {
  // Populated for the top curators by AUM (2026-08-12 research pass).

  "tc:ethena": {
    entity: "Ethena Labs (user-facing entity: Ethena (BVI) Ltd.)",
    fundingNote:
      "Raised a $6M seed led by Dragonfly (2023), then a $14M round at a $300M valuation (2024) with Franklin Templeton, Brevan Howard Digital and Maelstrom participating",
    highlights: [
      "USDe synthetic dollar scaled from stealth launch (Dec 2023) to a multi-billion supply, with TradFi names Franklin Templeton and Brevan Howard Digital on the cap table",
      "Approved an allocation of up to $310M of USDe reserve backing into the Janus Henderson Anemoy JAAA tokenized AAA CLO fund",
    ],
    quotes: [
      {
        text: "Ethena also publicly launched its USDe stablecoin following a stealth launch last December that quickly saw over $224 million in total value locked.",
        source: "The Block",
        url: "https://www.theblock.co/post/277565/ethena-usde-stablecoin-funding-valuation-paypal-brevan-howard-others",
        date: "2024-02",
      },
    ],
    cautions: [
      "BaFin barred the German subsidiary from publicly offering USDe (March 2025), froze reserves and rejected its MiCA authorization; Ethena wound up its Germany/EEA operations after a supervised redemption and now serves users from the BVI entity. Separately, USDe briefly traded to ~$0.65 on Binance in the Oct 2025 liquidation cascade (a venue-specific dislocation; ~0.3% move on Curve)",
    ],
    sources: [
      "https://www.theblock.co/post/277565/ethena-usde-stablecoin-funding-valuation-paypal-brevan-howard-others",
      "https://www.theblock.co/post/240017/dragonfly-capital-leads-6-million-seed-funding-round-for-ethereum-stablecoin-developer-ethena-axios",
      "https://cointelegraph.com/news/ethena-bafin-usde-redemption-plan-eu-exit",
      "https://www.ccn.com/education/crypto/ethena-usde-depeg-binance-crash-explained/",
      "https://cryptobriefing.com/centrifuge-jaaa-tokenized-clo-fund/",
    ],
  },

  "tc:janus-henderson": {
    foundedYear: 2017,
    entity:
      "Janus Henderson Group plc (NYSE: JHG); on-chain funds issued as segregated portfolios of Anemoy Capital SPC (BVI), sub-advised by Janus Henderson Investors US LLC",
    hq: "London, United Kingdom",
    registrations: [
      "Sub-investment manager Janus Henderson Investors US LLC is an SEC-registered investment adviser",
    ],
    highlights: [
      "Group AUM of $480B as of March 2026; the on-chain funds sit alongside the flagship JAAA AAA CLO ETF ($20B+)",
      "JAAA tokenized AAA CLO fund (~$687M) is the category's largest — JPMorgan Chase custody, Particula AAA token rating, seeded by a $1B Grove/Sky ecosystem allocation",
      "JTRSY treasury fund crossed $1B in Q1 2026 and is rated AA+f/S1+ by S&P Global — the highest-rated tokenized fund at the time",
    ],
    quotes: [
      {
        text: "the stress precedent is 11 March 2026, when a single wallet redeemed $318.6M, 42.8% of that day's AUM, with no NAV impairment",
        source: "Vault Street Research (Resolv Labs)",
        url: "https://app.vaultstreet.com/research/jaaa",
        date: "2026-08",
      },
    ],
    cautions: [
      "JTRSY AUM receded from its $1B+ Q1 2026 peak to roughly $880M by mid-2026",
    ],
    sources: [
      "https://app.vaultstreet.com/research/jaaa",
      "https://cryptobriefing.com/centrifuge-jaaa-tokenized-clo-fund/",
      "https://cryptobriefing.com/centrifuge-tokenizes-janus-henderson-jtrsy/",
      "https://www.janushenderson.com/en-us/advisor/press-releases/janus-henderson-group-plc-reports-first-quarter-2026-results/",
      "https://www.businesswire.com/news/home/20250624393365/en/Grove-Announces-Launch-of-Institutional-Grade-Credit-Infrastructure-DeFi-Protocol-with-$1-Billion-Allocation-to-Tokenized-Janus-Henderson-Anemoy-AAA-CLO-Strategy",
    ],
  },

  "0x9e396de3312d373b87f9bd8763fb48184b42aac0": {
    foundedYear: 2025,
    entity: "Sentora — formed via the merger of IntoTheBlock and Trident Digital",
    hq: "Road Town, British Virgin Islands",
    fundingNote:
      "Launched with a $25M Series A led by New Form Capital (2025), with Ripple and Flare as strategic investors",
    highlights: [
      "IntoTheBlock lineage brings $3B+ in historical institutional DeFi deployments",
      "Curates the main Morpho vaults for PayPal's PYUSD and Ripple's RLUSD; $700M+ deposited across Sentora-curated Morpho vaults within six months (per Morpho)",
      "Runs Risk Radar, a proprietary monitoring system with 1,000+ risk models",
    ],
    research: { name: "Sentora Research", url: "https://sentora.com/research" },
    quotes: [
      {
        text: "Sentora combines IntoTheBlock's track record in DeFi analytics—spanning over $3 billion in institutional deployments—with Trident's experience structuring liquidity programs and financial products.",
        source: "CoinDesk",
        url: "https://www.coindesk.com/business/2025/05/05/intotheblock-and-trident-merge-secure-usd25m-backing-to-build-institutional-defi-gateway",
        date: "2025-05",
      },
    ],
    cautions: [
      "Curated-TVL milestones are partner-reported (Morpho's stories page) rather than independently verified",
    ],
    sources: [
      "https://www.theblock.co/post/353220/intotheblock-trident-merger-institutional-defi-platform-sentora-25-million-usd-series-a",
      "https://www.coindesk.com/business/2025/05/05/intotheblock-and-trident-merge-secure-usd25m-backing-to-build-institutional-defi-gateway",
      "https://morpho.org/stories/sentora",
      "https://sentora.com/research/reports/the-vault-economy",
    ],
  },

  "tc:kelp": {
    foundedYear: 2023,
    entity:
      "Kelp (rsETH) — part of the KernelDAO ecosystem since 2025; operating entity Evercrest Technologies Inc., Panama (per LlamaRisk)",
    fundingNote:
      "Raised a $9M token round at a $90M FDV co-led by SCB Limited and Nomura's Laser Digital (2024)",
    highlights: [
      "rsETH liquid restaking token scaled past $1B TVL within a year of launch",
      "Audited by SigmaPrime, a Code4rena contest, and MixBytes, with reported issues resolved",
      "Founded by Stader Labs alumni; KERNEL governance token launched via Binance Megadrop (2025)",
    ],
    quotes: [
      {
        text: "Although KelpDAO has taken positive strides in making rsETH a suitable collateral asset, we generally advise caution when assuming exposure to any liquid restaking token.",
        source: "LlamaRisk collateral assessment",
        url: "https://www.llamarisk.com/research/collateral-risk-rseth",
        date: "2024-07",
      },
    ],
    cautions: [
      "LlamaRisk (2024) flagged centralization: team-controlled admin multisig, off-chain services keyed from a centralized EOA, and a hardcoded 1:1 stETH/ETH rate; rsETH also saw a ~1.5% depeg in the April 2024 selloff",
    ],
    sources: [
      "https://www.theblock.co/post/295972/ethereum-kelp-token-round-valuation",
      "https://www.llamarisk.com/research/collateral-risk-rseth",
      "https://forum.kerneldao.com/t/announcing-kernel-tokenomics/24",
    ],
  },

  "0x9e33faae38ff641094fa68c65c2ce600b3410585": {
    foundedYear: 2018,
    entity: "Gauntlet Networks, Inc.",
    hq: "New York, NY, United States",
    fundingNote:
      "Raised a $23.8M Series B led by Ribbit Capital at a $1B valuation (2022) and a $125M Series C from SBI Holdings (2026)",
    highlights: [
      "Curates $1.5B+ across 80+ vaults on Morpho, Aera and Kamino, working with 150+ fintechs and institutions",
      "Institutional customers include Apollo Global Management, Coinbase and Circle",
      "Served as Aave's risk manager for four years before moving to vault curation on Morpho in 2024",
    ],
    research: { name: "the Vaultbook", url: "https://vaultbook.gauntlet.xyz" },
    quotes: [
      {
        text: "The company said it currently curates more than $1.5 billion in assets across its vaults and works with more than 150 fintechs and institutions.",
        source: "The Block",
        url: "https://www.theblock.co/post/407723/tarun-chitra-gauntlet-125-million-series-c-funding-sbi-holdings",
        date: "2026-07",
      },
    ],
    cautions: [
      "Ended its four-year Aave engagement abruptly in Feb 2024 — citing 'inconsistent guidelines and unwritten objectives' — and joined rival Morpho within a week; relevant precedent for mandate churn",
    ],
    sources: [
      "https://www.theblock.co/post/407723/tarun-chitra-gauntlet-125-million-series-c-funding-sbi-holdings",
      "https://fortune.com/2026/07/09/gauntlet-defi-vault-risk-curation-tarun-chitra-sbi-holdings-fundraise/",
      "https://vaultbook.gauntlet.xyz/",
      "https://cointelegraph.com/news/gauntlet-joins-morpho-after-abrupt-end-with-aave",
    ],
  },

  "tc:etherfi": {
    fundingNote:
      "Raised a $5.3M seed led by North Island Ventures and Chapter One (2023) and a $23M Series A co-led by Bullish Capital and CoinFund (2024)",
    highlights: [
      "TVL grew from $103M to $1.66B during the early-2024 restaking boom, reaching ~2.7M ETH (~$4.4B) by April 2025",
      "Pivoted toward a 'DeFi neobank' model in 2025, rolling out a Visa 'Cash' card in select US states",
    ],
    quotes: [
      {
        text: "It currently has 2.7 million ETH ($4.4 billion) in TVL, a near record high in ETH terms, according to DefiLlama.",
        source: "CoinDesk",
        url: "https://www.coindesk.com/business/2025/04/24/ether-fi-pivots-to-become-neobank-rolls-out-cash-cards-in-u-s",
        date: "2025-04",
      },
    ],
    cautions: [
      "September 2024: attackers attempted a takeover of the project's domain-registrar account; the team locked it within ~3 hours and no user funds were lost",
    ],
    sources: [
      "https://www.coindesk.com/business/2024/02/28/liquid-restaking-protocol-etherfi-raises-23m-series-a",
      "https://www.coindesk.com/business/2025/04/24/ether-fi-pivots-to-become-neobank-rolls-out-cash-cards-in-u-s",
      "https://cointelegraph.com/news/etherfi-domain-takeover-attempt-secured-no-funds-lost",
    ],
  },

  "0x44c4a5026a9af1e10c3b6a5a4f8d7c5e0e3d7f2a": {
    foundedYear: 2023,
    entity: "Spark — a 'Star' (subDAO) of Sky, originally built by Phoenix Labs",
    highlights: [
      "Fourth-biggest DeFi protocol by deposits as of mid-2025, just below its $8.6B all-time high",
      "Ran the $1B 'Tokenization Grand Prix' (2025): $500M to BlackRock/Securitize's BUIDL, $300M to Superstate's USTB, $200M to Centrifuge's JTRSY, with 39 applications evaluated by Steakhouse Financial",
      "SparkLend launched 2023 on the Aave v3 codebase with a profit-share pledge to Aave DAO",
    ],
    quotes: [
      {
        text: "Spark is the fourth biggest DeFi protocol by deposits.",
        source: "DL News",
        url: "https://www.dlnews.com/articles/defi/spark-gives-away-300-million-spk-tokens-in-first-airdrop/",
        date: "2025-06",
      },
    ],
    cautions: [
      "Governed as a Sky subDAO, so strategy and balance sheet depend on Sky governance; in 2024 Aave delegates accused it of underpaying the pledged 10% profit share ('the actual revenue share is much closer to 1%')",
    ],
    sources: [
      "https://thedefiant.io/news/defi/makerdao-launches-spark-lending-protocol",
      "https://www.coindesk.com/business/2025/03/18/blackrock-s-buidl-superstate-and-centrifuge-win-spark-s-usd1b-tokenized-asset-windfall-report",
      "https://www.dlnews.com/articles/defi/spark-gives-away-300-million-spk-tokens-in-first-airdrop/",
      "https://www.dlnews.com/articles/defi/aave-dao-and-makerdao-clash-over-spark-profit-sharing-deal/",
    ],
  },

  "0x3f32bc09d41ee699844f8296e806417d6bf61bba": {
    entity: "Sky (formerly MakerDAO) — decentralized autonomous organization",
    highlights: [
      "Issuer of the largest decentralized stablecoin (USDS/DAI, $5B+), one of the oldest and largest DeFi lenders",
      "Rebranded from MakerDAO in 2024, launching USDS and the SKY governance token with ~$7B in protocol assets",
      "Its lending subDAO Spark ranks among the largest DeFi protocols by deposits",
    ],
    quotes: [
      {
        text: "Sky, the issuer behind the largest decentralized stablecoin worth more than $5 billion on the market, could benefit greatly.",
        source: "CoinDesk",
        url: "https://www.coindesk.com/business/2024/12/10/rune-christensen-revamping-the-maker-sky",
        date: "2024-12",
      },
    ],
    cautions: [
      "'Black Thursday' (March 2020): mempool congestion let bots win collateral auctions with zero-DAI bids, extracting $8.3M; Maker-affiliated defendants later settled with liquidated users",
    ],
    sources: [
      "https://www.coindesk.com/business/2024/08/27/makerdao-is-now-sky-as-7b-crypto-lender-rolls-out-new-stablecoin-governance-token",
      "https://www.coindesk.com/business/2024/12/10/rune-christensen-revamping-the-maker-sky",
      "https://www.coindesk.com/tech/2020/07/22/mempool-manipulation-enabled-theft-of-8m-in-makerdao-collateral-on-black-thursday-report",
      "https://blockworks.co/news/maker-settle-black-thursday",
    ],
  },

  "0x827e86072b06674a077f592a531dce4590adecdb": {
    highlights: [
      "Described by Morpho as 'the largest stablecoin risk curator on Morpho by a wide margin' — ~$1.5B in deposits across 51 vaults within 1.5 years, a lead of roughly $1B over the next-largest curator",
      "Selected to evaluate all 39 applications for Spark's $1B Tokenization Grand Prix as the ecosystem's RWA specialist",
      "Founded by MakerDAO's first decentralized Core Unit lead (Sébastien Derivaux); credited with bringing US Treasuries and private credit to Maker's ~$2.5B RWA portfolio",
    ],
    research: { name: "Steakhouse Kitchen", url: "https://kitchen.steakhouse.financial" },
    quotes: [
      {
        text: "Steakhouse Financial sits in the curator seat the same way it does on its public Prime v2 vault, setting collateral parameters, allocations and risk caps.",
        source: "The Defiant",
        url: "https://thedefiant.io/news/defi/zama-morpho-steakhouse-confidential-usdc-yield-vault-ethereum",
        date: "2026-06",
      },
    ],
    cautions: [
      "Reported no direct exposure in the Nov 2025 Stream Finance/xUSD collapse, but acknowledged periods of illiquidity in its higher-yield vaults during the episode",
    ],
    sources: [
      "https://morpho.org/stories/steakhouse",
      "https://thedefiant.io/news/defi/zama-morpho-steakhouse-confidential-usdc-yield-vault-ethereum",
      "https://protos.com/stream-finance-meltdown-winners-and-losers-in-defi-risk-curator-reckoning/",
      "https://www.coindesk.com/business/2025/03/18/blackrock-s-buidl-superstate-and-centrifuge-win-spark-s-usd1b-tokenized-asset-windfall-report",
    ],
  },

  "tc:maple-finance": {
    foundedYear: 2019,
    highlights: [
      "Record $2.2B TVL and ~$1M monthly revenue by mid-2025, driven by the yield-bearing syrupUSDC",
      "Originated $2B+ in loans across 15 pools by 2023; among the first two counterparties in Cantor Fitzgerald's $2B bitcoin lending program (2025)",
      "Founded by ex-National Australia Bank credit/securitisation banker Sid Powell",
    ],
    quotes: [
      {
        text: "Maple's resurgence is rooted in discipline, through tighter credit underwriting, direct lending managed in-house, and product innovation that matches real market needs.",
        source: "DL News",
        url: "https://www.dlnews.com/articles/defi/how-maple-finance-made-comeback-to-reach-1m-monthly-revenue/",
        date: "2025-06",
      },
    ],
    cautions: [
      "December 2022: borrower Orthogonal Trading defaulted on $36M after misrepresenting its FTX exposure, and deposits collapsed ~97% — the episode forced the pivot from unsecured institutional credit to today's overcollateralized, in-house-underwritten model",
    ],
    sources: [
      "https://tioga.substack.com/p/why-we-backed-maple-finance",
      "https://www.coindesk.com/markets/2022/12/05/maple-finance-severs-ties-with-orthogonal-trading-alleging-it-misrepresented-financial-position",
      "https://www.dlnews.com/articles/defi/how-maple-finance-made-comeback-to-reach-1m-monthly-revenue/",
      "https://cointelegraph.com/news/maple-finance-falconx-secure-bitcoin-backed-loans-from-cantor-fitzgerald-report",
    ],
  },

  "tc:jp-morgan": {
    entity:
      "JPMorgan Chase & Co. — on-chain activity runs through Kinexys (formerly Onyx), its blockchain business unit",
    hq: "New York, NY, United States",
    highlights: [
      "Kinexys had executed over $1.5 trillion in cumulative on-chain transactions since 2020, averaging more than $2B daily",
      "JPMD deposit token rolled out for institutional clients on Base in 2025, with B2C2, Coinbase and Mastercard having tested transactions",
      "Enterprise users of the platform include Siemens, BlackRock and Ant International",
    ],
    quotes: [
      {
        text: "JPMorgan's blockchain business has executed over $1.5 trillion of transactions such as intraday repos and cross-border payments since its inception in 2020, processing an average of more than $2 billion a day",
        source: "CoinDesk",
        url: "https://www.coindesk.com/business/2024/11/06/jpmorgan-renames-blockchain-platform-to-kynexis-to-add-on-chain-fx-settlement-for-usd-eur",
        date: "2024-11",
      },
    ],
    sources: [
      "https://www.coindesk.com/business/2024/11/06/jpmorgan-renames-blockchain-platform-to-kynexis-to-add-on-chain-fx-settlement-for-usd-eur",
      "https://www.theblock.co/post/378493/jpmorgan-deposit-token-jpm-coin",
    ],
  },

  "tc:lombard": {
    entity: "Lombard Finance (LBTC)",
    backers: ["Polychain Capital", "Binance Labs", "Franklin Templeton", "Babylon"],
    fundingNote:
      "Raised a $16M seed led by Polychain Capital (2024), with Franklin Templeton participating; Binance Labs invested later that year",
    highlights: [
      "LBTC — the largest Bitcoin-based yield token — reached $1B TVL within 92 days of its August 2024 launch",
      "Governed by a 14-member Security Consortium; contracts audited by six independent firms including OpenZeppelin, Halborn and Veridise",
      "Expanded LBTC to Solana (2025) with day-one integrations on Jupiter, Drift, Kamino and Meteora",
    ],
    quotes: [
      {
        text: "The company, which issues LBTC, the largest Bitcoin-based yield token, will introduce the asset to Solana's largest decentralized applications as part of 'day-one integrations.'",
        source: "The Block",
        url: "https://www.theblock.co/post/368511/bitcoin-staking-startup-lombard-launches-high-yield-lbtc-token-to-solana",
        date: "2025-08",
      },
    ],
    cautions: [
      "Protocol TVL roughly halved from its ~$1.5B August 2025 peak to ~$770M by August 2026 (a mix of outflows and BTC-price effects); no exploit history surfaced in coverage",
    ],
    sources: [
      "https://www.theblock.co/post/303000/polychain-capital-leads-16-million-seed-round-for-bitcoin-restaking-protocol-lombard",
      "https://www.theblock.co/post/368511/bitcoin-staking-startup-lombard-launches-high-yield-lbtc-token-to-solana",
      "https://docs.lombard.finance/frequently-asked-questions/lombard-faq",
    ],
  },

  "tc:telosc": {
    entity: "Telos Consilium SA (Swiss société anonyme)",
    hq: "Ecublens (Lausanne), Switzerland",
    registrations: ["Swiss commercial register: UID CHE-335.179.585"],
    highlights: [
      "Publishes public due-diligence and mechanism research — e.g. the Coinshift USPC due diligence and the 'Kinky IRM' interest-rate-model work implemented with Euler",
      "Positions as on-chain yield and risk infrastructure: vault curation for RWA and DeFi assets, risk markets, and advisory",
    ],
    research: { name: "Telos Consilium Research", url: "https://telosc.com/research" },
    cautions: [
      "Limited third-party coverage and no named team on the official site — diligence rests on registry data and the on-chain track record",
    ],
    sources: [
      "https://telosc.com",
      "https://telosc.com/research/kinky-irm",
      "https://www.moneyhouse.ch/en/company/telos-consilium-sa-10991431241",
    ],
  },

  "tc:usdai": {
    entity: "USD.ai — developed by Permian Labs",
    fundingNote:
      "Raised a $13M Series A led by Framework Ventures (2025), with Dragonfly participating",
    highlights: [
      "Issues USDai and yield-bearing sUSDai against loans to AI firms collateralized by GPU hardware, with short-term US Treasuries as a floor on idle capital",
      "Grew from ~$50M in private-beta deposits (mid-2025) to ~$175M tracked TVL a year later",
    ],
    quotes: [
      {
        text: "USD.AI, developed by Permian Labs, issues loans to emerging AI firms using graphics processing unit (GPU) hardware as collateral, cutting approval times by more than 90% compared with traditional lenders.",
        source: "CoinDesk",
        url: "https://www.coindesk.com/business/2025/08/13/usd-ai-raises-usd13m-to-expand-gpu-backed-stablecoin-lending",
        date: "2025-08",
      },
    ],
    cautions: [
      "Liquidity is structurally constrained by design: sUSDai redemptions batch on a global 30-day epoch with a FIFO queue, the protocol will not terminate GPU loans to meet redemptions, and its own docs state sUSDai is 'not instantly redeemable at par value'",
    ],
    sources: [
      "https://www.coindesk.com/business/2025/08/13/usd-ai-raises-usd13m-to-expand-gpu-backed-stablecoin-lending",
      "https://docs.usd.ai/depositor/susdai",
    ],
  },

  "tc:k3-capital": {
    highlights: [
      "Analyzed in independent academic research (arXiv, Dec 2025) as one of the eight largest risk curators in decentralized credit — $478M TVL, 6.6% of curator-managed TVL in the paper's sample — alongside Gauntlet, Steakhouse and MEV Capital",
      "Cited alongside Gauntlet and Steakhouse as a major curator that never deployed funds to Stream Finance's xUSD ahead of its November 2025 collapse",
    ],
    quotes: [
      {
        text: "Major Curators such as Gauntlet, Steakhouse, and K3 Capital never deployed funds to xUSD, demonstrating that in fulfilling their security responsibilities effectively, Curators, as professional entities, are capable of identifying and mitigating potential risks.",
        source: "Odaily (via Bitget News)",
        url: "https://www.bitget.com/news/detail/12560605049115",
        date: "2025-11",
      },
    ],
    cautions: [
      "Low corporate transparency: no verifiable legal entity, jurisdiction or named team; diligence rests on the on-chain track record",
    ],
    sources: [
      "https://arxiv.org/html/2512.11976v1",
      "https://www.bitget.com/news/detail/12560605049115",
      "https://k3.capital",
    ],
  },

  "tc:rexyz": {
    entity: "Re — on-chain reinsurance platform",
    backers: ["Tribe Capital", "Electric Capital", "Framework", "Morgan Creek Digital"],
    fundingNote:
      "Raised a $14M seed led by Tribe Capital (2022) and a later $7M round led by Electric Capital (2024)",
    registrations: ["Regulated in the Cayman Islands (per CoinDesk, 2024)"],
    highlights: [
      "Launched the first open-ended tokenized reinsurance fund on Avalanche (2024), seeded with a $15M allocation from Nexus Mutual and a deposit from Ava Labs' Vista fund",
      "Institutional yield products reUSD and reUSDe (2025) are KYC/AML-gated and backed by T-bills, delta-neutral basis, and collateralized underwriting of US insurance lines, with Ethena, Pendle and Curve integrations",
    ],
    quotes: [
      {
        text: "First investors of the fund include Nexus Mutual, a crypto insurance alternative provider, with a $15 million allocation and the RWA-focused Vista fund of Ava Labs, an ecosystem developer organization of Avalanche, with a smaller deposit.",
        source: "CoinDesk",
        url: "https://www.coindesk.com/business/2024/05/14/rwa-platform-re-debuts-tokenized-reinsurance-fund-on-avalanche-with-15m-commitment-from-nexus-mutual",
        date: "2024-05",
      },
    ],
    cautions: [
      "Insurance-linked yield carries real underwriting tail risk (the flagship fund targeted up to 23% annualized with a one-year lock-up); premium-backing figures are company statements, not audited underwriting results",
    ],
    sources: [
      "https://www.reinsurancene.ws/blockchain-powered-reinsurer-re-raises-14-million-seed-round/",
      "https://www.coindesk.com/business/2024/05/14/rwa-platform-re-debuts-tokenized-reinsurance-fund-on-avalanche-with-15m-commitment-from-nexus-mutual",
      "https://www.prnewswire.com/news-releases/re-expands-institutional-offerings-on-avalanche-with-new-reinsurance-yield-products-and-points-program-302527953.html",
    ],
  },

  "tc:hyperliquid": {
    foundedYear: 2023,
    entity:
      "HLP — protocol-owned community vault on the Hyperliquid L1 (not a legal fund entity)",
    fundingNote:
      "Hyperliquid never raised venture capital — founder Jeff Yan (ex-Hudson River Trading) self-funded development, and the 2024 HYPE airdrop went to users rather than private investors",
    highlights: [
      "Open-access vault: USDC depositors share proportionally in market-making, funding-rate and backstop-liquidation PnL across 100+ perp markets, with no performance fee",
      "~$137M cumulative profit since the May 2023 launch; earned ~$41.5M in the Oct 2025 flash crash — its best days are the market's worst",
    ],
    quotes: [
      {
        text: "HLP's best days are the market's worst",
        source: "CoinGecko Research",
        url: "https://www.coingecko.com/learn/hyperliquid-hlp-vault-analysis",
        date: "2026-07",
      },
    ],
    cautions: [
      "March 2025 JELLY incident: a price manipulation drove HLP's unrealized losses to ~$13.5M before validators delisted and force-settled the market (HLP closed slightly profitable) — depositors bear vault PnL directly, with validator-set discretion rather than fund-style governance",
    ],
    sources: [
      "https://www.coindesk.com/markets/2025/03/26/hyperliquid-delists-jellyjelly-after-vault-squeezed-in-usd13m-tussle",
      "https://www.coingecko.com/learn/hyperliquid-hlp-vault-analysis",
      "https://www.datawallet.com/crypto/who-is-jeff-yan-hyperliquid",
    ],
  },

  "tc:fasanara": {
    foundedYear: 2011,
    entity: "Fasanara Capital Ltd",
    hq: "London, United Kingdom",
    registrations: ["UK FCA-regulated investment firm"],
    highlights: [
      "$4.5B AUM and 200+ staff; fintech-credit 'hub-and-spoke' model spanning ~140 loan originators in 60+ countries, focused on SME receivables",
      "Investor base is predominantly pension funds, insurers and banks — the European Investment Fund is among its clients",
      "Launched the tokenized money market fund 'FAST' on Polygon (2025) with Apex Group as administrator",
    ],
    quotes: [
      {
        text: "The London-headquartered firm has developed a 'hub-and-spoke' platform-of-platforms model involving 140 loan originators in over 60 countries, focused mainly on the small-to-medium enterprise (SME) space.",
        source: "Alternatives Watch",
        url: "https://www.alternativeswatch.com/2024/07/29/interview-alternative-credit-manager-fasanara-francesco-filia-fintech-lending/",
        date: "2024-07",
      },
    ],
    sources: [
      "https://www.fasanara.com/about",
      "https://www.alternativeswatch.com/2024/07/29/interview-alternative-credit-manager-fasanara-francesco-filia-fintech-lending/",
      "https://www.marketsmedia.com/fasanara-capital-launches-its-first-tokenized-money-market-fund/",
    ],
  },

  "0x75178137d3b4b9a0f771e0e149b00fb8167ba325": {
    foundedYear: 2018,
    entity: "Hyperithm",
    hq: "Tokyo, Japan & Seoul, South Korea",
    backers: ["Hashed", "Coinbase Ventures", "Samsung Next", "Wemade Tree"],
    fundingNote:
      "Raised an $11M Series B co-led by Hashed and Wemade Tree (2021), with Coinbase Ventures participating",
    highlights: [
      "Serves institutional clients — listed companies, family offices, VCs, exchanges and miners",
      "Engineering team includes multiple International Math and Science Olympiad medalists; trading systems built in Rust",
    ],
    cautions: [
      "Public scale figures date to the 2021 funding round; no recent audited AUM disclosure found",
    ],
    sources: [
      "https://www.prnewswire.com/news-releases/digital-asset-manager-hyperithm-raises-11m-in-series-b-round-301355409.html",
      "https://www.samsungnext.com/blog/why-we-invested-in-hyperithm-a-private-digital-asset-manager",
      "https://app.vaults.fyi/opportunity/mainnet/0x777791C4d6DC2CE140D00D2828a7C93503c67777",
    ],
  },

  "0xbbacdcfb9691dfa1066ab29edfcc4a73f6def918": {
    foundedYear: 2018,
    entity: "RockawayX (formerly Rockaway Blockchain Fund)",
    hq: "Prague, Czech Republic",
    fundingNote:
      "Manages ~$2B including a $125M second early-stage venture fund closed in 2025",
    highlights: [
      "~$2B AUM, 45 staff across Prague, Dubai and London — two-thirds engineers, operating its own data centers",
      "2021 fund marked at over 5x invested capital on early Solana, Wintermute and Morpho Labs positions",
      "Vault-curation arm passed $100M TVL in May 2026 across Morpho, Upshift, Lista and Kamino strategies (self-reported)",
    ],
    research: { name: "RockawayX Insights", url: "https://www.rockawayx.com/insights" },
    quotes: [
      {
        text: "the firm now oversees about $2 billion, operates its own data centers and employs 45 people, two-thirds of them engineers, across Prague, Dubai and London offices.",
        source: "Forbes",
        url: "https://www.forbes.com/sites/digital-assets/2025/04/24/solanas-2-billion-early-backer-rockawayx-launches-new-125-million-fund/",
        date: "2025-04",
      },
    ],
    cautions: [
      "RockawayX is an early investor in Morpho Labs and also curates vaults on Morpho — an alignment allocators should be aware of",
    ],
    sources: [
      "https://www.forbes.com/sites/digital-assets/2025/04/24/solanas-2-billion-early-backer-rockawayx-launches-new-125-million-fund/",
      "https://decrypt.co/316094/investment-firm-rockawayx-125m-early-stage-fund-solana-projects",
      "https://www.rockawayx.com/insights/rockawayx-vault-curation-surpasses-100m-in-tvl",
    ],
  },
};

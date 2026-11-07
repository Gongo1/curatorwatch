---
version: 1
slug: "src-app-layout-tsx"
primary_target: "src/app/layout.tsx"
related_targets: ["src/app/home-client.tsx","src/components/gate/CreateAccountModal.tsx"]
---

# Surface: CuratorWatch app shell, home, and sign-up (site-wide redesign)

Scope: every route through the shared shell and tokens; home and the sign-up flow rebuilt in full. Mode: **Operate** (home is the working screen of the product, not a landing page). Audience: allocators first. Constraints: account wall stays (anon = home top-3 + docs + changelog); no grades, no deposits; standard web controls.

Build path: code-led (Operate surface; no image generation available). Direction pinned by the user ("The Terminal"), so no concept roll.

## Direction contract

THESIS: CuratorWatch is the curator market's terminal: one black screen of dense, labeled numbers you drive from the keyboard. It refuses the category default of a rounded-card SaaS dashboard with a hero metric and a ranking buried below the fold.

OWN-WORLD: Near-black warm ground; panels separated by 1px hairlines, square corners. Amber is the only brand color: panel titles, field labels, the active function, focus, and the primary action (amber fill, black text). Values are off-white; change is green or red, nothing else is colored. Archivo, semi-condensed and uppercase, carries labels and titles; Archivo at normal width carries prose; JetBrains Mono carries figures, codes, and the command line only. Rows 28px.

STORY: An allocator lands, reads the market line (TVL, curators, vaults, stablecoin share, stress), sees the curator ranking at once, and jumps anywhere by typing a function code or curator name. Anonymous visitors get the top 3 and one short sign-up: email, then a code that submits itself.

FIRST VIEWPORT: Sticky top bar: logo, command field "Function or curator <GO>", UTC clock, account. Under it, a function bar with keys 1–8. Then a full-width market line. Below that, a 2/3 + 1/3 grid: the curator ranking panel on the left; stress, asset mix, and concentration panels stacked on the right.

FORM: Bloomberg Terminal (user-pinned), translated to standard web controls: the function bar is real navigation with number-key shortcuts; the command field is a real combobox. Signature move: the <GO> command line with function mnemonics (CMP, YLD, FEE, LIQ, CALC, DLY, ALRT…) shown as code tags on every page title. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

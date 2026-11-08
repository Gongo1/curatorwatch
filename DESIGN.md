---
name: CuratorWatch
description: The curator market's terminal. One black screen of dense, labeled numbers you drive from the keyboard.
colors:
  ground: "oklch(13% 0.004 70)"
  panel: "oklch(16.5% 0.005 70)"
  title-bar: "oklch(20% 0.006 70)"
  hover: "oklch(23.5% 0.008 70)"
  hairline: "oklch(30% 0.008 70)"
  hairline-subtle: "oklch(23% 0.006 70)"
  hairline-strong: "oklch(40% 0.01 70)"
  value-white: "oklch(95% 0.01 85)"
  text-secondary: "oklch(78% 0.012 80)"
  label-grey: "oklch(66% 0.012 78)"
  text-muted: "oklch(58% 0.01 75)"
  amber-signal: "oklch(79% 0.16 66)"
  amber-signal-hover: "oklch(85% 0.15 72)"
  signal-ink: "oklch(14% 0.01 66)"
  up-green: "oklch(77% 0.17 148)"
  up-green-muted: "oklch(45% 0.1 148)"
  down-red: "oklch(67% 0.21 27)"
  down-red-muted: "oklch(42% 0.13 27)"
  warn-yellow: "oklch(89% 0.15 100)"
  warn-yellow-muted: "oklch(48% 0.09 100)"
  chart-1: "oklch(79% 0.16 66)"
  chart-2: "oklch(80% 0.11 215)"
  chart-3: "oklch(92% 0.01 85)"
  chart-4: "oklch(70% 0.2 345)"
  chart-5: "oklch(77% 0.16 148)"
  chart-6: "oklch(68% 0.15 295)"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 80"
  figure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.45rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "'tnum'"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 78"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
  data:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.733rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
    fontVariation: "'wdth' 78"
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.733rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
rounded:
  none: "0px"
  dot: "9999px"
spacing:
  gutter: "0.375rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  row: "28px"
  panel-head: "1.95rem"
components:
  button-primary:
    backgroundColor: "{colors.amber-signal}"
    textColor: "{colors.signal-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "0 0.85rem"
    height: "2.1rem"
  button-primary-hover:
    backgroundColor: "{colors.amber-signal-hover}"
    textColor: "{colors.signal-ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.value-white}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "0 0.85rem"
    height: "2.1rem"
  button-ghost-hover:
    textColor: "{colors.amber-signal}"
  field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.value-white}"
    rounded: "{rounded.none}"
    padding: "0 0.7rem"
    height: "2.2rem"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.none}"
  panel-head:
    backgroundColor: "{colors.title-bar}"
    textColor: "{colors.amber-signal}"
    typography: "{typography.title}"
    padding: "0 0.6rem"
    height: "{spacing.panel-head}"
  fn-tag:
    backgroundColor: "{colors.amber-signal}"
    textColor: "{colors.signal-ink}"
    typography: "{typography.code}"
    rounded: "{rounded.none}"
    padding: "0.3rem 0.4rem"
  function-key:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-secondary}"
    padding: "0 0.75rem"
    height: "2.25rem"
  function-key-active:
    backgroundColor: "{colors.amber-signal}"
    textColor: "{colors.signal-ink}"
  grid-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.value-white}"
    typography: "{typography.data}"
    height: "{spacing.row}"
---

# Design System: CuratorWatch

## Overview

**Creative North Star: "The Terminal"**

CuratorWatch is the curator market's terminal: one warm near-black screen of dense, labeled numbers, driven from the keyboard. The form is the Bloomberg Terminal translated into standard web controls. The function bar is real navigation with number keys 1 to 8; the command line is a real combobox that takes a function mnemonic (CMP, YLD, FEE, LIQ, CALC, DLY, ALRT) or a curator name and runs on Enter or GO. Every page title carries its mnemonic as an amber code tag.

Density is the point. The root font size is 15px (93.75%, so the reader's own setting still scales it), grid rows are 28px, panels sit 0.375rem apart, and every container is the same hairline panel with a title bar. Hierarchy comes from the width axis of one family (Archivo condensed for labels and titles, normal width for prose), from a tonal step per layer, and from a single brand signal: amber. Everything that is a value reads off-white; color on a number means something.

The system rejects the rounded-card SaaS dashboard with a hero metric and the ranking buried below the fold. There are no rounded containers, no gradient surfaces, and no decorative color.

**Key Characteristics:**
- Warm near-black ground; elevation steps lighter, never to pure black.
- 1px hairline panels with square corners and an amber title bar.
- Amber is the only brand color; green, red and yellow are data semantics only.
- Archivo on its width axis for all UI text; JetBrains Mono for figures, codes and the command line only.
- 15px root, 28px rows, 0.375rem gutters: terminal density.
- Keyboard first: "/" or Cmd+K focuses the command line; 1 to 8 jump between functions.

## Colors

A warm, low-chroma near-black ladder carrying off-white values, with one saturated amber signal and a strict semantic trio for data.

Token names in code are legacy and were kept so every existing utility re-renders in this world: `--accent-blue` is the amber signal, `--accent-blue-hover` its hover, and `--signal-ink` is the text color on an amber fill. Backgrounds are `--background`, `--background-subtle`, `--background-elevated`, `--background-hover`; hairlines are `--border`, `--border-subtle`, `--border-strong`.

### Primary
- **Amber Signal** (`--accent-blue`): panel titles, the active function key, the command prompt and GO button, function mnemonic tags, focus outlines, the caret, link hovers, and the primary action fill. Selection highlight and selected grid rows use the same hue at low alpha.
- **Amber Signal Hover** (`--accent-blue-hover`): hover state of amber fills only.
- **Signal Ink** (`--signal-ink`): text on an amber fill (primary button, active function key, fn tag, GO). Never on any other surface.

### Secondary (data semantics, not brand)
- **Up Green** (`--accent-green`): positive signed change and good state (Available, Calm/Normal stress, the live dot). Muted variant for fills and borders behind it.
- **Down Red** (`--accent-red`): negative signed change and bad state (a loss, a failure, bad debt above zero, Taken, Critical stress). Muted variant for fills and borders.
- **Warn Yellow** (`--accent-yellow`): warnings only (stale data, Elevated/Stressed stress, a concentration over a threshold the row does not already imply). Muted variant for chip borders.

### Tertiary (plot palette)
- **Chart 1 to 6** (`--chart-1` .. `--chart-6`): amber, cyan, white, magenta, green, violet, in that order. Used for multi-series charts and the asset-mix bar so six stacked curators can be told apart. "Other" buckets use Text Muted.

### Neutral
- **Ground** (`--background`): page canvas, field interiors, the command line.
- **Panel** (`--background-subtle`): panel bodies, function bar, footer status line, grid body, modal body.
- **Title Bar** (`--background-elevated`): panel heads and grid headers.
- **Hover** (`--background-hover`): row hover, active command result, inactive function-key hover.
- **Hairline** (`--border`): panel borders, panel-head bottom rules, function-key separators, page-header rule.
- **Hairline Subtle** (`--border-subtle`): row dividers inside tables and grids.
- **Hairline Strong** (`--border-strong`): input and ghost-button strokes, scrollbar thumb, resize handles.
- **Value White** (`--text-primary` / `--foreground`): every value, every title, every name.
- **Text Secondary**: prose descriptions, inactive function labels, header-cell text.
- **Label Grey** (`--text-tertiary`): field labels, panel meta, quiet qualifiers.
- **Text Muted**: placeholders, separators, the "UTC" suffix.

### Named Rules
**The One Signal Rule.** Amber is the only brand color. It marks panel titles, the active function, focus and the primary action, and nothing decorative. Text on amber is always Signal Ink.

**The Off-White Values Rule.** A value is off-white unless it carries meaning: green or red for signed change and good/bad state, yellow for a warning. Never color a number for emphasis or variety.

**The Plot Palette Rule.** Multi-series charts take Chart 1 to 6 in order, amber first. A single-series chart is amber.

## Typography

**Display Font:** Archivo, condensed via the `wdth` axis (with system-ui, sans-serif)
**Body Font:** Archivo at normal width (with system-ui, -apple-system, sans-serif)
**Label/Mono Font:** JetBrains Mono (with ui-monospace)

**Character:** One variable family does the terminal work: squeezed to 78-85% width and uppercased it becomes labels, titles and the function bar; at normal width it reads as prose. JetBrains Mono is reserved for figures, codes and the command line. The body sets `tabular-nums` globally so every column lines up.

### Hierarchy
- **Display** (700, 1.45rem, line-height 1, wdth 80): page titles beside the fn tag; the sign-up heading uses the same voice at 1.35rem.
- **Figure** (JetBrains Mono 600, 1.45rem, line-height 1): quote-line values (Tracked TVL, Curators, Stress index). A name in a quote cell uses condensed Archivo 700 at 1.3rem instead.
- **Title** (700, 0.8rem, 0.06em, uppercase, wdth 78): panel titles in amber; buttons use the same build at wdth 85 and 0.04em.
- **Body** (400, 0.875rem): descriptions, panel prose, modal copy; page descriptions cap at 75ch.
- **Data** (13px, line-height 1.4): grid cells; numeric cells are mono and right-aligned.
- **Label** (600, 0.733rem / 11px, 0.05em, uppercase, wdth 78, Label Grey): field labels, grid headers, quote keys, footer status line, breadcrumbs.
- **Code** (JetBrains Mono 700, 0.733rem, 0.04em): function mnemonics, function-key numbers, the command prompt and input, GO.

### Named Rules
**The Width Axis Rule.** Hierarchy comes from Archivo's width axis, weight and case, not from extra families. Condensed uppercase labels and titles; normal-width prose.

**The Mono Means Data Rule.** JetBrains Mono carries figures, codes and the command line only. It is never a label costume.

## Layout

A full-bleed working screen capped at 1680px and padded 0.75rem. The sticky header stacks two bars: a 44px top bar (logo, command line up to 34rem, live status, UTC clock, account) and a 36px function bar (numbered keys left, Changelog and Docs right, horizontally scrollable on narrow screens). Pages open with a page bar: fn tag, condensed title, one line of context, actions right, ruled off with a hairline.

Panels tile on a 0.375rem gutter. Home runs a full-width market line (a quote row of 6 cells at desktop, 3 at tablet, 2 at mobile), then a two-column grid: the work on the left (`minmax(0,1fr)`) and a 23rem context rail on the right, collapsing to one column below the lg breakpoint. Inner spacing runs in small steps: 0.375rem, 0.5rem, 0.75rem, 1rem. Rows are 28px in grids and 28px (`h-7`) in hand-built tables. Below md the command line moves behind a toggle button in the top bar.

## Elevation & Depth

Flat and tonal. Resting surfaces never cast shadows; depth is a lightness ladder (Ground, Panel, Title Bar, Hover), each step lighter, and every edge is a 1px hairline. Only floating layers that sit over content take a shadow: soft, deep, black-based, with a negative spread so the edge stays crisp.

### Shadow Vocabulary
- **Dropdown** (`box-shadow: 0 12px 32px -8px oklch(0% 0 0 / 0.7)`): command-line result list.
- **Overlay card** (`box-shadow: 0 16px 40px -12px oklch(0% 0 0 / 0.8)`): the gate card over a locked table.
- **Modal** (`box-shadow: 0 24px 60px -16px oklch(0% 0 0 / 0.9)`): the account modal, over an `oklch(8% 0.004 70 / 0.78)` scrim.

### Named Rules
**The Lighter-Up Rule.** Elevation gets lighter, never darker; nothing is pure #000. A raised surface is the next step on the ladder plus a hairline.

**The Floating-Only Shadow Rule.** Shadows exist only on layers that float over content (dropdown, overlay card, modal). Panels, buttons and rows are flat.

## Shapes

Square everywhere. Every Tailwind radius step is redefined to 0px, AG Grid wrapper and card radii are 0, and scrollbars are thin square thumbs. The only round shapes are status dots (`rounded-full`): the live indicator and list bullets. Forms are joined, not floated: the command line is prompt, input and GO butted together; the email field and its Send Code button share an edge. Floating layers mark themselves with an amber 1px border instead of a softer silhouette.

### Named Rules
**The Square Rule.** Corners are 0px. Round is reserved for status dots.

## Components

### Buttons
Blunt, uppercase, compact.
- **Shape:** square (0px), 2.1rem tall, 0 0.85rem padding, 1px border.
- **Primary:** Amber Signal fill, Signal Ink text, Archivo 700 0.8rem uppercase at wdth 85, 0.04em tracking.
- **Hover / Focus:** primary fill lifts to Amber Signal Hover; 150ms ease-out color transitions; focus is the global 1px amber outline at 1px offset. Disabled is 45% opacity.
- **Ghost:** transparent with a Hairline Strong stroke and Value White text; hover turns stroke and text amber.

### Chips
- **Style:** square hairline in the state color, no fill (stress bands: green for Calm/Normal, yellow for Elevated/Stressed, red for Critical), label type.
- **Segmented filters:** joined square cells; the active one fills amber with Signal Ink.

### Cards / Containers
The panel is the one container.
- **Corner Style:** square (0px).
- **Background:** Panel body, Title Bar head.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Hairline; the head is ruled off with a 1px Hairline bottom.
- **Head:** 1.95rem tall, 0.6rem side padding; amber condensed uppercase title left (can link to its function), Label Grey meta right (Archivo at wdth 85, 0.75rem, truncates), optional action after it.
- **Internal Padding:** 0.75rem for prose and charts; tables run edge to edge.

### Inputs / Fields
- **Style:** Ground interior, 1px Hairline Strong stroke, square, 2.2rem tall, 0.7rem side padding, 0.9rem text; placeholder in Text Muted.
- **Focus:** stroke turns amber, no glow; 150ms ease-out.
- **One-time code:** six square Ground cells, 3rem tall, mono figures at 1.4rem; the code submits itself on the sixth digit.

### Navigation
- **Function bar:** Panel-colored strip, 36px tall, keys separated by Hairline rules. Each key shows its number in amber mono and its name in condensed uppercase 0.8rem semibold. Inactive text is Text Secondary (Label Grey for the unnumbered right group); hover moves to the Hover surface and Value White. The active key fills amber with Signal Ink, and its number flips to Signal Ink. The Alerts key carries a mono count badge.
- **Mobile:** the bar scrolls horizontally with the scrollbar hidden; the command line opens from a square search toggle.

### Command Line (signature)
A `>` prompt in amber mono, an uppercase mono input, a "/" key hint that hides on focus, and an amber GO button, all joined on a Hairline Strong stroke. Results drop in a Panel list with the Dropdown shadow: 32px rows, the mnemonic in amber mono (CUR in Label Grey for curators), the name, and a right-aligned label or mono AUM. The active row takes the Hover surface.

### Quote Line (signature)
A panel holding a `<dl>` grid of cells, each 0.75rem by 0.625rem padded and split by Hairline rules: a label key over a figure, with an optional label or mono qualifier. Values are Value White unless the cell carries signed change or state.

### Function Tag (signature)
The page's mnemonic as a solid amber block with Signal Ink mono text, sitting left of every page title.

### Data Grid
AG Grid themed to the panel: Panel body, Title Bar header with label-style uppercase condensed headers, 28px header and rows, 10px cell padding, Hairline Subtle row rules, no column separators, Hover row, amber range and checkbox accents, selected rows at 8% amber. Numeric columns right-align header and cell.

## Do's and Don'ts

### Do:
- **Do** build every container as a panel: Panel body, 1px Hairline, square corners, Title Bar head with an amber condensed uppercase title.
- **Do** put the page's function mnemonic in an amber fn tag beside the page title.
- **Do** keep values off-white and reserve green/red for signed change and good/bad state, yellow for warnings.
- **Do** use Chart 1 to 6 in order for multi-series charts, amber first; use amber alone for a single series.
- **Do** set figures in JetBrains Mono with tabular numerals, right-aligned in columns.
- **Do** keep rows at 28px and panels on a 0.375rem gutter.
- **Do** use Signal Ink for any text on an amber fill.

### Don't:
- **Don't** round corners. The only round shape is a status dot.
- **Don't** add a second brand color or use amber for decoration; it marks titles, the active function, focus and the primary action.
- **Don't** use JetBrains Mono for labels; labels are condensed uppercase Archivo.
- **Don't** shadow resting surfaces; shadows belong to dropdowns, overlay cards and modals only.
- **Don't** use pure #000 or step elevation darker than the ground.
- **Don't** use yellow for anything that is not a warning.

---
name: Buching
description: Restrained operational workspace for teams running classes, workshops, and scheduled offerings.
colors:
  primary: "oklch(0.62 0.21 38.4)"
  primary-foreground: "oklch(0.98 0.016 73.684)"
  background: "oklch(0.994 0.004 73)"
  foreground: "oklch(0.145 0.006 55)"
  card: "oklch(0.998 0.003 73)"
  muted: "oklch(0.965 0.006 73)"
  muted-foreground: "oklch(0.52 0.012 55)"
  secondary: "oklch(0.967 0.001 286.375)"
  secondary-foreground: "oklch(0.21 0.006 285.885)"
  accent: "oklch(0.62 0.21 38.4)"
  border: "oklch(0.91 0.008 73)"
  ring: "oklch(0.62 0.09 38.4)"
  destructive: "oklch(0.577 0.245 27.325)"
  success: "oklch(0.62 0.17 150)"
  success-foreground: "oklch(0.98 0.02 150)"
  info: "oklch(0.6 0.18 245)"
  info-foreground: "oklch(0.98 0.02 245)"
  warning: "oklch(0.78 0.16 75)"
  warning-foreground: "oklch(0.28 0.06 75)"
  sidebar: "oklch(0.982 0.006 73)"
  sidebar-foreground: "oklch(0.145 0.006 55)"
  sidebar-accent: "oklch(0.955 0.008 73)"
typography:
  display:
    fontFamily: "Instrument Sans Variable, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
  micro:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
  nano:
    fontFamily: "Inter Variable, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 0.875
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  2xl: "1.125rem"
  3xl: "1.375rem"
  4xl: "1.625rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
  3xl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "1rem"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  badge-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.success-foreground}"
    rounded: "1rem"
  badge-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.warning-foreground}"
    rounded: "1rem"
  badge-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "1rem"
  card-surface:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  input-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "2.25rem"
  empty-state:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "3rem"
  sidebar-nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: "2.25rem"
  sidebar-nav-item-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
---

# Design System: Buching

## 1. Overview

**Creative North Star: "The Quiet Workshop"**

Buching is a workspace for operators — owners, admins, managers, staff who run classes, workshops, programs, and scheduled offerings. The interface should feel like a capable productivity tool, not a marketing site or playful consumer app. Calm, operational, trustworthy. Color is reserved for status, feedback, and primary action; the routine workspace stays muted.

The system is built on shadcn-style primitives with a single warm orange-red accent (oklch primary) carried sparingly across CTAs, sidebar branding, and the calendar now-line. Most chrome is tinted neutral cream — never pure white, never pure gray. Density matters: tables, calendar grids, and operational panels hold a lot of information per screen, so type drops below the standard 12px floor when grids demand it (`text-2xs` 11px, `text-3xs` 10px) but never silently.

The system explicitly rejects: generic GPT/shadcn card mosaics, marketing-page hero treatments, ornamental gradients, glassmorphism, hero-metric SaaS templates, and identical-card grids that turn every screen into the same icon-heading-paragraph stack.

**Key Characteristics:**
- Restrained color, one warm-orange accent, tinted neutrals throughout
- Typography and spacing first; borders and dense containers second
- Sidebar navigation, table-first density, kanban lanes, calendar grids
- Subtle shadows for elevation, full borders never side-stripes
- shadcn primitives, Base UI behavior, Tailwind v4 tokens, OKLCH source of truth

## 2. Colors

A warm-cream surface palette with a single saturated orange-red accent. Status hues (success/info/warning/destructive) appear only on chips, badges, and inline state indicators; never on routine chrome.

### Primary

- **Workshop Ember** (`oklch(0.62 0.21 38.4)`): The single brand accent. Carries primary CTAs, active sidebar selection ring, the calendar now-line, hover affordances on key links. Used on ≤10% of any given screen.

### Neutral

- **Warm Cream** (`oklch(0.994 0.004 73)`): Page background. Tinted toward primary's hue (chroma 0.004) — never `#fff`.
- **Card Cream** (`oklch(0.998 0.003 73)`): Cards, popovers, sheets. A half-step brighter than the page so elevated surfaces read as raised without a shadow.
- **Sidebar Stone** (`oklch(0.982 0.006 73)`): Sidebar surface. A half-step darker than the page so the workspace splits visually without a divider line.
- **Quiet Mist** (`oklch(0.965 0.006 73)`): Muted regions — empty-state surfaces, table-row hover, hover backgrounds for ghost buttons. Same hue family.
- **Stone Reading** (`oklch(0.52 0.012 55)`): Body muted-foreground. Used for secondary information, table cell metadata, label text.
- **Carbon Reading** (`oklch(0.145 0.006 55)`): Foreground. Headings, primary body text. Tinted toward the warm hue — never `#000`.
- **Ash Border** (`oklch(0.91 0.008 73)`): Borders, divider lines, input strokes.

### Status

- **Trust Green** (`oklch(0.62 0.17 150)`): Success states — confirmed registrations, copy-confirm, payment received, heat-map intensity ramp.
- **Signal Blue** (`oklch(0.6 0.18 245)`): Informational — neutral status badges, "upcoming" event flags.
- **Saffron Caution** (`oklch(0.78 0.16 75)`): Warning — waitlist counts, soft non-blocking flags. Never used for errors.
- **Brake Red** (`oklch(0.577 0.245 27.325)`): Destructive — delete confirmations, error alerts, validation errors. Always paired with foreground in 10/20% tints, never as flat fill on routine chrome.

### Named Rules

**The One Accent Rule.** Workshop Ember appears on ≤10% of any given screen. Its rarity is the affordance. If a second saturated color creeps in (a different orange, an unrelated red), it is wrong; consolidate to the primary or move it to the status palette.

**The Tinted Neutral Rule.** Every neutral carries a trace of the brand hue (chroma 0.003–0.012). Pure gray (chroma 0) is forbidden. Pure white (`#fff`) is forbidden.

**The Status-Only Color Rule.** Reds, yellows, and greens are reserved for status: success, warning, info, destructive. Never decorate with them. If a feature looks dull in monochrome, fix the typography or layout, not the palette.

## 3. Typography

**Display Font:** Instrument Sans Variable (with sans-serif fallback). Reserved for the largest workspace headings.
**Body Font:** Inter Variable (with sans-serif fallback). All UI chrome, tables, forms, body copy.

**Character:** Inter at body sizes is unobtrusive — it gets out of the way of dense data. Instrument Sans on the largest moments adds a single editorial note without breaking the operational mood. The pairing is "workshop dashboard" not "magazine spread".

### Hierarchy

- **Display** (Instrument Sans, 600, 1.25rem, line-height 1.2, letter-spacing -0.02em): Page-level headings on dashboard sections, the topmost visible chrome.
- **Headline** (Inter, 600, 1.125rem / `text-lg`, line-height 1.3): Empty-state titles, prominent section headers in detail pages.
- **Title** (Inter, 600, 1rem / `text-base`, tight tracking): Detail-form section headers ("Core details", "Contact"), card titles inside dense panels.
- **Body** (Inter, 400, 0.875rem / `text-sm`, line-height 1.5): Default body, table cell content. Max 65–75ch in long-form prose.
- **Caption** (Inter, 400, 0.75rem / `text-xs`): Form labels, table headers, secondary metadata.
- **Micro** (Inter, 500, 0.6875rem / `text-2xs`): Inline filter chips, density-critical pill counts. Used sparingly.
- **Nano** (Inter, 500, 0.625rem / `text-3xs`): Calendar cell densities, badge labels, density-critical grid metadata. Lower bound; never go smaller.

### Named Rules

**The Density-Token Rule.** Type below 12px must come from `text-2xs` (11px) or `text-3xs` (10px) — never ad-hoc `text-[10px]` or `text-[10.5px]`. The two density tokens exist precisely so the calendar/data grids stay disciplined.

**The Hierarchy Ratio Rule.** Adjacent type roles in the same surface must differ by ≥1.25× scale or by weight + size together. Heading and body cannot both be `text-sm`.

**The No-All-Caps-Below-Caption Rule.** Uppercase tracking labels are caption-size or smaller. Never set body text uppercase.

## 4. Elevation

The system is mostly flat. Surface separation comes first from tinted neutrals (page vs. card vs. sidebar), then from full borders, then from shadow. Shadow is reserved for surfaces that genuinely lift off the page: the active sidebar selection, popovers, dialogs, dropdown menus, and the resting outline button.

### Shadow Vocabulary

- **`shadow-xs`** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): The default lift. Outline buttons at rest, active sidebar nav item, empty-state surfaces that opt-in.
- **`shadow-sm`** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): Hover state on calendar event chips.
- **`shadow-md`** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)`): Hover state on calendar event blocks; popover/dropdown surfaces.

### Named Rules

**The Header No-Border Rule.** The main page header never has a `border-bottom`. Visual separation between header and content is created by whitespace and hierarchy, not lines. Same for the sidebar header.

**The Side-Stripe Ban.** A colored `border-left` or `border-right` greater than 1px on cards, list items, callouts, or alerts is forbidden. Use full borders or background tints.

**The Flat-By-Default Rule.** Workspace chrome (sidebar, page header, content cards) is flat. Shadows appear only on truly elevated surfaces: dialogs, popovers, dropdowns, and the active interaction state on a button or nav link.

## 5. Components

### Buttons (`@/components/ui/button`)

- **Shape:** `rounded-md` (0.5rem) by default; `sm` size shrinks to `rounded-md` clamped at 10px. Border `1px transparent` always declared so layout doesn't shift on focus.
- **Primary** (`variant="default"`): Workshop Ember background, primary-foreground text, hover at 80% opacity. Used for the single main action per surface.
- **Outline:** Background tint, `border-border`, `shadow-xs` at rest, muted hover. The default secondary action.
- **Ghost:** Transparent at rest, muted background on hover. Used for nav items, inline icon-only actions, dropdown triggers.
- **Destructive:** `bg-destructive/10`, `text-destructive`. Tinted, never flat-filled. Reserved for delete and irreversible actions.
- **Sizes:** `xs` (h-6), `sm` (h-8), `default` (h-9), `lg` (h-10), plus matching `icon-*` sizes that are square.
- **Focus:** `focus-visible:ring-3 ring-ring/50` outside the border. Never `outline: none` without a replacement.

### Badges (`@/components/ui/badge`)

- **Shape:** Pill (`rounded-4xl`), `h-5`, `px-2`, `text-xs font-medium`.
- **Variants:** `default` (Workshop Ember on primary-foreground), `secondary` (quiet stone), `success` (Trust Green flat), `warning` (Saffron 15% tint with warning-foreground), `destructive` (Brake Red 10% tint), `outline`, `ghost`, `link`.
- **State color rule:** Status variants exist precisely for status; do not use `default` for an "info" badge — pick one of the named status variants.

### Cards / Surfaces

- **Corner Style:** `rounded-lg` (0.625rem) for content cards, `rounded-xl` (0.875rem) for empty states and large panels.
- **Background:** `bg-card` for raised surfaces; `bg-muted/30` for empty states; `bg-background` for page-level.
- **Border:** Full 1px `border-border`, never partial. Empty states use `border-dashed`.
- **Internal padding:** `p-6` for filled cards, `p-12` for empty states (`p-10` for compact empty states inside detail panes).

### Inputs / Fields

- **Style:** `h-9`, `rounded-md`, `border-input` stroke, `bg-transparent`, `shadow-xs`. `text-sm`. Disabled at 50% opacity.
- **Focus:** `focus-visible:ring-1 ring-ring`, no border shift. The ring is enough.
- **Validation error:** `aria-invalid:border-destructive` + `ring-destructive/20`. Inline error text below in `text-xs text-destructive`.

### Empty State (`@/components/empty-state`)

- **Shape:** `rounded-xl border border-dashed bg-muted/30 text-center`.
- **Padding:** `p-12` default, `p-10` compact.
- **Composition:** Icon (`size-8`, `text-muted-foreground/60`) → headline (`text-lg font-semibold tracking-tight`) → description (`text-sm text-muted-foreground`, `max-w-sm`) → optional action (`mt-4`).
- **Icon-less variant:** Headline drops the `mt-3` and pulls flush.

### Filter Chip (`@/routes/_auth/admin/events/~components/filter-chip`)

- **Shape:** `Badge variant="outline"`, `h-5`, `text-3xs`, with an inline X clear button.
- **State:** Hover lifts X-button text from muted to foreground. Focus-visible ring around X.
- **Used for:** Active filter values on tables (Category, Status, Visibility).

### Sidebar Navigation

- **Surface:** `bg-sidebar` (Sidebar Stone), no border-bottom on header.
- **Item:** `h-9 rounded-lg px-3 gap-3`, body-size text, `text-muted-foreground` at rest.
- **Active state:** `border border-ring bg-background text-foreground shadow-xs` + `aria-current="page"`. The ring border is the doctrine signal of a selected workspace area.
- **Collapsed:** Width drops from `w-64` → `w-14`; items justify-center; only icons visible. Toggle button has `aria-expanded` + `aria-label`.

### Tables

- **Density:** Header rows `h-10`, body rows `py-2`. Cell text defaults `text-sm`.
- **Sticky columns:** Both left (sticky title) and right (sticky actions) cells use `bg-background` at rest and `group-hover:bg-muted/40` on row hover. The hover tint must match across sticky cells and the row body.
- **Truncation:** Long text cells use `max-w-* truncate` with a `title` attribute for tooltip. Min-width of 0 on flex/grid containers that hold them.
- **Actions:** Icon-only `MoreHorizontal` dropdown trigger always carries `aria-label` (e.g., "Actions for {row title}").

### Calendar (`/admin/calendar`)

The signature dense surface. Time grid is `text-3xs` for hour labels, `text-2xs` for event titles. The current-time line is a 1px primary stripe with a 12px primary dot at the start. Event chips use `rounded-sm` and `ring-1 ring-border/70` (subtle ring, not full border) to keep the grid quiet.

## 6. Do's and Don'ts

### Do:
- **Do** use `text-2xs` (11px) and `text-3xs` (10px) tokens for sub-`text-xs` density. Never `text-[10px]` or `text-[10.5px]` ad-hoc.
- **Do** route every status color through the named tokens (`success`, `info`, `warning`, `destructive`). Status meaning lives in the token, not in the literal hue.
- **Do** keep Workshop Ember to ≤10% of any screen — primary CTAs, active sidebar ring, the calendar now-line. That's it.
- **Do** lean on tinted neutral surface separation (page/sidebar/card brightness) before reaching for borders, before reaching for shadows.
- **Do** reach for `<EmptyState>` instead of inlining the empty pattern. Every empty surface in the app must look like every other empty surface.
- **Do** put `aria-current="page"` on the active sidebar nav, `aria-label` on every icon-only button, and a skip-to-main link at the top of `AppShell`.
- **Do** respect `prefers-reduced-motion: reduce` (the global stylesheet enforces this; never override per-component).

### Don't:
- **Don't** use `#fff`, `#000`, or any pure-gray (chroma 0) color. Tinted neutrals only.
- **Don't** introduce a second saturated brand color. One accent. The accent is Workshop Ember.
- **Don't** decorate with status colors. Yellow, green, red, blue exist only for `success`/`warning`/`destructive`/`info` semantics.
- **Don't** use a colored side-stripe (`border-left: 4px solid …`) on cards, list items, or alerts. Full borders, background tints, or nothing.
- **Don't** add `border-bottom` to the page header or the sidebar header. That separation is whitespace, not a line.
- **Don't** use gradient text (`background-clip: text` over a gradient). Single solid color, weight or size for emphasis.
- **Don't** wrap workspace surfaces in glassmorphism (blur + translucency). Rare and purposeful, or nothing.
- **Don't** ship a hero-metric template (huge number, small label, supporting stats, gradient accent). The dashboard is operational, not marketing.
- **Don't** ship identical card grids — same-sized icon-heading-paragraph cards repeated endlessly. If the content fits a table, use a table.
- **Don't** reach for a modal as the first thought. Inline editing, sheets, and progressive disclosure first; modal only when blocking is correct.
- **Don't** put gray text on a colored background. Use a tint of that color or transparency.
- **Don't** use ad-hoc `text-[Npx]` for typography. The scale is `text-3xs`, `text-2xs`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`. Anything else is drift.

 # Shieldlytics Design System — Implementation Guide

A self-contained design specification for applying the Shieldlytics visual identity to an existing website. This document is the contract — follow it page by page, component by component.

> **For the implementer:** read sections 1–3 in full before touching code. Sections 4–9 are reference. Section 10 lists acceptance checks you must pass before declaring the migration complete.

---

## 1. What this is

Shieldlytics is intelligence and workflow software for Financial Investigation Units. The brand reads as **calm, precise, and authoritative** — no marketing fluff, no playfulness, no emoji, no decorative gradients.

The system is built on three commitments:

1. **Teal is the only brand hue.** All accents, all primary actions, all hover states.
2. **Neutrals do the rest.** Cool gray with a faint teal undertone — never warm gray or beige.
3. **Type carries the personality.** Montserrat for everything UI; Commit Mono for data, IDs, timestamps. No serifs in product UI.

---

## 2. How to migrate an existing site

### 2.1 Audit pass
Before changing anything, scan the codebase and document:
- Where global styles live (`:root`, theme files, Tailwind config, CSS-in-JS theme objects).
- All raw color literals — hex codes, `rgb()`, named colors. These all get replaced.
- Font stacks currently in use.
- Component primitives (button, input, card, badge, table, modal) and where they're defined.

Output a short report of what will change, then proceed.

### 2.2 Foundation file
Create `styles/shieldlytics.css` (or wire the variables into your existing theme/Tailwind config). The full token block is in **Section 4**. Import this file once at the application root **before** any component CSS.

### 2.3 Font loading
- **Montserrat** — self-host all weights from Google Fonts (download → `fonts/` → `@font-face`). Loading 100–900 plus italics is fine; weight subsetting can wait.
- **Commit Mono** — load via Google Fonts CDN at weights 400, 500, 600.

Snippet (drop in `<head>` after the foundation CSS):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Commit+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 2.4 Component migration order
Apply changes bottom-up to avoid visual churn:

1. **Tokens** — colors, type, spacing, radii, shadows.
2. **Atoms** — buttons, inputs, badges, links, focus rings.
3. **Molecules** — form fields, cards, table rows, nav items, status pills.
4. **Layouts** — sidebar, page header, content padding, grid.
5. **Pages** — apply the new compositions per route/template.

Verify each layer renders correctly before moving up.

### 2.5 Forbidden patterns to remove
While migrating, delete:
- Raw hex literals outside the token system.
- Non-teal accent colors used as decoration (purples, blues, oranges).
- Decorative gradients (the only sanctioned gradient is on the marketing hero — see §8).
- Emoji in product UI or copy.
- Drop shadows tinted with brand color.
- Border radii > 16 px on chrome (cards/buttons/inputs). Pills and tags are full radius; everything else is restrained.
- Pixel-rounded font sizes below 12 px in product UI; below 10 px anywhere.

---

## 3. Quick start — minimum viable application

Drop these into any HTML page and you have the design system applied:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="styles/shieldlytics.css">
  <link rel="icon" type="image/png" href="assets/logo-mark.png">
</head>
<body class="sl">
  <main class="content">
    <h1 class="sl-h1">Cases overview</h1>
    <p class="sl-lead">Three entities share beneficial owners across 14 filings.</p>
    <button class="btn btn-primary">Open case</button>
  </main>
</body>
</html>
```

The `class="sl"` on `<body>` is required — it activates the font stack, the canvas background, and the global box-sizing reset.

---

## 4. Tokens — the full block

Paste this into `styles/shieldlytics.css`. Do not redefine these elsewhere. **All component styles must consume these variables, not raw values.**

```css
/* Brand fonts */
@import url('https://fonts.googleapis.com/css2?family=Commit+Mono:wght@400;500;600&display=swap');

@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 400; font-display: swap; src: url('fonts/Montserrat-Regular.ttf') format('truetype'); }
@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 500; font-display: swap; src: url('fonts/Montserrat-Medium.ttf') format('truetype'); }
@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 600; font-display: swap; src: url('fonts/Montserrat-SemiBold.ttf') format('truetype'); }
@font-face { font-family: 'Montserrat'; font-style: normal; font-weight: 700; font-display: swap; src: url('fonts/Montserrat-Bold.ttf') format('truetype'); }
/* Add italic + remaining weights as needed (100–900). */

:root {
  /* Brand — teal scale (use 600 for primary actions) */
  --sl-teal-50:  #E6FAFA;
  --sl-teal-100: #C7F2F2;
  --sl-teal-200: #8FE4E4;
  --sl-teal-300: #4FD3D3;
  --sl-teal-400: #14B8B8;
  --sl-teal-500: #14B8B8;
  --sl-teal-600: #009999;  /* primary */
  --sl-teal-700: #007A7A;  /* hover / text on white */
  --sl-teal-800: #005656;  /* press */
  --sl-teal-900: #003838;
  --sl-teal-950: #001F1F;

  /* Neutrals — cool gray, faint teal undertone */
  --sl-gray-0:   #FFFFFF;
  --sl-gray-25:  #FAFBFB;
  --sl-gray-50:  #F5F7F7;
  --sl-gray-100: #EDEFEF;
  --sl-gray-200: #E1E5E5;
  --sl-gray-300: #CBD1D1;
  --sl-gray-400: #9BA5A5;
  --sl-gray-500: #6B7676;
  --sl-gray-600: #4C5757;
  --sl-gray-700: #344040;
  --sl-gray-800: #1F2929;
  --sl-gray-900: #111818;
  --sl-gray-950: #080C0C;

  /* Semantic surfaces & text */
  --bg-canvas:  var(--sl-gray-50);
  --bg-surface: #FFFFFF;
  --bg-sunken:  var(--sl-gray-100);
  --bg-hover:   var(--sl-gray-50);
  --bg-active:  var(--sl-gray-100);
  --bg-overlay: rgba(8, 12, 12, 0.48);

  --fg1: var(--sl-gray-900);  /* primary text */
  --fg2: var(--sl-gray-600);  /* secondary text */
  --fg3: var(--sl-gray-500);  /* meta / labels */
  --fg4: var(--sl-gray-400);  /* placeholder / disabled */
  --fg-on-brand: #FFFFFF;
  --fg-link: var(--sl-teal-600);

  --border-subtle: var(--sl-gray-100);
  --border:        var(--sl-gray-200);
  --border-strong: var(--sl-gray-300);
  --border-focus:  var(--sl-teal-500);

  /* Status (measured, not loud) */
  --success-500: #0E8F5E;  --success-bg: #E6F5EE;  --success-fg: #075A3B;
  --warning-500: #C77A0A;  --warning-bg: #FDF3E2;  --warning-fg: #7A4A06;
  --danger-500:  #C0352B;  --danger-bg:  #FBEAE8;  --danger-fg:  #7A211A;
  --info-500:    #2260B8;  --info-bg:    #E8EFFA;  --info-fg:    #163F7A;

  /* Risk scale (data viz only) */
  --risk-low:      #0E8F5E;
  --risk-moderate: #C77A0A;
  --risk-elevated: #D9541A;
  --risk-high:     #C0352B;
  --risk-critical: #7A211A;

  /* Type */
  --font-sans: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Commit Mono', 'SF Mono', 'Menlo', monospace;
  --font-display: 'Montserrat', sans-serif;

  --fs-xs:12px; --fs-sm:13px; --fs-base:14px; --fs-md:15px; --fs-lg:17px;
  --fs-xl:20px; --fs-2xl:24px; --fs-3xl:30px; --fs-4xl:38px; --fs-5xl:48px; --fs-6xl:64px;

  --lh-tight:1.15; --lh-snug:1.3; --lh-normal:1.5; --lh-relaxed:1.65;

  --tracking-tight:-0.02em; --tracking-snug:-0.01em; --tracking-normal:0;
  --tracking-wide:0.04em; --tracking-caps:0.08em;

  --fw-light:300; --fw-regular:400; --fw-medium:500; --fw-semibold:600; --fw-bold:700;

  /* Spacing — 4px grid */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-7:32px; --space-8:40px; --space-9:48px; --space-10:64px;
  --space-11:80px; --space-12:96px;

  /* Radii — modest */
  --radius-xs:4px; --radius-sm:6px; --radius-md:8px; --radius-lg:12px;
  --radius-xl:16px; --radius-2xl:24px; --radius-pill:999px;

  /* Shadows — soft, neutral, never tinted */
  --shadow-xs:  0 1px 2px rgba(8,20,20,.04);
  --shadow-sm:  0 1px 2px rgba(8,20,20,.05), 0 1px 3px rgba(8,20,20,.06);
  --shadow-md:  0 2px 4px rgba(8,20,20,.05), 0 4px 10px rgba(8,20,20,.06);
  --shadow-lg:  0 4px 8px rgba(8,20,20,.06), 0 12px 24px rgba(8,20,20,.08);
  --shadow-xl:  0 8px 16px rgba(8,20,20,.08), 0 24px 48px rgba(8,20,20,.10);
  --shadow-focus: 0 0 0 3px rgba(20,184,184,.28);
  --shadow-inset: inset 0 1px 2px rgba(8,20,20,.04);

  /* Motion — quick, confident, no bounce */
  --duration-instant:80ms; --duration-fast:140ms; --duration-base:200ms; --duration-slow:320ms;
  --ease-standard: cubic-bezier(0.2,0,0,1);
  --ease-emphasis: cubic-bezier(0.2,0,0.2,1);
  --ease-exit:     cubic-bezier(0.4,0,1,1);
}

/* Global reset (opt-in: add class="sl" on body) */
.sl, .sl * { box-sizing: border-box; }
.sl {
  font-family: var(--font-sans);
  font-size: var(--fs-base);
  line-height: var(--lh-normal);
  color: var(--fg1);
  background: var(--bg-canvas);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

### 4.1 Tailwind users
If the existing site is on Tailwind, map these into `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      teal: { 50:'#E6FAFA', 100:'#C7F2F2', 200:'#8FE4E4', 300:'#4FD3D3',
              400:'#14B8B8', 500:'#14B8B8', 600:'#009999', 700:'#007A7A',
              800:'#005656', 900:'#003838', 950:'#001F1F' },
      gray: { 0:'#FFFFFF', 25:'#FAFBFB', 50:'#F5F7F7', 100:'#EDEFEF',
              200:'#E1E5E5', 300:'#CBD1D1', 400:'#9BA5A5', 500:'#6B7676',
              600:'#4C5757', 700:'#344040', 800:'#1F2929', 900:'#111818', 950:'#080C0C' },
    },
    fontFamily: {
      sans: ['Montserrat', 'ui-sans-serif', 'system-ui'],
      mono: ['"Commit Mono"', 'ui-monospace', 'monospace'],
    },
    boxShadow: {
      focus: '0 0 0 3px rgba(20,184,184,.28)',
    },
  },
}
```

Then `bg-teal-600 hover:bg-teal-700`, `text-gray-900`, `font-mono`, etc. work directly.

---

## 5. Typography classes

Add these once, alongside the tokens:

```css
.sl-display { font: 600 var(--fs-6xl)/var(--lh-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--fg1); }
.sl-h1      { font: 600 var(--fs-4xl)/var(--lh-tight) var(--font-display); letter-spacing: var(--tracking-tight); color: var(--fg1); }
.sl-h2      { font: 600 var(--fs-3xl)/var(--lh-snug)  var(--font-display); letter-spacing: var(--tracking-snug);  color: var(--fg1); }
.sl-h3      { font: 600 var(--fs-2xl)/var(--lh-snug)  var(--font-sans);    letter-spacing: var(--tracking-snug);  color: var(--fg1); }
.sl-h4      { font: 600 var(--fs-xl)/var(--lh-snug)   var(--font-sans);    color: var(--fg1); }
.sl-h5      { font: 600 var(--fs-lg)/var(--lh-snug)   var(--font-sans);    color: var(--fg1); }
.sl-p       { font: 400 var(--fs-base)/var(--lh-normal)  var(--font-sans); color: var(--fg1); }
.sl-lead    { font: 400 var(--fs-lg)/var(--lh-relaxed)   var(--font-sans); color: var(--fg2); }
.sl-small   { font: 400 var(--fs-sm)/var(--lh-normal)    var(--font-sans); color: var(--fg2); }
.sl-meta    { font: 400 var(--fs-xs)/var(--lh-normal)    var(--font-sans); color: var(--fg3); }
.sl-eyebrow { font: 600 var(--fs-xs)/var(--lh-normal)    var(--font-sans); letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--fg2); }
.sl-code    { font: 400 var(--fs-sm)/1 var(--font-mono); color: var(--fg1); background: var(--bg-sunken); padding: 2px 6px; border-radius: var(--radius-xs); }
.sl-num     { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
```

**Rules:**
- Use `.sl-num` (or `font-family: var(--font-mono)` + `tabular-nums`) for every number in tables, metrics, money, percentages, IDs, timestamps.
- Headings, labels, buttons: **sentence case**, never Title Case. (`Create case`, not `Create Case`.)
- ALL CAPS only for eyebrows, status badges, and section labels — always tracked `var(--tracking-caps)`.
- No emoji anywhere.

---

## 6. Components — reference implementations

### 6.1 Button

```css
.btn {
  font: inherit; font-size: 13px; font-weight: 500;
  padding: 8px 18px; border-radius: var(--radius-pill);
  border: 1px solid transparent;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  text-align: center; line-height: 1.2;
  cursor: pointer; white-space: nowrap;
  transition: background var(--duration-fast), color var(--duration-fast), border-color var(--duration-fast);
}
.btn:focus-visible { outline: none; box-shadow: var(--shadow-focus); }
.btn-primary   { background: var(--sl-teal-600); color: #fff; }
.btn-primary:hover { background: var(--sl-teal-700); }
.btn-primary:active{ background: var(--sl-teal-800); }
.btn-secondary { background: #fff; color: var(--fg1); border-color: var(--border); }
.btn-secondary:hover { background: var(--bg-hover); }
.btn-ghost     { background: var(--sl-teal-50); color: var(--sl-teal-700); border-color: var(--sl-teal-100); }
.btn-ghost:hover { background: var(--sl-teal-100); border-color: var(--sl-teal-200); }
.btn-danger    { background: var(--danger-500); color: #fff; }
.btn-danger:hover { background: #9A2A22; }
.btn-sm { padding: 6px 14px; font-size: 12px; }
.btn-lg { padding: 12px 22px; font-size: 14px; }
.btn[disabled], .btn[aria-disabled='true'] { opacity: .5; cursor: not-allowed; }
```

**Hard rules:**
- All buttons pill-shaped (`--radius-pill`). No square corners.
- Always `justify-content: center` + `text-align: center` — required for buttons with and without icons to align.
- Focus ring uses `var(--shadow-focus)` — never browser default blue.
- Ghost variant must be visible at rest (teal-50 fill, teal-100 border). Do not regress to transparent.

### 6.2 Input

```css
.input {
  font: inherit; font-size: 13px;
  padding: 8px 12px; width: 100%;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: #fff; color: var(--fg1);
  box-shadow: var(--shadow-inset); outline: none;
}
.input:focus { border-color: var(--sl-teal-500); box-shadow: var(--shadow-focus); }
.input::placeholder { color: var(--fg4); }
.input[aria-invalid='true'] { border-color: var(--danger-500); box-shadow: var(--shadow-focus-danger); }
```

Pair with a small uppercase label above (`.sl-eyebrow` or `font-size: 12px; font-weight: 500; color: var(--fg2)`).

### 6.3 Badge / status pill

```css
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: var(--radius-pill);
  font-size: 12px; font-weight: 500;
}
.badge .dot { width: 6px; height: 6px; border-radius: 50%; }
.badge-open     { background: var(--success-bg); color: var(--success-fg); }
.badge-open .dot{ background: var(--success-500); }
.badge-review   { background: var(--info-bg);    color: var(--info-fg);    }
.badge-review .dot{ background: var(--info-500); }
.badge-pending  { background: var(--warning-bg); color: var(--warning-fg); }
.badge-pending .dot{ background: var(--warning-500); }
.badge-escalated{ background: var(--danger-bg);  color: var(--danger-fg);  }
.badge-escalated .dot{ background: var(--danger-500); }
.badge-closed   { background: var(--sl-gray-100); color: var(--fg2); }
.badge-closed .dot{ background: var(--sl-gray-500); }
```

Map domain statuses to these slots — e.g. `Inactive` → `badge-closed`, `Suspended` → `badge-escalated`.

### 6.4 Card

```css
.card {
  background: #fff;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.card-hover { transition: box-shadow var(--duration-base), border-color var(--duration-base); }
.card-hover:hover { box-shadow: var(--shadow-sm); border-color: var(--border); }
```

### 6.5 Table

```css
.table {
  width: 100%; border-collapse: collapse;
  background: #fff; border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg); overflow: hidden;
}
.table th, .table td {
  text-align: left; padding: 10px 16px;
  font-size: 13px; border-bottom: 1px solid var(--border-subtle);
}
.table th {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: var(--tracking-wide); color: var(--fg3);
  background: var(--sl-gray-25);
}
.table tr:last-child td { border-bottom: none; }
.table tr:hover td { background: var(--bg-hover); }
.table .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```

### 6.6 Sidebar nav (if site has app chrome)

```css
.sidebar { background: #fff; border-right: 1px solid var(--border-subtle); width: 240px; padding: 16px 12px; }
.sidebar .brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 14px; }
.sidebar .brand img { width: 28px; height: 28px; }
.sidebar .section { font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: var(--tracking-caps); color: var(--fg3); padding: 12px 10px 6px; }
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: var(--radius-sm);
  color: var(--fg2); font-weight: 500; cursor: pointer;
  transition: background var(--duration-fast), color var(--duration-fast);
}
.nav-item:hover { background: var(--bg-hover); color: var(--fg1); }
.nav-item.active { background: var(--sl-teal-50); color: var(--sl-teal-700); }
.nav-item svg { width: 18px; height: 18px; stroke-width: 1.5; }
```

---

## 7. Iconography

- **Library: [Lucide](https://lucide.dev).** Stroke icons, 1.5 stroke width, `currentColor`. No filled icons. No emoji.
- Sizes: **16 px** in dense UI (table actions, inline meta), **20 px** default, **24 px** section headers, **32 px+** empty states.
- Load via npm (`lucide-react`) for React apps, or the CDN script for vanilla:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<!-- then in markup -->
<i data-lucide="shield-check"></i>
<!-- finally -->
<script>lucide.createIcons();</script>
```

---

## 8. Layout

- **App shells:** 240 px fixed sidebar + flexible main, full-viewport height, no body scroll.
- **Content padding:** 28 px vertical, 32 px horizontal.
- **Page header:** sticky, 18 / 32 padding, white ground, 1 px subtle border bottom. Breadcrumb in mono `--fg3`, title in `.sl-h3` or `.sl-h2`.
- **Marketing / public pages:** white background; max content width 1280 px; section padding 48–64 px vertical.
- **The one sanctioned gradient:** marketing hero only, `--sl-teal-50 → #FFFFFF` from top to bottom. Nothing else uses gradients.
- **Grid + gap.** Sibling layout uses CSS grid or flex with `gap`. Do not rely on margins between inline siblings or whitespace text nodes.

---

## 9. Voice and copy

- **Sentence case** for headings, buttons, menu items, labels.
- **ALL CAPS** only on eyebrows and status badges, always tracked.
- **Confident & direct.** Short sentences, strong verbs, no hedging. "Open case", not "Click here to open the case".
- **No marketing fluff.** Don't say "powerful", "revolutionary", "magic", "delightful", "unlock". Say what the product does.
- **Numerals** from 10 up; zero through nine spelled out in prose; numerals always win in tables, metrics, timestamps.
- **Dates:** `12 Apr 2026` in dense UI, `April 12, 2026` in long-form prose. **Times:** 24-hour in operational screens (`14:32 UTC`), 12-hour in marketing.
- **Domain terms:** *case* (not ticket), *assignee* (not owner), *insight* (AIM output), *signal* (single observation), *external participant* (not guest).

---

## 10. Acceptance checks

Before declaring the migration complete, every page must pass these:

1. **No raw color literals.** `grep -nE "#[0-9A-Fa-f]{3,8}|rgb\(|rgba\(" src/` returns only references inside the foundation file (the one place colors are declared).
2. **No non-token fonts.** Search for `font-family` declarations; all must reference `var(--font-sans)`, `var(--font-mono)`, or `var(--font-display)`.
3. **Focus rings teal.** Tab through every focusable element — they all show `var(--shadow-focus)`, never default browser blue.
4. **Mono is Commit Mono.** All IDs, timestamps, table numerics, money values show a **slashed zero** (Commit Mono's signature). Any dotted zero means the wrong font is loaded.
5. **Buttons centered and pill-shaped.** Both with-icon and text-only buttons align identically. No square corners.
6. **Ghost buttons visible at rest.** Teal-50 fill, teal-100 border, teal-700 text. Not transparent.
7. **No emoji** in product UI or copy.
8. **No console errors.** Fonts load, icons render, no missing components.
9. **Spacing on the 4 px grid.** Inspect any element's padding/margin — values are multiples of 4 (preferably from the `--space-N` scale).
10. **Logo placement.** Brand mark is the real PNG on transparent background, sized 24–32 px in chrome contexts. White-only variant only on dark teal grounds.

If any check fails, fix it before moving on. The system is brittle by design — small drifts compound quickly.

---

## 11. What not to do

- ❌ Add new color tokens. If you need a color and it's not in §4, you don't need that color.
- ❌ Introduce gradients (except the marketing hero).
- ❌ Use serifs in product UI.
- ❌ Round corners larger than 16 px on UI chrome.
- ❌ Use border-left color accents as decoration (only for severity indicators on cards).
- ❌ Use emoji as iconography.
- ❌ Use Title Case for buttons or headings.
- ❌ Tint shadows with brand color.
- ❌ Mix mono and sans on the same line (mono is for the value itself; the label is sans).
- ❌ Animate with bounces or elastic easings — only `--ease-standard` and friends.

---

## 12. When in doubt

If a pattern isn't covered here, the rule is: **does it match Linear, Stripe, or Vercel's restraint?** If yes, proceed. If it looks like a 2014 enterprise SaaS dashboard with colored borders, gradients, and rounded boxes inside rounded boxes — stop and ask.

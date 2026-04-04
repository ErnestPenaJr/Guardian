# Guardian MVP — UI/UX Overhaul Design Spec

**Date:** 2026-04-04
**Approach:** Component-Layer Rewrite (Approach A)
**Scope:** Full sweep across all pages and components
**Aesthetic:** Modern SaaS (Notion/Vercel-inspired), approachable but professional

---

## 1. Design Foundation

### 1.1 Color System

All rogue color values (`#219191`, `#25c6c6`, `#007bff`, `#4f46e5`) are eliminated. One source of truth via Tailwind config CSS custom properties.

**Brand Colors:**

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#032424` | Buttons, sidebar, headings |
| `secondary` | `#2EBCBC` | Accents, links, active states |
| `secondary-light` | `#f0fafa` | Hover backgrounds, active nav |

**Semantic Colors (each has a solid + light background variant):**

| Token | Solid | Light BG | Usage |
|-------|-------|----------|-------|
| `info` | `#2F8CED` | `#eef4fd` | Informational states |
| `success` | `#27AE60` | `#eafaf1` | Completed, positive |
| `warning` | `#E2B93B` | `#fff8e6` | Pending, attention |
| `error` | `#C10000` | `#fef2f2` | Errors, destructive |

**Neutrals (10-step scale):**

| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-900` | `#032424` | Headings (same as primary) |
| `neutral-800` | `#1D1D1D` | — |
| `neutral-700` | `#333333` | Body text |
| `neutral-600` | `#555555` | Secondary text |
| `neutral-500` | `#888888` | Muted text |
| `neutral-400` | `#aaaaaa` | Placeholder text |
| `neutral-300` | `#d0d0d0` | Disabled states |
| `neutral-200` | `#e8eaed` | Borders, dividers |
| `neutral-100` | `#f0f0f0` | Card borders |
| `neutral-50` | `#f8fafb` | Page background |

**Dark Mode Colors:**

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| Sidebar | `#032424` | `#0a0f12` | Deeper in dark mode |
| Page BG | `#f8fafb` | `#0f1419` | — |
| Card / Top bar | `#ffffff` | `#151c22` | — |
| Hover / Active | `#f0fafa` | `#1a2330` | — |
| Primary text | `#032424` | `#e8eaed` | — |
| Secondary text | `#555555` | `#94a3b8` | — |
| Muted text | `#888888` | `#6b7a8d` | — |
| Border | `#e8eaed` | `#1e2830` | — |
| Badge BGs | Pastel solids | 15% opacity | Full-saturation text in dark |

### 1.2 Typography

| Element | Font | Size | Weight | Usage |
|---------|------|------|--------|-------|
| H1 / Page Title | Montserrat | 28px | 700 | Main page headings |
| H2 / Section | Montserrat | 20px | 700 | Card titles, modal headers |
| H3 / Subsection | Inter | 16px | 600 | Table headers, form sections |
| Body | Inter | 14px | 400 | Table content, paragraphs |
| Small | Inter | 12px | 400 | Helper text, timestamps |
| Overline / Label | Inter | 10px | 600 | Stat labels, column headers (uppercase, 0.5px letter-spacing) |

### 1.3 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 6px | Badges, tags |
| `radius-md` | 10px | Inputs, buttons |
| `radius-lg` | 14px | Cards, tables |
| `radius-xl` | 16px | Modals |
| `radius-full` | 50% | Avatars, pills |

### 1.4 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.04)` | Cards, table rows |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Dropdowns, hover states |
| `shadow-lg` | `0 20px 60px rgba(0,0,0,0.15)` | Modals, overlays |

### 1.5 Spacing

Base-4 system: 4, 8, 12, 16, 20, 24, 32, 40, 48px.

| Context | Value |
|---------|-------|
| Card padding | 20px |
| Section gap | 24px |
| Page padding | 28px |
| Modal padding | 24px |

---

## 2. Navigation & Layout

### 2.1 Collapsible Sidebar (Desktop)

- **Collapsed:** 60px wide, icon-only with tooltips
- **Expanded:** 240px overlay on hover, slides in with backdrop blur
- **Active indicator:** Left accent bar (3px `secondary`) + tinted background
- **Structure:** Logo at top, nav items, separator, admin section (role-gated), settings + avatar at bottom
- **Background:** `primary` (#032424), consistent in both light and dark mode

### 2.2 Tablet (768px - 1024px)

- Sidebar permanently collapsed (no hover expansion)
- Grids adapt: 4-col to 2-col
- Touch-friendly 44px minimum tap targets

### 2.3 Mobile (< 768px)

- Sidebar hidden entirely
- **Top bar:** Logo + page title + notification bell + avatar
- **Bottom navigation:** 5 items — Home, Requests, Notices, Users, More
- Active indicator: dot below icon + teal color
- Safe area padding for notched devices

### 2.4 Standard Page Structure

Every page follows the same anatomy:

1. **Top bar** — Page title + subtitle/breadcrumb (left), search + actions (right)
2. **Content zone** — Tables, cards, forms — whatever the page needs
3. **Pagination/footer zone** — Showing X of Y + page controls

### 2.5 Role-Based Navigation

| Nav Item | General User | Processor | Manager | Admin |
|----------|:---:|:---:|:---:|:---:|
| Dashboard | Y | Y | Y | Y |
| Requests | Y | Y | Y | Y |
| Notices | Y | Y | Y | Y |
| Users | — | — | Y | Y |
| **Admin Section** | | | | |
| Forms & Fields | — | — | — | Y |
| Workspaces | — | — | — | Y |
| Settings | Y | Y | Y | Y |

---

## 3. Component Standardization

### 3.1 Buttons

**Variants:** Primary (`primary` bg), Secondary (`secondary` bg), Outline (border only), Ghost (subtle bg), Danger (`error` bg)

**Sizes:** Small (6px 14px, 11px text), Medium (10px 22px, 13px text — default), Large (13px 28px, 14px text)

**States:** Default, Focused (teal ring `0 0 0 3px rgba(46,188,188,0.2)`), Hover (darkened bg), Disabled (50% opacity), Loading (spinner + text)

**Icon support:** Leading icon, trailing icon, icon-only (square)

### 3.2 Form Inputs

- **Border:** 1.5px solid `neutral-200`, `radius-md` (10px)
- **Padding:** 10px 14px
- **Focus:** Border changes to `secondary`, ring `0 0 0 3px rgba(46,188,188,0.12)`
- **Error:** Border changes to `error`, bg tints to `error-light`, error message below
- **Labels:** 11px, font-weight 500, color `neutral-600`, above input
- **Helper text:** 10px, color `neutral-500`, below input
- **Character count:** Right-aligned in label row for textareas
- **Select:** Same styling as text input with chevron icon
- **Textarea:** Same styling, min-height 64px

### 3.3 Modals

**One unified modal component** replaces react-bootstrap Modal, react-modal, SweetAlert2, and all custom implementations.

**Standard modal (forms, details):**
- Max-width varies by content (380-600px)
- `radius-xl` (16px), `shadow-lg`
- Header: title (Montserrat 16px bold) + subtitle + close button (28px rounded square)
- Body: content with 24px padding
- Footer: `#fafafa` bg, right-aligned Cancel (outline) + Action (primary)
- Backdrop: `rgba(3,36,36,0.4)`

**Confirmation modal (delete, status change):**
- Centered layout: icon circle + title + description + full-width button row
- Icon circle color matches action (error red for delete, warning yellow for caution)

**Mobile (< 768px):**
- Bottom sheet pattern: slides up from bottom
- `border-radius: 20px 20px 0 0`
- Drag handle bar at top (36px wide, 4px tall)
- Full-width buttons
- Extra bottom padding for safe area

### 3.4 Status Badges

Consistent pill badges: `padding: 5px 14px`, `radius-full`, 12px font, font-weight 500.

| Status | Text Color | Background |
|--------|-----------|------------|
| Pending | `#92680a` | `#fff8e6` |
| In Progress | `#1d5cbf` | `#eef4fd` |
| Completed | `#1a7a42` | `#eafaf1` |
| Cancelled | `#991b1b` | `#fef2f2` |
| Assigned | `#0e7a7a` | `#f0fafa` |

**Role badges** use solid backgrounds: Admin (`primary`), Manager (`secondary`), Processor (`info`), User (`neutral-200`).

**Dark mode:** Badge backgrounds switch to 15% opacity of the solid color with full-saturation text.

### 3.5 Cards

**Stat Card:** `radius-lg` (14px), `shadow-sm`, 1px `neutral-100` border. Contains: label (overline), value (28-32px bold), trend indicator, icon in tinted square.

**Content Card:** Same container styling. Used for recent requests, quick actions, notice previews.

### 3.6 Data Tables

- Container: `radius-lg`, `shadow-sm`, `neutral-100` border
- Header row: Overline style (10px uppercase), `neutral-500` text, bottom border
- Data rows: 14px body text, 12px 16px padding, `neutral-100` dividers
- Hover state: Subtle background tint + left accent bar (`secondary`)
- Actions: Three-dot menu (ellipsis) per row

### 3.7 Empty States

- Centered layout within dashed border container (`radius-lg`)
- Icon in tinted circle (56px)
- Title (15px semibold) + description (12px muted, max-width 260px)
- Primary CTA button

### 3.8 Skeleton Loading

- Shimmer gradient placeholders matching actual content dimensions
- Applied to stat cards, table rows, form fields during loading

### 3.9 Toast Notifications

- Custom-styled React Toastify theme
- Left accent bar (4px, semantic color)
- Icon circle + title + description + dismiss
- `radius-lg`, `shadow-md`

---

## 4. Page-by-Page Changes

### 4.1 Auth Flow (Login, Register, Forgot Password, Verify)

**Shared layout:** Split-panel — left panel (42% width) shows brand gradient (`primary` to `#064a4a`) with logo, tagline, and contextual content (feature bullets on login, step progress on register). Right panel shows the form.

**Mobile:** Stacks vertically with a compact brand header.

**Login:** Email + password fields, inline "Forgot?" link, primary "Sign in" button, register link.

**Register:** 3-step progress indicator in left panel (Email Verified > Account Details > Set Password). Each step shows on the right panel.

**Forgot Password / Verify / Reset:** Same split layout, contextual instructions in left panel.

### 4.2 Dashboard

**Role-adaptive:** Same layout structure, different content based on role.

- **Top bar:** Personalized greeting ("Good morning, Ernest"), subtitle ("Here's what needs attention"), notification bell with badge count, primary "New Request" CTA
- **Stat cards:** 4-column grid — Open Requests, Pending Tasks, Completed, Unread Notices. Each with icon, count, trend.
- **Main content:** 2-column layout — Recent Requests table (2/3 width) + Quick Actions sidebar (1/3 width)
- **Role variations:** General User sees "My Requests" + "My Tasks". Processor sees "Assigned to Me". Manager sees team-wide stats. Admin gets user management quick actions.

### 4.3 Requests Dashboard

- **Status filter tabs:** All / Pending / In Progress / Completed / Cancelled — pill-style tabs with counts
- **Search bar:** Inline search in top bar
- **Data table:** ID (teal link), Subject, Assigned To (avatar + name), Status (badge), Date, Actions (three-dot menu)
- **Pagination:** Bottom row with "Showing X of Y" + numbered page buttons
- **Empty state:** When no requests exist, show empty state with "New Request" CTA

### 4.4 Notices

- **Card-based list** (not a table) — each notice is a card with:
  - Left accent border (4px, color by type)
  - Icon in tinted circle (type-specific)
  - Title, truncated preview, timestamp, author
  - Type badge + unread dot
- **Unread items:** Full opacity + blue left border
- **Read items:** Slightly reduced opacity, no accent border

### 4.5 Admin Pages (Users, Forms, Fields, Workspaces)

Same page structure as user-facing pages — no separate "admin theme."

- **User Management:** Table with avatar, name, email, role badge, status. Invite modal uses standard modal. Bulk actions via multi-select.
- **Forms & Fields:** Card grid for form templates (name, type badge, field count, last modified). Click to open form builder.
- **Form Builder:** Field layout with live preview using standard Input, Select, TextArea components.
- **Field Lookups:** Table with field name, type, validation rules. Edit inline or via modal.
- **Workspaces:** Card-based overview with member avatars and quick actions.

### 4.6 Settings

- **Side navigation:** Vertical list (Profile / Password / Notifications) in a card
- **Content panel:** Read-only display with edit option
- **Profile:** Avatar + name/email header, info grid (name, role, company, member since)
- **Password:** Current + new + confirm fields
- **Notifications:** Toggle switches for each notification type
- **Appearance:** Theme picker (Light / Dark / System) with visual thumbnails

---

## 5. UX Improvements

### 5.1 Light & Dark Mode

**Implementation:** CSS custom properties on `:root` for light mode, `[data-theme="dark"]` for dark mode. Tailwind `dark:` variant for utility classes.

**Switching:** Three options — Light, Dark, System (follows `prefers-color-scheme`).

**Persistence:** Theme preference stored in `localStorage` key `guardian-theme`. Applied before first paint (script in `<head>`) to prevent flash.

**Transition:** `background-color 0.2s, color 0.2s, border-color 0.2s` for smooth switching.

**Access points:**
1. Quick toggle in top bar (sun/moon/monitor segmented control)
2. Settings > Appearance page with visual thumbnails

### 5.2 Guided Next-Step Affordances

- **First-time admin wizard:** Step progress (Choose Type > Add Fields > Publish) with card-based type selection
- **Post-action banners:** After creating a request, completing a task, etc. — contextual success banner with "next action" CTA
- **Attention prompts:** Overdue tasks, pending assignments surface as warning banners on dashboard
- **Empty states everywhere:** Every list/table has a guided empty state with clear CTA

### 5.3 Notification Center

- Dropdown from bell icon in top bar
- Grouped by time (Today / Yesterday / Earlier)
- Unread indicators: blue dot + subtle background highlight
- Actions: "Mark all read", individual dismiss, "View all" link to full page
- Shows assignments, task updates, notice publications

### 5.4 Global Search

- Command palette triggered by search bar click or `Ctrl+K` / `Cmd+K`
- Searches across: Requests, Tasks, Notices, Users
- Categorized results with status badges
- Keyboard navigable (arrow keys + Enter)
- ESC to dismiss

---

## 6. Migration Strategy

### 6.1 Bootstrap Removal

- Remove `react-bootstrap` package dependency
- Replace all Bootstrap components (Modal, Button, Form, Alert, Badge, Table) with Guardian UI components
- Remove Bootstrap CSS imports
- Estimated files affected: 32+ files currently importing react-bootstrap

### 6.2 CSS Consolidation

- Eliminate all standalone CSS files (18 files in `src/styles/` and `src/components/`)
- Move all styling to Tailwind utility classes
- Keep one `index.css` for:
  - CSS custom properties (color tokens, dark mode)
  - Font imports (Montserrat, Inter)
  - Keyframe animations
  - React Toastify theme override
  - AG Grid theme override

### 6.3 Color Unification

- Replace `#219191` with `#2EBCBC` (4+ files)
- Replace `#25c6c6` with `#2EBCBC` (sidebar)
- Replace `#007bff` with `#032424` or `#2EBCBC` (Bootstrap blue, 6+ files)
- Replace `#4f46e5` with `#2EBCBC` (AG Grid)
- All colors reference Tailwind tokens, never hardcoded

### 6.4 Component Migration

| Current | Replaced By |
|---------|------------|
| `react-bootstrap Modal` | Guardian `Modal` component |
| `react-bootstrap Button` | Guardian `Button` component |
| `react-bootstrap Form` | Guardian `Input`, `Select`, `TextArea` |
| `react-bootstrap Alert` | Guardian toast notifications |
| `react-bootstrap Badge` | Guardian `StatusBadge` component |
| `react-bootstrap Table` | Guardian data table pattern |
| `SweetAlert2` | Guardian confirmation modal |
| `react-modal` (various) | Guardian `Modal` component |
| Multiple sidebar implementations | Single `CollapsibleSidebar` component |
| `MobileNavBar` | Redesigned `MobileNav` with bottom tabs |

### 6.5 New Components to Build

| Component | Purpose |
|-----------|---------|
| `CollapsibleSidebar` | Desktop/tablet navigation |
| `MobileNav` | Bottom tab navigation |
| `PageLayout` | Standard page structure (top bar + content + footer) |
| `Modal` | Unified modal (standard + confirmation + mobile bottom sheet) |
| `StatusBadge` | Consistent status pill badges |
| `StatCard` | Dashboard stat card with icon + trend |
| `DataTable` | Styled table wrapper with header + rows + hover |
| `EmptyState` | Guided empty state with icon + CTA |
| `SkeletonLoader` | Shimmer loading placeholders |
| `ThemeToggle` | Light/dark/system switcher |
| `GlobalSearch` | Command palette search |
| `NotificationDropdown` | Redesigned notification center |
| `NextStepBanner` | Contextual post-action guidance |

### 6.6 Files Affected

- **~60-80 component/page files** — restyled with Tailwind + Guardian components
- **18 CSS files** — consolidated into `index.css`
- **`tailwind.config.js`** — updated with dark mode tokens, extended spacing
- **`package.json`** — remove `react-bootstrap`, `bootstrap` dependencies
- **`index.html`** — theme initialization script in `<head>`

---

## 7. Technical Notes

### 7.1 Dark Mode Implementation

```
// index.html <head> — prevents flash of wrong theme
<script>
  const theme = localStorage.getItem('guardian-theme');
  if (theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
</script>
```

CSS custom properties defined on `:root` and `[data-theme="dark"]`. All components reference these variables through Tailwind config.

### 7.2 Sidebar Behavior

- Desktop (>1024px): Collapsed by default, expands on hover with 200ms transition
- Tablet (768-1024px): Collapsed permanently, no hover expand
- Mobile (<768px): Hidden, replaced by bottom nav
- Expansion is an overlay (absolute positioned) — does not push content

### 7.3 Modal Behavior

- Desktop: Centered overlay with backdrop
- Mobile (<768px): Bottom sheet with drag-to-dismiss gesture
- Focus trap enabled for accessibility
- ESC to close, click backdrop to close (with unsaved changes warning)

### 7.4 Global Search

- Debounced search (300ms) across API endpoints
- Client-side result caching for repeated queries
- Keyboard shortcuts: `Ctrl+K`/`Cmd+K` to open, `Esc` to close, arrow keys to navigate, Enter to select

---

## 8. Out of Scope

- Backend API changes (this is a frontend-only overhaul)
- New feature development (focus is on restyling existing functionality)
- Database schema changes
- Server file modifications
- Accessibility audit (should be a follow-up effort, though this design improves baseline accessibility with focus rings, color contrast, and semantic structure)

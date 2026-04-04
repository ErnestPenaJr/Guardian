# UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Guardian MVP from a functional but inconsistent UI into a polished, modern SaaS application with unified design tokens, collapsible sidebar navigation, dark mode, and guided user flows.

**Architecture:** Component-Layer Rewrite — replace the styling layer across all pages while keeping existing component logic intact. Build a theme system with CSS custom properties, create new layout/navigation components, unify all modals to one system, and restyle every page using Tailwind utility classes with Guardian design tokens.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4, Lucide React icons, CSS custom properties for theming, localStorage for theme persistence.

**Design Spec:** `docs/superpowers/specs/2026-04-04-ui-ux-overhaul-design.md`

---

## File Structure

### New Files to Create

```
src/
├── contexts/
│   └── ThemeContext.tsx              # Dark/light/system theme provider
├── components/
│   ├── CollapsibleSidebar.tsx        # Desktop sidebar navigation
│   ├── MobileBottomNav.tsx           # Mobile bottom tab navigation
│   ├── PageLayout.tsx                # Standard page structure wrapper
│   ├── GlobalSearch.tsx              # Command palette search (Ctrl+K)
│   ├── NextStepBanner.tsx            # Contextual post-action guidance
│   ├── ui/
│   │   ├── StatusBadge.tsx           # Consistent status pill badges
│   │   ├── StatCard.tsx              # Dashboard stat card with icon + trend
│   │   ├── EmptyState.tsx            # Guided empty state with CTA
│   │   ├── SkeletonLoader.tsx        # Shimmer loading placeholders
│   │   └── ThemeToggle.tsx           # Light/dark/system switcher
```

### Files to Modify

```
src/
├── index.css                          # CSS custom properties, dark mode tokens, toast theme
├── App.tsx                            # Wrap with ThemeProvider, update layout
├── components/
│   ├── Layout.tsx                     # Replace with PageLayout integration
│   ├── Modal.tsx                      # Redesign: standard + confirmation + mobile bottom sheet
│   ├── ConfirmationModal.tsx          # Replace with unified Modal
│   ├── MobileNavBar.tsx               # Replace with MobileBottomNav
│   ├── NotificationDropdown.tsx       # Redesign notification center
│   ├── ui/
│   │   ├── Button.tsx                 # Add variants: outline, ghost, danger; add sizes, states
│   │   ├── Card.tsx                   # Update radius, shadow, border tokens
│   │   ├── Input.tsx                  # Unified border/radius/focus styling
│   │   ├── Select.tsx                 # Match Input styling
│   │   ├── TextArea.tsx               # Match Input styling
│   │   ├── Badge.tsx                  # Replace with StatusBadge usage
│   │   └── ConsistentCard.tsx         # Merge into Card.tsx pattern
├── pages/
│   ├── Login.tsx                      # Split-panel layout with brand panel
│   ├── Register.tsx                   # Split-panel + step indicator
│   ├── ForgotPassword.tsx             # Split-panel layout
│   ├── VerifyEmail.tsx                # Split-panel layout
│   ├── VerifyForgotPassword.tsx       # Split-panel layout
│   ├── ResetPassword.tsx              # Split-panel layout
│   ├── Home.tsx                       # Dashboard with stat cards, recent items, quick actions
│   ├── RequestDashboard.tsx           # Status tabs, styled table, search
│   ├── RequestFulfillmentDashboard.tsx # Restyled detail view
│   ├── NoticesLandingPage.tsx         # Card-based notice list
│   ├── NoticeDetailsPage.tsx          # Restyled notice detail
│   ├── AdminDashboard.tsx             # Unified page structure
│   ├── AdminUserManagement.tsx        # Restyled user table
│   ├── AdminFields.tsx                # Restyled fields management
│   ├── AdminFormsGroups.tsx           # Card grid for templates
│   ├── AccountSettings.tsx            # Side nav + content panel
│   └── StyleGuide.tsx                 # Updated with new components
tailwind.config.js                     # Dark mode, extended tokens
package.json                           # Remove bootstrap, react-bootstrap
```

### Files to Delete

```
src/styles/sidebar.css                  # Replaced by CollapsibleSidebar.tsx
src/styles/Modal.css                    # Replaced by Modal.tsx Tailwind styles
src/styles/AddRequestModal.css          # Consolidated into Tailwind
src/styles/StandardTemplates.css        # Consolidated into Tailwind
src/styles/FormCreationFlow.css         # Consolidated into Tailwind
src/components/ui/ConsistentCard.css    # Merged into Card.tsx
src/components/FormBuilder.css          # Consolidated into Tailwind
src/components/FormFieldItem.css        # Consolidated into Tailwind
src/components/RequestModal.css         # Consolidated into Tailwind
```

### Files to Consolidate (Large CSS → Tailwind)

These files have significant CSS that needs to be converted to Tailwind utilities inline in their respective components. They are deleted after their component is restyled:

```
src/styles/RequestDashboard.css         # → RequestDashboard.tsx inline Tailwind
src/styles/SimpleFormBuilder.css        # → SimpleFormBuilder.tsx inline Tailwind
src/styles/EnhancedFormBuilder.css      # → EnhancedFormBuilder.tsx inline Tailwind
src/styles/FormBuilder.css              # → FormBuilder components inline Tailwind
src/styles/FidelitySubjectForm.css      # → relevant component inline Tailwind
src/styles/ag-grid-custom.css           # → Keep but update colors to use tokens
src/components/EndpointManager/EndpointManager.css # → inline Tailwind
```

---

## Task 1: Theme Foundation — CSS Custom Properties & ThemeContext

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`
- Create: `src/contexts/ThemeContext.tsx`
- Modify: `src/App.tsx`
- Modify: `index.html`

- [ ] **Step 1: Update `tailwind.config.js` with dark mode and extended tokens**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-light': 'var(--color-primary-light)',
        secondary: 'var(--color-secondary)',
        'secondary-light': 'var(--color-secondary-light)',
        info: 'var(--color-info)',
        'info-light': 'var(--color-info-light)',
        success: 'var(--color-success)',
        'success-light': 'var(--color-success-light)',
        warning: 'var(--color-warning)',
        'warning-light': 'var(--color-warning-light)',
        error: 'var(--color-error)',
        'error-light': 'var(--color-error-light)',
        surface: {
          base: 'var(--color-surface-base)',
          card: 'var(--color-surface-card)',
          hover: 'var(--color-surface-hover)',
          sidebar: 'var(--color-surface-sidebar)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          placeholder: 'var(--color-text-placeholder)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'h1': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        'h2': ['20px', { lineHeight: '1.3', fontWeight: '700' }],
        'h3': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        'small': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
        'overline': ['10px', { lineHeight: '1.5', fontWeight: '600', letterSpacing: '0.05em' }],
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '16px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0,0,0,0.04)',
        'md': '0 4px 12px rgba(0,0,0,0.08)',
        'lg': '0 20px 60px rgba(0,0,0,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Add CSS custom properties to `src/index.css`**

Replace the existing content at the top of `src/index.css` (before `@tailwind` directives) with the theme custom properties. Keep existing SweetAlert2 customizations and animation keyframes below.

Add this at the very top of the file:

```css
/* ===== GUARDIAN THEME TOKENS ===== */
:root {
  /* Brand */
  --color-primary: #032424;
  --color-primary-light: #064a4a;
  --color-secondary: #2EBCBC;
  --color-secondary-light: #f0fafa;

  /* Semantic */
  --color-info: #2F8CED;
  --color-info-light: #eef4fd;
  --color-success: #27AE60;
  --color-success-light: #eafaf1;
  --color-warning: #E2B93B;
  --color-warning-light: #fff8e6;
  --color-error: #C10000;
  --color-error-light: #fef2f2;

  /* Surfaces */
  --color-surface-base: #f8fafb;
  --color-surface-card: #ffffff;
  --color-surface-hover: #f0fafa;
  --color-surface-sidebar: #032424;

  /* Text */
  --color-text-primary: #032424;
  --color-text-secondary: #555555;
  --color-text-muted: #888888;
  --color-text-placeholder: #aaaaaa;

  /* Borders */
  --color-border: #e8eaed;
  --color-border-light: #f0f0f0;

  /* Transitions */
  --theme-transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

[data-theme="dark"] {
  --color-primary: #032424;
  --color-primary-light: #0e4a4a;
  --color-secondary: #2EBCBC;
  --color-secondary-light: rgba(46, 188, 188, 0.12);

  --color-info: #5BA3F0;
  --color-info-light: rgba(47, 140, 237, 0.15);
  --color-success: #4ADE80;
  --color-success-light: rgba(39, 174, 96, 0.15);
  --color-warning: #FBBF24;
  --color-warning-light: rgba(226, 185, 59, 0.15);
  --color-error: #F87171;
  --color-error-light: rgba(193, 0, 0, 0.15);

  --color-surface-base: #0f1419;
  --color-surface-card: #151c22;
  --color-surface-hover: #1a2330;
  --color-surface-sidebar: #0a0f12;

  --color-text-primary: #e8eaed;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #6b7a8d;
  --color-text-placeholder: #4a5568;

  --color-border: #1e2830;
  --color-border-light: #1a2330;
}

/* Theme transition on all elements */
*,
*::before,
*::after {
  transition: var(--theme-transition);
}

/* Disable transitions on page load to prevent flash */
.no-transitions *,
.no-transitions *::before,
.no-transitions *::after {
  transition: none !important;
}
```

- [ ] **Step 3: Create `src/contexts/ThemeContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(resolved: 'light' | 'dark') {
  if (resolved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('guardian-theme') as Theme) || 'light';
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(theme));

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('guardian-theme', newTheme);
  };

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

- [ ] **Step 4: Add flash-prevention script to `index.html`**

Add this script inside `<head>` before any CSS loads:

```html
<script>
  (function() {
    var theme = localStorage.getItem('guardian-theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    document.documentElement.classList.add('no-transitions');
    window.addEventListener('DOMContentLoaded', function() {
      requestAnimationFrame(function() {
        document.documentElement.classList.remove('no-transitions');
      });
    });
  })();
</script>
```

- [ ] **Step 5: Wrap App with ThemeProvider in `src/App.tsx`**

Add `ThemeProvider` import and wrap the app:

```tsx
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-surface-base text-text-primary">
          {/* ... existing Router, Routes, etc. */}
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
```

- [ ] **Step 6: Verify the build compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors related to ThemeContext or tailwind config.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.js src/index.css src/contexts/ThemeContext.tsx src/App.tsx index.html
git commit -m "feat: add theme foundation with CSS custom properties and dark mode support"
```

---

## Task 2: CollapsibleSidebar Component

**Files:**
- Create: `src/components/CollapsibleSidebar.tsx`
- Delete: `src/styles/sidebar.css`

- [ ] **Step 1: Create `src/components/CollapsibleSidebar.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Bell, Users, Settings,
  PenLine, LayoutGrid, LogOut, ChevronRight
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

interface NavSection {
  label?: string;
  items: NavItem[];
  roles?: number[];
}

const navSections: NavSection[] = [
  {
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/home' },
      { icon: FileText, label: 'Requests', path: '/requests-dashboard' },
      { icon: Bell, label: 'Notices', path: '/notices' },
      { icon: Users, label: 'Users', path: '/admin-user-management' },
    ],
  },
  {
    label: 'Admin',
    roles: [1, 6],
    items: [
      { icon: PenLine, label: 'Forms & Fields', path: '/admin-forms-groups' },
      { icon: LayoutGrid, label: 'Workspaces', path: '/jafar-administration' },
    ],
  },
];

interface CollapsibleSidebarProps {
  userRole?: number;
  userName?: string;
  userInitials?: string;
  notificationCount?: number;
}

export default function CollapsibleSidebar({
  userRole = 5,
  userName = '',
  userInitials = '',
  notificationCount = 0,
}: CollapsibleSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = () => {
    if (window.innerWidth < 1024) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setExpanded(true), 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setExpanded(false), 150);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const filteredSections = navSections.filter(
    (section) => !section.roles || section.roles.includes(userRole)
  );

  return (
    <div
      ref={sidebarRef}
      className="fixed left-0 top-0 h-screen z-40 hidden md:flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Collapsed rail — always visible */}
      <div className="w-[60px] bg-surface-sidebar flex flex-col items-center py-3.5 gap-0.5 flex-shrink-0">
        {/* Logo */}
        <div
          className="w-[34px] h-[34px] bg-secondary rounded-md flex items-center justify-center font-display font-extrabold text-[15px] text-primary mb-5 cursor-pointer"
          onClick={() => navigate('/home')}
        >
          G
        </div>

        {filteredSections.map((section, sIdx) => (
          <div key={sIdx} className="w-full flex flex-col items-center gap-0.5">
            {sIdx > 0 && (
              <div className="w-6 h-px bg-white/[0.08] my-2" />
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-[42px] h-[42px] rounded-md flex items-center justify-center relative transition-colors ${
                    active
                      ? 'bg-secondary/[0.12]'
                      : 'hover:bg-white/[0.06]'
                  }`}
                  title={item.label}
                >
                  <Icon
                    size={18}
                    className={active ? 'text-secondary' : 'text-white/[0.35]'}
                  />
                  {active && (
                    <div className="absolute left-0 top-[9px] w-[3px] h-6 bg-secondary rounded-r" />
                  )}
                  {item.icon === Bell && notificationCount > 0 && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-surface-sidebar" />
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Bottom: settings + avatar */}
        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            onClick={() => navigate('/account-settings')}
            className={`w-[42px] h-[42px] rounded-md flex items-center justify-center transition-colors ${
              isActive('/account-settings')
                ? 'bg-secondary/[0.12]'
                : 'hover:bg-white/[0.06]'
            }`}
            title="Settings"
          >
            <Settings
              size={18}
              className={isActive('/account-settings') ? 'text-secondary' : 'text-white/[0.35]'}
            />
          </button>
          <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center text-[11px] font-semibold text-secondary border-2 border-secondary/30">
            {userInitials}
          </div>
        </div>
      </div>

      {/* Expanded overlay */}
      <div
        className={`w-[200px] bg-surface-sidebar/[0.98] backdrop-blur-xl border-r border-secondary/10 flex flex-col py-3.5 transition-all duration-200 ${
          expanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none w-0 overflow-hidden'
        }`}
      >
        <div className="px-4 pb-5 font-display font-bold text-[16px] text-secondary">
          Guardian
        </div>

        {filteredSections.map((section, sIdx) => (
          <div key={sIdx}>
            {sIdx > 0 && (
              <div className="mx-4 h-px bg-white/[0.06] my-2" />
            )}
            {section.label && (
              <div className="px-4 py-1 text-overline text-white/25 uppercase">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] transition-colors ${
                    active
                      ? 'bg-secondary/10 border-l-[3px] border-secondary text-secondary font-medium'
                      : 'border-l-[3px] border-transparent text-white/50 hover:text-white/70'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                  {item.icon === Bell && notificationCount > 0 && (
                    <span className="ml-auto bg-error text-white text-[9px] px-1.5 py-0.5 rounded-full">
                      {notificationCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Bottom user info */}
        <div className="mt-auto px-4 pt-3 border-t border-white/[0.06] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] font-semibold text-secondary">
            {userInitials}
          </div>
          <div>
            <div className="text-[12px] font-medium text-white/80">{userName}</div>
            <div className="text-[10px] text-white/35">
              {userRole === 1 || userRole === 6 ? 'Admin' : userRole === 3 ? 'Manager' : userRole === 4 ? 'Processor' : 'User'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete `src/styles/sidebar.css`**

```bash
rm src/styles/sidebar.css
```

- [ ] **Step 3: Verify build compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/CollapsibleSidebar.tsx
git rm src/styles/sidebar.css
git commit -m "feat: add CollapsibleSidebar with hover expansion and role-based nav"
```

---

## Task 3: MobileBottomNav Component

**Files:**
- Create: `src/components/MobileBottomNav.tsx`

- [ ] **Step 1: Create `src/components/MobileBottomNav.tsx`**

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Bell, Users, MoreHorizontal } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Home', path: '/home' },
  { icon: FileText, label: 'Requests', path: '/requests-dashboard' },
  { icon: Bell, label: 'Notices', path: '/notices' },
  { icon: Users, label: 'Users', path: '/admin-user-management' },
  { icon: MoreHorizontal, label: 'More', path: '/account-settings' },
];

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-border flex justify-around py-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden z-40">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px]"
          >
            <Icon
              size={20}
              className={active ? 'text-secondary' : 'text-text-muted'}
            />
            <span
              className={`text-[10px] ${
                active ? 'text-secondary font-semibold' : 'text-text-muted'
              }`}
            >
              {item.label}
            </span>
            {active && (
              <div className="w-1 h-1 bg-secondary rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MobileBottomNav.tsx
git commit -m "feat: add MobileBottomNav with bottom tab navigation"
```

---

## Task 4: PageLayout Component

**Files:**
- Create: `src/components/PageLayout.tsx`
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Create `src/components/PageLayout.tsx`**

```tsx
import { ReactNode } from 'react';
import CollapsibleSidebar from './CollapsibleSidebar';
import MobileBottomNav from './MobileBottomNav';
import { Bell, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  userRole?: number;
  userName?: string;
  userInitials?: string;
  notificationCount?: number;
}

export default function PageLayout({
  children,
  title,
  subtitle,
  actions,
  userRole = 5,
  userName = '',
  userInitials = '',
  notificationCount = 0,
}: PageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-base">
      <CollapsibleSidebar
        userRole={userRole}
        userName={userName}
        userInitials={userInitials}
        notificationCount={notificationCount}
      />

      {/* Main content - offset by sidebar width */}
      <div className="md:ml-[60px] pb-20 md:pb-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-surface-card border-b border-border px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 md:hidden mb-1">
              <div className="w-[30px] h-[30px] bg-secondary rounded-lg flex items-center justify-center font-display font-extrabold text-[13px] text-primary">
                G
              </div>
            </div>
            <h1 className="font-display font-bold text-h2 text-text-primary">
              {title}
            </h1>
            {subtitle && (
              <p className="text-small text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search trigger */}
            <button
              className="hidden md:flex w-[200px] items-center gap-2 border border-border rounded-md px-3.5 py-2 text-small text-text-placeholder hover:border-secondary/50 transition-colors"
              onClick={() => {/* GlobalSearch will handle this */}}
            >
              <Search size={14} />
              <span>Search...</span>
              <kbd className="ml-auto text-[10px] bg-surface-base px-1.5 py-0.5 rounded text-text-muted">
                ⌘K
              </kbd>
            </button>

            {/* Notification bell */}
            <button
              onClick={() => navigate('/notices')}
              className="relative w-[38px] h-[38px] rounded-md bg-surface-card border border-border flex items-center justify-center hover:border-secondary/50 transition-colors"
            >
              <Bell size={16} className="text-text-secondary" />
              {notificationCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-error rounded-full border-2 border-surface-card flex items-center justify-center text-[9px] text-white font-semibold">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </div>
              )}
            </button>

            {/* Page-specific actions */}
            {actions}
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Update `src/components/Layout.tsx` to re-export PageLayout**

Replace the entire file with:

```tsx
export { default } from './PageLayout';
export type { default as PageLayoutProps } from './PageLayout';
```

This preserves existing imports while routing to the new component.

- [ ] **Step 3: Verify build compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/PageLayout.tsx src/components/Layout.tsx
git commit -m "feat: add PageLayout with sidebar, top bar, and mobile nav integration"
```

---

## Task 5: Updated UI Components (Button, Input, Select, TextArea, Card)

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/Select.tsx`
- Modify: `src/components/ui/TextArea.tsx`
- Modify: `src/components/ui/Card.tsx`
- Modify: `src/components/ui/Badge.tsx`

- [ ] **Step 1: Read all current UI component files to understand existing props/usage**

Read each file in `src/components/ui/` to understand the current prop interfaces before modifying them. We must maintain backward compatibility for existing consumers.

Run: `grep -r "from.*components/ui/" src/ --include="*.tsx" | head -40` to find all import sites.

- [ ] **Step 2: Update `src/components/ui/Button.tsx`**

Rewrite with new variants (primary, secondary, outline, ghost, danger), sizes (sm, md, lg), loading state, icon support. Must keep the existing prop interface compatible.

Read the current file first, then update it to use the new design tokens while preserving the `variant`, `size`, `fullWidth` props that existing code uses.

Key changes:
- Add `variant` options: `'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'`
- Add `size` options: `'sm' | 'md' | 'lg'`
- Add `loading` boolean prop
- Add `icon` prop for leading icon
- Border radius: `rounded-md` (10px)
- Use semantic color tokens

- [ ] **Step 3: Update `src/components/ui/Input.tsx`**

Key changes:
- Border: `border-[1.5px] border-border rounded-md`
- Focus: `focus:border-secondary focus:ring-[3px] focus:ring-secondary/[0.12]`
- Error: `border-error bg-error-light ring-error/[0.08]`
- Remove `rounded-full` if present, use `rounded-md`

- [ ] **Step 4: Update `src/components/ui/Select.tsx` and `TextArea.tsx` to match Input styling**

Same border, focus, and error token changes as Input.

- [ ] **Step 5: Update `src/components/ui/Card.tsx`**

Key changes:
- `rounded-lg` (14px), `shadow-sm`, `border border-border-light`
- `bg-surface-card` for dark mode support
- Remove the top 4px accent border (was too heavy)

- [ ] **Step 6: Update `src/components/ui/Badge.tsx`**

Replace with semantic color mapping. Add variant: `'pending' | 'in-progress' | 'completed' | 'cancelled' | 'assigned' | 'info'`.

- [ ] **Step 7: Verify build compiles and existing pages still render**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/
git commit -m "feat: update UI components with unified design tokens and dark mode support"
```

---

## Task 6: New Utility Components (StatusBadge, StatCard, EmptyState, SkeletonLoader, ThemeToggle)

**Files:**
- Create: `src/components/ui/StatusBadge.tsx`
- Create: `src/components/ui/StatCard.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/SkeletonLoader.tsx`
- Create: `src/components/ui/ThemeToggle.tsx`

- [ ] **Step 1: Create `src/components/ui/StatusBadge.tsx`**

```tsx
type StatusVariant = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'assigned' | 'info' | 'urgent';

const variantStyles: Record<StatusVariant, string> = {
  'pending': 'bg-warning-light text-[#92680a] dark:bg-warning/15 dark:text-warning',
  'in-progress': 'bg-info-light text-[#1d5cbf] dark:bg-info/15 dark:text-info',
  'completed': 'bg-success-light text-[#1a7a42] dark:bg-success/15 dark:text-success',
  'cancelled': 'bg-error-light text-[#991b1b] dark:bg-error/15 dark:text-error',
  'assigned': 'bg-secondary-light text-[#0e7a7a] dark:bg-secondary/15 dark:text-secondary',
  'info': 'bg-info-light text-[#1d5cbf] dark:bg-info/15 dark:text-info',
  'urgent': 'bg-warning-light text-[#92680a] dark:bg-warning/15 dark:text-warning',
};

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const displayLabel = label || status.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-[12px] font-medium ${variantStyles[status]} ${className}`}>
      {displayLabel}
    </span>
  );
}
```

- [ ] **Step 2: Create `src/components/ui/StatCard.tsx`**

```tsx
import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconBg?: string;
  trend?: string;
  trendColor?: string;
}

export default function StatCard({ label, value, icon, iconBg = 'bg-secondary-light', trend, trendColor = 'text-success' }: StatCardProps) {
  return (
    <div className="bg-surface-card rounded-lg p-5 shadow-sm border border-border-light">
      <div className="flex justify-between items-start mb-3">
        <span className="text-overline text-text-muted uppercase">{label}</span>
        {icon && (
          <div className={`w-8 h-8 rounded-md ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
        )}
      </div>
      <div className="text-[28px] font-bold text-text-primary leading-none">{value}</div>
      {trend && (
        <div className={`text-[11px] mt-1.5 ${trendColor}`}>{trend}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/ui/EmptyState.tsx`**

```tsx
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-8 px-5 border-[1.5px] border-dashed border-border rounded-lg">
      <div className="w-14 h-14 rounded-full bg-secondary-light mx-auto mb-3.5 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-semibold text-text-primary text-[15px]">{title}</h3>
      <p className="text-small text-text-muted mt-1.5 mb-4 max-w-[260px] mx-auto leading-relaxed">
        {description}
      </p>
      {action}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/ui/SkeletonLoader.tsx`**

```tsx
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-gradient-to-r from-border-light via-border to-border-light bg-[length:200%_100%] animate-shimmer rounded ${className}`}
    />
  );
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-3.5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-card rounded-lg p-5 border border-border-light">
          <Skeleton className="w-3/5 h-2.5 mb-3" />
          <Skeleton className="w-2/5 h-6" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-surface-card rounded-lg p-4 border border-border-light">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center mb-3.5 last:mb-0">
          <Skeleton className="w-[70px] h-3" />
          <Skeleton className="flex-1 h-3" />
          <Skeleton className="w-[60px] h-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/ui/ThemeToggle.tsx`**

```tsx
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex bg-surface-base rounded-md p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
            theme === value
              ? 'bg-surface-card shadow-sm'
              : 'hover:bg-surface-hover'
          }`}
          title={label}
        >
          <Icon
            size={14}
            className={theme === value ? 'text-secondary' : 'text-text-muted'}
          />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Verify build compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/StatusBadge.tsx src/components/ui/StatCard.tsx src/components/ui/EmptyState.tsx src/components/ui/SkeletonLoader.tsx src/components/ui/ThemeToggle.tsx
git commit -m "feat: add StatusBadge, StatCard, EmptyState, SkeletonLoader, ThemeToggle components"
```

---

## Task 7: Unified Modal Component

**Files:**
- Modify: `src/components/Modal.tsx`
- Modify: `src/components/ConfirmationModal.tsx`
- Delete: `src/styles/Modal.css`

- [ ] **Step 1: Read current Modal.tsx and ConfirmationModal.tsx to understand current prop interfaces**

Check all files importing these to ensure backward compatibility:

Run: `grep -r "from.*Modal" src/ --include="*.tsx" | grep -v node_modules | head -30`

- [ ] **Step 2: Rewrite `src/components/Modal.tsx`**

Must support: standard modal (header/body/footer), confirmation pattern, and mobile bottom sheet. Preserve the existing prop interface (`isOpen`, `onClose`, `title`, `children`, `size`).

Key changes:
- `rounded-xl` (16px), `shadow-lg`
- Backdrop: `bg-primary/40`
- Header: Montserrat title + subtitle + close button (rounded square)
- Footer: `bg-surface-base` with border, right-aligned buttons
- Mobile (<768px): Bottom sheet with drag handle, `rounded-t-[20px]`
- Focus trap and ESC to close

- [ ] **Step 3: Update `src/components/ConfirmationModal.tsx` to use the unified Modal**

Rewrite to wrap the unified Modal with a centered icon + message layout. Keep the existing prop interface.

- [ ] **Step 4: Remove `src/styles/Modal.css`**

```bash
rm src/styles/Modal.css
```

Remove any imports of `Modal.css` from other files:

Run: `grep -r "Modal.css" src/ --include="*.tsx" --include="*.ts"` and remove those import lines.

- [ ] **Step 5: Verify build compiles**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/components/Modal.tsx src/components/ConfirmationModal.tsx
git rm src/styles/Modal.css
git commit -m "feat: unify modal system with standard, confirmation, and mobile bottom sheet patterns"
```

---

## Task 8: Auth Pages Redesign (Login, Register, Verify, ForgotPassword, Reset)

**Files:**
- Modify: `src/pages/Login.tsx`
- Modify: `src/pages/Register.tsx`
- Modify: `src/pages/VerifyEmail.tsx`
- Modify: `src/pages/ForgotPassword.tsx`
- Modify: `src/pages/VerifyForgotPassword.tsx`
- Modify: `src/pages/ResetPassword.tsx`

- [ ] **Step 1: Read all auth page files to understand current form logic and validation**

Read Login.tsx, Register.tsx, VerifyEmail.tsx, ForgotPassword.tsx, VerifyForgotPassword.tsx, ResetPassword.tsx. Map their state management, validation logic, and API calls — these must be preserved exactly.

- [ ] **Step 2: Create a shared `AuthLayout` wrapper component inline in Login.tsx (or as a local component)**

All auth pages share the split-panel layout. Create a reusable wrapper:

```tsx
function AuthLayout({ children, brandContent }: { children: ReactNode; brandContent?: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex w-[42%] bg-gradient-to-br from-primary to-primary-light text-white p-8 flex-col justify-center">
        <div className="font-display font-extrabold text-[22px] text-secondary mb-2">Guardian</div>
        <div className="text-[13px] text-white/70 leading-relaxed mb-6">
          Secure request management for modern teams.
        </div>
        {brandContent || (
          <div className="space-y-2.5">
            {['Company-isolated data', 'Role-based access control', 'End-to-end workflow tracking'].map((text) => (
              <div key={text} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] text-secondary">✓</div>
                <span className="text-[11px] text-white/60">{text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Form panel */}
      <div className="flex-1 bg-surface-card flex items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center font-display font-extrabold text-sm text-primary">G</div>
            <span className="font-display font-bold text-lg text-text-primary">Guardian</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Restyle Login.tsx**

Wrap existing form logic in `AuthLayout`. Replace inline styles and class names with design token classes. Keep all validation, rate limiting, and API call logic unchanged.

Key styling changes:
- Title: `font-display font-bold text-[18px] text-text-primary`
- Subtitle: `text-small text-text-muted`
- Input labels: `text-[11px] font-medium text-text-secondary`
- Inputs: `border-[1.5px] border-border rounded-md px-3.5 py-2.5`
- Submit button: `bg-primary text-white rounded-md py-2.5 font-semibold`
- Links: `text-secondary`

- [ ] **Step 4: Restyle Register.tsx with step indicator in brand panel**

Same `AuthLayout` wrapper. Add step progress component in the `brandContent` prop showing the 3 registration steps.

- [ ] **Step 5: Restyle remaining auth pages (VerifyEmail, ForgotPassword, VerifyForgotPassword, ResetPassword)**

Each uses `AuthLayout` with appropriate contextual content in the brand panel.

- [ ] **Step 6: Verify all auth flows still work (form submission, validation, navigation)**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/pages/Login.tsx src/pages/Register.tsx src/pages/VerifyEmail.tsx src/pages/ForgotPassword.tsx src/pages/VerifyForgotPassword.tsx src/pages/ResetPassword.tsx
git commit -m "feat: redesign auth pages with split-panel layout and unified styling"
```

---

## Task 9: Dashboard Page Redesign

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Read `src/pages/Home.tsx` thoroughly**

Map all state, API calls, modals, and role-based logic. This is the most complex page.

- [ ] **Step 2: Wrap Home.tsx with PageLayout**

Replace the current layout wrapper with `PageLayout`:
- `title`: "Good morning, {userName}" (or time-appropriate greeting)
- `subtitle`: "Here's what needs your attention"
- `actions`: Primary "New Request" button

- [ ] **Step 3: Add stat cards section using StatCard component**

Replace current stat display with a 4-column grid of `StatCard` components:
- Open Requests (with FileText icon, secondary-light bg)
- Pending Tasks (with Clock icon, warning-light bg)
- Completed (with CheckCircle icon, success-light bg)
- Unread Notices (with Bell icon, info-light bg)

- [ ] **Step 4: Add recent requests table and quick actions sidebar**

Two-column layout (`grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3.5`):
- Left: Recent requests in a styled card with "View all" link
- Right: Quick Actions card with icon buttons (Submit Request, View Notices, Invite User)

- [ ] **Step 5: Remove react-bootstrap Modal import (if present in Home.tsx)**

Replace with the unified Guardian Modal component.

- [ ] **Step 6: Verify dashboard renders with all role variations**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: redesign dashboard with stat cards, recent requests, and quick actions"
```

---

## Task 10: Requests Pages Redesign

**Files:**
- Modify: `src/pages/RequestDashboard.tsx`
- Modify: `src/pages/RequestFulfillmentDashboard.tsx`
- Delete: `src/styles/RequestDashboard.css`

- [ ] **Step 1: Read both request page files and the CSS file**

Map all state, API calls, table configurations, and modal triggers.

- [ ] **Step 2: Restyle RequestDashboard.tsx**

Wrap with `PageLayout`. Add:
- Status filter tabs (pill-style with counts)
- Search input in top bar actions
- Styled data table with `StatusBadge` components
- Pagination component at bottom
- Empty state when no requests

Key changes:
- Remove `RequestDashboard.css` import
- Replace all hardcoded colors with design tokens
- Use `StatusBadge` for all status displays
- Avatar initials circles for "Assigned To" column

- [ ] **Step 3: Restyle RequestFulfillmentDashboard.tsx**

Wrap with `PageLayout`. Restyle the tab interface (Details/Form/Progress/Tasks/Feedback) with Guardian design tokens. Update all form inputs, status displays, and action buttons.

- [ ] **Step 4: Delete `src/styles/RequestDashboard.css`**

```bash
rm src/styles/RequestDashboard.css
```

Remove the import from RequestDashboard.tsx.

- [ ] **Step 5: Verify build and request pages render**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/pages/RequestDashboard.tsx src/pages/RequestFulfillmentDashboard.tsx
git rm src/styles/RequestDashboard.css
git commit -m "feat: redesign request pages with status tabs, styled tables, and unified tokens"
```

---

## Task 11: Notices Pages Redesign

**Files:**
- Modify: `src/pages/NoticesLandingPage.tsx`
- Modify: `src/pages/NoticeDetailsPage.tsx`

- [ ] **Step 1: Read both notice page files**

- [ ] **Step 2: Restyle NoticesLandingPage.tsx**

Wrap with `PageLayout`. Replace table/list with card-based layout:
- Each notice: card with left accent border, type icon, title, preview, timestamp
- Unread: full opacity + colored left border + blue dot
- Read: reduced opacity, no accent

- [ ] **Step 3: Restyle NoticeDetailsPage.tsx with design tokens**

- [ ] **Step 4: Commit**

```bash
git add src/pages/NoticesLandingPage.tsx src/pages/NoticeDetailsPage.tsx
git commit -m "feat: redesign notices with card-based layout and read/unread indicators"
```

---

## Task 12: Admin Pages Redesign

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`
- Modify: `src/pages/AdminUserManagement.tsx`
- Modify: `src/pages/AdminFields.tsx`
- Modify: `src/pages/AdminFormsGroups.tsx`
- Modify: `src/pages/AdminFormGroupFieldsPage.tsx`
- Modify: `src/pages/AdminFieldsLookupPage.tsx`

- [ ] **Step 1: Read all admin page files**

- [ ] **Step 2: Wrap each admin page with PageLayout and restyle**

Each admin page follows the same pattern:
- `PageLayout` with appropriate title and actions
- Data tables with design token styling
- `StatusBadge` for any status indicators
- Standard buttons, modals, and form inputs
- No separate "admin theme" — identical component usage

- [ ] **Step 3: Commit**

```bash
git add src/pages/Admin*.tsx
git commit -m "feat: redesign admin pages with unified page layout and design tokens"
```

---

## Task 13: Settings Pages Redesign

**Files:**
- Modify: `src/pages/AccountSettings.tsx`
- Modify: `src/pages/UpdateProfile.tsx`
- Modify: `src/pages/ChangePassword.tsx`
- Modify: `src/pages/NotificationPreferences.tsx`

- [ ] **Step 1: Read all settings page files**

- [ ] **Step 2: Restyle AccountSettings.tsx with side navigation**

Layout: side nav card (Profile / Password / Notifications / Appearance) + content panel. Add Appearance section with ThemeToggle component.

- [ ] **Step 3: Restyle profile, password, and notification pages with design tokens**

- [ ] **Step 4: Commit**

```bash
git add src/pages/AccountSettings.tsx src/pages/UpdateProfile.tsx src/pages/ChangePassword.tsx src/pages/NotificationPreferences.tsx
git commit -m "feat: redesign settings with side navigation and theme appearance picker"
```

---

## Task 14: Notification Dropdown Redesign

**Files:**
- Modify: `src/components/NotificationDropdown.tsx`

- [ ] **Step 1: Read current NotificationDropdown.tsx**

- [ ] **Step 2: Restyle with grouped notifications (Today/Yesterday), unread indicators, and Guardian tokens**

Key changes:
- Card dropdown: `rounded-lg shadow-md border border-border`
- Header: "Notifications" + "Mark all read" link
- Time group labels: overline style
- Unread: blue dot + subtle background
- Read: reduced opacity
- Footer: "View all notifications" link

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationDropdown.tsx
git commit -m "feat: redesign notification dropdown with time grouping and read indicators"
```

---

## Task 15: Toast Notification Theme

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add React Toastify theme override to `src/index.css`**

Add after the existing SweetAlert2 customizations:

```css
/* ===== REACT TOASTIFY GUARDIAN THEME ===== */
.Toastify__toast {
  border-radius: 14px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
  padding: 14px 16px !important;
  font-family: 'Inter', sans-serif !important;
  border-left: 4px solid transparent !important;
}
.Toastify__toast--success {
  border-left-color: var(--color-success) !important;
}
.Toastify__toast--error {
  border-left-color: var(--color-error) !important;
}
.Toastify__toast--warning {
  border-left-color: var(--color-warning) !important;
}
.Toastify__toast--info {
  border-left-color: var(--color-info) !important;
}
.Toastify__toast-body {
  font-size: 13px !important;
  color: var(--color-text-primary) !important;
}
[data-theme="dark"] .Toastify__toast {
  background: var(--color-surface-card) !important;
  color: var(--color-text-primary) !important;
}
```

- [ ] **Step 2: Update SweetAlert2 customizations in `src/index.css` to use CSS variables**

Replace hardcoded colors like `#032424` and `#25c6c6` with `var(--color-primary)` and `var(--color-secondary)`.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add Guardian-themed toast notifications and update SweetAlert2 to use tokens"
```

---

## Task 16: CSS Cleanup — Remove Obsolete Files

**Files:**
- Delete: Multiple CSS files
- Modify: Components that import deleted CSS

- [ ] **Step 1: Find all CSS imports across the codebase**

Run: `grep -r "import.*\.css" src/ --include="*.tsx" --include="*.ts"` to get a complete list.

- [ ] **Step 2: For each CSS file being deleted, find its importing component and remove the import line**

Files to delete:
```
src/styles/AddRequestModal.css
src/styles/StandardTemplates.css
src/styles/FormCreationFlow.css
src/components/ui/ConsistentCard.css
src/components/FormBuilder.css
src/components/FormFieldItem.css
src/components/RequestModal.css
```

For each deleted file: find the component that imports it, remove the import, and convert any CSS class names used in that component to Tailwind equivalents.

- [ ] **Step 3: Convert remaining large CSS files to inline Tailwind**

For these files, the CSS classes they define need to be replaced with Tailwind utility classes in the components that use them:
```
src/styles/SimpleFormBuilder.css
src/styles/EnhancedFormBuilder.css
src/styles/FormBuilder.css
src/styles/FidelitySubjectForm.css
src/components/EndpointManager/EndpointManager.css
```

This is the most labor-intensive step — read each CSS file, find its class names in the corresponding component, and replace with Tailwind classes.

- [ ] **Step 4: Update `src/styles/ag-grid-custom.css` colors to use CSS variables**

Replace hardcoded colors (`#4f46e5`, etc.) with `var(--color-secondary)`, `var(--color-primary)`, etc.

- [ ] **Step 5: Remove `react-bootstrap` and `bootstrap` from `package.json`**

```bash
cd "/Users/epena/Desktop/www/projects/Guardian MVP" && bun remove react-bootstrap bootstrap
```

Verify no imports remain: `grep -r "react-bootstrap\|from 'bootstrap'" src/ --include="*.tsx" --include="*.ts"`

- [ ] **Step 6: Verify build compiles with no missing CSS or imports**

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit 2>&1 | head -20`

Run: `cd "/Users/epena/Desktop/www/projects/Guardian MVP" && bun run build 2>&1 | tail -20`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove Bootstrap dependency and consolidate CSS into Tailwind utilities"
```

---

## Task 17: Global Search Component

**Files:**
- Create: `src/components/GlobalSearch.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/GlobalSearch.tsx`**

Command palette overlay triggered by `Ctrl+K` / `Cmd+K`:
- Fixed overlay with backdrop
- Search input with debounced query (300ms)
- Categorized results (Requests, Tasks, Notices)
- Keyboard navigation (arrow keys + Enter)
- `StatusBadge` for result status
- ESC to close

The component registers a global `keydown` listener for `Ctrl+K`/`Cmd+K` and renders as a portal.

- [ ] **Step 2: Add GlobalSearch to App.tsx**

Add `<GlobalSearch />` inside the ThemeProvider, outside the Router (so it's always available).

- [ ] **Step 3: Wire up the search trigger in PageLayout.tsx**

Connect the search bar button in PageLayout to open GlobalSearch.

- [ ] **Step 4: Commit**

```bash
git add src/components/GlobalSearch.tsx src/App.tsx src/components/PageLayout.tsx
git commit -m "feat: add global search command palette with Ctrl+K shortcut"
```

---

## Task 18: Final Verification & Cleanup

**Files:**
- Various

- [ ] **Step 1: Run full type check**

```bash
cd "/Users/epena/Desktop/www/projects/Guardian MVP" && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Run build**

```bash
cd "/Users/epena/Desktop/www/projects/Guardian MVP" && bun run build
```

Fix any build errors.

- [ ] **Step 3: Run lint**

```bash
cd "/Users/epena/Desktop/www/projects/Guardian MVP" && bun run lint
```

Fix any lint errors.

- [ ] **Step 4: Verify no orphaned CSS imports**

```bash
grep -r "import.*\.css" src/ --include="*.tsx" --include="*.ts" | grep -v index.css | grep -v ag-grid | grep -v ReactToastify
```

Any remaining CSS imports (besides index.css, ag-grid-custom.css, and ReactToastify.css) should be removed.

- [ ] **Step 5: Verify no hardcoded rogue colors remain**

```bash
grep -rn "#219191\|#25c6c6\|#007bff\|#4f46e5" src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

Expected: No results.

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup — fix type errors, lint, and remove orphaned imports"
```

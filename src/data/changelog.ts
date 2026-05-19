/**
 * Guardian MVP — user-facing changelog.
 *
 * This file is the single source of truth for the "What's New" dropdown
 * in the top navigation. Each entry represents one release/push.
 *
 * HOW TO ADD A NEW RELEASE:
 *   1. Prepend a new entry to the top of the CHANGELOG array below.
 *   2. Give it a unique `id` — either a version tag ("v2.8.0") or a
 *      date-slug ("2026-04-15-task-export").
 *   3. Use today's date in ISO format: "YYYY-MM-DD".
 *   4. Write `title` and `highlights.text` in plain English. Imagine
 *      explaining the change to a non-technical coworker — no file paths,
 *      no framework names, no developer jargon.
 *   5. Categorize each highlight as 'new' (brand new feature),
 *      'improved' (existing feature made better), or 'fixed' (bug fix).
 *
 * ORDER MATTERS: the entry at index 0 is treated as the newest release.
 */

export type ChangelogCategory = 'new' | 'improved' | 'fixed';

export interface ChangelogHighlight {
  /** One-line feature description written for end users. */
  text: string;
  /** Drives the color chip shown next to the bullet. */
  category: ChangelogCategory;
}

export interface ChangelogEntry {
  /** Stable unique id — used for "last seen" tracking in localStorage. */
  id: string;
  /** ISO date string, e.g. "2026-04-08" — the day the release shipped. */
  date: string;
  /** Optional semantic version tag displayed next to the date. */
  version?: string;
  /** Short headline summarizing the release. */
  title: string;
  /** Ordered list of user-friendly highlights for this release. */
  highlights: ChangelogHighlight[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-05-19-securities-notice-mvp',
    date: '2026-05-19',
    title: 'Securities Fraud Notices, Subpoena Riders, and a full audit trail',
    highlights: [
      {
        text: 'A new Securities Fraud Notice template lets admins build a notice form preloaded with the right fields — security symbol, loss exposure, incident time, victim count, and securities involved.',
        category: 'new',
      },
      {
        text: 'Processors can send notices directly when the template allows it, or submit for manager approval when it doesn\'t — with a built-in approval queue and one-click approve/reject + reason.',
        category: 'new',
      },
      {
        text: 'First-time recipient warning: sending to someone you\'ve never sent to before now prompts you to confirm, and the confirmation is logged.',
        category: 'new',
      },
      {
        text: 'Subpoena Rider Builder — pick a fraud type, auto-populate non-PII tokens from the incident, and attach a rider to your outbound notice. Real-time PII scanning blocks names, SSNs, DOBs, and account numbers before save.',
        category: 'new',
      },
      {
        text: 'External User portal for law enforcement — a scoped inbox where agencies can view their notice, attach an executed subpoena (PDF/TIFF/DOCX), or request a call.',
        category: 'new',
      },
      {
        text: 'Compliance Disclaimer Injection — Securities Fraud templates default to including the platform disclaimer; turning it off requires confirmation and is recorded.',
        category: 'new',
      },
      {
        text: 'PII Field Restrictions — admins can disable sensitive fields per template, and JAFAR-locked fields are grayed out across all tenants.',
        category: 'new',
      },
      {
        text: 'Full Audit Log — filter by date, event type, actor, or target and export to CSV or PDF. Captures template changes, approvals, sends, subpoena receipts, records releases, and more.',
        category: 'new',
      },
      {
        text: 'JAFAR Platform Config page — update the disclaimer text, lock fields globally, and manage permitted subpoena file types from one screen.',
        category: 'new',
      },
    ],
  },
  {
    id: '2026-04-22-rename-company',
    date: '2026-04-22',
    title: 'Rename your company anytime',
    highlights: [
      {
        text: "Admins can now update their company name after setup — no need to get it perfect during onboarding.",
        category: 'improved',
      },
      {
        text: 'Previously the company name could only be set during initial account creation.',
        category: 'fixed',
      },
    ],
  },
  {
    id: 'v2.7.0',
    date: '2026-04-08',
    version: 'v2.7.0',
    title: "See what's new, right from the top",
    highlights: [
      {
        text: "Introducing the What's New panel — click the sparkle icon in the top bar to see the latest features and improvements.",
        category: 'new',
      },
      {
        text: 'A red badge lets you know when there are updates you haven\'t seen yet.',
        category: 'new',
      },
    ],
  },
  {
    id: 'v2.6.1',
    date: '2026-03-24',
    version: 'v2.6.1',
    title: 'Smoother form building experience',
    highlights: [
      {
        text: 'Custom form templates now load reliably every time you open the form builder.',
        category: 'fixed',
      },
      {
        text: 'Clearer sign-in prompts when your session has expired, so you always know what to do next.',
        category: 'improved',
      },
    ],
  },
  {
    id: 'v2.6.0',
    date: '2026-03-05',
    version: 'v2.6.0',
    title: 'Better task assignment',
    highlights: [
      {
        text: 'Assign tasks to teammates with a new searchable picker — no more typing names from memory.',
        category: 'new',
      },
      {
        text: 'Select multiple tasks at once and assign them in a single step.',
        category: 'new',
      },
      {
        text: 'Fixed a display issue where some page content would fail to load on the live site.',
        category: 'fixed',
      },
    ],
  },
  {
    id: 'v2.5.0',
    date: '2026-02-10',
    version: 'v2.5.0',
    title: 'Task management inside requests',
    highlights: [
      {
        text: 'New Tasks tab in the Request Details screen lets you break work down into smaller pieces.',
        category: 'new',
      },
      {
        text: 'Track progress with status filters, summary cards, and CSV/Excel export.',
        category: 'new',
      },
      {
        text: 'Get notified automatically when a task is assigned to you.',
        category: 'improved',
      },
    ],
  },
];

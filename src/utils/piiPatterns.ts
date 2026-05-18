// src/utils/piiPatterns.ts
//
// Phase 7 / US-SRB-02 — Frontend mirror of the server-side PII patterns
// in server/lib/piiGuard.ts. Used by GenerateRiderModal to surface a
// real-time warning while the Processor types, before the server-side
// scan rejects on save. KEEP IN SYNC with server/lib/piiGuard.ts.

const PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'DOB', re: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/ },
  { label: 'ACCOUNT_NUMBER', re: /\b\d{7,12}\b/ },
  // Naive name detector: two capitalized words. Override-allowed via [TOKEN] placeholders.
  { label: 'CUSTOMER_NAME', re: /(?<!\[)\b[A-Z][a-z]{1,}\s[A-Z][a-z]{1,}\b(?![\w-]*\])/ },
];

export function scanForPII(text: string): { hit: boolean; label?: string } {
  for (const { label, re } of PATTERNS) {
    if (re.test(text)) return { hit: true, label };
  }
  return { hit: false };
}

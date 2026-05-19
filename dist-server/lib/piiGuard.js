// server/lib/piiGuard.ts
//
// Phase 7 / US-SRB-01 + US-SRB-02 — PII pattern library for subpoena language
// templates and Processor-supplied token values. Returns a labelled hit so the
// caller can show a precise warning ("Remove SSN before saving").
//
// The detectors are intentionally conservative: false positives cost a save
// (a one-line removal), false negatives cost a compliance breach.
const PATTERNS = [
    { label: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/ },
    { label: 'DOB', re: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/ },
    { label: 'ACCOUNT_NUMBER', re: /\b\d{7,12}\b/ },
    // Naive name detector: two capitalized words. Override-allowed via [TOKEN] placeholders.
    { label: 'CUSTOMER_NAME', re: /(?<!\[)\b[A-Z][a-z]{1,}\s[A-Z][a-z]{1,}\b(?![\w-]*\])/ },
];
export function scanForPII(text) {
    for (const { label, re } of PATTERNS) {
        if (re.test(text))
            return { hit: true, label };
    }
    return { hit: false };
}

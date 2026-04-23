import type { SecurityFinding } from './types';

/**
 * Build a copy-paste-ready prompt for an AI coding agent (e.g. Claude Code) to
 * fix a single security finding. The prompt bundles all context the agent
 * needs — description, exploit scenario, recommendation, verification — and
 * reminds it of Guardian MVP's multi-server sync rule so backend fixes don't
 * get applied to only one of the three legacy server files.
 */
export function buildAgentPrompt(finding: SecurityFinding): string {
    const location = finding.line && finding.line > 0
        ? `${finding.file}:${finding.line}`
        : finding.file;

    const commitLine = finding.commit ? `Commit: ${finding.commit}\n` : '';

    return `You are fixing a verified security finding from a gstack cso scan of Guardian MVP.

**Finding #${finding.id}: ${finding.title}**
Severity: ${finding.severity} · Confidence: ${finding.confidence}/10 · Status: ${finding.status}
Category: ${finding.category}
File: ${location}
${commitLine}
## Problem
${finding.description}

## Exploit scenario
${finding.exploit_scenario}

## Impact
${finding.impact}

## Required fix
${finding.recommendation}

## Playbook
${finding.playbook}

## Verification (from the scan report)
${finding.verification}

## Instructions
1. Read the files referenced above before making any changes.
2. Apply the fix in "Required fix". Keep the change surgical — do not refactor unrelated code or add features that aren't required by the fix.
3. Guardian MVP multi-server sync rule: if the fix touches \`server.cjs\`, apply the identical change to \`server-production.js\` and \`server.js\` as well (per CLAUDE.md). Do NOT skip this — all three server files must stay in sync.
4. Run \`bunx tsc --noEmit\` after any TypeScript change and \`node --check <file>\` after any .cjs/.js change. Fix any errors you introduce.
5. Do NOT commit. Show me a summary of the diff and the verification steps you took, then wait for my review.
`;
}

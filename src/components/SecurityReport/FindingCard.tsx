import React from 'react';
import { ChevronDown, ChevronRight, Copy, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import type { SecurityFinding, Severity } from './types';
import { buildAgentPrompt } from './buildAgentPrompt';

interface FindingCardProps {
    finding: SecurityFinding;
    expanded: boolean;
    onToggle: () => void;
}

const severityStyles: Record<Severity | 'UNKNOWN', string> = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    LOW: 'bg-green-100 text-green-800 border-green-300',
    UNKNOWN: 'bg-gray-100 text-gray-700 border-gray-300'
};

const severityClass = (sev: string): string => {
    if (sev === 'CRITICAL' || sev === 'HIGH' || sev === 'MEDIUM' || sev === 'LOW') {
        return severityStyles[sev];
    }
    return severityStyles.UNKNOWN;
};

const copyToClipboard = async (label: string, text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    } catch {
        toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
};

const Section: React.FC<{ label: string; body: string; copyLabel?: string }> = ({ label, body, copyLabel }) => (
    <div className="mt-3">
        <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h5>
            {copyLabel && (
                <button
                    type="button"
                    onClick={() => copyToClipboard(copyLabel, body)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                    <Copy className="h-3 w-3" /> Copy {copyLabel.toLowerCase()}
                </button>
            )}
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{body}</p>
    </div>
);

const FindingCard: React.FC<FindingCardProps> = ({ finding, expanded, onToggle }) => {
    return (
        <div className="rounded-md border border-gray-200 bg-white">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50"
            >
                {expanded ? <ChevronDown className="h-4 w-4 mt-1" /> : <ChevronRight className="h-4 w-4 mt-1" />}
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${severityClass(finding.severity)}`}>
                            {finding.severity}
                        </span>
                        <span className="text-xs text-gray-600">{finding.confidence}/10</span>
                        <span className="text-xs text-gray-600">· {finding.status}</span>
                        <span className="text-xs text-gray-600">· {finding.category}</span>
                    </div>
                    <div className="mt-1 font-semibold text-gray-900">{finding.title}</div>
                    <div className="text-xs font-mono text-gray-500 mt-0.5">
                        {finding.file}{finding.line ? `:${finding.line}` : ''}
                    </div>
                </div>
            </button>
            {expanded && (
                <div className="p-4 border-t border-gray-200">
                    <div className="flex justify-end mb-2">
                        <button
                            type="button"
                            onClick={() => copyToClipboard('Agent prompt', buildAgentPrompt(finding))}
                            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 flex items-center gap-1.5"
                            title="Copy a ready-to-paste prompt for an AI coding agent (e.g. Claude Code) to fix this finding"
                        >
                            <Sparkles className="h-3.5 w-3.5" /> Copy agent prompt
                        </button>
                    </div>
                    <Section label="Description" body={finding.description} />
                    <Section label="Exploit scenario" body={finding.exploit_scenario} />
                    <Section label="Impact" body={finding.impact} />
                    <Section label="Recommendation" body={finding.recommendation} copyLabel="Recommendation" />
                    <Section label="Playbook" body={finding.playbook} copyLabel="Playbook" />
                    <Section label="Verification" body={finding.verification} />
                    {finding.commit && (
                        <div className="mt-3 text-xs text-gray-500 font-mono">commit: {finding.commit}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FindingCard;

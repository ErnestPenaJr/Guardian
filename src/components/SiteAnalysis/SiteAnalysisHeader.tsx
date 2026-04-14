import React from 'react';
import { RefreshCw } from 'lucide-react';
import { SITE_ANALYSIS_RANGE_OPTIONS, type SiteAnalysisRange } from './types';

interface SiteAnalysisHeaderProps {
    range: SiteAnalysisRange;
    onRangeChange: (range: SiteAnalysisRange) => void;
    onRefresh: () => void;
    loading: boolean;
    generatedAt: string | null;
    cached: boolean;
}

const formatRelative = (iso: string): string => {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
};

const SiteAnalysisHeader: React.FC<SiteAnalysisHeaderProps> = ({
    range,
    onRangeChange,
    onRefresh,
    loading,
    generatedAt,
    cached
}) => {
    return (
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
            <div>
                <h2 className="fw-bold mb-1">Site Analysis</h2>
                <p className="text-muted mb-0">
                    Cross-company platform usage metrics.{' '}
                    {generatedAt && (
                        <span className="small">
                            Updated {formatRelative(generatedAt)}{cached ? ' (cached)' : ''} ·{' '}
                            <span title="Day buckets use UTC; events near local midnight may appear on the adjacent day.">
                                times shown in your local timezone
                            </span>
                        </span>
                    )}
                </p>
            </div>
            <div className="d-flex gap-2 flex-wrap align-items-center">
                <div className="btn-group" role="group" aria-label="Date range">
                    {SITE_ANALYSIS_RANGE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`btn btn-sm ${range === option.value ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => onRangeChange(option.value)}
                            disabled={loading}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                    onClick={onRefresh}
                    disabled={loading}
                    title="Bypass cache and re-fetch fresh data"
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    Refresh
                </button>
            </div>
        </div>
    );
};

export default SiteAnalysisHeader;

import React from 'react';
import { Search } from 'lucide-react';
import type { Severity } from './types';

export type SeverityFilter = 'ALL' | Severity;

interface FindingsToolbarProps {
    severity: SeverityFilter;
    onSeverityChange: (sev: SeverityFilter) => void;
    search: string;
    onSearchChange: (value: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    resultCount: number;
    totalCount: number;
}

const filters: Array<{ value: SeverityFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' }
];

const FindingsToolbar: React.FC<FindingsToolbarProps> = ({
    severity, onSeverityChange, search, onSearchChange,
    onExpandAll, onCollapseAll, resultCount, totalCount
}) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {filters.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => onSeverityChange(f.value)}
                        className={`text-xs px-3 py-1 rounded-full border ${
                            severity === f.value
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
                <span className="text-xs text-gray-500 ml-2">
                    {resultCount} of {totalCount}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search title, file, category..."
                        className="text-sm pl-8 pr-3 py-1.5 border border-gray-300 rounded-md w-64"
                    />
                </div>
                <button
                    type="button"
                    onClick={onExpandAll}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Expand all
                </button>
                <button
                    type="button"
                    onClick={onCollapseAll}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Collapse all
                </button>
            </div>
        </div>
    );
};

export default FindingsToolbar;

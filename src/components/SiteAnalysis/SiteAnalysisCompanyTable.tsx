import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type { SiteAnalysisCompanyRow } from './types';

// Note: AG Grid v33 ships with a default Theming API theme (themeQuartz). The
// rest of the project relies on this default — see TaskTable.tsx and
// WorkProgressTable.tsx, neither of which imports the legacy CSS files.
// Importing ag-grid.css / ag-theme-alpine.css here triggers AG Grid error #239
// because the CSS theme and Theming API conflict.

interface SiteAnalysisCompanyTableProps {
    companies: SiteAnalysisCompanyRow[];
}

const formatRelative = (iso: string | null): string => {
    if (!iso) return 'Never';
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMo = Math.floor(diffDay / 30);
    if (diffMo < 12) return `${diffMo}mo ago`;
    return `${Math.floor(diffMo / 12)}y ago`;
};

const formatInt = (n: number) => n.toLocaleString();

const SiteAnalysisCompanyTable: React.FC<SiteAnalysisCompanyTableProps> = ({ companies }) => {
    const columnDefs = useMemo<ColDef<SiteAnalysisCompanyRow>[]>(() => [
        {
            headerName: 'Company',
            field: 'companyName',
            sortable: true,
            filter: true,
            flex: 2,
            minWidth: 180
        },
        {
            headerName: 'Users (active / total)',
            sortable: true,
            valueGetter: (params) =>
                `${formatInt(params.data?.activeUsersInRange ?? 0)} / ${formatInt(params.data?.totalUsers ?? 0)}`,
            comparator: (_a, _b, nodeA, nodeB) =>
                (nodeA.data?.activeUsersInRange ?? 0) - (nodeB.data?.activeUsersInRange ?? 0),
            flex: 1,
            minWidth: 140
        },
        {
            headerName: 'Requests (range / all)',
            sortable: true,
            valueGetter: (params) =>
                `${formatInt(params.data?.requestsInRange ?? 0)} / ${formatInt(params.data?.totalRequests ?? 0)}`,
            comparator: (_a, _b, nodeA, nodeB) =>
                (nodeA.data?.requestsInRange ?? 0) - (nodeB.data?.requestsInRange ?? 0),
            sort: 'desc',
            flex: 1,
            minWidth: 150
        },
        {
            headerName: 'Tasks (range / all)',
            sortable: true,
            valueGetter: (params) =>
                `${formatInt(params.data?.tasksInRange ?? 0)} / ${formatInt(params.data?.totalTasks ?? 0)}`,
            comparator: (_a, _b, nodeA, nodeB) =>
                (nodeA.data?.tasksInRange ?? 0) - (nodeB.data?.tasksInRange ?? 0),
            flex: 1,
            minWidth: 140
        },
        {
            headerName: 'Templates',
            field: 'customFormTemplates',
            sortable: true,
            valueFormatter: (p) => formatInt(p.value ?? 0),
            flex: 1,
            minWidth: 100
        },
        {
            headerName: 'Last Activity',
            field: 'lastActivityAt',
            sortable: true,
            valueFormatter: (p) => formatRelative(p.value),
            comparator: (a, b) => {
                const ta = a ? new Date(a).getTime() : 0;
                const tb = b ? new Date(b).getTime() : 0;
                return ta - tb;
            },
            flex: 1,
            minWidth: 130
        },
        {
            headerName: 'Account Age',
            field: 'accountAgeDays',
            sortable: true,
            valueFormatter: (p) => `${formatInt(p.value ?? 0)}d`,
            flex: 1,
            minWidth: 110
        },
        {
            headerName: '% Platform Requests',
            field: 'percentOfPlatformRequests',
            sortable: true,
            valueFormatter: (p) => `${(p.value ?? 0).toFixed(1)}%`,
            flex: 1,
            minWidth: 130
        }
    ], []);

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        suppressMovable: true
    }), []);

    return (
        <div className="bg-white border rounded p-3 shadow-sm">
            <h5 className="mb-3">Company Breakdown</h5>
            {companies.length === 0 ? (
                <div className="text-muted">No companies yet.</div>
            ) : (
                <div className="ag-theme-alpine" style={{ width: '100%', height: 500 }}>
                    <AgGridReact<SiteAnalysisCompanyRow>
                        rowData={companies}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        animateRows
                        rowHeight={40}
                    />
                </div>
            )}
        </div>
    );
};

export default SiteAnalysisCompanyTable;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import SummaryCards from '../components/SecurityReport/SummaryCards';
import AttackSurfacePanel from '../components/SecurityReport/AttackSurfacePanel';
import SupplyChainPanel from '../components/SecurityReport/SupplyChainPanel';
import FindingsToolbar, { type SeverityFilter } from '../components/SecurityReport/FindingsToolbar';
import FindingCard from '../components/SecurityReport/FindingCard';
import type {
    SecurityReport as SecurityReportPayload,
    SecurityReportSummary,
    SecurityReportListResponse
} from '../components/SecurityReport/types';

interface FullReportResponse {
    filename: string;
    report: SecurityReportPayload;
}

const SecurityReport: React.FC = () => {
    const [reports, setReports] = useState<SecurityReportSummary[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [report, setReport] = useState<SecurityReportPayload | null>(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [listError, setListError] = useState<string | null>(null);

    const [severity, setSeverity] = useState<SeverityFilter>('ALL');
    const [search, setSearch] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const fetchList = useCallback(async () => {
        setLoadingList(true);
        setListError(null);
        try {
            const { data } = await api.get<SecurityReportListResponse>('/api/jafar-admin/security-reports');
            setReports(data.reports || []);
            if (data.reports && data.reports.length > 0) {
                setSelected(data.reports[0].filename);
            } else {
                setSelected(null);
                setReport(null);
            }
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { error?: string } }; message?: string })
                ?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to load security reports';
            setListError(message);
        } finally {
            setLoadingList(false);
        }
    }, []);

    const fetchReport = useCallback(async (filename: string) => {
        setLoadingReport(true);
        try {
            const url = filename === reports[0]?.filename
                ? '/api/jafar-admin/security-reports/latest'
                : `/api/jafar-admin/security-reports/${encodeURIComponent(filename)}`;
            const { data } = await api.get<FullReportResponse>(url);
            setReport(data.report);
            setExpandedIds(new Set());
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { error?: string } }; message?: string })
                ?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to load report';
            toast.error(message);
        } finally {
            setLoadingReport(false);
        }
    }, [reports]);

    useEffect(() => { void fetchList(); }, [fetchList]);
    useEffect(() => { if (selected) void fetchReport(selected); }, [selected, fetchReport]);

    const filteredFindings = useMemo(() => {
        if (!report) return [];
        const q = search.trim().toLowerCase();
        return report.findings.filter((f) => {
            if (severity !== 'ALL' && f.severity !== severity) return false;
            if (!q) return true;
            return (
                f.title.toLowerCase().includes(q) ||
                (f.file || '').toLowerCase().includes(q) ||
                (f.category || '').toLowerCase().includes(q)
            );
        });
    }, [report, severity, search]);

    const toggleFinding = (id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => {
        if (!report) return;
        setExpandedIds(new Set(filteredFindings.map((f) => f.id)));
    };
    const collapseAll = () => setExpandedIds(new Set());

    if (loadingList) {
        return <div className="container mx-auto py-6">Loading security reports...</div>;
    }

    if (listError) {
        return (
            <div className="container mx-auto py-6">
                <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
                    <div className="font-semibold mb-1">Failed to load reports</div>
                    <div className="text-sm">{listError}</div>
                    <button
                        type="button"
                        onClick={() => void fetchList()}
                        className="mt-2 text-sm underline"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="container mx-auto py-6">
                <div className="rounded-md border border-gray-300 bg-gray-50 p-6 text-gray-700">
                    <div className="font-semibold mb-1">No security reports available</div>
                    <div className="text-sm">
                        No security reports are available on this environment. Run <code className="font-mono">gstack cso</code> locally to generate one.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Security Report</h1>
                    {report && (
                        <div className="text-sm text-gray-500 mt-1">
                            <span className="font-mono">{report.mode}</span> · <span className="font-mono">{report.scope}</span> · version {report.version}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selected ?? ''}
                        onChange={(e) => setSelected(e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
                        disabled={loadingReport}
                    >
                        {reports.map((r) => (
                            <option key={r.filename} value={r.filename}>
                                {r.date} ({r.filename})
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
                    >
                        <Printer className="h-4 w-4" /> Print
                    </button>
                </div>
            </div>

            {loadingReport && <div className="text-sm text-gray-500">Loading report...</div>}

            {report && (
                <>
                    <SummaryCards totals={report.totals} trend={report.trend} />
                    <AttackSurfacePanel code={report.attack_surface.code} infrastructure={report.attack_surface.infrastructure} />
                    <SupplyChainPanel summary={report.supply_chain_summary} />

                    <div className="space-y-3">
                        <FindingsToolbar
                            severity={severity}
                            onSeverityChange={setSeverity}
                            search={search}
                            onSearchChange={setSearch}
                            onExpandAll={expandAll}
                            onCollapseAll={collapseAll}
                            resultCount={filteredFindings.length}
                            totalCount={report.findings.length}
                        />
                        {filteredFindings.map((f) => (
                            <FindingCard
                                key={f.id}
                                finding={f}
                                expanded={expandedIds.has(f.id)}
                                onToggle={() => toggleFinding(f.id)}
                            />
                        ))}
                        {filteredFindings.length === 0 && (
                            <div className="text-sm text-gray-500 py-4">No findings match the current filters.</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default SecurityReport;

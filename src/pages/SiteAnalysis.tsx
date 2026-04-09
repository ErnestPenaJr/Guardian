import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../utils/api';
import SiteAnalysisHeader from '../components/SiteAnalysis/SiteAnalysisHeader';
import SiteAnalysisKpiCards from '../components/SiteAnalysis/SiteAnalysisKpiCards';
import SiteAnalysisActivityChart from '../components/SiteAnalysis/SiteAnalysisActivityChart';
import SiteAnalysisNewAccountsChart from '../components/SiteAnalysis/SiteAnalysisNewAccountsChart';
import SiteAnalysisCompanyTable from '../components/SiteAnalysis/SiteAnalysisCompanyTable';
import type { SiteAnalysisPayload, SiteAnalysisRange } from '../components/SiteAnalysis/types';

const SiteAnalysis: React.FC = () => {
    const [range, setRange] = useState<SiteAnalysisRange>('30d');
    const [data, setData] = useState<SiteAnalysisPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async (nextRange: SiteAnalysisRange, refresh = false) => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const params: Record<string, string> = { range: nextRange };
            if (refresh) params.refresh = 'true';
            const response = await api.get<SiteAnalysisPayload>('/api/jafar-admin/site-analysis', {
                params,
                signal: controller.signal
            });
            if (!controller.signal.aborted) {
                setData(response.data);
            }
        } catch (err: unknown) {
            if (controller.signal.aborted) return;
            const message = (err as { response?: { data?: { error?: string } }; message?: string })
                ?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to load site analysis';
            setError(message);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void fetchData(range);
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [range, fetchData]);

    const handleRefresh = () => {
        void fetchData(range, true);
    };

    return (
        <div className="container-fluid py-4">
            <SiteAnalysisHeader
                range={range}
                onRangeChange={setRange}
                onRefresh={handleRefresh}
                loading={loading}
                generatedAt={data?.generatedAt ?? null}
                cached={data?.cached ?? false}
            />

            {error && (
                <div className="alert alert-danger d-flex justify-content-between align-items-center">
                    <div>
                        <strong>Failed to load:</strong> {error}
                    </div>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={handleRefresh}
                    >
                        Retry
                    </button>
                </div>
            )}

            {loading && !data && (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            )}

            {data && (
                <>
                    <SiteAnalysisKpiCards kpis={data.kpis} />
                    <div className="row g-3 mb-4">
                        <div className="col-12 col-lg-8">
                            <SiteAnalysisActivityChart data={data.trends.activityPerDay} />
                        </div>
                        <div className="col-12 col-lg-4">
                            <SiteAnalysisNewAccountsChart data={data.trends.newAccountsPerDay} />
                        </div>
                    </div>
                    <SiteAnalysisCompanyTable companies={data.companies} />
                </>
            )}
        </div>
    );
};

export default SiteAnalysis;

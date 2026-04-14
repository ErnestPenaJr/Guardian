import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { AgGridReact } from 'ag-grid-react';
import api from '../../utils/api';
import { drilldownColumns } from './drilldownColumns';
import type { KpiDrilldownPayload, KpiDrilldownType, SiteAnalysisRange } from './types';

// Note: AG Grid v33 uses the Theming API default theme (themeQuartz). Do NOT
// import ag-grid.css or ag-theme-alpine.css here — see commit b268623 for the
// hard-won lesson about AG Grid error #239.

interface KpiDrilldownModalProps {
    type: KpiDrilldownType | null;
    range: SiteAnalysisRange;
    onClose: () => void;
}

const KpiDrilldownModal: React.FC<KpiDrilldownModalProps> = ({ type, range, onClose }) => {
    const [data, setData] = useState<KpiDrilldownPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async (kpiType: KpiDrilldownType, kpiRange: SiteAnalysisRange) => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const response = await api.get<KpiDrilldownPayload>('/api/jafar-admin/site-analysis/drilldown', {
                params: { type: kpiType, range: kpiRange },
                signal: controller.signal
            });
            if (!controller.signal.aborted) {
                setData(response.data);
            }
        } catch (err: unknown) {
            if (controller.signal.aborted) return;
            const message = (err as { response?: { data?: { error?: string } }; message?: string })
                ?.response?.data?.error ?? (err as Error)?.message ?? 'Failed to load drill-down';
            setError(message);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (!type) {
            setData(null);
            setError(null);
            setLoading(false);
            return;
        }
        void fetchData(type, range);
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [type, range, fetchData]);

    const handleRetry = () => {
        if (type) void fetchData(type, range);
    };

    const config = type ? drilldownColumns[type] : null;
    const isOpen = type !== null;

    const subtitle = (() => {
        if (loading) return 'Loading...';
        if (error || !data) return null;
        if (data.truncated) {
            return `Showing the most recent ${data.rows.length} of ${data.totalCount.toLocaleString()} total. Narrow the range to see fewer.`;
        }
        return `Showing all ${data.totalCount.toLocaleString()} ${(config?.title ?? '').toLowerCase()}.`;
    })();

    return (
        <Modal show={isOpen} onHide={onClose} size="xl" scrollable centered>
            <Modal.Header closeButton>
                <div>
                    <Modal.Title>{config?.title ?? 'Drill-down'}</Modal.Title>
                    {subtitle && <div className="small text-muted mt-1">{subtitle}</div>}
                </div>
            </Modal.Header>
            <Modal.Body>
                {loading && (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                )}

                {error && !loading && (
                    <div className="alert alert-danger d-flex justify-content-between align-items-center mb-0">
                        <div>
                            <strong>Failed to load:</strong> {error}
                        </div>
                        <Button variant="outline-danger" size="sm" onClick={handleRetry}>
                            Retry
                        </Button>
                    </div>
                )}

                {!loading && !error && data && config && data.rows.length === 0 && (
                    <div className="text-muted text-center py-5">{config.emptyMessage}</div>
                )}

                {!loading && !error && data && config && data.rows.length > 0 && (
                    <div style={{ width: '100%', height: 500 }}>
                        <AgGridReact
                            rowData={data.rows}
                            columnDefs={config.columns}
                            defaultColDef={{ resizable: true, suppressMovable: true }}
                            animateRows
                            rowHeight={40}
                        />
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default KpiDrilldownModal;

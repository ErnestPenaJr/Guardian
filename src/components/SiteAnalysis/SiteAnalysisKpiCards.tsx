import React from 'react';
import type { KpiDrilldownType, SiteAnalysisKpis } from './types';

interface SiteAnalysisKpiCardsProps {
    kpis: SiteAnalysisKpis;
    onTileClick?: (type: KpiDrilldownType) => void;
}

interface TileProps {
    kpiType: KpiDrilldownType;
    label: string;
    value: string;
    hint?: string;
    onClick?: (type: KpiDrilldownType) => void;
}

const Tile: React.FC<TileProps> = ({ kpiType, label, value, hint, onClick }) => {
    const handleClick = () => onClick?.(kpiType);

    return (
        <div className="col-12 col-sm-6 col-lg-3">
            <button
                type="button"
                onClick={handleClick}
                className="bg-white border rounded p-3 h-100 shadow-sm w-100 text-start"
                style={{
                    cursor: onClick ? 'pointer' : 'default',
                    transition: 'background-color 120ms, transform 120ms',
                    border: '1px solid var(--bs-border-color)'
                }}
                onMouseEnter={(e) => {
                    if (onClick) e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                    if (onClick) e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
                disabled={!onClick}
                aria-label={`View details for ${label}`}
            >
                <div className="small text-muted text-uppercase">{label}</div>
                <div className="fs-3 fw-bold">{value}</div>
                {hint && <div className="small text-muted">{hint}</div>}
            </button>
        </div>
    );
};

const formatNumber = (n: number) => n.toLocaleString();

const SiteAnalysisKpiCards: React.FC<SiteAnalysisKpiCardsProps> = ({ kpis, onTileClick }) => {
    return (
        <div className="row g-3 mb-4">
            <Tile
                kpiType="totalCompanies"
                label="Total Companies"
                value={formatNumber(kpis.totalCompanies)}
                onClick={onTileClick}
            />
            <Tile
                kpiType="totalUsers"
                label="Total Users"
                value={formatNumber(kpis.totalUsers)}
                onClick={onTileClick}
            />
            <Tile
                kpiType="recentlyActiveUsers"
                label="Recently Active Users"
                value={formatNumber(kpis.recentlyActiveUsers)}
                hint="with a login in the selected range"
                onClick={onTileClick}
            />
            <Tile
                kpiType="totalRequests"
                label="Total Requests"
                value={formatNumber(kpis.totalRequests)}
                hint="all-time"
                onClick={onTileClick}
            />
            <Tile
                kpiType="requestsInRange"
                label="Requests in Range"
                value={formatNumber(kpis.requestsInRange)}
                onClick={onTileClick}
            />
            <Tile
                kpiType="tasksInRange"
                label="Tasks in Range"
                value={formatNumber(kpis.tasksInRange)}
                onClick={onTileClick}
            />
            <Tile
                kpiType="totalCustomFormTemplates"
                label="Custom Form Templates"
                value={formatNumber(kpis.totalCustomFormTemplates)}
                hint="excludes global templates"
                onClick={onTileClick}
            />
            <Tile
                kpiType="totalAttachments"
                label="Attachments"
                value={formatNumber(kpis.totalAttachments)}
                onClick={onTileClick}
            />
        </div>
    );
};

export default SiteAnalysisKpiCards;

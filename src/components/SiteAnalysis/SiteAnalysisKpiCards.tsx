import React from 'react';
import type { SiteAnalysisKpis } from './types';

interface SiteAnalysisKpiCardsProps {
    kpis: SiteAnalysisKpis;
}

interface TileProps {
    label: string;
    value: string;
    hint?: string;
}

const Tile: React.FC<TileProps> = ({ label, value, hint }) => (
    <div className="col-12 col-sm-6 col-lg-3">
        <div className="bg-white border rounded p-3 h-100 shadow-sm">
            <div className="small text-muted text-uppercase">{label}</div>
            <div className="fs-3 fw-bold">{value}</div>
            {hint && <div className="small text-muted">{hint}</div>}
        </div>
    </div>
);

const formatNumber = (n: number) => n.toLocaleString();

const SiteAnalysisKpiCards: React.FC<SiteAnalysisKpiCardsProps> = ({ kpis }) => {
    return (
        <div className="row g-3 mb-4">
            <Tile label="Total Companies" value={formatNumber(kpis.totalCompanies)} />
            <Tile label="Total Users" value={formatNumber(kpis.totalUsers)} />
            <Tile
                label="Recently Active Users"
                value={formatNumber(kpis.recentlyActiveUsers)}
                hint="with a login in the selected range"
            />
            <Tile
                label="Total Requests"
                value={formatNumber(kpis.totalRequests)}
                hint="all-time"
            />
            <Tile label="Requests in Range" value={formatNumber(kpis.requestsInRange)} />
            <Tile label="Tasks in Range" value={formatNumber(kpis.tasksInRange)} />
            <Tile
                label="Custom Form Templates"
                value={formatNumber(kpis.totalCustomFormTemplates)}
                hint="excludes global templates"
            />
            <Tile label="Attachments" value={formatNumber(kpis.totalAttachments)} />
        </div>
    );
};

export default SiteAnalysisKpiCards;

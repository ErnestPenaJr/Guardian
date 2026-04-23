import React from 'react';
import type { Totals, Trend } from './types';

interface SummaryCardsProps {
    totals: Totals;
    trend: Trend;
}

const Card: React.FC<{ label: string; value: number | string; tone: 'red' | 'orange' | 'yellow' | 'blue' }> = ({ label, value, tone }) => {
    const toneMap = {
        red: 'bg-red-50 border-red-300 text-red-700',
        orange: 'bg-orange-50 border-orange-300 text-orange-700',
        yellow: 'bg-yellow-50 border-yellow-300 text-yellow-700',
        blue: 'bg-blue-50 border-blue-300 text-blue-700'
    } as const;
    return (
        <div className={`rounded-md border p-4 ${toneMap[tone]}`}>
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-sm uppercase tracking-wide mt-1">{label}</div>
        </div>
    );
};

const SummaryCards: React.FC<SummaryCardsProps> = ({ totals, trend }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="Critical" value={totals.critical} tone="red" />
            <Card label="High" value={totals.high} tone="orange" />
            <Card label="Medium" value={totals.medium} tone="yellow" />
            <Card label={trend.prior_report_date ? 'New since last scan' : 'First scan'} value={trend.new} tone="blue" />
        </div>
    );
};

export default SummaryCards;

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import type { NewAccountsDayBucket } from './types';

interface SiteAnalysisNewAccountsChartProps {
    data: NewAccountsDayBucket[];
}

const formatLocalDate = (isoDay: string) => {
    const d = new Date(`${isoDay}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const SiteAnalysisNewAccountsChart: React.FC<SiteAnalysisNewAccountsChartProps> = ({ data }) => {
    const chartData = data.map((d) => ({
        ...d,
        label: formatLocalDate(d.date)
    }));

    return (
        <div className="bg-white border rounded p-3 h-100 shadow-sm">
            <h5 className="mb-3">New Accounts</h5>
            <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="newUsers" stroke="#6610f2" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="newCompanies" stroke="#d63384" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SiteAnalysisNewAccountsChart;

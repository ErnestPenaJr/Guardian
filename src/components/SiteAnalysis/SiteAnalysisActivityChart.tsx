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
import type { ActivityDayBucket } from './types';

interface SiteAnalysisActivityChartProps {
    data: ActivityDayBucket[];
}

const formatLocalDate = (isoDay: string) => {
    // isoDay is "YYYY-MM-DD". new Date("YYYY-MM-DD") parses as UTC midnight.
    const d = new Date(`${isoDay}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const SiteAnalysisActivityChart: React.FC<SiteAnalysisActivityChartProps> = ({ data }) => {
    const chartData = data.map((d) => ({
        ...d,
        label: formatLocalDate(d.date)
    }));

    return (
        <div className="bg-white border rounded p-3 h-100 shadow-sm">
            <h5 className="mb-3">Platform Activity</h5>
            <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="logins" stroke="#0d6efd" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="requests" stroke="#198754" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="tasks" stroke="#fd7e14" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SiteAnalysisActivityChart;

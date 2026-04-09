// Shared types for the site analysis dashboard payload.
// Mirrors the shape returned by GET /api/jafar-admin/site-analysis.

export type SiteAnalysisRange = '7d' | '30d' | '90d' | '12mo' | 'all';

export interface SiteAnalysisKpis {
    totalCompanies: number;
    totalUsers: number;
    recentlyActiveUsers: number;
    totalRequests: number;
    requestsInRange: number;
    tasksInRange: number;
    totalCustomFormTemplates: number;
    totalAttachments: number;
}

export interface ActivityDayBucket {
    date: string;           // YYYY-MM-DD (UTC day)
    logins: number;
    requests: number;
    tasks: number;
}

export interface NewAccountsDayBucket {
    date: string;           // YYYY-MM-DD (UTC day)
    newUsers: number;
    newCompanies: number;
}

export interface SiteAnalysisTrends {
    activityPerDay: ActivityDayBucket[];
    newAccountsPerDay: NewAccountsDayBucket[];
}

export interface SiteAnalysisCompanyRow {
    companyId: number;
    companyName: string;
    totalUsers: number;
    activeUsersInRange: number;
    totalRequests: number;
    requestsInRange: number;
    totalTasks: number;
    tasksInRange: number;
    customFormTemplates: number;
    lastActivityAt: string | null;
    accountAgeDays: number;
    percentOfPlatformRequests: number;
}

export interface SiteAnalysisPayload {
    range: SiteAnalysisRange;
    rangeStart: string;     // ISO 8601 UTC
    rangeEnd: string;       // ISO 8601 UTC
    generatedAt: string;    // ISO 8601 UTC
    cached: boolean;
    kpis: SiteAnalysisKpis;
    trends: SiteAnalysisTrends;
    companies: SiteAnalysisCompanyRow[];
}

export const SITE_ANALYSIS_RANGE_OPTIONS: Array<{ value: SiteAnalysisRange; label: string }> = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '12mo', label: 'Last 12 months' },
    { value: 'all', label: 'All time' }
];

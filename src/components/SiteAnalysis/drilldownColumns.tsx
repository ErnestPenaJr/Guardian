import type { ColDef, ValueFormatterParams } from 'ag-grid-community';
import type { KpiDrilldownType } from './types';

interface DrilldownConfig {
    title: string;
    emptyMessage: string;
    columns: ColDef[];
}

const formatDate = (params: ValueFormatterParams) => {
    if (!params.value) return '—';
    try {
        return new Date(params.value).toLocaleString();
    } catch {
        return String(params.value);
    }
};

const formatRelative = (params: ValueFormatterParams): string => {
    if (!params.value) return 'Never';
    let then: number;
    try {
        then = new Date(params.value).getTime();
    } catch {
        return 'Never';
    }
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

const formatStatus = (params: ValueFormatterParams) => {
    const v = params.value;
    if (v === 'A') return 'Active';
    if (v === 'P') return 'Pending';
    if (v === 'I') return 'Inactive';
    if (v === 'C') return 'Completed';
    if (v === 'X') return 'Cancelled';
    return v ?? '—';
};

const formatName = (params: { data?: { FIRST_NAME?: string; LAST_NAME?: string } }) => {
    const first = params.data?.FIRST_NAME ?? '';
    const last = params.data?.LAST_NAME ?? '';
    const full = `${first} ${last}`.trim();
    return full || '—';
};

export const drilldownColumns: Record<KpiDrilldownType, DrilldownConfig> = {
    totalCompanies: {
        title: 'Companies',
        emptyMessage: 'No companies yet.',
        columns: [
            { headerName: 'Company ID', field: 'COMPANY_ID', sortable: true, width: 120 },
            { headerName: 'Name', field: 'NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Created', field: 'CREATED_AT', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 },
            { headerName: 'Users', field: 'userCount', sortable: true, width: 100 },
            { headerName: 'Requests', field: 'requestCount', sortable: true, width: 110 }
        ]
    },
    totalUsers: {
        title: 'Users',
        emptyMessage: 'No users yet.',
        columns: [
            { headerName: 'Email', field: 'EMAIL', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Name', sortable: false, valueGetter: formatName, flex: 1, minWidth: 160 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Status', field: 'STATUS', sortable: true, valueFormatter: formatStatus, width: 110 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 },
            { headerName: 'Last Login', field: 'lastLoginAt', sortable: true, valueFormatter: formatRelative, flex: 1, minWidth: 130 }
        ]
    },
    recentlyActiveUsers: {
        title: 'Recently Active Users',
        emptyMessage: 'No users have logged in during the selected range.',
        columns: [
            { headerName: 'Email', field: 'EMAIL', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Name', sortable: false, valueGetter: formatName, flex: 1, minWidth: 160 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Logins', field: 'loginCount', sortable: true, width: 110 },
            { headerName: 'Last Login', field: 'lastLoginAt', sortable: true, valueFormatter: formatRelative, flex: 1, minWidth: 140 }
        ]
    },
    totalRequests: {
        title: 'Requests',
        emptyMessage: 'No requests yet.',
        columns: [
            { headerName: 'Tracking ID', field: 'TRACKINGID', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Name', field: 'REQUEST_NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Status', field: 'STATUS', sortable: true, valueFormatter: formatStatus, width: 120 },
            { headerName: 'Requestor', field: 'requestorEmail', sortable: true, filter: true, flex: 1, minWidth: 180 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 }
        ]
    },
    requestsInRange: {
        title: 'Requests in Range',
        emptyMessage: 'No requests created in the selected range.',
        columns: [
            { headerName: 'Tracking ID', field: 'TRACKINGID', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Name', field: 'REQUEST_NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Status', field: 'STATUS', sortable: true, valueFormatter: formatStatus, width: 120 },
            { headerName: 'Requestor', field: 'requestorEmail', sortable: true, filter: true, flex: 1, minWidth: 180 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 }
        ]
    },
    tasksInRange: {
        title: 'Tasks in Range',
        emptyMessage: 'No tasks created in the selected range.',
        columns: [
            // GUARDIAN.TASKS has no TRACKINGID column in the real DB — use TASK_ID as the identifier.
            { headerName: 'Task ID', field: 'TASK_ID', sortable: true, width: 110 },
            { headerName: 'Description', field: 'DESCRIPTION', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Status', field: 'STATUS', sortable: true, valueFormatter: formatStatus, width: 120 },
            { headerName: 'Assignee', field: 'assigneeEmail', sortable: true, filter: true, flex: 1, minWidth: 180 },
            { headerName: 'Request', field: 'requestTrackingId', sortable: true, flex: 1, minWidth: 160 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 }
        ]
    },
    totalCustomFormTemplates: {
        title: 'Custom Form Templates',
        emptyMessage: 'No custom form templates yet.',
        columns: [
            { headerName: 'Form Name', field: 'FORM_NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Description', field: 'FORM_DESCRIPTION', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Fields', field: 'fieldCount', sortable: true, width: 100 },
            { headerName: 'Form ID', field: 'FORM_ID', sortable: true, width: 100 }
        ]
    },
    totalAttachments: {
        title: 'Attachments',
        emptyMessage: 'No attachments yet.',
        columns: [
            { headerName: 'Filename', field: 'FILE_NAME', sortable: true, filter: true, flex: 2, minWidth: 220 },
            { headerName: 'Request', field: 'REQUEST_NAME', sortable: true, filter: true, flex: 2, minWidth: 200 },
            { headerName: 'Company', field: 'companyName', sortable: true, filter: true, flex: 1, minWidth: 160 },
            { headerName: 'Uploaded By', field: 'uploaderEmail', sortable: true, filter: true, flex: 1, minWidth: 180 },
            { headerName: 'Created', field: 'CREATE_DATE', sortable: true, valueFormatter: formatDate, flex: 1, minWidth: 160 }
        ]
    }
};

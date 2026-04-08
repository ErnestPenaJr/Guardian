// src/config/exportConfig.ts

export interface ExportSectionField {
  label: string;
  key: string;
  required?: boolean;
}

export interface ExportSection {
  title: string;
  iconType: 'users' | 'folder' | 'file-text' | 'check-square' | 'clock' | 'search' | 'map-pin' | 'phone' | 'monitor' | 'activity';
  groupBy?: string;
  fields: ExportSectionField[];
}

export interface ExportMetadataField {
  label: string;
  key: string;
}

export interface ExportTableColumn {
  header: string;
  key: string;
}

export interface ExportTypeConfig {
  pageTitle: string;
  iconType: 'file-text' | 'check-square' | 'clock' | 'users' | 'folder';
  metadataFields: ExportMetadataField[];
  sections: ExportSection[];
  tableColumns: ExportTableColumn[];
}

export const exportConfigs: Record<string, ExportTypeConfig> = {
  requests: {
    pageTitle: 'Export Request Data',
    iconType: 'file-text',
    metadataFields: [
      { label: 'Total Records', key: 'totalRecords' },
      { label: 'Date Range', key: 'dateRange' },
      { label: 'Status Filter', key: 'statusFilter' },
      { label: 'Exported By', key: 'exportedBy' },
      { label: 'Company', key: 'company' },
      { label: 'Export Date', key: 'exportDate' },
    ],
    sections: [
      {
        title: 'Requests',
        iconType: 'file-text',
        groupBy: 'STATUS',
        fields: [
          { label: 'Tracking ID', key: 'TRACKINGID', required: true },
          { label: 'Request Name', key: 'REQUEST_NAME', required: true },
          { label: 'Status', key: 'STATUS', required: true },
          { label: 'Submitted', key: 'SUBMITTED_DATE' },
          { label: 'Requestor', key: 'requestorName' },
          { label: 'Assigned To', key: 'assignedTo' },
        ],
      },
    ],
    tableColumns: [
      { header: 'Tracking ID', key: 'TRACKINGID' },
      { header: 'Request Name', key: 'REQUEST_NAME' },
      { header: 'Status', key: 'STATUS' },
      { header: 'Submitted', key: 'SUBMITTED_DATE' },
      { header: 'Requestor', key: 'requestorName' },
      { header: 'Assigned To', key: 'assignedTo' },
    ],
  },
  tasks: {
    pageTitle: 'Export Task Data',
    iconType: 'check-square',
    metadataFields: [
      { label: 'Request ID', key: 'requestId' },
      { label: 'Total Tasks', key: 'totalTasks' },
      { label: 'Pending', key: 'pendingCount' },
      { label: 'In Progress', key: 'inProgressCount' },
      { label: 'Completed', key: 'completedCount' },
      { label: 'Exported By', key: 'exportedBy' },
    ],
    sections: [
      {
        title: 'Tasks',
        iconType: 'check-square',
        groupBy: 'STATUS',
        fields: [
          { label: 'Task ID', key: 'TASK_ID', required: true },
          { label: 'Description', key: 'DESCRIPTION', required: true },
          { label: 'Status', key: 'STATUS', required: true },
          { label: 'Assigned To', key: 'assignedUser' },
          { label: 'Created', key: 'CREATE_DATE' },
        ],
      },
    ],
    tableColumns: [
      { header: 'Task ID', key: 'TASK_ID' },
      { header: 'Description', key: 'DESCRIPTION' },
      { header: 'Status', key: 'STATUS' },
      { header: 'Assigned To', key: 'assignedUser' },
      { header: 'Created', key: 'CREATE_DATE' },
    ],
  },
  progress: {
    pageTitle: 'Export Progress Data',
    iconType: 'clock',
    metadataFields: [
      { label: 'Request ID', key: 'requestId' },
      { label: 'Total Entries', key: 'totalEntries' },
      { label: 'Total Hours', key: 'totalHours' },
      { label: 'Exported By', key: 'exportedBy' },
      { label: 'Export Date', key: 'exportDate' },
    ],
    sections: [
      {
        title: 'Progress Entries',
        iconType: 'clock',
        groupBy: 'PROGRESS_TYPE',
        fields: [
          { label: 'Type', key: 'PROGRESS_TYPE', required: true },
          { label: 'Title', key: 'TITLE', required: true },
          { label: 'Description', key: 'DESCRIPTION' },
          { label: 'User', key: 'userName' },
          { label: 'Date', key: 'CREATED_DATE' },
          { label: 'Hours', key: 'HOURS_WORKED' },
          { label: 'Visible to Requestor', key: 'IS_VISIBLE_TO_REQUESTOR' },
        ],
      },
    ],
    tableColumns: [
      { header: 'Type', key: 'PROGRESS_TYPE' },
      { header: 'Title', key: 'TITLE' },
      { header: 'Description', key: 'DESCRIPTION' },
      { header: 'User', key: 'userName' },
      { header: 'Date', key: 'CREATED_DATE' },
      { header: 'Hours', key: 'HOURS_WORKED' },
      { header: 'Visible', key: 'IS_VISIBLE_TO_REQUESTOR' },
    ],
  },
  users: {
    pageTitle: 'Export User Data',
    iconType: 'users',
    metadataFields: [
      { label: 'Company', key: 'company' },
      { label: 'Active Users', key: 'activeUsers' },
      { label: 'Pending Invites', key: 'pendingInvites' },
      { label: 'Exported By', key: 'exportedBy' },
      { label: 'Export Date', key: 'exportDate' },
    ],
    sections: [
      {
        title: 'Active Users',
        iconType: 'users',
        fields: [
          { label: 'Name', key: 'name', required: true },
          { label: 'Email', key: 'email', required: true },
          { label: 'Role', key: 'role' },
          { label: 'Status', key: 'status' },
          { label: 'Date Added', key: 'dateCreated' },
        ],
      },
      {
        title: 'Invited Users',
        iconType: 'users',
        fields: [
          { label: 'Email', key: 'email', required: true },
          { label: 'Role', key: 'role' },
          { label: 'Status', key: 'status' },
          { label: 'Date Sent', key: 'dateSent' },
          { label: 'Expires', key: 'expires' },
        ],
      },
    ],
    tableColumns: [
      { header: 'Name', key: 'name' },
      { header: 'Email', key: 'email' },
      { header: 'Role', key: 'role' },
      { header: 'Status', key: 'status' },
      { header: 'Type', key: 'type' },
      { header: 'Date', key: 'date' },
    ],
  },
  forms: {
    pageTitle: 'Export Form Data',
    iconType: 'folder',
    metadataFields: [
      { label: 'Form Template', key: 'formTemplate' },
      { label: 'Request ID', key: 'requestId' },
      { label: 'Submitted By', key: 'submittedBy' },
      { label: 'Submission Date', key: 'submissionDate' },
      { label: 'Status', key: 'status' },
      { label: 'Assigned To', key: 'assignedTo' },
    ],
    sections: [], // Dynamic -- built from form template structure at runtime
    tableColumns: [
      { header: 'Field Name', key: 'fieldName' },
      { header: 'Value', key: 'fieldValue' },
      { header: 'Section', key: 'section' },
      { header: 'Required', key: 'required' },
    ],
  },
};

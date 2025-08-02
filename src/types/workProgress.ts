/**
 * Work Progress Tracking Interfaces
 * For tracking work progress on assigned requests in Guardian MVP
 */

export interface WorkProgressEntry {
  PROGRESS_ID: number;
  REQUEST_ID: number;
  USER_ID: number;
  PROGRESS_TYPE: 'note' | 'milestone' | 'discovery' | 'attachment';
  TITLE: string;
  DESCRIPTION: string;
  HOURS_WORKED?: number;
  IS_VISIBLE_TO_REQUESTOR: boolean;
  ATTACHMENT_PATH?: string;
  ATTACHMENT_NAME?: string;
  ATTACHMENT_SIZE?: number;
  CREATED_DATE: string;
  UPDATED_DATE?: string;
  user?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
    FULL_NAME: string;
  };
}

export interface AddProgressEntryRequest {
  requestId: number;
  progressType: 'note' | 'milestone' | 'discovery' | 'attachment';
  title: string;
  description: string;
  hoursWorked?: number;
  isVisibleToRequestor: boolean;
  attachment?: File;
}

export interface WorkProgressSummary {
  totalEntries: number;
  totalHours: number;
  milestoneCount: number;
  noteCount: number;
  discoveryCount: number;
  attachmentCount: number;
  lastUpdateDate: string;
}

export interface ProgressTypeOption {
  value: 'note' | 'milestone' | 'discovery' | 'attachment';
  label: string;
  description: string;
  icon: string;
  color: string;
}

export interface ProgressFilterOptions {
  type?: 'note' | 'milestone' | 'discovery' | 'attachment' | 'all';
  visibilityFilter?: 'all' | 'visible' | 'hidden';
  dateRange?: {
    start: Date;
    end: Date;
  };
  userId?: number;
}

export interface ProgressExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  includeAttachments: boolean;
  visibleToRequestorOnly: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Column definitions for AG Grid
export interface ProgressColumnDef {
  field: string;
  headerName: string;
  width?: number;
  sortable?: boolean;
  filter?: boolean;
  cellRenderer?: string;
  cellRendererParams?: any;
}

// File upload interfaces
export interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface AttachmentValidation {
  isValid: boolean;
  errors: string[];
  maxSize: number; // in bytes
  allowedTypes: string[];
}

// Progress entry validation
export interface ProgressEntryValidation {
  isValid: boolean;
  errors: {
    title?: string;
    description?: string;
    hoursWorked?: string;
    attachment?: string;
  };
}
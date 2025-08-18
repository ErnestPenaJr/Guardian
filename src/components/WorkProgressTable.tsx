import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, ColumnApi, GridReadyEvent } from 'ag-grid-community';
import { Button, Badge, Dropdown } from 'react-bootstrap';
import { 
  Plus, 
  Download, 
  Filter, 
  Clock, 
  FileText, 
  Target, 
  Search, 
  Eye, 
  EyeOff,
  Paperclip,
  User,
  Calendar
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import AddProgressModal from './AddProgressModal';
import { 
  WorkProgressEntry, 
  WorkProgressSummary, 
  ProgressFilterOptions,
  ProgressExportOptions 
} from '../types/workProgress';
// AG Grid CSS imports removed to use new Theming API

interface WorkProgressTableProps {
  requestId: number;
  requestStatus: string;
  isAssignedToCurrentUser: boolean;
  onProgressUpdate?: () => void;
}

const WorkProgressTable: React.FC<WorkProgressTableProps> = ({
  requestId,
  requestStatus,
  isAssignedToCurrentUser,
  onProgressUpdate
}) => {
  const { user } = useAuth();
  const [progressEntries, setProgressEntries] = useState<WorkProgressEntry[]>([]);
  const [summary, setSummary] = useState<WorkProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [columnApi, setColumnApi] = useState<ColumnApi | null>(null);
  const [filterOptions, setFilterOptions] = useState<ProgressFilterOptions>({
    type: 'all',
    visibilityFilter: 'all'
  });

  // Progress type colors and icons
  const progressTypeConfig = {
    note: { color: 'info', icon: FileText, label: 'Note' },
    milestone: { color: 'success', icon: Target, label: 'Milestone' },
    discovery: { color: 'warning', icon: Search, label: 'Discovery' },
    research: { color: 'primary', icon: Search, label: 'Research' },
    evidence: { color: 'success', icon: Eye, label: 'Evidence' },
    communication: { color: 'info', icon: User, label: 'Communication' },
    attachment: { color: 'primary', icon: Paperclip, label: 'Attachment' }
  };

  // Load progress entries
  const loadProgressEntries = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/requests/${requestId}/progress`);
      
      if (response.data?.success) {
        setProgressEntries(response.data.data || []);
        setSummary(response.data.summary || null);
      } else {
        setProgressEntries([]);
        setSummary(null);
      }
    } catch (error) {
      console.error('Failed to load progress entries:', error);
      toast.error('Failed to load work progress');
      setProgressEntries([]);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadProgressEntries();
  }, [loadProgressEntries]);

  // Cell renderers
  const TypeCellRenderer = (params: any) => {
    const entry = params.data as WorkProgressEntry;
    const config = progressTypeConfig[entry.PROGRESS_TYPE];
    const IconComponent = config.icon;
    
    return (
      <div className="d-flex align-items-center">
        <IconComponent size={16} className={`text-${config.color} me-2`} />
        <Badge bg={config.color} className="text-uppercase">
          {config.label}
        </Badge>
      </div>
    );
  };

  const TitleCellRenderer = (params: any) => {
    const entry = params.data as WorkProgressEntry;
    
    return (
      <div>
        <div className="fw-semibold">{entry.TITLE}</div>
        <div className="text-muted small text-truncate" style={{ maxWidth: '300px' }}>
          {entry.DESCRIPTION}
        </div>
      </div>
    );
  };

  const UserCellRenderer = (params: any) => {
    const entry = params.data as WorkProgressEntry;
    
    return (
      <div className="d-flex align-items-center">
        <User size={16} className="text-muted me-2" />
        <div>
          <div className="fw-medium">{entry.user?.FULL_NAME || 'Unknown User'}</div>
          <div className="text-muted small">{entry.user?.EMAIL}</div>
        </div>
      </div>
    );
  };

  const DateCellRenderer = (params: any) => {
    const entry = params.data as WorkProgressEntry;
    const date = new Date(entry.CREATED_DATE);
    
    return (
      <div className="d-flex align-items-center">
        <Calendar size={16} className="text-muted me-2" />
        <div>
          <div>{date.toLocaleDateString()}</div>
          <div className="text-muted small">{date.toLocaleTimeString()}</div>
        </div>
      </div>
    );
  };

  const HoursCellRenderer = (params: any) => {
    const entry = params.data as WorkProgressEntry;
    
    return entry.HOURS_WORKED ? (
      <div className="d-flex align-items-center">
        <Clock size={16} className="text-info me-2" />
        <span className="fw-medium">{entry.HOURS_WORKED}h</span>
      </div>
    ) : (
      <span className="text-muted">-</span>
    );
  };

  const VisibilityCellRenderer = (params: any) => {
    const entry = params.data as WorkProgressEntry;
    
    return (
      <div className="d-flex align-items-center">
        {entry.IS_VISIBLE_TO_REQUESTOR ? (
          <>
            <Eye size={16} className="text-success me-2" />
            <span className="text-success">Visible</span>
          </>
        ) : (
          <>
            <EyeOff size={16} className="text-warning me-2" />
            <span className="text-warning">Hidden</span>
          </>
        )}
      </div>
    );
  };

  const AttachmentCellRenderer = (params: any) => {
    const entry = params.data as WorkProgressEntry;
    
    return entry.ATTACHMENT_NAME ? (
      <div className="d-flex align-items-center">
        <Paperclip size={16} className="text-primary me-2" />
        <a 
          href={`/api/attachments/${entry.PROGRESS_ID}`}
          className="text-decoration-none"
          target="_blank"
          rel="noopener noreferrer"
        >
          {entry.ATTACHMENT_NAME}
        </a>
      </div>
    ) : (
      <span className="text-muted">-</span>
    );
  };

  // Column definitions
  const columnDefs: ColDef[] = useMemo(() => [
    {
      field: 'PROGRESS_TYPE',
      headerName: 'Type',
      width: 140,
      cellRenderer: TypeCellRenderer,
      filter: 'agSetColumnFilter',
      filterParams: {
        values: ['note', 'milestone', 'discovery', 'attachment']
      }
    },
    {
      field: 'TITLE',
      headerName: 'Title & Description',
      flex: 2,
      cellRenderer: TitleCellRenderer,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'user.FULL_NAME',
      headerName: 'Created By',
      width: 200,
      cellRenderer: UserCellRenderer,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'CREATED_DATE',
      headerName: 'Date & Time',
      width: 160,
      cellRenderer: DateCellRenderer,
      sort: 'desc',
      filter: 'agDateColumnFilter'
    },
    {
      field: 'HOURS_WORKED',
      headerName: 'Hours',
      width: 100,
      cellRenderer: HoursCellRenderer,
      filter: 'agNumberColumnFilter'
    },
    {
      field: 'IS_VISIBLE_TO_REQUESTOR',
      headerName: 'Visibility',
      width: 120,
      cellRenderer: VisibilityCellRenderer,
      filter: 'agSetColumnFilter',
      filterParams: {
        values: [true, false],
        valueFormatter: (params: any) => params.value ? 'Visible' : 'Hidden'
      }
    },
    {
      field: 'ATTACHMENT_NAME',
      headerName: 'Attachment',
      width: 180,
      cellRenderer: AttachmentCellRenderer,
      filter: 'agTextColumnFilter'
    }
  ], []);

  // Grid options
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100
  }), []);

  // Handle grid ready
  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    setColumnApi(params.columnApi);
    params.api.sizeColumnsToFit();
  };

  // Handle add progress success
  const handleAddProgressSuccess = () => {
    setShowAddModal(false);
    loadProgressEntries();
    onProgressUpdate?.();
    toast.success('Progress entry added successfully');
  };

  // Export progress data
  const handleExport = (format: 'csv' | 'excel') => {
    if (!gridApi) return;

    const params = {
      fileName: `request-${requestId}-progress.${format}`,
      columnKeys: ['PROGRESS_TYPE', 'TITLE', 'DESCRIPTION', 'user.FULL_NAME', 'CREATED_DATE', 'HOURS_WORKED', 'IS_VISIBLE_TO_REQUESTOR']
    };

    if (format === 'csv') {
      gridApi.exportDataAsCsv(params);
    } else {
      gridApi.exportDataAsExcel(params);
    }
  };

  // Apply filters
  const applyFilters = () => {
    if (!gridApi) return;

    // Type filter
    if (filterOptions.type !== 'all') {
      gridApi.setFilterModel({
        PROGRESS_TYPE: {
          type: 'equals',
          filter: filterOptions.type
        }
      });
    } else {
      gridApi.setFilterModel({});
    }
  };

  useEffect(() => {
    applyFilters();
  }, [filterOptions, gridApi]);

  const canAddProgress = isAssignedToCurrentUser && requestStatus !== 'C';

  return (
    <div className="work-progress-table">
      {/* Header with summary and actions */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">Work Progress</h5>
          {summary && (
            <div className="text-muted small">
              {summary.totalEntries} entries • {summary.totalHours}h total • 
              Last update: {new Date(summary.lastUpdateDate).toLocaleDateString()}
            </div>
          )}
        </div>
        
        <div className="d-flex gap-2">
          {/* Filter dropdown */}
          <Dropdown>
            <Dropdown.Toggle variant="outline-secondary" size="sm">
              <Filter size={16} className="me-1" />
              Filter
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Header>Progress Type</Dropdown.Header>
              <Dropdown.Item 
                active={filterOptions.type === 'all'}
                onClick={() => setFilterOptions(prev => ({ ...prev, type: 'all' }))}
              >
                All Types
              </Dropdown.Item>
              {Object.entries(progressTypeConfig).map(([type, config]) => (
                <Dropdown.Item
                  key={type}
                  active={filterOptions.type === type}
                  onClick={() => setFilterOptions(prev => ({ ...prev, type: type as any }))}
                >
                  <config.icon size={16} className={`text-${config.color} me-2`} />
                  {config.label}
                </Dropdown.Item>
              ))}
              <Dropdown.Divider />
              <Dropdown.Header>Visibility</Dropdown.Header>
              <Dropdown.Item
                active={filterOptions.visibilityFilter === 'all'}
                onClick={() => setFilterOptions(prev => ({ ...prev, visibilityFilter: 'all' }))}
              >
                All Entries
              </Dropdown.Item>
              <Dropdown.Item
                active={filterOptions.visibilityFilter === 'visible'}
                onClick={() => setFilterOptions(prev => ({ ...prev, visibilityFilter: 'visible' }))}
              >
                <Eye size={16} className="me-2" />
                Visible to Requestor
              </Dropdown.Item>
              <Dropdown.Item
                active={filterOptions.visibilityFilter === 'hidden'}
                onClick={() => setFilterOptions(prev => ({ ...prev, visibilityFilter: 'hidden' }))}
              >
                <EyeOff size={16} className="me-2" />
                Hidden from Requestor
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* Export dropdown */}
          <Dropdown>
            <Dropdown.Toggle variant="outline-primary" size="sm">
              <Download size={16} className="me-1" />
              Export
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => handleExport('csv')}>
                Export as CSV
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleExport('excel')}>
                Export as Excel
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* Add progress button */}
          {canAddProgress && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} className="me-1" />
              Add Progress
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="row mb-3">
          <div className="col-md-2">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-primary">{summary.noteCount}</div>
                <div className="small text-muted">Notes</div>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-success">{summary.milestoneCount}</div>
                <div className="small text-muted">Milestones</div>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-warning">{summary.discoveryCount}</div>
                <div className="small text-muted">Discoveries</div>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-info">{summary.attachmentCount}</div>
                <div className="small text-muted">Attachments</div>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-secondary">{summary.totalHours}h</div>
                <div className="small text-muted">Total Hours</div>
              </div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-dark">{summary.totalEntries}</div>
                <div className="small text-muted">Total Entries</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AG Grid Table */}
      <div className="ag-theme-alpine" style={{ height: '500px' }}>
        <AgGridReact
          theme="legacy"
          columnDefs={columnDefs}
          rowData={progressEntries}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          animateRows={true}
          pagination={true}
          paginationPageSize={20}
          enableCellTextSelection={true}
          rowSelection={{ mode: 'singleRow', enableClickSelection: false }}
          loadingOverlayComponent="agLoadingOverlay"
          loading={loading}
        />
      </div>

      {/* Add Progress Modal */}
      <AddProgressModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        requestId={requestId}
        onSuccess={handleAddProgressSuccess}
      />
    </div>
  );
};

export default WorkProgressTable;
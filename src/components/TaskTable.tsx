import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, ColumnApi, GridReadyEvent } from 'ag-grid-community';
import { Button, Badge, Dropdown } from 'react-bootstrap';
import { 
  Plus, 
  Download, 
  Filter, 
  User, 
  Calendar,
  CheckSquare,
  Clock,
  Play,
  CheckCircle,
  X
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import AddTaskModal from './AddTaskModal';
import Modal from './Modal';

interface Task {
  TASK_ID: number;
  REQUEST_ID: number;
  STATUS: string;
  ASSIGNED_USER_ID: number | null;
  DESCRIPTION: string;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  TRACKINGID: string;
  assignedUser?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
  createdBy?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
}

interface TaskSummary {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
}

interface TaskTableProps {
  requestId: number;
  requestStatus: string;
  isAssignedToCurrentUser: boolean;
  onTaskUpdate?: () => void;
}

const TaskTable: React.FC<TaskTableProps> = ({
  requestId,
  requestStatus,
  isAssignedToCurrentUser,
  onTaskUpdate
}) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [columnApi, setColumnApi] = useState<ColumnApi | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Task status configuration
  const taskStatusConfig = {
    'Pending': { color: 'warning', label: 'Pending' },
    'In Progress': { color: 'primary', label: 'In Progress' },
    'Completed': { color: 'success', label: 'Completed' },
    'Cancelled': { color: 'secondary', label: 'Cancelled' }
  };

  // Load tasks
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/requests/${requestId}/tasks`);
      
      if (response.data?.success) {
        setTasks(response.data.data || []);
        setSummary(response.data.summary || null);
      } else {
        setTasks([]);
        setSummary(null);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Cell renderers
  const TaskIdCellRenderer = (params: any) => {
    const task = params.data as Task;
    return (
      <div className="d-flex align-items-center">
        <CheckSquare size={16} className="text-primary me-2" />
        <span className="fw-medium">{task.TRACKINGID || task.TASK_ID}</span>
      </div>
    );
  };

  const StatusCellRenderer = (params: any) => {
    const task = params.data as Task;
    const config = taskStatusConfig[task.STATUS as keyof typeof taskStatusConfig];
    
    return (
      <div className="d-flex align-items-center">
        <Badge bg={config?.color || 'secondary'} className="text-uppercase">
          {config?.label || task.STATUS}
        </Badge>
      </div>
    );
  };

  const AssignedUserCellRenderer = (params: any) => {
    const task = params.data as Task;
    
    return (
      <div className="d-flex align-items-center">
        <User size={16} className="text-muted me-2" />
        <div>
          {task.assignedUser ? (
            <>
              <div className="fw-medium">
                {task.assignedUser.FIRST_NAME} {task.assignedUser.LAST_NAME}
              </div>
              <div className="text-muted small">{task.assignedUser.EMAIL}</div>
            </>
          ) : (
            <span className="text-muted">UNASSIGNED</span>
          )}
        </div>
      </div>
    );
  };

  const DateCellRenderer = (params: any) => {
    const task = params.data as Task;
    const date = new Date(task.CREATE_DATE);
    
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

  const DescriptionCellRenderer = (params: any) => {
    const task = params.data as Task;
    
    return (
      <div>
        <div className="text-truncate" style={{ maxWidth: '300px' }} title={task.DESCRIPTION}>
          {task.DESCRIPTION || 'No description'}
        </div>
      </div>
    );
  };

  // Column definitions
  const columnDefs: ColDef[] = useMemo(() => [
    {
      field: 'select',
      headerName: '',
      width: 50,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      pinned: 'left',
      lockPinned: true,
      suppressMenu: true,
      sortable: false,
      filter: false,
      resizable: false
    },
    {
      field: 'TASK_ID',
      headerName: 'Task ID',
      width: 120,
      cellRenderer: TaskIdCellRenderer,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'DESCRIPTION',
      headerName: 'Description',
      flex: 2,
      cellRenderer: DescriptionCellRenderer,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'STATUS',
      headerName: 'Status',
      width: 140,
      cellRenderer: StatusCellRenderer,
      filter: 'agSetColumnFilter',
      filterParams: {
        values: ['Pending', 'In Progress', 'Completed', 'Cancelled']
      }
    },
    {
      field: 'assignedUser',
      headerName: 'Assigned To',
      width: 200,
      cellRenderer: AssignedUserCellRenderer,
      filter: 'agTextColumnFilter'
    },
    {
      field: 'CREATE_DATE',
      headerName: 'Created Date',
      width: 160,
      cellRenderer: DateCellRenderer,
      sort: 'desc',
      filter: 'agDateColumnFilter'
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

  // Handle task selection
  const onSelectionChanged = useCallback(() => {
    if (gridApi) {
      const selectedRows = gridApi.getSelectedRows();
      setSelectedTasks(selectedRows);
    }
  }, [gridApi]);

  // Handle add task success
  const handleAddTaskSuccess = () => {
    setShowAddModal(false);
    loadTasks();
    onTaskUpdate?.();
    toast.success('Task added successfully');
  };

  // Export tasks data
  const handleExport = (format: 'csv' | 'excel') => {
    if (!gridApi) return;

    const params = {
      fileName: `request-${requestId}-tasks.${format}`,
      columnKeys: ['TASK_ID', 'DESCRIPTION', 'STATUS', 'assignedUser', 'CREATE_DATE']
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

    if (statusFilter !== 'all') {
      gridApi.setFilterModel({
        STATUS: {
          type: 'equals',
          filter: statusFilter
        }
      });
    } else {
      gridApi.setFilterModel({});
    }
  };

  useEffect(() => {
    applyFilters();
  }, [statusFilter, gridApi]);

  // Helper functions for button state
  const getPendingSelectedTasks = () => selectedTasks.filter(task => task.STATUS === 'Pending');
  const getInProgressSelectedTasks = () => selectedTasks.filter(task => task.STATUS === 'In Progress');
  const getCompletableSelectedTasks = () => selectedTasks.filter(task => task.STATUS === 'Pending' || task.STATUS === 'In Progress');
  const getCancellableSelectedTasks = () => selectedTasks.filter(task => task.STATUS === 'Pending');
  
  const canStartTasks = getPendingSelectedTasks().length > 0;
  const canCompleteTasks = getCompletableSelectedTasks().length > 0;
  const canCancelTasks = getCancellableSelectedTasks().length > 0;

  // Update task status
  const updateTaskStatus = async (taskId: number, status: string, assignedUserId?: number) => {
    try {
      const updateData: any = { status };
      if (assignedUserId !== undefined) {
        updateData.assignedUserId = assignedUserId;
      }
      
      await api.put(`/api/tasks/${taskId}`, updateData);
      return { success: true };
    } catch (error: any) {
      console.error(`Failed to update task ${taskId}:`, error);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  };

  // Handle start tasks
  const handleStartTasks = async () => {
    const tasksToStart = getPendingSelectedTasks();
    if (tasksToStart.length === 0) return;

    setIsUpdating(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const task of tasksToStart) {
      const result = await updateTaskStatus(task.TASK_ID, 'In Progress', user?.userId);
      if (result.success) {
        successCount++;
      } else {
        errors.push(`Task ${task.TASK_ID}: ${result.error}`);
      }
    }

    setIsUpdating(false);
    setShowStartModal(false);
    
    if (successCount > 0) {
      toast.success(`Successfully started ${successCount} task(s)`);
      loadTasks();
      onTaskUpdate?.();
      setSelectedTasks([]);
      if (gridApi) {
        gridApi.deselectAll();
      }
    }

    if (errors.length > 0) {
      toast.error(`Failed to start ${errors.length} task(s). Check console for details.`);
      console.error('Task start errors:', errors);
    }
  };

  // Handle complete tasks
  const handleCompleteTasks = async () => {
    const tasksToComplete = getCompletableSelectedTasks();
    if (tasksToComplete.length === 0) return;

    setIsUpdating(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const task of tasksToComplete) {
      const result = await updateTaskStatus(task.TASK_ID, 'Completed');
      if (result.success) {
        successCount++;
      } else {
        errors.push(`Task ${task.TASK_ID}: ${result.error}`);
      }
    }

    setIsUpdating(false);
    setShowCompleteModal(false);
    
    if (successCount > 0) {
      toast.success(`Successfully completed ${successCount} task(s)`);
      loadTasks();
      onTaskUpdate?.();
      setSelectedTasks([]);
      if (gridApi) {
        gridApi.deselectAll();
      }
    }

    if (errors.length > 0) {
      toast.error(`Failed to complete ${errors.length} task(s). Check console for details.`);
      console.error('Task complete errors:', errors);
    }
  };

  // Handle cancel tasks
  const handleCancelTasks = async () => {
    const tasksToCancel = getCancellableSelectedTasks();
    if (tasksToCancel.length === 0) return;

    setIsUpdating(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const task of tasksToCancel) {
      const result = await updateTaskStatus(task.TASK_ID, 'Cancelled');
      if (result.success) {
        successCount++;
      } else {
        errors.push(`Task ${task.TASK_ID}: ${result.error}`);
      }
    }

    setIsUpdating(false);
    setShowCancelModal(false);
    
    if (successCount > 0) {
      toast.success(`Successfully cancelled ${successCount} task(s)`);
      loadTasks();
      onTaskUpdate?.();
      setSelectedTasks([]);
      if (gridApi) {
        gridApi.deselectAll();
      }
    }

    if (errors.length > 0) {
      toast.error(`Failed to cancel ${errors.length} task(s). Check console for details.`);
      console.error('Task cancel errors:', errors);
    }
  };

  const canAddTask = isAssignedToCurrentUser && requestStatus !== 'C';

  return (
    <div className="task-table">
      {/* Header with summary and actions */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">Tasks</h5>
          {summary && (
            <div className="text-muted small">
              {summary.totalTasks} total • {summary.pendingTasks} pending • 
              {summary.inProgressTasks} in progress • {summary.completedTasks} completed
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
              <Dropdown.Header>Task Status</Dropdown.Header>
              <Dropdown.Item 
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
              >
                All Status
              </Dropdown.Item>
              {Object.entries(taskStatusConfig).map(([status, config]) => (
                <Dropdown.Item
                  key={status}
                  active={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                >
                  <Badge bg={config.color} className="me-2">
                    {config.label}
                  </Badge>
                  {config.label}
                </Dropdown.Item>
              ))}
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

          {/* Start Tasks button */}
          {isAssignedToCurrentUser && (
            <Button
              variant="success"
              size="sm"
              onClick={() => setShowStartModal(true)}
              disabled={!canStartTasks || isUpdating}
            >
              <Play size={16} className="me-1" />
              {isUpdating ? 'Updating...' : `Start ${getPendingSelectedTasks().length > 0 ? `(${getPendingSelectedTasks().length})` : ''}`}
            </Button>
          )}

          {/* Complete Tasks button */}
          {isAssignedToCurrentUser && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCompleteModal(true)}
              disabled={!canCompleteTasks || isUpdating}
            >
              <CheckCircle size={16} className="me-1" />
              {isUpdating ? 'Updating...' : `Complete ${getCompletableSelectedTasks().length > 0 ? `(${getCompletableSelectedTasks().length})` : ''}`}
            </Button>
          )}

          {/* Cancel Tasks button */}
          {isAssignedToCurrentUser && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              disabled={!canCancelTasks || isUpdating}
            >
              <X size={16} className="me-1" />
              {isUpdating ? 'Updating...' : `Cancel ${getCancellableSelectedTasks().length > 0 ? `(${getCancellableSelectedTasks().length})` : ''}`}
            </Button>
          )}

          {/* Add task button */}
          {canAddTask && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} className="me-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="row mb-3">
          <div className="col-md-3">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-primary">{summary.totalTasks}</div>
                <div className="small text-muted">Total Tasks</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-warning">{summary.pendingTasks}</div>
                <div className="small text-muted">Pending</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-primary">{summary.inProgressTasks}</div>
                <div className="small text-muted">In Progress</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card text-center border-0 bg-light">
              <div className="card-body py-2">
                <div className="fw-bold text-success">{summary.completedTasks}</div>
                <div className="small text-muted">Completed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AG Grid Table */}
      <div className="ag-theme-alpine" style={{ height: '400px' }}>
        <AgGridReact
          columnDefs={columnDefs}
          rowData={tasks}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          onSelectionChanged={onSelectionChanged}
          animateRows={true}
          pagination={true}
          paginationPageSize={20}
          enableCellTextSelection={true}
          rowSelection={{ mode: 'multiRow', enableClickSelection: false }}
          suppressRowClickSelection={true}
          loadingOverlayComponent="agLoadingOverlay"
          loading={loading}
        />
      </div>

      {/* Add Task Modal */}
      <AddTaskModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        requestId={requestId}
        onSuccess={handleAddTaskSuccess}
      />

      {/* Start Tasks Confirmation Modal */}
      <Modal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        title="Start Tasks"
        size="md"
      >
        <div className="p-4">
          <p className="mb-4">
            Please confirm you want to start the selected task(s).
          </p>
          <div className="mb-4">
            <strong>Tasks to Start:</strong>
            <ul className="list-unstyled ms-3 mt-2">
              {getPendingSelectedTasks().map(task => (
                <li key={task.TASK_ID} className="mb-1">
                  <Badge bg="warning" className="me-2">#{task.TRACKINGID || task.TASK_ID}</Badge>
                  <span className="text-truncate" style={{ maxWidth: '300px', display: 'inline-block' }}>
                    {task.DESCRIPTION || 'No description'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <Button 
              variant="outline-secondary" 
              onClick={() => setShowStartModal(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              variant="success" 
              onClick={handleStartTasks}
              disabled={isUpdating}
            >
              <Play size={16} className="me-1" />
              {isUpdating ? 'Starting...' : `Start ${getPendingSelectedTasks().length} Task(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Tasks Confirmation Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Complete Tasks"
        size="md"
      >
        <div className="p-4">
          <p className="mb-4">
            Please confirm you want to complete the selected task(s).
          </p>
          <div className="mb-4">
            <strong>Tasks to Complete:</strong>
            <ul className="list-unstyled ms-3 mt-2">
              {getCompletableSelectedTasks().map(task => (
                <li key={task.TASK_ID} className="mb-1">
                  <Badge bg="primary" className="me-2">#{task.TRACKINGID || task.TASK_ID}</Badge>
                  <span className="text-truncate" style={{ maxWidth: '300px', display: 'inline-block' }}>
                    {task.DESCRIPTION || 'No description'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <Button 
              variant="outline-secondary" 
              onClick={() => setShowCompleteModal(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleCompleteTasks}
              disabled={isUpdating}
            >
              <CheckCircle size={16} className="me-1" />
              {isUpdating ? 'Completing...' : `Complete ${getCompletableSelectedTasks().length} Task(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Tasks Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Tasks"
        size="md"
      >
        <div className="p-4">
          <p className="mb-4">
            Please confirm you want to cancel the selected task(s).
          </p>
          <div className="mb-4">
            <strong>Tasks to Cancel:</strong>
            <ul className="list-unstyled ms-3 mt-2">
              {getCancellableSelectedTasks().map(task => (
                <li key={task.TASK_ID} className="mb-1">
                  <Badge bg="warning" className="me-2">#{task.TRACKINGID || task.TASK_ID}</Badge>
                  <span className="text-truncate" style={{ maxWidth: '300px', display: 'inline-block' }}>
                    {task.DESCRIPTION || 'No description'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <Button 
              variant="outline-secondary" 
              onClick={() => setShowCancelModal(false)}
              disabled={isUpdating}
            >
              Back
            </Button>
            <Button 
              variant="danger" 
              onClick={handleCancelTasks}
              disabled={isUpdating}
            >
              <X size={16} className="me-1" />
              {isUpdating ? 'Cancelling...' : `Cancel ${getCancellableSelectedTasks().length} Task(s)`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TaskTable;
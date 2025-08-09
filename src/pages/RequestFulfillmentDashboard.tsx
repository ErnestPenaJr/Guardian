import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import requestService from '../services/requestService';
import formService from '../services/formService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import TextArea from '../components/ui/TextArea';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Modal from '../components/Modal';
import WorkProgressTable from '../components/WorkProgressTable';
import TaskTable from '../components/TaskTable';
import { toast } from 'react-toastify';
import { Play, CheckCircle, MessageCircle, Clock, User, Calendar, Target, AlertCircle, FileText, ClipboardList, CheckSquare, Filter, Download, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import './RequestFulfillmentDashboard.css';

interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  REQUEST_DESCRIPTION: string;
  STATUS: string;
  SUBMITTED_DATE: string;
  TRACKINGID: string;
  requestor?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
  requestorName?: string;
  assignedTo?: string;
  progressPercentage?: number;
  milestones?: Milestone[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration?: number;
  actualDuration?: number;
}

interface Milestone {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;
  completedDate?: string;
}

const RequestFulfillmentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [actionType, setActionType] = useState<'start' | 'complete' | 'progress' | 'milestone'>('start');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  
  // Form handling state
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formLoading, setFormLoading] = useState(false);

  // Work progress state
  const [showWorkProgressModal, setShowWorkProgressModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'form' | 'progress' | 'tasks'>('details');
  
  // Table state for sorting and pagination
  const [sortField, setSortField] = useState<keyof Request>('SUBMITTED_DATE');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAssignedRequests();
  }, [statusFilter]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [statusFilter, searchTerm]);

  const fetchAssignedRequests = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await requestService.getAssignedRequests(params);
      
      const enhancedRequests = response.map((request: Request) => ({
        ...request,
        assignedTo: user?.firstName && user?.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user?.email || 'Assigned to Me',
        progressPercentage: calculateProgress(request),
        priority: determinePriority(request),
        milestones: generateMockMilestones(request),
        estimatedDuration: 8,
        actualDuration: request.STATUS === 'C' ? 6 : undefined
      }));
      
      setRequests(enhancedRequests);
    } catch (error) {
      console.error('Error fetching assigned requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (request: Request): number => {
    switch (request.STATUS) {
      case 'P': return 10;
      case 'A': return 50;
      case 'C': return 100;
      case 'R': return 0;
      default: return 0;
    }
  };

  const determinePriority = (request: Request): 'low' | 'medium' | 'high' | 'urgent' => {
    const daysSinceSubmitted = Math.floor(
      (new Date().getTime() - new Date(request.SUBMITTED_DATE).getTime()) / (1000 * 3600 * 24)
    );
    
    if (daysSinceSubmitted > 7) return 'urgent';
    if (daysSinceSubmitted > 3) return 'high';
    if (daysSinceSubmitted > 1) return 'medium';
    return 'low';
  };

  const generateMockMilestones = (request: Request): Milestone[] => {
    const baseMilestones = [
      { id: '1', title: 'Requirements Analysis', description: 'Analyze and understand request requirements' },
      { id: '2', title: 'Initial Assessment', description: 'Perform initial technical assessment' },
      { id: '3', title: 'Implementation', description: 'Execute the main work' },
      { id: '4', title: 'Testing & Validation', description: 'Test and validate the solution' },
      { id: '5', title: 'Documentation', description: 'Document the completed work' }
    ];

    return baseMilestones.map((milestone, index) => ({
      ...milestone,
      completed: request.STATUS === 'C' || (request.STATUS === 'A' && index < 2),
      dueDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      completedDate: (request.STATUS === 'C' || (request.STATUS === 'A' && index < 2)) 
        ? new Date(Date.now() - (5 - index) * 24 * 60 * 60 * 1000).toISOString() 
        : undefined
    }));
  };

  const handleAction = async () => {
    if (!selectedRequest) return;

    try {
      setActionLoading(true);
      
      switch (actionType) {
        case 'start':
          await requestService.startRequest(selectedRequest.REQUEST_ID);
          break;
        case 'complete':
          await requestService.completeRequest(selectedRequest.REQUEST_ID, { completionNotes: notes });
          break;
        case 'progress':
          await requestService.updateProgress(selectedRequest.REQUEST_ID, { progressNotes: notes });
          break;
      }
      
      setSelectedRequest(null);
      setNotes('');
      setShowActionModal(false);
      await fetchAssignedRequests();
    } catch (error) {
      console.error('Error performing action:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Form handling functions
  const loadRequestForm = async (request: Request) => {
    try {
      setFormLoading(true);
      const response = await formService.getRequestForm(request.REQUEST_ID);
      
      setFormData(response);
      setFormFields(response.fields || []);
      setFormValues(response.values || {});
      setSelectedRequest(request);
      setShowFormModal(true);
    } catch (error) {
      console.error('Error loading form:', error);
      toast.error('Failed to load form data');
    } finally {
      setFormLoading(false);
    }
  };

  // Work progress functions
  const openWorkProgressModal = (request: Request) => {
    setSelectedRequest(request);
    setActiveTab('progress');
    setShowWorkProgressModal(true);
  };

  const handleWorkProgressUpdate = () => {
    // Refresh the request list to show updated progress
    fetchAssignedRequests();
  };

  const saveFormData = async (isComplete = false, isDraft = false) => {
    if (!selectedRequest || !formData) return;
    
    try {
      setActionLoading(true);
      
      const result = await formService.submitForm(
        selectedRequest.REQUEST_ID, 
        formValues, 
        { isComplete, isDraft }
      );
      
      toast.success(result.message || 'Form data saved successfully');
      
      if (isComplete) {
        setShowFormModal(false);
      }
      
      fetchAssignedRequests(); // Refresh the list
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form data');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'P':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'A':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'C':
        return <Badge className="bg-green-100 text-green-800">Complete</Badge>;
      case 'R':
        return <Badge className="bg-red-100 text-red-800">Canceled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={priorityColors[priority]}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const ProgressBar: React.FC<{ percentage: number }> = ({ percentage }) => (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );

  const getAvailableActions = (request: Request) => {
    const actions = [];
    
    if (request.STATUS === 'A') {
      actions.push({ type: 'complete', label: 'Complete', icon: CheckCircle, variant: 'primary' });
    }
    
    if (request.STATUS === 'P' || request.STATUS === 'A') {
      actions.push({ type: 'form', label: 'Start', icon: FileText, variant: 'primary' });
      actions.push({ type: 'work-progress', label: 'Add Details', icon: ClipboardList, variant: 'secondary' });
    }
    
    return actions;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toISOString().split('T')[0];
  };

  // Table sorting and filtering functions
  const handleSort = (field: keyof Request) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const clearFiltersAndSort = () => {
    setStatusFilter('all');
    setSearchTerm('');
    setSortField('SUBMITTED_DATE');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  // Export functionality
  const handleExport = (format: 'csv' | 'excel') => {
    const csvContent = [
      ['Request ID', 'Date/Time', 'Request Name', 'Status', 'Assigned To'].join(','),
      ...filteredAndSortedRequests.map(request => [
        request.TRACKINGID,
        formatDateTime(request.SUBMITTED_DATE),
        `"${request.REQUEST_NAME}"`,
        getStatusText(request.STATUS),
        request.assignedTo || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assigned-requests.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper functions for table display
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return { dateStr, timeStr };
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'P': return 'Pending';
      case 'A': return 'In Progress';
      case 'C': return 'Complete';
      case 'R': return 'Canceled';
      default: return status;
    }
  };

  // Filter and sort requests
  const filteredAndSortedRequests = React.useMemo(() => {
    const filtered = requests.filter(request => {
      const matchesStatus = statusFilter === 'all' || request.STATUS === statusFilter;
      const matchesSearch = searchTerm === '' || 
        request.REQUEST_NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.REQUEST_DESCRIPTION?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.TRACKINGID.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });

    return filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      if (sortField === 'SUBMITTED_DATE') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === 'string') {
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [requests, statusFilter, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalItems = filteredAndSortedRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRequests = filteredAndSortedRequests.slice(startIndex, endIndex);

  const getSortIcon = (field: keyof Request) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp size={14} className="text-primary ms-1" />
      : <ChevronDown size={14} className="text-primary ms-1" />;
  };

  const handleRowClick = (request: Request) => {
    setSelectedRequest(request);
    setShowActionModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="fulfillment-dashboard">
      {/* Page Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="title-section">
            <ClipboardList className="title-icon" size={32} />
            <div>
              <h1 className="dashboard-title">My Assigned Requests</h1>
              <p className="dashboard-subtitle">
                Manage and track your assigned requests efficiently
              </p>
            </div>
          </div>
          
          <div className="header-controls">
            <div className="filter-container">
              <label className="filter-label">Status Filter</label>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="status-filter"
              >
                <option value="all">All Requests</option>
                <option value="P">Pending</option>
                <option value="A">In Progress</option>
                <option value="C">Complete</option>
                <option value="R">Canceled</option>
              </Select>
            </div>
            
            <Button 
              onClick={clearFiltersAndSort} 
              variant="secondary"
              className="btn-clear-filters"
            >
              <Filter size={16} className="me-2" />
              Clear Filters
            </Button>
            
            {/* Search Bar moved into header controls */}
            <div className="search-controls">
              <Input
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Export dropdown removed as requested */}
          </div>
        </div>
      </div>



      

      {/* HTML Table */}
      <div className="table-container">
        <table className="requests-table">
          <thead>
            <tr>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('TRACKINGID')}
              >
                <div className="header-content">
                  <span>Request ID</span>
                  {getSortIcon('TRACKINGID')}
                  <Filter size={12} className="filter-icon" />
                </div>
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('SUBMITTED_DATE')}
              >
                <div className="header-content">
                  <span>Date/Time</span>
                  {getSortIcon('SUBMITTED_DATE')}
                  <Filter size={12} className="filter-icon" />
                </div>
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('REQUEST_NAME')}
              >
                <div className="header-content">
                  <span>Request Name</span>
                  {getSortIcon('REQUEST_NAME')}
                  <Filter size={12} className="filter-icon" />
                </div>
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('STATUS')}
              >
                <div className="header-content">
                  <span>Status</span>
                  {getSortIcon('STATUS')}
                  <Filter size={12} className="filter-icon" />
                </div>
              </th>
              <th className="header-content">
                <span>Assigned</span>
                <Filter size={12} className="filter-icon" />
              </th>
              <th className="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRequests.map((request) => {
              const { dateStr, timeStr } = formatDateTime(request.SUBMITTED_DATE);
              const actions = getAvailableActions(request);
              
              return (
                <tr 
                  key={request.REQUEST_ID} 
                  className="table-row" 
                  onClick={() => handleRowClick(request)}
                >
                  <td className="request-id-cell">
                    <span className="fw-medium text-primary">{request.TRACKINGID}</span>
                  </td>
                  <td className="date-cell">
                    <div className="d-flex align-items-center">
                      <Calendar size={16} className="text-muted me-2" />
                      <div>
                        <div className="date-main">{dateStr}</div>
                        <div className="date-time text-muted">{timeStr}</div>
                      </div>
                    </div>
                  </td>
                  <td className="request-name-cell">
                    <div className="request-name">{request.REQUEST_NAME}</div>
                    {request.REQUEST_DESCRIPTION && (
                      <div className="request-description text-muted">
                        {request.REQUEST_DESCRIPTION.length > 80 
                          ? request.REQUEST_DESCRIPTION.substring(0, 80) + '...' 
                          : request.REQUEST_DESCRIPTION
                        }
                      </div>
                    )}
                  </td>
                  <td className="status-cell">
                    {getStatusBadge(request.STATUS)}
                  </td>
                  <td className="assigned-to-cell">
                    <div className="d-flex align-items-center">
                      <User size={16} className="text-muted me-2" />
                      <span>{request.assignedTo}</span>
                    </div>
                  </td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="actions-container">
                      {actions.map((action) => (
                        <button
                          key={action.type}
                          className={`btn btn-sm action-btn ${
                            action.variant === 'primary' 
                              ? 'btn-primary' 
                              : 'btn-outline-secondary'
                          }`}
                          onClick={() => {
                            if (action.type === 'form') {
                              loadRequestForm(request);
                            } else if (action.type === 'work-progress') {
                              openWorkProgressModal(request);
                            } else {
                              setSelectedRequest(request);
                              setActionType(action.type as any);
                              setNotes('');
                              setShowActionModal(true);
                            }
                          }}
                          title={action.label}
                        >
                          <action.icon className="btn-icon" size={14} />
                          <span className="btn-text">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {paginatedRequests.length === 0 && (
          <div className="empty-table-message">
            <Clock className="empty-icon" size={48} />
            <h3>No requests found</h3>
            <p>
              {statusFilter === 'all' 
                ? searchTerm 
                  ? `No requests match "${searchTerm}"` 
                  : 'You have no assigned requests at this time.'
                : `No ${getStatusText(statusFilter).toLowerCase()} requests found.`
              }
            </p>
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} requests
          </div>
          <div className="pagination-controls">
            <button 
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                const start = Math.max(1, currentPage - 2);
                const end = Math.min(totalPages, currentPage + 2);
                return page >= start && page <= end;
              })
              .map(page => (
                <button
                  key={page}
                  className={`btn btn-sm ${
                    page === currentPage ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))
            }
            
            <button 
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
          <div className="pagination-footer">
            <div className="teal-footer">Page {currentPage} of {totalPages}</div>
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No requests found</h3>
          <p className="text-gray-500">
            {statusFilter === 'all' 
              ? 'You have no assigned requests at this time.' 
              : `You have no ${statusFilter === 'P' ? 'pending' : statusFilter === 'A' ? 'in progress' : 'completed'} requests.`
            }
          </p>
        </div>
      )}

      {/* Action Modal */}
      <Modal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        title={`${actionType === 'start' ? 'Start' : actionType === 'complete' ? 'Complete' : 'Update Progress'} - ${selectedRequest?.REQUEST_NAME}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <strong>Request ID:</strong> {selectedRequest?.REQUEST_ID}
          </div>
          <div className="text-sm text-gray-600">
            <strong>Requestor:</strong> {selectedRequest?.requestorName || 'Unknown'}
          </div>
          
          {(actionType === 'complete' || actionType === 'progress') && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {actionType === 'complete' ? 'Completion Notes' : 'Progress Notes'}
              </label>
              <TextArea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  actionType === 'complete' 
                    ? 'Describe how the request was completed...' 
                    : 'Add progress update...'
                }
                rows={4}
              />
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowActionModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : (actionType === 'start' ? 'Start' : actionType === 'complete' ? 'Complete' : 'Update')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Milestones Modal */}
      <Modal
        isOpen={showMilestones}
        onClose={() => setShowMilestones(false)}
        title={`Milestones - ${selectedRequest?.REQUEST_NAME}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <strong>Request ID:</strong> {selectedRequest?.REQUEST_ID}
          </div>
          
          {selectedRequest?.milestones && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Project Milestones</h3>
                <div className="text-sm text-gray-600">
                  {selectedRequest.milestones.filter(m => m.completed).length} of{' '}
                  {selectedRequest.milestones.length} completed
                </div>
              </div>
              
              <div className="space-y-3">
                {selectedRequest.milestones.map((milestone, index) => (
                  <div 
                    key={milestone.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      milestone.completed 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {milestone.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-xs text-gray-500">{index + 1}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className={`font-medium ${
                        milestone.completed ? 'text-green-800' : 'text-gray-800'
                      }`}>
                        {milestone.title}
                      </h4>
                      
                      {milestone.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {milestone.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {milestone.dueDate && (
                          <span>Due: {new Date(milestone.dueDate).toLocaleDateString()}</span>
                        )}
                        {milestone.completedDate && (
                          <span className="text-green-600">
                            Completed: {new Date(milestone.completedDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowMilestones(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Form Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={`Fill Request Form - ${selectedRequest?.REQUEST_NAME}`}
        size="lg"
      >
        <div className="p-6 space-y-8">
          {formData && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
              <h4 className="text-lg font-semibold text-blue-900 mb-2">
                {formData.form.FORM_NAME} Template
              </h4>
              <p className="text-sm text-blue-700 leading-relaxed">
                {formData.form.FORM_DESCRIPTION}
              </p>
            </div>
          )}
          
          {formLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading form...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {formFields.map((field, index) => (
                <div key={field.FIELD_ID} className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    {field.FIELD_NAME}
                    {field.IS_REQUIRED && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  
                  {field.FIELD_TYPE_ID === 3 ? (
                    // Date field
                    <Input
                      type="date"
                      value={formValues[field.FIELD_ID] || ''}
                      onChange={(e) => setFormValues(prev => ({
                        ...prev,
                        [field.FIELD_ID]: e.target.value
                      }))}
                      required={field.IS_REQUIRED}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  ) : (
                    // Text field
                    <Input
                      type="text"
                      value={formValues[field.FIELD_ID] || ''}
                      onChange={(e) => setFormValues(prev => ({
                        ...prev,
                        [field.FIELD_ID]: e.target.value
                      }))}
                      placeholder={`Enter ${field.FIELD_NAME.toLowerCase()}...`}
                      required={field.IS_REQUIRED}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  )}
                  
                  {index < formFields.length - 1 && (
                    <div className="border-b border-gray-100 mt-4"></div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Form Status Display */}
          {formData && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-6">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600">Form Status:</span>
                {formData.formStatus === 'completed' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✓ Completed
                  </span>
                ) : formData.formStatus === 'in_progress' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    📝 In Progress
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    📄 New
                  </span>
                )}
                {formData.hasExistingData && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    Previously saved data loaded
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6 border-t border-gray-200 mt-4">
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              disabled={actionLoading}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => saveFormData(false, true)}
                disabled={actionLoading || formLoading}
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6H16a5 5 0 0 1 1 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Save Draft
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => saveFormData(true, false)}
                disabled={actionLoading || formLoading}
                className="px-6 py-3 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Completing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Complete Form
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Work Progress Modal */}
      <Modal
        isOpen={showWorkProgressModal}
        onClose={() => setShowWorkProgressModal(false)}
        title={`Work Progress - ${selectedRequest?.REQUEST_NAME}`}
        size="xl"
      >
        <div className="p-6">
          {selectedRequest && (
            <div className="space-y-6">
              {/* Request Summary Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-semibold text-blue-900 mb-1">
                      {selectedRequest.REQUEST_NAME}
                    </h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <div><strong>Request ID:</strong> {selectedRequest.TRACKINGID}</div>
                      <div><strong>Status:</strong> {getStatusBadge(selectedRequest.STATUS)}</div>
                      <div><strong>Submitted:</strong> {formatDate(selectedRequest.SUBMITTED_DATE)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {selectedRequest.priority && (
                      <div className="mb-2">
                        {getPriorityBadge(selectedRequest.priority)}
                      </div>
                    )}
                    <div className="text-sm text-blue-700">
                      <strong>Assigned To:</strong><br />
                      {selectedRequest.assignedTo}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'details'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab('details')}
                  >
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    Request Details
                  </button>
                  <button
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'form'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab('form')}
                  >
                    <FileText className="w-4 h-4 inline mr-2" />
                    Form Data
                  </button>
                  <button
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'progress'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab('progress')}
                  >
                    <ClipboardList className="w-4 h-4 inline mr-2" />
                    Work Progress
                  </button>
                  <button
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'tasks'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveTab('tasks')}
                  >
                    <CheckSquare className="w-4 h-4 inline mr-2" />
                    Tasks
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              <div className="min-h-96">
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Request Description
                        </label>
                        <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                          {selectedRequest.REQUEST_DESCRIPTION || 'No description provided'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Requestor Information
                        </label>
                        <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                          {selectedRequest.requestorName || selectedRequest.requestor?.FIRST_NAME + ' ' + selectedRequest.requestor?.LAST_NAME || 'Unknown Requestor'}
                        </div>
                      </div>
                    </div>
                    {selectedRequest.milestones && (
                      <div className="mt-6">
                        <h5 className="text-lg font-medium text-gray-900 mb-3">Project Milestones</h5>
                        <div className="space-y-3">
                          {selectedRequest.milestones.map((milestone, index) => (
                            <div 
                              key={milestone.id} 
                              className={`flex items-start gap-3 p-3 rounded-lg border ${
                                milestone.completed 
                                  ? 'bg-green-50 border-green-200' 
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex-shrink-0 mt-1">
                                {milestone.completed ? (
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                ) : (
                                  <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex items-center justify-center">
                                    <span className="text-xs text-gray-500">{index + 1}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <h6 className={`font-medium ${
                                  milestone.completed ? 'text-green-800' : 'text-gray-800'
                                }`}>
                                  {milestone.title}
                                </h6>
                                {milestone.description && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {milestone.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'form' && (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Form Data</h3>
                    <p className="text-gray-500 mb-4">
                      Access and edit form data for this request
                    </p>
                    <Button
                      onClick={() => {
                        setShowWorkProgressModal(false);
                        loadRequestForm(selectedRequest);
                      }}
                      variant="primary"
                    >
                      Open Form Editor
                    </Button>
                  </div>
                )}

                {activeTab === 'progress' && (
                  <WorkProgressTable
                    requestId={selectedRequest.REQUEST_ID}
                    requestStatus={selectedRequest.STATUS}
                    isAssignedToCurrentUser={true}
                    onProgressUpdate={handleWorkProgressUpdate}
                  />
                )}

                {activeTab === 'tasks' && (
                  <TaskTable
                    requestId={selectedRequest.REQUEST_ID}
                    requestStatus={selectedRequest.STATUS}
                    isAssignedToCurrentUser={true}
                    onTaskUpdate={handleWorkProgressUpdate}
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button
                  variant="secondary"
                  onClick={() => setShowWorkProgressModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RequestFulfillmentDashboard;
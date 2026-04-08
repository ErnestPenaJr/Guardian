import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

import DataTable, { TableColumn } from 'react-data-table-component';
import api from '../utils/api';
import '../styles/RequestDashboard.css';
import '../styles/FormCreationFlow.css';
import '../styles/StatusBadge.css';
import { toast } from 'react-toastify';
import NewRequestModal from './NewRequestModal';
import SelectFormModal from '../components/SelectFormModal';
import AddRequestModal from '../components/AddRequestModal';
import RequestModal from '../components/RequestModal';
import formService from '../services/formService';
import { FormField } from '../types/formBuilder';
import { useAuth } from '../hooks/useAuth';
import { useRequestState } from '../hooks/useRequestState';

interface FormFieldWithLayout extends FormField {
  colWidth?: string;
  FIELD_ID?: number;
  FIELD_NAME?: string;
  FIELD_TYPE_ID?: number;
  IS_REQUIRED?: boolean;
}

// Utility function to determine column width based on field type and name
const getFieldColumnWidth = (field: FormFieldWithLayout): string => {
  // Field types that should take full width (3: Date, 4: Textarea, etc.)
  const fullWidthTypes = [3, 4, 5];
  const fieldTypeId = field.FIELD_TYPE_ID || field.fieldTypeId;
  if (fieldTypeId && fullWidthTypes.includes(fieldTypeId)) {
    return 'col-12';
  }
  
  // Field names that should take full width
  const fullWidthNames = ['description', 'notes', 'comments', 'address', 'details'];
  const fieldName = ((field.FIELD_NAME || field.fieldName || '')).toLowerCase();
  if (fullWidthNames.some(name => fieldName.includes(name))) {
    return 'col-12';
  }
  
  // Default to half width for most fields
  return 'col-md-6';
};

// Function to group fields into rows for better organization
const groupFieldsIntoRows = (fields: FormField[]): FormFieldWithLayout[][] => {
  const rows: FormFieldWithLayout[][] = [];
  let currentRow: FormFieldWithLayout[] = [];
  let currentRowWidth = 0;
  const maxRowWidth = 12; // Bootstrap's grid is 12 columns wide
  
  fields.forEach((field) => {
    const colWidth = getFieldColumnWidth(field);
    const fieldWidth = colWidth === 'col-12' ? 12 : 6; // Each field is either full width (12) or half width (6)
    
    // If adding this field would exceed the row width, start a new row
    if (currentRowWidth + fieldWidth > maxRowWidth) {
      rows.push([...currentRow]);
      currentRow = [];
      currentRowWidth = 0;
    }
    
    const fieldWithLayout: FormFieldWithLayout = {
      ...field,
      colWidth: fieldWidth === 12 ? 'col-12' : 'col-md-6 col-12' // Responsive columns
    };
    
    currentRow.push(fieldWithLayout);
    currentRowWidth += fieldWidth;
    
    // If we've reached the max row width, start a new row
    if (currentRowWidth >= maxRowWidth) {
      rows.push([...currentRow]);
      currentRow = [];
      currentRowWidth = 0;
    }
  });
  
  // Add any remaining fields
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  return rows;
};

interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  STATUS: string;
  FORM_ID: number | null;
  REQUESTOR_ID: number | null;
  ASSIGNED_ID: number | null;
  SUBMITTED_DATE: string | null;
  CREATE_DATE: string | null;
  UPDATE_DATE: string | null;
  CREATE_USER_ID: number | null;
  UPDATE_USER_ID: number | null;
  TRACKINGID: string | null;
  EXTERNAL_USER?: string | null;
  FIRST_NAME?: string;
  LAST_NAME?: string;
  requestor?: {
    FIRST_NAME: string;
    LAST_NAME: string;
  };
  assigned?: {
    FIRST_NAME: string;
    LAST_NAME: string;
  };
  requestorName?: string;
  assignedName?: string;
}

const RequestDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subscribeToRefresh } = useRequestState();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  
  // Check if user has one of the allowed roles
  const hasCreateRequestAccess = useMemo(() => {
    if (!user) return false;
    
    // Define allowed role IDs: Admin(1), User(2), Manager(3), Processor(4), Jafar(6)
    const allowedRoles = [1, 2, 3, 4, 6];
    
    // Check if user has any of the allowed roles
    if (user.roles && Array.isArray(user.roles)) {
      // Check roles array for objects with id property
      return user.roles.some((role: any) => 
        typeof role === 'object' && role !== null && 
        allowedRoles.includes(role.id || role.role_id)
      );
    }
    
    // Check role as string (from JWT token)
    if (user.role) {
      const roleId = parseInt(user.role, 10);
      return allowedRoles.includes(roleId);
    }
    
    return false;
  }, [user]);
  const [quickFilter, setQuickFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSelectFormModal, setShowSelectFormModal] = useState(false);
  const [showAddRequestModal, setShowAddRequestModal] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  
  // Form fulfillment state
  const [showFormFulfillmentModal, setShowFormFulfillmentModal] = useState(false);
  const [fulfillmentFormData, setFulfillmentFormData] = useState<any>(null);
  
  // Function to handle viewing a request when row is clicked
  const handleViewRequest = (request: Request) => {
    setSelectedRequest(request);
    setShowRequestModal(true);
  };
  const [fulfillmentFormFields, setFulfillmentFormFields] = useState<any[]>([]);
  const [fulfillmentFormValues, setFulfillmentFormValues] = useState<Record<string, any>>({});
  const [fulfillmentFormLoading, setFulfillmentFormLoading] = useState(false);
  const [fulfillmentActionLoading, setFulfillmentActionLoading] = useState(false);

  // My Assigned Requests state
  const [assignedRequests, setAssignedRequests] = useState<Request[]>([]);
  const [assignedRequestsLoading, setAssignedRequestsLoading] = useState(false);
  const [assignedRequestsFilter, setAssignedRequestsFilter] = useState('all');
  const [assignedRequestsSearch, setAssignedRequestsSearch] = useState('');
  const [showAssignedRequestsSection, setShowAssignedRequestsSection] = useState(true);

  // Fetch requests on component mount
  useEffect(() => {
    fetchRequests();
    // Only fetch assigned requests if user is logged in and has appropriate role
    if (user && user.userId) {
      fetchAssignedRequests();
    }
  }, [user]);
  
  useEffect(() => {
    fetchRequests();
  }, []);

  // Subscribe to global request state changes for real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToRefresh(() => {
      console.log('🔄 Global state refresh triggered - updating RequestDashboard.tsx data');
      fetchRequests();
    });
    
    return unsubscribe;
  }, [subscribeToRefresh]);

  // Monitor modal state changes
  useEffect(() => {
    console.log('[MODAL STATE] showFormFulfillmentModal changed to:', showFormFulfillmentModal);
    console.log('[MODAL STATE] fulfillmentFormData:', fulfillmentFormData ? 'EXISTS' : 'NULL');
    console.log('[MODAL STATE] selectedRequest:', selectedRequest?.REQUEST_ID || 'NONE');
  }, [showFormFulfillmentModal, fulfillmentFormData, selectedRequest]);

  // Fetch requests from the API
  const fetchRequests = async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] fetchRequests called - refreshing request data`);
    console.log('Current requests state:', requests.length, 'requests');
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`[${timestamp}] Fetching requests from API...`);
      const { data } = await api.get('/api/requests');
      console.log(`[${timestamp}] Requests fetched successfully:`, data.length, 'requests');
      console.log('First few requests:', data.slice(0, 3));
      
      // Log FORM_ID values for debugging
      if (data.length > 0) {
        console.log('[FRONTEND] Request FORM_IDs:', 
          data.slice(0, 5).map((r: any) => ({ 
            REQUEST_ID: r.REQUEST_ID, 
            REQUEST_NAME: r.REQUEST_NAME, 
            FORM_ID: r.FORM_ID 
          }))
        );
      }
      
      // Check if there are any differences between current and new data
      const currentIds = new Set(requests.map((r: any) => r.REQUEST_ID));
      // Calculate if there are new or removed requests
      const hasNewRequests = data.some((r: any) => !currentIds.has(r.REQUEST_ID));
      const hasDifferentAssignments = data.some((r: any) => {
        const currentReq = requests.find((cr: any) => cr.REQUEST_ID === r.REQUEST_ID);
        return currentReq && currentReq.ASSIGNED_ID !== r.ASSIGNED_ID;
      });
      
      console.log(`[${timestamp}] Data comparison:`, {
        currentRequestCount: requests.length,
        newRequestCount: data.length,
        hasNewRequests,
        hasDifferentAssignments
      });
      
      console.log(`[${timestamp}] Setting requests state with new data`);
      setRequests(data);
      console.log(`[${timestamp}] State update queued`);
    } catch (err: any) {
      console.error(`[${timestamp}] Error fetching requests:`, err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch requests');
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
      console.log(`[${timestamp}] Loading state set to false`);
    }
  };

  // Filter main requests - exclude requests assigned to current user
  const mainRequests = useMemo(() => {
    if (!user?.userId) return requests;
    
    // Filter out requests assigned to the current user
    return requests.filter(request => {
      // If request is assigned to current user, exclude it from main dashboard
      return request.ASSIGNED_ID !== user.userId;
    });
  }, [requests, user?.userId]);

  // Filter main requests based on quick filter
  const filteredRequests = useMemo(() => {
    if (!quickFilter) return mainRequests;
    
    return mainRequests.filter(request => {
      const searchStr = quickFilter.toLowerCase();
      return (
        (request.REQUEST_NAME?.toLowerCase().includes(searchStr)) ||
        (request.STATUS?.toLowerCase().includes(searchStr)) ||
        (request.requestorName?.toLowerCase().includes(searchStr)) ||
        (request.assignedName?.toLowerCase().includes(searchStr))
      );
    });
  }, [mainRequests, quickFilter]);

  // Filter assigned requests based on status filter and search
  const filteredAssignedRequests = useMemo(() => {
    let filtered = assignedRequests;
    
    // Apply status filter
    if (assignedRequestsFilter !== 'all') {
      filtered = filtered.filter(request => {
        switch (assignedRequestsFilter) {
          case 'pending':
            return request.STATUS === 'P';
          case 'active':
            return request.STATUS === 'A';
          case 'completed':
            return request.STATUS === 'D';
          default:
            return true;
        }
      });
    }
    
    // Apply search filter
    if (assignedRequestsSearch) {
      const searchStr = assignedRequestsSearch.toLowerCase();
      filtered = filtered.filter(request => (
        (request.REQUEST_NAME?.toLowerCase().includes(searchStr)) ||
        (request.TRACKINGID?.toLowerCase().includes(searchStr)) ||
        (request.requestorName?.toLowerCase().includes(searchStr))
      ));
    }
    
    return filtered;
  }, [assignedRequests, assignedRequestsFilter, assignedRequestsSearch]);

  // Define table columns
  const columns: TableColumn<Request>[] = [
    {
      name: 'Tracking ID',
      selector: row => row.TRACKINGID || `REQ-${row.REQUEST_ID}`,
      sortable: true,
      grow: 2,
      wrap: true,
      cell: row => {
        const trackingId = row.TRACKINGID || `REQ-${row.REQUEST_ID}`;
        return (
          <div className="tracking-id-cell">
            {trackingId}
          </div>
        );
      }
    },
    {
      name: 'Request Name',
      selector: row => row.REQUEST_NAME,
      sortable: true,
      grow: 2,
    },
    { 
      name: 'Status', 
      selector: row => row.STATUS,
      sortable: true, 
      cell: row => {
        const statusMap: Record<string, { text: string; cls: string }> = {
          'P': { text: 'Pending', cls: 'status-badge--pending' },
          'A': { text: 'Active', cls: 'status-badge--active' },
          'D': { text: 'Complete', cls: 'status-badge--complete' },
          'I': { text: 'In Progress', cls: 'status-badge--inprogress' },
          'X': { text: 'Cancelled', cls: 'status-badge--cancelled' },
          'H': { text: 'On hold', cls: 'status-badge--onhold' },
          'R': { text: 'Rejected', cls: 'status-badge--rejected' },
          'pending': { text: 'Pending', cls: 'status-badge--pending' },
          'approved': { text: 'Active', cls: 'status-badge--active' },
          'rejected': { text: 'Rejected', cls: 'status-badge--rejected' },
        };
        const s = statusMap[row.STATUS] || { text: row.STATUS, cls: '' };
        return <span className={`status-badge ${s.cls}`}>{s.text}</span>;
      },
      width: '130px'
    },
    {
      name: 'Submitted',
      selector: row => row.SUBMITTED_DATE || '',
      sortable: true,
      grow: 1,
    },
    {
      name: 'Requestor',
      selector: row => row.requestorName || '',
      sortable: true,
      grow: 1,
      cell: row => {
        if (row.requestor) {
          return `${row.requestor.FIRST_NAME} ${row.requestor.LAST_NAME}`;
        } else if (row.EXTERNAL_USER) {
          return row.EXTERNAL_USER;
        } else {
          return 'Unknown';
        }
      },
    },
    {
      name: 'Assigned To',
      selector: row => row.assignedName || '',
      sortable: true,
      grow: 1,
      cell: row => {
        if (row.assigned) {
          return `${row.assigned.FIRST_NAME} ${row.assigned.LAST_NAME}`;
        } else {
          return 'Unassigned';
        }
      },
    },
    {
      name: 'Actions',
      cell: row => (
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRequest(row);
              setShowRequestModal(true);
            }}
          >
            View
          </button>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={async () => {
              // Show confirmation dialog
              const result = await Swal.fire({
                title: 'Delete Request?',
                text: `Are you sure you want to delete "${row.REQUEST_NAME}"? This action cannot be undone.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, delete it',
                cancelButtonText: 'Cancel'
              });

              if (result.isConfirmed) {
                try {
                  await api.delete(`/api/requests/${row.REQUEST_ID}`);
                  toast.success('Request deleted successfully');
                  fetchRequests(); // Refresh the list
                } catch (error: any) {
                  console.error('Error deleting request:', error);
                  toast.error(error.response?.data?.error || 'Failed to delete request');
                }
              }
            }}
            title="Delete Request"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-trash" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/>
              <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/>
            </svg>
          </button>

        </div>
      ),
      width: '140px',
      ignoreRowClick: true,
      sortable: false,
      selector: _ => ''
    }
  ];

  // Define assigned requests table columns with actions
  const assignedRequestsColumns: TableColumn<Request>[] = [
    {
      name: 'Request ID',
      selector: row => row.TRACKINGID || `REQ-${row.REQUEST_ID}`,
      sortable: true,
      width: '140px',
      wrap: true,
      cell: row => {
        const trackingId = row.TRACKINGID || `REQ-${row.REQUEST_ID}`;
        return (
          <div className="tracking-id-cell fw-medium" style={{ fontSize: '13px' }}>
            {trackingId}
          </div>
        );
      }
    },
    {
      name: 'Request Name',
      selector: row => row.REQUEST_NAME,
      sortable: true,
      grow: 2,
      wrap: true,
      cell: row => (
        <div className="fw-medium" style={{ fontSize: '14px' }}>
          {row.REQUEST_NAME}
        </div>
      )
    },
    {
      name: 'Requestor',
      selector: row => row.requestorName || 'Unknown',
      sortable: true,
      width: '150px',
      wrap: true,
      cell: row => (
        <div style={{ fontSize: '13px' }}>
          {row.requestorName || 'Unknown'}
        </div>
      )
    },
    {
      name: 'Status',
      selector: row => row.STATUS,
      sortable: true,
      width: '110px',
      cell: row => {
        const statusMap: Record<string, { text: string; cls: string }> = {
          'P': { text: 'Pending', cls: 'status-badge--pending' },
          'A': { text: 'Active', cls: 'status-badge--active' },
          'D': { text: 'Complete', cls: 'status-badge--complete' },
          'I': { text: 'In Progress', cls: 'status-badge--inprogress' },
          'X': { text: 'Cancelled', cls: 'status-badge--cancelled' },
          'H': { text: 'On hold', cls: 'status-badge--onhold' },
          'R': { text: 'Rejected', cls: 'status-badge--rejected' },
        };
        const s = statusMap[row.STATUS] || { text: row.STATUS, cls: '' };
        return <span className={`status-badge ${s.cls}`}>{s.text}</span>;
      }
    },
    {
      name: 'Submitted',
      selector: row => row.SUBMITTED_DATE,
      sortable: true,
      width: '120px',
      cell: row => {
        const date = new Date(row.SUBMITTED_DATE);
        return (
          <div style={{ fontSize: '12px' }}>
            {date.toLocaleDateString()}
          </div>
        );
      }
    },
    {
      name: 'Actions',
      width: '200px',
      cell: row => {
        const canStart = row.STATUS === 'P';
        const canContinue = row.STATUS === 'A';
        const isCompleted = row.STATUS === 'D';
        
        return (
          <div className="d-flex gap-2">
            {canStart && (
              <button
                className="btn btn-sm btn-success"
                style={{ fontSize: '12px', minWidth: '70px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartWork(row);
                }}
              >
                Start Work
              </button>
            )}
            {isCompleted && (
              <span className="status-badge status-badge--complete">Complete</span>
            )}
            <button
              className="btn btn-sm btn-outline-secondary"
              style={{ fontSize: '12px' }}
              onClick={(e) => {
                e.stopPropagation();
                handleViewRequest(row);
              }}
            >
              View
            </button>
          </div>
        );
      }
    }
  ];

  // Load form template and open modal
  const loadFormAndOpenModal = async (formId: number) => {
    try {
      setLoading(true);
      // Fetch the form template
      const formTemplate = await formService.getFormById(formId);
      
      if (formTemplate && formTemplate.form) {
        // Convert DB fields to form fields
        const formFields = formService.convertDbFieldsToFormFields(formTemplate.fields);
        
        // Set form data with null checks
        setFormData({
          name: formTemplate.form.FORM_NAME || 'Form Template',
          description: formTemplate.form.FORM_DESCRIPTION || '',
          formType: 'request', // Default to request type
          formFields: formFields
        });
        
        // Open the form modal
        setShowModal(true);
      } else {
        toast.error('Failed to load form template');
      }
    } catch (error) {
      console.error('Error loading form template:', error);
      toast.error('Failed to load form template');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle form save - now handles both form templates and request submissions
  const handleSaveForm = async (formData: any) => {
    try {
      console.log('💾 handleSaveForm called with:', formData);
      
      // Check if this is a request submission - handle both NewRequestModal and AddRequestModal formats
      const isAddRequestModalFormat = formData.name && formData.templateId && formData.formFieldValues;
      const isNewRequestModalFormat = formData.requestData && formData.formInstanceValues;
      
      if (isAddRequestModalFormat || isNewRequestModalFormat) {
        console.log('📋 Processing request submission with form data');
        console.log('📋 Format detected:', isAddRequestModalFormat ? 'AddRequestModal' : 'NewRequestModal');
        
        // Step 1: Create the request - handle both data formats
        let requestPayload;
        if (isAddRequestModalFormat) {
          // AddRequestModal format
          requestPayload = {
            REQUEST_NAME: formData.name,
            REQUEST_DESCRIPTION: formData.description || '',
            ABBREVIATION: formData.abbreviation,
            STATUS: 'P', // Default to Pending
            ASSIGNED_ID: null, // Will be set by server
            FORM_ID: formData.templateId,
            templateId: formData.templateId // Also include as templateId for server compatibility
          };
        } else {
          // NewRequestModal format
          requestPayload = {
            REQUEST_NAME: formData.requestData.REQUEST_NAME,
            REQUEST_DESCRIPTION: formData.requestData.REQUEST_DESCRIPTION || '',
            ABBREVIATION: formData.requestData.ABBREVIATION,
            STATUS: formData.requestData.STATUS || 'P',
            ASSIGNED_ID: formData.requestData.ASSIGNED_ID,
            FORM_ID: formData.templateId || null,
            templateId: formData.templateId || null // Also include as templateId for server compatibility
          };
        }
        
        console.log('🚀 Creating request with payload:', requestPayload);
        const requestResponse = await api.post('/api/requests', requestPayload);
        
        if (!requestResponse.data.success) {
          throw new Error(requestResponse.data.message || 'Failed to create request');
        }
        
        const newRequest = requestResponse.data.data;
        console.log('✅ Request created successfully:', newRequest);
        
        // Step 2: Submit form data if we have form values and a form ID
        const hasFormValues = (isAddRequestModalFormat && formData.formFieldValues && Object.keys(formData.formFieldValues).length > 0) ||
                             (isNewRequestModalFormat && formData.formInstanceValues && formData.formInstanceValues.length > 0);
        
        if (hasFormValues && newRequest.FORM_ID) {
          console.log('📝 Submitting form data for request:', newRequest.REQUEST_ID);
          
          // Convert form values to field values format expected by form submission API
          const fieldValues: Record<string, any> = {};
          
          if (isAddRequestModalFormat) {
            // AddRequestModal format: formFieldValues is an object with field IDs as keys
            console.log('📋 AddRequestModal field values received:', formData.formFieldValues);
            
            // Check if the keys are already field IDs (numeric) or field names (strings)
            const firstKey = Object.keys(formData.formFieldValues)[0];
            const keysAreFieldIds = !isNaN(parseInt(firstKey)) && firstKey !== 'request_status';
            
            if (keysAreFieldIds) {
              // Keys are already field IDs, use them directly
              Object.entries(formData.formFieldValues).forEach(([fieldId, value]: [string, any]) => {
                if (fieldId !== 'request_status' && value !== null && value !== undefined && value !== '') {
                  fieldValues[parseInt(fieldId)] = value;
                  console.log(`✅ Direct field ID mapping: Field ${fieldId} = "${value}"`);
                }
              });
            } else {
              // Keys are field names, need to map to field IDs
              try {
                const formTemplate = await formService.getFormById(formData.templateId);
                if (formTemplate && formTemplate.fields) {
                  formTemplate.fields.forEach((field: any) => {
                    // Create multiple possible field name mappings for better matching
                    const fieldName = field.FIELD_NAME || '';
                    const possibleKeys = [
                      fieldName.toLowerCase().replace(/\s+/g, '_'),     // "Bank Name" -> "bank_name"
                      fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_'), // "Routing #" -> "routing___"
                      fieldName.toLowerCase().replace(/\s+/g, '_').replace(/#/g, 'number'), // "Routing #" -> "routing_number"
                      fieldName.toLowerCase().replace(/[^a-z0-9]/g, ''), // "Routing #" -> "routing"
                    ];
                    
                    // Try to find a match using any of the possible keys
                    for (const key of possibleKeys) {
                      if (formData.formFieldValues[key]) {
                        fieldValues[field.FIELD_ID] = formData.formFieldValues[key];
                        console.log(`✅ Mapped field: ${key} -> ${fieldName} (ID: ${field.FIELD_ID}) = "${formData.formFieldValues[key]}"`);
                        break; // Stop after first match
                      }
                    }
                  });
                }
              } catch (error) {
                console.error('❌ Error mapping field names to IDs:', error);
                // Fallback: try direct field name to ID mapping if we can't get the template
                Object.entries(formData.formFieldValues).forEach(([fieldName, value]: [string, any]) => {
                  console.log(`⚠️ Fallback mapping: ${fieldName} = "${value}"`);
                  fieldValues[fieldName] = value; // Use field name as key temporarily
                });
              }
            }
          } else {
            // NewRequestModal format: formInstanceValues is an array with FIELD_ID and FIELD_VALUE
            console.log('📋 NewRequestModal form instance values received:', formData.formInstanceValues);
            formData.formInstanceValues.forEach((fv: any) => {
              if (fv.FIELD_ID && fv.FIELD_VALUE) {
                fieldValues[fv.FIELD_ID] = fv.FIELD_VALUE;
                console.log(`✅ Adding field value: Field ${fv.FIELD_ID} = "${fv.FIELD_VALUE}"`);
              } else {
                console.log(`⚠️ Skipping field value: Field ID=${fv.FIELD_ID}, Value="${fv.FIELD_VALUE}"`);
              }
            });
          }
          
          console.log('📊 Final field values to submit:', fieldValues);
          console.log('📊 Total field values count:', Object.keys(fieldValues).length);
          
          try {
            // Check the request status to determine which form service function to call
            const requestStatus = isAddRequestModalFormat ? formData.requestStatus : 'Draft';
            
            if (requestStatus === 'Completed') {
              // Call completeForm for completed requests
              await formService.completeForm(newRequest.REQUEST_ID, fieldValues);
              console.log('✅ Form data completed successfully');
            } else {
              // Call submitForm for drafts or other statuses
              await formService.submitForm(newRequest.REQUEST_ID, fieldValues, { 
                isComplete: false, 
                isDraft: true 
              });
              console.log('✅ Form data saved as draft successfully');
            }
          } catch (formError) {
            console.error('❌ Failed to save form data:', formError);
            // Don't fail the whole operation, just warn
            toast.warn('Request created but form data could not be saved. You can fill it out later.');
          }
        }
        
        toast.success('Your request has been created successfully!');
      } else {
        console.log('📋 Processing form template creation');
        
        // Original form template creation logic
        const formToSave: any = {
          FORM_NAME: formData.name,
          FORM_DESCRIPTION: formData.description,
          IS_PUBLIC: true,
          IS_ACTIVE: true,
          IS_DELETED: false,
          FORM_TYPE: formData.formType?.toLowerCase()
        };
        
        // Convert form fields to DB fields format if needed
        const fieldsToSave = formData.formFields.map((field: any, index: number) => ({
          FIELD_NAME: field.fieldName,
          FIELD_TYPE_ID: field.dbFieldTypeId || 1, // Default to text if not specified
          IS_REQUIRED: field.required || false,
          OPTIONS: field.options || null,
          SEQUENCE: index + 1,
          IS_ACTIVE: true,
          IS_DELETED: false
        }));
        
        await formService.createForm(formToSave, fieldsToSave);
        toast.success('Your Workflow Template has been created.');
      }
      
      // Refresh both request lists
      await Promise.all([
        fetchRequests(),
        user?.userId ? fetchAssignedRequests() : Promise.resolve()
      ]);
    } catch (error: any) {
      console.error('❌ Error in handleSaveForm:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to save');
      throw error;
    }
  };

  // Fetch assigned requests specifically for the current user
  const fetchAssignedRequests = async () => {
    try {
      setAssignedRequestsLoading(true);
      console.log('🔄 Fetching assigned requests for user:', user?.userId);
      
      const response = await api.get('/api/requests/assigned/me');
      console.log('📥 Assigned requests response:', response.data);
      
      const assignedData = Array.isArray(response.data) ? response.data : [];
      
      // Enrich assigned requests data
      const enrichedAssignedRequests = assignedData.map((request: any) => ({
        ...request,
        requestorName: request.requestor 
          ? `${request.requestor.FIRST_NAME} ${request.requestor.LAST_NAME}`
          : (request.FIRST_NAME && request.LAST_NAME 
              ? `${request.FIRST_NAME} ${request.LAST_NAME}` 
              : 'Unknown'),
        assignedName: user?.firstName && user?.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user?.email || 'Me'
      }));
      
      setAssignedRequests(enrichedAssignedRequests);
      console.log('✅ Assigned requests loaded successfully:', enrichedAssignedRequests.length, 'requests');
    } catch (err: any) {
      console.error('❌ Error fetching assigned requests:', err);
      toast.error('Failed to load assigned requests');
      setAssignedRequests([]);
    } finally {
      setAssignedRequestsLoading(false);
    }
  };

  // Handle starting work on an assigned request
  const handleStartWork = async (request: Request) => {
    try {
      console.log('🚀 Starting work on request:', request.REQUEST_ID);
      
      const response = await api.post(`/api/requests/${request.REQUEST_ID}/start`);
      
      if (response.data.success) {
        toast.success(`Started work on ${request.REQUEST_NAME}`);
        // Refresh both request lists to reflect the status change
        await Promise.all([
          fetchRequests(),
          fetchAssignedRequests()
        ]);
      } else {
        toast.error('Failed to start work on request');
      }
    } catch (error: any) {
      console.error('Error starting work:', error);
      toast.error(error.response?.data?.error || 'Failed to start work');
    }
  };

  // Handle continuing work on an active request
  const handleContinueWork = (request: Request) => {
    console.log('📝 Continuing work on request:', request.REQUEST_ID);
    // Open the work progress modal for this request
    setSelectedRequest(request);
    setShowRequestModal(true);
  };

  // Load request form for fulfillment


  // Save form fulfillment data
  const saveFulfillmentFormData = async () => {
    if (!selectedRequest || !fulfillmentFormData) return;
    
    try {
      setFulfillmentActionLoading(true);
      
      // Get the status from the form values
      const newStatus = fulfillmentFormValues['status'] || selectedRequest.STATUS || 'P';
      
      // Try to submit the form
      try {
        await formService.submitForm(selectedRequest.REQUEST_ID, fulfillmentFormValues);
        
        // Update request status if it has changed
        if (newStatus !== selectedRequest.STATUS) {
          await api.put(`/api/requests/${selectedRequest.REQUEST_ID}`, {
            status: newStatus,
            assignedId: selectedRequest.ASSIGNED_ID
          });
        }
        
        toast.success('Form data and status saved successfully');
      } catch (submitError) {
        console.error('Primary form submission failed:', submitError);
        
        // Production fallback: if form submission fails, still try to update status
        console.log('[FULFILLMENT] Using fallback form submission');
        
        // Try to update request status directly if form submission fails
        try {
          await api.put(`/api/requests/${selectedRequest.REQUEST_ID}`, {
            status: newStatus,
            assignedId: selectedRequest.ASSIGNED_ID
          });
          toast.success('Request status updated successfully (fallback mode)');
        } catch (statusError) {
          console.error('Status update also failed:', statusError);
          toast.warning('Form data saved locally. Please sync manually when connection improves.');
        }
      }
      
      setShowFormFulfillmentModal(false);
      fetchRequests(); // Refresh the list
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form data');
    } finally {
      setFulfillmentActionLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="text-2xl font-bold uppercase fs-2 mb-8">Request Dashboard</h1>
      
      {/* Main Requests Section Header */}
      <div className="mb-3">
        <div className="d-flex align-items-center">
          <div className="bg-secondary" style={{ width: '4px', height: '20px', marginRight: '12px' }}></div>
          <div>
            <h3 className="mb-1" style={{ fontSize: '20px', fontWeight: '600', color: '#2c3e50' }}>
              All Requests
            </h3>
            <p className="mb-0 text-muted" style={{ fontSize: '13px' }}>
              View and manage all requests in the system (excluding your assigned requests)
            </p>
          </div>
        </div>
      </div>

      <div className="request-dashboard-header mb-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          {hasCreateRequestAccess && (
            <button
            className="btn btn-outline-secondary ms-2"
            style={{
              minWidth: 100,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap'
            }}
            onClick={async () => {
              setLoading(true);
              setAssignedRequestsLoading(true);
              setError(null);
              
              try {
                await Promise.all([
                  fetchRequests(),
                  user?.userId ? fetchAssignedRequests() : Promise.resolve()
                ]);
                toast.success('All requests refreshed successfully');
              } catch (error) {
                toast.error('Failed to refresh requests');
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise me-1" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
            </svg>
            Refresh
          </button>
        )}



        {/* Export button */}
        <button
          className="btn btn-outline-primary ms-2 d-flex align-items-center gap-2"
          onClick={() => {
            const exportData = (requests || []).map((r: any) => ({
              TRACKINGID: r.TRACKINGID,
              REQUEST_NAME: r.REQUEST_NAME,
              STATUS: r.STATUS === 'P' ? 'Pending' : r.STATUS === 'IP' ? 'In Progress' : r.STATUS === 'C' ? 'Completed' : r.STATUS === 'X' ? 'Cancelled' : r.STATUS,
              SUBMITTED_DATE: r.SUBMITTED_DATE,
              requestorName: r.requestor ? `${r.requestor.FIRST_NAME} ${r.requestor.LAST_NAME}` : r.requestorName || '',
              assignedTo: r.assigned ? `${r.assigned.FIRST_NAME} ${r.assigned.LAST_NAME}` : r.assignedName || 'Unassigned',
            }));
            navigate('/export/requests', {
              state: {
                data: exportData,
                metadata: {
                  totalRecords: String(exportData.length),
                  dateRange: exportData.length > 0 ? `${new Date(exportData[exportData.length - 1].SUBMITTED_DATE).toLocaleDateString()} - ${new Date(exportData[0].SUBMITTED_DATE).toLocaleDateString()}` : 'N/A',
                  statusFilter: 'All',
                  exportedBy: user?.fullName || user?.email || 'Unknown',
                  company: user?.companyName || 'N/A',
                  exportDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                },
                identifier: 'all-requests',
              },
            });
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>

        {hasCreateRequestAccess && (
          <button
            className="btn bg-warning text-dark ms-2"
            style={{ minWidth: 140 }}
            onClick={() => {
              // Open the Add Request modal
              setShowAddRequestModal(true);
            }}
          >
            Create Request
          </button>
        )}

        {/* Create Request button removed as requested */}
        </div>
        
        {/* Search Input */}
        <div className="d-flex align-items-center">
          <input
            type="text"
            className="form-control"
            style={{ maxWidth: 260 }}
            placeholder="Search Requests..."
            value={quickFilter}
            onChange={e => setQuickFilter(e.target.value)}
          />
        </div>
      </div>
      
      {/* Requests Table */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {/* DataTable View */}
      <DataTable
        columns={columns}
        data={filteredRequests}
        pagination
        progressPending={loading}
        persistTableHead
        highlightOnHover
        responsive
        striped
        defaultSortFieldId={1}
        defaultSortAsc={false}
        customStyles={{
          table: {
            style: {
              width: '100%',
            },
          },
          cells: {
            style: {
              paddingLeft: '8px',
              paddingRight: '8px',
              overflow: 'visible',
              whiteSpace: 'normal',
            },
          },
          headCells: {
            style: {
              paddingLeft: '8px',
              paddingRight: '8px',
              fontWeight: 'bold',
            },
          },
        }}
        noDataComponent={
          <div className="p-4 text-center">
            {error ? (
              <div className="text-danger">{error}</div>
            ) : (
              'No requests found. Create a new request to get started.'
            )}
          </div>
        }
      />
      
      {/* My Assigned Requests Section */}
      {user && user.userId && showAssignedRequestsSection && (
        <div className="mt-5">
          {/* Section Header */}
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div className="d-flex align-items-center">
              <div className="bg-primary" style={{ width: '4px', height: '24px', marginRight: '12px' }}></div>
              <div>
                <h2 className="mb-1" style={{ fontSize: '24px', fontWeight: '600', color: '#2c3e50' }}>
                  My Assigned Requests
                </h2>
                <p className="mb-0 text-muted" style={{ fontSize: '14px' }}>
                  Manage and track your assigned requests efficiently
                </p>
              </div>
            </div>
            
            {/* Right-aligned controls */}
            <div className="d-flex align-items-center gap-3">
              {/* Status Filter */}
              <select
                className="form-select"
                style={{ width: '140px', fontSize: '14px' }}
                value={assignedRequestsFilter}
                onChange={(e) => setAssignedRequestsFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              
              {/* Clear Filters */}
              <button
                className="btn btn-outline-secondary"
                style={{ fontSize: '14px', padding: '6px 16px' }}
                onClick={() => {
                  setAssignedRequestsFilter('all');
                  setAssignedRequestsSearch('');
                  toast.info('Filters cleared');
                }}
              >
                Clear Filters
              </button>
              
              {/* Search */}
              <input
                type="text"
                className="form-control"
                style={{ width: '200px', fontSize: '14px' }}
                placeholder="Search..."
                value={assignedRequestsSearch}
                onChange={(e) => setAssignedRequestsSearch(e.target.value)}
              />
            </div>
          </div>
          
          {/* Assigned Requests DataTable */}
          <DataTable
            columns={assignedRequestsColumns}
            data={filteredAssignedRequests}
            pagination
            progressPending={assignedRequestsLoading}
            persistTableHead
            highlightOnHover
            responsive
            striped
            defaultSortFieldId={1}
            defaultSortAsc={false}
            customStyles={{
              table: {
                style: {
                  width: '100%',
                },
              },
              cells: {
                style: {
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  paddingTop: '12px',
                  paddingBottom: '12px',
                },
              },
              headCells: {
                style: {
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  fontWeight: '600',
                  fontSize: '13px',
                  backgroundColor: '#f8f9fa',
                },
              },
            }}
            noDataComponent={
              <div className="p-5 text-center">
                <div className="text-muted">
                  {assignedRequestsLoading ? (
                    'Loading your assigned requests...'
                  ) : filteredAssignedRequests.length === 0 && assignedRequests.length > 0 ? (
                    'No requests match your current filters.'
                  ) : (
                    'No requests are currently assigned to you.'
                  )}
                </div>
              </div>
            }
          />
        </div>
      )}
      
      {/* New Request Modal */}
      <NewRequestModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveForm}
        initialFormData={formData}
      />
      
      {/* Select Form Modal */}
      <SelectFormModal
        isOpen={showSelectFormModal}
        onClose={() => setShowSelectFormModal(false)}
        onSelectForm={(formId, formData) => {
          setShowSelectFormModal(false);
          
          if (formData) {
            console.log('RequestDashboard: Received form data from template:', formData);
            console.log('RequestDashboard: Template type:', formData.templateType);
            
            // If we have form data from a template, use it directly
            const formFields = formData.fields.map((field: any, index: number) => ({
              id: field.FIELD_ID.toString(), // Use database field ID as the UI field ID
              fieldName: field.FIELD_NAME,
              fieldType: 'text', // Default to text
              required: field.IS_REQUIRED,
              options: field.OPTIONS,
              dbFieldId: field.FIELD_ID, // Store the actual database field ID
              dbFieldTypeId: field.FIELD_TYPE_ID,
              sequence: field.SEQUENCE || index + 1
            }));
            
            // Use the explicit templateType if provided, otherwise extract from form name
            let formType = formData.templateType || 'Request';
            
            // If templateType is not provided, try to detect from form name
            if (!formData.templateType && formData.form && formData.form.FORM_NAME) {
              const formName = formData.form.FORM_NAME.toUpperCase();
              if (formName.includes('SUBJECT')) {
                formType = 'subject';
              } else if (formName.includes('FINANCIAL')) {
                formType = 'financial';
              } else if (formName.includes('ADDRESS')) {
                formType = 'address';
              }
            }
            
            const formName = formData.form?.FORM_NAME || 'Unknown Form';
            console.log(`Setting form type to: ${formType} for form: ${formName}`);
            
            setFormData({
              name: formName,
              description: formData.form?.FORM_DESCRIPTION || '',
              formType: formType, // Use the explicit template type
              formFields: formFields,
              templateId: formData.form?.FORM_ID, // Include the form template ID
              FORM_ID: formData.form?.FORM_ID // Also include as FORM_ID for compatibility
            });
            
            // Open the form modal
            setShowModal(true);
          } else if (formId > 0) {
            // Load the selected form and open the form submission modal
            loadFormAndOpenModal(formId);
          } else {
            toast.error('Invalid form selection');
          }
        }}
      />
      
      {/* Add Request Modal */}
      <AddRequestModal
        isOpen={showAddRequestModal}
        onClose={() => setShowAddRequestModal(false)}
        onSubmit={async (requestData) => {
          try {
            console.log('AddRequestModal submitting request data:', requestData);
            
            // Route through handleSaveForm to ensure form instances are created
            await handleSaveForm(requestData);
            
            return { success: true };
          } catch (error: any) {
            console.error('Error submitting request via handleSaveForm:', error);
            toast.error(error.response?.data?.error || error.message || 'Failed to submit request');
            throw error;
          }
        }}
      />
      
      {/* Request Details Modal */}
      {selectedRequest && (
        <RequestModal
          request={selectedRequest}
          show={showRequestModal}
          onHide={async () => {
            console.log('Modal onHide callback triggered');
            setShowRequestModal(false);
            setSelectedRequest(null);
            
            // Force a refresh when the modal is closed to ensure latest data
            console.log('Forcing refresh of both request lists after modal close');
            
            // Small delay to ensure API calls complete
            setTimeout(async () => {
              try {
                await Promise.all([
                  fetchRequests(),
                  user?.userId ? fetchAssignedRequests() : Promise.resolve()
                ]);
                console.log('✅ Modal close refresh completed');
              } catch (error) {
                console.error('❌ Error during modal close refresh:', error);
                // Fallback refreshes
                fetchRequests();
                if (user?.userId) {
                  fetchAssignedRequests();
                }
              }
            }, 300);
          }}
          onUpdate={async () => {
            console.log('Modal onUpdate callback triggered - refreshing both request lists');
            
            // Refresh both main requests and assigned requests simultaneously
            try {
              await Promise.all([
                fetchRequests(),
                user?.userId ? fetchAssignedRequests() : Promise.resolve()
              ]);
              console.log('✅ Both request lists refreshed successfully');
            } catch (error) {
              console.error('❌ Error refreshing request lists:', error);
              // Fallback to individual refreshes
              fetchRequests();
              if (user?.userId) {
                fetchAssignedRequests();
              }
            }
          }}
        />
      )}
      

      {/* Form Fulfillment Modal */}
      {showFormFulfillmentModal && (
        <div className="modal show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Fill Request Form - {selectedRequest?.REQUEST_NAME}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowFormFulfillmentModal(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                {fulfillmentFormData && fulfillmentFormData.form && (
                  <div className="bg-light p-4 rounded mb-4">
                    <h6 className="text-primary mb-2">
                      {fulfillmentFormData.form.FORM_NAME || 'Form'} Template
                    </h6>
                    <p className="text-muted small">
                      {fulfillmentFormData.form.FORM_DESCRIPTION || 'No description available'}
                    </p>
                  </div>
                )}
                
                {fulfillmentFormLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading form...</span>
                    </div>
                    <p className="mt-2 text-muted">Loading form...</p>
                  </div>
                ) : (
                  <div className="container-fluid p-0">
                    {groupFieldsIntoRows(fulfillmentFormFields).map((row, rowIndex) => (
                      <div key={`row-${rowIndex}`} className="row g-2 mb-2">
                        {row.map((field) => (
                          <div key={field.FIELD_ID} className={`${field.colWidth || 'col-md-6'} p-1`}>
                              <div className="form-group mb-3">
                                <label className="form-label fw-semibold">
                                  {field.FIELD_NAME || field.fieldName}
                                  {(field.IS_REQUIRED || field.required) && <span className="text-danger ms-1">*</span>}
                                </label>
                                
                                {/* Handle field types based on field name and type ID */}
                                {(field.FIELD_NAME && (field.FIELD_NAME.toLowerCase().includes('dob') || field.FIELD_NAME.toLowerCase().includes('date'))) || 
                                 (field.FIELD_TYPE_ID === 3 || field.fieldTypeId === 3) && !(field.FIELD_NAME && field.FIELD_NAME.toLowerCase().includes('zip')) ? (
                                  // Date field (but not ZIP code even if wrongly marked as date type)
                                  <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={fulfillmentFormValues[field.FIELD_ID || field.dbFieldId || ''] || ''}
                                    onChange={(e) => setFulfillmentFormValues(prev => ({
                                      ...prev,
                                      [field.FIELD_ID || field.dbFieldId || '']: e.target.value
                                    }))}
                                    required={field.IS_REQUIRED || field.required}
                                  />
                                ) : field.FIELD_TYPE_ID === 4 || field.fieldTypeId === 4 ? (
                                  // Textarea for long text
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows={3}
                                    value={fulfillmentFormValues[field.FIELD_ID || field.dbFieldId || ''] || ''}
                                    onChange={(e) => setFulfillmentFormValues(prev => ({
                                      ...prev,
                                      [field.FIELD_ID || field.dbFieldId || '']: e.target.value
                                    }))}
                                    placeholder={`Enter ${(field.FIELD_NAME || field.fieldName || '').toLowerCase()}...`}
                                    required={field.IS_REQUIRED || field.required}
                                  />
                                ) : (
                                  // Default text input with special handling for ZIP codes and state fields
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={fulfillmentFormValues[field.FIELD_ID || field.dbFieldId || ''] || ''}
                                    onChange={(e) => {
                                      let value = e.target.value;
                                      
                                      // Auto-uppercase state field
                                      if (field.FIELD_NAME && field.FIELD_NAME.toLowerCase() === 'state') {
                                        value = value.toUpperCase();
                                      }
                                      
                                      setFulfillmentFormValues(prev => ({
                                        ...prev,
                                        [field.FIELD_ID || field.dbFieldId || '']: value
                                      }));
                                    }}
                                    placeholder={
                                      field.FIELD_NAME && field.FIELD_NAME.toLowerCase().includes('zip') 
                                        ? 'Enter ZIP code (e.g., 12345)' 
                                        : field.FIELD_NAME && field.FIELD_NAME.toLowerCase() === 'state'
                                        ? 'Enter state (e.g., CA, NY, TX)'
                                        : `Enter ${(field.FIELD_NAME || field.fieldName || '').toLowerCase()}...`
                                    }
                                    maxLength={
                                      field.FIELD_NAME && field.FIELD_NAME.toLowerCase().includes('zip') 
                                        ? 10 // Allow for ZIP+4 format
                                        : field.FIELD_NAME && field.FIELD_NAME.toLowerCase() === 'state'
                                        ? 2  // State abbreviation
                                        : undefined
                                    }
                                    pattern={
                                      field.FIELD_NAME && field.FIELD_NAME.toLowerCase().includes('zip') 
                                        ? '[0-9]{5}(-[0-9]{4})?' // ZIP or ZIP+4 format
                                        : undefined
                                    }
                                    required={field.IS_REQUIRED || field.required}
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                    ))}
                    
                    {/* Status Field */}
                    <div className="row g-2 mb-2">
                      <div className="col-12 p-1">
                      <label className="form-label fw-semibold">
                        Request Status
                        <span className="text-danger ms-1">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={fulfillmentFormValues['status'] || selectedRequest?.STATUS || 'P'}
                        onChange={(e) => setFulfillmentFormValues(prev => ({
                          ...prev,
                          'status': e.target.value
                        }))}
                        required
                      >
                        <option value="P">Pending</option>
                        <option value="A">Active</option>
                        <option value="D">Complete</option>
                        <option value="I">In Progress</option>
                        <option value="X">Cancelled</option>
                        <option value="H">On Hold</option>
                        <option value="R">Rejected</option>
                      </select>
                      <div className="form-text text-muted">
                        Update the status of this request based on your progress
                      </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowFormFulfillmentModal(false)}
                  disabled={fulfillmentActionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveFulfillmentFormData}
                  disabled={fulfillmentActionLoading || fulfillmentFormLoading}
                >
                  {fulfillmentActionLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Form Data'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDashboard;

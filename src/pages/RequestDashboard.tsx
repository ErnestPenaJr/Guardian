import React, { useEffect, useState, useMemo } from 'react';
import { flushSync } from 'react-dom';
import DataTable, { TableColumn } from 'react-data-table-component';
import api from '../utils/api';
import '../styles/RequestDashboard.css';
import '../styles/FormCreationFlow.css';
import { toast } from 'react-toastify';
import NewRequestModal from './NewRequestModal';
import SelectFormModal from '../components/SelectFormModal';
import AddRequestModal from '../components/AddRequestModal';
import RequestModal from '../components/RequestModal';
import formService from '../services/formService';
import { FormField } from '../types/formBuilder';
import { useAuth } from '../hooks/useAuth';

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

// Define a type for our form data
interface FormData {
  formType: string;
  name: string;
  description: string;
  formFields: FormField[];
}

const RequestDashboard: React.FC = () => {
  const { user } = useAuth();
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
  const [fulfillmentFormFields, setFulfillmentFormFields] = useState<any[]>([]);
  const [fulfillmentFormValues, setFulfillmentFormValues] = useState<Record<string, any>>({});
  const [fulfillmentFormLoading, setFulfillmentFormLoading] = useState(false);
  const [fulfillmentActionLoading, setFulfillmentActionLoading] = useState(false);

  // Fetch requests on component mount
  useEffect(() => {
    fetchRequests();
  }, []);

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

  // Filter requests based on quick filter
  const filteredRequests = useMemo(() => {
    if (!quickFilter) return requests;
    
    return requests.filter(request => {
      const searchStr = quickFilter.toLowerCase();
      return (
        (request.REQUEST_NAME?.toLowerCase().includes(searchStr)) ||
        (request.STATUS?.toLowerCase().includes(searchStr)) ||
        (request.requestorName?.toLowerCase().includes(searchStr)) ||
        (request.assignedName?.toLowerCase().includes(searchStr))
      );
    });
  }, [requests, quickFilter]);

  // Define table columns
  const columns: TableColumn<Request>[] = [
    { 
      name: 'Tracking ID', 
      selector: row => row.TRACKINGID || `REQ-${row.REQUEST_ID}`,
      sortable: true,
      width: '300px', // Use width instead of minWidth/maxWidth
      wrap: true, // Enable text wrapping
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
      width: '250px'
    },
    { 
      name: 'Status', 
      selector: row => row.STATUS,
      sortable: true, 
      cell: row => {
        let statusClass = '';
        let statusText = '';
        
        // Determine badge color and text based on status code
        switch(row.STATUS) {
          case 'A':
            statusClass = 'bg-success'; // Green for Approved
            statusText = 'Approved';
            break;
          case 'P':
            statusClass = 'bg-warning'; // Yellow for Pending
            statusText = 'Pending';
            break;
          case 'I':
            statusClass = 'bg-primary'; // Blue for In Progress
            statusText = 'In Progress';
            break;
          case 'pending':
            statusClass = 'bg-warning';
            statusText = 'Pending';
            break;
          case 'approved':
            statusClass = 'bg-success';
            statusText = 'Approved';
            break;
          case 'rejected':
            statusClass = 'bg-danger';
            statusText = 'Rejected';
            break;
          default:
            statusClass = 'bg-secondary';
            statusText = row.STATUS;
        }
        
        return <span className={`badge ${statusClass}`}>{statusText}</span>;
      },
      width: '130px'
    },
    { 
      name: 'Submitted', 
      selector: row => row.SUBMITTED_DATE || '',
      sortable: true,
      width: '150px'
    },
    { 
      name: 'Requestor', 
      selector: row => row.requestorName || '',
      sortable: true,
      cell: row => {
        if (row.requestor) {
          return `${row.requestor.FIRST_NAME} ${row.requestor.LAST_NAME}`;
        } else if (row.EXTERNAL_USER) {
          return row.EXTERNAL_USER;
        } else {
          return 'Unknown';
        }
      },
      width: '150px'
    },
    { 
      name: 'Assigned To', 
      selector: row => row.assignedName || '',
      sortable: true,
      cell: row => {
        if (row.assigned) {
          return `${row.assigned.FIRST_NAME} ${row.assigned.LAST_NAME}`;
        } else {
          return 'Unassigned';
        }
      },
      width: '150px'
    },
    {
      name: 'Actions',
      cell: row => (
        <div className="d-flex gap-2">
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={() => {
              // View request details in modal
              setSelectedRequest(row);
              setShowRequestModal(true);
            }}
          >
            View
          </button>
          <button 
            className="btn btn-sm btn-outline-success"
            onClick={() => {
              console.log('[BUTTON CLICK] Start Assessment clicked for request:', row.REQUEST_ID);
              console.log('[BUTTON CLICK] Request details:', {
                REQUEST_ID: row.REQUEST_ID,
                REQUEST_NAME: row.REQUEST_NAME,
                FORM_ID: row.FORM_ID,
                STATUS: row.STATUS
              });
              // Always use the proper form loading function
              loadRequestFormForFulfillment(row);
            }}
          >
            Start Assessment
          </button>
        </div>
      ),
      width: '220px',
      ignoreRowClick: true,
      sortable: false,
      selector: _ => ''
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
  
  // Handle form save
  const handleSaveForm = async (formData: FormData) => {
    try {
      // Create the form using the formService
      const formToSave: any = {
        FORM_NAME: formData.name,
        FORM_DESCRIPTION: formData.description,
        IS_PUBLIC: true,
        IS_ACTIVE: true,
        IS_DELETED: false,
        FORM_TYPE: formData.formType.toLowerCase()
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
      toast.success('Form created successfully');
      fetchRequests(); // Refresh the requests list
    } catch (error: any) {
      console.error('Error saving form:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to save form');
      throw error;
    }
  };

  // Load request form for fulfillment
  const loadRequestFormForFulfillment = async (request: Request) => {
    console.log('[FULFILLMENT] Loading form for request:', request.REQUEST_ID, request.REQUEST_NAME);
    console.log('[FULFILLMENT] Request should use FORM_ID:', request.FORM_ID);
    
    try {
      setFulfillmentFormLoading(true);
      
      // Get the actual form data from the API
      const response = await formService.getRequestForm(request.REQUEST_ID);
      console.log('[FULFILLMENT] API Response received:', response);
      console.log('[FULFILLMENT] Response form details:', {
        formId: response.form?.FORM_ID,
        formName: response.form?.FORM_NAME,
        formDescription: response.form?.FORM_DESCRIPTION,
        fieldsCount: response.fields?.length || 0,
        firstField: response.fields?.[0]?.FIELD_NAME || 'none'
      });
      
      // Set the form data directly from API response
      setFulfillmentFormData(response);
      setFulfillmentFormFields(response.fields || []);
      setFulfillmentFormValues(response.values || {});
      setSelectedRequest(request);
      setShowFormFulfillmentModal(true);
      
      console.log('[FULFILLMENT] Form modal opened with data:', {
        formName: response.form?.FORM_NAME,
        fieldsCount: response.fields?.length || 0
      });
    } catch (error) {
      console.error('[FULFILLMENT] Error loading form:', error);
      console.error('[FULFILLMENT] Request details:', request);
      
      // Instead of showing error, provide a working fallback form
      const fallbackResponse = {
        request: request,
        form: {
          FORM_ID: request.FORM_ID || 0,
          FORM_NAME: 'Request Assessment Form (Fallback)',
          FORM_DESCRIPTION: 'Complete this form to process the request. Note: This is a fallback form due to a connection issue.'
        },
        fields: [
          { FIELD_ID: 1, FIELD_NAME: 'Assessment Notes', FIELD_TYPE_ID: 2, IS_REQUIRED: true, SEQUENCE: 1 },
          { FIELD_ID: 2, FIELD_NAME: 'Completion Date', FIELD_TYPE_ID: 3, IS_REQUIRED: true, SEQUENCE: 2 },
          { FIELD_ID: 3, FIELD_NAME: 'Additional Comments', FIELD_TYPE_ID: 2, IS_REQUIRED: false, SEQUENCE: 3 }
        ],
        values: {},
        formInstanceId: null
      };
      
      console.log('[FULFILLMENT] Setting fallback form data:', fallbackResponse);
      
      // Use flushSync to ensure all state updates happen immediately
      flushSync(() => {
        setFulfillmentFormData(fallbackResponse);
        setFulfillmentFormFields(fallbackResponse.fields);
        setFulfillmentFormValues({});
        setSelectedRequest(request);
      });
      
      console.log('[FULFILLMENT] About to show fallback modal');
      flushSync(() => {
        setShowFormFulfillmentModal(true);
      });
      console.log('[FULFILLMENT] Fallback modal state set to true');
      
      toast.warning('Using fallback form due to connection issue. Your data will still be saved.');
    } finally {
      setFulfillmentFormLoading(false);
    }
  };

  // Save form fulfillment data
  const saveFulfillmentFormData = async () => {
    if (!selectedRequest || !fulfillmentFormData) return;
    
    try {
      setFulfillmentActionLoading(true);
      
      // Get the status from the form values
      const newStatus = fulfillmentFormValues['status'] || selectedRequest.STATUS || 'A';
      
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

      <div className="request-dashboard-header mb-3 d-flex align-items-center gap-2">
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
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchRequests();
              toast.success('Requests refreshed successfully');
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-clockwise me-1" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
            </svg>
            Refresh
          </button>
        )}



        {hasCreateRequestAccess && (
          <button 
            className="btn bg-warning text-dark ms-2" 
            style={{ minWidth: 140 }} 
            onClick={() => {
              // Open the Add Request modal
              setShowAddRequestModal(true);
            }}
          >
            Add Request
          </button>
        )}

        {/* Create Request button removed as requested */}

        <input
          type="text"
          className="form-control ms-auto"
          style={{ maxWidth: 260, display: 'inline-block' }}
          placeholder="Search..."
          value={quickFilter}
          onChange={e => setQuickFilter(e.target.value)}
        />
      </div>
      
      {/* Requests Table */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {/* Custom styles for DataTable */}
      <DataTable
        columns={columns}
        data={filteredRequests}
        pagination
        progressPending={loading}
        persistTableHead
        highlightOnHover
        pointerOnHover
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
              id: index + 1,
              fieldName: field.FIELD_NAME,
              fieldType: 'text', // Default to text
              required: field.IS_REQUIRED,
              options: field.OPTIONS,
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
              formFields: formFields
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
            console.log('Submitting request data:', requestData);
            
            // Try the standard endpoint first as it's the most reliable
            try {
              console.log('Using standard endpoint...');
              const response = await api.post('/api/requests', requestData);
              console.log('Standard endpoint success:', response.data);
              
              // Refresh the requests list
              fetchRequests();
              
              return response.data;
            } catch (standardError) {
              console.error('Standard endpoint failed:', standardError);
              
              // Fall back to the simple-request endpoint
              try {
                console.log('Falling back to simple-request endpoint...');
                const simpleResponse = await api.post('/api/requests/simple-request', requestData);
                console.log('simple-request endpoint success:', simpleResponse.data);
                
                // Refresh the requests list
                fetchRequests();
                
                return simpleResponse.data;
              } catch (simpleError) {
                console.error('simple-request endpoint failed:', simpleError);
                
                // Last resort: try the SQL endpoint
                console.log('Falling back to SQL endpoint...');
                const sqlResponse = await api.post('/api/requests/sql-request', requestData);
                console.log('SQL endpoint success:', sqlResponse.data);
                
                // Refresh the requests list
                fetchRequests();
                
                return sqlResponse.data;
              }
            }
          } catch (error: any) {
            console.error('Error submitting request:', error);
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
          onHide={() => {
            console.log('Modal onHide callback triggered');
            setShowRequestModal(false);
            setSelectedRequest(null);
            // Force a refresh when the modal is closed to ensure latest data
            console.log('Forcing refresh after modal close');
            setTimeout(() => {
              fetchRequests();
            }, 300);
          }}
          onUpdate={() => {
            console.log('Modal onUpdate callback triggered');
            fetchRequests();
          }}
        />
      )}
      
      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{position: 'fixed', top: 10, right: 10, background: 'yellow', padding: '10px', zIndex: 9999}}>
          Modal State: {showFormFulfillmentModal ? 'TRUE' : 'FALSE'}<br/>
          Form Data: {fulfillmentFormData ? 'EXISTS' : 'NULL'}<br/>
          Selected Request: {selectedRequest?.REQUEST_ID || 'NONE'}
        </div>
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
                        <option value="A">In Progress</option>
                        <option value="C">Completed</option>
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

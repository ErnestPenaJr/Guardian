import React, { useEffect, useState, useMemo } from 'react';
import DataTable, { TableColumn } from 'react-data-table-component';
import api from '../utils/api';
import '../styles/RequestDashboard.css';
import '../styles/FormCreationFlow.css';
import { toast } from 'react-toastify';
import NewRequestModal from './NewRequestModal';
import SelectFormModal from '../components/SelectFormModal';
import formService from '../services/formService';
import { FormField } from '../types/formBuilder';

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
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSelectFormModal, setShowSelectFormModal] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  // Fetch requests on component mount
  useEffect(() => {
    fetchRequests();
  }, []);

  // Fetch requests from the API
  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/requests');
      setRequests(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch requests');
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
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
      name: 'Request ID', 
      selector: row => row.REQUEST_ID,
      sortable: true,
      width: '120px'
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
        switch(row.STATUS?.toLowerCase()) {
          case 'pending':
            statusClass = 'bg-warning';
            break;
          case 'approved':
            statusClass = 'bg-success';
            break;
          case 'rejected':
            statusClass = 'bg-danger';
            break;
          default:
            statusClass = 'bg-secondary';
        }
        return <span className={`badge ${statusClass}`}>{row.STATUS}</span>;
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
              // View request details
              window.location.href = `/request/${row.REQUEST_ID}`;
            }}
          >
            View
          </button>
        </div>
      ),
      width: '120px',
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
        
        // Set form data
        setFormData({
          name: formTemplate.form.FORM_NAME,
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

  return (
    <div className="container">
      <h1 className="text-2xl font-bold uppercase fs-2 mb-8">Request Dashboard</h1>
      
      <div className="request-dashboard-header mb-3 d-flex align-items-center gap-2">
        <button 
          className="btn btn-primary ms-3" 
          style={{ minWidth: 140 }} 
          onClick={() => setShowSelectFormModal(true)}
        >
          + Create Request
        </button>
        
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
            <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg>
          Refresh
        </button>
        
        <input
          type="text"
          className="form-control ms-auto"
          style={{ maxWidth: 260, display: 'inline-block' }}
          placeholder="Search..."
          value={quickFilter}
          onChange={e => setQuickFilter(e.target.value)}
        />
      </div>
      
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
            
            setFormData({
              name: formData.form.FORM_NAME,
              description: formData.form.FORM_DESCRIPTION || '',
              formType: 'Request', // Default to request type
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
      
      {/* Requests Table */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
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
      />
    </div>
  );
};

export default RequestDashboard;

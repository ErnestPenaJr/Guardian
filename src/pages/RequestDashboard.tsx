import React, { useEffect, useState, useMemo } from 'react';
import DataTable, { TableColumn } from 'react-data-table-component';
import api from '../utils/api';
import '../styles/RequestDashboard.css';
import '../styles/FormBuilder.css';
import Modal from 'react-modal';
import { FaTrash } from 'react-icons/fa';
import FormBuilder from '../components/FormBuilder';
import { FormField, FormData } from '../types/formBuilder';
import formService from '../services/formService';
import { toast } from 'react-toastify';

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
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [savingForm, setSavingForm] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Request[]>([]);
  const [toggleCleared, setToggleCleared] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    description: '',
    availableToExternal: false,
    active: false,
    workflow: '',
    workflowLevels: [
      { fieldName: '', approvalType: '', approverList: '' }
    ],
    formFields: [
      { id: `field-${Date.now()}`, fieldName: 'Request Title', fieldType: 'text', required: true, options: '' }
    ] as FormField[]
  });

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get('/requests');
        setRequests(data);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to fetch requests');
      }
      setLoading(false);
    };
    fetchRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    if (!quickFilter) return requests;
    const q = quickFilter.toLowerCase();
    return requests.filter(req =>
      req.REQUEST_NAME?.toLowerCase().includes(q) ||
      req.STATUS?.toLowerCase().includes(q) ||
      (req.EXTERNAL_USER?.toLowerCase().includes(q) ?? false) ||
      (req.TRACKINGID?.toLowerCase().includes(q) ?? false)
    );
  }, [quickFilter, requests]);

  // Add a status map for label and color
  const statusMap: Record<string, { label: string; color: string }> = {
    'A': { label: 'Open', color: 'secondary' },
    'Open': { label: 'Open', color: 'secondary' },
    'P': { label: 'In Progress', color: 'primary' },
    'In Progress': { label: 'In Progress', color: 'primary' },
    'C': { label: 'Closed', color: 'secondary' },
    'Closed': { label: 'Closed', color: 'secondary' },
    'D': { label: 'Denied', color: 'danger' },
    'Denied': { label: 'Denied', color: 'danger' },
    'AP': { label: 'Approved', color: 'success' },
    'Approved': { label: 'Approved', color: 'success' },
  };

  const columns: TableColumn<Request>[] = [
    { name: 'Tracking ID', selector: (row: Request) => row.TRACKINGID ?? '-', sortable: true, width: '140px' },
    { name: 'Name', selector: (row: Request) => row.REQUEST_NAME, sortable: true },
    { 
      name: 'Status', 
      selector: (row: Request) => row.STATUS, 
      sortable: true, 
      cell: (row: Request) => {
        const status = statusMap[row.STATUS] || { label: row.STATUS, color: 'secondary' };
        const textColor = ['secondary', 'primary', 'danger'].includes(status.color) ? 'text-white' : 'text-dark';
        return (
          <div
            className={`bg-${status.color} ${textColor}`}
            style={{ minWidth: 90, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, padding: '4px 0' }}
          >
            {status.label}
          </div>
        );
      },
      width: '130px'
    },
    { 
      name: 'Submitted', 
      selector: (row: Request) => row.SUBMITTED_DATE ? new Date(row.SUBMITTED_DATE).toLocaleString([], { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-', 
      sortable: true,
      width: '150px'
    },
    { 
      name: 'Requestor', 
      selector: (row: Request) => row.REQUESTOR_ID?.toString() ?? '-', 
      sortable: true,
      cell: (row: Request) => {
        if (row.requestor) {
          return `${row.requestor.FIRST_NAME} ${row.requestor.LAST_NAME}`;
        } else if (row.FIRST_NAME && row.LAST_NAME) {
          return `${row.FIRST_NAME} ${row.LAST_NAME}`;
        } else if (row.requestorName) {
          return row.requestorName;
        } else if (row.EXTERNAL_USER) {
          return row.EXTERNAL_USER;
        }
        return 'N/A';
      },
      width: '150px'
    },
    { 
      name: 'Assigned To', 
      selector: (row: Request) => row.ASSIGNED_ID?.toString() ?? '-', 
      sortable: true,
      cell: (row: Request) => {
        if (row.assigned) {
          return `${row.assigned.FIRST_NAME} ${row.assigned.LAST_NAME}`;
        } else if (row.assignedName) {
          return row.assignedName;
        }
        return 'Unassigned';
      },
      width: '150px'
    },
    {
      name: 'Actions',
      cell: (row: Request) => (
        <div style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button 
            className="btn btn-sm btn-outline-primary"
            style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => {
              console.log('Edit request', row.REQUEST_ID);
              // Add edit functionality here
            }}
            title="Edit Request"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pencil" viewBox="0 0 16 16">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
            <span style={{ marginLeft: 4 }}>Edit</span>
          </button>
        </div>
      ),
      width: '120px',
      ignoreRowClick: true,
      sortable: false,
      selector: (_: Request) => ''
    }
  ];

  const nextStep = () => setFormStep(s => Math.min(s + 1, 3));
  const prevStep = () => setFormStep(s => Math.max(s - 1, 0));

  // Handle form fields update from the FormBuilder component
  const handleFormFieldsChange = (fields: FormField[]) => {
    setFormData(prev => ({
      ...prev,
      formFields: fields
    }));
  };

  // Save the form to the database
  const saveForm = async () => {
    try {
      setSavingForm(true);
      
      // Create form data object that matches our database schema
      const form: FormData = {
        name: formData.name || 'New Request Form',
        description: formData.description || 'Form created with Form Builder',
        isPublic: formData.availableToExternal,
        isActive: formData.active,
        fields: formData.formFields
      };
      
      // Convert form fields to database format
      const dbFields = formService.convertFormFieldsToDbFields(form.fields);
      
      // Create the form in the database
      const dbForm = {
        FORM_NAME: form.name,
        FORM_DESCRIPTION: form.description,
        IS_PUBLIC: form.isPublic,
        IS_ACTIVE: form.isActive,
        IS_DELETED: false
      };
      
      // Save the form
      await formService.createForm(dbForm, dbFields);
      
      // Show success message
      toast.success('Form saved successfully!');
      
      // Close the modal
      closeModal();
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form. Please try again.');
    } finally {
      setSavingForm(false);
    }
  };

  // Close modal and clear fields
  const closeModal = () => {
    setShowModal(false);
    // Reset form data
    setFormData({
      name: '',
      abbreviation: '',
      description: '',
      availableToExternal: false,
      active: false,
      workflow: '',
      workflowLevels: [
        { fieldName: '', approvalType: '', approverList: '' }
      ],
      formFields: [
        { id: `field-${Date.now()}`, fieldName: 'Request Title', fieldType: 'text', required: true, options: '' }
      ] as FormField[]
    });
    setFormStep(0);
  };

  return (
    <div className="container">
      <h1 className="text-2xl font-bold uppercase fs-2 mb-8">Request Dashboard</h1>
      <div className="request-dashboard-header mb-3 d-flex align-items-center gap-2">
        <button className="btn btn-primary ms-3" style={{ minWidth: 140 }} onClick={() => setShowModal(true)}>
          + New Request
        </button>
        <button 
          className="btn btn-outline-secondary ms-2" 
          style={{ minWidth: 100, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          onClick={() => {
            setLoading(true);
            setError(null);
            api.get('/requests')
              .then(({ data }) => {
                setRequests(data);
                setToggleCleared(!toggleCleared);
                toast.success('Requests refreshed successfully');
              })
              .catch(err => {
                setError(err.response?.data?.error || err.message || 'Failed to fetch requests');
                toast.error('Failed to refresh requests');
              })
              .finally(() => {
                setLoading(false);
              });
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
      <Modal
        isOpen={showModal}
        onRequestClose={closeModal}
        contentLabel="New Request"
        ariaHideApp={false}
        className={`modal-content ${formStep === 3 ? 'modal-xl' : 'modal-lg'}`}
        overlayClassName="modal-overlay"
        style={{
          content: {
            width: formStep === 3 ? '95%' : '90%',
            maxWidth: formStep === 3 ? '1400px' : '1200px',
            height: formStep === 3 ? '95%' : '90%',
            maxHeight: '800px',
            margin: 'auto',
            overflow: 'auto',
            padding: '20px'
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          }
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3 className="m-0">New Request</h3>
          <button 
            className="btn-close" 
            onClick={closeModal}
            aria-label="Close"
          ></button>
        </div>
        <div className="stepper mb-3 d-flex gap-2">
          <button 
            className={`step-btn${formStep === 0 ? ' active' : ''}`}
            onClick={() => setFormStep(0)}
          >
            DETAILS
          </button>
          <button 
            className={`step-btn${formStep === 1 ? ' active' : ''}`}
            onClick={() => setFormStep(1)}
          >
            WORKFLOW
          </button>
          <button 
            className={`step-btn${formStep === 2 ? ' active' : ''}`}
            onClick={() => setFormStep(2)}
          >
            WORKFLOW DETAILS
          </button>
          <button 
            className={`step-btn${formStep === 3 ? ' active' : ''}`}
            onClick={() => setFormStep(3)}
          >
            FORM BUILDER
          </button>
        </div>
        <div className="modal-body p-0" style={{ 
          height: 'calc(100% - 150px)', 
          overflowY: 'auto',
          maxHeight: formStep === 3 ? '700px' : '600px'
        }}>
          {formStep === 0 && (
            <div>
              <h4>Fill in your request details</h4>
              <div className="row mb-3">
                <div className="col">
                  <input type="text" className="form-control mb-2" placeholder="Name" value={formData.name} onChange={e => {
                    const name = e.target.value;
                    // Generate abbreviation: first initial of each word
                    const abbreviation = name
                      .split(/\s+/)
                      .filter(Boolean)
                      .map(word => word[0]?.toUpperCase() || '')
                      .join('');
                    setFormData(f => ({ ...f, name, abbreviation }));
                  }} />
                </div>
                <div className="col">
                  <input type="text" className="form-control mb-2" placeholder="Abbreviation" value={formData.abbreviation} onChange={e => setFormData(f => ({ ...f, abbreviation: e.target.value }))} />
                </div>
              </div>
              <textarea className="form-control mb-2" placeholder="Description" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
              <div className="text-end text-secondary description-count" style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                {formData.description.length} / 500
              </div>
              <div className="d-flex gap-4 mt-2">
                <label><input type="checkbox" checked={formData.availableToExternal} onChange={e => setFormData(f => ({ ...f, availableToExternal: e.target.checked }))} /> Available to External Users?</label>
                <label><input type="checkbox" checked={formData.active} onChange={e => setFormData(f => ({ ...f, active: e.target.checked }))} /> Active?</label>
              </div>
            </div>
          )}
          {formStep === 1 && (
            <div>
              <h4>Select the workflow type</h4>
              <div className="d-flex flex-column gap-2 mb-3">
                <label className="workflow-type-item"><input type="radio" name="workflow" value="Processing" checked={formData.workflow === 'Processing'} onChange={e => setFormData(f => ({ ...f, workflow: e.target.value }))} /> Processing - For requests that involve the generation of a work product, it can include an initial approval, but not required.</label>
                <label className="workflow-type-item"><input type="radio" name="workflow" value="Approval" checked={formData.workflow === 'Approval'} onChange={e => setFormData(f => ({ ...f, workflow: e.target.value }))} /> Approval - For requests for approval, can include multiple levels of approval, but does not include a work product being generated.</label>
                <label className="workflow-type-item"><input type="radio" name="workflow" value="Self-Service" checked={formData.workflow === 'Self-Service'} onChange={e => setFormData(f => ({ ...f, workflow: e.target.value }))} /> Self-Service - For requests where the work product is automatically generated or for solely logging the data included within the request.</label>
              </div>
            </div>
          )}
          {formStep === 2 && (
            <div>
              <h4>Define your approval workflow</h4>
              <div className="d-flex gap-2 mb-2 table-header">
                <span>Sequence</span>
                <span>Field Name</span>
                <span>Approval Type</span>
                <span>Approver List</span>
                <span style={{ width: 40 }}></span>
              </div>
              {formData.workflowLevels.map((level, idx) => (
                <div className="d-flex gap-2 mb-2" key={idx}>
                  <span style={{ width: 32, textAlign: 'center', lineHeight: '38px' }}>{idx + 1}</span>
                  <input type="text" className="form-control" style={{ width: 100 }} value={level.fieldName} onChange={e => {
                    const newLevels = [...formData.workflowLevels];
                    newLevels[idx].fieldName = e.target.value;
                    setFormData(f => ({ ...f, workflowLevels: newLevels }));
                  }} />
                  <select className="form-select" style={{ width: 180 }} value={level.approvalType} onChange={e => {
                    const newLevels = [...formData.workflowLevels];
                    newLevels[idx].approvalType = e.target.value;
                    setFormData(f => ({ ...f, workflowLevels: newLevels }));
                  }}>
                    <option value="">Select Type</option>
                    <option value="Pre-Defined Single-Approver">Pre-Defined Single-Approver</option>
                    <option value="Pre-Defined Multiple-Approvers">Pre-Defined Multiple-Approvers</option>
                    <option value="Requestor Defined Single-Approver">Requestor Defined Single-Approver</option>
                  </select>
                  <input type="text" className="form-control" style={{ width: 180 }} value={level.approverList} onChange={e => {
                    const newLevels = [...formData.workflowLevels];
                    newLevels[idx].approverList = e.target.value;
                    setFormData(f => ({ ...f, workflowLevels: newLevels }));
                  }} />
                  {formData.workflowLevels.length > 1 && (
                    <button type="button" className="btn btn-link p-0 ms-1" style={{ height: 38 }} onClick={() => {
                      setFormData(f => ({ ...f, workflowLevels: f.workflowLevels.filter((_, i) => i !== idx) }));
                    }} title="Remove Level">
                      <FaTrash style={{ color: '#e74c3c', fontSize: 18, verticalAlign: 'middle' }} />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex justify-end mb-2">
                <button type="button" className="add-level-link" onClick={() => setFormData(f => ({ ...f, workflowLevels: [...f.workflowLevels, { fieldName: '', approvalType: '', approverList: '' }] }))}>
                  + Add Additional Level
                </button>
              </div>
            </div>
          )}
          {formStep === 3 && (
            <div>
              <div className="form-builder-container">
                <FormBuilder 
                  formFields={formData.formFields} 
                  onChange={handleFormFieldsChange} 
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer d-flex justify-content-between mt-3">
          <button 
            className="btn btn-secondary" 
            onClick={formStep === 0 ? closeModal : prevStep}
            disabled={savingForm}
          >
            {formStep === 0 ? 'Cancel' : 'Back'}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={formStep === 3 ? saveForm : nextStep}
            disabled={savingForm}
          >
            {formStep === 3 ? (savingForm ? 'Saving...' : 'Save') : 'Next'}
          </button>
        </div>
      </Modal>
      <DataTable
        columns={columns}
        data={filteredRequests}
        pagination
        progressPending={loading}
        paginationPerPage={10}
        paginationRowsPerPageOptions={[5, 10, 15, 20, 50]}
        paginationComponentOptions={{
          rowsPerPageText: 'Records per page:',
          rangeSeparatorText: 'of',
        }}
        selectableRows
        selectableRowsHighlight
        onSelectedRowsChange={(state) => {
          console.log('Selected Rows:', state.selectedRows);
          setSelectedRows(state.selectedRows);
        }}
        clearSelectedRows={toggleCleared}
        sortServer={false}
        defaultSortFieldId={1}
        defaultSortAsc={false}
        noDataComponent={
          <div className="text-center p-4">
            {error ? (
              <div className="text-danger">{error}</div>
            ) : (
              <div className="text-muted">No requests found</div>
            )}
          </div>
        }
        customStyles={{
          table: {
            style: {
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            },
          },
          header: {
            style: {
              padding: '0',
            },
          },
          subHeader: {
            style: {
              padding: '0',
            },
          },
          headRow: {
            style: {
              backgroundColor: '#f8fafc',
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderBottomColor: '#e2e8f0',
              color: '#475569',
              fontWeight: 600,
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            },
          },
          headCells: {
            style: {
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: '12px',
            },
          },
          rows: {
            style: {
              backgroundColor: '#ffffff',
              '&:not(:last-of-type)': {
                borderBottomStyle: 'solid',
                borderBottomWidth: '1px',
                borderBottomColor: '#e2e8f0',
              },
              '&:hover': {
                backgroundColor: '#f1f5f9',
                cursor: 'pointer',
              },
            },
            highlightOnHoverStyle: {
              backgroundColor: '#f1f5f9',
            },
          },
          cells: {
            style: {
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: '12px',
            },
          },
          pagination: {
            style: {
              borderTopStyle: 'solid',
              borderTopWidth: '1px',
              borderTopColor: '#e2e8f0',
              backgroundColor: '#f8fafc',
            },
            pageButtonsStyle: {
              color: '#0284c7',
              fill: '#0284c7',
              '&:disabled': {
                color: '#cbd5e1',
                fill: '#cbd5e1',
              },
              '&:hover:not(:disabled)': {
                backgroundColor: '#e0f2fe',
              },
              '&:focus': {
                outline: 'none',
                backgroundColor: '#e0f2fe',
              },
            },
          },
        }}
      />
      
      {selectedRows && selectedRows.length > 0 && (
        <div className="mt-4 p-3 bg-gray-100 rounded-md">
          <div className="flex justify-between items-center">
            <span className="font-medium">{selectedRows.length} request(s) selected</span>
            <div className="flex gap-2">
              <button 
                className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                onClick={() => {
                  console.log('Process selected', selectedRows);
                  // Add processing logic here
                }}
              >
                Process
              </button>
              <button 
                className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                onClick={() => {
                  console.log('Delete selected', selectedRows);
                  // Add delete logic here
                }}
              >
                Delete
              </button>
              <button 
                className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                onClick={() => {
                  setToggleCleared(!toggleCleared);
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDashboard;

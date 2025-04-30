import React, { useEffect, useState, useMemo } from 'react';
import DataTable from 'react-data-table-component';
import api from '../utils/api';
import '../styles/RequestDashboard.css';
import Modal from 'react-modal';
import { FaTrash } from 'react-icons/fa';

interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  EXTERNAL_USER: string | null;
  SUBMITTED_DATE: string;
  REQUESTOR_ID: number | null;
  ASSIGNED_ID: number | null;
  STATUS: string;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  CREATE_USER_ID: number | null;
  UPDATE_USER_ID: number | null;
  TRACKINGID: string | null;
}

const statusColors: Record<string, string> = {
  Approved: 'success', 
  'In Progress': 'primary', 
  Open: 'secondary', 
  Closed: 'secondary', 
  Denied: 'danger', 
  Pending: 'secondary', 
};

const RequestDashboard: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    description: '',
    availableToExternal: false,
    active: false,
    workflow: '',
    workflowLevels: [
      { fieldName: '', approvalType: '', approverList: '' }
    ]
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

  const columns = [
    { name: 'Tracking ID', selector: (row: Request) => row.TRACKINGID ?? '-', sortable: true, width: '140px' },
    { name: 'Name', selector: (row: Request) => row.REQUEST_NAME, sortable: true },
    { 
      name: 'Status', 
      selector: (row: Request) => row.STATUS, 
      sortable: true, 
      cell: row => {
        let normalized = row.STATUS;
        if (row.STATUS === 'A' || row.STATUS === 'Open') normalized = 'Open';
        if (row.STATUS === 'IP' || row.STATUS === 'In Progress') normalized = 'In Progress';
        if (row.STATUS === 'C' || row.STATUS === 'Closed') normalized = 'Closed';
        if (row.STATUS === 'D' || row.STATUS === 'Denied') normalized = 'Denied';
        if (row.STATUS === 'AP' || row.STATUS === 'Approved') normalized = 'Approved';
        return <span className={`badge bg-${statusColors[normalized] || 'secondary'}`}>{normalized}</span>
      } 
    },
    { 
      name: 'Submitted', 
      selector: (row: Request) => row.SUBMITTED_DATE ? new Date(row.SUBMITTED_DATE).toLocaleString([], { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-', 
      sortable: true 
    },
    { name: 'Requestor', selector: (row: Request) => row.REQUESTOR_ID ?? '-', sortable: true },
    { name: 'Assigned', selector: (row: Request) => row.ASSIGNED_ID ?? '-', sortable: true },
    { name: 'Created', selector: (row: Request) => row.CREATE_DATE ? new Date(row.CREATE_DATE).toLocaleString() : '-', sortable: true },
    { name: 'Updated', selector: (row: Request) => row.UPDATE_DATE ? new Date(row.UPDATE_DATE).toLocaleString() : '-', sortable: true },
  ];

  const nextStep = () => setFormStep(s => Math.min(s + 1, 2));
  const prevStep = () => setFormStep(s => Math.max(s - 1, 0));

  // Helper to reset the modal form fields
  const resetForm = () => {
    setFormData({
      name: '',
      abbreviation: '',
      description: '',
      availableToExternal: false,
      active: false,
      workflow: '',
      workflowLevels: [
        { fieldName: '', approvalType: '', approverList: '' }
      ]
    });
    setFormStep(0);
  };

  // Close modal and clear fields
  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="container">
      <h1 className="text-2xl font-bold uppercase fs-2 mb-8">Request Dashboard</h1>
      <div className="request-dashboard-header mb-3 d-flex align-items-center gap-2">
        <button className="btn btn-primary ms-3" style={{ minWidth: 140 }} onClick={() => setShowModal(true)}>
          + New Request
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
        className="modal-content"
        overlayClassName="modal-overlay"
      >
        <div className="stepper mb-4 d-flex gap-2">
          <button className={`step-btn${formStep === 0 ? ' active' : ''}`}>DETAILS</button>
          <button className={`step-btn${formStep === 1 ? ' active' : ''}`}>WORKFLOW</button>
          <button className={`step-btn${formStep === 2 ? ' active' : ''}`}>WORKFLOW DETAILS</button>
        </div>
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
            {/*
            <div className="text-danger mt-2" style={{ fontSize: 13 }}>
              Pre-Defined Single-Approver (Will go to all listed approvers, any can approve)<br />
              Pre-Defined Multiple-Approvers (Will go to all listed approvers, all must approve)<br />
              Requestor Defined Single-Approver (Requestor can select from list of approvers)
            </div>
            */}
          </div>
        )}
        <div className="d-flex justify-content-between mt-4">
          <button className="btn btn-secondary" onClick={formStep === 0 ? closeModal : prevStep}>Previous</button>
          <button className="btn btn-primary" onClick={formStep === 2 ? closeModal : nextStep}>Continue</button>
        </div>
      </Modal>
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <div className="table-responsive">
          <DataTable
            columns={columns}
            data={filteredRequests}
            pagination
            highlightOnHover
            striped
          />
        </div>
      )}
    </div>
  );
};

export default RequestDashboard;

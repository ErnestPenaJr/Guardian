import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import formService from '../services/formService';
import { FaSpinner, FaCheck, FaFileAlt } from 'react-icons/fa';

interface SelectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForm: (formId: number) => void;
}

// Use the DbForm type from formService
import { DbForm } from '../services/formService';

const SelectFormModal: React.FC<SelectFormModalProps> = ({ isOpen, onClose, onSelectForm }) => {
  const [forms, setForms] = useState<DbForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch forms when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchForms();
    }
  }, [isOpen]);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const response = await formService.getAllForms();
      setForms(response);
    } catch (error) {
      console.error('Error fetching forms:', error);
      toast.error('Failed to load form templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectForm = () => {
    if (selectedFormId) {
      onSelectForm(selectedFormId);
    } else {
      toast.warning('Please select a form template');
    }
  };

  // Filter forms based on search term
  const filteredForms = forms.filter(form => 
    form.FORM_NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.FORM_DESCRIPTION || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Select Form Template"
      className="modal-content"
      overlayClassName="modal-overlay"
      style={{
        content: {
          width: '800px',
          maxWidth: '90%',
          margin: 'auto',
          borderRadius: '8px',
          padding: '20px',
          maxHeight: '90vh',
          overflow: 'auto'
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }}
      ariaHideApp={false}
    >
      <div className="modal-header d-flex justify-content-between align-items-center mb-4">
        <h3 className="modal-title m-0">Select Form Template</h3>
        <button type="button" className="btn-close" onClick={onClose}></button>
      </div>
      
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search forms..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {loading ? (
        <div className="text-center py-5">
          <FaSpinner className="fa-spin" size={30} />
          <p className="mt-2">Loading form templates...</p>
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center py-5">
          <p>No form templates found. Please create templates in the Admin Dashboard.</p>
        </div>
      ) : (
        <div className="form-templates-list">
          {filteredForms.map(form => (
            <div 
              key={form.FORM_ID}
              className={`form-template-item p-3 mb-3 border rounded ${selectedFormId === form.FORM_ID ? 'border-primary bg-light' : ''}`}
              onClick={() => setSelectedFormId(form.FORM_ID || 0)}
            >
              <div className="d-flex align-items-center">
                <div className="form-template-icon me-3">
                  <FaFileAlt size={24} className="text-secondary" />
                </div>
                <div className="form-template-details flex-grow-1">
                  <h5 className="mb-1">{form.FORM_NAME}</h5>
                  <p className="text-muted mb-1">{form.FORM_DESCRIPTION || 'No description'}</p>
                  <div className="d-flex align-items-center">
                    <span className="badge bg-info me-2">Form</span>
                    <small className="text-muted">Form Template</small>
                  </div>
                </div>
                {selectedFormId === form.FORM_ID && (
                  <div className="form-template-selected">
                    <FaCheck className="text-success" size={20} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="modal-footer d-flex justify-content-between mt-3">
        <button 
          className="btn btn-secondary" 
          onClick={onClose}
        >
          Cancel
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleSelectForm}
          disabled={!selectedFormId || loading}
        >
          Use Selected Template
        </button>
      </div>
    </Modal>
  );
};

export default SelectFormModal;

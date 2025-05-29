import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import '../styles/Modal.css';
import '../styles/AddRequestModal.css';
import { FaUser, FaMoneyBill, FaHome } from 'react-icons/fa';

// Set the app element for accessibility
Modal.setAppElement('#root');

interface AddRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (requestData: any) => void;
}

const AddRequestModal: React.FC<AddRequestModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [requestName, setRequestName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('SUBJECT');
  
  // Standard form templates
  const standardTemplates = [
    {
      id: 'SUBJECT',
      name: 'SUBJECT',
      description: 'Personal information template',
      icon: <FaUser />,
      fields: 'First Name, Middle Name, Last Name, DOB, SSN'
    },
    {
      id: 'FINANCIAL',
      name: 'FINANCIAL',
      description: 'Banking information template',
      icon: <FaMoneyBill />,
      fields: 'Bank Name, Account #, Routing #'
    },
    {
      id: 'ADDRESS',
      name: 'ADDRESS',
      description: 'Address information template',
      icon: <FaHome />,
      fields: 'Address Line 1, Address Line 2, City, State, ZIP Code'
    }
  ];

  // Set default template when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set SUBJECT as default template
      const defaultTemplate = standardTemplates[0];
      setSelectedTemplate(defaultTemplate.id);
      
      // Reset form fields when modal opens
      setRequestName('');
      setAbbreviation('');
      setDescription('');
    }
  }, [isOpen]);
  
  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (templateId) {
      const template = standardTemplates.find(t => t.id === templateId);
      if (template) {
        toast.info(`Selected template: ${template.name}`);
      }
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!requestName.trim()) {
      toast.error('Request name is required');
      return;
    }
    
    if (!abbreviation.trim()) {
      toast.error('Abbreviation is required');
      return;
    }
    
    if (abbreviation.length > 5) {
      toast.error('Abbreviation must be 5 characters or less');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare request data
      const requestData: any = {
        name: requestName,
        abbreviation,
        description,
        templateId: selectedTemplate
      };
      
      // Call the onSubmit callback with the request data
      await onSubmit(requestData);
      
      // Reset form and close modal
      resetForm();
      
      // Close the modal
      onClose();
      toast.success('Request created successfully!');
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error('Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  };
  
    // Reset form function
  const resetForm = () => {
    setRequestName('');
    setAbbreviation('');
    setDescription('');
    setSelectedTemplate('SUBJECT');
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Add Request Modal"
      className="modal-content"
      overlayClassName="modal-overlay"
      id="AddRequestModal"
    >
      <div className="modal-header">
        <h2 className="modal-title">Add New Request</h2>
        <button 
          type="button" 
          className="btn-close" 
          onClick={onClose} 
          aria-label="Close"
        ></button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="mb-4">
            <label htmlFor="formTemplate" className="form-label">Form Template</label>
            <div 
              className="d-flex flex-column gap-2 template-selection-container" 
              style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                padding: '0.5rem',
                border: '1px solid #dee2e6',
                borderRadius: '0.375rem'
              }}
            >
              {standardTemplates.map(template => (
                <div 
                  key={template.id} 
                  className={`card p-3 cursor-pointer template-card ${selectedTemplate === template.id ? 'border-primary' : 'border'}`}
                  onClick={() => handleTemplateSelect(template.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-center">
                    <div className={`me-3 ${selectedTemplate === template.id ? 'text-primary' : ''}`} style={{ fontSize: '24px' }}>
                      {template.icon}
                    </div>
                    <div>
                      <h5 className="mb-1">{template.name}</h5>
                      <p className="mb-1 text-muted small">{template.fields}</p>
                    </div>
                    <div className="ms-auto">
                      <input 
                        type="radio" 
                        name="templateSelection" 
                        checked={selectedTemplate === template.id}
                        onChange={() => handleTemplateSelect(template.id)}
                        className="form-check-input"
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {/* No Template option removed as requested */}
            </div>
          </div>
          
          <div className="d-flex align-items-end gap-3 mb-3">
            <div style={{ flex: '3' }}>
              <label htmlFor="requestName" className="form-label">Request Name *</label>
              <input
                type="text"
                className="form-control"
                id="requestName"
                value={requestName}
                onChange={(e) => {
                  const newName = e.target.value;
                  setRequestName(newName);
                  
                  // Generate abbreviation from first initials of each word
                  const words = newName.split(/\s+/).filter(word => word.length > 0);
                  let abbr = '';
                  for (let i = 0; i < Math.min(words.length, 5); i++) {
                    if (words[i][0]) {
                      abbr += words[i][0].toUpperCase();
                    }
                  }
                  setAbbreviation(abbr);
                }}
                placeholder="Enter request name"
                required
              />
            </div>
            <div style={{ flex: '1', minWidth: '120px' }}>
              <label htmlFor="abbreviation" className="form-label">Abbreviation *</label>
              <input
                type="text"
                className="form-control"
                id="abbreviation"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase().substring(0, 5))}
                maxLength={5}
                placeholder="AUTO"
                required
                style={{ textTransform: 'uppercase' }}
                title="Auto-generated from request name initials. You can also edit manually."
              />
            </div>
          </div>
          
          <div className="mb-3">
            <label htmlFor="description" className="form-label">Description</label>
            <textarea
              className="form-control"
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>
          
          {selectedTemplate && (
            <div className="alert alert-info">
              <small>
                <i className="bi bi-info-circle me-2"></i>
                The {selectedTemplate} template will be attached to this request.
              </small>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddRequestModal;

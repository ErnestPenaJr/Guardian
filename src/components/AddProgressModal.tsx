import React, { useState, useCallback, useRef } from 'react';
import { Modal, Button, Form, Alert, ProgressBar } from 'react-bootstrap';
import { 
  FileText, 
  Target, 
  Search, 
  Paperclip, 
  Upload, 
  X, 
  Clock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { 
  AddProgressEntryRequest, 
  ProgressTypeOption,
  FileUploadProgress,
  AttachmentValidation,
  ProgressEntryValidation
} from '../types/workProgress';

interface AddProgressModalProps {
  show: boolean;
  onHide: () => void;
  requestId: number;
  onSuccess: () => void;
}

const AddProgressModal: React.FC<AddProgressModalProps> = ({
  show,
  onHide,
  requestId,
  onSuccess
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [formData, setFormData] = useState<AddProgressEntryRequest>({
    requestId,
    progressType: 'note',
    title: '',
    description: '',
    hoursWorked: undefined,
    isVisibleToRequestor: true
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ProgressEntryValidation>({
    isValid: true,
    errors: {}
  });
  const [fileUpload, setFileUpload] = useState<FileUploadProgress | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Progress type options
  const progressTypeOptions: ProgressTypeOption[] = [
    {
      value: 'note',
      label: 'Note',
      description: 'General work notes and updates',
      icon: 'FileText',
      color: 'info'
    },
    {
      value: 'milestone',
      label: 'Milestone',
      description: 'Important achievements or progress markers',
      icon: 'Target',
      color: 'success'
    },
    {
      value: 'discovery',
      label: 'Discovery',
      description: 'Important findings or information uncovered',
      icon: 'Search',
      color: 'warning'
    },
    {
      value: 'attachment',
      label: 'Attachment',
      description: 'File or document related to the work',
      icon: 'Paperclip',
      color: 'primary'
    }
  ];

  // File validation rules
  const attachmentValidation: AttachmentValidation = {
    isValid: true,
    errors: [],
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-zip-compressed'
    ]
  };

  // Get icon component for progress type
  const getProgressTypeIcon = (type: string) => {
    switch (type) {
      case 'note': return FileText;
      case 'milestone': return Target;
      case 'discovery': return Search;
      case 'attachment': return Paperclip;
      default: return FileText;
    }
  };

  // Validate form data
  const validateForm = useCallback((): ProgressEntryValidation => {
    const errors: ProgressEntryValidation['errors'] = {};

    // Title validation
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }

    // Description validation
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length > 5000) {
      errors.description = 'Description must be less than 5000 characters';
    }

    // Hours validation
    if (formData.hoursWorked !== undefined) {
      if (formData.hoursWorked < 0) {
        errors.hoursWorked = 'Hours worked cannot be negative';
      } else if (formData.hoursWorked > 24) {
        errors.hoursWorked = 'Hours worked cannot exceed 24 hours per entry';
      }
    }

    // Attachment validation for attachment type
    if (formData.progressType === 'attachment' && !fileUpload?.file) {
      errors.attachment = 'Attachment is required for attachment type entries';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, [formData, fileUpload]);

  // Update validation when form data changes
  React.useEffect(() => {
    setValidation(validateForm());
  }, [validateForm]);

  // Handle form field changes
  const handleInputChange = (field: keyof AddProgressEntryRequest, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateFile(file);

    if (!validation.isValid) {
      toast.error(validation.errors.join(', '));
      return;
    }

    setFileUpload({
      file,
      progress: 0,
      status: 'pending'
    });

    // Auto-fill title and description for attachment type
    if (formData.progressType === 'attachment') {
      if (!formData.title.trim()) {
        handleInputChange('title', file.name);
      }
      if (!formData.description.trim()) {
        handleInputChange('description', `Attached file: ${file.name} (${formatFileSize(file.size)})`);
      }
    }
  };

  // Validate file
  const validateFile = (file: File): AttachmentValidation => {
    const errors: string[] = [];

    if (file.size > attachmentValidation.maxSize) {
      errors.push(`File size exceeds ${formatFileSize(attachmentValidation.maxSize)} limit`);
    }

    if (!attachmentValidation.allowedTypes.includes(file.type)) {
      errors.push('File type not allowed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      maxSize: attachmentValidation.maxSize,
      allowedTypes: attachmentValidation.allowedTypes
    };
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, []);

  // Remove selected file
  const removeFile = () => {
    setFileUpload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationResult = validateForm();
    if (!validationResult.isValid) {
      setValidation(validationResult);
      return;
    }

    try {
      setLoading(true);

      const submitData = new FormData();
      submitData.append('requestId', requestId.toString());
      submitData.append('progressType', formData.progressType);
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('isVisibleToRequestor', formData.isVisibleToRequestor.toString());
      
      if (formData.hoursWorked !== undefined) {
        submitData.append('hoursWorked', formData.hoursWorked.toString());
      }

      if (fileUpload?.file) {
        submitData.append('attachment', fileUpload.file);
        
        // Update upload progress
        setFileUpload(prev => prev ? { ...prev, status: 'uploading' } : null);
      }

      const response = await api.post(`/api/requests/${requestId}/progress`, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (fileUpload && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setFileUpload(prev => prev ? { ...prev, progress } : null);
          }
        }
      });

      if (response.data?.success) {
        if (fileUpload) {
          setFileUpload(prev => prev ? { ...prev, status: 'completed' } : null);
        }
        
        onSuccess();
        resetForm();
      } else {
        throw new Error(response.data?.message || 'Failed to add progress entry');
      }
    } catch (error: any) {
      console.error('Failed to add progress entry:', error);
      
      if (fileUpload) {
        setFileUpload(prev => prev ? { 
          ...prev, 
          status: 'error', 
          error: error.message || 'Upload failed' 
        } : null);
      }
      
      toast.error(error.message || 'Failed to add progress entry');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      requestId,
      progressType: 'note',
      title: '',
      description: '',
      hoursWorked: undefined,
      isVisibleToRequestor: true
    });
    setFileUpload(null);
    setValidation({ isValid: true, errors: {} });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle modal close
  const handleClose = () => {
    resetForm();
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Work Progress Entry</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Progress Type Selection */}
          <div className="mb-4">
            <Form.Label className="fw-semibold">Progress Type</Form.Label>
            <div className="row">
              {progressTypeOptions.map((option) => {
                const IconComponent = getProgressTypeIcon(option.value);
                const isSelected = formData.progressType === option.value;
                
                return (
                  <div key={option.value} className="col-6 mb-2">
                    <div
                      className={`card h-100 cursor-pointer border-2 ${
                        isSelected ? `border-${option.color} bg-light` : 'border-light'
                      }`}
                      onClick={() => handleInputChange('progressType', option.value)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex align-items-center mb-2">
                          <IconComponent 
                            size={20} 
                            className={`text-${option.color} me-2`} 
                          />
                          <span className="fw-medium">{option.label}</span>
                        </div>
                        <small className="text-muted">{option.description}</small>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="mb-3">
            <Form.Label className="fw-semibold">
              Title <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter a descriptive title for this progress entry"
              isInvalid={!!validation.errors.title}
              maxLength={200}
            />
            <Form.Control.Feedback type="invalid">
              {validation.errors.title}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              {formData.title.length}/200 characters
            </Form.Text>
          </div>

          {/* Description */}
          <div className="mb-3">
            <Form.Label className="fw-semibold">
              Description <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Provide detailed information about this progress entry..."
              isInvalid={!!validation.errors.description}
              maxLength={5000}
            />
            <Form.Control.Feedback type="invalid">
              {validation.errors.description}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              {formData.description.length}/5000 characters
            </Form.Text>
          </div>

          {/* Hours Worked */}
          <div className="mb-3">
            <Form.Label className="fw-semibold">
              <Clock size={16} className="me-1" />
              Hours Worked (Optional)
            </Form.Label>
            <Form.Control
              type="number"
              step="0.25"
              min="0"
              max="24"
              value={formData.hoursWorked || ''}
              onChange={(e) => handleInputChange('hoursWorked', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.0"
              isInvalid={!!validation.errors.hoursWorked}
              style={{ maxWidth: '150px' }}
            />
            <Form.Control.Feedback type="invalid">
              {validation.errors.hoursWorked}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              Track time spent on this work (in hours)
            </Form.Text>
          </div>

          {/* File Upload (for attachment type or optional for others) */}
          <div className="mb-3">
            <Form.Label className="fw-semibold">
              <Paperclip size={16} className="me-1" />
              Attachment {formData.progressType === 'attachment' && <span className="text-danger">*</span>}
            </Form.Label>
            
            {!fileUpload ? (
              <div
                className={`border-2 border-dashed rounded p-4 text-center ${
                  dragActive ? 'border-primary bg-light' : 'border-muted'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{ cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="text-muted mb-2" />
                <div className="mb-2">
                  <strong>Click to upload</strong> or drag and drop
                </div>
                <div className="text-muted small">
                  PDF, Word, Excel, Text, Images, ZIP (max {formatFileSize(attachmentValidation.maxSize)})
                </div>
              </div>
            ) : (
              <div className="border rounded p-3">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <Paperclip size={16} className="text-primary me-2" />
                    <div>
                      <div className="fw-medium">{fileUpload.file.name}</div>
                      <div className="text-muted small">
                        {formatFileSize(fileUpload.file.size)}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={removeFile}
                    disabled={fileUpload.status === 'uploading'}
                  >
                    <X size={16} />
                  </Button>
                </div>
                
                {fileUpload.status === 'uploading' && (
                  <ProgressBar 
                    now={fileUpload.progress} 
                    className="mt-2"
                    label={`${fileUpload.progress}%`}
                  />
                )}
                
                {fileUpload.status === 'error' && (
                  <Alert variant="danger" className="mt-2 mb-0">
                    <AlertCircle size={16} className="me-1" />
                    {fileUpload.error}
                  </Alert>
                )}
              </div>
            )}

            <Form.Control
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
              accept={attachmentValidation.allowedTypes.join(',')}
            />
            
            {validation.errors.attachment && (
              <div className="text-danger small mt-1">
                {validation.errors.attachment}
              </div>
            )}
          </div>

          {/* Visibility Toggle */}
          <div className="mb-3">
            <Form.Check
              type="switch"
              id="visibility-switch"
              label={
                <div className="d-flex align-items-center">
                  {formData.isVisibleToRequestor ? (
                    <Eye size={16} className="text-success me-2" />
                  ) : (
                    <EyeOff size={16} className="text-warning me-2" />
                  )}
                  <span className="fw-medium">
                    {formData.isVisibleToRequestor ? 'Visible to Requestor' : 'Hidden from Requestor'}
                  </span>
                </div>
              }
              checked={formData.isVisibleToRequestor}
              onChange={(e) => handleInputChange('isVisibleToRequestor', e.target.checked)}
            />
            <Form.Text className="text-muted">
              {formData.isVisibleToRequestor 
                ? 'The requestor will be able to see this progress entry'
                : 'This progress entry will be internal only'
              }
            </Form.Text>
          </div>

          {/* Progress Type Info */}
          <Alert variant="info" className="mb-0">
            <Info size={16} className="me-2" />
            <strong>{progressTypeOptions.find(opt => opt.value === formData.progressType)?.label}:</strong>{' '}
            {progressTypeOptions.find(opt => opt.value === formData.progressType)?.description}
          </Alert>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!validation.isValid || loading || fileUpload?.status === 'uploading'}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Adding...
              </>
            ) : (
              <>
                <CheckCircle size={16} className="me-1" />
                Add Progress Entry
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AddProgressModal;
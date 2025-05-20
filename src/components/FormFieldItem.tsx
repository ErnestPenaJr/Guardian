import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormField } from '../types/formBuilder';
import { FaGripVertical, FaTrash, FaCog, FaTimes, FaCheck, FaEye, FaEyeSlash } from 'react-icons/fa';
import './FormFieldItem.css';

interface FormFieldItemProps {
  field: FormField;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FormField>) => void;
}

const FormFieldItem: React.FC<FormFieldItemProps> = ({ field, onRemove, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getFieldIcon = (): string => {
    switch (field.fieldType) {
      case 'text': return 'bi-text-paragraph';
      case 'textarea': return 'bi-textarea-t';
      case 'number': return 'bi-123';
      case 'date': return 'bi-calendar';
      case 'select': return 'bi-list';
      case 'checkbox': return 'bi-check-square';
      case 'radio': return 'bi-circle';
      case 'file': return 'bi-file-earmark-arrow-up';
      default: return 'bi-question-circle';
    }
  };

  const getFieldTypeLabel = (): string => {
    switch (field.fieldType) {
      case 'text': return 'Text Input';
      case 'textarea': return 'Text Area';
      case 'number': return 'Number';
      case 'date': return 'Date';
      case 'select': return 'Dropdown';
      case 'checkbox': return 'Checkbox';
      case 'radio': return 'Radio Buttons';
      case 'file': return 'File Upload';
      default: return 'Unknown';
    }
  };

  const renderFieldPreview = (): JSX.Element => {
    switch (field.fieldType) {
      case 'text':
        return <input type="text" className="form-control form-control-sm" placeholder={field.fieldName || 'Text input'} disabled />;
      case 'textarea':
        return <textarea className="form-control form-control-sm" placeholder={field.fieldName || 'Text area'} disabled rows={2}></textarea>;
      case 'number':
        return <input type="number" className="form-control form-control-sm" placeholder={field.fieldName || 'Number input'} disabled />;
      case 'date':
        return <input type="date" className="form-control form-control-sm" disabled />;
      case 'select':
        return (
          <select className="form-select form-select-sm" disabled>
            <option>{field.fieldName || 'Select option'}</option>
            {field.options.split(',').map((option: string, i: number) => (
              <option key={i}>{option.trim()}</option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <div className="form-check">
            <input className="form-check-input" type="checkbox" disabled />
            <label className="form-check-label small">{field.fieldName || 'Checkbox label'}</label>
          </div>
        );
      case 'radio':
        return (
          <div>
            {field.options ? 
              field.options.split(',').map((option: string, i: number) => (
                <div className="form-check" key={i}>
                  <input className="form-check-input" type="radio" name={`radio-${field.id}`} disabled />
                  <label className="form-check-label small">{option.trim()}</label>
                </div>
              )) : 
              <div className="form-check">
                <input className="form-check-input" type="radio" disabled />
                <label className="form-check-label small">{field.fieldName || 'Radio option'}</label>
              </div>
            }
          </div>
        );
      case 'file':
        return (
          <div className="input-group input-group-sm">
            <input type="file" className="form-control form-control-sm" disabled />
          </div>
        );
      default:
        return <div>Unknown field type</div>;
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`card mb-2 form-field-item ${isEditing ? 'editing' : ''}`}
    >
      <div className="card-header d-flex justify-content-between align-items-center py-2 px-3">
        <div className="d-flex align-items-center">
          <div {...attributes} {...listeners} className="drag-handle me-2" title="Drag to reorder">
            <FaGripVertical size={14} />
          </div>
          <i className={`bi ${getFieldIcon()} me-2`}></i>
          <span className="fw-medium">{field.fieldName || getFieldTypeLabel()}</span>
          <span className="field-type-badge ms-2">{getFieldTypeLabel()}</span>
          {field.required && <span className="required-badge ms-2">Required</span>}
        </div>
        <div className="field-actions">
          <button 
            className="btn btn-sm btn-link p-0 me-2" 
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
          </button>
          <button 
            className="btn btn-sm btn-link p-0 me-2" 
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? "Cancel editing" : "Edit field"}
          >
            {isEditing ? <FaTimes size={14} /> : <FaCog size={14} />}
          </button>
          <button 
            className="btn btn-sm btn-link text-danger p-0" 
            onClick={() => onRemove(field.id)}
            title="Remove field"
          >
            <FaTrash size={14} />
          </button>
        </div>
      </div>
      
      {isEditing ? (
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label fw-medium mb-1">Field Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={field.fieldName} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { fieldName: e.target.value })}
              placeholder="Enter field name"
              autoFocus
            />
            <small className="text-muted">This will be shown to users filling out the form</small>
          </div>
          
          <div className="mb-3">
            <label className="form-label fw-medium mb-1">Field Type</label>
            <select 
              className="form-select"
              value={field.fieldType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(field.id, { fieldType: e.target.value })}
            >
              <option value="text">Text Input</option>
              <option value="textarea">Text Area</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Dropdown</option>
              <option value="checkbox">Checkbox</option>
              <option value="radio">Radio Buttons</option>
              <option value="file">File Upload</option>
            </select>
          </div>
          
          <div className="form-check form-switch mb-3">
            <input 
              type="checkbox" 
              className="form-check-input" 
              id={`required-${field.id}`}
              checked={field.required}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { required: e.target.checked })}
            />
            <label className="form-check-label" htmlFor={`required-${field.id}`}>Required Field</label>
          </div>
          
          {(field.fieldType === 'select' || field.fieldType === 'radio' || field.fieldType === 'checkbox') && (
            <div className="mb-3">
              <label className="form-label fw-medium mb-1">Options</label>
              <input 
                type="text" 
                className="form-control" 
                value={field.options}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { options: e.target.value })}
                placeholder="Option 1, Option 2, Option 3"
              />
              <small className="text-muted">Enter options separated by commas</small>
              
              <div className="options-preview">
                {field.options.split(',').map((option, i) => (
                  <span key={i} className="option-badge">{option.trim() || `Option ${i+1}`}</span>
                ))}
              </div>
            </div>
          )}
          
          <div className="d-flex justify-content-end">
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setIsEditing(false)}
            >
              <FaCheck size={12} className="me-1" /> Apply Changes
            </button>
          </div>
        </div>
      ) : (
        showPreview && (
          <div className="field-preview">
            {renderFieldPreview()}
          </div>
        )
      )}
    </div>
  );
};

export default FormFieldItem;

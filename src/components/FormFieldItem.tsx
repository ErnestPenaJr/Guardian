import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormField } from '../types/formBuilder';
import { FaGripVertical, FaTrash, FaCog, FaTimes, FaCheck } from 'react-icons/fa';

interface FormFieldItemProps {
  field: FormField;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FormField>) => void;
}

const FormFieldItem: React.FC<FormFieldItemProps> = ({ field, onRemove, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  
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
      <div className="card-header d-flex justify-content-between align-items-center py-1 px-2">
        <div className="d-flex align-items-center">
          <div {...attributes} {...listeners} className="drag-handle me-1">
            <FaGripVertical size={14} />
          </div>
          <i className={`bi ${getFieldIcon()} me-1`}></i>
          <span className="small">{field.fieldName || getFieldTypeLabel()}</span>
          {field.required && <span className="badge bg-danger ms-1 small">Required</span>}
        </div>
        <div>
          <button 
            className="btn btn-sm btn-link p-0 me-1" 
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <FaTimes size={14} /> : <FaCog size={14} />}
          </button>
          <button 
            className="btn btn-sm btn-link text-danger p-0" 
            onClick={() => onRemove(field.id)}
          >
            <FaTrash size={14} />
          </button>
        </div>
      </div>
      
      {isEditing ? (
        <div className="card-body p-2">
          <div className="mb-2">
            <label className="form-label small mb-1">Field Name</label>
            <input 
              type="text" 
              className="form-control form-control-sm" 
              value={field.fieldName} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { fieldName: e.target.value })}
              placeholder="Enter field name"
            />
          </div>
          
          <div className="mb-2">
            <label className="form-label small mb-1">Field Type</label>
            <select 
              className="form-select form-select-sm"
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
          
          <div className="form-check mb-2">
            <input 
              type="checkbox" 
              className="form-check-input" 
              id={`required-${field.id}`}
              checked={field.required}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { required: e.target.checked })}
            />
            <label className="form-check-label small" htmlFor={`required-${field.id}`}>Required Field</label>
          </div>
          
          {(field.fieldType === 'select' || field.fieldType === 'radio') && (
            <div className="mb-2">
              <label className="form-label small mb-1">Options (comma separated)</label>
              <input 
                type="text" 
                className="form-control form-control-sm" 
                value={field.options}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate(field.id, { options: e.target.value })}
                placeholder="Option 1, Option 2, Option 3"
              />
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>Enter options separated by commas</small>
            </div>
          )}
          
          <button 
            className="btn btn-primary btn-sm py-0 px-2" 
            style={{ fontSize: '0.75rem' }}
            onClick={() => setIsEditing(false)}
          >
            <FaCheck size={10} className="me-1" /> Done
          </button>
        </div>
      ) : (
        <div className="card-body py-1 px-2">
          {renderFieldPreview()}
        </div>
      )}
    </div>
  );
};

export default FormFieldItem;

import React from 'react';
import { FormField } from '../types/formBuilder';

interface FormFieldPreviewProps {
  field?: FormField;
}

const FormFieldPreview: React.FC<FormFieldPreviewProps> = ({ field }) => {
  if (!field) return null;

  const renderFieldPreview = (): JSX.Element => {
    switch (field.fieldType) {
      case 'text':
      case 'zip_code':
      case 'state':
      case 'first_name':
      case 'last_name':
      case 'city':
      case 'address_line_1':
      case 'address_line_2':
      case 'bank_name':
        return (
          <input 
            type="text" 
            className="form-control form-control-sm" 
            placeholder={
              field.fieldType === 'zip_code' ? 'ZIP code (e.g., 12345)' :
              field.fieldType === 'state' ? 'State (e.g., CA)' :
              field.fieldName || 'Text input'
            } 
            disabled 
          />
        );
      case 'textarea':
        return <textarea className="form-control form-control-sm" placeholder={field.fieldName || 'Text area'} disabled rows={2}></textarea>;
      case 'number':
      case 'account_number':
      case 'routing_number':
      case 'phone':
        return <input type="number" className="form-control form-control-sm" placeholder={field.fieldName || 'Number input'} disabled />;
      case 'date':
      case 'dob':
        return <input type="date" className="form-control form-control-sm" disabled />;
      case 'time':
        return <input type="time" className="form-control form-control-sm" disabled />;
      case 'datetime':
      case 'date_time':
        return <input type="datetime-local" className="form-control form-control-sm" disabled />;
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
                  <input className="form-check-input" type="radio" name={`radio-preview-${field.id}`} disabled />
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
    <div className="card form-field-preview">
      <div className="card-header d-flex justify-content-between align-items-center py-1 px-2">
        <div className="d-flex align-items-center">
          <i className={`bi bi-${getFieldIcon(field.fieldType)} me-1`}></i>
          <span className="small">{field.fieldName || getFieldTypeLabel(field.fieldType)}</span>
          {field.required && <span className="badge bg-danger ms-1 small">Required</span>}
        </div>
      </div>
      <div className="card-body py-1 px-2">
        {renderFieldPreview()}
      </div>
    </div>
  );
};

const getFieldIcon = (fieldType: string): string => {
  switch (fieldType) {
    case 'text': return 'text-paragraph';
    case 'textarea': return 'textarea-t';
    case 'number': return '123';
    case 'date': return 'calendar';
    case 'select': return 'list';
    case 'checkbox': return 'check-square';
    case 'radio': return 'circle';
    case 'file': return 'file-earmark-arrow-up';
    default: return 'question-circle';
  }
};

const getFieldTypeLabel = (fieldType: string): string => {
  switch (fieldType) {
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

export default FormFieldPreview;

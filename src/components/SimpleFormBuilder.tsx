import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField } from '../types/formBuilder';
import fieldTypeService, { UiFieldType } from '../services/fieldTypeService';
import fieldsService, { UiField } from '../services/fieldsService';
import { getFieldTypeIdByName } from '../services/formService';
import '../styles/SimpleFormBuilder.css';
import { 
  FaFont, 
  FaParagraph,
  FaHashtag, 
  FaListUl,
  FaDotCircle,
  FaCheckSquare,
  FaCalendarAlt, 
  FaTrashAlt,
  FaEdit,
  FaAsterisk,
  FaUser,
  FaMoneyBill,
  FaHome,
  FaIdCard,
  FaAddressCard,
  FaMoneyCheckAlt,
  FaIdBadge
} from 'react-icons/fa';
import { toast } from 'react-toastify';

interface SimpleFormBuilderProps {
  formFields: FormField[];
  onChange: (fields: FormField[]) => void;
  formId?: number;
}

const SimpleFormBuilder: React.FC<SimpleFormBuilderProps> = ({
  formFields,
  onChange,
  formId
}) => {
  const [fields, setFields] = useState<FormField[]>(formFields);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fieldTypes, setFieldTypes] = useState<UiFieldType[]>([]);
  const [dbFields, setDbFields] = useState<UiField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // We use isLoading in the useEffect for API calls, even though it's not directly
  // referenced elsewhere in the component at this time
  
  // Load fields from the database
  useEffect(() => {
    console.log('🔍 DEBUG: SimpleFormBuilder useEffect triggered!');
    // Fetch fields from the database
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch fields
        const fieldsData = await fieldsService.getUiFields();
        console.log('🔍 DEBUG: Setting dbFields with', fieldsData.length, 'fields');
        setDbFields(fieldsData);
        
        // Also fetch field types as backup
        const types = await fieldTypeService.getUiFieldTypes();
        setFieldTypes(types);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load field data from database');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Template definitions
  const templates = [
    {
      id: 'subject',
      name: 'SUBJECT',
      description: 'First Name, Middle Name, Last Name, DOB, SSN',
      icon: <FaUser />,
      fields: ['first_name', 'middle_name', 'last_name', 'dob', 'ssn']
    },
    {
      id: 'vehicle',
      name: 'VEHICLE',
      description: 'Make, Model, Year, VIN, License Plate',
      icon: <FaIdBadge />,
      fields: ['make', 'model', 'year', 'vin', 'license_plate']
    },
    {
      id: 'financial',
      name: 'FINANCIAL',
      description: 'Bank Name, Account #, Routing #',
      icon: <FaMoneyBill />,
      fields: ['bank_name', 'account_number', 'routing_number']
    },
    {
      id: 'address',
      name: 'ADDRESS',
      description: 'Address Line 1, Address Line 2, City, State, ZIP Code',
      icon: <FaHome />,
      fields: ['address_line_1', 'address_line_2', 'city', 'state', 'zip_code']
    }
  ];
  
  // Get icon component for a field type
  const getIconComponent = (fieldName: string, fieldType: string) => {
    // Determine icon based on field name patterns
    const fieldNameLower = fieldName.toLowerCase();
    
    // Number fields
    if (fieldNameLower.includes('account #') || 
        fieldNameLower.includes('phone #') || 
        fieldNameLower.includes('routing #') || 
        fieldNameLower.includes('ssn')) {
      return <div className="icon-wrapper hashtag">#</div>;
    }
    
    // Date fields
    if (fieldNameLower.includes('dob')) {
      return <div className="icon-wrapper date"><FaCalendarAlt /></div>;
    }
    
    // Address-related fields
    if (fieldNameLower.includes('address') || 
        fieldNameLower.includes('city') || 
        fieldNameLower.includes('state') || 
        fieldNameLower.includes('zip')) {
      return <div className="icon-wrapper address">A</div>;
    }
    
    // Name fields
    if (fieldNameLower.includes('name')) {
      return <div className="icon-wrapper name">A</div>;
    }
    
    // Default to showing letter based on type
    switch (fieldType.toLowerCase()) {
      case 'text':
      case 'paragraph':
        return <div className="icon-wrapper text">A</div>;
      case 'number':
        return <div className="icon-wrapper hashtag">#</div>;
      case 'date':
        return <div className="icon-wrapper date"><FaCalendarAlt /></div>;
      case 'dropdown':
      case 'select':
        return <div className="icon-wrapper dropdown"><FaListUl /></div>;
      case 'radio':
        return <div className="icon-wrapper radio"><FaDotCircle /></div>;
      case 'checkbox':
        return <div className="icon-wrapper checkbox"><FaCheckSquare /></div>;
      default:
        return <div className="icon-wrapper text">A</div>;
    }
  };
  
  // Add a new field to the form
  const addField = (type: string, customName?: string) => {
    const newField: FormField = {
      id: uuidv4(),
      fieldName: customName || `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      fieldType: type,
      fieldTypeId: getFieldTypeIdByName(type), // Add field type ID for database saving
      required: false,
      options: '',
      canDelete: true
    };
    
    const updatedFields = [...fields, newField];
    setFields(updatedFields);
    onChange(updatedFields);
  };
  
  // Remove a field from the form
  const removeField = (id: string) => {
    const updatedFields = fields.filter(field => field.id !== id);
    setFields(updatedFields);
    onChange(updatedFields);
  };
  
  // Update a field in the form
  const updateField = (updatedField: FormField) => {
    const updatedFields = fields.map(field => 
      field.id === updatedField.id ? updatedField : field
    );
    setFields(updatedFields);
    onChange(updatedFields);
    setEditingField(null);
  };
  
  // Apply a template to the form
  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    // Create fields based on the template
    const templateFields = template.fields.map(fieldType => ({
      id: uuidv4(),
      fieldName: fieldType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      fieldType,
      fieldTypeId: getFieldTypeIdByName(fieldType), // Add field type ID for database saving
      required: false,
      options: '',
      canDelete: true
    }));
    
    // Replace existing fields with the template fields
    const updatedFields = [...templateFields];
    setFields(updatedFields);
    onChange(updatedFields);
    
    toast.success(`${template.name} template applied`);
  };
  
  // Handle drag start event
  const handleDragStart = (e: React.DragEvent, type: string, fieldName?: string) => {
    e.dataTransfer.setData('fieldType', type);
    e.dataTransfer.setData('fieldName', fieldName || '');
  };
  
  // Handle drag over event
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  
  // Handle drag leave event
  const handleDragLeave = () => {
    setDragOver(false);
  };
  
  // Handle drop event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const fieldType = e.dataTransfer.getData('fieldType');
    const fieldName = e.dataTransfer.getData('fieldName');
    
    if (fieldType) {
      addField(fieldType, fieldName || undefined);
    }
  };
  
  // Close the field editor
  const closeFieldEditor = () => {
    setEditingField(null);
  };
  
  // Render a preview of the field
  const renderFieldPreview = (field: FormField) => {
    switch (field.fieldType.toLowerCase()) {
      case 'text':
      case 'first_name':
      case 'middle_name':
      case 'last_name':
      case 'bank_name':
      case 'address_line_1':
      case 'address_line_2':
      case 'city':
      case 'state':
      case 'zip_code':
        return (
          <input 
            type="text" 
            className="form-control" 
            placeholder={field.fieldName} 
            disabled 
          />
        );
      case 'paragraph':
        return (
          <textarea 
            className="form-control" 
            placeholder={field.fieldName} 
            rows={3} 
            disabled 
          />
        );
      case 'number':
      case 'account_number':
      case 'routing_number':
      case 'phone':
        return (
          <input 
            type="number" 
            className="form-control" 
            placeholder={field.fieldName} 
            disabled 
          />
        );
      case 'date':
      case 'dob':
        return (
          <input 
            type="date" 
            className="form-control" 
            disabled 
          />
        );
      case 'ssn':
        return (
          <input 
            type="password" 
            className="form-control" 
            placeholder="XXX-XX-XXXX" 
            disabled 
          />
        );
      default:
        return (
          <input 
            type="text" 
            className="form-control" 
            placeholder={field.fieldName} 
            disabled 
          />
        );
    }
  };
  
  // Field editor modal
  const renderFieldEditor = () => {
    if (!editingField) return null;
    
    return (
      <div className="field-editor-overlay">
        <div className="field-editor">
          <h3>Edit Field</h3>
          <div className="mb-3">
            <label htmlFor="fieldName" className="form-label">Field Name</label>
            <input 
              type="text" 
              className="form-control" 
              id="fieldName" 
              value={editingField.fieldName} 
              onChange={(e) => setEditingField({...editingField, fieldName: e.target.value})}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="fieldType" className="form-label">Field Type</label>
            <select 
              className="form-select" 
              id="fieldType" 
              value={editingField.fieldType}
              onChange={(e) => setEditingField({...editingField, fieldType: e.target.value})}
            >
              {fieldTypes.map((type) => (
                <option key={type.type} value={type.type}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-3 form-check">
            <input 
              type="checkbox" 
              className="form-check-input" 
              id="required" 
              checked={editingField.required}
              onChange={(e) => setEditingField({...editingField, required: e.target.checked})}
            />
            <label className="form-check-label" htmlFor="required">Required</label>
          </div>
          
          <div className="mb-3">
            <label htmlFor="placeholder" className="form-label">Placeholder</label>
            <input 
              type="text" 
              className="form-control" 
              id="placeholder" 
              value={editingField.placeholder || ''}
              onChange={(e) => setEditingField({...editingField, placeholder: e.target.value})}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="helpText" className="form-label">Help Text</label>
            <input 
              type="text" 
              className="form-control" 
              id="helpText" 
              value={editingField.helpText || ''}
              onChange={(e) => setEditingField({...editingField, helpText: e.target.value})}
            />
          </div>
          
          <div className="d-flex justify-content-end">
            <button 
              type="button" 
              className="btn btn-secondary me-2"
              onClick={closeFieldEditor}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => updateField(editingField)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="form-builder-container">
      {/* Left sidebar with field types */}
      <div className="form-builder-sidebar">
        {/* Preset Forms section */}
        <div className="forms-section">
          <h4 className="mb-2">WORKFLOW TEMPLATES</h4>
          <div className="forms-grid">
            <button type="button" className="form-btn subject" onClick={() => applyTemplate('subject')}>Subject</button>
            <button type="button" className="form-btn financial" onClick={() => applyTemplate('financial')}>Financial</button>
            <button type="button" className="form-btn vehicle" onClick={() => applyTemplate('vehicle')}>Vehicle</button>
            <button type="button" className="form-btn address" onClick={() => applyTemplate('address')}>Address</button>
          </div>
        </div>
        <h4 className="mb-3">FIELDS</h4>
        <div className="field-grid">
          {console.log('🔍 DEBUG: Rendering dbFields:', dbFields.length, 'fields')}
          {console.log('🔍 DEBUG: Field IDs:', dbFields.map(f => f.id))}
          {dbFields.map((field, index) => (
            <div
              key={`${field.id}-${index}`}
              className="field-item"
              draggable
              onDragStart={(e) => handleDragStart(e, field.type, field.name)}
            >
              {getIconComponent(field.name, field.type)}
              <div className="field-label">{field.name}</div>
            </div>
          ))}
        </div>
        
        {/* Templates section hidden as requested */}
        {/* <h4 className="mb-3 mt-4">TEMPLATES</h4>
        <div className="template-list">
          {templates.map((template) => (
            <div 
              key={template.id}
              className="template-item"
              onClick={() => applyTemplate(template.id)}
            >
              <div className="template-icon">
                {template.icon}
              </div>
              <div className="template-details">
                <div className="template-name">{template.name}</div>
                <div className="template-description">{template.description}</div>
              </div>
            </div>
          ))}
        </div> */}
      </div>
      
      {/* Main content area */}
      <div className="form-builder-main">
        {/* Form preview */}
        <div 
          className={`form-preview ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <h3>Form Preview</h3>
          
          {fields.length === 0 ? (
            <div className="empty-form-message">
              <p>Drag and drop fields here or click a field type to add it.</p>
            </div>
          ) : (
            <div className="form-fields">
              {fields.map((field) => (
                <div 
                  key={field.id} 
                  className="form-field-item"
                  onClick={() => setEditingField(field)}
                >
                  <div className="field-header">
                    <div className="field-title">
                      {field.fieldName}
                      {field.required && (
                        <span style={{ 
                          color: '#dc3545', 
                          marginLeft: '4px', 
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <FaAsterisk size={10} />
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingField(field);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#0d6efd',
                          fontSize: '14px',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <FaEdit />
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-secondary ms-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(field.id);
                        }}
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  </div>
                  <div className="field-preview">
                    {renderFieldPreview(field)}
                  </div>
                  {field.helpText && (
                    <div className="field-help-text">
                      {field.helpText}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Field editor modal */}
      {renderFieldEditor()}
    </div>
  );
};

export default SimpleFormBuilder;

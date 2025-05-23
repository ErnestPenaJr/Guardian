import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField } from '../types/formBuilder';
import formService from '../services/formService';
import '../styles/EnhancedFormBuilder.css';
import { 
  FaFont, 
  FaHashtag, 
  FaCalendarAlt, 
  FaTrashAlt,
  FaEdit,
  FaAsterisk,
  FaGripVertical,
  FaTimes
} from 'react-icons/fa';

interface EnhancedFormBuilderProps {
  formFields: FormField[];
  onChange: (fields: FormField[]) => void;
  formId?: number;
  formType?: string;
}

const EnhancedFormBuilder: React.FC<EnhancedFormBuilderProps> = ({
  formFields,
  onChange,
  formId,
  formType = 'request'
}) => {
  const [fields, setFields] = useState<FormField[]>(formFields);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  
  // Use formType to potentially customize field types based on form type
  // For now, we'll just log it for future reference
  console.log(`Building form of type: ${formType}`);
  
  // Field type definitions with icons
  const fieldTypes = [
    { type: 'account_number', label: 'Account #', icon: <FaHashtag /> },
    { type: 'address_line_1', label: 'Address Line 1', icon: <FaFont /> },
    { type: 'address_line_2', label: 'Address Line 2', icon: <FaFont /> },
    { type: 'bank_name', label: 'Bank Name', icon: <FaFont /> },
    { type: 'city', label: 'City', icon: <FaFont /> },
    { type: 'phone', label: 'Phone #', icon: <FaHashtag /> },
    { type: 'routing_number', label: 'Routing #', icon: <FaHashtag /> },
    { type: 'state', label: 'State', icon: <FaFont /> },
    { type: 'zip_code', label: 'ZIP Code', icon: <FaFont /> },
    { type: 'first_name', label: 'First Name', icon: <FaFont /> },
    { type: 'middle_name', label: 'Middle Name', icon: <FaFont /> },
    { type: 'last_name', label: 'Last Name', icon: <FaFont /> },
    { type: 'dob', label: 'DOB', icon: <FaCalendarAlt /> },
    { type: 'ssn', label: 'SSN', icon: <FaHashtag /> }
  ];
  
  useEffect(() => {
    // If formId is provided, fetch existing form data
    if (formId) {
      const fetchFormData = async () => {
        try {
          const { fields: dbFields } = await formService.getFormById(formId);
          // Convert database fields to UI form fields
          const uiFields = formService.convertDbFieldsToFormFields(dbFields);
          setFields(uiFields);
          onChange(uiFields);
        } catch (error) {
          console.error(`Error fetching form with ID ${formId}:`, error);
        }
      };
      fetchFormData();
    }
  }, [formId, onChange]);
  
  // Update parent component when fields change
  useEffect(() => {
    onChange(fields);
  }, [fields, onChange]);
  
  // Add a new field to the form
  const addField = (fieldType: string) => {
    let fieldName = fieldType.replace(/_/g, ' ');
    fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    
    // Map field types to more user-friendly names
    switch(fieldType) {
      case 'first_name': fieldName = 'First Name'; break;
      case 'middle_name': fieldName = 'Middle Name'; break;
      case 'last_name': fieldName = 'Last Name'; break;
      case 'dob': fieldName = 'DOB'; break;
      case 'ssn': fieldName = 'SSN'; break;
      case 'account_number': fieldName = 'Account #'; break;
      case 'bank_name': fieldName = 'Bank Name'; break;
      case 'routing_number': fieldName = 'Routing #'; break;
      case 'address_line_1': fieldName = 'Address Line 1'; break;
      case 'address_line_2': fieldName = 'Address Line 2'; break;
      case 'city': fieldName = 'City'; break;
      case 'state': fieldName = 'State'; break;
      case 'zip_code': fieldName = 'ZIP Code'; break;
      case 'phone': fieldName = 'Phone #'; break;
    }
    
    const newField: FormField = {
      id: `field-${uuidv4()}`,
      fieldName,
      fieldType,
      required: false,
      options: fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' ? 'Option 1,Option 2,Option 3' : '',
      canDelete: true
    };
    
    setFields([...fields, newField]);
  };
  
  // Remove a field from the form
  const removeField = (fieldId: string) => {
    setFields(fields.filter(field => field.id !== fieldId));
  };
  
  // Handle drag start for field types
  const handleDragStart = (e: React.DragEvent, fieldType: string) => {
    e.dataTransfer.setData('fieldType', fieldType);
  };
  
  // Handle drag over for the form preview area
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  
  // Handle drag leave for the form preview area
  const handleDragLeave = () => {
    setDragOver(false);
  };
  
  // Handle drop for the form preview area
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const fieldType = e.dataTransfer.getData('fieldType');
    if (fieldType) {
      addField(fieldType);
    }
  };
  
  // Handlers for reordering existing fields
  const handleFieldDragStart = (e: React.DragEvent, fieldId: string) => {
    setDraggedFieldId(fieldId);
    e.dataTransfer.setData('fieldId', fieldId);
    // Set the drag image to be the element itself
    const draggedElement = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (draggedElement) {
      e.dataTransfer.setDragImage(draggedElement as Element, 20, 20);
    }
  };

  const handleFieldDragEnd = () => {
    setDraggedFieldId(null);
    setDragOverFieldId(null);
  };

  const handleFieldDragOver = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault();
    if (draggedFieldId !== fieldId) {
      setDragOverFieldId(fieldId);
    }
  };

  const handleFieldDragLeave = () => {
    setDragOverFieldId(null);
  };

  const handleFieldDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFieldId = e.dataTransfer.getData('fieldId');
    const targetFieldId = e.currentTarget.getAttribute('data-field-id');
    
    if (droppedFieldId && targetFieldId && droppedFieldId !== targetFieldId) {
      // Reorder the fields
      const updatedFields = [...fields];
      const draggedFieldIndex = updatedFields.findIndex(field => field.id === droppedFieldId);
      const targetFieldIndex = updatedFields.findIndex(field => field.id === targetFieldId);
      
      if (draggedFieldIndex !== -1 && targetFieldIndex !== -1) {
        const [draggedField] = updatedFields.splice(draggedFieldIndex, 1);
        updatedFields.splice(targetFieldIndex, 0, draggedField);
        setFields(updatedFields);
      }
    }
    
    setDraggedFieldId(null);
    setDragOverFieldId(null);
  };
  
  // Update a field's properties
  const updateField = (updatedField: FormField) => {
    setFields(fields.map(field => 
      field.id === updatedField.id ? updatedField : field
    ));
    setEditingField(null);
  };
  
  // Close the field editor modal
  const closeFieldEditor = () => {
    setEditingField(null);
  };
  
  // Render field preview based on field type
  const renderFieldPreview = (field: FormField) => {
    switch (field.fieldType) {
      case 'text':
      case 'first_name':
      case 'middle_name':
      case 'last_name':
      case 'address_line_1':
      case 'address_line_2':
      case 'city':
      case 'state':
      case 'zip_code':
      case 'bank_name':
        return (
          <input 
            type="text" 
            className="form-control" 
            placeholder={field.placeholder || field.fieldName} 
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
            placeholder={field.placeholder || field.fieldName} 
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
            placeholder={field.placeholder || field.fieldName} 
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
          <div className="field-editor-header">
            <h3>Edit Field</h3>
            <button 
              className="close-button" 
              onClick={closeFieldEditor}
            >
              <FaTimes />
            </button>
          </div>
          <div className="field-editor-body">
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
          </div>
          
          <div className="field-editor-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={closeFieldEditor}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => updateField(editingField)}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="enhanced-form-builder-container">
      {/* Left sidebar with field types */}
      <div className="enhanced-form-builder-sidebar">
        <div className="fields-section">
          <h6>Fields</h6>
          <div className="field-grid">
            {fieldTypes.map((fieldType) => (
              <div 
                key={fieldType.type}
                className="field-item" 
                draggable
                onDragStart={(e) => handleDragStart(e, fieldType.type)}
                onClick={() => addField(fieldType.type)}
              >
                <div className="field-icon">
                  {fieldType.icon}
                </div>
                <div className="field-label">{fieldType.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="enhanced-form-builder-main">
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
                  className={`form-field-item ${draggedFieldId === field.id ? 'dragging' : ''} ${dragOverFieldId === field.id ? 'drag-over' : ''}`}
                  data-field-id={field.id}
                  draggable
                  onDragStart={(e) => handleFieldDragStart(e, field.id)}
                  onDragEnd={handleFieldDragEnd}
                  onDragOver={(e) => handleFieldDragOver(e, field.id)}
                  onDragLeave={handleFieldDragLeave}
                  onDrop={handleFieldDrop}
                  onClick={() => setEditingField(field)}
                >
                  <div className="field-header">
                    <div className="field-title">
                      <div className="drag-handle">
                        <FaGripVertical />
                      </div>
                      {field.fieldName}
                      {field.required && (
                        <span className="required-indicator">
                          <FaAsterisk size={10} />
                        </span>
                      )}
                    </div>
                    <div className="field-actions">
                      <button
                        className="edit-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingField(field);
                        }}
                      >
                        <FaEdit />
                      </button>
                      <button 
                        className="delete-button"
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

export default EnhancedFormBuilder;
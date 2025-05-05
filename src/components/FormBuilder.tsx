import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { FaTrash, FaEdit, FaGripLines, FaPlus } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import { FormField, FormFieldType } from '../types/formBuilder';
import formService from '../services/formService';

interface FormBuilderProps {
  formFields: FormField[];
  onChange: (fields: FormField[]) => void;
  formId?: number; // Optional form ID for editing existing forms
}

const FormBuilder: React.FC<FormBuilderProps> = ({ formFields, onChange, formId }) => {
  const [fields, setFields] = useState<FormField[]>(formFields);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [fieldTypes, setFieldTypes] = useState<FormFieldType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch field types from the database
    const fetchFieldTypes = async () => {
      try {
        setLoading(true);
        const types = await formService.getFieldTypes();
        setFieldTypes(types);
      } catch (error) {
        console.error('Error fetching field types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFieldTypes();
    
    // If formId is provided, fetch existing form data
    if (formId) {
      const fetchFormData = async () => {
        try {
          setLoading(true);
          const { fields: dbFields } = await formService.getFormById(formId);
          // Convert database fields to UI form fields
          const uiFields = formService.convertDbFieldsToFormFields(dbFields);
          setFields(uiFields);
          onChange(uiFields);
        } catch (error) {
          console.error(`Error fetching form with ID ${formId}:`, error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchFormData();
    }
  }, [formId, onChange]);

  useEffect(() => {
    setFields(formFields);
  }, [formFields]);

  useEffect(() => {
    onChange(fields);
  }, [fields, onChange]);

  const addField = (fieldType: string) => {
    const newField: FormField = {
      id: `field-${uuidv4()}`,
      fieldName: `New ${fieldType} Field`,
      fieldType,
      required: false,
      options: fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' ? 'Option 1,Option 2,Option 3' : ''
    };
    setFields([...fields, newField]);
    setEditingField(newField);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(field => field.id !== id));
    if (editingField && editingField.id === id) {
      setEditingField(null);
    }
  };

  const updateField = (updatedField: FormField) => {
    setFields(fields.map(field => field.id === updatedField.id ? updatedField : field));
    setEditingField(null);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setFields(items);
  };

  // Field type options for the form builder
  const availableFieldTypes = fieldTypes.length > 0 ? fieldTypes : [
    { id: 'text', label: 'Text Field', icon: 'T' },
    { id: 'textarea', label: 'Text Area', icon: 'TA' },
    { id: 'number', label: 'Number', icon: '#' },
    { id: 'select', label: 'Dropdown', icon: '▼' },
    { id: 'radio', label: 'Radio Buttons', icon: '○' },
    { id: 'checkbox', label: 'Checkboxes', icon: '☑' },
    { id: 'date', label: 'Date', icon: '📅' },
    { id: 'email', label: 'Email', icon: '@' },
    { id: 'file', label: 'File Upload', icon: '📎' }
  ];

  return (
    <div className="form-builder">
      <div className="row">
        <div className="col-md-3">
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">Form Elements</h5>
            </div>
            <div className="card-body">
              <div className="field-types">
                {availableFieldTypes.map(type => (
                  <button
                    key={type.id}
                    className="field-type-btn"
                    onClick={() => addField(type.id)}
                    disabled={loading}
                  >
                    <span className="field-icon">{type.icon}</span>
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {editingField && (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Field Properties</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label htmlFor="fieldName" className="form-label">Field Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="fieldName"
                    value={editingField.fieldName}
                    onChange={e => setEditingField({...editingField, fieldName: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="fieldType" className="form-label">Field Type</label>
                  <select
                    className="form-select"
                    id="fieldType"
                    value={editingField.fieldType}
                    onChange={e => setEditingField({...editingField, fieldType: e.target.value})}
                  >
                    {availableFieldTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3 form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="required"
                    checked={editingField.required}
                    onChange={e => setEditingField({...editingField, required: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="required">Required</label>
                </div>
                {(editingField.fieldType === 'select' || editingField.fieldType === 'radio' || editingField.fieldType === 'checkbox') && (
                  <div className="mb-3">
                    <label htmlFor="options" className="form-label">Options (comma separated)</label>
                    <textarea
                      className="form-control"
                      id="options"
                      value={editingField.options}
                      onChange={e => setEditingField({...editingField, options: e.target.value})}
                      rows={3}
                    />
                  </div>
                )}
                <div className="d-flex justify-content-between">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setEditingField(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => updateField(editingField)}
                  >
                    Update Field
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="col-md-9">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Form Preview</h5>
            </div>
            <div className="card-body">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="form-fields">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="form-preview"
                    >
                      {fields.length === 0 ? (
                        <div className="text-center p-5 text-muted">
                          <p>Drag and drop form elements here</p>
                          <button 
                            className="btn btn-outline-primary"
                            onClick={() => addField('text')}
                          >
                            <FaPlus className="me-2" />
                            Add Text Field
                          </button>
                        </div>
                      ) : (
                        fields.map((field, index) => (
                          <Draggable key={field.id} draggableId={field.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="form-field-item"
                              >
                                <div className="form-field-header">
                                  <span {...provided.dragHandleProps} className="drag-handle">
                                    <FaGripLines />
                                  </span>
                                  <span className="field-name">
                                    {field.fieldName} {field.required && <span className="text-danger">*</span>}
                                  </span>
                                  <div className="field-actions">
                                    <button
                                      className="btn btn-sm btn-link"
                                      onClick={() => setEditingField(field)}
                                      title="Edit Field"
                                    >
                                      <FaEdit />
                                    </button>
                                    <button
                                      className="btn btn-sm btn-link text-danger"
                                      onClick={() => removeField(field.id)}
                                      title="Remove Field"
                                    >
                                      <FaTrash />
                                    </button>
                                  </div>
                                </div>
                                <div className="form-field-preview">
                                  {renderFieldPreview(field)}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to render the preview of each field type
const renderFieldPreview = (field: FormField) => {
  switch (field.fieldType) {
    case 'text':
      return <input type="text" className="form-control" placeholder={field.fieldName} disabled />;
    case 'textarea':
      return <textarea className="form-control" placeholder={field.fieldName} disabled rows={3} />;
    case 'number':
      return <input type="number" className="form-control" placeholder={field.fieldName} disabled />;
    case 'select':
      return (
        <select className="form-select" disabled>
          <option value="">Select {field.fieldName}</option>
          {field.options.split(',').map((option: string, idx: number) => (
            <option key={idx} value={option.trim()}>{option.trim()}</option>
          ))}
        </select>
      );
    case 'radio':
      return (
        <div>
          {field.options.split(',').map((option: string, idx: number) => (
            <div className="form-check" key={idx}>
              <input className="form-check-input" type="radio" name={field.id} id={`${field.id}-${idx}`} disabled />
              <label className="form-check-label" htmlFor={`${field.id}-${idx}`}>{option.trim()}</label>
            </div>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <div>
          {field.options.split(',').map((option: string, idx: number) => (
            <div className="form-check" key={idx}>
              <input className="form-check-input" type="checkbox" id={`${field.id}-${idx}`} disabled />
              <label className="form-check-label" htmlFor={`${field.id}-${idx}`}>{option.trim()}</label>
            </div>
          ))}
        </div>
      );
    case 'date':
      return <input type="date" className="form-control" disabled />;
    case 'email':
      return <input type="email" className="form-control" placeholder={field.fieldName} disabled />;
    case 'file':
      return (
        <div className="input-group">
          <input type="file" className="form-control" disabled />
        </div>
      );
    default:
      return <input type="text" className="form-control" placeholder={field.fieldName} disabled />;
  }
};

export default FormBuilder;

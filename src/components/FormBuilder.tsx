import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField } from '../types/formBuilder';
import formService from '../services/formService';

interface FormBuilderProps {
  formFields: FormField[];
  onChange: (fields: FormField[], formName?: string) => void;
  formId?: number; // Optional form ID for editing existing forms
  initialFormName?: string; // Optional initial form name
  onBack?: () => void; // Optional callback for back button
  onSave?: (fields: FormField[], formName: string) => void; // Optional callback for save button
}

const FormBuilder: React.FC<FormBuilderProps> = ({ formFields, onChange, formId, initialFormName = 'New Form', onBack, onSave }) => {
  const [fields, setFields] = useState<FormField[]>(formFields);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [formName, setFormName] = useState<string>(initialFormName);

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

  useEffect(() => {
    setFields(formFields);
  }, [formFields]);

  const addField = (fieldType: string) => {
    const newField: FormField = {
      id: `field-${uuidv4()}`,
      fieldName: `New ${fieldType} Field`,
      fieldType,
      required: false,
      options: fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox' ? 'Option 1,Option 2,Option 3' : ''
    };
    setFields([...fields, newField]);
    onChange([...fields, newField], formName);
    setEditingField(newField); // Open settings for the new field
  };

  const removeField = (id: string) => {
    const updatedFields = fields.filter(field => field.id !== id);
    setFields(updatedFields);
    onChange(updatedFields, formName);
    
    // If we're editing the field that was removed, clear the editing state
    if (editingField && editingField.id === id) {
      setEditingField(null);
    }
  };
  
  const updateField = (updatedField: FormField) => {
    const updatedFields = fields.map(field => 
      field.id === updatedField.id ? updatedField : field
    );
    setFields(updatedFields);
    onChange(updatedFields, formName);
  };
  
  const generateIdFromLabel = (label: string): string => {
    // Convert to lowercase, replace spaces with underscores, and remove special characters
    return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  };
  
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingField) return;
    
    const newLabel = e.target.value;
    const newId = generateIdFromLabel(newLabel);
    
    // Only update the ID if it hasn't been manually modified
    const isDefaultId = editingField.id.startsWith('field-');
    
    if (isDefaultId && newId) {
      setEditingField({
        ...editingField,
        fieldName: newLabel,
        id: `field-${newId}`
      });
    } else {
      setEditingField({
        ...editingField,
        fieldName: newLabel
      });
    }
  };

  // Handlers for adding new fields via drag and drop
  const handleDragStart = (e: React.DragEvent, fieldType: string) => {
    e.dataTransfer.setData('fieldType', fieldType);
    e.dataTransfer.setData('action', 'add');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.classList) {
      e.currentTarget.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.classList) {
      e.currentTarget.classList.remove('drag-over');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.classList) {
      e.currentTarget.classList.remove('drag-over');
    }
    
    const action = e.dataTransfer.getData('action');
    
    // Handle adding new fields
    if (action === 'add') {
      const fieldType = e.dataTransfer.getData('fieldType');
      if (fieldType) {
        addField(fieldType);
      }
    }
  };
  
  // Handlers for reordering existing fields
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  
  const handleFieldDragStart = (e: React.DragEvent, fieldId: string) => {
    setDraggedFieldId(fieldId);
    e.dataTransfer.setData('fieldId', fieldId);
    e.dataTransfer.setData('action', 'reorder');
    
    // Set a ghost drag image
    const element = e.currentTarget as HTMLElement;
    if (element) {
      const rect = element.getBoundingClientRect();
      e.dataTransfer.setDragImage(element, rect.width / 2, 20);
      
      // Add a class to style the dragged element
      setTimeout(() => {
        element.style.opacity = '0.4';
      }, 0);
    }
  };
  
  const handleFieldDragEnd = (e: React.DragEvent) => {
    setDraggedFieldId(null);
    setDragOverFieldId(null);
    
    const element = e.currentTarget as HTMLElement;
    if (element) {
      element.style.opacity = '1';
    }
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
    setDragOverFieldId(null);
    
    const action = e.dataTransfer.getData('action');
    
    // Handle reordering fields
    if (action === 'reorder') {
      const sourceFieldId = e.dataTransfer.getData('fieldId');
      const targetFieldId = e.currentTarget.getAttribute('data-field-id');
      
      if (sourceFieldId && targetFieldId && sourceFieldId !== targetFieldId) {
        const updatedFields = [...fields];
        const sourceIndex = updatedFields.findIndex(field => field.id === sourceFieldId);
        const targetIndex = updatedFields.findIndex(field => field.id === targetFieldId);
        
        if (sourceIndex !== -1 && targetIndex !== -1) {
          // Remove the source field
          const [movedField] = updatedFields.splice(sourceIndex, 1);
          
          // Insert it at the target position
          updatedFields.splice(targetIndex, 0, movedField);
          
          // Update state
          setFields(updatedFields);
          onChange(updatedFields, formName);
        }
      }
    }
  };

  
  const handleFormNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormName(e.target.value);
  };
  
  const handleSave = () => {
    // If onSave prop is provided, use it, otherwise use onChange
    if (onSave) {
      onSave(fields, formName);
    } else {
      onChange(fields, formName);
      alert('Form saved successfully!');
    }
  };
  
  const handleBack = () => {
    // If onBack prop is provided, use it
    if (onBack) {
      onBack();
    } else {
      // Default behavior if no onBack provided
      if (fields.length > 0 && window.confirm('Are you sure you want to go back? Any unsaved changes will be lost.')) {
        // Navigate back or perform default action
        window.history.back();
      } else if (fields.length === 0) {
        window.history.back();
      }
    }
  };

  // Field type options for the form builder
  const availableFieldTypes = [
    { id: 'text', label: 'Text' },
    { id: 'number', label: 'Number' },
    { id: 'select', label: 'DropDown' },
    { id: 'date', label: 'Date' },
    { id: 'checkbox', label: 'CheckBox' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        padding: '20px', 
        borderBottom: '1px solid #e9ecef',
        background: 'linear-gradient(to right, #f8f9fa, #ffffff)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '8px 8px 0 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            backgroundColor: '#0d6efd', 
            color: 'white',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            F
          </div>
          <div>
            <label style={{ 
              display: 'block',
              marginBottom: '4px', 
              fontWeight: 'bold', 
              fontSize: '14px',
              color: '#495057'
            }}>
              Form Name
            </label>
            <input 
              type="text" 
              value={formName}
              onChange={handleFormNameChange}
              style={{
                padding: '10px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                width: '300px',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
              }}
              placeholder="Enter form name"
            />
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          backgroundColor: '#f8f9fa',
          padding: '8px 12px',
          borderRadius: '4px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ 
            fontSize: '13px', 
            color: '#495057',
            fontWeight: '500',
            marginRight: '8px'
          }}>
            Form ID:
          </div>
          <div style={{ 
            fontFamily: 'monospace',
            fontSize: '13px',
            backgroundColor: 'white',
            padding: '4px 8px',
            borderRadius: '3px',
            border: '1px solid #dee2e6',
            color: '#0d6efd'
          }}>
            {formId || 'New Form'}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', height: 'calc(100% - 150px)' }}>
        <div style={{ 
          width: '160px', 
          borderRight: '1px solid #e9ecef', 
          padding: '15px',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{ 
            backgroundColor: '#0d6efd', 
            color: 'white', 
            padding: '10px', 
            textAlign: 'center',
            borderRadius: '4px',
            marginBottom: '15px',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            Form Elements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableFieldTypes.map(type => (
              <div 
                key={type.id}
                draggable
                onDragStart={(e) => handleDragStart(e, type.id)}
                style={{
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  padding: '10px 5px',
                  textAlign: 'center',
                  cursor: 'grab',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#ced4da';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#dee2e6';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ 
                  position: 'absolute', 
                  top: '2px', 
                  right: '2px', 
                  fontSize: '10px',
                  color: '#6c757d'
                }}>⋮⋮</div>
                {type.label}
              </div>
            ))}
          </div>
          <div style={{ 
            marginTop: '20px', 
            padding: '10px', 
            backgroundColor: '#e9ecef', 
            borderRadius: '4px',
            fontSize: '12px',
            color: '#495057'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Tip:</div>
            <div>Drag elements to the form area to add them.</div>
          </div>
        </div>
        
        <div 
          style={{ 
            flex: 1, 
            padding: '20px',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '16px', 
              fontWeight: 'bold', 
              color: '#495057' 
            }}>
              Form Preview
            </h3>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{ 
                fontSize: '13px', 
                color: '#6c757d',
                backgroundColor: '#e9ecef',
                padding: '4px 8px',
                borderRadius: '4px'
              }}>
                {fields.length} {fields.length === 1 ? 'field' : 'fields'}
              </div>
              {fields.length > 1 && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6c757d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '14px' }}>⠿</span> Drag fields to reorder
                </div>
              )}
            </div>
          </div>
          
          {fields.length === 0 ? (
            <div style={{ 
              flex: 1,
              border: '2px dashed #dee2e6', 
              borderRadius: '5px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#6c757d',
              padding: '40px',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>📝</div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>No fields added yet</div>
              <div style={{ textAlign: 'center', fontSize: '14px' }}>Drag form elements from the left panel to build your form</div>
            </div>
          ) : (
            <div style={{ 
              flex: 1,
              border: '1px solid #dee2e6',
              borderRadius: '5px',
              padding: '15px',
              backgroundColor: '#ffffff',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
              overflowY: 'auto'
            }}>
              {fields.map((field, index) => (
                <div 
                  key={field.id}
                  data-field-id={field.id}
                  draggable
                  onDragStart={(e) => handleFieldDragStart(e, field.id)}
                  onDragEnd={handleFieldDragEnd}
                  onDragOver={(e) => handleFieldDragOver(e, field.id)}
                  onDragLeave={handleFieldDragLeave}
                  onDrop={handleFieldDrop}
                  style={{ 
                    padding: '12px', 
                    marginBottom: '10px',
                    border: editingField?.id === field.id ? '2px solid #0d6efd' : 
                           dragOverFieldId === field.id ? '2px dashed #0d6efd' : 
                           '1px solid #e9ecef',
                    borderRadius: '5px',
                    backgroundColor: editingField?.id === field.id ? '#f0f7ff' : 
                                     draggedFieldId === field.id ? '#f8f9fa' : 'white',
                    position: 'relative',
                    cursor: draggedFieldId === field.id ? 'grabbing' : 'grab',
                    boxShadow: editingField?.id === field.id ? '0 0 8px rgba(13, 110, 253, 0.25)' : 
                              dragOverFieldId === field.id ? '0 0 5px rgba(13, 110, 253, 0.15)' : 
                              '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setEditingField(field)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                    <div style={{ 
                      fontWeight: 'bold',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div 
                        style={{ 
                          color: '#adb5bd', 
                          fontSize: '16px',
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #e9ecef'
                        }}
                        title="Drag to reorder"
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = '#6c757d';
                          e.currentTarget.style.backgroundColor = '#e9ecef';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.color = '#adb5bd';
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }}
                      >
                        ⠿
                      </div>
                      {field.fieldName}
                      {field.required && (
                        <span style={{ 
                          color: '#dc3545', 
                          marginLeft: '4px', 
                          fontSize: '14px' 
                        }}>*</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(field.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc3545',
                          fontSize: '16px',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8d7da';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'flex-end'
                  }}>
                    <div>
                      <div style={{ 
                        color: '#6c757d', 
                        fontSize: '12px',
                        backgroundColor: '#e9ecef',
                        display: 'inline-block',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        marginRight: '5px'
                      }}>
                        {field.fieldType}
                      </div>
                      
                      {(field.fieldType === 'select' || field.fieldType === 'checkbox') && field.options && (
                        <div style={{ 
                          marginTop: '8px', 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '4px' 
                        }}>
                          {field.options.split(',').map((option, i) => (
                            <div key={i} style={{ 
                              fontSize: '11px', 
                              padding: '1px 5px', 
                              backgroundColor: '#f8f9fa', 
                              border: '1px solid #dee2e6',
                              borderRadius: '3px',
                              color: '#495057'
                            }}>
                              {option.trim() || `Option ${i+1}`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ 
                      color: '#adb5bd', 
                      fontSize: '10px',
                      fontFamily: 'monospace'
                    }}>
                      {field.id.substring(0, 8)}...
                    </div>
                  </div>
                  
                  {index < fields.length - 1 && (
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '-10px', 
                      left: '50%', 
                      transform: 'translateX(-50%)',
                      width: '20px',
                      height: '10px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 1
                    }}>
                      <div style={{ 
                        width: '1px', 
                        height: '10px', 
                        backgroundColor: '#dee2e6' 
                      }}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div style={{ 
        padding: '15px 20px',
        borderTop: '1px solid #dee2e6',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 -1px 3px rgba(0,0,0,0.05)',
        marginTop: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              // Handle preview functionality
              alert('Form preview functionality would be implemented here');
            }}
            style={{
              padding: '10px 16px',
              backgroundColor: 'white',
              color: '#495057',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            <span>👁️</span> Preview Form
          </button>
          <button
            onClick={() => {
              // Clear all fields
              if (window.confirm('Are you sure you want to clear all fields? This cannot be undone.')) {
                setFields([]);
                onChange([], formName);
              }
            }}
            style={{
              padding: '10px 16px',
              backgroundColor: 'white',
              color: '#dc3545',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f8d7da';
              e.currentTarget.style.borderColor = '#dc3545';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#ced4da';
            }}
          >
            <span>🗑️</span> Clear All
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleBack}
            style={{
              padding: '10px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#5a6268';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#6c757d';
            }}
          >
            <span>←</span> Back
          </button>
          <button 
            onClick={handleSave}
            style={{
              padding: '10px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#218838';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#28a745';
            }}
          >
            <span>💾</span> Save Form
          </button>
        </div>
      </div>
      
      {editingField && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '400px',
            backgroundColor: 'white',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ 
              padding: '15px 20px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: '1px solid #e9ecef', 
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '18px', 
                color: '#212529', 
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#0d6efd',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '14px'
                }}>
                  {editingField.fieldType.charAt(0).toUpperCase()}
                </span>
                Field Settings
              </h3>
              <button 
                onClick={() => setEditingField(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: '#6c757d',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#e9ecef';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  Field Label
                </label>
                <input 
                  type="text" 
                  value={editingField.fieldName}
                  onChange={handleLabelChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
                  }}
                  placeholder="Enter field label"
                  autoFocus
                />
                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                  The label that will be shown to users
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  Field ID
                </label>
                <input 
                  type="text" 
                  value={editingField.id}
                  onChange={(e) => setEditingField({...editingField, id: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  placeholder="field-id"
                />
                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                  Unique identifier for this field
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#495057'
                }}>
                  Field Type
                </label>
                <div style={{ 
                  padding: '10px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  backgroundColor: '#e9ecef',
                  fontSize: '14px',
                  color: '#495057'
                }}>
                  {editingField.fieldType.charAt(0).toUpperCase() + editingField.fieldType.slice(1)}
                </div>
                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                  The type of input field
                </div>
              </div>
              
              {(editingField.fieldType === 'select' || editingField.fieldType === 'checkbox') && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#495057'
                  }}>
                    Options
                  </label>
                  <textarea 
                    value={editingField.options}
                    onChange={(e) => setEditingField({...editingField, options: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      fontSize: '14px',
                      minHeight: '80px',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    placeholder="Option 1, Option 2, Option 3"
                  />
                  <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                    Enter options separated by commas
                  </div>
                  
                  {editingField.options && (
                    <div style={{ 
                      marginTop: '10px', 
                      padding: '10px', 
                      backgroundColor: '#f8f9fa', 
                      border: '1px solid #dee2e6',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>Preview:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {editingField.options.split(',').map((option, i) => (
                          <div key={i} style={{ 
                            fontSize: '12px', 
                            padding: '3px 8px', 
                            backgroundColor: 'white', 
                            border: '1px solid #dee2e6',
                            borderRadius: '3px'
                          }}>
                            {option.trim() || `Option ${i+1}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ 
                marginBottom: '20px', 
                padding: '12px', 
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  fontSize: '14px', 
                  cursor: 'pointer',
                  fontWeight: '500',
                  color: '#495057',
                  userSelect: 'none'
                }}>
                  <input 
                    type="checkbox" 
                    checked={editingField.required}
                    onChange={(e) => setEditingField({...editingField, required: e.target.checked})}
                    style={{ 
                      marginRight: '8px',
                      width: '16px',
                      height: '16px'
                    }}
                  />
                  Required Field
                </label>
                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px', marginLeft: '24px' }}>
                  Users must complete this field to submit the form
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  onClick={() => setEditingField(null)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#f8f9fa',
                    color: '#495057',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    updateField(editingField);
                    setEditingField(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#0d6efd',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#0b5ed7';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#0d6efd';
                  }}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      

    </div>
  );
};



export default FormBuilder;

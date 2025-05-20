import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField } from '../types/formBuilder';
import formService from '../services/formService';

interface FormBuilderProps {
  formFields: FormField[];
  onChange: (fields: FormField[], formName?: string) => void;
  formId?: number; // Optional form ID for editing existing forms
  initialFormName?: string; // Optional initial form name
}

const FormBuilder: React.FC<FormBuilderProps> = ({ formFields, onChange, formId, initialFormName = 'New Form' }) => {
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

  const handleDragStart = (e: React.DragEvent, fieldType: string) => {
    e.dataTransfer.setData('fieldType', fieldType);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fieldType = e.dataTransfer.getData('fieldType');
    if (fieldType) {
      addField(fieldType);
    }
  };

  const handleSave = () => {
    onChange(fields, formName);
  };
  
  const handleFormNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormName(e.target.value);
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
        padding: '10px 15px', 
        borderBottom: '1px solid #e9ecef',
        display: 'flex',
        alignItems: 'center'
      }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold', fontSize: '14px' }}>Form Name:</label>
        <input 
          type="text" 
          value={formName}
          onChange={handleFormNameChange}
          style={{
            padding: '6px 10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            width: '300px'
          }}
          placeholder="Enter form name"
        />
      </div>
      
      <div style={{ display: 'flex', height: 'calc(100% - 100px)' }}>
        <div style={{ width: '140px', borderRight: '1px solid #ccc', padding: '10px' }}>
          <div style={{ 
            backgroundColor: '#0d6efd', 
            color: 'white', 
            padding: '8px', 
            textAlign: 'center',
            borderRadius: '5px',
            marginBottom: '10px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            Form Elements
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {availableFieldTypes.map(type => (
              <div 
                key={type.id}
                draggable
                onDragStart={(e) => handleDragStart(e, type.id)}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  padding: '10px 5px',
                  textAlign: 'center',
                  cursor: 'grab',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  fontSize: '13px'
                }}
              >
                {type.label}
              </div>
            ))}
          </div>
        </div>
        
        <div 
          style={{ flex: 1, padding: '20px' }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {fields.length === 0 ? (
            <div style={{ 
              height: '100%', 
              border: '2px dashed #ccc', 
              borderRadius: '5px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#666'
            }}>
              Drag form elements here
            </div>
          ) : (
            <div style={{ 
              border: '1px solid #ccc',
              borderRadius: '5px',
              padding: '10px'
            }}>
              {fields.map((field) => (
                <div 
                  key={field.id}
                  style={{ 
                    padding: '10px', 
                    marginBottom: '10px',
                    border: editingField?.id === field.id ? '2px solid #0d6efd' : '1px solid #ddd',
                    borderRadius: '5px',
                    backgroundColor: editingField?.id === field.id ? '#f0f7ff' : 'white',
                    position: 'relative',
                    cursor: 'pointer',
                    boxShadow: editingField?.id === field.id ? '0 0 8px rgba(13, 110, 253, 0.25)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setEditingField(field)}
                >
                  <div style={{ fontWeight: 'bold' }}>{field.fieldName}</div>
                  <div style={{ color: '#666', fontSize: '12px' }}>{field.fieldType}</div>
                  <div style={{ color: '#666', fontSize: '10px' }}>ID: {field.id.substring(0, 8)}...</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(field.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#dc3545',
                      fontSize: '16px'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {editingField && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '300px',
          backgroundColor: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          border: '1px solid #0d6efd',
          borderRadius: '5px',
          padding: '15px',
          zIndex: 1000
        }}>
          <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e9ecef', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#0d6efd', fontWeight: 'bold' }}>Field Settings</h3>
            <button 
              onClick={() => setEditingField(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Field Label</label>
            <input 
              type="text" 
              value={editingField.fieldName}
              onChange={handleLabelChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              placeholder="Enter field label"
              autoFocus
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Field ID</label>
            <input 
              type="text" 
              value={editingField.id}
              onChange={(e) => setEditingField({...editingField, id: e.target.value})}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          
          {(editingField.fieldType === 'select' || editingField.fieldType === 'checkbox') && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Options (comma separated)</label>
              <textarea 
                value={editingField.options}
                onChange={(e) => setEditingField({...editingField, options: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  minHeight: '60px'
                }}
              />
            </div>
          )}
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={editingField.required}
                onChange={(e) => setEditingField({...editingField, required: e.target.checked})}
                style={{ marginRight: '5px' }}
              />
              Required Field
            </label>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => {
                updateField(editingField);
                setEditingField(null);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0d6efd',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '10px',
        borderTop: '1px solid #ccc',
        marginTop: 'auto'
      }}>
        <button 
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#f0f0f0', 
            border: '1px solid #ccc',
            borderRadius: '5px'
          }}
          onClick={() => window.history.back()}
        >
          Back
        </button>
        <button 
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#0d6efd', 
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  );
};



export default FormBuilder;

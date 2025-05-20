import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField } from '../types/formBuilder';
import formService from '../services/formService';

interface FormBuilderProps {
  formFields: FormField[];
  onChange: (fields: FormField[]) => void;
  formId?: number; // Optional form ID for editing existing forms
}

const FormBuilder: React.FC<FormBuilderProps> = ({ formFields, onChange, formId }) => {
  const [fields, setFields] = useState<FormField[]>(formFields);

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
    onChange([...fields, newField]);
  };

  const removeField = (id: string) => {
    const updatedFields = fields.filter(field => field.id !== id);
    setFields(updatedFields);
    onChange(updatedFields);
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
    onChange(fields);
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
      <div style={{ display: 'flex', height: 'calc(100% - 60px)' }}>
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
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    backgroundColor: 'white',
                    position: 'relative'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{field.fieldName}</div>
                  <div style={{ color: '#666', fontSize: '12px' }}>{field.fieldType}</div>
                  <button
                    onClick={() => removeField(field.id)}
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

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField } from '../types/formBuilder';
import fieldTypeService, { UiFieldType } from '../services/fieldTypeService';
import { getFieldTypeIdByName } from '../services/formService';
import { useAuth } from '../hooks/useAuth';
import '../styles/SimpleFormBuilder.css';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  FaIdBadge,
  FaCog,
  FaQuestionCircle,
  FaGripVertical
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import FormBuilderTour from './FormBuilderTour';

interface SimpleFormBuilderProps {
  formFields: FormField[];
  onChange: (fields: FormField[]) => void;
  formId?: number;
}

interface DraggableFormFieldProps {
  field: FormField;
  onEdit: (field: FormField) => void;
  onDelete: (id: string) => void;
  renderFieldPreview: (field: FormField) => React.ReactNode;
}

const DraggableFormField: React.FC<DraggableFormFieldProps> = ({
  field,
  onEdit,
  onDelete,
  renderFieldPreview
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`form-field-item ${isDragging ? 'dragging' : ''}`}
      onClick={() => onEdit(field)}
    >
      <div className="field-header">
        <div className="field-title-container">
          <div 
            className="drag-handle"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <FaGripVertical />
          </div>
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
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(field);
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
              onDelete(field.id);
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
  );
};

const SimpleFormBuilder: React.FC<SimpleFormBuilderProps> = ({
  formFields,
  onChange,
  formId
}) => {
  const { user } = useAuth();
  const [fields, setFields] = useState<FormField[]>(formFields);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fieldTypes, setFieldTypes] = useState<UiFieldType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [loadingCustomTemplates, setLoadingCustomTemplates] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Helper function to get and validate authentication token
  const getValidToken = (): string | null => {
    const token = localStorage.getItem('token');
    
    // Check if token exists and is valid (not null, empty, or "invalid_token")
    if (!token || token === 'null' || token === 'undefined' || token === 'invalid_token' || token.trim() === '') {
      console.warn('🔍 DEBUG: No valid authentication token found');
      return null;
    }
    
    return token;
  };

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start dragging after moving 8px
      },
    })
  );

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Create new array with reordered fields
        const newFields = [...fields];
        const [movedField] = newFields.splice(oldIndex, 1);
        newFields.splice(newIndex, 0, movedField);

        // Update sequence numbers
        const updatedFields = newFields.map((field, index) => ({
          ...field,
          sequence: index + 1
        }));

        setFields(updatedFields);
        onChange(updatedFields);
      }
    }
  };

  // Auto-launch disabled - users must manually start the tour
  // useEffect(() => {
  //   const hasSeenTour = localStorage.getItem('formBuilderTourCompleted');
  //   if (!hasSeenTour && fields.length === 0) {
  //     // Show tour automatically for first-time users on empty forms
  //     const timer = setTimeout(() => {
  //       setShowTour(true);
  //     }, 1000); // Small delay to let the component fully render
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, [fields.length]);

  // Handle tour completion
  const handleTourEnd = () => {
    setShowTour(false);
    localStorage.setItem('formBuilderTourCompleted', 'true');
  };
  
  // Helper function to check if user has role_id 6 (JAFAR)
  const isJafarUser = () => {
    if (!user) return false;
    
    // Check roles array
    if (user.roles && user.roles.some((role: any) => role.id === 6)) {
      return true;
    }
    
    // Check role property as string
    if (user.role === '6') {
      return true;
    }
    
    return false;
  };

  // Load field types from the database - these are generic types like Text, Number, Date, etc.
  useEffect(() => {
    console.log('🔍 DEBUG: SimpleFormBuilder useEffect triggered - loading field types!');
    const fetchFieldTypes = async () => {
      setIsLoading(true);
      try {
        // Fetch generic field types (not specific field instances)
        const types = await fieldTypeService.getUiFieldTypes();
        console.log('🔍 DEBUG: Loaded field types:', types.map(t => t.label));
        
        // Filter out Hidden and Password field types for MVP
        const filteredTypes = types.filter(type => {
          const normalizedType = type.type.toLowerCase();
          const normalizedLabel = type.label.toLowerCase();
          
          // Exclude Hidden and Password field types
          return !normalizedType.includes('hidden') && 
                 !normalizedType.includes('password') &&
                 !normalizedLabel.includes('hidden') &&
                 !normalizedLabel.includes('password');
        });
        
        console.log('🔍 DEBUG: Filtered field types (removed Hidden and Password):', filteredTypes.map(t => t.label));
        setFieldTypes(filteredTypes);
      } catch (error) {
        console.error('Error fetching field types:', error);
        toast.error('Failed to load field types from database');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFieldTypes();
  }, []);

  // Load custom templates for JAFAR users (role_id 6)
  useEffect(() => {
    if (isJafarUser()) {
      const fetchCustomTemplates = async () => {
        setLoadingCustomTemplates(true);
        try {
          const token = getValidToken();
          
          if (!token) {
            console.warn('🔍 DEBUG: No valid authentication token found for custom templates');
            return;
          }
          
          const response = await fetch('/api/custom-templates', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const templates = await response.json();
            console.log('🔍 DEBUG: Loaded custom templates:', templates);
            setCustomTemplates(templates);
          } else if (response.status === 401) {
            console.warn('🔍 DEBUG: Authentication failed for custom templates - token may be expired');
          } else {
            console.log('🔍 DEBUG: No custom templates found or error loading them:', response.status);
          }
        } catch (error) {
          console.error('Error fetching custom templates:', error);
          // Don't show error toast for custom templates as they're optional
        } finally {
          setLoadingCustomTemplates(false);
        }
      };
      
      fetchCustomTemplates();
    }
  }, [user]);
  
  // Template definitions
  const templates = [
    {
      id: 'subject',
      name: 'SUBJECT',
      description: 'First Name, Middle Name, Last Name, DOB, SSN',
      icon: <FaUser />,
      fields: ['text_input', 'text_input', 'text_input', 'date', 'text_input'] // Generic field types
    },
    {
      id: 'vehicle',
      name: 'VEHICLE',
      description: 'Make, Model, Year, VIN, License Plate',
      icon: <FaIdBadge />,
      fields: ['text_input', 'text_input', 'number', 'text_input', 'text_input'] // Generic field types
    },
    {
      id: 'financial',
      name: 'FINANCIAL',
      description: 'Bank Name, Account #, Routing #',
      icon: <FaMoneyBill />,
      fields: ['text_input', 'text_input', 'text_input'] // Generic field types
    },
    {
      id: 'address',
      name: 'ADDRESS',
      description: 'Address Line 1, Address Line 2, City, State, ZIP Code',
      icon: <FaHome />,
      fields: ['text_input', 'text_input', 'text_input', 'text_input', 'text_input'] // Generic field types
    }
  ];
  
  // Get icon component for a field type
  const getIconComponent = (fieldType: string) => {
    // Determine icon based on field type (not field name)
    const typeNormalized = fieldType.toLowerCase().replace(/\s+/g, '_');
    
    console.log('🔍 DEBUG: getIconComponent called with:', fieldType, '-> normalized:', typeNormalized);
    
    switch (typeNormalized) {
      // Text input types (matches database "Text Input")
      case 'text_input':
      case 'text':
      case 'string':
        return <div className="icon-wrapper text"><FaFont /></div>;
      
      // Textarea types (matches database "Textarea")
      case 'textarea':
      case 'paragraph':
      case 'multi_line_text':
      case 'long_text':
        return <div className="icon-wrapper textarea"><FaParagraph /></div>;
      
      // Number types (matches database "Number")
      case 'number':
      case 'numeric':
      case 'integer':
      case 'decimal':
        return <div className="icon-wrapper number"><FaHashtag /></div>;
      
      // Email types (matches database "Email")
      case 'email':
      case 'email_address':
        return <div className="icon-wrapper email">@</div>;
      
      // Phone types (matches database "Phone") 
      case 'phone':
      case 'phone_number':
      case 'telephone':
        return <div className="icon-wrapper phone">📞</div>;
      
      // Date types (matches database "Date")
      case 'date':
      case 'dob':
        return <div className="icon-wrapper date"><FaCalendarAlt /></div>;
      
      // Time types (matches database "Time")
      case 'time':
        return <div className="icon-wrapper date"><FaCalendarAlt /></div>;
      
      // DateTime types (matches database "DateTime")
      case 'datetime':
      case 'date_time':
        return <div className="icon-wrapper date"><FaCalendarAlt /></div>;
      
      // Dropdown types (matches database "Dropdown")
      case 'dropdown':
      case 'select':
      case 'choice':
      case 'options':
        return <div className="icon-wrapper dropdown"><FaListUl /></div>;
      
      // Radio button types (matches database "Radio Button")
      case 'radio_button':
      case 'radio':
      case 'single_choice':
        return <div className="icon-wrapper radio"><FaDotCircle /></div>;
      
      // Checkbox types (matches database "Checkbox")
      case 'checkbox':
      case 'boolean':
      case 'yes_no':
        return <div className="icon-wrapper checkbox"><FaCheckSquare /></div>;
      
      // File upload types (matches database "File Upload")
      case 'file_upload':
      case 'file':
      case 'attachment':
        return <div className="icon-wrapper file">📁</div>;
      
      // URL types (matches database "URL")
      case 'url':
      case 'website':
      case 'link':
        return <div className="icon-wrapper url">🔗</div>;
      
      // Legacy field types for existing forms
      case 'first_name':
      case 'middle_name':
      case 'last_name':
      case 'bank_name':
      case 'address_line_1':
      case 'address_line_2':
      case 'city':
      case 'state':
      case 'zip_code':
        return <div className="icon-wrapper text"><FaFont /></div>;
      
      case 'account_number':
      case 'routing_number':
        return <div className="icon-wrapper number"><FaHashtag /></div>;
      
      case 'address':
      case 'location':
        return <div className="icon-wrapper address"><FaHome /></div>;
      
      case 'account':
        return <div className="icon-wrapper account"><FaMoneyBill /></div>;
      
      case 'ssn':
      case 'social_security_number':
      case 'social_security':
        return <div className="icon-wrapper ssn"><FaIdCard /></div>;
      
      // Default fallback with detailed logging
      default:
        console.log('⚠️ No icon mapping found for field type:', fieldType, '-> normalized:', typeNormalized, '- using default text icon');
        return <div className="icon-wrapper text"><FaFont /></div>;
    }
  };
  
  // Add a new field to the form from a field type
  const addField = (fieldType: UiFieldType, customName?: string) => {
    // Generate a user-friendly default name based on the field type
    const generateDefaultName = (type: string) => {
      switch (type.toLowerCase()) {
        case 'text_input':
        case 'text':
          return 'Text Field';
        case 'textarea':
          return 'Text Area';
        case 'number':
          return 'Number Field';
        case 'email':
          return 'Email Address';
        case 'phone':
          return 'Phone Number';
        case 'date':
          return 'Date';
        case 'time':
          return 'Time';
        case 'datetime':
          return 'Date & Time';
        case 'dropdown':
          return 'Dropdown List';
        case 'radio_button':
        case 'radio':
          return 'Radio Buttons';
        case 'checkbox':
          return 'Checkboxes';
        case 'file_upload':
        case 'file':
          return 'File Upload';
        case 'url':
          return 'Website URL';
        default:
          return `${type} Field`;
      }
    };
    
    const newField: FormField = {
      id: uuidv4(),
      fieldName: customName || generateDefaultName(fieldType.type),
      fieldType: fieldType.type,
      fieldTypeId: fieldType.dbFieldTypeId, // Use the database field type ID
      required: false,
      options: '',
      canDelete: true,
      sequence: fields.length + 1 // Assign next sequence number
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
    
    // Define field names for each template
    const templateFieldNames = {
      subject: ['First Name', 'Middle Name', 'Last Name', 'Date of Birth', 'SSN'],
      vehicle: ['Make', 'Model', 'Year', 'VIN', 'License Plate'],
      financial: ['Bank Name', 'Account Number', 'Routing Number'],
      address: ['Address Line 1', 'Address Line 2', 'City', 'State', 'ZIP Code']
    };
    
    const fieldNames = templateFieldNames[templateId as keyof typeof templateFieldNames] || [];
    
    // Create fields based on the template - find matching field types
    const templateFields = template.fields.map((fieldTypeName, index) => {
      // Find the corresponding field type from our loaded field types
      const matchingFieldType = fieldTypes.find(ft => 
        ft.type.toLowerCase() === fieldTypeName.toLowerCase() ||
        ft.label.toLowerCase().replace(/\s+/g, '_') === fieldTypeName.toLowerCase()
      );
      
      return {
        id: uuidv4(),
        fieldName: fieldNames[index] || `Field ${index + 1}`,
        fieldType: matchingFieldType?.type || fieldTypeName,
        fieldTypeId: matchingFieldType?.dbFieldTypeId || 1, // Default to text input if not found
        required: false,
        options: '',
        canDelete: true,
        sequence: index + 1 // Assign sequence based on template order
      };
    });
    
    // Replace existing fields with the template fields
    const updatedFields = [...templateFields];
    setFields(updatedFields);
    onChange(updatedFields);
    
    toast.success(`${template.name} template applied`);
  };

  // Apply a custom template to the form
  const applyCustomTemplate = async (templateId: number) => {
    try {
      const token = getValidToken();
      
      if (!token) {
        console.error('🔍 DEBUG: No valid authentication token found for applying custom template');
        toast.error('Authentication required to apply custom template. Please log in again.');
        return;
      }
      
      // Fetch the specific custom template with its fields
      const response = await fetch(`/api/custom-templates/${templateId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication expired. Please log in again.');
          return;
        }
        throw new Error(`Failed to load custom template: ${response.status} ${response.statusText}`);
      }
      
      const templateData = await response.json();
      console.log('🔍 DEBUG: Loaded custom template data:', templateData);
      
      // Convert template fields to form fields
      const templateFields = templateData.fields.map((field: any, index: number) => ({
        id: uuidv4(),
        fieldName: field.FIELD_NAME,
        fieldType: field.fieldType || 'text_input', // fallback to text input
        fieldTypeId: field.FIELD_TYPE_ID || 1,
        required: field.IS_REQUIRED || false,
        options: field.OPTIONS || '',
        canDelete: true,
        sequence: index + 1 // Assign sequence based on template field order
      }));
      
      // Replace existing fields with the template fields
      setFields(templateFields);
      onChange(templateFields);
      
      toast.success(`Custom template "${templateData.form.FORM_NAME}" applied`);
    } catch (error) {
      console.error('Error applying custom template:', error);
      toast.error('Failed to apply custom template');
    }
  };
  
  // Handle drag start event
  const handleDragStart = (e: React.DragEvent, fieldType: UiFieldType) => {
    e.dataTransfer.setData('fieldType', JSON.stringify(fieldType));
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
    
    const fieldTypeData = e.dataTransfer.getData('fieldType');
    
    if (fieldTypeData) {
      try {
        const fieldType: UiFieldType = JSON.parse(fieldTypeData);
        addField(fieldType);
      } catch (error) {
        console.error('Error parsing dropped field type:', error);
        toast.error('Invalid field type dropped');
      }
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
            className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
            style={{ borderRadius: '6px' }}
            placeholder={field.fieldName} 
            disabled 
          />
        );
      case 'paragraph':
        return (
          <textarea 
            className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
            style={{ borderRadius: '6px' }}
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
            className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
            style={{ borderRadius: '6px' }}
            placeholder={field.fieldName} 
            disabled 
          />
        );
      case 'date':
      case 'dob':
        return (
          <input 
            type="date" 
            className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
            style={{ borderRadius: '6px' }}
            disabled 
          />
        );
      case 'ssn':
        return (
          <input 
            type="password" 
            className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
            style={{ borderRadius: '6px' }}
            placeholder="XXX-XX-XXXX" 
            disabled 
          />
        );
      default:
        return (
          <input 
            type="text" 
            className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
            style={{ borderRadius: '6px' }}
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
              className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
              style={{ borderRadius: '6px' }}
              id="fieldName" 
              value={editingField.fieldName} 
              onChange={(e) => setEditingField({...editingField, fieldName: e.target.value})}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="fieldType" className="form-label">Field Type</label>
            <select 
              className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
              style={{ borderRadius: '6px' }}
              id="fieldType" 
              value={editingField.fieldType}
              onChange={(e) => setEditingField({...editingField, fieldType: e.target.value})}
            >
              {fieldTypes
                .filter(type => {
                  const normalizedType = type.type.toLowerCase();
                  const normalizedLabel = type.label.toLowerCase();
                  // Filter out Hidden and Password field types from dropdown
                  return !normalizedType.includes('hidden') && 
                         !normalizedType.includes('password') &&
                         !normalizedLabel.includes('hidden') &&
                         !normalizedLabel.includes('password');
                })
                .map((type) => (
                  <option key={type.type} value={type.type}>{type.label}</option>
                ))
              }
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
              className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
              style={{ borderRadius: '6px' }}
              id="placeholder" 
              value={editingField.placeholder || ''}
              onChange={(e) => setEditingField({...editingField, placeholder: e.target.value})}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="helpText" className="form-label">Help Text</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 border border-gray-5 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all" 
              style={{ borderRadius: '6px' }}
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
        {/* Custom Workflow Templates section - Only for JAFAR users (role_id 6) */}
        {isJafarUser() && (
          <div className="forms-section">
            <h4 className="mb-2">
              <FaCog className="me-2" style={{ fontSize: '16px', verticalAlign: 'middle' }} />
              CUSTOM WORKFLOW TEMPLATES
            </h4>
            {loadingCustomTemplates ? (
              <div className="text-center p-2">
                <small className="text-muted">Loading custom templates...</small>
              </div>
            ) : customTemplates.length > 0 ? (
              <div className="forms-grid">
                {customTemplates.map((template) => (
                  <button 
                    key={template.FORM_ID} 
                    type="button" 
                    className="form-btn custom-template" 
                    onClick={() => applyCustomTemplate(template.FORM_ID)}
                    title={template.FORM_DESCRIPTION || template.FORM_NAME}
                  >
                    {template.FORM_NAME}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center p-2">
                {!getValidToken() ? (
                  <small className="text-muted">Login required for custom templates</small>
                ) : (
                  <small className="text-muted">No custom templates found</small>
                )}
              </div>
            )}
          </div>
        )}
        
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
        <h4 className="mb-3">FIELD TYPES</h4>
        <div className="field-grid">
          {console.log('🔍 DEBUG: Rendering fieldTypes:', fieldTypes.length, 'types')}
          {console.log('🔍 DEBUG: Field types:', fieldTypes.map(t => `${t.label} (type: ${t.type})`))}
          {fieldTypes.map((fieldType, index) => {
            console.log('🔍 DEBUG: Processing field type:', fieldType);
            return (
            <div
              key={`${fieldType.dbFieldTypeId}-${index}`}
              className="field-item"
              draggable
              onDragStart={(e) => handleDragStart(e, fieldType)}
              onClick={() => addField(fieldType)}
              title={`Click or drag to add ${fieldType.label}`}
            >
              {getIconComponent(fieldType.type)}
              <div className="field-label">{fieldType.label}</div>
            </div>
            );
          })}
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
        {/* Header with tour button */}
        <div className="form-builder-header">
          <h3>Form Preview</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm tour-button"
              onClick={() => setShowTour(true)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '500',
                borderRadius: '20px'
              }}
              title="Take a guided tour of the form builder"
            >
              <FaQuestionCircle />
              Take Tour
            </button>
            
            {/* Development helper - only show in development */}
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  localStorage.removeItem('formBuilderTourCompleted');
                  toast.info('Tour reset! Refresh to see auto-tour on empty forms.');
                }}
                style={{ 
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '12px'
                }}
                title="Reset tour for testing (development only)"
              >
                Reset Tour
              </button>
            )}
          </div>
        </div>
        
        {/* Form preview */}
        <div 
          className={`form-preview ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          
          {fields.length === 0 ? (
            <div className="empty-form-message">
              <p>Drag and drop fields here or click a field type to add it.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map(field => field.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="form-fields">
                  {fields.map((field) => (
                    <DraggableFormField
                      key={field.id}
                      field={field}
                      onEdit={setEditingField}
                      onDelete={removeField}
                      renderFieldPreview={renderFieldPreview}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
      
      {/* Field editor modal */}
      {renderFieldEditor()}
      
      {/* Form Builder Tour */}
      <FormBuilderTour 
        run={showTour} 
        onTourEnd={handleTourEnd}
      />
    </div>
  );
};

export default SimpleFormBuilder;

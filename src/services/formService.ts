import api from '../utils/api';
import { FormField } from '../types/formBuilder';

// Define types for database interactions
export interface FieldType {
  FIELD_TYPE_ID: number;
  FIELD_TYPE_NAME: string;
  FIELD_TYPE_DESCRIPTION?: string;
  IS_ACTIVE: boolean;
  id: string;
  label: string;
  icon: string;
}

export interface DbField {
  FIELD_ID?: number;
  FIELD_NAME: string;
  FIELD_TYPE_ID: number;
  FORM_ID?: number;
  IS_REQUIRED: boolean;
  OPTIONS?: string | null;
  SEQUENCE: number;
  IS_ACTIVE: boolean;
  IS_DELETED: boolean;
  CREATE_USER_ID?: number;
  UPDATE_USER_ID?: number;
}

export interface DbForm {
  FORM_ID?: number;
  FORM_NAME: string;
  FORM_DESCRIPTION?: string;
  ORGANIZATION_ID?: number;
  IS_PUBLIC: boolean;
  IS_ACTIVE: boolean;
  IS_DELETED: boolean;
  CREATE_USER_ID?: number;
  UPDATE_USER_ID?: number;
}

// Mock field types for development
const mockFieldTypes: FieldType[] = [
  { 
    FIELD_TYPE_ID: 1, 
    FIELD_TYPE_NAME: 'Text', 
    FIELD_TYPE_DESCRIPTION: 'Single line text input', 
    IS_ACTIVE: true,
    id: 'text',
    label: 'Text Field',
    icon: 'T'
  },
  { 
    FIELD_TYPE_ID: 2, 
    FIELD_TYPE_NAME: 'TextArea', 
    FIELD_TYPE_DESCRIPTION: 'Multi-line text input', 
    IS_ACTIVE: true,
    id: 'textarea',
    label: 'Text Area',
    icon: 'TA'
  },
  { 
    FIELD_TYPE_ID: 3, 
    FIELD_TYPE_NAME: 'Number', 
    FIELD_TYPE_DESCRIPTION: 'Numeric input', 
    IS_ACTIVE: true,
    id: 'number',
    label: 'Number',
    icon: '#'
  },
  { 
    FIELD_TYPE_ID: 4, 
    FIELD_TYPE_NAME: 'Select', 
    FIELD_TYPE_DESCRIPTION: 'Dropdown selection', 
    IS_ACTIVE: true,
    id: 'select',
    label: 'Dropdown',
    icon: '▼'
  },
  { 
    FIELD_TYPE_ID: 5, 
    FIELD_TYPE_NAME: 'Radio', 
    FIELD_TYPE_DESCRIPTION: 'Radio button selection', 
    IS_ACTIVE: true,
    id: 'radio',
    label: 'Radio Buttons',
    icon: '○'
  },
  { 
    FIELD_TYPE_ID: 6, 
    FIELD_TYPE_NAME: 'Checkbox', 
    FIELD_TYPE_DESCRIPTION: 'Checkbox selection', 
    IS_ACTIVE: true,
    id: 'checkbox',
    label: 'Checkboxes',
    icon: '☑'
  },
  { 
    FIELD_TYPE_ID: 7, 
    FIELD_TYPE_NAME: 'Date', 
    FIELD_TYPE_DESCRIPTION: 'Date selection', 
    IS_ACTIVE: true,
    id: 'date',
    label: 'Date',
    icon: '📅'
  },
  { 
    FIELD_TYPE_ID: 8, 
    FIELD_TYPE_NAME: 'Email', 
    FIELD_TYPE_DESCRIPTION: 'Email input', 
    IS_ACTIVE: true,
    id: 'email',
    label: 'Email',
    icon: '@'
  },
  { 
    FIELD_TYPE_ID: 9, 
    FIELD_TYPE_NAME: 'File', 
    FIELD_TYPE_DESCRIPTION: 'File upload', 
    IS_ACTIVE: true,
    id: 'file',
    label: 'File Upload',
    icon: '📎'
  }
];

// Helper function to get icon name for field type
export function getIconForFieldType(fieldTypeName: string): string {
  const typeToIconMap: Record<string, string> = {
    'Text': 'text',
    'Textarea': 'textarea',
    'Number': 'number',
    'Select': 'select',
    'Date': 'date',
    'Account Number': 'account_number',
    'Address': 'address',
    'SSN': 'ssn',
    'DOB': 'dob'
  };
  
  return typeToIconMap[fieldTypeName] || 'text';
}

// Form service for handling form-related API calls
const formService = {
  // Get all field types from the database
  getFieldTypes: async (): Promise<FieldType[]> => {
    try {
      const response = await api.get('/api/field-types');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      } else {
        console.warn('No field types returned from API, using mock data');
        return mockFieldTypes;
      }
    } catch (error) {
      console.error('Error fetching field types:', error);
      // Fall back to mock data if API call fails
      console.log('Using mock field types as fallback');
      return mockFieldTypes;
    }
  },
  
  // Get field types in the format expected by SimpleFormBuilder
  getFormBuilderFieldTypes: async () => {
    try {
      const fieldTypes = await formService.getFieldTypes();
      
      // Map database field types to the format expected by SimpleFormBuilder
      return fieldTypes.map((fieldType: any) => ({
        type: fieldType.FIELD_TYPE_NAME.toLowerCase().replace(/\s+/g, '_'),
        label: fieldType.FIELD_TYPE_NAME,
        dbFieldTypeId: fieldType.FIELD_TYPE_ID,
        icon: getIconForFieldType(fieldType.FIELD_TYPE_NAME)
      }));
    } catch (error) {
      console.error('Error mapping field types for form builder:', error);
      // Return default field types if there's an error
      return [
        { type: 'text', label: 'Text', icon: 'text' },
        { type: 'textarea', label: 'Text Area', icon: 'textarea' },
        { type: 'number', label: 'Number', icon: 'number' },
        { type: 'select', label: 'Dropdown', icon: 'select' },
        { type: 'date', label: 'Date', icon: 'date' }
      ];
    }
  },

  // Get a specific form by ID
  getFormById: async (formId: number): Promise<{ form: DbForm, fields: DbField[] }> => {
    try {
      const response = await api.get(`/api/forms/${formId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching form ${formId}:`, error);
      throw error;
    }
  },

  // Get all forms
  getAllForms: async (): Promise<DbForm[]> => {
    try {
      const response = await api.get('/api/forms');
      return response.data;
    } catch (error) {
      console.error('Error fetching all forms:', error);
      // Return empty array instead of throwing error
      return [];
    }
  },

  // Create a new form with fields
  createForm: async (form: DbForm, fields: DbField[]): Promise<{ form: DbForm, fields: DbField[] }> => {
    try {
      const response = await api.post('/api/forms', { form, fields });
      return response.data;
    } catch (error) {
      console.error('Error creating form:', error);
      throw error;
    }
  },

  // Update an existing form with fields
  updateForm: async (formId: number, form: DbForm, fields: DbField[]): Promise<{ form: DbForm, fields: DbField[] }> => {
    try {
      const response = await api.put(`/api/forms/${formId}`, { form, fields });
      return response.data;
    } catch (error) {
      console.error(`Error updating form with ID ${formId}:`, error);
      throw error;
    }
  },

  // Delete a form
  deleteForm: async (formId: number): Promise<void> => {
    try {
      await api.delete(`/api/forms/${formId}`);
    } catch (error) {
      console.error(`Error deleting form with ID ${formId}:`, error);
      throw error;
    }
  },

  // Convert UI form fields to database fields
  convertFormFieldsToDbFields: (formFields: FormField[]): DbField[] => {
    return formFields.map((field, index) => {
      // Get field type ID based on field type name
      const fieldTypeId = getFieldTypeIdByName(field.fieldType);
      
      return {
        FIELD_ID: field.dbFieldId, // If this field already exists in the database
        FIELD_NAME: field.fieldName,
        FIELD_TYPE_ID: fieldTypeId,
        IS_REQUIRED: field.required,
        OPTIONS: field.options || null,
        SEQUENCE: index + 1, // 1-based sequence
        IS_ACTIVE: true,
        IS_DELETED: false
      };
    });
  },

  // Convert database fields to UI form fields
  convertDbFieldsToFormFields: (dbFields: DbField[]): FormField[] => {
    return dbFields.map(field => {
      // Get field type name based on field type ID
      const fieldType = getFieldTypeNameById(field.FIELD_TYPE_ID);
      
      return {
        id: `field-${field.FIELD_ID || Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        fieldName: field.FIELD_NAME,
        fieldType,
        required: field.IS_REQUIRED,
        options: field.OPTIONS || '',
        dbFieldId: field.FIELD_ID
      };
    });
  },

  // Get form for a specific request
  getRequestForm: async (requestId: number): Promise<{
    request: any;
    form: any;
    fields: any[];
    values: Record<string, any>;
    formInstanceId: number;
  }> => {
    try {
      console.log('[FORM SERVICE] Making request to:', `/api/requests/${requestId}/form`);
      const response = await api.get(`/api/requests/${requestId}/form`);
      console.log('[FORM SERVICE] Response status:', response.status);
      console.log('[FORM SERVICE] Response headers:', response.headers);
      console.log('[FORM SERVICE] Response data type:', typeof response.data);
      console.log('[FORM SERVICE] Response data:', response.data);
      
      // Check if response is HTML (indicating a routing issue)
      if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
        console.error('[FORM SERVICE] Received HTML instead of JSON - API endpoint not found');
        throw new Error('API endpoint returned HTML instead of JSON. This usually means the API route is not found or there is a routing issue.');
      }
      
      // Validate response structure
      if (!response.data || typeof response.data !== 'object') {
        console.error('[FORM SERVICE] Invalid response format:', response.data);
        throw new Error('Invalid response format from API');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[FORM SERVICE] Error fetching request form:', error);
      
      // Handle specific 404 error for missing form templates
      if (error.response?.status === 404 && error.response?.data?.details) {
        console.error('[FORM SERVICE] Form template not found:', error.response.data.details);
        throw new Error(`Form template not available: ${error.response.data.details}`);
      }
      
      // Provide more specific error information
      if (error instanceof Error) {
        console.error('[FORM SERVICE] Error message:', error.message);
        console.error('[FORM SERVICE] Error stack:', error.stack);
      }
      
      throw error;
    }
  },

  // Submit form data
  submitForm: async (requestId: number, fieldValues: Record<string, any>, options: { isComplete?: boolean, isDraft?: boolean } = {}): Promise<any> => {
    try {
      const response = await api.post(`/api/requests/${requestId}/form/submit`, { 
        fieldValues, 
        isComplete: options.isComplete || false,
        isDraft: options.isDraft || false
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting form:', error);
      throw error;
    }
  },

  // Save form draft
  saveDraft: async (requestId: number, fieldValues: Record<string, any>): Promise<any> => {
    try {
      const response = await api.post(`/api/requests/${requestId}/form/submit`, { 
        fieldValues, 
        isComplete: false,
        isDraft: true
      });
      return response.data;
    } catch (error) {
      console.error('Error saving form draft:', error);
      throw error;
    }
  },

  // Complete form submission
  completeForm: async (requestId: number, fieldValues: Record<string, any>): Promise<any> => {
    try {
      const response = await api.post(`/api/requests/${requestId}/form/submit`, { 
        fieldValues, 
        isComplete: true,
        isDraft: false
      });
      return response.data;
    } catch (error) {
      console.error('Error completing form:', error);
      throw error;
    }
  }
};

// Helper function to get field type ID by name
export function getFieldTypeIdByName(fieldTypeName: string): number {
  const fieldTypeMap: Record<string, number> = {
    'text': 1,
    'textarea': 2,
    'number': 3,
    'select': 4,
    'radio': 5,
    'checkbox': 6,
    'date': 7,
    'email': 8,
    'file': 9
  };
  
  return fieldTypeMap[fieldTypeName] || 1; // Default to text (1) if not found
}

// Helper function to get field type name by ID
function getFieldTypeNameById(fieldTypeId: number): string {
  const fieldTypeMap: Record<number, string> = {
    1: 'text',
    2: 'textarea',
    3: 'number',
    4: 'select',
    5: 'radio',
    6: 'checkbox',
    7: 'date',
    8: 'email',
    9: 'file'
  };
  
  return fieldTypeMap[fieldTypeId] || 'text'; // Default to text if not found
}

// This function is now defined above, so we don't need to redefine it here

export default formService;

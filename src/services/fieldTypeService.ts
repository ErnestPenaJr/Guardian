import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Interface for database field types
export interface DbFieldType {
  FIELD_TYPE_ID: number;
  FIELD_TYPE_NAME: string;
  FIELD_TYPE_DESC: string;
  SORT_ORDER: number;
}

// Interface for UI field types
export interface UiFieldType {
  type: string;
  label: string;
  icon: string;
  dbFieldTypeId: number;
}

// No default field types - all field types will be loaded from the database

// Get icon for field type
const getIconForFieldType = (fieldTypeName: string): string => {
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
};

// Field type service
const fieldTypeService = {
  // Get field types from the database
  getDbFieldTypes: async (): Promise<DbFieldType[]> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/field-types`);
      return response.data;
    } catch (error) {
      console.error('Error fetching field types:', error);
      return [];
    }
  },
  
  // Get field types in the format expected by the UI
  getUiFieldTypes: async (): Promise<UiFieldType[]> => {
    try {
      const dbFieldTypes = await fieldTypeService.getDbFieldTypes();
      
      if (!dbFieldTypes || dbFieldTypes.length === 0) {
        console.error('No field types found in database');
        return [];
      }
      
      return dbFieldTypes.map(fieldType => ({
        type: fieldType.FIELD_TYPE_DESC.toLowerCase().replace(/\s+/g, '_'),
        label: fieldType.FIELD_TYPE_DESC,
        icon: getIconForFieldType(fieldType.FIELD_TYPE_DESC),
        dbFieldTypeId: fieldType.FIELD_TYPE_ID
      }));
    } catch (error) {
      console.error('Error mapping field types for UI:', error);
      return [];
    }
  }
};

export default fieldTypeService;

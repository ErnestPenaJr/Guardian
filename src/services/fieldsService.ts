import api from '../utils/api';

// Interface for database fields
export interface DbField {
  FIELD_ID: number;
  FIELD_NAME: string;
  FIELD_TYPE_ID: number;
  DISPLAY_FORMAT: string | null;
  HAS_LOOKUP: boolean;
  IS_PUBLIC: boolean;
  IS_ACTIVE: boolean;
  IS_DELETED: boolean;
  IS_REQUIRED: boolean;
  IS_SENSITIVE: boolean;
  CAN_SELECT_MULIPLE: boolean;
  FIELD_TYPE: {
    FIELD_TYPE_ID: number;
    FIELD_TYPE_DESC: string;
    SORT_ORDER: number | null;
  };
}

// Interface for UI fields
export interface UiField {
  id: number;
  name: string;
  type: string;
  fieldTypeId: number;
  isRequired: boolean;
  isSensitive: boolean;
}

// Fields service
const fieldsService = {
  // Get fields from the database
  getDbFields: async (): Promise<DbField[]> => {
    try {
      const response = await api.get('/api/fields');
      return response.data;
    } catch (error) {
      console.error('Error fetching fields:', error);
      return [];
    }
  },
  
  // Get fields in the format expected by the UI
  getUiFields: async (): Promise<UiField[]> => {
    try {
      const dbFields = await fieldsService.getDbFields();
      
      if (!dbFields || dbFields.length === 0) {
        console.error('No fields found in database');
        return [];
      }
      
      return dbFields.map(field => ({
        id: field.FIELD_ID,
        name: field.FIELD_NAME,
        type: field.FIELD_TYPE.FIELD_TYPE_DESC.toLowerCase().replace(/\s+/g, '_'),
        fieldTypeId: field.FIELD_TYPE_ID,
        isRequired: field.IS_REQUIRED,
        isSensitive: field.IS_SENSITIVE
      }));
    } catch (error) {
      console.error('Error mapping fields for UI:', error);
      return [];
    }
  }
};

export default fieldsService;

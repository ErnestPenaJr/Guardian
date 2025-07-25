export interface FormField {
  id: string;
  fieldName: string;
  fieldType: string;
  required: boolean;
  options: string;
  dbFieldId?: number; // Reference to the database FIELD_ID if it exists
  canDelete?: boolean; // Whether the field can be deleted
  placeholder?: string; // Placeholder text for the field
  helpText?: string; // Help text for the field
  validation?: string; // Validation rules for the field
  defaultValue?: string; // Default value for the field
  sequence?: number; // Field order/sequence in the form
  isActive?: boolean; // Whether the field is active
  fieldTypeId?: number; // Database field type ID for proper saving
}

export interface FormFieldType {
  id: string;
  label: string;
  icon: string;
  category?: string; // Category for grouping field types (e.g., 'basic', 'advanced')
}

export interface Subject {
  id: string;
  title: string; // e.g., 'Subject 1', 'Subject 2'
  fields: FormField[];
}

export interface Template {
  id: string;
  name: string; // e.g., 'SUBJECT', 'FINANCIAL', 'ADDRESS'
  icon?: string; // Icon for the template
  description?: string; // Description of the template
  fields: FormField[];
}

export interface FormData {
  id?: number; // FORM_ID from database
  name: string; // FORM_NAME
  description: string; // FORM_DESCRIPTION
  isPublic: boolean; // IS_PUBLIC
  isActive: boolean; // IS_ACTIVE
  fields: FormField[];
  subjects?: Subject[]; // Subjects in the form
  templates?: Template[]; // Available templates
  formType?: string; // 'request', 'self-service', or 'notice'
  organizationId?: number; // Company/organization ID for multi-tenancy
  isDeleted?: boolean; // Soft delete flag
  createUserId?: number; // User who created the form
  updateUserId?: number; // User who last updated the form
  createDate?: Date; // Creation timestamp
  updateDate?: Date; // Last update timestamp
}

// Enhanced interface for form validation and database operations
export interface FormValidation {
  isValid: boolean;
  errors: FormValidationError[];
}

export interface FormValidationError {
  field: string;
  message: string;
  type: 'required' | 'invalid' | 'duplicate';
}

// Interface for form saving operations
export interface FormSaveRequest {
  form: {
    FORM_NAME: string;
    FORM_DESCRIPTION?: string;
    IS_PUBLIC?: boolean;
    IS_ACTIVE?: boolean;
    ORGANIZATION_ID?: number;
  };
  fields: {
    FIELD_ID?: number;
    FIELD_NAME: string;
    FIELD_TYPE_ID: number;
    IS_REQUIRED: boolean;
    OPTIONS?: string;
    SEQUENCE: number;
    IS_ACTIVE?: boolean;
  }[];
}

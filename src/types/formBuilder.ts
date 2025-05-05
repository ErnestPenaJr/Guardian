export interface FormField {
  id: string;
  fieldName: string;
  fieldType: string;
  required: boolean;
  options: string;
  dbFieldId?: number; // Reference to the database FIELD_ID if it exists
}

export interface FormFieldType {
  id: string;
  label: string;
  icon: string;
}

export interface FormData {
  id?: number; // FORM_ID from database
  name: string; // FORM_NAME
  description: string; // FORM_DESCRIPTION
  isPublic: boolean; // IS_PUBLIC
  isActive: boolean; // IS_ACTIVE
  fields: FormField[];
}

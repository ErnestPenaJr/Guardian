export type TemplateType = 'notice' | 'request';
export type TemplateStatus = 'draft' | 'active' | 'inactive';

export type TemplateFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file_upload';

export interface TemplateField {
  FIELD_ID: number;
  FIELD_NAME: string;
  FIELD_TYPE_ID: number;
  fieldType?: string;
  IS_REQUIRED: boolean;
  SORT_ORDER?: number;
  OPTIONS?: string | null;
  DISPLAY_FORMAT?: string | null;
}

export interface TemplateSummary {
  FORM_ID: number;
  FORM_NAME: string;
  FORM_DESCRIPTION: string;
  TEMPLATE_TYPE: TemplateType;
  STATUS: TemplateStatus;
  IS_ACTIVE: boolean;
  IS_PUBLIC: boolean;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  fieldCount?: number;
}

export interface TemplateDetail {
  form: {
    FORM_ID: number;
    FORM_NAME: string;
    FORM_DESCRIPTION: string;
    TEMPLATE_TYPE: TemplateType;
    STATUS: TemplateStatus;
    IS_ACTIVE: boolean;
    IS_PUBLIC: boolean;
    COMPANY_ID: number;
  };
  fields: TemplateField[];
}

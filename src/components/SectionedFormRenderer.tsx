import React from 'react';
import FidelitySubjectFormLayout from './FidelitySubjectFormLayout';
import SmartFormLayout from './SmartFormLayout';

interface FormField {
  FIELD_ID: number;
  FIELD_NAME: string;
  FIELD_TYPE_DESC?: string;
  IS_SENSITIVE?: boolean;
  HAS_LOOKUP?: boolean;
  IS_REQUIRED?: boolean;
  OPTIONS?: string;
  [key: string]: unknown;
}

interface Props {
  formName: string;
  fields: FormField[];
  /** Values keyed by String(FIELD_ID) */
  fieldValues: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  readOnly?: boolean;
  /** Set of field names that failed validation — used to highlight required fields */
  validationErrors?: Set<string>;
  /** Request ID — passed to Fidelity form for attachments + print */
  requestId?: number;
}

const SectionedFormRenderer: React.FC<Props> = ({
  formName,
  fields,
  fieldValues,
  onChange,
  readOnly = false,
  validationErrors,
  requestId,
}) => {
  // Fidelity-Subject gets its custom document-style layout
  if (formName?.trim() === 'Fidelity-Subject' && fields.length > 0) {
    return (
      <FidelitySubjectFormLayout
        fields={fields}
        fieldValues={fieldValues}
        onChange={onChange}
        readOnly={readOnly}
        validationErrors={validationErrors}
        requestId={requestId}
      />
    );
  }

  // All other forms use the smart auto-layout (document style with intelligent field pairing)
  return (
    <SmartFormLayout
      formName={formName}
      fields={fields}
      fieldValues={fieldValues}
      onChange={onChange}
      readOnly={readOnly}
    />
  );
};

export default SectionedFormRenderer;

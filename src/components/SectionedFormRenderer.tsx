import React from 'react';
import { Accordion, Badge, Form } from 'react-bootstrap';
import FidelitySubjectFormLayout from './FidelitySubjectFormLayout';

// Static section config keyed by FORM_NAME
const FORM_SECTIONS: Record<string, Array<{ title: string; fields: string[] }>> = {
  'Fidelity-Subject': [
    {
      title: 'Header',
      fields: ['Case #'],
    },
    {
      title: 'Subject Identification',
      fields: [
        'First Name', 'Middle Name', 'Last Name', 'Suffix', 'AKA(s)',
        'Date of Birth', 'Social Security Number', "State Driver's License",
        'DL Issuing State', 'Account Number', 'FBI SID Number', 'Other ID #',
      ],
    },
    {
      title: 'Demographics',
      fields: [
        'Gender', 'Race', 'Place of Birth (City)', 'Place of Birth (State)',
        'Place of Birth (Country)', 'Height', 'Weight', 'Eye Color',
        'Hair Color', 'Tattoos / Marks', 'Special Notes',
      ],
    },
    {
      title: 'Contact & Digital Identifiers',
      fields: [
        'Address', 'Phone Number', 'IP Address',
        'Social Media Platform', 'Social Media Handle', 'Social Media URL',
      ],
    },
    {
      title: 'Criminal History',
      fields: ['Criminal History'],
    },
    {
      title: 'Other Subject Notes',
      fields: ['Other Subject Notes'],
    },
    {
      title: 'Investigative Notes',
      fields: ['Investigative/Intel Notes'],
    },
    {
      title: 'Minimum Collection Checklist',
      fields: [
        'Account Statements', 'FinCEN / SAR', 'Master OBI / TRAP Data',
        'Address Information', 'Phone Numbers / Emails', 'Phone Calls',
        'Branch Video / Photographs', 'Wire / ACH Activity', 'Deposit Activity',
        'Withdrawal Activity', 'Crypto Activity', 'Securities Activity',
        'Debit Card / SMS Alerts', 'AUTHLOGS / IP Data', 'DOC V x2',
        'Account Holder Interviewed', 'Social Media (Checklist)', 'Additional Contact Info',
      ],
    },
    {
      title: 'Sources: Subject Identification',
      fields: [
        'Flashpoint', 'Photo', 'Vehicle - Plate Number',
        'Vehicle - State', 'Vehicle - Description',
      ],
    },
    {
      title: 'Property Data Sources',
      fields: ['Map Overlay', 'Street View', 'City / Town Tax Card'],
    },
    {
      title: 'Background Databases',
      fields: ['CLEAR / Lexis Nexis'],
    },
    {
      title: 'OSINT / SOCMINT',
      fields: ['Social Media / CTI', 'OSINT Notes'],
    },
    {
      title: 'Additional Data',
      fields: ['Additional Data Notes'],
    },
  ],
};

// Sensitive field names that should display a lock icon
const SENSITIVE_FIELDS = new Set([
  'Social Security Number',
  'Date of Birth',
  'Account Number',
  "State Driver's License",
  'FBI SID Number',
]);

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
}

interface SectionStats {
  filled: number;
  total: number;
  hasUnfilledRequired: boolean;
}

function getCompletionStats(
  sectionFieldNames: string[],
  fields: FormField[],
  fieldValues: Record<string, string>,
): SectionStats {
  let filled = 0;
  let total = 0;
  let hasUnfilledRequired = false;

  for (const name of sectionFieldNames) {
    const field = fields.find(f => f.FIELD_NAME === name);
    if (!field) continue;
    total++;
    const val = fieldValues[String(field.FIELD_ID)] ?? '';
    if (val.trim() !== '') {
      filled++;
    } else if (field.IS_REQUIRED) {
      hasUnfilledRequired = true;
    }
  }

  return { filled, total, hasUnfilledRequired };
}

function getInputType(fieldName: string, fieldTypeDesc?: string): string {
  const lower = fieldName.toLowerCase();
  if (fieldTypeDesc === 'date' || lower.includes('dob') || lower.includes('date') || lower.includes('birth')) {
    return 'date';
  }
  if (
    lower.includes('phone') ||
    lower.includes('ssn') ||
    lower.includes('social security') ||
    lower.includes('number') ||
    lower.includes('zip') ||
    lower.includes('postal') ||
    fieldTypeDesc === 'number'
  ) {
    return 'tel';
  }
  if (lower.includes('email') || fieldTypeDesc === 'email') {
    return 'email';
  }
  if (lower.includes('url') || lower.includes('website') || fieldTypeDesc === 'url') {
    return 'url';
  }
  return 'text';
}

const RADIO_OPTIONS = ['Positive', 'Negative', 'Not Reviewed'];

function isRadioField(field: FormField): boolean {
  const desc = (field.FIELD_TYPE_DESC || '').toLowerCase();
  return desc === 'radio' || desc === 'radio_button';
}

function isTextareaField(field: FormField): boolean {
  const desc = (field.FIELD_TYPE_DESC || '').toLowerCase();
  const lower = field.FIELD_NAME.toLowerCase();
  return (
    desc === 'textarea' ||
    lower.includes('notes') ||
    lower.includes('history') ||
    lower.includes('description') ||
    lower.includes('activity') ||
    lower.includes('data notes')
  );
}

interface FieldInputProps {
  field: FormField;
  value: string;
  onChange: (fieldId: string, value: string) => void;
  readOnly: boolean;
}

const FieldInput: React.FC<FieldInputProps> = ({ field, value, onChange, readOnly }) => {
  const fieldId = String(field.FIELD_ID);
  const isSensitive =
    field.IS_SENSITIVE === true || SENSITIVE_FIELDS.has(field.FIELD_NAME);

  const labelEl = (
    <Form.Label className="fw-medium text-dark mb-1" style={{ fontSize: '0.85rem' }}>
      {field.FIELD_NAME}
      {field.IS_REQUIRED && <span className="text-danger ms-1">*</span>}
      {isSensitive && (
        <span className="ms-1 text-muted" title="Sensitive personal information" style={{ fontSize: '0.75rem' }}>
          🔒
        </span>
      )}
    </Form.Label>
  );

  // Radio button field
  if (isRadioField(field)) {
    return (
      <div className="mb-2">
        {labelEl}
        <div className="d-flex gap-3 mt-1">
          {RADIO_OPTIONS.map(opt => (
            <Form.Check
              key={opt}
              type="radio"
              id={`${fieldId}-${opt}`}
              label={opt}
              name={`field-${fieldId}`}
              value={opt}
              checked={value === opt}
              onChange={() => !readOnly && onChange(fieldId, opt)}
              disabled={readOnly}
              className="small"
            />
          ))}
        </div>
      </div>
    );
  }

  // Select (HAS_LOOKUP or select type)
  if (field.HAS_LOOKUP || (field.FIELD_TYPE_DESC || '').toLowerCase() === 'select') {
    const options = field.OPTIONS ? field.OPTIONS.split(',').map((o: string) => o.trim()) : [];
    return (
      <div className="mb-2">
        {labelEl}
        <Form.Select
          size="sm"
          value={value}
          onChange={e => onChange(fieldId, e.target.value)}
          disabled={readOnly}
          style={{ fontSize: '0.85rem' }}
        >
          <option value="">Select {field.FIELD_NAME}</option>
          {options.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Form.Select>
      </div>
    );
  }

  // Textarea
  if (isTextareaField(field)) {
    return (
      <div className="mb-2">
        {labelEl}
        <Form.Control
          as="textarea"
          rows={3}
          size="sm"
          value={value}
          placeholder={readOnly ? '' : `Enter ${field.FIELD_NAME}`}
          onChange={e => onChange(fieldId, e.target.value)}
          readOnly={readOnly}
          style={{ fontSize: '0.85rem', backgroundColor: 'white', color: '#212529' }}
        />
      </div>
    );
  }

  // Default: text / date / tel / url / email
  const inputType = getInputType(field.FIELD_NAME, field.FIELD_TYPE_DESC);
  return (
    <div className="mb-2">
      {labelEl}
      <Form.Control
        type={inputType}
        size="sm"
        value={value}
        placeholder={readOnly ? '' : `Enter ${field.FIELD_NAME}`}
        onChange={e => onChange(fieldId, e.target.value)}
        readOnly={readOnly}
        style={{ fontSize: '0.85rem', backgroundColor: 'white', color: '#212529' }}
      />
    </div>
  );
};

const SectionedFormRenderer: React.FC<Props> = ({
  formName,
  fields,
  fieldValues,
  onChange,
  readOnly = false,
}) => {
  // Render the document-style layout for Fidelity-Subject forms
  if (formName?.trim() === 'Fidelity-Subject' && fields.length > 0) {
    return (
      <FidelitySubjectFormLayout
        fields={fields}
        fieldValues={fieldValues}
        onChange={onChange}
        readOnly={readOnly}
      />
    );
  }

  const sectionConfig = FORM_SECTIONS[formName?.trim()];

  // Flat-list renderer (shared by fallback and no-match-found paths)
  const flatList = (
    <div>
      {fields.map((field, idx) => {
        const fieldId = String(field.FIELD_ID ?? idx);
        return (
          <FieldInput
            key={fieldId}
            field={field}
            value={fieldValues[fieldId] ?? ''}
            onChange={onChange}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );

  // No section config for this form — flat list
  if (!sectionConfig) {
    return flatList;
  }

  // Build a case-insensitive, trimmed lookup: normalised-name -> field
  const fieldByName = new Map<string, FormField>();
  for (const f of fields) {
    if (f.FIELD_NAME) {
      fieldByName.set(f.FIELD_NAME.trim().toLowerCase(), f);
    }
  }

  const isChecklist = (title: string) => title === 'Minimum Collection Checklist';

  // Resolve all sections and filter empty ones
  const resolvedSections = sectionConfig.map((section, sectionIdx) => ({
    section,
    sectionIdx,
    sectionFields: section.fields
      .map(name => fieldByName.get(name.trim().toLowerCase()))
      .filter((f): f is FormField => f !== undefined),
  })).filter(s => s.sectionFields.length > 0);

  // If none of the section field names matched the DB fields, fall back to flat list
  if (resolvedSections.length === 0) {
    console.warn('[SectionedFormRenderer] No section fields matched — falling back to flat list. DB field names:', fields.map(f => f.FIELD_NAME));
    return flatList;
  }

  // Open the first section that actually has fields
  const firstEventKey = String(resolvedSections[0]?.sectionIdx ?? 0);

  return (
    <Accordion defaultActiveKey={firstEventKey} className="mb-3">
      {resolvedSections.map(({ section, sectionIdx, sectionFields }) => {
        if (sectionFields.length === 0) return null;

        const stats = getCompletionStats(sectionFields.map(f => f.FIELD_NAME), fields, fieldValues);

        return (
          <Accordion.Item eventKey={String(sectionIdx)} key={section.title}>
            <Accordion.Header>
              <span className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                {section.title}
              </span>
              <Badge
                bg={stats.filled === stats.total && stats.total > 0 ? 'success' : 'secondary'}
                className="ms-2"
                style={{ fontSize: '0.7rem' }}
              >
                {stats.filled} / {stats.total} filled
              </Badge>
              {stats.hasUnfilledRequired && (
                <span
                  className="ms-2"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#dc3545',
                    display: 'inline-block',
                  }}
                  title="Section has unfilled required fields"
                />
              )}
            </Accordion.Header>
            <Accordion.Body style={{ padding: '1rem' }}>
              {isChecklist(section.title) ? (
                // Compact 2-column grid for Minimum Collection Checklist
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.25rem 1.5rem',
                  }}
                >
                  {sectionFields.map(field => {
                    const fieldId = String(field.FIELD_ID);
                    const value = fieldValues[fieldId] ?? '';
                    return (
                      <div key={fieldId}>
                        <Form.Label
                          className="fw-medium text-dark mb-0"
                          style={{ fontSize: '0.8rem', display: 'block' }}
                        >
                          {field.FIELD_NAME}
                        </Form.Label>
                        <div className="d-flex gap-2 mb-1">
                          {RADIO_OPTIONS.map(opt => (
                            <Form.Check
                              key={opt}
                              type="radio"
                              id={`${fieldId}-${opt}`}
                              label={<span style={{ fontSize: '0.75rem' }}>{opt}</span>}
                              name={`field-${fieldId}`}
                              value={opt}
                              checked={value === opt}
                              onChange={() => !readOnly && onChange(fieldId, opt)}
                              disabled={readOnly}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                sectionFields.map(field => (
                  <FieldInput
                    key={String(field.FIELD_ID)}
                    field={field}
                    value={fieldValues[String(field.FIELD_ID)] ?? ''}
                    onChange={onChange}
                    readOnly={readOnly}
                  />
                ))
              )}
            </Accordion.Body>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
};

export default SectionedFormRenderer;

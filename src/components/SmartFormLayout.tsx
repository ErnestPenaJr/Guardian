import React, { useMemo } from 'react';
import '../styles/FidelitySubjectForm.css'; // reuse sw-* document classes

// ── Types ─────────────────────────────────────────────────────────
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
  fieldValues: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  readOnly?: boolean;
}

// ── Layout row types ──────────────────────────────────────────────
type LayoutRow =
  | { kind: 'full'; field: FormField }
  | { kind: 'pair'; left: FormField; right: FormField };

// ── Helpers ───────────────────────────────────────────────────────
const RADIO_OPTS = ['Positive', 'Negative', 'Not Reviewed'];

function isWideField(f: FormField): boolean {
  const desc = (f.FIELD_TYPE_DESC ?? '').toLowerCase();
  const name = f.FIELD_NAME.toLowerCase();
  return (
    desc === 'textarea' ||
    desc === 'radio' ||
    desc === 'radio_button' ||
    name.includes('notes') ||
    name.includes('history') ||
    name.includes('description') ||
    name.includes('activity') ||
    name.includes('comments') ||
    name.includes('summary') ||
    name.includes('details') ||
    name.includes('remarks') ||
    f.FIELD_NAME.length > 28
  );
}

function isRadioField(f: FormField): boolean {
  const desc = (f.FIELD_TYPE_DESC ?? '').toLowerCase();
  return desc === 'radio' || desc === 'radio_button';
}

function isTextareaField(f: FormField): boolean {
  const desc = (f.FIELD_TYPE_DESC ?? '').toLowerCase();
  const name = f.FIELD_NAME.toLowerCase();
  return (
    desc === 'textarea' ||
    name.includes('notes') ||
    name.includes('history') ||
    name.includes('description') ||
    name.includes('activity') ||
    name.includes('comments') ||
    name.includes('summary') ||
    name.includes('details') ||
    name.includes('remarks')
  );
}

function getInputType(f: FormField): string {
  const desc = (f.FIELD_TYPE_DESC ?? '').toLowerCase().replace(/\s+/g, '');
  const name = f.FIELD_NAME.toLowerCase();
  // Check DateTime / Time FIRST so they take precedence over the date-name match below.
  // Without this, a DateTime field named e.g. "Event Date" would fall through to type="date"
  // and silently strip the time portion.
  if (desc === 'datetime' || desc === 'date_time') return 'datetime-local';
  if (desc === 'time') return 'time';
  if (desc === 'date' || name.includes('date') || name.includes('dob') || name.includes('birth'))
    return 'date';
  if (name.includes('email') || desc === 'email') return 'email';
  if (name.includes('url') || name.includes('website') || desc === 'url') return 'url';
  if (name.includes('phone') || name.includes('fax') || name.includes('mobile') || desc === 'tel')
    return 'tel';
  return 'text';
}

/** Groups consecutive "narrow" fields into pairs, keeps wide fields solo */
function buildRows(fields: FormField[]): LayoutRow[] {
  const rows: LayoutRow[] = [];
  let i = 0;
  while (i < fields.length) {
    const f1 = fields[i];
    const f2 = fields[i + 1];
    if (!isWideField(f1) && f2 && !isWideField(f2)) {
      rows.push({ kind: 'pair', left: f1, right: f2 });
      i += 2;
    } else {
      rows.push({ kind: 'full', field: f1 });
      i++;
    }
  }
  return rows;
}

// ── Single field cell ─────────────────────────────────────────────
interface FieldCellProps {
  field: FormField;
  fieldValues: Record<string, string>;
  onChange: (id: string, value: string) => void;
  readOnly: boolean;
}

const FieldCell: React.FC<FieldCellProps> = ({ field, fieldValues, onChange, readOnly }) => {
  const id = String(field.FIELD_ID);
  const value = fieldValues[id] ?? '';
  const set = (v: string) => onChange(id, v);
  const isSensitive = field.IS_SENSITIVE === true;

  // Label hint for sensitive fields
  const lockIcon = isSensitive ? (
    <span style={{ fontSize: '0.7rem', marginLeft: 2 }} title="Sensitive information">🔒</span>
  ) : null;

  // Radio field
  if (isRadioField(field)) {
    return (
      <div className="sw-gender-group" style={{ padding: '4px 6px' }}>
        {RADIO_OPTS.map(opt => (
          <label key={opt} className="sw-radio-opt">
            <input
              type="radio"
              name={`sfl-${id}`}
              value={opt}
              checked={value === opt}
              onChange={() => !readOnly && set(opt)}
              disabled={readOnly}
            />
            {opt}
          </label>
        ))}
        {lockIcon}
      </div>
    );
  }

  // Select / lookup field
  if (field.HAS_LOOKUP || (field.FIELD_TYPE_DESC ?? '').toLowerCase() === 'select') {
    const options = field.OPTIONS
      ? field.OPTIONS.split(',').map(o => o.trim()).filter(Boolean)
      : [];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        <select
          className="sw-select"
          value={value}
          onChange={e => set(e.target.value)}
          disabled={readOnly}
        >
          <option value="">— Select {field.FIELD_NAME} —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {lockIcon}
      </div>
    );
  }

  // Textarea field
  if (isTextareaField(field)) {
    return (
      <div style={{ flex: 1 }}>
        <textarea
          className="sw-textarea"
          value={value}
          placeholder={readOnly ? '' : `Enter ${field.FIELD_NAME}…`}
          onChange={e => set(e.target.value)}
          readOnly={readOnly}
          rows={4}
          style={{ padding: '5px 6px' }}
        />
      </div>
    );
  }

  // Default text / date / tel / url / email
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <input
        type={getInputType(field)}
        className="sw-input"
        value={value}
        placeholder={readOnly ? '' : `Enter ${field.FIELD_NAME}`}
        onChange={e => set(e.target.value)}
        readOnly={readOnly}
      />
      {lockIcon}
    </div>
  );
};

// ── Label cell ────────────────────────────────────────────────────
const LabelCell: React.FC<{ field: FormField; borderLeft?: boolean }> = ({ field, borderLeft }) => (
  <div
    className="sw-field-label"
    style={borderLeft ? { borderLeft: '1px solid #000' } : undefined}
  >
    {field.FIELD_NAME}
    {field.IS_REQUIRED && <span style={{ color: '#dc3545', marginLeft: 2 }}>*</span>}
  </div>
);

// ── Main component ────────────────────────────────────────────────
const SmartFormLayout: React.FC<Props> = ({
  formName,
  fields,
  fieldValues,
  onChange,
  readOnly = false,
}) => {
  const rows = useMemo(() => buildRows(fields), [fields]);

  if (fields.length === 0) {
    return (
      <div className="sw-doc" style={{ padding: '24px', textAlign: 'center', color: '#888' }}>
        No fields available for this form.
      </div>
    );
  }

  return (
    <div className="sw-doc">

      {/* ── Header ──────────────────────────────── */}
      <div
        className="sw-title-bar"
        style={{ gridTemplateColumns: '1fr', borderBottom: '2px solid #000' }}
      >
        <div
          className="sw-title-label"
          style={{ textAlign: 'center', borderRight: 'none', fontSize: '14px', letterSpacing: '0.08em' }}
        >
          {formName || 'Form'}
        </div>
      </div>

      {/* ── Fields ──────────────────────────────── */}
      {rows.map((row, idx) => {
        if (row.kind === 'full') {
          const isTextarea = isTextareaField(row.field);
          return (
            <div
              key={idx}
              className="sw-field-row"
              style={{
                gridTemplateColumns: '148px 1fr',
                alignItems: isTextarea ? 'stretch' : 'center',
              }}
            >
              <LabelCell field={row.field} />
              <div className="sw-field-value" style={isTextarea ? { padding: 0 } : undefined}>
                <FieldCell
                  field={row.field}
                  fieldValues={fieldValues}
                  onChange={onChange}
                  readOnly={readOnly}
                />
              </div>
            </div>
          );
        }

        // Two fields side by side
        return (
          <div
            key={idx}
            className="sw-field-row sw-double-right"
          >
            <LabelCell field={row.left} />
            <div className="sw-field-value">
              <FieldCell
                field={row.left}
                fieldValues={fieldValues}
                onChange={onChange}
                readOnly={readOnly}
              />
            </div>
            <LabelCell field={row.right} borderLeft />
            <div className="sw-field-value">
              <FieldCell
                field={row.right}
                fieldValues={fieldValues}
                onChange={onChange}
                readOnly={readOnly}
              />
            </div>
          </div>
        );
      })}

    </div>
  );
};

export default SmartFormLayout;

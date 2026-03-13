import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/FidelitySubjectForm.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

interface Attachment {
  attachmentId: number;
  fileName: string;
  createDate?: string;
}

interface Props {
  fields: FormField[];
  /** Values keyed by String(FIELD_ID) */
  fieldValues: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  readOnly?: boolean;
  /** Set of field names that failed validation — adds red highlight to those fields */
  validationErrors?: Set<string>;
  /** Request ID — enables attachments section and print */
  requestId?: number;
}

// Minimum Collection Checklist fields (left matrix pane)
const MC_FIELDS = [
  'Account Statements',
  'FinCEN / SAR',
  'Master OBI / TRAP Data',
  'Address Information',
  'Phone Numbers / Emails',
  'Phone Calls',
  'Branch Video / Photographs',
  'Wire / ACH Activity',
  'Deposit Activity',
  'Withdrawal Activity',
  'Crypto Activity',
  'Securities Activity',
  'Debit Card / SMS Alerts',
  'AUTHLOGS / IP Data',
  'DOC V x2',
  'Account Holder Interviewed',
  'Social Media (Checklist)',
  'Additional Contact Info',
];

// Sources / Background / OSINT fields (right matrix pane)
const SRC_FIELDS = [
  'Flashpoint',
  'Photo',
  'Vehicle - Plate Number',
  'Vehicle - State',
  'Vehicle - Description',
  'Map Overlay',
  'Street View',
  'City / Town Tax Card',
  'CLEAR / Lexis Nexis',
  'Social Media / CTI',
  'OSINT Notes',
];

const RADIO_OPTS = ['Positive', 'Negative', 'Not Reviewed'] as const;

// ── Multi-entry types & defaults ──────────────────────────────────
interface MarkEntry    { location: string; markType: string; description: string; }
interface AddressEntry { street1: string; street2: string; city: string; state: string; zip: string; }
interface PhoneEntry   { number: string; phoneType: string; }
interface SocialEntry  { platform: string; handle: string; url: string; }

const DEF_MARK:    MarkEntry    = { location: '', markType: '', description: '' };
const DEF_ADDRESS: AddressEntry = { street1: '', street2: '', city: '', state: '', zip: '' };
const DEF_PHONE:   PhoneEntry   = { number: '', phoneType: '' };
const DEF_SOCIAL:  SocialEntry  = { platform: '', handle: '', url: '' };

const MARK_TYPE_OPTS  = ['Tattoo', 'Scar', 'Birthmark', 'Piercing', 'Brand', 'Other'];
const PHONE_TYPE_OPTS = ['Mobile', 'Home', 'Work', 'Fax', 'Unknown'];

function parseEntries<T>(raw: string): T[] {
  if (!raw.trim()) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p as T[] : [];
  } catch {
    return [];
  }
}

// ── Dropdown option lists ─────────────────────────────────────────
const SUFFIX_OPTS = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'Esq.', 'Ph.D.', 'M.D.', 'J.D.'];

const RACE_OPTS = [
  'W – White',
  'B – Black or African American',
  'A – Asian',
  'I – American Indian / Alaska Native',
  'P – Pacific Islander',
  'H – Hispanic or Latino',
  'M – Multiracial',
  'U – Unknown',
  'O – Other',
];

const WEIGHT_OPTS = [
  'Under 100 lbs', '100–119 lbs', '120–139 lbs', '140–159 lbs',
  '160–179 lbs', '180–199 lbs', '200–219 lbs', '220–239 lbs',
  '240–259 lbs', '260–299 lbs', '300+ lbs', 'Unknown',
];

const EYE_COLOR_OPTS = [
  'BLK – Black', 'BLU – Blue', 'BRO – Brown', 'GRY – Gray',
  'GRN – Green', 'HAZ – Hazel', 'MAR – Maroon', 'MUL – Multicolored',
  'PNK – Pink', 'UNK – Unknown',
];

const HAIR_COLOR_OPTS = [
  'BLK – Black', 'BLN – Blonde / Strawberry', 'BRO – Brown',
  'GRY – Gray', 'RED – Red / Auburn', 'SDY – Sandy',
  'WHI – White', 'BALD', 'UNK – Unknown',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

const SOCIAL_PLATFORM_OPTS = [
  'Facebook', 'Instagram', 'Twitter / X', 'LinkedIn', 'TikTok',
  'YouTube', 'Snapchat', 'Telegram', 'WhatsApp', 'Pinterest',
  'Reddit', 'Discord', 'Other',
];

const COUNTRY_OPTS = [
  'United States', 'Canada', 'Mexico', 'United Kingdom', 'Germany', 'France',
  'Italy', 'Spain', 'Australia', 'China', 'Japan', 'India', 'Brazil', 'Russia',
  'South Korea', 'Netherlands', 'Sweden', 'Switzerland', 'Poland', 'Portugal',
  'Nigeria', 'South Africa', 'Colombia', 'Venezuela', 'Cuba', 'Dominican Republic',
  'El Salvador', 'Guatemala', 'Honduras', 'Jamaica', 'Haiti', 'Philippines',
  'Vietnam', 'Thailand', 'Indonesia', 'Pakistan', 'Bangladesh', 'Other',
];

// ── Tiny reusable input ───────────────────────────────────────────
interface DocInputProps {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  placeholder?: string;
  type?: string;
  style?: React.CSSProperties;
}

const DocInput: React.FC<DocInputProps> = ({
  value,
  onChange,
  readOnly,
  placeholder,
  type = 'text',
  style,
}) => (
  <input
    type={type}
    className="sw-input"
    value={value}
    placeholder={readOnly ? '' : placeholder}
    onChange={e => onChange(e.target.value)}
    readOnly={readOnly}
    style={style}
  />
);

// ── Tiny reusable select ──────────────────────────────────────────
interface DocSelectProps {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  options: string[];
  placeholder?: string;
  style?: React.CSSProperties;
}

const DocSelect: React.FC<DocSelectProps> = ({
  value,
  onChange,
  readOnly,
  options,
  placeholder = '— Select —',
  style,
}) => (
  <select
    className="sw-select"
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={readOnly}
    style={style}
  >
    <option value="">{placeholder}</option>
    {options.map(opt => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
);

// ── Tiny reusable textarea ────────────────────────────────────────
interface DocTextareaProps {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  placeholder?: string;
  rows?: number;
}

const DocTextarea: React.FC<DocTextareaProps> = ({
  value,
  onChange,
  readOnly,
  placeholder,
  rows = 3,
}) => (
  <textarea
    className="sw-textarea"
    value={value}
    placeholder={readOnly ? '' : placeholder}
    onChange={e => onChange(e.target.value)}
    onPaste={e => {
      const el = e.currentTarget;
      requestAnimationFrame(() => onChange(el.value));
    }}
    readOnly={readOnly}
    rows={rows}
  />
);

// ── Matrix pane ───────────────────────────────────────────────────
interface MatrixPaneProps {
  title: string;
  fieldNames: string[];
  getF: (name: string) => FormField | undefined;
  fieldValues: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  readOnly: boolean;
  idPrefix: string;
}

const MatrixPane: React.FC<MatrixPaneProps> = ({
  title,
  fieldNames,
  getF,
  fieldValues,
  onChange,
  readOnly,
  idPrefix,
}) => (
  <div>
    <div className="sw-matrix-hdr">
      <div className="sw-mh-item">{title}</div>
      <div className="sw-mh-radio">+</div>
      <div className="sw-mh-radio">−</div>
      <div className="sw-mh-radio">N/R</div>
    </div>
    {fieldNames.map(name => {
      const f = getF(name);
      if (!f) return null;
      const fId = String(f.FIELD_ID);
      const v = fieldValues[fId] ?? '';
      return (
        <div key={name} className="sw-matrix-row">
          <div className="sw-matrix-label">{name}</div>
          {RADIO_OPTS.map(opt => (
            <div key={opt} className="sw-matrix-radio-cell">
              <input
                type="radio"
                name={`${idPrefix}-${fId}`}
                value={opt}
                checked={v === opt}
                onChange={() => !readOnly && onChange(fId, opt)}
                disabled={readOnly}
              />
            </div>
          ))}
        </div>
      );
    })}
  </div>
);

// ── Multi-entry: Physical Marks ───────────────────────────────────
interface PhysicalMarksFieldProps {
  fieldId: string;
  fieldValues: Record<string, string>;
  onChange: (id: string, value: string) => void;
  readOnly: boolean;
}

const PhysicalMarksField: React.FC<PhysicalMarksFieldProps> = ({ fieldId, fieldValues, onChange, readOnly }) => {
  const items: MarkEntry[] = parseEntries<MarkEntry>(fieldValues[fieldId] ?? '');
  const save = (next: MarkEntry[]) => onChange(fieldId, JSON.stringify(next));
  const add  = () => save([...items, { ...DEF_MARK }]);
  const remove = (i: number) => save(items.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<MarkEntry>) =>
    save(items.map((m, idx) => idx === i ? { ...m, ...patch } : m));

  return (
    <div className="sw-multi-marks">
      {items.length > 0 && (
        <div className="sw-marks-hdr-row">
          <span>Location / Body Part</span>
          <span>Type</span>
          <span>Description</span>
          {!readOnly && <span />}
        </div>
      )}
      {items.map((m, i) => (
        <div key={i} className="sw-marks-entry-row">
          <input className="sw-input" value={m.location}    placeholder="e.g. Left forearm" readOnly={readOnly}
            onChange={e => update(i, { location: e.target.value })} />
          <select className="sw-select" value={m.markType}  disabled={readOnly}
            onChange={e => update(i, { markType: e.target.value })}>
            <option value="">— Type —</option>
            {MARK_TYPE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <input className="sw-input" value={m.description} placeholder="Describe the mark…" readOnly={readOnly}
            onChange={e => update(i, { description: e.target.value })} />
          {!readOnly && (
            <button type="button" className="sw-multi-remove" tabIndex={-1} onClick={() => remove(i)} title="Remove">✕</button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="sw-multi-add" tabIndex={0} onClick={add}>+ Add Mark</button>
      )}
    </div>
  );
};

// ── Multi-entry: Address ──────────────────────────────────────────
interface MultiAddressFieldProps {
  fieldId: string;
  fieldValues: Record<string, string>;
  onChange: (id: string, value: string) => void;
  readOnly: boolean;
}

const MultiAddressField: React.FC<MultiAddressFieldProps> = ({ fieldId, fieldValues, onChange, readOnly }) => {
  const items: AddressEntry[] = parseEntries<AddressEntry>(fieldValues[fieldId] ?? '');
  const save = (next: AddressEntry[]) => onChange(fieldId, JSON.stringify(next));
  const add  = () => save([...items, { ...DEF_ADDRESS }]);
  const remove = (i: number) => save(items.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<AddressEntry>) =>
    save(items.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  return (
    <div className="sw-multi-list">
      {items.map((a, i) => (
        <div key={i} className="sw-addr-block">
          <div className="sw-addr-header">
            <span className="sw-addr-num">Address {i + 1}</span>
            {!readOnly && <button type="button" className="sw-multi-remove" tabIndex={-1} onClick={() => remove(i)} title="Remove">✕</button>}
          </div>
          <input className="sw-input sw-input--block" value={a.street1} placeholder="Street line 1" readOnly={readOnly}
            onChange={e => update(i, { street1: e.target.value })} />
          <input className="sw-input sw-input--block" value={a.street2} placeholder="Street line 2 (optional)" readOnly={readOnly}
            onChange={e => update(i, { street2: e.target.value })} />
          <div className="sw-addr-city-row">
            <input className="sw-input" value={a.city}  placeholder="City"  readOnly={readOnly} style={{ flex: 1 }}
              onChange={e => update(i, { city: e.target.value })} />
            <select className="sw-select" value={a.state} disabled={readOnly} style={{ flex: '0 0 62px' }}
              onChange={e => update(i, { state: e.target.value })}>
              <option value="">ST</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="sw-input" value={a.zip}   placeholder="ZIP"   readOnly={readOnly} style={{ flex: '0 0 58px', textAlign: 'center' }}
              onChange={e => update(i, { zip: e.target.value })} />
          </div>
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="sw-multi-add" tabIndex={0} onClick={add}>+ Add Address</button>
      )}
    </div>
  );
};

// ── Multi-entry: Phone ────────────────────────────────────────────
interface MultiPhoneFieldProps {
  fieldId: string;
  fieldValues: Record<string, string>;
  onChange: (id: string, value: string) => void;
  readOnly: boolean;
}

const MultiPhoneField: React.FC<MultiPhoneFieldProps> = ({ fieldId, fieldValues, onChange, readOnly }) => {
  const items: PhoneEntry[] = parseEntries<PhoneEntry>(fieldValues[fieldId] ?? '');
  const save = (next: PhoneEntry[]) => onChange(fieldId, JSON.stringify(next));
  const add  = () => save([...items, { ...DEF_PHONE }]);
  const remove = (i: number) => save(items.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<PhoneEntry>) =>
    save(items.map((p, idx) => idx === i ? { ...p, ...patch } : p));

  return (
    <div className="sw-multi-list">
      {items.map((p, i) => (
        <div key={i} className="sw-multi-row">
          <input className="sw-input" type="tel" value={p.number} placeholder="(555) 000-0000" readOnly={readOnly}
            onChange={e => update(i, { number: e.target.value })} />
          <select className="sw-select" value={p.phoneType} disabled={readOnly} style={{ flex: '0 0 90px' }}
            onChange={e => update(i, { phoneType: e.target.value })}>
            <option value="">Type</option>
            {PHONE_TYPE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {!readOnly && <button type="button" className="sw-multi-remove" tabIndex={-1} onClick={() => remove(i)} title="Remove">✕</button>}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="sw-multi-add" tabIndex={0} onClick={add}>+ Add Phone</button>
      )}
    </div>
  );
};

// ── Multi-entry: IP Address ───────────────────────────────────────
interface MultiIPFieldProps {
  fieldId: string;
  fieldValues: Record<string, string>;
  onChange: (id: string, value: string) => void;
  readOnly: boolean;
}

const MultiIPField: React.FC<MultiIPFieldProps> = ({ fieldId, fieldValues, onChange, readOnly }) => {
  const items: string[] = parseEntries<string>(fieldValues[fieldId] ?? '');
  const save = (next: string[]) => onChange(fieldId, JSON.stringify(next));
  const add  = () => save([...items, '']);
  const remove = (i: number) => save(items.filter((_, idx) => idx !== i));
  const update = (i: number, v: string) => save(items.map((ip, idx) => idx === i ? v : ip));

  return (
    <div className="sw-multi-list">
      {items.map((ip, i) => (
        <div key={i} className="sw-multi-row">
          <input className="sw-input" value={ip} placeholder="IPv4 or IPv6" readOnly={readOnly}
            onChange={e => update(i, e.target.value)} />
          {!readOnly && <button type="button" className="sw-multi-remove" tabIndex={-1} onClick={() => remove(i)} title="Remove">✕</button>}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="sw-multi-add" tabIndex={0} onClick={add}>+ Add IP</button>
      )}
    </div>
  );
};

// ── Multi-entry: Social Media ─────────────────────────────────────
interface MultiSocialFieldProps {
  fieldId: string;
  fieldValues: Record<string, string>;
  onChange: (id: string, value: string) => void;
  readOnly: boolean;
}

const MultiSocialField: React.FC<MultiSocialFieldProps> = ({ fieldId, fieldValues, onChange, readOnly }) => {
  const items: SocialEntry[] = parseEntries<SocialEntry>(fieldValues[fieldId] ?? '');
  const save = (next: SocialEntry[]) => onChange(fieldId, JSON.stringify(next));
  const add    = () => save([...items, { ...DEF_SOCIAL }]);
  const remove = (i: number) => save(items.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<SocialEntry>) =>
    save(items.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  return (
    <div className="sw-multi-list">
      {items.map((s, i) => (
        <div key={i} className="sw-multi-row">
          <select className="sw-select" value={s.platform} disabled={readOnly} style={{ flex: '0 0 120px' }}
            onChange={e => update(i, { platform: e.target.value })}>
            <option value="">Platform</option>
            {SOCIAL_PLATFORM_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <input className="sw-input" value={s.handle} placeholder="@handle" readOnly={readOnly}
            onChange={e => update(i, { handle: e.target.value })} />
          <input className="sw-input" value={s.url} placeholder="URL" type="url" readOnly={readOnly}
            onChange={e => update(i, { url: e.target.value })} />
          {!readOnly && <button type="button" className="sw-multi-remove" tabIndex={-1} onClick={() => remove(i)} title="Remove">✕</button>}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="sw-multi-add" tabIndex={0} onClick={add}>+ Add Social</button>
      )}
    </div>
  );
};

// ── DOB masked input (MM/DD/YYYY) ─────────────────────────────────
const DOBInput: React.FC<{ value: string; onChange: (v: string) => void; readOnly: boolean }> =
  ({ value, onChange, readOnly }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/\D/g, '');
      if (raw.length > 2) raw = raw.slice(0, 2) + '/' + raw.slice(2);
      if (raw.length > 5) raw = raw.slice(0, 5) + '/' + raw.slice(5);
      onChange(raw.slice(0, 10));
    };
    return (
      <input
        className="sw-input"
        type="text"
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={readOnly ? '' : 'MM/DD/YYYY'}
        maxLength={10}
        inputMode="numeric"
      />
    );
  };

// ── SSN restricted input (9 digits) ──────────────────────────────
const SSNInput: React.FC<{ value: string; onChange: (v: string) => void; readOnly: boolean }> =
  ({ value, onChange, readOnly }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value.replace(/\D/g, '').slice(0, 9));
    return (
      <input
        className="sw-input"
        type="text"
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={readOnly ? '' : 'XXX-XX-XXXX'}
        maxLength={9}
        inputMode="numeric"
        style={{ maxWidth: '150px' }}
      />
    );
  };

// ── Height ft / in compound field ────────────────────────────────
const HeightField: React.FC<{ value: string; onChange: (v: string) => void; readOnly: boolean }> =
  ({ value, onChange, readOnly }) => {
    const m = value.match(/^(\d+)\s*ft\s*(\d+)\s*in/i);
    const ft = m ? m[1] : '';
    const ins = m ? m[2] : '';
    const emit = (newFt: string, newIn: string) =>
      onChange(newFt || newIn ? `${newFt || '0'} ft ${newIn || '0'} in` : '');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          className="sw-input"
          type="number"
          min={1}
          max={8}
          value={ft}
          onChange={e => emit(e.target.value, ins)}
          readOnly={readOnly}
          placeholder="ft"
          style={{ width: '52px' }}
        />
        <span className="sw-unit">ft</span>
        <input
          className="sw-input"
          type="number"
          min={0}
          max={11}
          value={ins}
          onChange={e => emit(ft, e.target.value)}
          readOnly={readOnly}
          placeholder="in"
          style={{ width: '52px' }}
        />
        <span className="sw-unit">in</span>
      </div>
    );
  };

// Short prefix stored in the DB VALUE column to reference a binary attachment
const PHOTO_REF_PREFIX = 'photo_ref:';

// ── Drag-and-drop zone for Other Attachments ─────────────────────
interface DropZoneProps {
  attachInputRef: React.RefObject<HTMLInputElement>;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
const DropZone: React.FC<DropZoneProps> = ({ attachInputRef, uploading, onUpload }) => {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !attachInputRef.current) return;
    // Synthesise a change event so the existing upload handler can be reused
    const dt = new DataTransfer();
    dt.items.add(file);
    attachInputRef.current.files = dt.files;
    attachInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
  };

  return (
    <div
      className={`sw-dropzone${dragOver ? ' sw-dropzone--over' : ''}${uploading ? ' sw-dropzone--uploading' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && attachInputRef.current?.click()}
    >
      <input
        ref={attachInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={onUpload}
      />
      {uploading ? (
        <>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span>Uploading…</span>
        </>
      ) : (
        <>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span><strong>Drop a file here</strong> or <span className="sw-dropzone-link">click to browse</span></span>
        </>
      )}
    </div>
  );
};

// ── Other-Attachments list (photo attachment filtered out) ────────
interface AttachmentListProps {
  attachLoading: boolean;
  formAttachments: Attachment[];
  photoRefValue: string;
  readOnly: boolean;
  onDownload: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}
const AttachmentList: React.FC<AttachmentListProps> = ({
  attachLoading,
  formAttachments,
  photoRefValue,
  readOnly,
  onDownload,
  onDelete,
}) => {
  if (attachLoading) return <div className="sw-attach-empty">Loading…</div>;

  const photoAttachId = photoRefValue.startsWith(PHOTO_REF_PREFIX)
    ? parseInt(photoRefValue.slice(PHOTO_REF_PREFIX.length))
    : null;
  const others = formAttachments.filter(a => a.attachmentId !== photoAttachId);

  if (others.length === 0) {
    return <div className="sw-attach-empty">No attachments uploaded yet.</div>;
  }

  return (
    <ul className="sw-attach-list">
      {others.map(a => (
        <li key={a.attachmentId} className="sw-attach-item">
          <span className="sw-attach-name">{a.fileName}</span>
          <div className="sw-attach-actions">
            <button
              type="button"
              className="sw-attach-btn"
              onClick={() => onDownload(a.attachmentId, a.fileName)}
            >
              ↓ Download
            </button>
            {!readOnly && (
              <button
                type="button"
                className="sw-attach-btn sw-attach-btn--del"
                onClick={() => onDelete(a.attachmentId)}
              >
                ✕
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

// ── Main layout component ─────────────────────────────────────────
const FidelitySubjectFormLayout: React.FC<Props> = ({
  fields,
  fieldValues,
  onChange,
  readOnly = false,
  validationErrors,
  requestId,
}) => {
  // Returns extra className when a field name has a validation error
  const errClass = (fieldName: string) =>
    validationErrors?.has(fieldName) ? ' sw-field--error' : '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [investigatorOptions, setInvestigatorOptions] = useState<string[]>([]);
  const [formAttachments, setFormAttachments] = useState<Attachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Displayable URL for the subject photo (blob: or data:image — never raw DB value)
  const [photoDisplayUrl, setPhotoDisplayUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const exportPDF = async () => {
    const el = docRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 36; // 0.5 in
      const printW = pageW - margin * 2;
      const imgH = (canvas.height * printW) / canvas.width;

      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, margin - y, printW, imgH);
        y += pageH - margin * 2;
      }

      const subjectName = el.querySelector<HTMLElement>('.sw-title-name')?.innerText?.trim() || 'Subject-Workup';
      pdf.save(`${subjectName.replace(/\s+/g, '_')}_Workup.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const loadInvestigatorOptions = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setInvestigatorOptions([]);
          return;
        }

        const response = await fetch('/api/users/assignable', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setInvestigatorOptions([]);
          return;
        }

        const data = await response.json();
        const options = (Array.isArray(data) ? data : [])
          .map((u: any) => String(u?.label || u?.FULL_NAME || '').trim())
          .filter(Boolean);

        const uniqueOptions = Array.from(new Set(options));
        setInvestigatorOptions(uniqueOptions);
      } catch (_err) {
        setInvestigatorOptions([]);
      }
    };

    loadInvestigatorOptions();
  }, []);

  useEffect(() => {
    if (!requestId) return;
    const fetchAttachments = async () => {
      setAttachLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/requests/${requestId}/attachments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setFormAttachments(data.attachments || []);
      } catch {
        /* silently ignore — section will show empty */
      } finally {
        setAttachLoading(false);
      }
    };
    fetchAttachments();
  }, [requestId]);

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !requestId) return;
    e.target.value = '';
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/requests/${requestId}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.attachment) {
        setFormAttachments(prev => [...prev, data.attachment]);
      }
    } catch (err) {
      console.error('Attachment upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentDownload = async (attachmentId: number, fileName: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Attachment download failed', err);
    }
  };

  const handleAttachmentDelete = async (attachmentId: number) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setFormAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId));
    } catch (err) {
      console.error('Attachment delete failed', err);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (requestId) {
      // Upload as a proper binary attachment — avoids the NVARCHAR(4000) DB limit
      setPhotoUploading(true);
      try {
        // Delete old photo attachment if one exists
        const oldRef = val('Subject Photo Image');
        if (oldRef.startsWith(PHOTO_REF_PREFIX)) {
          const oldId = parseInt(oldRef.slice(PHOTO_REF_PREFIX.length));
          if (!isNaN(oldId)) {
            const token = localStorage.getItem('token');
            await fetch(`/api/attachments/${oldId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => { /* ignore delete errors */ });
            setFormAttachments(prev => prev.filter(a => a.attachmentId !== oldId));
          }
        }

        const token = localStorage.getItem('token');
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/requests/${requestId}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json();
        if (data.success && data.attachmentId) {
          set('Subject Photo Image', `${PHOTO_REF_PREFIX}${data.attachmentId}`);
          // Show immediately via a local blob URL (the useEffect will update it on reload)
          const blobUrl = URL.createObjectURL(file);
          setPhotoDisplayUrl(prev => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
            return blobUrl;
          });
        }
      } catch (err) {
        console.error('Photo upload failed', err);
      } finally {
        setPhotoUploading(false);
      }
    } else {
      // No requestId yet — compress to a tiny thumbnail that fits in NVARCHAR(4000)
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        // 80px max at 0.4 quality keeps base64 well under 4000 chars
        const MAX = 80;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        } else {
          if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.4);
        set('Subject Photo Image', base64);
        setPhotoDisplayUrl(base64);
      };
      img.onerror = () => URL.revokeObjectURL(objectUrl);
      img.src = objectUrl;
    }
  };

  const removePhoto = async () => {
    const currentVal = val('Subject Photo Image');
    if (currentVal.startsWith(PHOTO_REF_PREFIX)) {
      const attachmentId = parseInt(currentVal.slice(PHOTO_REF_PREFIX.length));
      if (!isNaN(attachmentId)) {
        const token = localStorage.getItem('token');
        await fetch(`/api/attachments/${attachmentId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => { /* ignore */ });
        setFormAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId));
      }
    }
    setPhotoDisplayUrl(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    set('Subject Photo Image', '');
  };

  const fm = useMemo(() => {
    const m = new Map<string, FormField>();
    for (const f of fields) {
      if (f.FIELD_NAME) m.set(f.FIELD_NAME.trim().toLowerCase(), f);
    }
    return m;
  }, [fields]);

  const getF = (name: string) => fm.get(name.trim().toLowerCase());

  // Derive only the photo field's raw DB value so we can watch it cheaply
  const photoField = fm.get('subject photo image');
  const photoFieldValue = photoField ? (fieldValues[String(photoField.FIELD_ID)] ?? '') : '';

  // Keep a stable ref to onChange so the fetch callback can clear stale references
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Track attachment IDs that have already failed so we never retry them in the
  // same session — prevents the React StrictMode double-invoke loop and any
  // re-render loops from re-triggering failed fetches.
  const failedPhotoIds = useRef(new Set<number>());

  // Load / refresh the displayable photo URL whenever the stored field value changes
  useEffect(() => {
    if (!photoFieldValue) {
      setPhotoDisplayUrl(prev => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (photoFieldValue.startsWith('data:image')) {
      setPhotoDisplayUrl(photoFieldValue);
      return;
    }
    if (photoFieldValue.startsWith(PHOTO_REF_PREFIX)) {
      const attachmentId = parseInt(photoFieldValue.slice(PHOTO_REF_PREFIX.length));
      if (isNaN(attachmentId)) return;

      // Skip if we've already confirmed this attachment doesn't exist
      if (failedPhotoIds.current.has(attachmentId)) return;

      const token = localStorage.getItem('token');
      fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const arrayBuffer = await res.arrayBuffer();
          const contentType = res.headers.get('Content-Type') || '';
          const mimeType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
          return new Blob([arrayBuffer], { type: mimeType });
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setPhotoDisplayUrl(prev => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
            return url;
          });
        })
        .catch(err => {
          if (err.message.includes('404') && photoField) {
            // Mark so we don't retry this ID again this session
            failedPhotoIds.current.add(attachmentId);
            // Clear the in-memory reference so placeholder shows
            onChangeRef.current(String(photoField.FIELD_ID), '');
            // Best-effort: remove the stale row from the DB so it's gone next open too
            if (requestId) {
              const tok = localStorage.getItem('token');
              fetch(`/api/requests/${requestId}/field-value/${photoField.FIELD_ID}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${tok}` },
              }).catch(() => { /* silent — server may need restart */ });
            }
          }
          // No console.error — the 404 warn above is enough; other errors are transient
        });
    }
  }, [photoFieldValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      setPhotoDisplayUrl(prev => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const val = (name: string): string => {
    const f = getF(name);
    return f ? (fieldValues[String(f.FIELD_ID)] ?? '') : '';
  };

  const set = (name: string, v: string) => {
    const f = getF(name);
    if (f) onChange(String(f.FIELD_ID), v);
  };

  // Sync subject name in the title bar
  const subjectName =
    [val('First Name'), val('Last Name')].filter(Boolean).join(' ') || '—';

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="sw-doc" ref={docRef}>

      {/* ── TITLE BAR ──────────────────────────────── */}
      <div className="sw-title-bar">
        <div className="sw-title-label">Subject Workup</div>
        <div className="sw-title-name">{subjectName}</div>
        <div className="sw-title-meta">
          <span className="sw-meta-label">CASE #:</span>
          <span className="sw-meta-value">{val('Case #') || '—'}</span>
        </div>
        <button
          type="button"
          className="sw-print-btn no-print"
          onClick={exportPDF}
          disabled={exporting}
          title="Export as PDF"
        >
          {exporting ? '⏳ Exporting…' : '⬇ Export PDF'}
        </button>
      </div>

      {/* ── DATE / CASE # / ANALYST / INVESTIGATOR ───────────── */}
      <div className="sw-date-row">
        <div className="sw-date-cell">
          <span className="sw-date-label">Date:</span>
          <span className="sw-date-value">{today}</span>
        </div>
        <div className="sw-date-cell">
          <span className="sw-date-label">Case #:</span>
          <DocInput
            value={val('Case #')}
            onChange={v => set('Case #', v)}
            readOnly={readOnly}
            placeholder="Case number"
          />
        </div>
        <div className="sw-date-cell">
          <span className="sw-date-label">Analyst:</span>
          <DocSelect
            value={val('Analyst')}
            onChange={v => set('Analyst', v)}
            readOnly={readOnly}
            options={(() => {
              const currentValue = val('Analyst').trim();
              if (currentValue && !investigatorOptions.includes(currentValue)) {
                return [currentValue, ...investigatorOptions];
              }
              return investigatorOptions;
            })()}
            placeholder="— Select —"
          />
        </div>
        <div className="sw-date-cell">
          <span className="sw-date-label">Investigator:</span>
          <DocSelect
            value={val('Investigator')}
            onChange={v => set('Investigator', v)}
            readOnly={readOnly}
            options={(() => {
              const currentValue = val('Investigator').trim();
              if (currentValue && !investigatorOptions.includes(currentValue)) {
                return [currentValue, ...investigatorOptions];
              }
              return investigatorOptions;
            })()}
            placeholder="— Select —"
          />
        </div>
      </div>

      {/* ── BODY: FIELDS + PHOTO ────────────────────── */}
      <div className="sw-body-grid">
        <div className="sw-fields-col">

          {/* Subject Name */}
          <div className={`sw-field-row${errClass('First Name')}${errClass('Last Name')}`}>
            <div className="sw-field-label">Subject Name(s): <span className="sw-required-star">*</span></div>
            <div className="sw-field-value">
              <DocInput
                value={val('First Name')}
                onChange={v => set('First Name', v)}
                readOnly={readOnly}
                placeholder="First *"
                style={{ flex: '1.1' }}
              />
              <DocInput
                value={val('Middle Name')}
                onChange={v => set('Middle Name', v)}
                readOnly={readOnly}
                placeholder="Middle"
                style={{ flex: '0.7' }}
              />
              <DocInput
                value={val('Last Name')}
                onChange={v => set('Last Name', v)}
                readOnly={readOnly}
                placeholder="Last *"
                style={{ flex: '1.1' }}
              />
              <DocSelect
                value={val('Suffix')}
                onChange={v => set('Suffix', v)}
                readOnly={readOnly}
                options={SUFFIX_OPTS}
                placeholder="Sfx"
                style={{ flex: '0 0 72px' }}
              />
            </div>
          </div>

          {/* AKA(s) */}
          <div className="sw-field-row">
            <div className="sw-field-label">AKA(s):</div>
            <div className="sw-field-value">
              <DocInput
                value={val('AKA(s)')}
                onChange={v => set('AKA(s)', v)}
                readOnly={readOnly}
                placeholder="Also known as…"
              />
            </div>
          </div>

          {/* DOB */}
          <div className={`sw-field-row${errClass('Date of Birth')}`}>
            <div className="sw-field-label">DOB: <span className="sw-required-star">*</span></div>
            <div className="sw-field-value">
              <DOBInput
                value={val('Date of Birth')}
                onChange={v => set('Date of Birth', v)}
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* SSN */}
          <div className={`sw-field-row${errClass('Social Security Number')}`}>
            <div className="sw-field-label">SSN: <span className="sw-required-star">*</span></div>
            <div className="sw-field-value">
              <SSNInput
                value={val('Social Security Number')}
                onChange={v => set('Social Security Number', v)}
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* State DL */}
          <div className="sw-field-row">
            <div className="sw-field-label">State DL:</div>
            <div className="sw-field-value">
              <DocSelect
                value={val('DL Issuing State')}
                onChange={v => set('DL Issuing State', v)}
                readOnly={readOnly}
                options={US_STATES}
                placeholder="ST"
                style={{ flex: '0 0 70px' }}
              />
              <DocInput
                value={val("State Driver's License")}
                onChange={v => set("State Driver's License", v)}
                readOnly={readOnly}
                placeholder="DL Number"
              />
            </div>
          </div>

          {/* Account # */}
          <div className="sw-field-row">
            <div className="sw-field-label">Account #:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('Account Number')}
                onChange={v => set('Account Number', v)}
                readOnly={readOnly}
                placeholder="Account number"
              />
            </div>
          </div>

          {/* FBI/SID # */}
          <div className="sw-field-row">
            <div className="sw-field-label">FBI/SID #:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('FBI SID Number')}
                onChange={v => set('FBI SID Number', v)}
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* Other ID # */}
          <div className="sw-field-row">
            <div className="sw-field-label">Other ID #:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('Other ID #')}
                onChange={v => set('Other ID #', v)}
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* Gender (separator) */}
          <div className="sw-field-row sw-sep">
            <div className="sw-field-label">Gender:</div>
            <div className="sw-field-value">
              <div className="sw-gender-group">
                {['Male', 'Female', 'Unknown'].map(opt => (
                  <label key={opt} className="sw-radio-opt">
                    <input
                      type="radio"
                      name={`sw-gender-${getF('Gender')?.FIELD_ID ?? 'g'}`}
                      value={opt}
                      checked={val('Gender') === opt}
                      onChange={() => !readOnly && set('Gender', opt)}
                      disabled={readOnly}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Race */}
          <div className="sw-field-row">
            <div className="sw-field-label">Race:</div>
            <div className="sw-field-value">
              <DocSelect
                value={val('Race')}
                onChange={v => set('Race', v)}
                readOnly={readOnly}
                options={RACE_OPTS}
              />
            </div>
          </div>

          {/* Place of Birth */}
          <div className="sw-field-row">
            <div className="sw-field-label">Place of Birth:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('Place of Birth (City)')}
                onChange={v => set('Place of Birth (City)', v)}
                readOnly={readOnly}
                placeholder="City"
                style={{ flex: '1.2' }}
              />
              <DocSelect
                value={val('Place of Birth (State)')}
                onChange={v => set('Place of Birth (State)', v)}
                readOnly={readOnly}
                options={US_STATES}
                placeholder="State"
                style={{ flex: '0.6' }}
              />
              <DocSelect
                value={val('Place of Birth (Country)')}
                onChange={v => set('Place of Birth (Country)', v)}
                readOnly={readOnly}
                options={COUNTRY_OPTS}
                placeholder="Country"
                style={{ flex: '0.8' }}
              />
            </div>
          </div>

          {/* Height + Weight */}
          <div className="sw-field-row sw-double-right">
            <div className="sw-field-label">Height:</div>
            <div className="sw-field-value">
              <HeightField
                value={val('Height')}
                onChange={v => set('Height', v)}
                readOnly={readOnly}
              />
            </div>
            <div className="sw-field-label sw-right-label">Weight:</div>
            <div className="sw-field-value">
              <DocSelect
                value={val('Weight')}
                onChange={v => set('Weight', v)}
                readOnly={readOnly}
                options={WEIGHT_OPTS}
              />
            </div>
          </div>

          {/* Eye Color + Hair Color */}
          <div className="sw-field-row sw-double-right">
            <div className="sw-field-label">Eye Color:</div>
            <div className="sw-field-value">
              <DocSelect
                value={val('Eye Color')}
                onChange={v => set('Eye Color', v)}
                readOnly={readOnly}
                options={EYE_COLOR_OPTS}
              />
            </div>
            <div className="sw-field-label sw-right-label">Hair Color:</div>
            <div className="sw-field-value">
              <DocSelect
                value={val('Hair Color')}
                onChange={v => set('Hair Color', v)}
                readOnly={readOnly}
                options={HAIR_COLOR_OPTS}
              />
            </div>
          </div>

        </div>{/* /sw-fields-col */}

        {/* PHOTO UPLOAD */}
        <div className="sw-photo-col">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />

          {photoUploading ? (
            <div className="sw-photo-placeholder">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#aabbd4"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Uploading…</span>
            </div>
          ) : photoDisplayUrl ? (
            <div className="sw-photo-preview-wrap">
              <img
                src={photoDisplayUrl}
                alt="Subject"
                className="sw-photo-preview-img"
              />
              {!readOnly && (
                <button
                  type="button"
                  className="sw-photo-remove"
                  onClick={removePhoto}
                  title="Remove photo"
                >
                  ✕
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  className="sw-photo-change"
                  onClick={() => fileInputRef.current?.click()}
                  title="Change photo"
                >
                  Change
                </button>
              )}
            </div>
          ) : (
            <div
              className={`sw-photo-placeholder${readOnly ? '' : ' sw-photo-placeholder--clickable'}`}
              onClick={() => !readOnly && fileInputRef.current?.click()}
              title={readOnly ? '' : 'Click to upload subject photo'}
            >
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#aabbd4"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Subject Photo</span>
              {!readOnly && (
                <span className="sw-photo-hint">
                  {requestId ? 'Click to upload' : 'Save request first, then upload photo'}
                </span>
              )}
            </div>
          )}
        </div>

      </div>{/* /sw-body-grid */}

      {/* ── PHYSICAL MARKS / TATTOOS ────────────────── */}
      <div className="sw-section-hdr">Physical Marks / Tattoos / Scars:</div>
      <div className="sw-full-textarea" style={{ padding: '6px 10px' }}>
        <PhysicalMarksField
          fieldId={String(getF('Tattoos / Marks')?.FIELD_ID ?? '')}
          fieldValues={fieldValues}
          onChange={onChange}
          readOnly={readOnly}
        />
      </div>

      {/* ── SPECIAL NOTES ───────────────────────────── */}
      <div className="sw-special-notes-row">
        <div className="sw-field-label sw-notes-label">Special Notes:</div>
        <DocTextarea
          value={val('Special Notes')}
          onChange={v => set('Special Notes', v)}
          readOnly={readOnly}
          placeholder="Enter special notes about the subject…"
          rows={3}
        />
      </div>

      {/* ── CONTACT GRID ────────────────────────────── */}
      <div className="sw-contact-grid">

        {/* Left: Address + IP */}
        <div className={`sw-contact-pane${errClass('Address')}`}>
          <div className="sw-contact-hdr">Address(s): <span className="sw-required-star">*</span><span className="sw-req-label"> Required</span></div>
          <div className="sw-contact-body">
            <MultiAddressField
              fieldId={String(getF('Address')?.FIELD_ID ?? '')}
              fieldValues={fieldValues}
              onChange={onChange}
              readOnly={readOnly}
            />
          </div>
          <div className="sw-ip-section">
            <div className="sw-ip-label">IP Address(s):</div>
            <div className="sw-contact-body">
              <MultiIPField
                fieldId={String(getF('IP Address')?.FIELD_ID ?? '')}
                fieldValues={fieldValues}
                onChange={onChange}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>

        {/* Right: Phone + Social */}
        <div className={`sw-contact-pane${errClass('Phone Number')}`}>
          <div className="sw-contact-hdr">Phone Number(s): <span className="sw-required-star">*</span><span className="sw-req-label"> Required</span></div>
          <div className="sw-contact-body">
            <MultiPhoneField
              fieldId={String(getF('Phone Number')?.FIELD_ID ?? '')}
              fieldValues={fieldValues}
              onChange={onChange}
              readOnly={readOnly}
            />
          </div>
          <div className="sw-contact-hdr" style={{ borderTop: '1px solid #000' }}>
            Social Media:
          </div>
          <div className="sw-contact-body">
            <MultiSocialField
              fieldId={String(getF('Social Media Platform')?.FIELD_ID ?? '')}
              fieldValues={fieldValues}
              onChange={onChange}
              readOnly={readOnly}
            />
          </div>
        </div>

      </div>{/* /sw-contact-grid */}

      {/* ── NOTES GRID ──────────────────────────────── */}
      <div className="sw-notes-grid">
        <div className="sw-notes-pane">
          <div className="sw-notes-hdr">Criminal History:</div>
          <DocTextarea
            value={val('Criminal History')}
            onChange={v => set('Criminal History', v)}
            readOnly={readOnly}
            placeholder="Enter criminal history, charges, convictions…"
            rows={6}
          />
        </div>
        <div className="sw-notes-pane">
          <div className="sw-notes-hdr">Other Subject Notes:</div>
          <DocTextarea
            value={val('Other Subject Notes')}
            onChange={v => set('Other Subject Notes', v)}
            readOnly={readOnly}
            placeholder="Other subject notes…"
            rows={6}
          />
        </div>
      </div>{/* /sw-notes-grid */}

      {/* ── INVESTIGATIVE / INTEL NOTES ─────────────── */}
      <div className="sw-intel-hdr">
        Investigative / Intelligence Notes of Interest:
      </div>
      <div className="sw-intel-body">
        <DocTextarea
          value={val('Investigative/Intel Notes')}
          onChange={v => set('Investigative/Intel Notes', v)}
          readOnly={readOnly}
          placeholder="Enter investigative and intelligence notes of interest…"
          rows={7}
        />
      </div>

      {/* ── MATRIX ──────────────────────────────────── */}
      <div className="sw-matrix">
        <div className="sw-matrix-pane--left">
          <MatrixPane
            title="Minimum Collection"
            fieldNames={MC_FIELDS}
            getF={getF}
            fieldValues={fieldValues}
            onChange={onChange}
            readOnly={readOnly}
            idPrefix="mc"
          />
        </div>
        <div>
          <MatrixPane
            title="Sources"
            fieldNames={SRC_FIELDS}
            getF={getF}
            fieldValues={fieldValues}
            onChange={onChange}
            readOnly={readOnly}
            idPrefix="src"
          />
        </div>
      </div>{/* /sw-matrix */}

      {/* ── ADDITIONAL DATA NOTES ───────────────────── */}
      <div className="sw-intel-hdr">Additional Data Notes:</div>
      <div className="sw-intel-body">
        <DocTextarea
          value={val('Additional Data Notes')}
          onChange={v => set('Additional Data Notes', v)}
          readOnly={readOnly}
          placeholder="Additional data notes…"
          rows={4}
        />
      </div>

      {/* ── OTHER ATTACHMENTS ────────────────────────── */}
      {requestId && (
        <div className="sw-attachments-section no-print">
          <div className="sw-intel-hdr sw-attachments-hdr">
            Other Attachments
          </div>
          {!readOnly && (
            <DropZone
              attachInputRef={attachInputRef}
              uploading={uploading}
              onUpload={handleAttachmentUpload}
            />
          )}
          <div className="sw-attachments-body">
            <AttachmentList
              attachLoading={attachLoading}
              formAttachments={formAttachments}
              photoRefValue={photoFieldValue}
              readOnly={readOnly}
              onDownload={handleAttachmentDownload}
              onDelete={handleAttachmentDelete}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default FidelitySubjectFormLayout;

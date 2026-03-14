import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
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
const SUBJECT_PHOTO_FILE_PREFIX = '__subject_photo__::';
const RENDERABLE_PHOTO_MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

function getRenderablePhotoMimeType(fileName?: string, declaredType?: string | null): string | null {
  if (declaredType && Object.values(RENDERABLE_PHOTO_MIME_BY_EXT).includes(declaredType)) {
    return declaredType;
  }

  const ext = fileName?.split('.').pop()?.toLowerCase();
  return ext ? RENDERABLE_PHOTO_MIME_BY_EXT[ext] ?? null : null;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function waitForImageReady(src: string): Promise<void> {
  const img = new Image();
  img.decoding = 'async';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    img.src = src;
  });

  if (typeof img.decode === 'function') {
    try {
      await img.decode();
    } catch {
      // onload already confirmed the image is usable
    }
  }
}

function normalizeAttachmentBytes(buffer: ArrayBuffer): Uint8Array {
  const directBytes = new Uint8Array(buffer);
  if (directBytes.length === 0) return directBytes;

  // Some attachment responses arrive as JSON text like {"0":137,"1":80,...}
  if (directBytes[0] === 0x7b) {
    try {
      const text = new TextDecoder().decode(directBytes);
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const entries = Object.entries(parsed)
        .filter(([key, value]) => /^\d+$/.test(key) && typeof value === 'number')
        .sort((a, b) => Number(a[0]) - Number(b[0]));

      if (entries.length > 0) {
        return Uint8Array.from(entries.map(([, value]) => Number(value)));
      }
    } catch {
      return directBytes;
    }
  }

  return directBytes;
}

function buildSizedPhotoDataUrl(img: HTMLImageElement): string | null {
  const MAX_DB_CHARS = 3950;
  const attempts = [
    { size: 320, quality: 0.92, format: 'image/webp' },
    { size: 288, quality: 0.9, format: 'image/webp' },
    { size: 256, quality: 0.88, format: 'image/webp' },
    { size: 224, quality: 0.86, format: 'image/webp' },
    { size: 208, quality: 0.84, format: 'image/webp' },
    { size: 192, quality: 0.82, format: 'image/webp' },
    { size: 176, quality: 0.8, format: 'image/webp' },
    { size: 160, quality: 0.78, format: 'image/webp' },
    { size: 144, quality: 0.74, format: 'image/webp' },
    { size: 128, quality: 0.7, format: 'image/webp' },
    { size: 112, quality: 0.66, format: 'image/webp' },
    { size: 160, quality: 0.72, format: 'image/jpeg' },
    { size: 128, quality: 0.64, format: 'image/jpeg' },
  ];

  for (const attempt of attempts) {
    let { width, height } = img;
    if (width > height) {
      if (width > attempt.size) {
        height = Math.round((height * attempt.size) / width);
        width = attempt.size;
      }
    } else if (height > attempt.size) {
      width = Math.round((width * attempt.size) / height);
      height = attempt.size;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(width, 1);
    canvas.height = Math.max(height, 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL(attempt.format, attempt.quality);
    if (dataUrl.length <= MAX_DB_CHARS) {
      return dataUrl;
    }
  }

  return null;
}

// ── Attachment preview helpers ────────────────────────────────────
type FileKind = 'image' | 'pdf' | 'word' | 'excel' | 'other';

function getFileKind(fileName: string): FileKind {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc','docx'].includes(ext)) return 'word';
  if (['xls','xlsx','csv'].includes(ext)) return 'excel';
  return 'other';
}

function FileTypeIcon({ kind }: { kind: FileKind }) {
  if (kind === 'pdf') return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#c10000' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="9" y2="17"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="15" y1="14" x2="15" y2="17"/>
    </svg>
  );
  if (kind === 'word') return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#1a56c4' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
  if (kind === 'excel') return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#22a35a' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="13" x2="12" y2="17"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#7a8fad' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

// ── Unified drop zone + file list for Other Attachments ──────────
interface AttachmentsDropZoneProps {
  uploading: boolean;
  attachLoading: boolean;
  formAttachments: Attachment[];
  photoRefValue: string;
  readOnly: boolean;
  onFile: (file: File) => void;
  onDownload: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}
const AttachmentsDropZone: React.FC<AttachmentsDropZoneProps> = ({
  uploading,
  attachLoading,
  formAttachments,
  photoRefValue,
  readOnly,
  onFile,
  onDownload,
  onDelete,
}) => {
  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    disabled: uploading || readOnly,
    multiple: true,
    onDrop: (accepted) => { accepted.forEach(f => onFile(f)); },
  });

  // Blob URLs for image previews, keyed by attachmentId
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});

  const photoAttachId = photoRefValue.startsWith(PHOTO_REF_PREFIX)
    ? parseInt(photoRefValue.slice(PHOTO_REF_PREFIX.length))
    : null;
  const others = formAttachments.filter(a => a.attachmentId !== photoAttachId);

  // Lazily fetch blob URLs for image attachments
  useEffect(() => {
    const token = localStorage.getItem('token');
    const toFetch = others.filter(
      a => getFileKind(a.fileName) === 'image' && !previewUrls[a.attachmentId]
    );
    if (toFetch.length === 0) return;

    let cancelled = false;
    const fetched: Record<number, string> = {};

    Promise.all(
      toFetch.map(async (a) => {
        try {
          const res = await fetch(`/api/attachments/${a.attachmentId}/download`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const blob = await res.blob();
          fetched[a.attachmentId] = URL.createObjectURL(blob);
        } catch { /* skip */ }
      })
    ).then(() => {
      if (!cancelled && Object.keys(fetched).length > 0) {
        setPreviewUrls(prev => ({ ...prev, ...fetched }));
      }
    });

    return () => {
      cancelled = true;
      // Revoke any newly created URLs on cleanup
      Object.values(fetched).forEach(u => URL.revokeObjectURL(u));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [others.map(a => a.attachmentId).join(',')]);

  // Revoke all blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach(u => URL.revokeObjectURL(u));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let dzClass = 'sw-dropzone';
  if (isDragAccept) dzClass += ' sw-dropzone--accept';
  else if (isDragReject) dzClass += ' sw-dropzone--reject';
  else if (isDragActive) dzClass += ' sw-dropzone--over';
  if (uploading) dzClass += ' sw-dropzone--uploading';

  return (
    <div className="sw-dropzone-card">
      {!readOnly && (
        <div {...getRootProps()} className={dzClass}>
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>Uploading…</span>
            </>
          ) : isDragReject ? (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>File type not supported</span>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span><strong>Drop files here</strong> or <span className="sw-dropzone-link">click to browse</span></span>
            </>
          )}
        </div>
      )}

      {attachLoading ? (
        <div className="sw-attach-empty">Loading…</div>
      ) : others.length === 0 ? (
        !readOnly && <div className="sw-attach-empty">No attachments yet.</div>
      ) : (
        <ul className="sw-attach-list">
          {others.map(a => {
            const kind = getFileKind(a.fileName);
            const imgUrl = previewUrls[a.attachmentId];
            return (
              <li key={a.attachmentId} className="sw-attach-item">
                <div className="sw-attach-thumb">
                  {kind === 'image' && imgUrl ? (
                    <img src={imgUrl} alt={a.fileName} className="sw-attach-thumb-img" />
                  ) : (
                    <div className="sw-attach-thumb-icon">
                      <FileTypeIcon kind={kind} />
                    </div>
                  )}
                </div>
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
            );
          })}
        </ul>
      )}
    </div>
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
  const docRef = useRef<HTMLDivElement>(null);
  const [investigatorOptions, setInvestigatorOptions] = useState<string[]>([]);
  const [formAttachments, setFormAttachments] = useState<Attachment[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Displayable URL for the subject photo (blob: or data:image — never raw DB value)
  const [photoDisplayUrl, setPhotoDisplayUrl] = useState<string | null>(null);
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoRenderReady, setPhotoRenderReady] = useState(false);

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
          .map((u: { label?: string; FULL_NAME?: string }) => String(u?.label || u?.FULL_NAME || '').trim())
          .filter(Boolean);

        const uniqueOptions = Array.from(new Set(options));
        setInvestigatorOptions(uniqueOptions);
      } catch {
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

  const handleAttachmentUpload = async (file: File) => {
    if (!file || !requestId) return;
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
      if (data.success && data.attachmentId) {
        setFormAttachments(prev => [...prev, { attachmentId: data.attachmentId, fileName: data.fileName }]);
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

    if (!getRenderablePhotoMimeType(file.name, file.type)) {
      window.alert('Subject photo preview supports JPG, PNG, GIF, WEBP, BMP, and SVG files. Convert HEIC/HEIF photos before uploading.');
      return;
    }

    // Read file as data URL — no blob lifecycle issues, works immediately as img src
    const previewDataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string ?? null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

    if (!previewDataUrl) return; // file read failed

    // Show preview immediately (data URL is a plain string — cannot be revoked)
    setPhotoDisplayUrl(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return previewDataUrl;
    });
    setPhotoModalUrl(previewDataUrl);

    setPhotoUploading(true);
    try {
      if (!requestId) {
        window.alert('Save the request before adding a subject photo.');
        setPhotoDisplayUrl(null);
        setPhotoModalUrl(null);
        setPhotoUploading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file, `${SUBJECT_PHOTO_FILE_PREFIX}${file.name}`);

      const res = await fetch(`/api/requests/${requestId}/attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const attachmentId = data?.attachmentId;
      if (!attachmentId) {
        throw new Error('Missing attachment ID');
      }

      const currentVal = val('Subject Photo Image');
      if (currentVal.startsWith(PHOTO_REF_PREFIX)) {
        const previousAttachmentId = parseInt(currentVal.slice(PHOTO_REF_PREFIX.length), 10);
        if (!Number.isNaN(previousAttachmentId)) {
          await fetch(`/api/attachments/${previousAttachmentId}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }).catch(() => {});
        }
      }

      set('Subject Photo Image', `${PHOTO_REF_PREFIX}${attachmentId}`);
    } catch (err) {
      console.error('Subject photo upload failed', err);
      setPhotoDisplayUrl(null);
      setPhotoModalUrl(null);
    } finally {
      setPhotoUploading(false);
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
    setPhotoModalUrl(null);
    setPhotoModalOpen(false);
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
    if (requestId && !photoFieldValue) {
      setPhotoRenderReady(false);
      setPhotoLoading(false);
      setPhotoDisplayUrl(prev => {
        if (photoUploading) return prev;
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      setPhotoModalUrl(null);
      setPhotoModalOpen(false);
      return;
    }

    if (!photoFieldValue) {
      setPhotoRenderReady(false);
      setPhotoLoading(false);
      setPhotoDisplayUrl(prev => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      setPhotoModalUrl(null);
      setPhotoModalOpen(false);
      return;
    }
    if (photoFieldValue.startsWith('data:image')) {
      setPhotoRenderReady(false);
      setPhotoLoading(false);
      setPhotoDisplayUrl(photoFieldValue);
      setPhotoModalUrl(photoFieldValue);
      return;
    }
    if (photoFieldValue.startsWith(PHOTO_REF_PREFIX)) {
      const attachmentId = parseInt(photoFieldValue.slice(PHOTO_REF_PREFIX.length));
      if (isNaN(attachmentId)) return;
      if (failedPhotoIds.current.has(attachmentId)) return;

      const token = localStorage.getItem('token');
      setPhotoRenderReady(false);
      setPhotoLoading(true);
      setPhotoDisplayUrl(prev => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      setPhotoModalUrl(null);
      fetch(`/api/attachments/${attachmentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const attachmentName = formAttachments.find(a => a.attachmentId === attachmentId)?.fileName;
          const renderableMimeType = getRenderablePhotoMimeType(
            attachmentName,
            res.headers.get('Content-Type'),
          );
          if (!renderableMimeType) {
            throw new Error('UNSUPPORTED_IMAGE_FORMAT');
          }

          const buffer = await res.arrayBuffer();
          const normalizedBytes = normalizeAttachmentBytes(buffer);
          const blob = new Blob([normalizedBytes], { type: renderableMimeType });
          return blobToDataUrl(blob);
        })
        .then(async dataUrl => {
          await waitForImageReady(dataUrl);
          setPhotoDisplayUrl(prev => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
            return dataUrl;
          });
          setPhotoModalUrl(dataUrl);
          setPhotoLoading(false);
        })
        .catch(err => {
          if (err.message === 'UNSUPPORTED_IMAGE_FORMAT') {
            setPhotoDisplayUrl(null);
            setPhotoModalUrl(null);
            setPhotoLoading(false);
            return;
          }
          if (err.message.includes('404') && photoField) {
            failedPhotoIds.current.add(attachmentId);
            onChangeRef.current(String(photoField.FIELD_ID), '');
            if (requestId) {
              const tok = localStorage.getItem('token');
              fetch(`/api/requests/${requestId}/field-value/${photoField.FIELD_ID}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${tok}` },
              }).catch(() => {});
            }
          }
          setPhotoLoading(false);
        });
    }
  }, [photoFieldValue, formAttachments, photoUploading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!photoDisplayUrl) {
      setPhotoRenderReady(false);
    }
  }, [photoDisplayUrl]);

  useEffect(() => {
    if (!photoModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPhotoModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photoModalOpen]);

  const openPhotoModal = () => {
    const modalUrl = photoDisplayUrl ?? photoModalUrl;
    if (!modalUrl) return;
    setPhotoModalUrl(modalUrl);
    setPhotoModalOpen(true);
  };


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

          {photoDisplayUrl ? (
            <div className="sw-photo-preview-wrap">
              <img
                key={photoDisplayUrl}
                src={photoDisplayUrl}
                alt="Subject"
                className="sw-photo-preview-img"
                onClick={openPhotoModal}
                onLoad={() => {
                  setPhotoRenderReady(true);
                  setPhotoLoading(false);
                }}
                onError={() => {
                  setPhotoRenderReady(false);
                  setPhotoLoading(false);
                }}
                title="Click to enlarge"
              />
              {(photoUploading || photoLoading || !photoRenderReady) && (
                <div className="sw-photo-uploading-overlay">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>{photoUploading ? 'Saving…' : 'Loading…'}</span>
                </div>
              )}
              {!readOnly && !photoUploading && !photoLoading && photoRenderReady && (
                <button
                  type="button"
                  className="sw-photo-remove"
                  onClick={removePhoto}
                  title="Remove photo"
                >
                  ✕
                </button>
              )}
              {!readOnly && !photoUploading && !photoLoading && photoRenderReady && (
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
          ) : (photoUploading || photoLoading) ? (
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
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {photoUploading ? 'Uploading…' : 'Loading…'}
              </span>
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

      {photoModalOpen && photoModalUrl && (
        <div
          className="sw-photo-modal-backdrop"
          onClick={() => setPhotoModalOpen(false)}
          role="presentation"
        >
          <div
            className="sw-photo-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Subject photo preview"
          >
            <button
              type="button"
              className="sw-photo-modal-close"
              onClick={() => setPhotoModalOpen(false)}
              aria-label="Close subject photo preview"
            >
              ✕
            </button>
            <img
              src={photoModalUrl}
              alt="Subject full preview"
              className="sw-photo-modal-img"
            />
          </div>
        </div>
      )}

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
          <AttachmentsDropZone
            uploading={uploading}
            attachLoading={attachLoading}
            formAttachments={formAttachments}
            photoRefValue={photoFieldValue}
            readOnly={readOnly}
            onFile={handleAttachmentUpload}
            onDownload={handleAttachmentDownload}
            onDelete={handleAttachmentDelete}
          />
        </div>
      )}

    </div>
  );
};

export default FidelitySubjectFormLayout;

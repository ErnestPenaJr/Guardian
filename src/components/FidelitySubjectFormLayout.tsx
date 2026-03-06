import React, { useMemo, useRef, useState } from 'react';
import '../styles/FidelitySubjectForm.css';

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
  fields: FormField[];
  /** Values keyed by String(FIELD_ID) */
  fieldValues: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  readOnly?: boolean;
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

const DEF_MARK:    MarkEntry    = { location: '', markType: '', description: '' };
const DEF_ADDRESS: AddressEntry = { street1: '', street2: '', city: '', state: '', zip: '' };
const DEF_PHONE:   PhoneEntry   = { number: '', phoneType: '' };

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
            <button type="button" className="sw-multi-remove" onClick={() => remove(i)} title="Remove">✕</button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="sw-multi-add" onClick={add}>+ Add Mark</button>
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
            {!readOnly && <button type="button" className="sw-multi-remove" onClick={() => remove(i)} title="Remove">✕</button>}
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
        <button type="button" className="sw-multi-add" onClick={add}>+ Add Address</button>
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
          {!readOnly && <button type="button" className="sw-multi-remove" onClick={() => remove(i)} title="Remove">✕</button>}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="sw-multi-add" onClick={add}>+ Add Phone</button>
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
          {!readOnly && <button type="button" className="sw-multi-remove" onClick={() => remove(i)} title="Remove">✕</button>}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="sw-multi-add" onClick={add}>+ Add IP</button>
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
}) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    // Reset so the same file can be re-selected if removed
    e.target.value = '';
  };

  const removePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
  };

  const fm = useMemo(() => {
    const m = new Map<string, FormField>();
    for (const f of fields) {
      if (f.FIELD_NAME) m.set(f.FIELD_NAME.trim().toLowerCase(), f);
    }
    return m;
  }, [fields]);

  const getF = (name: string) => fm.get(name.trim().toLowerCase());

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
    <div className="sw-doc">

      {/* ── TITLE BAR ──────────────────────────────── */}
      <div className="sw-title-bar">
        <div className="sw-title-label">Subject Workup</div>
        <div className="sw-title-name">{subjectName}</div>
        <div className="sw-title-meta">
          <span className="sw-meta-label">CASE #:</span>
          <span className="sw-meta-value">{val('Case #') || '—'}</span>
        </div>
      </div>

      {/* ── DATE / CASE # / INVESTIGATOR ───────────── */}
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
          <span className="sw-date-label">Investigator:</span>
          <DocInput value="" onChange={() => {}} readOnly placeholder="—" />
        </div>
      </div>

      {/* ── BODY: FIELDS + PHOTO ────────────────────── */}
      <div className="sw-body-grid">
        <div className="sw-fields-col">

          {/* Subject Name */}
          <div className="sw-field-row">
            <div className="sw-field-label">Subject Name(s):</div>
            <div className="sw-field-value">
              <DocInput
                value={val('First Name')}
                onChange={v => set('First Name', v)}
                readOnly={readOnly}
                placeholder="First"
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
                placeholder="Last"
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
          <div className="sw-field-row">
            <div className="sw-field-label">DOB:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('Date of Birth')}
                onChange={v => set('Date of Birth', v)}
                readOnly={readOnly}
                placeholder="MM/DD/YYYY"
              />
            </div>
          </div>

          {/* SSN */}
          <div className="sw-field-row">
            <div className="sw-field-label">SSN:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('Social Security Number')}
                onChange={v => set('Social Security Number', v)}
                readOnly={readOnly}
                placeholder="XXX-XX-XXXX"
                style={{ maxWidth: '150px' }}
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
              <DocInput
                value={val('Place of Birth (State)')}
                onChange={v => set('Place of Birth (State)', v)}
                readOnly={readOnly}
                placeholder="State"
                style={{ flex: '0.6' }}
              />
              <DocInput
                value={val('Place of Birth (Country)')}
                onChange={v => set('Place of Birth (Country)', v)}
                readOnly={readOnly}
                placeholder="Country"
                style={{ flex: '0.8' }}
              />
            </div>
          </div>

          {/* Height + Weight */}
          <div className="sw-field-row sw-double-right">
            <div className="sw-field-label">Height:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('Height')}
                onChange={v => set('Height', v)}
                readOnly={readOnly}
                placeholder="e.g. 5ft 10in"
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

          {photoUrl ? (
            <div className="sw-photo-preview-wrap">
              <img
                src={photoUrl}
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
                <span className="sw-photo-hint">Click to upload</span>
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
        <div className="sw-contact-pane">
          <div className="sw-contact-hdr">Address(s):</div>
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
        <div className="sw-contact-pane">
          <div className="sw-contact-hdr">Phone Number(s):</div>
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
          <div className="sw-contact-body sw-social-row">
            <DocSelect
              value={val('Social Media Platform')}
              onChange={v => set('Social Media Platform', v)}
              readOnly={readOnly}
              options={SOCIAL_PLATFORM_OPTS}
              placeholder="Platform"
              style={{ flex: '0 0 120px' }}
            />
            <DocInput
              value={val('Social Media Handle')}
              onChange={v => set('Social Media Handle', v)}
              readOnly={readOnly}
              placeholder="@handle"
            />
            <DocInput
              value={val('Social Media URL')}
              onChange={v => set('Social Media URL', v)}
              readOnly={readOnly}
              placeholder="URL"
              type="url"
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

      {/* ── PAGE 2 SEPARATOR ────────────────────────── */}
      <div className="sw-page-break">— Page 2 —</div>

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

    </div>
  );
};

export default FidelitySubjectFormLayout;

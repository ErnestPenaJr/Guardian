import React, { useMemo } from 'react';
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

// ── Main layout component ─────────────────────────────────────────
const FidelitySubjectFormLayout: React.FC<Props> = ({
  fields,
  fieldValues,
  onChange,
  readOnly = false,
}) => {
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
              <DocInput
                value={val('Suffix')}
                onChange={v => set('Suffix', v)}
                readOnly={readOnly}
                placeholder="Sfx"
                style={{ flex: '0.35' }}
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
                type="date"
                style={{ maxWidth: '160px' }}
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
              <DocInput
                value={val('DL Issuing State')}
                onChange={v => set('DL Issuing State', v)}
                readOnly={readOnly}
                placeholder="ST"
                style={{ maxWidth: '52px' }}
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
              <DocInput
                value={val('Race')}
                onChange={v => set('Race', v)}
                readOnly={readOnly}
                placeholder="Race"
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
              <DocInput
                value={val('Weight')}
                onChange={v => set('Weight', v)}
                readOnly={readOnly}
                placeholder="160 lbs"
              />
            </div>
          </div>

          {/* Eye Color + Hair Color */}
          <div className="sw-field-row sw-double-right">
            <div className="sw-field-label">Eye Color:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('Eye Color')}
                onChange={v => set('Eye Color', v)}
                readOnly={readOnly}
                placeholder="Eye color"
              />
            </div>
            <div className="sw-field-label sw-right-label">Hair Color:</div>
            <div className="sw-field-value">
              <DocInput
                value={val('Hair Color')}
                onChange={v => set('Hair Color', v)}
                readOnly={readOnly}
                placeholder="Hair color"
              />
            </div>
          </div>

        </div>{/* /sw-fields-col */}

        {/* PHOTO PLACEHOLDER */}
        <div className="sw-photo-col">
          <div className="sw-photo-placeholder">
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
          </div>
        </div>

      </div>{/* /sw-body-grid */}

      {/* ── PHYSICAL MARKS / TATTOOS ────────────────── */}
      <div className="sw-section-hdr">Physical Marks / Tattoos / Scars:</div>
      <div className="sw-full-textarea">
        <DocTextarea
          value={val('Tattoos / Marks')}
          onChange={v => set('Tattoos / Marks', v)}
          readOnly={readOnly}
          placeholder="Describe physical marks, tattoos, scars…"
          rows={3}
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
            <DocTextarea
              value={val('Address')}
              onChange={v => set('Address', v)}
              readOnly={readOnly}
              placeholder="Street, City, State, ZIP…"
              rows={3}
            />
          </div>
          <div className="sw-ip-section">
            <div className="sw-ip-label">IP Address(s):</div>
            <div className="sw-contact-body">
              <DocInput
                value={val('IP Address')}
                onChange={v => set('IP Address', v)}
                readOnly={readOnly}
                placeholder="IPv4 or IPv6"
              />
            </div>
          </div>
        </div>

        {/* Right: Phone + Social */}
        <div className="sw-contact-pane">
          <div className="sw-contact-hdr">Phone Number(s):</div>
          <div className="sw-contact-body">
            <DocInput
              value={val('Phone Number')}
              onChange={v => set('Phone Number', v)}
              readOnly={readOnly}
              placeholder="(555) 000-0000"
              type="tel"
            />
          </div>
          <div className="sw-contact-hdr" style={{ borderTop: '1px solid #000' }}>
            Social Media:
          </div>
          <div className="sw-contact-body sw-social-row">
            <DocInput
              value={val('Social Media Platform')}
              onChange={v => set('Social Media Platform', v)}
              readOnly={readOnly}
              placeholder="Platform"
              style={{ flex: '0 0 90px' }}
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

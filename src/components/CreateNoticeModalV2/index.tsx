import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import {
  DISTRIBUTION_OPTIONS,
  SENSITIVITY_OPTIONS,
  buildNoticeContent,
  type DistributionType,
  type Sensitivity,
} from '../../config/noticeTemplates';
import api from '../../utils/api';
import customTemplateService from '../../services/customTemplateService';
import type { TemplateSummary, TemplateDetail, TemplateField } from '../../types/template';
import CommonEditor from '../CommonEditor';
import RecipientPicker, { type RecipientOption } from './RecipientPicker';
import { FileText, AlertTriangle } from 'lucide-react';
import { parseValidation, validateAll, maskCurrencyInput, formatCurrency } from '../../utils/fieldValidation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type FieldKind = 'text' | 'textarea' | 'number' | 'email' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'time' | 'datetime' | 'file_upload';

interface ViewField {
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options: string[];
  validation?: string | null;
}

function mapFieldType(raw: string | null | undefined): FieldKind {
  const s = (raw || '').toLowerCase();
  if (s.includes('textarea')) return 'textarea';
  if (s.includes('number')) return 'number';
  if (s.includes('email')) return 'email';
  if (s.includes('dropdown') || s === 'select') return 'dropdown';
  if (s.includes('radio')) return 'radio';
  if (s.includes('checkbox')) return 'checkbox';
  // DateTime / Time must come BEFORE the plain-date check — 'datetime' contains
  // 'date', so without ordering these first a DateTime field gets rendered as
  // a date input and the time portion is silently dropped.
  if (s.includes('datetime') || s === 'date_time' || s === 'date time') return 'datetime';
  if (s.includes('time')) return 'time';
  if (s.includes('date')) return 'date';
  if (s.includes('file')) return 'file_upload';
  return 'text';
}

function toViewField(f: TemplateField): ViewField {
  let options: string[] = [];
  if (f.OPTIONS) {
    try {
      const parsed = JSON.parse(f.OPTIONS);
      if (Array.isArray(parsed)) options = parsed.map(String);
    } catch {
      options = f.OPTIONS.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return {
    id: String(f.FIELD_ID),
    label: f.FIELD_NAME,
    kind: mapFieldType(f.fieldType),
    required: !!f.IS_REQUIRED,
    options,
    validation: f.VALIDATION,
  };
}

const COMPLIANCE_NOTE = (
  <span style={{ fontSize: 12, color: '#828282', fontFamily: 'Inter, sans-serif' }}>
    <span style={{ color: '#C10000' }}>*</span> Required fields &nbsp;·&nbsp; All actions are logged for CJS audit compliance
  </span>
);

export default function CreateNoticeModalV2({ isOpen, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [sensitivity, setSensitivity] = useState<Sensitivity>('MEDIUM');
  const [distribution, setDistribution] = useState<DistributionType>('INTERNAL');
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // PII acknowledgement modal — gates Step 1 → Step 2 when the chosen
  // template is a Securities (SEC) notice. No persistence; advisory only.
  const [showPiiAck, setShowPiiAck] = useState(false);

  const handleTitleChange = (v: string) => {
    setUserEditedTitle(true);
    setTitle(v);
  };

  const handleAdvanceToStep2 = () => {
    if (selectedSummary?.NOTICE_CATEGORY === 'SEC') {
      setShowPiiAck(true);
      return;
    }
    setStep(2);
  };

  const acknowledgePii = () => {
    setShowPiiAck(false);
    setStep(2);
  };

  const cancelPiiAck = () => {
    setShowPiiAck(false);
  };

  const selectedSummary = useMemo(
    () => templates.find((t) => t.FORM_ID === selectedId) || null,
    [templates, selectedId],
  );

  const viewFields: ViewField[] = useMemo(
    () => (detail?.fields || []).map(toViewField),
    [detail],
  );

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const rows = await customTemplateService.listActiveNoticeTemplates();
      setTemplates(rows);
      if (rows.length > 0) setSelectedId((prev) => prev ?? rows[0].FORM_ID);
    } catch (e: any) {
      setTemplatesError(e?.response?.data?.error || e?.message || 'Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && step === 1 && templates.length === 0 && !templatesLoading) {
      loadTemplates();
    }
  }, [isOpen, step]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    if (detail?.form.FORM_ID === selectedId) return;
    setDetailLoading(true);
    customTemplateService
      .getById(selectedId)
      .then(setDetail)
      .catch((e) => setError(e?.response?.data?.error || 'Failed to load template fields'))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  // Securities (SEC) notice templates: auto-compose the notice title from the
  // template's "Security Symbols" and "Lost Exposure" fields. Stops respecting
  // template values once the user types in the title field directly.
  useEffect(() => {
    setUserEditedTitle(false);
  }, [selectedId]);

  useEffect(() => {
    if (userEditedTitle) return;
    if (detail?.form?.NOTICE_CATEGORY !== 'SEC') return;

    const symbolLabels = new Set(['security symbols', 'security symbol', 'symbols', 'symbol']);
    const exposureLabels = new Set(['lost exposure', 'loss exposure', 'exposure']);

    const findValue = (labels: Set<string>) => {
      const f = viewFields.find((vf) => labels.has(vf.label.trim().toLowerCase()));
      return f ? (templateValues[f.id] || '').trim() : '';
    };

    const symbols = findValue(symbolLabels);
    const exposure = findValue(exposureLabels);
    const composed = [symbols, exposure].filter(Boolean).join(' - ');

    if (composed !== title) setTitle(composed);
  }, [detail, viewFields, templateValues, userEditedTitle, title]);

  const reset = () => {
    setStep(1);
    setSelectedId(templates[0]?.FORM_ID || null);
    setDetail(null);
    setTitle('');
    setUserEditedTitle(false);
    setSensitivity('MEDIUM');
    setDistribution('INTERNAL');
    setRecipients([]);
    setTemplateValues({});
    setBody('');
    setError(null);
    setFieldErrors({});
    setShowPiiAck(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async (status: 'DRAFT' | 'PUBLISHED') => {
    setError(null);
    setFieldErrors({});
    if (!selectedSummary || !detail) return setError('Select a template');
    if (status === 'PUBLISHED') {
      if (!title.trim()) return setError('Notice title is required');
      if (recipients.length === 0) return setError('At least one recipient is required');

      const fieldValidationErrors = validateAll(
        viewFields.map((f) => ({ key: f.id, rules: parseValidation(f.validation), required: f.required })),
        templateValues,
      );
      if (Object.keys(fieldValidationErrors).length) {
        setFieldErrors(fieldValidationErrors);
        return setError('Please fix the highlighted fields.');
      }
    }

    const templateFieldLabelValues: Record<string, string> = {};
    for (const f of viewFields) {
      const v = templateValues[f.id];
      if (v) templateFieldLabelValues[f.label] = v;
    }

    const content = buildNoticeContent({
      templateId: `FORM_${selectedSummary.FORM_ID}`,
      distributionType: distribution,
      templateValues: templateFieldLabelValues,
      body,
    });

    // Map our internal codes to the MY_NOTICES schema the dashboard reads from.
    const SENSITIVITY_MAP: Record<Sensitivity, string> = {
      LOW: 'Low',
      MEDIUM: 'Medium',
      HIGH: 'High',
    };
    const DISTRIBUTION_MAP: Record<DistributionType, string> = {
      INTERNAL: 'Internal Only',
      EXTERNAL: 'External Only',
      RESTRICTED: 'Mixed (Internal + External)',
    };

    const templateValuesByFieldId: Record<string, string> = {};
    for (const f of viewFields) {
      const v = templateValues[f.id];
      if (v) templateValuesByFieldId[f.id] = v;
    }

    try {
      setSubmitting(true);
      await api.post('/api/my-notices', {
        NOTICE_TITLE: title.trim() || `(Draft) ${selectedSummary.FORM_NAME}`,
        SENSITIVITY_CLASSIFICATION: SENSITIVITY_MAP[sensitivity],
        BUTTON_STATUS: status === 'PUBLISHED' ? 'Sent' : 'Draft',
        DISTRIBUTION_TYPE: DISTRIBUTION_MAP[distribution],
        NOTICE_BODY: content,
        RECIPIENTS: recipients.filter((r) => r.kind === 'user').map((r) => r.id),
        contactGroups: recipients.filter((r) => r.kind === 'group').map((r) => r.id),
        SEND_NOTICE: status === 'PUBLISHED',
        TEMPLATE_FORM_ID: selectedSummary.FORM_ID,
        TEMPLATE_VALUES_JSON: JSON.stringify(templateValuesByFieldId),
      });
      toast.success(status === 'PUBLISHED' ? 'Notice sent' : 'Draft saved');
      onCreated?.();
      reset();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || 'Failed to create notice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      ariaHideApp={false}
      style={{
        overlay: {
          backgroundColor: 'rgba(3, 36, 36, 0.6)',
          zIndex: 1050,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '40px 16px',
          overflowY: 'auto',
        },
        content: {
          position: 'relative',
          inset: 'auto',
          width: '100%',
          maxWidth: 720,
          padding: 0,
          border: '1px solid #E0E0E0',
          borderRadius: 4,
          background: '#FFFFFF',
          overflow: 'hidden',
        },
      }}
    >
      <ModalHeader
        title={step === 1 ? 'Create notice' : 'Create notice — save as draft or send'}
        onClose={handleClose}
      />

      {step === 2 && selectedSummary && (
        <TemplateBanner summary={selectedSummary} onChange={() => setStep(1)} />
      )}

      <div style={{ padding: '20px 24px', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              background: '#FDECEC',
              border: '1px solid #F5B5B5',
              color: '#8A1F1F',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {error}
          </div>
        )}

        {step === 1 ? (
          <Step1
            templates={templates}
            loading={templatesLoading}
            error={templatesError}
            onRetry={loadTemplates}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <Step2
            fields={viewFields}
            detailLoading={detailLoading}
            title={title}
            setTitle={handleTitleChange}
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
            distribution={distribution}
            setDistribution={setDistribution}
            recipients={recipients}
            setRecipients={setRecipients}
            templateValues={templateValues}
            setTemplateValues={setTemplateValues}
            body={body}
            setBody={setBody}
            disabled={submitting}
            templateName={selectedSummary?.FORM_NAME || ''}
            fieldErrors={fieldErrors}
          />
        )}
      </div>

      <ModalFooter>
        <div>{COMPLIANCE_NOTE}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {step === 1 ? (
            <>
              <SecondaryBtn onClick={handleClose}>Cancel</SecondaryBtn>
              <PrimaryBtn
                onClick={handleAdvanceToStep2}
                disabled={!selectedId || templates.length === 0}
              >
                Next
              </PrimaryBtn>
            </>
          ) : (
            <>
              <SecondaryBtn onClick={() => setStep(1)} disabled={submitting}>
                Back
              </SecondaryBtn>
              <GhostBtn onClick={() => submit('DRAFT')} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save draft'}
              </GhostBtn>
              <PrimaryBtn onClick={() => submit('PUBLISHED')} disabled={submitting}>
                {submitting ? 'Sending…' : 'Send notice'}
              </PrimaryBtn>
            </>
          )}
        </div>
      </ModalFooter>
    </Modal>

    <Modal
      isOpen={showPiiAck}
      onRequestClose={cancelPiiAck}
      ariaHideApp={false}
      style={{
        overlay: {
          backgroundColor: 'rgba(3, 36, 36, 0.7)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 16px',
        },
        content: {
          position: 'relative',
          inset: 'auto',
          width: '100%',
          maxWidth: 480,
          padding: 24,
          border: '1px solid #E0E0E0',
          borderRadius: 8,
          background: '#FFFFFF',
        },
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: '#FEF2F2',
            color: '#B91C1C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={22} />
        </div>
        <h3
          style={{
            margin: 0,
            fontFamily: 'Montserrat, sans-serif',
            fontSize: 17,
            fontWeight: 600,
            color: '#032424',
          }}
        >
          No PII in Securities Notices
        </h3>
      </div>
      <p
        style={{
          color: '#374151',
          fontSize: 14,
          lineHeight: 1.5,
          margin: '0 0 20px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        PII (names, SSNs, DOBs, account numbers) is not permitted in Securities
        notices. Confirm that you understand and will not include any personally
        identifiable information when filling out this notice.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <SecondaryBtn onClick={cancelPiiAck}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={acknowledgePii}>I Acknowledge</PrimaryBtn>
      </div>
    </Modal>
    </>
  );
}

/* ---------- Header / Footer / Banner ---------- */

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      style={{
        padding: '18px 24px',
        borderBottom: '1px solid #E0E0E0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 20,
          fontWeight: 600,
          color: '#032424',
        }}
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 20,
          color: '#828282',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 24px',
        borderTop: '1px solid #E0E0E0',
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

function TemplateBanner({
  summary,
  onChange,
}: {
  summary: TemplateSummary;
  onChange: () => void;
}) {
  return (
    <div
      style={{
        background: '#EBF5FE',
        borderBottom: '1px solid #B5D4F4',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600, color: '#032424' }}>
          {summary.FORM_NAME}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4F4F4F' }}>
          {summary.FORM_DESCRIPTION}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 13,
          color: '#2F8CED',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Change
      </button>
    </div>
  );
}

/* ---------- Step 1 ---------- */

function Step1({
  templates,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
}: {
  templates: TemplateSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (loading) {
    return <div style={{ color: '#828282', fontFamily: 'Inter, sans-serif', padding: 24, textAlign: 'center' }}>Loading templates…</div>;
  }
  if (error) {
    return (
      <div style={{ color: '#C10000', fontFamily: 'Inter, sans-serif', padding: 16 }}>
        Failed to load templates.{' '}
        <button
          type="button"
          onClick={onRetry}
          style={{ border: 'none', background: 'transparent', color: '#2F8CED', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (templates.length === 0) {
    return (
      <div style={{ fontFamily: 'Inter, sans-serif', color: '#4F4F4F', padding: 16 }}>
        No notice templates available.{' '}
        <a href="/admin/workflow-templates?type=notice" style={{ color: '#2F8CED' }}>
          Create one in Custom Workflow Templates
        </a>
        .
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {templates.map((t) => {
        const selected = selectedId === t.FORM_ID;
        return (
          <button
            type="button"
            key={t.FORM_ID}
            onClick={() => onSelect(t.FORM_ID)}
            style={{
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 14px',
              border: selected ? '1.5px solid #2F8CED' : '1px solid #E0E0E0',
              borderRadius: 4,
              background: selected ? '#EBF5FE' : '#FFFFFF',
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Radio selected={selected} />
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: selected ? '#B5D4F4' : '#E0E0E0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={16} color={selected ? '#2F8CED' : '#828282'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1F1F1F' }}>{t.FORM_NAME}</div>
              <div style={{ fontSize: 13, color: '#4F4F4F', marginTop: 2 }}>{t.FORM_DESCRIPTION}</div>
            </div>
            <span
              style={{
                background: '#EBF5FE',
                border: '1px solid #B5D4F4',
                color: '#1a5f8a',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 3,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              CUSTOM
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      style={{
        width: 17,
        height: 17,
        borderRadius: '50%',
        border: selected ? 'none' : '1.5px solid #BDBDBD',
        background: selected ? '#2F8CED' : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {selected && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFFFFF' }} />
      )}
    </span>
  );
}

/* ---------- Step 2 ---------- */

interface Step2Props {
  fields: ViewField[];
  detailLoading: boolean;
  title: string;
  setTitle: (v: string) => void;
  sensitivity: Sensitivity;
  setSensitivity: (v: Sensitivity) => void;
  distribution: DistributionType;
  setDistribution: (v: DistributionType) => void;
  recipients: RecipientOption[];
  setRecipients: (v: RecipientOption[]) => void;
  templateValues: Record<string, string>;
  setTemplateValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  body: string;
  setBody: (v: string) => void;
  disabled: boolean;
  templateName: string;
  fieldErrors: Record<string, string>;
}

function Step2(p: Step2Props) {
  const setVal = (id: string, v: string) => {
    p.setTemplateValues((prev) => ({ ...prev, [id]: v }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionDivider label="Notice details" />
      <Field label="Notice title" required>
        <TextInput value={p.title} onChange={p.setTitle} disabled={p.disabled} placeholder="Enter a clear, descriptive title" />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Sensitivity classification" required>
          <SelectInput
            value={p.sensitivity}
            onChange={(v) => p.setSensitivity(v as Sensitivity)}
            disabled={p.disabled}
            options={SENSITIVITY_OPTIONS}
          />
        </Field>
        <Field label="Distribution type" required>
          <SelectInput
            value={p.distribution}
            onChange={(v) => p.setDistribution(v as DistributionType)}
            disabled={p.disabled}
            options={DISTRIBUTION_OPTIONS}
          />
        </Field>
      </div>

      <Field label="Recipients" required>
        <RecipientPicker disabled={p.disabled} selected={p.recipients} onChange={p.setRecipients} />
      </Field>

      <SectionDivider label={`Template fields — ${p.templateName.toUpperCase()}`} />
      {p.detailLoading ? (
        <div style={{ color: '#828282', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Loading template fields…</div>
      ) : p.fields.length === 0 ? (
        <div style={{ color: '#828282', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>This template has no additional fields.</div>
      ) : (
        <div
          style={{
            background: '#EBF5FE',
            border: '1px solid #B5D4F4',
            borderRadius: 4,
            padding: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {p.fields.map((f) => {
            const fullWidth = f.kind === 'textarea' || f.kind === 'file_upload' || f.kind === 'checkbox' || f.kind === 'radio';
            return (
              <div key={f.id} style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#1a5f8a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 6,
                  }}
                >
                  {f.label}
                  {f.required && <span style={{ color: '#C10000' }}> *</span>}
                </label>
                <FieldInput field={f} value={p.templateValues[f.id] || ''} onChange={(v) => setVal(f.id, v)} disabled={p.disabled} errors={p.fieldErrors} />
              </div>
            );
          })}
        </div>
      )}

      <SectionDivider label="Notice body" />
      <CommonEditor value={p.body} onChange={p.setBody} />
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
  errors = {},
}: {
  field: ViewField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}) {
  const rules = parseValidation(field.validation);
  const fieldError = errors[field.id];
  const errorEl = fieldError ? (
    <div style={{ color: '#C10000', fontSize: 12, fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
      {fieldError}
    </div>
  ) : null;

  // Currency masking: store raw numeric string, display formatted
  if (rules.format === 'currency') {
    return (
      <>
        <input
          type="text"
          value={value ? formatCurrency(value) : ''}
          onChange={(e) => onChange(maskCurrencyInput(e.target.value))}
          disabled={disabled}
          placeholder="$0.00"
          style={{
            ...inputStyle,
            borderColor: fieldError ? '#C10000' : '#E0E0E0',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = fieldError ? '#C10000' : '#2F8CED')}
          onBlur={(e) => (e.currentTarget.style.borderColor = fieldError ? '#C10000' : '#E0E0E0')}
        />
        {errorEl}
      </>
    );
  }

  let inputEl: React.ReactNode;
  switch (field.kind) {
    case 'textarea':
      inputEl = <TextArea value={value} onChange={onChange} disabled={disabled} />;
      break;
    case 'number':
      inputEl = <TextInput type="number" value={value} onChange={onChange} disabled={disabled} />;
      break;
    case 'email':
      inputEl = <TextInput type="email" value={value} onChange={onChange} disabled={disabled} />;
      break;
    case 'date':
      inputEl = <TextInput type="date" value={value} onChange={onChange} disabled={disabled} />;
      break;
    case 'time':
      inputEl = <TextInput type="time" value={value} onChange={onChange} disabled={disabled} />;
      break;
    case 'datetime':
      inputEl = <TextInput type="datetime-local" value={value} onChange={onChange} disabled={disabled} />;
      break;
    case 'dropdown':
      inputEl = (
        <SelectInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          options={[{ value: '', label: 'Select…' }, ...field.options.map((o) => ({ value: o, label: o }))]}
        />
      );
      break;
    case 'radio':
      inputEl = (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {field.options.map((o) => (
            <label key={o} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#1F1F1F', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" name={field.id} value={o} checked={value === o} onChange={() => onChange(o)} disabled={disabled} />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    case 'checkbox': {
      const checked = new Set(value ? value.split('|') : []);
      const toggle = (o: string) => {
        if (checked.has(o)) checked.delete(o); else checked.add(o);
        onChange(Array.from(checked).join('|'));
      };
      inputEl = (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {field.options.map((o) => (
            <label key={o} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#1F1F1F', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={checked.has(o)} onChange={() => toggle(o)} disabled={disabled} />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    }
    case 'file_upload':
      inputEl = <input type="file" disabled={disabled} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }} />;
      break;
    default:
      inputEl = <TextInput value={value} onChange={onChange} disabled={disabled} />;
  }

  return (
    <>
      {inputEl}
      {errorEl}
    </>
  );
}

/* ---------- Shared form primitives ---------- */

function SectionDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        borderBottom: '1px solid #E0E0E0',
        paddingBottom: 6,
        fontFamily: 'Montserrat, sans-serif',
        fontSize: 10,
        fontWeight: 600,
        color: '#828282',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
      }}
    >
      {label}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          fontWeight: 500,
          color: '#4F4F4F',
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: '#C10000' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  color: '#1F1F1F',
  border: '1px solid #E0E0E0',
  borderRadius: 4,
  padding: '10px 12px',
  outline: 'none',
  background: '#FFFFFF',
};

function TextInput({
  value,
  onChange,
  disabled,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      style={inputStyle}
      onFocus={(e) => (e.currentTarget.style.borderColor = '#2F8CED')}
      onBlur={(e) => (e.currentTarget.style.borderColor = '#E0E0E0')}
    />
  );
}

function TextArea({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={3}
      style={{ ...inputStyle, resize: 'vertical', minHeight: 54, fontFamily: 'Inter, sans-serif' }}
      onFocus={(e) => (e.currentTarget.style.borderColor = '#2F8CED')}
      onBlur={(e) => (e.currentTarget.style.borderColor = '#E0E0E0')}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={inputStyle}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---------- Buttons ---------- */

const btnBase: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  fontWeight: 500,
  borderRadius: 4,
  cursor: 'pointer',
};

function PrimaryBtn({ children, onClick, disabled }: React.PropsWithChildren<{ onClick: () => void; disabled?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase,
        background: '#2F8CED',
        color: '#FFFFFF',
        border: 'none',
        padding: '10px 28px',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick, disabled }: React.PropsWithChildren<{ onClick: () => void; disabled?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase,
        background: '#FFFFFF',
        color: '#4F4F4F',
        border: '1px solid #BDBDBD',
        padding: '10px 28px',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick, disabled }: React.PropsWithChildren<{ onClick: () => void; disabled?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase,
        background: 'transparent',
        color: '#2F8CED',
        border: '1px solid #2F8CED',
        padding: '10px 20px',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

import React, { useMemo, useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';
import {
  NOTICE_TEMPLATES,
  DISTRIBUTION_OPTIONS,
  SENSITIVITY_OPTIONS,
  buildNoticeContent,
  getTemplateById,
  type NoticeTemplate,
  type NoticeTemplateId,
  type DistributionType,
  type Sensitivity,
} from '../../config/noticeTemplates';
import noticeService from '../../services/noticeService';
import CommonEditor from '../CommonEditor';
import RecipientPicker, { type RecipientOption } from './RecipientPicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const COMPLIANCE_NOTE = (
  <span style={{ fontSize: 12, color: '#828282', fontFamily: 'Inter, sans-serif' }}>
    <span style={{ color: '#C10000' }}>*</span> Required fields &nbsp;·&nbsp; All actions are logged for CJS audit compliance
  </span>
);

export default function CreateNoticeModalV2({ isOpen, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [templateId, setTemplateId] = useState<NoticeTemplateId>(NOTICE_TEMPLATES[0].id);
  const [title, setTitle] = useState('');
  const [sensitivity, setSensitivity] = useState<Sensitivity>('MEDIUM');
  const [distribution, setDistribution] = useState<DistributionType>('INTERNAL');
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(() => getTemplateById(templateId), [templateId]);

  const reset = () => {
    setStep(1);
    setTemplateId(NOTICE_TEMPLATES[0].id);
    setTitle('');
    setSensitivity('MEDIUM');
    setDistribution('INTERNAL');
    setRecipients([]);
    setTemplateValues({});
    setBody('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async (status: 'DRAFT' | 'PUBLISHED') => {
    setError(null);

    if (!title.trim()) return setError('Notice title is required');
    if (recipients.length === 0) return setError('At least one recipient is required');

    const missing = template.fields
      .filter((f) => f.required && !(templateValues[f.key] || '').trim())
      .map((f) => f.label);
    if (missing.length) {
      return setError(`Required template fields: ${missing.join(', ')}`);
    }

    const content = buildNoticeContent({
      templateId,
      distributionType: distribution,
      templateValues,
      body,
    });

    try {
      setSubmitting(true);
      await noticeService.createNotice({
        TITLE: title.trim(),
        CONTENT: content,
        NOTICE_TYPE: templateId,
        PRIORITY_LEVEL: sensitivity,
        STATUS: status,
        recipients: recipients.filter((r) => r.kind === 'user').map((r) => r.id),
        contactGroups: recipients.filter((r) => r.kind === 'group').map((r) => r.id),
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

      {step === 2 && <TemplateBanner template={template} onChange={() => setStep(1)} />}

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
            selectedId={templateId}
            onSelect={setTemplateId}
          />
        ) : (
          <Step2
            template={template}
            title={title}
            setTitle={setTitle}
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
          />
        )}
      </div>

      <ModalFooter>
        <div>{COMPLIANCE_NOTE}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {step === 1 ? (
            <>
              <SecondaryBtn onClick={handleClose}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={() => setStep(2)}>Next</PrimaryBtn>
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
  template,
  onChange,
}: {
  template: NoticeTemplate;
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
          {template.name}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#4F4F4F' }}>
          {template.description}
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
  selectedId,
  onSelect,
}: {
  selectedId: NoticeTemplateId;
  onSelect: (id: NoticeTemplateId) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {NOTICE_TEMPLATES.map((t) => {
        const Icon = t.icon;
        const selected = selectedId === t.id;
        return (
          <button
            type="button"
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
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
                width: 34,
                height: 34,
                borderRadius: 4,
                background: selected ? '#B5D4F4' : '#E0E0E0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={18} color={selected ? '#2F8CED' : '#828282'} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1F1F1F' }}>{t.name}</div>
              <div style={{ fontSize: 13, color: '#4F4F4F', marginTop: 2 }}>{t.description}</div>
            </div>
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
        width: 18,
        height: 18,
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
  template: NoticeTemplate;
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
}

function Step2(p: Step2Props) {
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

      <SectionDivider label="Template fields" />
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
        {p.template.fields.map((f) => {
          const fullWidth = f.type === 'textarea';
          return (
            <div key={f.key} style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 11,
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
              {f.type === 'textarea' ? (
                <TextArea
                  value={p.templateValues[f.key] || ''}
                  onChange={(v) => p.setTemplateValues((prev) => ({ ...prev, [f.key]: v }))}
                  disabled={p.disabled}
                />
              ) : (
                <TextInput
                  value={p.templateValues[f.key] || ''}
                  onChange={(v) => p.setTemplateValues((prev) => ({ ...prev, [f.key]: v }))}
                  disabled={p.disabled}
                />
              )}
            </div>
          );
        })}
      </div>

      <SectionDivider label="Notice body" />
      <CommonEditor value={p.body} onChange={p.setBody} />
    </div>
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
        fontSize: 11,
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
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
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
      style={{ ...inputStyle, resize: 'vertical', minHeight: 72, fontFamily: 'Inter, sans-serif' }}
      onFocus={(e) => (e.currentTarget.style.borderColor = '#2F8CED')}
      onBlur={(e) => (e.currentTarget.style.borderColor = '#E0E0E0')}
    />
  );
}

function SelectInput<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
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

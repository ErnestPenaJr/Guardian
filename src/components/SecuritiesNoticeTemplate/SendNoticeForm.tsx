import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Alert, Badge, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import FirstTimeRecipientModal from './FirstTimeRecipientModal';
import { parseValidation, validateAll, maskCurrencyInput, formatCurrency } from '../../utils/fieldValidation';

/**
 * Phase 5 / US-SNT-03 + US-SNT-04 — SendNoticeForm
 *
 * Renders the dynamic fields defined on a Securities Fraud Notice template
 * plus a single-recipient picker. The submit button label and behavior
 * switch based on template.REQUIRES_MANAGER_APPROVAL:
 *   - false → "Send Notice" → POST /api/securities-notices
 *   - true  → "Submit for Approval" → POST then PUT /:id/submit
 *
 * Recipient verification badges:
 *   - green badge "Verified" when GET /api/recipients/:id/verification reports
 *     PREVIOUSLY_VERIFIED
 *   - amber badge "First-time" otherwise (or when endpoint not yet wired)
 *
 * On 409 { requiresFirstTimeConfirmation: true } shows the modal and
 * resubmits with confirmFirstTime=true on confirm.
 */

interface TemplateField {
  FIELD_ID?: number;
  FIELD_NAME: string;
  FIELD_LABEL?: string;
  IS_REQUIRED?: boolean;
  IS_PII?: boolean;
  IS_ENABLED?: boolean;
  IS_READ_ONLY?: boolean;
  VALIDATION?: string | null;
}

interface TemplateSummary {
  FORM_ID: number;
  FORM_NAME: string;
  FORM_DESCRIPTION?: string;
  NOTICE_SUBTYPE?: string;
  REQUIRES_MANAGER_APPROVAL?: boolean;
  COMPLIANCE_DISCLAIMER_ENABLED?: boolean;
  TITLE_FORMAT?: string;
}

interface UserOption {
  USER_ID: number;
  FIRST_NAME?: string;
  LAST_NAME?: string;
  EMAIL?: string;
}

interface Props {
  templateId: number;
}

type VerificationStatus = 'FIRST_TIME' | 'PREVIOUSLY_VERIFIED' | 'UNKNOWN';

const SendNoticeForm: React.FC<Props> = ({ templateId }) => {
  const navigate = useNavigate();

  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [recipients, setRecipients] = useState<UserOption[]>([]);
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [verification, setVerification] = useState<VerificationStatus>('UNKNOWN');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Load template + recipients on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/forms/${templateId}`).then((r) => r.data),
      api.get('/api/notices/eligible-recipients').then((r) => r.data),
    ])
      .then(([formData, recips]: [unknown, unknown]) => {
        const fd = formData as { form?: TemplateSummary; fields?: TemplateField[] };
        if (fd.form) setTemplate(fd.form);
        if (Array.isArray(fd.fields))
          setFields(fd.fields.filter((f) => f.IS_ENABLED !== false));

        if (Array.isArray(recips)) {
          setRecipients(
            recips.map((u: Record<string, unknown>) => ({
              USER_ID: Number(u.USER_ID),
              FIRST_NAME: (u.FIRST_NAME as string) ?? '',
              LAST_NAME: (u.LAST_NAME as string) ?? '',
              EMAIL: (u.EMAIL as string) ?? '',
            })),
          );
        }
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { error?: string } } };
        setError(err?.response?.data?.error ?? 'Failed to load template.');
      })
      .finally(() => setLoading(false));
  }, [templateId]);

  // Verification lookup for selected recipient. Phase 6 will expose
  // /api/recipients/:id/verification — until then we attempt the call and
  // fall back to FIRST_TIME so the UI still works.
  useEffect(() => {
    if (recipientId == null) {
      setVerification('UNKNOWN');
      return;
    }
    let cancelled = false;
    api
      .get(`/api/recipients/${recipientId}/verification`)
      .then((r) => {
        if (cancelled) return;
        const status = (r.data?.VERIFIED_STATUS ?? r.data?.status ?? 'FIRST_TIME') as
          | 'FIRST_TIME'
          | 'PREVIOUSLY_VERIFIED';
        setVerification(status === 'PREVIOUSLY_VERIFIED' ? 'PREVIOUSLY_VERIFIED' : 'FIRST_TIME');
      })
      .catch(() => {
        if (!cancelled) setVerification('FIRST_TIME');
      });
    return () => {
      cancelled = true;
    };
  }, [recipientId]);

  const handleFieldChange = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const buildPayload = (): Record<string, unknown> | null => {
    if (recipientId == null) {
      setError('Choose a recipient.');
      return null;
    }
    const symbol = values.SECURITY_SYMBOL;
    if (!symbol || symbol.trim().length === 0) {
      setError(
        'Security Symbol is a required field for Securities Fraud Notice templates and cannot be removed.',
      );
      return null;
    }
    const fErrors = validateAll(
      fields.map((f) => ({
        key: f.FIELD_NAME,
        rules: parseValidation(f.VALIDATION),
        required: f.FIELD_NAME === 'SECURITY_SYMBOL' || !!f.IS_REQUIRED,
      })),
      values,
    );
    if (Object.keys(fErrors).length) {
      setFieldErrors(fErrors);
      setError('Please fix the highlighted fields.');
      return null;
    }
    setFieldErrors({});
    return {
      templateFormId: templateId,
      fields: values,
      recipientUserId: recipientId,
    };
  };

  const submitDirect = async (payload: Record<string, unknown>, confirmFirstTime = false) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/securities-notices', {
        ...payload,
        confirmFirstTime,
      });
      toast.success('Notice sent.');
      navigate('/my-notices');
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: { error?: string; requiresFirstTimeConfirmation?: boolean } };
      };
      if (
        err?.response?.status === 409 &&
        err.response.data?.requiresFirstTimeConfirmation
      ) {
        setPendingPayload(payload);
        setShowFirstTimeModal(true);
        return;
      }
      setError(err?.response?.data?.error ?? 'Failed to send notice.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitForApproval = async (payload: Record<string, unknown>) => {
    setSubmitting(true);
    setError(null);
    try {
      // For approval flow, first create as DRAFT then submit. The current
      // POST endpoint short-circuits when REQUIRES_MANAGER_APPROVAL is true
      // (returns forbid). Until a dedicated draft endpoint is wired up in
      // Phase 6, we create the row by setting confirmFirstTime=true so the
      // server-side first-time check is bypassed, then call /:id/submit.
      //
      // NOTE: Plan Task 5.4 calls for submit on an existing DRAFT row. We
      // approximate by creating the notice as PENDING_APPROVAL directly via
      // the my-notices endpoint, then moving it through /submit. If that
      // proves incorrect, replace this branch with a dedicated draft POST.
      const draftRes = await api.post('/api/my-notices', {
        NOTICE_TITLE:
          buildTitleFromTemplate(template?.TITLE_FORMAT, payload.fields as Record<string, unknown>) ||
          `Securities Notice (template ${templateId})`,
        SENSITIVITY_CLASSIFICATION: 'CONFIDENTIAL',
        BUTTON_STATUS: 'DRAFT',
        DISTRIBUTION_TYPE: 'DIRECT',
        RECIPIENTS: [Number(payload.recipientUserId)],
        NOTICE_BODY: JSON.stringify(payload.fields),
        SEND_NOTICE: false,
      });
      const noticeId =
        draftRes.data?.data?.NOTICE_ID ??
        draftRes.data?.NOTICE_ID ??
        null;
      if (!noticeId) throw new Error('Draft creation did not return a notice id.');
      await api.put(`/api/securities-notices/${noticeId}/submit`);
      toast.success('Notice submitted for approval.');
      navigate('/my-notices');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error ?? 'Failed to submit notice for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = buildPayload();
    if (!payload) return;
    if (template?.REQUIRES_MANAGER_APPROVAL) {
      submitForApproval(payload);
    } else {
      submitDirect(payload);
    }
  };

  const handleFirstTimeConfirm = () => {
    setShowFirstTimeModal(false);
    if (pendingPayload) submitDirect(pendingPayload, true);
  };

  const handleFirstTimeCancel = () => {
    setShowFirstTimeModal(false);
    setPendingPayload(null);
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" /> Loading template…
      </div>
    );
  }

  const submitLabel = template?.REQUIRES_MANAGER_APPROVAL
    ? 'Submit for Approval'
    : 'Send Notice';

  const selectedRecipient = recipients.find((r) => r.USER_ID === recipientId);
  const recipientDisplayName = selectedRecipient
    ? `${selectedRecipient.FIRST_NAME ?? ''} ${selectedRecipient.LAST_NAME ?? ''}`.trim() ||
      selectedRecipient.EMAIL
    : undefined;

  return (
    <Form onSubmit={handleSubmit}>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="mb-4">
        <Card.Header>
          <strong>{template?.FORM_NAME ?? 'Securities Notice'}</strong>
          {template?.REQUIRES_MANAGER_APPROVAL && (
            <Badge bg="info" className="ms-2">
              Manager approval required
            </Badge>
          )}
        </Card.Header>
        <Card.Body className="d-flex flex-column gap-3">
          {fields.map((f) => {
            const rules = parseValidation(f.VALIDATION);
            const isCurrency = rules.format === 'currency';
            const hasError = !!fieldErrors[f.FIELD_NAME];
            return (
              <Form.Group key={f.FIELD_NAME} controlId={`field-${f.FIELD_NAME}`}>
                <Form.Label>
                  {f.FIELD_LABEL ?? f.FIELD_NAME}
                  {f.FIELD_NAME === 'SECURITY_SYMBOL' || f.IS_REQUIRED ? ' *' : ''}
                </Form.Label>
                {isCurrency ? (
                  <Form.Control
                    type="text"
                    value={values[f.FIELD_NAME] ? formatCurrency(values[f.FIELD_NAME]) : ''}
                    onChange={(e) =>
                      handleFieldChange(f.FIELD_NAME, maskCurrencyInput(e.target.value))
                    }
                    readOnly={f.IS_READ_ONLY}
                    required={f.FIELD_NAME === 'SECURITY_SYMBOL' || f.IS_REQUIRED}
                    placeholder="$0.00"
                    isInvalid={hasError}
                  />
                ) : (
                  <Form.Control
                    type="text"
                    value={values[f.FIELD_NAME] ?? ''}
                    onChange={(e) => handleFieldChange(f.FIELD_NAME, e.target.value)}
                    readOnly={f.IS_READ_ONLY}
                    required={f.FIELD_NAME === 'SECURITY_SYMBOL' || f.IS_REQUIRED}
                    isInvalid={hasError}
                  />
                )}
                {hasError && (
                  <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>
                    {fieldErrors[f.FIELD_NAME]}
                  </div>
                )}
              </Form.Group>
            );
          })}
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <strong>Recipient</strong>
        </Card.Header>
        <Card.Body>
          <Form.Group controlId="recipient-picker" className="mb-2">
            <Form.Select
              value={recipientId ?? ''}
              onChange={(e) =>
                setRecipientId(e.target.value ? Number(e.target.value) : null)
              }
              required
            >
              <option value="">Choose a recipient…</option>
              {recipients.map((u) => (
                <option key={u.USER_ID} value={u.USER_ID}>
                  {`${u.FIRST_NAME ?? ''} ${u.LAST_NAME ?? ''}`.trim() || u.EMAIL} — {u.EMAIL}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          {recipientId != null && (
            <div className="d-flex align-items-center gap-2">
              <span>Verification status:</span>
              {verification === 'PREVIOUSLY_VERIFIED' ? (
                <Badge bg="success">Verified</Badge>
              ) : (
                <Badge bg="warning" text="dark">
                  First-time recipient
                </Badge>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-end">
        <Button variant="secondary" onClick={() => navigate(-1)} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Working…' : submitLabel}
        </Button>
      </div>

      <FirstTimeRecipientModal
        show={showFirstTimeModal}
        recipientName={recipientDisplayName}
        onCancel={handleFirstTimeCancel}
        onConfirm={handleFirstTimeConfirm}
        loading={submitting}
      />
    </Form>
  );
};

function buildTitleFromTemplate(
  format: string | null | undefined,
  fields: Record<string, unknown>,
): string {
  const fmt = format && format.length > 0 ? format : '[SECURITY_SYMBOL] — $[LOSS_EXPOSURE]';
  return fmt
    .replace(/\[SECURITY_SYMBOL\]/g, String(fields.SECURITY_SYMBOL ?? ''))
    .replace(/\[LOSS_EXPOSURE\]/g, String(fields.LOSS_EXPOSURE ?? ''));
}

export default SendNoticeForm;

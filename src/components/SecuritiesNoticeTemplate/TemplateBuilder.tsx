import React, { useEffect, useState } from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import FieldRestrictionsPanel, { TemplateField } from './FieldRestrictionsPanel';
import DisclaimerToggle from './DisclaimerToggle';
import ManagerApprovalToggle from './ManagerApprovalToggle';

/**
 * Phase 5 / US-SNT-01 — Securities Fraud Notice Template Builder
 *
 * Composes the three Phase 4 compliance components and posts the resulting
 * template payload to POST /api/forms (the existing forms endpoint already
 * accepts NOTICE_SUBTYPE, REQUIRES_MANAGER_APPROVAL, COMPLIANCE_DISCLAIMER_ENABLED,
 * and TITLE_FORMAT — see server/routes/forms.ts Phase 4 additions).
 */

const DEFAULT_TITLE_FORMAT = '[SECURITY_SYMBOL] — $[LOSS_EXPOSURE]';

// Required-and-non-removable per the plan. SECURITY_SYMBOL is the only field
// that the FieldRestrictionsPanel renders as disabled-but-on.
const PRELOADED_FIELDS: TemplateField[] = [
  { FIELD_NAME: 'SECURITY_SYMBOL', FIELD_LABEL: 'Security Symbol', IS_ENABLED: true, IS_PII: false },
  { FIELD_NAME: 'INCIDENT_DATETIME', FIELD_LABEL: 'Incident Date/Time', IS_ENABLED: true, IS_PII: false },
  { FIELD_NAME: 'LOSS_EXPOSURE', FIELD_LABEL: 'Loss Exposure ($)', IS_ENABLED: true, IS_PII: false },
  { FIELD_NAME: 'VICTIM_COUNT', FIELD_LABEL: 'Victim Count', IS_ENABLED: true, IS_PII: true },
  { FIELD_NAME: 'SECURITIES_INVOLVED', FIELD_LABEL: 'Securities Involved', IS_ENABLED: true, IS_PII: false },
];

// Field type ID used when persisting these template fields. The Guardian forms
// endpoint requires a FIELD_TYPE_ID; we default to text-like (1) which is the
// most permissive type — Phase 6 maps these to richer types if needed.
const DEFAULT_FIELD_TYPE_ID = 1;

interface Props {
  /** Optional override for redirect target on save. Defaults to the admin
   * template list once that page exists. */
  onSaved?: (formId: number) => void;
}

const TemplateBuilder: React.FC<Props> = ({ onSaved }) => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [titleFormat, setTitleFormat] = useState(DEFAULT_TITLE_FORMAT);
  const [disclaimerEnabled, setDisclaimerEnabled] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [fields, setFields] = useState<TemplateField[]>(PRELOADED_FIELDS);
  const [lockedByJafar, setLockedByJafar] = useState<string[]>([]);
  const [soloRoleCompany, setSoloRoleCompany] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load JAFAR platform locks and company role count.
  useEffect(() => {
    api
      .get('/api/platform/jafar-locked-fields')
      .then((r) => {
        const raw = r.data?.lockedFields ?? r.data;
        if (Array.isArray(raw)) setLockedByJafar(raw.map(String));
      })
      .catch(() => {
        // Platform endpoint may 404 in older deploys — silently fall back.
      });

    api
      .get('/api/users/company-roles-count')
      .then((r) => {
        const count = Number(r.data?.count ?? r.data);
        if (Number.isFinite(count)) setSoloRoleCompany(count <= 1);
      })
      .catch(() => {
        // Default to "more than one role" if endpoint is unavailable so the
        // toggle stays enabled.
        setSoloRoleCompany(false);
      });
  }, []);

  const handleFieldChange = (next: TemplateField) => {
    setFields((prev) =>
      prev.map((f) => (f.FIELD_NAME === next.FIELD_NAME ? { ...f, ...next } : f)),
    );
  };

  const handleSave = async () => {
    setError(null);

    // Client-side: SECURITY_SYMBOL must be enabled and present.
    const symbol = fields.find((f) => f.FIELD_NAME === 'SECURITY_SYMBOL');
    if (!symbol || symbol.IS_ENABLED === false) {
      setError(
        'Security Symbol is a required field for Securities Fraud Notice templates and cannot be removed.',
      );
      return;
    }
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        form: {
          FORM_NAME: name.trim(),
          FORM_DESCRIPTION: description.trim(),
          IS_PUBLIC: false,
          IS_ACTIVE: true,
          IS_DELETED: false,
          NOTICE_SUBTYPE: 'SECURITIES_FRAUD' as const,
          REQUIRES_MANAGER_APPROVAL: requiresApproval,
          COMPLIANCE_DISCLAIMER_ENABLED: disclaimerEnabled,
          TITLE_FORMAT: titleFormat || DEFAULT_TITLE_FORMAT,
        },
        fields: fields.map((f, idx) => ({
          FIELD_NAME: f.FIELD_NAME,
          FIELD_TYPE_ID: DEFAULT_FIELD_TYPE_ID,
          IS_REQUIRED: f.FIELD_NAME === 'SECURITY_SYMBOL',
          SEQUENCE: idx + 1,
          IS_PII: !!f.IS_PII,
          IS_ENABLED: f.IS_ENABLED !== false,
          IS_READ_ONLY: !!f.IS_READ_ONLY,
        })),
      };

      const res = await api.post('/api/forms', payload);
      const formId = res.data?.form?.FORM_ID ?? res.data?.FORM_ID ?? null;
      toast.success('Securities Fraud Notice template saved.');
      if (onSaved && formId) onSaved(Number(formId));
      else navigate('/securities-notice-templates');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error ?? 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="securities-template-builder">
      <Card className="mb-4">
        <Card.Header>
          <strong>Securities Fraud Notice Template</strong>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" data-testid="template-builder-error">
              {error}
            </Alert>
          )}
          <Form.Group className="mb-3" controlId="template-name">
            <Form.Label>Template Name *</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Quarterly SEC Filing Notice"
              maxLength={50}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="template-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="template-title-format">
            <Form.Label>Title Format</Form.Label>
            <Form.Control
              type="text"
              value={titleFormat}
              onChange={(e) => setTitleFormat(e.target.value)}
              placeholder={DEFAULT_TITLE_FORMAT}
            />
            <Form.Text className="text-muted">
              Available placeholders: <code>[SECURITY_SYMBOL]</code>{' '}
              <code>[LOSS_EXPOSURE]</code>
            </Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <strong>Fields</strong>
        </Card.Header>
        <Card.Body>
          <FieldRestrictionsPanel
            fields={fields}
            lockedByJafar={lockedByJafar}
            onChange={handleFieldChange}
          />
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <strong>Compliance Controls</strong>
        </Card.Header>
        <Card.Body className="d-flex flex-column gap-3">
          <DisclaimerToggle
            enabled={disclaimerEnabled}
            noticeSubtype="SECURITIES_FRAUD"
            onChange={setDisclaimerEnabled}
          />
          <ManagerApprovalToggle
            value={requiresApproval}
            onChange={setRequiresApproval}
            soloRoleCompany={soloRoleCompany}
          />
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-end">
        <Button
          variant="secondary"
          onClick={() => navigate(-1)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Template'}
        </Button>
      </div>
    </div>
  );
};

export default TemplateBuilder;

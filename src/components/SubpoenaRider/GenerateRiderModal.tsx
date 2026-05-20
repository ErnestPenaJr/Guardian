import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Button, Alert, Spinner, Row, Col, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { scanForPII } from '../../utils/piiPatterns';
import subpoenaRiderService, {
  FraudType,
  SubpoenaTokenSpec,
} from '../../services/subpoenaRiderService';

/**
 * Phase 7 / US-SRB-02 — Generate Subpoena Rider modal.
 *
 * Lets a Processor (or Manager) pick a fraud type, see the configured
 * language template, fill in the per-incident token values, and persist
 * the resulting rider. Auto-populated tokens come pre-filled from the
 * incident notice payload (read-only). Editable tokens get a real-time
 * PII scan via the frontend mirror of the server-side patterns.
 */

const FRAUD_TYPES: { value: FraudType; label: string }[] = [
  { value: 'SECURITIES_MANIPULATION', label: 'Securities Manipulation' },
  { value: 'ATO', label: 'Account Takeover (ATO)' },
  { value: 'CHECK_FRAUD', label: 'Check Fraud' },
  { value: 'WIRE_FRAUD', label: 'Wire Fraud' },
];

// Tokens whose values are intentionally numeric or date-like — they're
// rider chrome (institution metadata, records-period date), not subject PII.
// Server uses the same allowlist; keep these in sync.
const TOKEN_PII_EXEMPT = new Set([
  'INSTITUTION_NAME',
  'INSTITUTION_DEPARTMENT',
  'INSTITUTION_ADDRESS_LINE_1',
  'INSTITUTION_CITY_STATE_ZIP',
  'INSTITUTION_FAX',
  'PERIOD_START_DATE',
]);

export interface IncidentTokenValues {
  /** Auto-populated values pulled from the incident notice (e.g. DATE_TIME_RANGE). */
  [key: string]: string | undefined;
}

interface Props {
  show: boolean;
  onHide: () => void;
  /** Optional incident notice id to attach the rider to. */
  incidentNoticeId?: number;
  /** Auto-populated token values from the incident (used for autoPopulateFromIncident=true tokens). */
  incidentTokenValues?: IncidentTokenValues;
  /** Called with the new rider id on successful generation. */
  onGenerated?: (riderId: number) => void;
}

const GenerateRiderModal: React.FC<Props> = ({
  show,
  onHide,
  incidentNoticeId,
  incidentTokenValues,
  onGenerated,
}) => {
  const [fraudType, setFraudType] = useState<FraudType>('SECURITIES_MANIPULATION');
  const [baseLanguage, setBaseLanguage] = useState('');
  const [tokenSpecs, setTokenSpecs] = useState<SubpoenaTokenSpec[]>([]);
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateMissing, setTemplateMissing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset state when modal opens or fraud type changes.
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setTemplateMissing(false);
      setServerError(null);
      try {
        const res = await subpoenaRiderService.getTemplate(fraudType);
        if (cancelled) return;
        const t = res.data?.template;
        setBaseLanguage(t?.BASE_LANGUAGE ?? '');
        let specs: SubpoenaTokenSpec[] = [];
        try {
          const parsed = JSON.parse(t?.TOKENS_JSON ?? '[]');
          if (Array.isArray(parsed)) {
            specs = parsed.map((p: Partial<SubpoenaTokenSpec>) => ({
              token: String(p.token ?? ''),
              description: String(p.description ?? ''),
              autoPopulateFromIncident: Boolean(p.autoPopulateFromIncident),
            }));
          }
        } catch {
          specs = [];
        }
        setTokenSpecs(specs);

        const initial: Record<string, string> = {};
        for (const spec of specs) {
          const incidentVal = spec.autoPopulateFromIncident
            ? incidentTokenValues?.[spec.token]
            : undefined;
          initial[spec.token] = incidentVal ?? '';
        }
        setTokenValues(initial);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setTemplateMissing(true);
          setBaseLanguage('');
          setTokenSpecs([]);
          setTokenValues({});
        } else {
          setServerError('Failed to load subpoena language template.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [show, fraudType, incidentTokenValues]);

  const tokenPiiHits = useMemo(() => {
    const hits: Record<string, string | undefined> = {};
    for (const spec of tokenSpecs) {
      if (spec.autoPopulateFromIncident) continue; // auto values come from a clean source
      if (TOKEN_PII_EXEMPT.has(spec.token)) continue; // rider chrome — not subject PII
      const value = tokenValues[spec.token] ?? '';
      if (!value) continue;
      const r = scanForPII(value);
      if (r.hit) hits[spec.token] = r.label;
    }
    return hits;
  }, [tokenSpecs, tokenValues]);

  const hasPiiHit = Object.keys(tokenPiiHits).length > 0;

  const preview = useMemo(() => {
    let p = baseLanguage;
    for (const [k, v] of Object.entries(tokenValues)) {
      p = p.split(`[${k}]`).join(v || `[${k}]`);
    }
    return p;
  }, [baseLanguage, tokenValues]);

  const handleSubmit = async () => {
    if (templateMissing) return;
    if (hasPiiHit) {
      setServerError(
        'PII is not permitted in subpoena rider language. Remove the detected value before proceeding.',
      );
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const res = await subpoenaRiderService.generateRider({
        fraudType,
        incidentNoticeId,
        tokenValues,
      });
      const riderId = res.data?.rider?.RIDER_ID;
      if (riderId) {
        toast.success('Subpoena rider generated.');
        onGenerated?.(riderId);
        onHide();
      } else {
        setServerError('Rider was generated but the server returned no id.');
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      const status = e?.response?.status;
      const msg = e?.response?.data?.error ?? 'Failed to generate subpoena rider.';
      if (status === 404) {
        setTemplateMissing(true);
      }
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Generate Subpoena Rider</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Fraud Type</Form.Label>
          <Form.Select
            value={fraudType}
            onChange={(e) => setFraudType(e.target.value as FraudType)}
            disabled={saving || loading}
          >
            {FRAUD_TYPES.map((ft) => (
              <option key={ft.value} value={ft.value}>
                {ft.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        {loading && (
          <div className="py-3 d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span className="text-muted small">Loading template…</span>
          </div>
        )}

        {templateMissing && (
          <Alert variant="warning">
            No subpoena template is configured for this fraud type. Contact your User Admin to create
            one.
          </Alert>
        )}

        {serverError && !templateMissing && (
          <Alert variant="danger" onClose={() => setServerError(null)} dismissible>
            {serverError}
          </Alert>
        )}

        {!loading && !templateMissing && tokenSpecs.length > 0 && (
          <>
            <h6 className="mt-2">Token Values</h6>
            <p className="text-muted small mb-3">
              Auto-populated tokens are filled from the incident and are read-only. Edit the
              remaining fields to complete the rider language. PII (names, SSNs, DOBs, account
              numbers) is not permitted.
            </p>
            <Row className="g-3">
              {tokenSpecs.map((spec) => {
                const value = tokenValues[spec.token] ?? '';
                const readOnly = spec.autoPopulateFromIncident;
                const piiLabel = tokenPiiHits[spec.token];
                return (
                  <Col xs={12} md={6} key={spec.token}>
                    <Form.Group>
                      <Form.Label className="d-flex align-items-center gap-2">
                        <code>[{spec.token}]</code>
                        {readOnly ? (
                          <Badge bg="secondary">auto</Badge>
                        ) : (
                          <Badge bg="info">editable</Badge>
                        )}
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setTokenValues((prev) => ({ ...prev, [spec.token]: e.target.value }))
                        }
                        readOnly={readOnly}
                        disabled={saving}
                        isInvalid={!!piiLabel}
                        placeholder={spec.description}
                      />
                      {piiLabel ? (
                        <Form.Text className="text-danger">
                          PII detected ({piiLabel}). Please remove it before continuing.
                        </Form.Text>
                      ) : (
                        <Form.Text className="text-muted">{spec.description}</Form.Text>
                      )}
                    </Form.Group>
                  </Col>
                );
              })}
            </Row>

            <h6 className="mt-4">Preview</h6>
            <div
              className="border rounded p-3 bg-light"
              style={{ whiteSpace: 'pre-wrap', fontFamily: 'serif', fontSize: '0.95rem' }}
            >
              {preview || <em className="text-muted">Template language will appear here.</em>}
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={saving || loading || templateMissing || hasPiiHit}
        >
          {saving ? 'Generating…' : 'Attach to Notice'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GenerateRiderModal;

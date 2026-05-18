import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../../utils/api';

/**
 * Phase 7 / US-SRB-01 — Subpoena Language Builder
 *
 * Lets a User Admin (role 1) or Super Admin (role 6) configure the per-company,
 * per-fraud-type subpoena language template. The free-text BASE_LANGUAGE is
 * scanned for PII server-side; any hit blocks the save and shows the exact
 * spec wording. Tokens are listed in repeating rows: each token has a name,
 * a description, and an "auto-populate from incident" toggle the Processor
 * UI honors at rider-generation time.
 */

type FraudType = 'SECURITIES_MANIPULATION' | 'ATO' | 'CHECK_FRAUD' | 'WIRE_FRAUD';

const FRAUD_TYPES: { value: FraudType; label: string }[] = [
  { value: 'SECURITIES_MANIPULATION', label: 'Securities Manipulation' },
  { value: 'ATO', label: 'Account Takeover (ATO)' },
  { value: 'CHECK_FRAUD', label: 'Check Fraud' },
  { value: 'WIRE_FRAUD', label: 'Wire Fraud' },
];

interface TokenRow {
  token: string;
  description: string;
  autoPopulateFromIncident: boolean;
}

interface TemplatePayload {
  LANGUAGE_TEMPLATE_ID?: number;
  FRAUD_TYPE?: FraudType;
  BASE_LANGUAGE?: string;
  TOKENS_JSON?: string;
}

const emptyToken = (): TokenRow => ({
  token: '',
  description: '',
  autoPopulateFromIncident: false,
});

const SubpoenaLanguageBuilder: React.FC = () => {
  const [fraudType, setFraudType] = useState<FraudType>('SECURITIES_MANIPULATION');
  const [baseLanguage, setBaseLanguage] = useState('');
  const [tokens, setTokens] = useState<TokenRow[]>([emptyToken()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [piiBlock, setPiiBlock] = useState<string | null>(null);

  // Fetch existing template (if any) whenever fraud type changes.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setPiiBlock(null);
      try {
        const res = await api.get<{ template: TemplatePayload }>(
          `/api/templates/subpoena/${fraudType}`,
        );
        if (cancelled) return;
        const t = res.data?.template;
        if (t) {
          setBaseLanguage(t.BASE_LANGUAGE ?? '');
          try {
            const parsed = JSON.parse(t.TOKENS_JSON ?? '[]');
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTokens(
                parsed.map((p: Partial<TokenRow>) => ({
                  token: String(p.token ?? ''),
                  description: String(p.description ?? ''),
                  autoPopulateFromIncident: Boolean(p.autoPopulateFromIncident),
                })),
              );
            } else {
              setTokens([emptyToken()]);
            }
          } catch {
            setTokens([emptyToken()]);
          }
        } else {
          setBaseLanguage('');
          setTokens([emptyToken()]);
        }
      } catch (err: unknown) {
        // 404 = no template yet; reset to empty state silently.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          if (!cancelled) {
            setBaseLanguage('');
            setTokens([emptyToken()]);
          }
        } else {
          console.error('[SubpoenaLanguageBuilder] load failed', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [fraudType]);

  const updateToken = (idx: number, patch: Partial<TokenRow>) => {
    setTokens((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const addTokenRow = () => setTokens((prev) => [...prev, emptyToken()]);
  const removeTokenRow = (idx: number) =>
    setTokens((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const handleSave = async () => {
    setPiiBlock(null);
    if (!baseLanguage.trim()) {
      toast.error('Base language is required');
      return;
    }
    const cleanTokens = tokens
      .map((t) => ({
        token: t.token.trim(),
        description: t.description.trim(),
        autoPopulateFromIncident: t.autoPopulateFromIncident,
      }))
      .filter((t) => t.token.length > 0);

    setSaving(true);
    try {
      await api.post('/api/templates/subpoena', {
        FRAUD_TYPE: fraudType,
        BASE_LANGUAGE: baseLanguage,
        TOKENS: cleanTokens,
      });
      toast.success('Subpoena language template saved.');
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; label?: string } } };
      const status = e?.response?.status;
      const message = e?.response?.data?.error ?? 'Failed to save subpoena language template.';
      if (status === 400 && message.toLowerCase().includes('pii')) {
        // Show the exact PII-block banner inline.
        setPiiBlock(message);
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Body>
        <Card.Title>Subpoena Language Template</Card.Title>
        <Card.Subtitle className="text-muted mb-3">
          Configure the base subpoena rider language for each fraud type. Insert
          <code className="mx-1">[TOKEN]</code>
          placeholders where Processors will fill in incident-specific values. PII (names, SSNs,
          DOBs, account numbers) is not permitted in templates.
        </Card.Subtitle>

        <Form.Group className="mb-3">
          <Form.Label>Fraud Type</Form.Label>
          <Form.Select
            value={fraudType}
            onChange={(e) => setFraudType(e.target.value as FraudType)}
            disabled={loading || saving}
          >
            {FRAUD_TYPES.map((ft) => (
              <option key={ft.value} value={ft.value}>
                {ft.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        {piiBlock && (
          <Alert variant="danger" onClose={() => setPiiBlock(null)} dismissible>
            {piiBlock}
          </Alert>
        )}

        <Form.Group className="mb-3">
          <Form.Label>Base Language</Form.Label>
          <Form.Control
            as="textarea"
            rows={8}
            placeholder="e.g. On [DATE_TIME_RANGE], unusual trading activity in [SECURITY_SYMBOL] ..."
            value={baseLanguage}
            onChange={(e) => setBaseLanguage(e.target.value)}
            disabled={loading || saving}
          />
          <Form.Text className="text-muted">
            Tip: surround dynamic values with square brackets, e.g.
            <code className="mx-1">[ACCOUNT_RANGE]</code>.
          </Form.Text>
        </Form.Group>

        <Form.Label>Tokens</Form.Label>
        {loading ? (
          <div className="py-3 d-flex justify-content-center">
            <Spinner animation="border" size="sm" />
          </div>
        ) : (
          <Table size="sm" bordered responsive>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Token</th>
                <th>Description</th>
                <th style={{ width: '18%' }}>Auto-populate from Incident</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t, idx) => (
                <tr key={idx}>
                  <td>
                    <Form.Control
                      type="text"
                      placeholder="e.g. DATE_TIME_RANGE"
                      value={t.token}
                      onChange={(e) => updateToken(idx, { token: e.target.value })}
                      disabled={saving}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="text"
                      placeholder="What does this token represent?"
                      value={t.description}
                      onChange={(e) => updateToken(idx, { description: e.target.value })}
                      disabled={saving}
                    />
                  </td>
                  <td className="text-center align-middle">
                    <Form.Check
                      type="switch"
                      checked={t.autoPopulateFromIncident}
                      onChange={(e) =>
                        updateToken(idx, { autoPopulateFromIncident: e.target.checked })
                      }
                      disabled={saving}
                    />
                  </td>
                  <td className="text-center align-middle">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-danger"
                      onClick={() => removeTokenRow(idx)}
                      disabled={tokens.length === 1 || saving}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <div className="d-flex gap-2 mb-3">
          <Button variant="outline-secondary" size="sm" onClick={addTokenRow} disabled={saving}>
            + Add Token
          </Button>
        </div>

        <div className="d-flex justify-content-end gap-2">
          <Button variant="primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save Template'}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default SubpoenaLanguageBuilder;

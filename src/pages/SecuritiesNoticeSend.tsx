import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Container, Alert, Spinner, Form, Card } from 'react-bootstrap';
import SendNoticeForm from '../components/SecuritiesNoticeTemplate/SendNoticeForm';
import { useAuth } from '../hooks/useAuth';
import { can } from '../utils/permissions';
import api from '../utils/api';

/**
 * Phase 5 / US-SNT-03 — Send Securities Fraud Notice page.
 * Permission gate: securitiesNotice.send (processor or manager).
 * Expects ?templateId=N in the query string; if missing, renders a
 * minimal picker showing the company's SECURITIES_FRAUD templates.
 */

interface TemplateRow {
  FORM_ID: number;
  FORM_NAME: string;
  NOTICE_SUBTYPE?: string | null;
  REQUIRES_MANAGER_APPROVAL?: boolean | null;
}

const SecuritiesNoticeSend: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const templateId = Number(searchParams.get('templateId')) || null;

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (templateId) return;
    setLoadingList(true);
    api
      .get('/api/forms')
      .then((r) => {
        const all = Array.isArray(r.data) ? r.data : r.data?.forms ?? [];
        setTemplates(
          (all as TemplateRow[]).filter((t) => t.NOTICE_SUBTYPE === 'SECURITIES_FRAUD'),
        );
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoadingList(false));
  }, [templateId]);

  if (authLoading) return null;
  if (!can(user, 'securitiesNotice.send')) return <Navigate to="/home" replace />;

  if (templateId) {
    return (
      <Container className="py-4">
        <h1 className="mb-4">Send Securities Fraud Notice</h1>
        <SendNoticeForm templateId={templateId} />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h1 className="mb-4">Send Securities Fraud Notice</h1>
      <Card>
        <Card.Header>Choose a template</Card.Header>
        <Card.Body>
          {loadingList ? (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" /> Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <Alert variant="info">
              No Securities Fraud Notice templates have been created yet for your
              company.
            </Alert>
          ) : (
            <Form.Select
              onChange={(e) => {
                const v = e.target.value;
                if (v) setSearchParams({ templateId: v });
              }}
              defaultValue=""
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.FORM_ID} value={t.FORM_ID}>
                  {t.FORM_NAME}
                  {t.REQUIRES_MANAGER_APPROVAL ? ' (requires approval)' : ''}
                </option>
              ))}
            </Form.Select>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default SecuritiesNoticeSend;

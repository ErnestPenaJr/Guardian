import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Container, Table, Card, Alert, Spinner, Badge, Button } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { can } from '../utils/permissions';
import api from '../utils/api';
import ApprovalReviewPanel from '../components/SecuritiesNoticeTemplate/ApprovalReviewPanel';

/**
 * Phase 5 / US-SNT-05 — Manager approval queue.
 * Lists PENDING_APPROVAL notices and lets the manager review/approve/reject.
 */

interface NoticeRow {
  NOTICE_ID: number;
  NOTICE_TITLE: string;
  NOTICE_STATUS: string;
  SUBMITTED_AT?: string | null;
  SUBMITTED_BY?: number | null;
  CREATE_USER_ID?: number | null;
  TEMPLATE_FORM_ID?: number | null;
  NOTICE_BODY?: string | null;
  DISCLAIMER_STATE?: boolean | null;
  FIRST_TIME_RECIPIENT_FLAG?: boolean | null;
}

const SecuritiesNoticeApprovalQueue: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get('id')) || null;

  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<NoticeRow | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    api
      .get('/api/securities-notices')
      .then((r) => {
        const all: NoticeRow[] = Array.isArray(r.data?.notices)
          ? r.data.notices
          : Array.isArray(r.data)
          ? r.data
          : [];
        setNotices(all.filter((n) => n.NOTICE_STATUS === 'PENDING_APPROVAL'));
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { error?: string } } };
        setError(err?.response?.data?.error ?? 'Failed to load approval queue.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      setActive(null);
      return;
    }
    api
      .get(`/api/securities-notices/${selectedId}`)
      .then((r) => setActive(r.data?.notice ?? null))
      .catch(() => setActive(null));
  }, [selectedId, notices]);

  if (authLoading) return null;
  if (!can(user, 'securitiesNotice.approve')) return <Navigate to="/home" replace />;

  return (
    <Container className="py-4">
      <h1 className="mb-4">Securities Notice Approval Queue</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="mb-4">
        <Card.Header>Pending Approval</Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" /> Loading…
            </div>
          ) : notices.length === 0 ? (
            <Alert variant="info" className="mb-0">
              No notices are currently pending approval.
            </Alert>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.NOTICE_ID}>
                    <td>{n.NOTICE_TITLE}</td>
                    <td>{n.SUBMITTED_AT ? new Date(n.SUBMITTED_AT).toLocaleString() : '—'}</td>
                    <td>
                      <Badge bg="warning" text="dark">
                        {n.NOTICE_STATUS}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => setSearchParams({ id: String(n.NOTICE_ID) })}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {active && (
        <ApprovalReviewPanel
          notice={active}
          onResolved={() => {
            setSearchParams({});
            refresh();
          }}
        />
      )}
    </Container>
  );
};

export default SecuritiesNoticeApprovalQueue;

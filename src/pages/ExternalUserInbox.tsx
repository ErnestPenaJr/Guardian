import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Spinner, Alert, Badge, Button } from 'react-bootstrap';
import DOMPurify from 'dompurify';
import moment from 'moment';
import api from '../utils/api';
import AttachExecutedSubpoenaPanel from '../components/SubpoenaRider/AttachExecutedSubpoenaPanel';

/**
 * Phase 7 / US-SRB-03 — External user inbox + notice detail.
 *
 * Two responsibilities:
 *   - /external/inbox             : list assigned notices (placeholder list:
 *                                   external user clicks through to detail
 *                                   from links the requestor sends).
 *   - /external/notices/:id       : assignment-scoped read-only notice view
 *                                   with Attach Subpoena + Request Call panel.
 *
 * Both views call /api/external/* which is gated by requireExternalUser
 * (role 5). Non-role-5 callers get 403.
 */

interface NoticeView {
  NOTICE_ID: number;
  NOTICE_TITLE: string;
  NOTICE_BODY: string | null;
  NOTICE_STATUS: string;
  SENT_AT: string | null;
  DISCLAIMER_STATE: boolean | null;
}

const STATUS_LABELS: Record<string, string> = {
  SENT_AWAITING_RESPONSE: 'Awaiting Response',
  SUBPOENA_RECEIVED_PENDING_REVIEW: 'Subpoena Received — Pending Review',
  RECORDS_RELEASED: 'Records Released',
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Returned for Revision',
};

const ExternalUserInbox: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const noticeId = id ? Number(id) : undefined;
  const [notice, setNotice] = useState<NoticeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotice = useCallback(async () => {
    if (!noticeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ notice: NoticeView | null }>(
        `/api/external/notices/${noticeId}`,
      );
      setNotice(res.data?.notice ?? null);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      if (e?.response?.status === 403) {
        setError('You do not have permission to view this notice.');
      } else if (e?.response?.status === 401) {
        setError('Please sign in to view this notice.');
      } else {
        setError(e?.response?.data?.error ?? 'Failed to load notice.');
      }
    } finally {
      setLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    void loadNotice();
  }, [loadNotice]);

  // ─── Inbox list view ────────────────────────────────────────────
  if (!noticeId) {
    return (
      <Container className="py-4">
        <Row>
          <Col>
            <h4 className="mb-3">External Notice Inbox</h4>
            <p className="text-muted small">
              You will see notices here that have been assigned to you by a Processor. Click a
              notice to view details, attach an executed subpoena, or request a call.
            </p>
            <Card>
              <Card.Body className="text-muted text-center py-5">
                <em>
                  Open a notice directly via the link sent by the requesting party. A full inbox
                  listing is a follow-up enhancement.
                </em>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  // ─── Notice detail view ────────────────────────────────────────
  return (
    <Container className="py-4">
      <Row className="gx-4">
        <Col xs={12} lg={8}>
          <Button
            variant="link"
            size="sm"
            className="ps-0 mb-2"
            onClick={() => navigate('/external/inbox')}
          >
            ← Back to inbox
          </Button>
          {loading && (
            <div className="py-5 d-flex justify-content-center">
              <Spinner animation="border" />
            </div>
          )}
          {error && !loading && <Alert variant="danger">{error}</Alert>}
          {notice && !loading && (
            <Card>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <Card.Title>{notice.NOTICE_TITLE}</Card.Title>
                  <Badge bg="secondary">
                    {STATUS_LABELS[notice.NOTICE_STATUS] ?? notice.NOTICE_STATUS}
                  </Badge>
                </div>
                <div className="text-muted small mb-3">
                  Sent{' '}
                  {notice.SENT_AT ? moment(notice.SENT_AT).format('YYYY-MM-DD HH:mm') : '—'}
                </div>
                {notice.DISCLAIMER_STATE && (
                  <Alert variant="warning" className="py-2 small">
                    Compliance disclaimer is active on this notice. Read carefully before
                    responding.
                  </Alert>
                )}
                {notice.NOTICE_BODY && (
                  <div
                    className="border rounded p-3 bg-light"
                    style={{ whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(notice.NOTICE_BODY),
                    }}
                  />
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
        <Col xs={12} lg={4} className="mt-3 mt-lg-0">
          {notice && !error && (
            <AttachExecutedSubpoenaPanel
              noticeId={notice.NOTICE_ID}
              onAttached={() => void loadNotice()}
            />
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default ExternalUserInbox;

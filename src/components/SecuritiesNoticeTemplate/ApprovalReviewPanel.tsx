import React, { useState } from 'react';
import { Card, Button, Modal, Form, Alert, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../../utils/api';

/**
 * Phase 5 / US-SNT-05 — ApprovalReviewPanel
 *
 * Renders a securities notice as read-only and exposes Approve / Reject
 * controls for managers. Reject opens a modal requiring a non-empty reason.
 */

interface NoticeShape {
  NOTICE_ID: number;
  NOTICE_TITLE: string;
  NOTICE_BODY?: string | null;
  NOTICE_STATUS: string;
  DISCLAIMER_STATE?: boolean | null;
  FIRST_TIME_RECIPIENT_FLAG?: boolean | null;
  SUBMITTED_BY?: number | null;
  SUBMITTED_AT?: string | null;
  TEMPLATE_FORM_ID?: number | null;
}

interface Props {
  notice: NoticeShape;
  onResolved?: () => void;
}

const ApprovalReviewPanel: React.FC<Props> = ({ notice, onResolved }) => {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let fields: Record<string, unknown> = {};
  try {
    fields = notice.NOTICE_BODY ? JSON.parse(notice.NOTICE_BODY) : {};
  } catch {
    fields = {};
  }

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/securities-notices/${notice.NOTICE_ID}/approve`);
      toast.success('Notice approved and sent.');
      if (onResolved) onResolved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error ?? 'Approve failed.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/securities-notices/${notice.NOTICE_ID}/reject`, {
        reason: reason.trim(),
      });
      toast.success('Notice returned for revision.');
      setShowRejectModal(false);
      if (onResolved) onResolved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error ?? 'Reject failed.');
    } finally {
      setBusy(false);
    }
  };

  const canAct = notice.NOTICE_STATUS === 'PENDING_APPROVAL';

  return (
    <>
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            <strong>{notice.NOTICE_TITLE}</strong>
            <span className="ms-2">
              <Badge bg={canAct ? 'warning' : 'secondary'} text={canAct ? 'dark' : undefined}>
                {notice.NOTICE_STATUS}
              </Badge>
            </span>
          </div>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <dl className="row mb-0">
            {Object.entries(fields).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="col-sm-4 text-muted">{k}</dt>
                <dd className="col-sm-8">
                  <Form.Control plaintext readOnly value={String(v ?? '')} />
                </dd>
              </React.Fragment>
            ))}
            {Object.keys(fields).length === 0 && (
              <dd className="col-sm-12 text-muted">No structured fields available.</dd>
            )}
          </dl>
          {notice.DISCLAIMER_STATE === false && (
            <Alert variant="warning" className="mt-3 mb-0">
              Compliance disclaimer is disabled on this notice.
            </Alert>
          )}
          {notice.FIRST_TIME_RECIPIENT_FLAG && (
            <Alert variant="info" className="mt-3 mb-0">
              Recipient is flagged as first-time.
            </Alert>
          )}
        </Card.Body>
        <Card.Footer className="d-flex justify-content-end gap-2">
          <Button
            variant="outline-danger"
            onClick={() => setShowRejectModal(true)}
            disabled={!canAct || busy}
          >
            Reject and Return
          </Button>
          <Button variant="success" onClick={approve} disabled={!canAct || busy}>
            {busy ? 'Working…' : 'Approve and Send'}
          </Button>
        </Card.Footer>
      </Card>

      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reject and Return for Revision</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="reject-reason">
            <Form.Label>Reason *</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={2000}
              placeholder="Explain what the processor needs to revise before resubmitting."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={reject} disabled={busy || !reason.trim()}>
            {busy ? 'Working…' : 'Return for Revision'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ApprovalReviewPanel;

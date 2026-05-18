import React from 'react';
import { Modal, Button } from 'react-bootstrap';

/**
 * Phase 5 / US-SNT-03 — First-time recipient confirmation modal.
 *
 * Intercepts the send flow when the recipient has never received a notice
 * from this company. Confirming proceeds with confirmFirstTime=true so the
 * server can write a FIRST_TIME_RECIPIENT_CONFIRMED audit row alongside the
 * NOTICE_SENT row.
 */

interface Props {
  show: boolean;
  recipientName?: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

const FirstTimeRecipientModal: React.FC<Props> = ({
  show,
  recipientName,
  onCancel,
  onConfirm,
  loading,
}) => (
  <Modal show={show} onHide={onCancel} backdrop="static" centered>
    <Modal.Header closeButton>
      <Modal.Title>First-time recipient</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <p>
        {recipientName ? <strong>{recipientName}</strong> : 'This recipient'} has not
        previously received a Securities Fraud Notice from your company.
      </p>
      <p className="mb-0">
        Sending will be logged in the audit trail as a first-time delivery. Confirm
        you have verified the recipient&apos;s identity before continuing.
      </p>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onCancel} disabled={loading}>
        Cancel
      </Button>
      <Button variant="primary" onClick={onConfirm} disabled={loading}>
        {loading ? 'Sending…' : 'Confirm and Send'}
      </Button>
    </Modal.Footer>
  </Modal>
);

export default FirstTimeRecipientModal;

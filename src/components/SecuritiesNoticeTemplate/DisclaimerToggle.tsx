import React from 'react';
import { Form, Modal, Button } from 'react-bootstrap';

/**
 * Phase 4 / US-CCL-02 — DisclaimerToggle
 *
 * Single switch controlling COMPLIANCE_DISCLAIMER_ENABLED on a template.
 * When the template is SECURITIES_FRAUD and the user toggles ON → OFF, a
 * confirmation modal intercepts the change to warn that turning off the
 * disclaimer removes a legal protection layer and the action will be audited.
 *
 * Pure presentational — wiring into TemplateBuilder happens in Phase 5.
 */

export type NoticeSubtype = 'SECURITIES_FRAUD' | 'SUBPOENA_RIDER' | undefined;

export interface DisclaimerToggleProps {
  enabled: boolean;
  noticeSubtype: NoticeSubtype;
  onChange: (next: boolean) => void;
  /** Optional label override (defaults to "Compliance Disclaimer"). */
  label?: string;
}

const DisclaimerToggle: React.FC<DisclaimerToggleProps> = ({
  enabled,
  noticeSubtype,
  onChange,
  label = 'Compliance Disclaimer',
}) => {
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    // Intercept ON → OFF for SECURITIES_FRAUD templates only
    if (!next && enabled && noticeSubtype === 'SECURITIES_FRAUD') {
      setShowConfirm(true);
      return;
    }
    onChange(next);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    onChange(false);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    // No state change — toggle remains ON
  };

  return (
    <>
      <Form.Check
        type="switch"
        id="compliance-disclaimer-toggle"
        label={label}
        checked={enabled}
        onChange={handleChange}
      />

      <Modal show={showConfirm} onHide={handleCancel} backdrop="static" centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Disclaimer Removal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Turning off the Compliance Disclaimer removes a legal protection layer.
          This action will be recorded in the audit log.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DisclaimerToggle;

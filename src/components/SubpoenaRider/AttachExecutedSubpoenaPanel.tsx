import React, { useRef, useState } from 'react';
import { Card, Button, Form, Alert, Spinner, ListGroup, InputGroup } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from '../../utils/api';

/**
 * Phase 7 / US-SRB-03 — Attach Executed Subpoena Panel
 *
 * Extracted from ExternalUserInbox so the page stays slim. Provides the
 * two role-5 actions on an assigned notice:
 *   - Attach Executed Subpoena (multer file upload → 201 transitions notice
 *     status to SUBPOENA_RECEIVED_PENDING_REVIEW server-side)
 *   - Request a Call (datetime multi-input → /call-request endpoint)
 */

interface Props {
  noticeId: number;
  /** Called after a successful attach to refresh the parent view. */
  onAttached?: () => void;
}

const AttachExecutedSubpoenaPanel: React.FC<Props> = ({ noticeId, onAttached }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [proposedTime, setProposedTime] = useState('');
  const [proposedTimes, setProposedTimes] = useState<string[]>([]);
  const [callSaving, setCallSaving] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadError('Please select a file first.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/api/external/notices/${noticeId}/subpoena`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Executed subpoena attached.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onAttached?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setUploadError(e?.response?.data?.error ?? 'Failed to attach subpoena.');
    } finally {
      setUploading(false);
    }
  };

  const addProposedTime = () => {
    if (!proposedTime.trim()) return;
    setProposedTimes((prev) => [...prev, proposedTime]);
    setProposedTime('');
  };

  const removeProposedTime = (idx: number) => {
    setProposedTimes((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitCallRequest = async () => {
    if (proposedTimes.length === 0) {
      setCallError('Add at least one proposed time.');
      return;
    }
    setCallSaving(true);
    setCallError(null);
    try {
      await api.post(`/api/external/notices/${noticeId}/call-request`, {
        proposedTimes,
      });
      toast.success('Call request submitted.');
      setProposedTimes([]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setCallError(e?.response?.data?.error ?? 'Failed to submit call request.');
    } finally {
      setCallSaving(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <Card>
        <Card.Body>
          <Card.Title className="h6">Attach Executed Subpoena</Card.Title>
          <p className="text-muted small mb-2">
            Upload the executed subpoena (PDF, TIFF, or DOCX). Once attached, the notice moves to
            “Subpoena received — pending review.”
          </p>
          <Form.Group className="mb-2">
            <Form.Control
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              accept=".pdf,.tiff,.tif,.docx"
            />
          </Form.Group>
          {uploadError && (
            <Alert variant="danger" onClose={() => setUploadError(null)} dismissible>
              {uploadError}
            </Alert>
          )}
          <div className="d-flex justify-content-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpload}
              disabled={uploading || !file}
            >
              {uploading ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" /> Uploading…
                </>
              ) : (
                'Attach Subpoena'
              )}
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title className="h6">Request a Call</Card.Title>
          <p className="text-muted small mb-2">
            Propose one or more times for a follow-up call with the requestor.
          </p>
          <InputGroup className="mb-2">
            <Form.Control
              type="datetime-local"
              value={proposedTime}
              onChange={(e) => setProposedTime(e.target.value)}
              disabled={callSaving}
            />
            <Button
              variant="outline-secondary"
              onClick={addProposedTime}
              disabled={callSaving || !proposedTime.trim()}
            >
              Add
            </Button>
          </InputGroup>
          {proposedTimes.length > 0 && (
            <ListGroup className="mb-2">
              {proposedTimes.map((t, idx) => (
                <ListGroup.Item
                  key={idx}
                  className="d-flex justify-content-between align-items-center py-1"
                >
                  <span>{t}</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-danger"
                    onClick={() => removeProposedTime(idx)}
                    disabled={callSaving}
                  >
                    Remove
                  </Button>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
          {callError && (
            <Alert variant="danger" onClose={() => setCallError(null)} dismissible>
              {callError}
            </Alert>
          )}
          <div className="d-flex justify-content-end">
            <Button
              variant="primary"
              size="sm"
              onClick={submitCallRequest}
              disabled={callSaving || proposedTimes.length === 0}
            >
              {callSaving ? 'Submitting…' : 'Submit Call Request'}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default AttachExecutedSubpoenaPanel;

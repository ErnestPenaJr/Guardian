import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import type { SubpoenaRider } from '../../services/subpoenaRiderService';

interface Props {
  show: boolean;
  onHide: () => void;
  rider: SubpoenaRider | null;
  noticeId?: number;
}

const RiderViewerModal: React.FC<Props> = ({ show, onHide, rider, noticeId }) => {
  const text = rider?.POPULATED_LANGUAGE ?? '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Rider text copied to clipboard.');
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Subpoena-Rider-Notice-${noticeId ?? rider?.RIDER_ID ?? 'unknown'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      toast.error('Popup blocked. Allow popups to print the rider.');
      return;
    }
    w.document.write(`<!doctype html><html><head><title>Subpoena Rider</title>
      <style>body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12pt;white-space:pre-wrap;padding:24px}</style>
      </head><body>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Subpoena Rider</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {rider ? (
          <pre
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '12.5px',
              background: '#F8F9FA',
              border: '1px solid #E0E0E0',
              borderRadius: 4,
              padding: 16,
              maxHeight: 'calc(100vh - 320px)',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {text}
          </pre>
        ) : (
          <em className="text-muted">No rider to display.</em>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>Close</Button>
        <Button variant="outline-primary" onClick={copy} disabled={!rider}>Copy</Button>
        <Button variant="outline-primary" onClick={download} disabled={!rider}>Download .txt</Button>
        <Button variant="primary" onClick={print} disabled={!rider}>Print</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RiderViewerModal;

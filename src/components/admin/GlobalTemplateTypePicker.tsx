// src/components/admin/GlobalTemplateTypePicker.tsx
import React from 'react';
import Modal from 'react-modal';

interface Props {
  isOpen: boolean;
  onCancel: () => void;
  onPick: (templateType: 'request' | 'notice') => void;
}

const GlobalTemplateTypePicker: React.FC<Props> = ({ isOpen, onCancel, onPick }) => (
  <Modal
    isOpen={isOpen}
    onRequestClose={onCancel}
    contentLabel="Pick global template type"
    style={{ content: { maxWidth: 420, margin: 'auto', height: 'fit-content' } }}
    ariaHideApp={false}
  >
    <h5 className="mb-3">New Global Template</h5>
    <p className="text-muted">What kind of template are you creating?</p>
    <div className="d-grid gap-2">
      <button type="button" className="btn btn-outline-primary" onClick={() => onPick('request')}>
        Request Workflow Template
      </button>
      <button type="button" className="btn btn-outline-primary" onClick={() => onPick('notice')}>
        Notice Template
      </button>
      <button type="button" className="btn btn-link" onClick={onCancel}>
        Cancel
      </button>
    </div>
  </Modal>
);

export default GlobalTemplateTypePicker;

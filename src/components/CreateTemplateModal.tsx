import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Globe, FileText, X } from 'lucide-react';
import '../styles/CreateTemplateModal.css';

export interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TemplateType = 'Notice' | 'Request' | 'Self-Service' | 'Survey' | 'Other';

const TYPE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: 'Notice', label: 'Notice — Notification forms' },
  { value: 'Request', label: 'Request — Intake forms' },
  { value: 'Self-Service', label: 'Self-Service — Self-serve forms' },
  { value: 'Survey', label: 'Survey — Feedback forms' },
  { value: 'Other', label: 'Other' },
];

const MAX_DESCRIPTION = 500;

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [type, setType] = useState<TemplateType>('Notice');
  const [description, setDescription] = useState('');
  const [internal, setInternal] = useState(false);
  const [external, setExternal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setType('Notice');
      setDescription('');
      setInternal(false);
      setExternal(false);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const nameTrimmed = name.trim();
  const canSubmit = nameTrimmed.length > 0;

  const audienceHelper =
    internal && external
      ? 'This template will be available to both internal and external users.'
      : 'Select who should have access to this template — both options can be selected.';

  const handleContinue = () => {
    if (!canSubmit) return;
    const params = new URLSearchParams({
      name: nameTrimmed,
      type,
      description,
      isInternal: String(internal),
      isExternal: String(external),
      returnTo: '/home',
      returnSection: 'admin',
    });
    navigate(`/form-builder/new?${params.toString()}`);
    onClose();
  };

  return (
    <div
      className="ctm-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-template-title"
    >
      <div className="ctm-card">
        <div className="ctm-header">
          <div className="ctm-header-icon" aria-hidden="true">
            <FileText className="ctm-header-icon-svg" />
          </div>
          <div className="ctm-header-text">
            <h2 id="create-template-title" className="ctm-title">
              Create New Template
            </h2>
            <p className="ctm-subtitle">Set up the foundation for your new form template</p>
          </div>
          <button type="button" className="ctm-close" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="ctm-body">
          <div className="ctm-field">
            <label className="ctm-label" htmlFor="ctm-name">
              Template Name <span className="ctm-required">*</span>
            </label>
            <input
              id="ctm-name"
              type="text"
              className="ctm-input"
              placeholder="Enter a descriptive template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <p className="ctm-helper">Choose a clear, descriptive name for your template</p>
          </div>

          <div className="ctm-field">
            <label className="ctm-label" htmlFor="ctm-type">
              Template Type
            </label>
            <select
              id="ctm-type"
              className="ctm-input"
              value={type}
              onChange={(e) => setType(e.target.value as TemplateType)}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="ctm-helper">Select the primary use case for this template</p>
          </div>

          <div className="ctm-field">
            <label className="ctm-label" htmlFor="ctm-description">
              Description
            </label>
            <textarea
              id="ctm-description"
              className="ctm-input ctm-textarea"
              rows={4}
              maxLength={MAX_DESCRIPTION}
              placeholder="Provide a detailed description of when and how this template should be used..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="ctm-helper-row">
              <p className="ctm-helper">Help users understand the purpose of this template</p>
              <p className="ctm-counter">
                {description.length}/{MAX_DESCRIPTION}
              </p>
            </div>
          </div>

          <div className="ctm-field">
            <label className="ctm-label">Audience</label>
            <div className="ctm-audience-grid">
              <button
                type="button"
                className={`ctm-audience-card ${internal ? 'is-active' : ''}`}
                onClick={() => setInternal((v) => !v)}
                aria-pressed={internal}
              >
                <div className="ctm-audience-icon">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="ctm-audience-label">Internal</div>
                <div className="ctm-audience-desc">Visible to team members only</div>
              </button>
              <button
                type="button"
                className={`ctm-audience-card ${external ? 'is-active' : ''}`}
                onClick={() => setExternal((v) => !v)}
                aria-pressed={external}
              >
                <div className="ctm-audience-icon">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="ctm-audience-label">External</div>
                <div className="ctm-audience-desc">Visible to outside users</div>
              </button>
            </div>
            <p className="ctm-helper">{audienceHelper}</p>
          </div>
        </div>

        <div className="ctm-footer">
          <button type="button" className="ctm-btn ctm-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ctm-btn ctm-btn-primary"
            onClick={handleContinue}
            disabled={!canSubmit}
          >
            Continue to Field Builder
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTemplateModal;

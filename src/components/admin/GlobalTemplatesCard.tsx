// src/components/admin/GlobalTemplatesCard.tsx
import React, { useEffect, useState } from 'react';
import { FaGlobe, FaCog } from 'react-icons/fa';
import formService from '../../services/formService';

interface Props {
  onOpenManager: () => void;
}

const GlobalTemplatesCard: React.FC<Props> = ({ onOpenManager }) => {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await formService.getGlobalForms();
        if (!cancelled) setCount(list.length);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load count';
        if (!cancelled) setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card admin-card mb-3" data-testid="global-templates-card">
      <div className="card-body">
        <div className="d-flex align-items-center mb-2">
          <FaGlobe size={22} className="me-2 text-primary" />
          <h5 className="card-title mb-0">Global Templates</h5>
        </div>
        <p className="text-muted small mb-2">
          JAFAR access only — visible to all companies
        </p>
        <p className="mb-3">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : count == null ? (
            <span className="text-muted">Loading…</span>
          ) : (
            <span>
              <strong>{count}</strong> active global template{count === 1 ? '' : 's'}
            </span>
          )}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenManager}
          data-testid="open-global-templates-manager"
        >
          <FaCog className="me-2" />
          Manage Global Templates
        </button>
      </div>
    </div>
  );
};

export default GlobalTemplatesCard;

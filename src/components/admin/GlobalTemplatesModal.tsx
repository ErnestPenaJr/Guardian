// src/components/admin/GlobalTemplatesModal.tsx
import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { FaEdit, FaTrash, FaPlus, FaSpinner, FaGlobe } from 'react-icons/fa';
import formService, { DbForm } from '../../services/formService';
import GlobalTemplateTypePicker from './GlobalTemplateTypePicker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateGlobal: (templateType: 'request' | 'notice') => void;
  onEditGlobal: (formId: number) => void;
}

const GlobalTemplatesModal: React.FC<Props> = ({ isOpen, onClose, onCreateGlobal, onEditGlobal }) => {
  const [globals, setGlobals] = useState<DbForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'request' | 'notice'>('all');

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await formService.getGlobalForms();
      setGlobals(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load global templates';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen]);

  const handleDelete = async (form: DbForm) => {
    const confirm = await Swal.fire({
      title: 'Delete Global Template?',
      html: `<p>Delete <strong>${form.FORM_NAME}</strong>?</p>
             <div class="alert alert-warning text-start">
               This will delete the global template for all companies.
               Existing clones in companies are not affected.
             </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc3545',
    });
    if (!confirm.isConfirmed) return;

    try {
      await formService.deleteForm(form.FORM_ID as number);
      toast.success('Global template deleted');
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      toast.error(msg);
    }
  };

  const visible = globals.filter((f) => filterType === 'all' || f.TEMPLATE_TYPE === filterType);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        contentLabel="Manage Global Templates"
        style={{
          content: {
            maxWidth: 900,
            margin: '0',
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '90vh',
            overflowY: 'auto',
            inset: '50% auto auto 50%',
            transform: 'translate(-50%, -50%)',
            border: '1px solid #ccc',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          },
          overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          },
        }}
        ariaHideApp={false}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">
            <FaGlobe className="me-2" />
            Global Templates
          </h4>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <select
            className="form-select w-auto"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'request' | 'notice')}
          >
            <option value="all">All template types</option>
            <option value="request">Request</option>
            <option value="notice">Notice</option>
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setPickerOpen(true)}
            data-testid="new-global-template"
          >
            <FaPlus className="me-2" />
            New Global Template
          </button>
        </div>

        {loading ? (
          <div className="text-center p-4">
            <FaSpinner className="fa-spin me-2" /> Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center p-4 text-muted">
            No global templates yet — create your first one.
          </div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Audience</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.FORM_ID}>
                  <td>{f.FORM_NAME}</td>
                  <td>
                    <span
                      className={`badge bg-${f.TEMPLATE_TYPE === 'notice' ? 'info' : 'secondary'}`}
                    >
                      {f.TEMPLATE_TYPE ?? '—'}
                    </span>
                  </td>
                  <td>
                    {f.IS_INTERNAL ? (
                      <span className="badge bg-light text-dark me-1">Internal</span>
                    ) : null}
                    {f.IS_EXTERNAL ? (
                      <span className="badge bg-light text-dark">External</span>
                    ) : null}
                    {!f.IS_INTERNAL && !f.IS_EXTERNAL ? (
                      <span className="text-muted">—</span>
                    ) : null}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => {
                        onClose();
                        onEditGlobal(f.FORM_ID as number);
                      }}
                      title="Edit"
                    >
                      <FaEdit />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(f)}
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      <GlobalTemplateTypePicker
        isOpen={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onPick={(t) => {
          setPickerOpen(false);
          onClose();
          onCreateGlobal(t);
        }}
      />
    </>
  );
};

export default GlobalTemplatesModal;

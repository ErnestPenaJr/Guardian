// src/components/admin/GlobalTemplatesModal.tsx
import React, { useEffect, useState } from 'react';
import { FaGlobe, FaSpinner } from 'react-icons/fa';
import {
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  FileText,
  Clock,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../Modal';
import { GuardianSweetAlert } from '../../utils/sweetAlert';
import formService, { DbForm } from '../../services/formService';
import GlobalTemplateTypePicker from './GlobalTemplateTypePicker';

// The API returns CREATE_DATE which is not in the base DbForm interface.
// Extend locally so we can display it without touching formService.ts.
type GlobalForm = DbForm & { CREATE_DATE?: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateGlobal: (templateType: 'request' | 'notice') => void;
  onEditGlobal: (formId: number) => void;
}

const GlobalTemplatesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreateGlobal,
  onEditGlobal,
}) => {
  const [globals, setGlobals] = useState<GlobalForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'request' | 'notice'>('all');

  // ── Data fetching ───────────────────────────────────────────────────────────
  const refresh = async () => {
    setLoading(true);
    try {
      const list = await formService.getGlobalForms();
      setGlobals(list as GlobalForm[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load global templates';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTypeFilter('all');
      refresh();
    }
  }, [isOpen]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const visible = globals.filter((f) => {
    const matchesType = typeFilter === 'all' || f.TEMPLATE_TYPE === typeFilter;
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !search ||
      f.FORM_NAME.toLowerCase().includes(search) ||
      (f.FORM_DESCRIPTION ?? '').toLowerCase().includes(search);
    return matchesType && matchesSearch;
  });

  const requestCount = globals.filter((f) => f.TEMPLATE_TYPE === 'request').length;
  const noticeCount = globals.filter((f) => f.TEMPLATE_TYPE === 'notice').length;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDelete = async (form: GlobalForm) => {
    const confirmed = await GuardianSweetAlert.showConfirmation(
      'Delete Global Template?',
      `Delete "${form.FORM_NAME}"? This template will be removed for all companies. Existing company clones are not affected.`,
      { confirmText: 'Delete', cancelText: 'Cancel', severity: 'medium', dangerousAction: true },
    );
    if (!confirmed) return;

    try {
      await formService.deleteForm(form.FORM_ID as number);
      toast.success('Global template deleted');
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      toast.error(msg);
    }
  };

  const handleClose = () => {
    setPickerOpen(false);
    setSearchTerm('');
    setTypeFilter('all');
    onClose();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Global Workflow Templates"
        size="xl"
      >
        <div className="min-h-[70vh] bg-gray-50">
          <div className="h-full">
            {/* ── Header ── */}
            <div className="bg-white border-b border-gray-200 px-6 py-6">
              <div className="flex flex-col space-y-4">
                {/* Title + Create button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-cyan-100 rounded-lg">
                      <FaGlobe className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        Global Workflow Templates
                      </h2>
                      <p className="text-sm text-gray-500">
                        Create and manage platform-wide templates visible to all companies
                      </p>
                    </div>
                  </div>

                  <button
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                    onClick={() => setPickerOpen(true)}
                    data-testid="new-global-template"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Global Template
                  </button>
                </div>

                {/* Search + Type filter */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 max-w-md">
                    <div className="relative">
                      <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search templates by name or description..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={typeFilter}
                      onChange={(e) =>
                        setTypeFilter(e.target.value as 'all' | 'request' | 'notice')
                      }
                    >
                      <option value="all">All Template Types</option>
                      <option value="request">Request Only</option>
                      <option value="notice">Notice Only</option>
                    </select>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-cyan-500 rounded-full" />
                    <span className="text-gray-600">Total: {globals.length}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                    <span className="text-gray-600">Request: {requestCount}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-sky-500 rounded-full" />
                    <span className="text-gray-600">Notice: {noticeCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 px-6 pb-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <FaSpinner className="w-8 h-8 text-cyan-600 animate-spin" />
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-900">
                      Loading global templates...
                    </p>
                    <p className="text-sm text-gray-500">
                      Fetching platform-wide workflow templates…
                    </p>
                  </div>
                </div>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-6">
                  <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {searchTerm || typeFilter !== 'all'
                        ? 'No Templates Match Your Criteria'
                        : 'No Global Templates Yet'}
                    </h3>
                    <p className="text-sm text-gray-500 max-w-md">
                      {searchTerm || typeFilter !== 'all'
                        ? 'Try adjusting your search terms or filters to find templates.'
                        : 'Create your first global template to make it available to all companies.'}
                    </p>
                  </div>
                  {!searchTerm && typeFilter === 'all' && (
                    <button
                      className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                      onClick={() => setPickerOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Global Template
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                  {visible.map((f) => (
                    <div
                      key={f.FORM_ID}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200"
                    >
                      {/* Card header */}
                      <div className="p-6 pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-cyan-100 rounded-lg flex-shrink-0">
                              <FaGlobe className="w-5 h-5 text-cyan-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3
                                className="text-base font-medium text-gray-900 truncate"
                                title={f.FORM_NAME}
                              >
                                {f.FORM_NAME}
                              </h3>
                              <div className="flex items-center flex-wrap gap-2 mt-1">
                                {f.TEMPLATE_TYPE === 'notice' && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-800">
                                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full mr-1.5" />
                                    Notice
                                  </span>
                                )}
                                {f.TEMPLATE_TYPE === 'request' && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5" />
                                    Request
                                  </span>
                                )}
                                {f.IS_INTERNAL && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                                    Internal
                                  </span>
                                )}
                                {f.IS_EXTERNAL && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                                    External
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {f.FORM_DESCRIPTION && (
                          <p
                            className="text-sm text-gray-600 mb-4 line-clamp-2"
                            title={f.FORM_DESCRIPTION}
                          >
                            {f.FORM_DESCRIPTION}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center text-xs text-gray-500 mb-2">
                          <Clock className="w-3 h-3 mr-1" />
                          <span>
                            Created{' '}
                            {f.CREATE_DATE
                              ? new Date(f.CREATE_DATE).toLocaleDateString()
                              : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Card actions */}
                      <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                            onClick={() => {
                              onClose();
                              onEditGlobal(f.FORM_ID as number);
                            }}
                            title="Edit template fields and configuration"
                          >
                            <Edit3 className="w-3 h-3 mr-1.5" />
                            Edit Fields
                          </button>

                          <button
                            className="flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                            onClick={() => handleDelete(f)}
                            title="Delete global template permanently"
                          >
                            <Trash2 className="w-3 h-3 mr-1.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="bg-white border-t border-gray-200 px-6 py-4 mt-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center w-5 h-5 bg-cyan-100 rounded-full">
                    <FaGlobe className="w-3 h-3 text-cyan-600" />
                  </div>
                  <p className="text-sm text-gray-600">
                    Global templates are visible to all companies — created and managed by
                    JAFAR users only
                  </p>
                </div>
                <button
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                  onClick={handleClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Type picker (small react-modal dialog, unchanged) */}
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

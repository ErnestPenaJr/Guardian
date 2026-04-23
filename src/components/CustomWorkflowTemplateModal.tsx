import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { toast } from 'react-toastify';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaSave,
  FaEye,
  FaCog,
  FaWrench,
  FaArrowLeft,
  FaList,
  FaToggleOn,
  FaToggleOff,
  FaClone,
  FaCalendarAlt
} from 'react-icons/fa';
import {
  FileText,
  Settings,
  Plus,
  Edit3,
  Trash2,
  Save,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Clock,
  Users,
  Search,
  Filter
} from 'lucide-react';
import { GuardianSweetAlert } from '../utils/sweetAlert';
import customTemplateService from '../services/customTemplateService';

interface CustomWorkflowTemplate {
  FORM_ID: number;
  FORM_NAME: string;
  FORM_DESCRIPTION: string;
  IS_ACTIVE: boolean;
  CREATE_DATE: string;
  fieldCount?: number;
  fields?: any[];
}

interface CustomWorkflowTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew?: () => void;
}

const CustomWorkflowTemplateModal: React.FC<CustomWorkflowTemplateModalProps> = ({
  isOpen,
  onClose,
  onCreateNew
}) => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<CustomWorkflowTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<CustomWorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CustomWorkflowTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    formType: 'notice' as 'notice' | 'request',
  });
  const [creating, setCreating] = useState(false);

  // Load custom templates
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/custom-templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Custom templates loaded:', data);
        setTemplates(data);
        setFilteredTemplates(data);
      } else {
        console.log('No custom templates found');
        setTemplates([]);
        setFilteredTemplates([]);
      }
    } catch (error) {
      console.error('Error loading custom templates:', error);
      toast.error('Failed to load custom templates');
      setTemplates([]);
      setFilteredTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter templates based on search and status
  useEffect(() => {
    let filtered = templates;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(template =>
        template.FORM_NAME.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (template.FORM_DESCRIPTION && template.FORM_DESCRIPTION.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(template =>
        statusFilter === 'active' ? template.IS_ACTIVE : !template.IS_ACTIVE
      );
    }

    setFilteredTemplates(filtered);
  }, [templates, searchTerm, statusFilter]);

  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  // Handle delete template
  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    const confirmed = await GuardianSweetAlert.showConfirmation(
      'Delete Template',
      `Are you sure you want to delete the custom template "${templateName}"? This action cannot be undone.`,
      { confirmText: 'Delete', cancelText: 'Cancel', severity: 'medium', dangerousAction: true }
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Custom template deleted successfully');
        loadTemplates(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete custom template');
      }
    } catch (error) {
      console.error('Error deleting custom template:', error);
      toast.error('Failed to delete custom template');
    }
  };

  // Handle template status toggle
  const handleToggleStatus = async (templateId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          IS_ACTIVE: !currentStatus
        })
      });

      if (response.ok) {
        toast.success(`Template ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        loadTemplates(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update template status');
      }
    } catch (error) {
      console.error('Error updating template status:', error);
      toast.error('Failed to update template status');
    }
  };

  // Handle edit template fields — navigate to full-page form builder
  const handleEditTemplate = (template: CustomWorkflowTemplate) => {
    handleModalClose();
    navigate(`/form-builder/${template.FORM_ID}?returnTo=/home&returnSection=admin`);
  };

  // Reset all states to initial
  const resetModalState = () => {
    setShowCreateForm(false);
    setEditingTemplate(null);
    setFormData({ name: '', description: '', formType: 'notice' });
    setSearchTerm('');
    setStatusFilter('all');
  };

  // Handle cancel edit/create
  const handleCancel = () => {
    setShowCreateForm(false);
    setEditingTemplate(null);
    setFormData({ name: '', description: '', formType: 'notice' });
  };

  // Handle modal close
  const handleModalClose = () => {
    resetModalState();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Custom Workflow Templates"
      size="xl"
    >
      <div className="min-h-[70vh] bg-gray-50">
        <div className="h-full">
          {/* Enhanced Header Section */}
          <div className="bg-white border-b border-gray-200 px-6 py-6">
            <div className="flex flex-col space-y-4">
              {/* Title and Create Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                    <FaList className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Custom Workflow Templates</h2>
                    <p className="text-sm text-gray-500">Create and manage reusable form templates for your organization</p>
                  </div>
                </div>
                <button
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                  onClick={() => {
                    if (onCreateNew) {
                      onClose();
                      onCreateNew();
                      return;
                    }
                    setFormData({ name: '', description: '', formType: 'notice' });
                    setShowCreateForm(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Template
                </button>
              </div>

              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  >
                    <option value="all">All Templates</option>
                    <option value="active">Active Templates</option>
                    <option value="inactive">Inactive Templates</option>
                  </select>
                </div>
              </div>

              {/* Statistics */}
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Total: {templates.length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Active: {templates.filter(t => t.IS_ACTIVE).length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-600">Inactive: {templates.filter(t => !t.IS_ACTIVE).length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Create Form */}
          {showCreateForm && (
            <div className="bg-white mx-6 mt-6 rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                      <Plus className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Create New Template</h3>
                      <p className="text-sm text-gray-500">Set up the basic information for your new template</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter a descriptive template name"
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500">Choose a clear, descriptive name for your template</p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Template Type</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={formData.formType}
                      onChange={(e) => setFormData({ ...formData, formType: e.target.value as 'notice' | 'request' })}
                    >
                      <option value="notice">Notice — Notification forms</option>
                      <option value="request">Request — Workflow forms</option>
                    </select>
                    <p className="text-xs text-gray-500">Select the primary use case for this template</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide a detailed description of when and how this template should be used..."
                    maxLength={500}
                  />
                  <div className="flex justify-between">
                    <p className="text-xs text-gray-500">Help users understand the purpose of this template</p>
                    <span className="text-xs text-gray-400">{formData.description.length}/500</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                  <button
                    className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 ${
                      formData.name.trim() && !creating
                        ? 'bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
                        : 'bg-gray-400 cursor-not-allowed'
                    }`}
                    onClick={async () => {
                      if (!formData.name.trim()) {
                        toast.error('Template name is required');
                        return;
                      }
                      try {
                        setCreating(true);
                        const created = await customTemplateService.create({
                          FORM_NAME: formData.name.trim(),
                          FORM_DESCRIPTION: formData.description.trim(),
                          TEMPLATE_TYPE: formData.formType,
                        });
                        handleModalClose();
                        navigate(`/form-builder/${created.FORM_ID}?returnTo=${formData.formType === 'notice' ? '/my-notices' : '/home'}&returnSection=admin`);
                      } catch (err: any) {
                        toast.error(err?.response?.data?.error || 'Failed to create template');
                      } finally {
                        setCreating(false);
                      }
                    }}
                    disabled={!formData.name.trim() || creating}
                  >
                    <FaWrench className="mr-2" />
                    {creating ? 'Creating…' : 'Continue to Field Builder'}
                  </button>
                  <button
                    className="flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Templates List */}
          <div className="flex-1 px-6 pb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">Loading Templates</p>
                  <p className="text-sm text-gray-500">Fetching your custom workflow templates...</p>
                </div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-6">
                <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    {searchTerm || statusFilter !== 'all' ? 'No Templates Match Your Criteria' : 'No Custom Templates Found'}
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Try adjusting your search terms or filters to find templates.'
                      : 'Create your first custom workflow template to streamline your organization\'s processes.'
                    }
                  </p>
                </div>
                {(!searchTerm && statusFilter === 'all') && (
                  <button
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                    onClick={() => {
                      setFormData({ name: '', description: '', formType: 'notice' });
                      setShowCreateForm(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Template
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                {filteredTemplates.map((template) => (
                  <div key={template.FORM_ID} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
                    {/* Card Header */}
                    <div className="p-6 pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                            template.IS_ACTIVE ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            <FileText className={`w-5 h-5 ${
                              template.IS_ACTIVE ? 'text-green-600' : 'text-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900 truncate" title={template.FORM_NAME}>
                              {template.FORM_NAME}
                            </h3>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                template.IS_ACTIVE
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {template.IS_ACTIVE ? (
                                  <><div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />Active</>
                                ) : (
                                  <><div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5" />Inactive</>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {template.FORM_DESCRIPTION && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2" title={template.FORM_DESCRIPTION}>
                          {template.FORM_DESCRIPTION}
                        </p>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Created {new Date(template.CREATE_DATE).toLocaleDateString()}</span>
                        </div>
                        {template.fieldCount && (
                          <div className="flex items-center space-x-1">
                            <FaList className="w-3 h-3" />
                            <span>{template.fieldCount} fields</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                          onClick={() => handleEditTemplate(template)}
                          title="Edit template fields and configuration"
                        >
                          <Edit3 className="w-3 h-3 mr-1.5" />
                          Edit Fields
                        </button>

                        <button
                          className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                            template.IS_ACTIVE
                              ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:ring-yellow-500'
                              : 'text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500'
                          }`}
                          onClick={() => handleToggleStatus(template.FORM_ID, template.IS_ACTIVE)}
                          title={template.IS_ACTIVE ? 'Deactivate template' : 'Activate template'}
                        >
                          {template.IS_ACTIVE ? (
                            <>
                              <ToggleRight className="w-3 h-3 mr-1.5" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-3 h-3 mr-1.5" />
                              Activate
                            </>
                          )}
                        </button>

                        <button
                          className="flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                          onClick={() => handleDeleteTemplate(template.FORM_ID, template.FORM_NAME)}
                          title="Delete template permanently"
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

          {/* Enhanced Footer */}
          <div className="bg-white border-t border-gray-200 px-6 py-4 mt-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <div className="flex items-center justify-center w-5 h-5 bg-blue-100 rounded-full">
                  <Users className="w-3 h-3 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">
                  Custom templates are only visible to users with Super Admin privileges
                </p>
              </div>
              <button
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                onClick={handleModalClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CustomWorkflowTemplateModal;

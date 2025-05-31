import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';
import AdminFormGroupFields from './AdminFormGroupFields';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';
// AG Grid imports
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, GridApi } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
// Import styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import '../styles/ag-grid-custom.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const AdminFormsGroups: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // State for groups and loading indicator
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authHeaders, setAuthHeaders] = useState<{[key: string]: string}>({});
  
  // State for search/filter functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGroups, setFilteredGroups] = useState<any[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<any>(null);
  const [currentGroup, setCurrentGroup] = useState<any>(null);

  // State for form
  const [formData, setFormData] = useState({
    GROUP_NAME: '',
    GROUP_DESCRIPTION: '',
    SORT_ORDER: 0,
    IS_PUBLIC: false,
    ORGANIZATION_ID: null as string | null
  });

  // Reference to the AG Grid API
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Custom cell renderer for boolean values
  const BooleanCellRenderer = (props: any) => {
    return props.value ? (
      <div className="flex justify-center">
        <FaCheck className="text-green-500" />
      </div>
    ) : (
      <div className="flex justify-center">
        <FaTimes className="text-red-500" />
      </div>
    );
  };

  // Custom cell renderer for Actions column
  const ActionsCellRenderer = (props: any) => {
    return (
      <div className="flex justify-center space-x-3">
        <button
          className="text-blue-600 hover:text-blue-800"
          onClick={() => handleEdit(props.data)}
          title="Edit Group"
        >
          <FaEdit size={16} />
        </button>
        <button
          className="text-green-600 hover:text-green-800"
          onClick={() => navigate(`/admin-forms-groups/fields/${props.data.GROUP_ID}`)}
          title="Manage Fields"
        >
          <FaPlus size={16} />
        </button>
        <button
          className="text-red-600 hover:text-red-800"
          onClick={() => openDeleteConfirmation(props.data)}
          title="Delete Group"
        >
          <FaTrash size={16} />
        </button>
      </div>
    );
  };

  // AG Grid Column Definitions with custom cell renderers
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'GROUP_ID',
      headerName: 'ID',
      sortable: true,
      filter: true,
      width: 100,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      field: 'GROUP_NAME',
      headerName: 'Group Name',
      sortable: true,
      filter: true,
      flex: 1,
      headerClass: 'ag-header-cell-left',
      cellClass: 'ag-cell-left',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      },
      cellStyle: { fontWeight: 500 }
    },
    {
      field: 'GROUP_DESCRIPTION',
      headerName: 'Description',
      sortable: true,
      filter: true,
      flex: 1.5,
      headerClass: 'ag-header-cell-left',
      cellClass: 'ag-cell-left',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      field: 'ORGANIZATION_ID',
      headerName: 'Organization',
      sortable: true,
      filter: true,
      width: 150,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      },
      valueGetter: (params: any) => {
        if (params.data.ORGANIZATIONS && typeof params.data.ORGANIZATIONS === 'object') {
          return params.data.ORGANIZATIONS.COMPANY_NAME;
        }
        return params.data.ORGANIZATION_ID;
      }
    },
    {
      field: 'IS_PUBLIC',
      headerName: 'Public',
      sortable: true,
      filter: true,
      width: 120,
      cellRenderer: BooleanCellRenderer,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      field: 'SORT_ORDER',
      headerName: 'Sort Order',
      sortable: true,
      filter: true,
      width: 120,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      headerName: 'Actions',
      width: 120,
      cellRenderer: ActionsCellRenderer,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      sortable: false,
      filter: false
    }
  ], []);

  // Fetch groups from API
  const fetchGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/forms-groups', { headers: authHeaders });
      setGroups(response.data);
      setFilteredGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  // Fetch organizations from API
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await axios.get('/api/organizations', { headers: authHeaders });
      setOrganizations(response.data);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to load organizations. Please try again.');
    }
  }, [authHeaders]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Filter groups based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      // If search term is empty, show all groups
      setFilteredGroups(groups);
    } else {
      // Filter groups based on search term (case-insensitive)
      const filtered = groups.filter(group => 
        group.GROUP_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.GROUP_DESCRIPTION?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (group.ORGANIZATIONS?.COMPANY_NAME || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredGroups(filtered);
    }
  }, [groups, searchTerm]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'ORGANIZATION_ID') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
    } else if (name === 'SORT_ORDER') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted', { formData });
    
    if (!formData.GROUP_NAME.trim()) {
      toast.error('Group name is required');
      return;
    }

    try {
      console.log('Attempting to save group', currentGroup ? 'update' : 'create');
      if (currentGroup) {
        // Update existing group
        console.log('Updating group with ID:', currentGroup.GROUP_ID);
        const response = await axios.put(`/api/forms-groups/${currentGroup.GROUP_ID}`, formData, { headers: authHeaders });
        console.log('Update response:', response.data);
        toast.success('Group updated successfully');
      } else {
        // Create new group
        console.log('Creating new group with data:', formData);
        const response = await axios.post('/api/forms-groups', formData, { headers: authHeaders });
        console.log('Create response:', response.data);
        toast.success('Group created successfully');
      }
      
      // Close modal and refresh data
      closeModal();
      fetchGroups();
    } catch (error) {
      console.error('Error saving group:', error);
      toast.error('Failed to save group. Please try again.');
    }
  };

  // Open modal for adding a new group
  const handleAddNew = () => {
    setCurrentGroup(null);
    setFormData({
      GROUP_NAME: '',
      GROUP_DESCRIPTION: '',
      SORT_ORDER: 0,
      IS_PUBLIC: false,
      ORGANIZATION_ID: null
    });
    setIsModalOpen(true);
  };

  // Open modal for editing an existing group
  const handleEdit = (group: any) => {
    setCurrentGroup(group);
    setFormData({
      GROUP_NAME: group.GROUP_NAME || '',
      GROUP_DESCRIPTION: group.GROUP_DESCRIPTION || '',
      SORT_ORDER: group.SORT_ORDER || 0,
      IS_PUBLIC: group.IS_PUBLIC || false,
      ORGANIZATION_ID: group.ORGANIZATION_ID || null
    });
    setIsModalOpen(true);
  };

  // Open confirmation modal for deleting a group
  const openDeleteConfirmation = (group: any) => {
    setGroupToDelete(group);
    setIsConfirmModalOpen(true);
  };

  // Handle group deletion
  const handleDelete = async () => {
    if (!groupToDelete) {
      console.error('No group selected for deletion');
      return;
    }
    
    console.log('Attempting to delete group:', groupToDelete);
    console.log('Using auth headers:', authHeaders);
    
    try {
      const response = await axios.delete(`/api/forms-groups/${groupToDelete.GROUP_ID}`, { headers: authHeaders });
      console.log('Delete response:', response.data);
      toast.success('Group deleted successfully');
      setIsConfirmModalOpen(false);
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group. Please try again.');
    }
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Handle grid ready event
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  // Initialize auth token once when component mounts
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setAuthToken(token);
      setAuthHeaders({
        'Authorization': `Bearer ${token}`
      });
    } else {
      console.error('No authentication token found');
      toast.error('Authentication required. Please log in again.');
    }
  }, []);

  // Fetch groups and organizations when auth headers are set
  useEffect(() => {
    if (Object.keys(authHeaders).length > 0) {
      fetchGroups();
      fetchOrganizations();
    }
  }, [authHeaders, fetchGroups, fetchOrganizations]);

  // Redirect if not authenticated or not admin
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  const isAdmin = user.roles?.some((role: any) => role.id === 1 || role.id === 6) ||
    user.role === '1' || user.role === '6';

  if (!isAdmin) return <Navigate to="/home" />;

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/admin')}
              className="mr-4 p-2 rounded-full hover:bg-gray-200 transition"
            >
              <FaArrowLeft className="text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Form Groups Management</h1>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* Grid header with search filter and Add button */}
          <div className="flex items-center mb-6 gap-4">
            {/* Left side: Header */}
            <h2 className="text-lg font-semibold text-gray-800 whitespace-nowrap">Form Group Definitions</h2>
            
            {/* Middle: Search filter */}
            <div className="flex-grow relative flex justify-center items-center">
              <input
                type="text"
                placeholder="Filter..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent max-w-[300px]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
            
            {/* Right side: Add button */}
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary whitespace-nowrap"
              style={{ backgroundColor: '#2EBCBC' }}
              onClick={handleAddNew}
            >
              <FaPlus className="mr-2" /> Add New Group
            </button>
          </div>
          
          {/* Show search result count when filtering */}
          {searchTerm && (
            <div className="mb-2 text-sm text-gray-600">
              Found {filteredGroups.length} {filteredGroups.length === 1 ? 'result' : 'results'}
              {filteredGroups.length === 0 && searchTerm && (
                <span> for "{searchTerm}". <button onClick={() => setSearchTerm('')} className="text-primary hover:underline">Clear search</button></span>
              )}
            </div>
          )}

          {/* AG Grid */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredGroups.length === 0 && !searchTerm ? (
            <div className="text-center py-8 text-gray-500">
              <p>No form groups found. Add your first group to get started.</p>
            </div>
          ) : (
            <div className="ag-theme-alpine w-full" style={{ height: '600px' }}>
              <AgGridReact
                ref={gridRef}
                pagination={true}
                paginationPageSize={10}
                paginationAutoPageSize={false}
                paginationPageSizeSelector={[10, 25, 50, 100]}
                headerHeight={48}
                rowHeight={40}
                rowData={filteredGroups}
                columnDefs={columnDefs}
                defaultColDef={{
                  flex: 1,
                  minWidth: 100,
                  filter: true,
                  sortable: true,
                  resizable: true
                }}
                onGridReady={onGridReady}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-white rounded-lg shadow-xl ${currentGroup ? 'max-w-6xl' : 'max-w-md'} w-full`}>
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {currentGroup ? 'Edit Form Group' : 'Add New Form Group'}
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className={`${currentGroup ? 'flex flex-col md:flex-row gap-6' : ''}`}>
                <form onSubmit={handleSubmit} className={`${currentGroup ? 'md:w-1/3' : 'w-full'}`}>
                  <div className="space-y-4">
                  {/* Group Name */}
                  <div>
                    <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">Group Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      id="groupName"
                      name="GROUP_NAME"
                      value={formData.GROUP_NAME}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter group name"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      id="description"
                      name="GROUP_DESCRIPTION"
                      value={formData.GROUP_DESCRIPTION || ''}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter description"
                    />
                  </div>

                  {/* Organization */}
                  {/* <div>
                    <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                    <select
                      id="organization"
                      name="ORGANIZATION_ID"
                      value={formData.ORGANIZATION_ID || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select an organization</option>
                      {organizations.map(org => (
                        <option key={org.ORGANIZATION_ID} value={org.ORGANIZATION_ID}>
                          {org.COMPANY_NAME}
                        </option>
                      ))}
                    </select>
                  </div> */}

                  {/* Sort Order */}
                  <div>
                    <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      id="sortOrder"
                      name="SORT_ORDER"
                      value={formData.SORT_ORDER}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter sort order"
                      min="0"
                    />
                  </div>

                  {/* Is Public */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isPublic"
                      name="IS_PUBLIC"
                      checked={formData.IS_PUBLIC}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                      Is Public
                    </label>
                  </div>
                  
                  {/* Modal Footer */}
                  <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      {currentGroup ? 'Update Group' : 'Add Group'}
                    </button>
                  </div>
                  </div>
                </form>
                
                {/* Show AdminFormGroupFields component on the right side when editing a group */}
                {currentGroup && (
                  <div className="md:w-2/3 border-l border-gray-200 pl-6">
                    <AdminFormGroupFields groupId={currentGroup.GROUP_ID} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Form Group"
        message={`Are you sure you want to delete the form group "${groupToDelete?.GROUP_NAME}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default AdminFormsGroups;

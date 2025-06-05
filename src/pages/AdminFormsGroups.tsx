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
import '../styles/StyleGuide.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface AdminFormsGroupsProps {
  isInModal?: boolean;
  onModalClose?: () => void;
}

const AdminFormsGroups: React.FC<AdminFormsGroupsProps> = ({ isInModal = false, onModalClose }) => {
  // Use onModalClose when needed (for example, when closing the form after successful operations)
  const handleSuccessOperation = () => {
    if (isInModal && onModalClose) {
      onModalClose();
    }
  };
  
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // State for groups and loading indicator
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      field: 'ORGANIZATION_NAME',
      headerName: 'Organization',
      sortable: true,
      filter: true,
      width: 150,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      field: 'IS_PUBLIC',
      headerName: 'Public',
      sortable: true,
      filter: true,
      width: 120,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      cellRenderer: BooleanCellRenderer,
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
      width: 150,
      cellRenderer: ActionsCellRenderer,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      sortable: false,
      filter: false
    }
  ], [navigate]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Filter groups based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredGroups(groups);
    } else {
      const lowercaseSearch = searchTerm.toLowerCase();
      const filtered = groups.filter(group => 
        (group.GROUP_NAME && group.GROUP_NAME.toLowerCase().includes(lowercaseSearch)) ||
        (group.GROUP_DESCRIPTION && group.GROUP_DESCRIPTION.toLowerCase().includes(lowercaseSearch)) ||
        (group.ORGANIZATION_NAME && group.ORGANIZATION_NAME.toLowerCase().includes(lowercaseSearch))
      );
      setFilteredGroups(filtered);
    }
  }, [searchTerm, groups]);

  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
      console.log(`Checkbox ${name} changed to:`, checked);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  // Close modal and reset form
  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentGroup(null);
    setFormData({
      GROUP_NAME: '',
      GROUP_DESCRIPTION: '',
      SORT_ORDER: 0,
      IS_PUBLIC: false,
      ORGANIZATION_ID: null
    });
  };

  // Fetch groups from API
  const fetchGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/forms-groups', { headers: authHeaders });
      console.log('Fetched groups:', response.data);
      setGroups(response.data);
      setFilteredGroups(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups. Please try again.');
      setIsLoading(false);
    }
  }, [authHeaders]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (currentGroup) {
        // Update existing group
        console.log('Updating group with ID:', currentGroup.GROUP_ID);
        const response = await axios.put(`/api/forms-groups/${currentGroup.GROUP_ID}`, formData, { headers: authHeaders });
        console.log('Update response:', response.data);
        handleUpdateSuccess(response.data);
      } else {
        // Create new group
        console.log('Creating new group with data:', formData);
        const response = await axios.post('/api/forms-groups', formData, { headers: authHeaders });
        console.log('Create response:', response.data);
        handleCreateSuccess(response.data);
      }
    } catch (error) {
      console.error('Error saving group:', error);
      toast.error('Failed to save group. Please try again.');
    }
  };

  // Handle successful group update
  const handleUpdateSuccess = (updatedGroup: any) => {
    setGroups(prevGroups => prevGroups.map(group => 
      group.GROUP_ID === updatedGroup.GROUP_ID ? updatedGroup : group
    ));
    setIsModalOpen(false);
    setCurrentGroup(null);
    toast.success('Group updated successfully!');
    
    // Use the onModalClose prop if we're in a modal and operation was successful
    if (isInModal && onModalClose) {
      handleSuccessOperation();
    }
  };

  // Handle successful group creation
  const handleCreateSuccess = (newGroup: any) => {
    setGroups(prevGroups => [...prevGroups, newGroup]);
    setIsModalOpen(false);
    setFormData({
      GROUP_NAME: '',
      GROUP_DESCRIPTION: '',
      SORT_ORDER: 0,
      IS_PUBLIC: false,
      ORGANIZATION_ID: null
    });
    toast.success('Group created successfully!');
    
    // Use the onModalClose prop if we're in a modal and operation was successful
    if (isInModal && onModalClose) {
      handleSuccessOperation();
    }
  };

  // Handle successful group deletion
  const handleDeleteSuccess = () => {
    setGroups(prevGroups => prevGroups.filter(group => group.GROUP_ID !== groupToDelete?.GROUP_ID));
    setIsConfirmModalOpen(false);
    setGroupToDelete(null);
    toast.success('Group deleted successfully!');
    
    // Use the onModalClose prop if we're in a modal and operation was successful
    if (isInModal && onModalClose) {
      handleSuccessOperation();
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
    
    // Convert IS_PUBLIC from database representation (0/1) to boolean
    const isPublic = group.IS_PUBLIC === 1 || group.IS_PUBLIC === true;
    console.log('Setting IS_PUBLIC value:', group.IS_PUBLIC, '→', isPublic);
    
    setFormData({
      GROUP_NAME: group.GROUP_NAME || '',
      GROUP_DESCRIPTION: group.GROUP_DESCRIPTION || '',
      SORT_ORDER: group.SORT_ORDER || 0,
      IS_PUBLIC: isPublic,
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

    try {
      const response = await axios.delete(`/api/forms-groups/${groupToDelete.GROUP_ID}`, { headers: authHeaders });
      console.log('Delete response:', response.data);
      handleDeleteSuccess();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group. Please try again.');
    }
  };

  // Set up authentication headers when component mounts
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setAuthHeaders({
        'Authorization': `Bearer ${token}`
      });
    }
  }, []);

  // Fetch data when component mounts or auth headers change
  useEffect(() => {
    if (Object.keys(authHeaders).length > 0) {
      fetchGroups();
    }
  }, [authHeaders, fetchGroups]);

  // Redirect if not authenticated or not admin
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  const isAdmin = user.roles?.some((role: any) => role.id === 1 || role.id === 6) ||
    user.role === '1' || user.role === '6';

  if (!isAdmin) return <Navigate to="/home" />;

  return (
    <div className="container mx-auto px-4 py-2">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          {!isInModal && (
            <button
              className="sg-button-icon mr-4"
              onClick={() => navigate('/admin')}
              aria-label="Go back to admin"
              data-component-name="AdminFormsGroups"
            >
              <FaArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-2xl font-bold">Form Groups Management</h1>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
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
              className="sg-input max-w-[300px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="sg-button-icon absolute right-3 top-1/2 transform -translate-y-1/2"
                data-component-name="AdminFormsGroups"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          
          {/* Right side: Add button */}
          <button
            className="sg-button-primary sg-button-with-icon whitespace-nowrap"
            onClick={handleAddNew}
            data-component-name="AdminFormsGroups"
          >
            <FaPlus className="mr-2" /> Add New Group
          </button>
        </div>
        
        {/* Show search result count when filtering */}
        {searchTerm && (
          <div className="mb-4 text-sm text-gray-600">
            Found {filteredGroups.length} {filteredGroups.length === 1 ? 'result' : 'results'} for "{searchTerm}"
          </div>
        )}
        
        {/* AG Grid for displaying groups */}
        <div 
          className="ag-theme-alpine w-full" 
          style={{ height: '500px' }}
        >
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : (
            
            <AgGridReact
              ref={gridRef}
              rowData={filteredGroups}
              columnDefs={columnDefs}
              animateRows={true}
              rowSelection="single"
              pagination={true}
              paginationPageSize={10}
              suppressCellFocus={true}
              overlayNoRowsTemplate="No groups found"
              paginationPageSizeSelector={[10, 25, 50, 100]}
              headerHeight={48}
              rowHeight={40}
              defaultColDef={{
                flex: 1,
                minWidth: 100,
                filter: true,
                sortable: true,
                resizable: true
              }}
            />
          )}
        </div>
      </div>

      {/* Modal for Add/Edit Group */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">
                {currentGroup ? 'Edit Group' : 'Add New Group'}
              </h2>
              <button
                onClick={closeModal}
                className="sg-button-icon"
                aria-label="Close modal"
                data-component-name="AdminFormsGroups"
              >
                <FaTimes size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Form on the left side */}
                  <div className="md:w-1/3 space-y-4">
                    <div data-component-name="AdminFormsGroups">
                      <label className="block text-sm font-medium text-gray-700 mb-1" data-component-name="AdminFormsGroups">
                        Group Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="GROUP_NAME"
                        value={formData.GROUP_NAME}
                        onChange={handleInputChange}
                        required
                        className="sg-input"
                        data-component-name="AdminFormsGroups"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" data-component-name="AdminFormsGroups">
                        Description
                      </label>
                      <textarea
                        name="GROUP_DESCRIPTION"
                        value={formData.GROUP_DESCRIPTION || ''}
                        onChange={handleInputChange}
                        rows={3}
                        className="sg-textarea"
                        data-component-name="AdminFormsGroups"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sort Order
                      </label>
                      <input
                        type="number"
                        name="SORT_ORDER"
                        value={formData.SORT_ORDER}
                        onChange={handleInputChange}
                        min={0}
                        className="sg-input"
                        data-component-name="AdminFormsGroups"
                      />
                    </div>
                    
                    <div className="sg-checkbox-container" data-component-name="AdminFormsGroups">
                      <input
                        type="checkbox"
                        id="IS_PUBLIC"
                        name="IS_PUBLIC"
                        checked={formData.IS_PUBLIC}
                        onChange={handleCheckboxChange}
                        className="sg-toggle"
                        data-component-name="AdminFormsGroups"
                      />
                      <label htmlFor="IS_PUBLIC" className="sg-toggle-label">
                        Public
                      </label>
                    </div>
                  </div>

                  {/* Group fields display on the right */}
                  {currentGroup && (
                    <div className="md:w-2/3 border-l border-gray-200 pl-6" data-component-name="AdminFormsGroups">
                      {(() => {
                        console.log('Rendering AdminFormGroupFields with groupId:', currentGroup.GROUP_ID, 'Type:', typeof currentGroup.GROUP_ID);
                        return null;
                      })()}
                      <AdminFormGroupFields groupId={Number(currentGroup.GROUP_ID)} />
                    </div>
                  )}
                </div>
                
                {/* Footer with buttons */}
                <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-3" data-component-name="AdminFormsGroups">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="sg-button-secondary"
                    data-component-name="AdminFormsGroups"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sg-button-primary"
                    data-component-name="AdminFormsGroups"
                  >
                    {currentGroup ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
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

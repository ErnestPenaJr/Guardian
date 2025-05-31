import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { Trash2, Check, X } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import '../styles/ag-grid-custom.css';

interface AdminFormGroupFieldsProps {
  groupId: number;
}

interface GroupField {
  GROUP_ID: number;
  FIELD_ID: number;
  SORT_ORDER?: number;
  IS_REQUIRED?: boolean;
  FIELD_NAME?: string; // For display purposes
  FIELD_TYPE_DESC?: string; // For display purposes
}

const AdminFormGroupFields: React.FC<AdminFormGroupFieldsProps> = ({ groupId }) => {
  const [groupFields, setGroupFields] = useState<GroupField[]>([]);
  const [filteredFields, setFilteredFields] = useState<GroupField[]>([]);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<GroupField | null>(null);
  
  // Reference to the grid API
  const gridApiRef = useRef<any>(null);
  
  const [newGroupField, setNewGroupField] = useState<GroupField>({
    GROUP_ID: groupId,
    FIELD_ID: 0,
    SORT_ORDER: 0,
    IS_REQUIRED: false
  });

  // Fetch group fields
  const fetchGroupFields = useCallback(async () => {
    try {
      // Validate groupId
      if (!groupId || isNaN(Number(groupId))) {
        console.error('Invalid groupId:', groupId);
        setError('Invalid group ID. Please select a valid group.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      console.log('Fetching group details for groupId:', groupId);
      
      // Fetch the group details to get the name
      try {
        const groupResponse = await api.get(`/forms-groups/${groupId}`);
        console.log('Group details response:', groupResponse.data);
        
        if (groupResponse.data) {
          setGroupName(groupResponse.data.GROUP_NAME || 'Group');
        }
      } catch (groupErr: any) {
        console.error('Error fetching group details:', groupErr);
        // Continue even if group details fail
      }
      
      // Fetch the actual group fields from the API
      const fieldsResponse = await api.get(`/forms-groups/${groupId}/fields`);
      console.log('Group fields response:', fieldsResponse.data);
      
      if (fieldsResponse.data && Array.isArray(fieldsResponse.data)) {
        // Transform the response data to match our component's expected format
        const formattedFields = fieldsResponse.data.map(item => ({
          GROUP_ID: item.GROUP_ID,
          FIELD_ID: item.FIELD_ID,
          SORT_ORDER: item.SORT_ORDER,
          IS_REQUIRED: item.IS_REQUIRED,
          FIELD_NAME: item.FIELDS?.FIELD_NAME || 'Unknown Field',
          FIELD_TYPE_DESC: item.FIELDS?.FIELD_TYPE?.FIELD_TYPE_DESC || 'Unknown Type'
        }));
        
        console.log('Formatted group fields:', formattedFields);
        setGroupFields(formattedFields);
        setFilteredFields(formattedFields); // Initialize filtered fields with all fields
      } else {
        console.warn('Unexpected response format for group fields:', fieldsResponse.data);
        setGroupFields([]);
        setFilteredFields([]);
      }
    } catch (err: any) {
      console.error('Error fetching group fields:', err);
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response data:', err.response.data);
        console.error('Error response status:', err.response.status);
        console.error('Error response headers:', err.response.headers);
      } else if (err.request) {
        // The request was made but no response was received
        console.error('Error request:', err.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', err.message);
      }
      setError(`Failed to load group fields: ${err.message || 'Unknown error'}`);
      toast.error('Failed to load group fields');
      setGroupFields([]);
      setFilteredFields([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Fetch available fields
  const fetchAvailableFields = useCallback(async () => {
    try {
      // Fetch all available fields from the API
      const fieldsResponse = await api.get('/fields');
      console.log('Available fields response:', fieldsResponse.data);
      
      if (fieldsResponse.data && Array.isArray(fieldsResponse.data)) {
        // Make sure we're handling the response data correctly
        const formattedFields = fieldsResponse.data.map(field => ({
          FIELD_ID: field.FIELD_ID,
          FIELD_NAME: field.FIELD_NAME,
          FIELD_TYPE: {
            FIELD_TYPE_DESC: field.FIELD_TYPE?.FIELD_TYPE_DESC || 'Unknown'
          }
        }));
        
        console.log('Formatted available fields:', formattedFields);
        setAvailableFields(formattedFields);
      } else {
        console.warn('Unexpected response format for available fields:', fieldsResponse.data);
        setAvailableFields([]);
      }
    } catch (err: any) {
      console.error('Error setting mock available fields:', err);
      toast.error(`Failed to load available fields: ${err.message || 'Unknown error'}`);
    }
  }, []);

  // Load data when component mounts
  useEffect(() => {
    fetchGroupFields();
    fetchAvailableFields();
  }, [fetchGroupFields, fetchAvailableFields]);

  // Handle input change for new group field
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setNewGroupField(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (name === 'FIELD_ID') {
      setNewGroupField(prev => ({
        ...prev,
        [name]: parseInt(value)
      }));
    } else if (name === 'SORT_ORDER') {
      setNewGroupField(prev => ({
        ...prev,
        [name]: parseInt(value) || 0
      }));
    } else {
      setNewGroupField(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Add new group field
  const handleAddGroupField = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newGroupField.FIELD_ID) {
      toast.error('Please select a field');
      return;
    }
    
    try {
      // Check if field already exists in the group
      const fieldExists = groupFields.some(field => field.FIELD_ID === newGroupField.FIELD_ID);
      if (fieldExists) {
        toast.error('This field is already added to the group');
        return;
      }
      
      // Add the field to the group
      const fields = [
        {
          FIELD_ID: newGroupField.FIELD_ID,
          SORT_ORDER: newGroupField.SORT_ORDER,
          IS_REQUIRED: newGroupField.IS_REQUIRED
        }
      ];
      
      // Get the selected field details for display
      const selectedField = availableFields.find(field => field.FIELD_ID === newGroupField.FIELD_ID);
      
      // Add all existing fields to maintain them
      groupFields.forEach(field => {
        fields.push({
          FIELD_ID: field.FIELD_ID,
          SORT_ORDER: field.SORT_ORDER,
          IS_REQUIRED: field.IS_REQUIRED
        });
      });
      
      await api.post(`/forms-groups/${groupId}/fields`, { fields });
      
      // Add the new field to the displayed list with field details
      const newField = {
        GROUP_ID: groupId,
        FIELD_ID: newGroupField.FIELD_ID,
        SORT_ORDER: newGroupField.SORT_ORDER,
        IS_REQUIRED: newGroupField.IS_REQUIRED,
        FIELD_NAME: selectedField?.FIELD_NAME || 'Unknown Field',
        FIELD_TYPE_DESC: selectedField?.FIELD_TYPE?.FIELD_TYPE_DESC || 'Unknown Type'
      };
      
      setGroupFields(prev => [...prev, newField]);
      
      // Reset the form
      setNewGroupField({
        GROUP_ID: groupId,
        FIELD_ID: 0,
        SORT_ORDER: 0,
        IS_REQUIRED: false
      });
      
      toast.success('Field added to group successfully');
    } catch (err) {
      console.error('Error adding field to group:', err);
      toast.error('Failed to add field to group');
    }
  };

  // Delete group field
  const handleDeleteGroupField = async () => {
    // Make sure we have a field to delete
    if (!fieldToDelete) return;
    
    try {
      // Remove the field from the list
      const updatedFields = groupFields.filter(field => field.FIELD_ID !== fieldToDelete.FIELD_ID);
      
      // Prepare the fields array for the API call
      const fields = updatedFields.map(field => ({
        FIELD_ID: field.FIELD_ID,
        SORT_ORDER: field.SORT_ORDER,
        IS_REQUIRED: field.IS_REQUIRED
      }));
      
      // Update the group fields
      await api.post(`/forms-groups/${groupId}/fields`, { fields });
      
      // Update both the main and filtered lists
      setGroupFields(updatedFields);
      setFilteredFields(updatedFields);
      
      toast.success('Field removed from group successfully');
    } catch (err) {
      console.error('Error removing field from group:', err);
      toast.error('Failed to remove field from group');
      // Refresh the data to ensure UI consistency
      fetchGroupFields();
    }
  };

  // Handle cell value changes
  const onCellValueChanged = async (params: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = params;
    
    if (newValue === oldValue) return;
    
    const fieldId = data.FIELD_ID;
    if (!fieldId) return;
    
    const field = colDef.field;
    if (!field) return;
    
    try {
      // Update the local state first
      const updatedFields = groupFields.map(groupField => {
        if (groupField.FIELD_ID === fieldId) {
          return { ...groupField, [field]: newValue };
        }
        return groupField;
      });
      
      setGroupFields(updatedFields);
      
      // Prepare the fields array for the API call
      const fields = updatedFields.map(field => ({
        FIELD_ID: field.FIELD_ID,
        SORT_ORDER: field.SORT_ORDER,
        IS_REQUIRED: field.IS_REQUIRED
      }));
      
      // Update the group fields
      await api.post(`/forms-groups/${groupId}/fields`, { fields });
      
      toast.success('Field updated successfully');
    } catch (err) {
      console.error('Error updating field:', err);
      toast.error('Failed to update field');
      // Revert the change in the grid
      fetchGroupFields();
    }
  };

  // Custom cell renderer for boolean values
  const BooleanCellRenderer = (props: any) => {
    return props.value ? (
      <div className="flex justify-center">
        <Check size={18} className="text-green-600" />
      </div>
    ) : (
      <div className="flex justify-center">
        <X size={18} className="text-red-600" />
      </div>
    );
  };

  // Function to open the confirmation modal
  const openDeleteConfirmation = (field: GroupField) => {
    setFieldToDelete(field);
    setIsConfirmModalOpen(true);
  };

  // Function to close the confirmation modal
  const closeConfirmModal = () => {
    setIsConfirmModalOpen(false);
    setFieldToDelete(null);
  };

  // Custom cell renderer for actions column
  const ActionsRenderer = (props: any) => {
    return (
      <div className="flex justify-center items-center">
        <button
          onClick={(e) => {
            // Stop event propagation to prevent any parent handlers
            e.stopPropagation();
            e.preventDefault();
            // Open confirmation modal instead of deleting directly
            openDeleteConfirmation(props.data);
            return false; // Prevent default behavior
          }}
          className="text-red-600 hover:text-red-900 focus:outline-none"
          title="Remove field from group"
        >
          <Trash2 size={18} />
        </button>
      </div>
    );
  };

  // Add search/filter functionality
  useEffect(() => {
    if (!searchTerm.trim()) {
      // If search term is empty, show all fields
      setFilteredFields(groupFields);
    } else {
      // Filter fields based on search term (case-insensitive)
      const filtered = groupFields.filter(field => 
        (field.FIELD_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (field.FIELD_TYPE_DESC || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredFields(filtered);
    }
  }, [groupFields, searchTerm]);

  // Column definitions for the grid
  const columnDefs: ColDef[] = [
    {
      field: 'FIELD_NAME',
      headerName: 'Field Name',
      sortable: true,
      filter: true,
      flex: 1
    },
    {
      field: 'FIELD_TYPE_DESC',
      headerName: 'Field Type',
      sortable: true,
      filter: true,
      width: 150
    },
    {
      field: 'SORT_ORDER',
      headerName: 'Sort Order',
      editable: true,
      sortable: true,
      filter: true,
      width: 120,
      cellClass: 'editable-cell',
      valueFormatter: (params) => {
        return params.value !== undefined && params.value !== null ? params.value.toString() : '';
      }
    },
    {
      field: 'IS_REQUIRED',
      headerName: 'Required',
      editable: true,
      sortable: true,
      filter: true,
      width: 120,
      cellRenderer: BooleanCellRenderer,
      cellClass: 'editable-cell',
      cellEditor: 'agCheckboxCellEditor'
    },
    {
      headerName: 'Actions',
      width: 100,
      cellRenderer: ActionsRenderer,
      sortable: false,
      filter: false
    }
  ];

  // Default column definitions
  const defaultColDef = {
    resizable: true,
    sortable: true,
    filter: true,
    floatingFilter: false
  };

  // Grid ready event handler
  const onGridReady = (params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  };

  return (
    <div className="w-full">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={closeConfirmModal}
        onConfirm={() => {
          handleDeleteGroupField();
          closeConfirmModal();
        }}
        title="Confirm Delete"
        message={`Are you sure you want to remove this field from the group${fieldToDelete ? ` (${fieldToDelete.FIELD_NAME || 'Unknown'})` : ''}?`}
        confirmText="Delete"
        cancelText="Cancel"
      />

      <div className="flex items-center mb-4 gap-4">
        {/* Left side: Header */}
        <h2 className="text-lg font-medium text-gray-900 whitespace-nowrap">Group Fields{groupName ? `: ${groupName}` : ''}</h2>
        
        {/* Middle: Search filter */}
        <div className="flex-grow relative">
          <input
            type="text"
            placeholder="Filter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
        
        {/* Right side: Add button - This will open the form */}
        <button
          type="button"
          onClick={() => {
            // Open form modal or similar action
            const fieldId = document.getElementById('fieldId');
            if (fieldId) {
              fieldId.focus();
            }
          }}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary whitespace-nowrap"
        >
          Add New Field
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading group fields</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                  <p className="mt-2">Please try selecting a different group or refresh the page.</p>
                </div>
              </div>
            </div>
          </div>
          <button 
            onClick={() => fetchGroupFields()}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary whitespace-nowrap"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          {/* Show search result count when filtering */}
          {searchTerm && (
            <div className="mb-2 text-sm text-gray-600">
              Found {filteredFields.length} {filteredFields.length === 1 ? 'result' : 'results'}
              {filteredFields.length === 0 && searchTerm && (
                <span key="search-no-results"> for "{searchTerm}". <button onClick={() => setSearchTerm('')} className="text-primary hover:underline">Clear search</button></span>
              )}
            </div>
          )}
          
          {/* Add Field Form */}
          <div className="mb-6">
            <form onSubmit={handleAddGroupField} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="fieldId" className="block text-sm font-medium text-gray-700 mb-1">
                  Field <span className="text-red-500">*</span>
                </label>
                <select
                  id="fieldId"
                  name="FIELD_ID"
                  value={newGroupField.FIELD_ID || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="">Select a field</option>
                  {availableFields.map(field => (
                    <option key={field.FIELD_ID} value={field.FIELD_ID}>
                      {field.FIELD_NAME}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  id="sortOrder"
                  name="SORT_ORDER"
                  value={newGroupField.SORT_ORDER || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter sort order"
                  min="0"
                />
              </div>
              
              <div className="flex items-center mt-7">
                <input
                  type="checkbox"
                  id="isRequired"
                  name="IS_REQUIRED"
                  checked={newGroupField.IS_REQUIRED || false}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="isRequired" className="ml-2 block text-sm text-gray-900">
                  Required Field
                </label>
              </div>
              
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary whitespace-nowrap"
                >
                  Add Field
                </button>
              </div>
            </form>
          </div>
          
          {filteredFields.length === 0 && !searchTerm ? (
            <div className="text-center py-4 text-gray-500">No fields added to this group yet. Add your first field above.</div>
          ) : (
            <div className="ag-theme-alpine" style={{ height: '400px', width: '100%' }}>
              <AgGridReact
                rowData={filteredFields}
                columnDefs={columnDefs}
                headerHeight={48}
                rowHeight={40}
                defaultColDef={defaultColDef}
                onGridReady={onGridReady}
                onCellValueChanged={onCellValueChanged}
                pagination={false}
                paginationPageSize={10}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminFormGroupFields;

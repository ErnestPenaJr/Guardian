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
  FIELD_NAME?: string; // For display purposes
  FIELD_TYPE_DESC?: string; // For display purposes
  [key: string]: any; // Allow indexing with string keys
}

const AdminFormGroupFields: React.FC<AdminFormGroupFieldsProps> = ({ groupId }): React.ReactNode => {
  const [groupFields, setGroupFields] = useState<GroupField[]>([]);
  const [filteredFields, setFilteredFields] = useState<GroupField[]>([]);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<GroupField | null>(null);
  
  // Reference to the grid API
  const gridRef = useRef<any>(null);
  
  const [newGroupField, setNewGroupField] = useState<GroupField>({
    GROUP_ID: groupId,
    FIELD_ID: 0,
    SORT_ORDER: 0
  });

  // Fetch group fields
  const fetchGroupFields = useCallback(async () => {
    try {
      // Validate groupId
      console.log('===== DEBUG: fetchGroupFields called =====');
      console.log('DEBUG: groupId received:', groupId, 'Type:', typeof groupId);
      
      if (!groupId || isNaN(Number(groupId))) {
        console.error('DEBUG: Invalid groupId:', groupId);
        setError('Invalid group ID. Please select a valid group.');
        setLoading(false);
        return;
      }

      // Ensure groupId is a number
      const groupIdNum = Number(groupId);
      console.log('DEBUG: Converted groupId:', groupIdNum);

      setLoading(true);
      setError(null);
      
      console.log('DEBUG: Fetching group details for groupId:', groupIdNum);
      
      // Fetch the group details to get the name
      try {
        const groupResponse = await api.get(`/forms-groups/${groupIdNum}`);
        console.log('DEBUG: Group details API response status:', groupResponse.status);
        console.log('DEBUG: Group details response data:', groupResponse.data);
        
        if (groupResponse.data) {
          setGroupName(groupResponse.data.GROUP_NAME || 'Group');
          console.log('DEBUG: Group name set to:', groupResponse.data.GROUP_NAME);
        }
      } catch (groupErr: any) {
        console.error('DEBUG: Error fetching group details:', groupErr);
        console.error('DEBUG: Error response:', groupErr.response?.data);
        // Continue even if group details fail
      }
      
      // Fetch the actual group fields from the API
      console.log('DEBUG: Fetching group fields data for groupId:', groupIdNum);
      const fieldsResponse = await api.get(`/forms-groups/${groupIdNum}/fields`);
      console.log('DEBUG: Group fields API response status:', fieldsResponse.status);
      console.log('DEBUG: Group fields response data:', fieldsResponse.data);
      
      if (fieldsResponse.data && Array.isArray(fieldsResponse.data)) {
        console.log('DEBUG: Response data is an array with length:', fieldsResponse.data.length);
        
        // Check first item structure to debug what fields are available
        if (fieldsResponse.data.length > 0) {
          console.log('DEBUG: First item structure:', JSON.stringify(fieldsResponse.data[0], null, 2));
          console.log('DEBUG: FIELDS property exists:', !!fieldsResponse.data[0].FIELDS);
          console.log('DEBUG: FIELD_NAME directly on item:', fieldsResponse.data[0].FIELD_NAME);
        }
        
        // Map the API response to handle both nested and flat data structures
        const formattedFields = fieldsResponse.data.map(item => {
          // Keep the data in the original format but ensure required fields exist
          return {
            // Core group field properties
            GROUP_ID: item.GROUP_ID,
            FIELD_ID: item.FIELD_ID,
            SORT_ORDER: item.SORT_ORDER,
            IS_REQUIRED: typeof item.IS_REQUIRED === 'boolean' ? item.IS_REQUIRED : item.IS_REQUIRED === 1,
            // Field name and type - keep both direct and nested paths for the valueGetters
            FIELD_NAME: item.FIELD_NAME,
            FIELD_TYPE_DESC: item.FIELD_TYPE_DESC,
            // Also preserve the nested structure if it exists
            FIELDS: item.FIELDS
          };
        });
        
        console.log('DEBUG: Formatted fields:', formattedFields);
        setGroupFields(formattedFields);
        setFilteredFields(formattedFields); // Initialize filtered fields with all fields
        console.log('DEBUG: State updated with formatted fields');
      } else {
        console.warn('DEBUG: Unexpected response format for group fields:', fieldsResponse.data);
        setGroupFields([]);
        setFilteredFields([]);
        console.log('DEBUG: Set empty arrays for group fields and filtered fields');
      }
      console.log('===== DEBUG: fetchGroupFields completed =====');
    } catch (err: any) {
      console.error('DEBUG: Error fetching group fields:', err);
      if (err.response) {
        console.error('DEBUG: Error response:', err.response.data);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('DEBUG: Error message:', err.message);
      }
      setError(`Failed to load group fields: ${err.message || 'Unknown error'}`);
      toast.error('Failed to load group fields');
      setGroupFields([]);
      setFilteredFields([]);
    } finally {
      setLoading(false);
      console.log('DEBUG: fetchGroupFields function complete');
    }
  }, [groupId]);

  // Fetch available fields
  const fetchAvailableFields = useCallback(async () => {
    try {
      // Fetch all available fields from the API using the existing /fields endpoint
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
      console.error('Error fetching available fields:', err);
      toast.error(`Failed to load available fields: ${err.message || 'Unknown error'}`);
    }
  }, []);

  // Load data when component mounts
  useEffect(() => {
    console.log('DEBUG: AdminFormGroupFields useEffect triggered');
    if (groupId) {
      console.log('DEBUG: Calling fetchGroupFields with groupId:', groupId);
      fetchGroupFields();
      fetchAvailableFields();
    } else {
      console.log('DEBUG: No groupId available yet');
    }
  }, [fetchGroupFields, fetchAvailableFields, groupId]);

  // Handle input change for new group field
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setNewGroupField(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (name === 'FIELD_ID' || name === 'SORT_ORDER') {
      // Ensure numeric fields are stored as numbers
      const numValue = value === '' ? 0 : parseInt(value);
      console.log(`Setting ${name} to numeric value:`, numValue);
      setNewGroupField(prev => ({
        ...prev,
        [name]: numValue
      }));
    } else {
      setNewGroupField(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Add new group field
  const handleAddGroupField = async (e: React.MouseEvent | React.FormEvent) => {
    // Prevent default browser behavior if it's a form event
    if ('preventDefault' in e) e.preventDefault();
    
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
      
      // Get the selected field details for validating it exists
      const selectedField = availableFields.find(field => field.FIELD_ID === newGroupField.FIELD_ID);
      if (!selectedField) {
        toast.error('Selected field not found in available fields');
        return;
      }
      
      // Prepare fields array with all existing fields plus new field
      const fields = [];
      
      // Add all existing fields - ensure each has FIELD_ID as a number
      groupFields.forEach(field => {
        fields.push({
          GROUP_ID: Number(groupId),
          FIELD_ID: Number(field.FIELD_ID),
          SORT_ORDER: Number(field.SORT_ORDER || 0)
        });
      });
      
      // Add the new field
      fields.push({
        GROUP_ID: Number(groupId),
        FIELD_ID: Number(newGroupField.FIELD_ID),
        SORT_ORDER: Number(newGroupField.SORT_ORDER || fields.length)
      });
      
      console.log('Sending fields to API:', fields); // Debug the request payload
      
      // Submit to API - ensure we're sending the fields array in the correct format
      const response = await api.post(`/forms-groups/${groupId}/fields`, { fields });
      console.log('API response:', response.data); // Debug the response
      
      // After successful save, refresh data
      await fetchGroupFields();
      
      // Reset form fields but keep form open
      setNewGroupField({
        GROUP_ID: groupId,
        FIELD_ID: 0,
        SORT_ORDER: 0
      });
      
      toast.success('Field added to group successfully');
    } catch (error: any) {
      console.error('Error adding field to group:', error);
      if (error.response) {
        console.error('API error response:', error.response.data);
      }
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
        FIELD_ID: field.FIELD_ID
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
      // For SORT_ORDER, ensure it's a proper number
      const processedValue = field === 'SORT_ORDER' ? Number(newValue) : newValue;
      
      // First update the local state for immediate visual feedback
      const updatedFields = groupFields.map(groupField => {
        if (groupField.FIELD_ID === fieldId) {
          return { ...groupField, [field]: processedValue };
        }
        return groupField;
      });
      
      // Update both state arrays
      setGroupFields(updatedFields);
      setFilteredFields(updatedFields);
      
      // Prepare the API payload - server needs an array of objects with FIELD_ID and SORT_ORDER
      const fieldsForApi = updatedFields.map(field => ({
        FIELD_ID: Number(field.FIELD_ID),
        SORT_ORDER: Number(field.SORT_ORDER || 0) // Ensure we send a number
      }));
      
      // Send complete set of fields to the API
      await api.post(`/forms-groups/${groupId}/fields`, { fields: fieldsForApi });
      
      toast.success('Field updated successfully');
    } catch (err) {
      console.error('Error updating field:', err);
      toast.error('Failed to update field');
      // On error, refresh data from server
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
      field: 'FIELD_ID',
      headerName: 'Field',
      sortable: true,
      filter: true,
      width: 150,
      editable: false, // Read-only field
      valueFormatter: (params) => {
        const field = availableFields.find(f => f.FIELD_ID === params.value);
        return field ? field.FIELD_NAME : params.value;
      }
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
      },
      cellEditor: 'agNumberCellEditor',
      // Allow single-click editing for better UX
      singleClickEdit: true,
      // These help with numeric validation
      valueParser: (params) => Number(params.newValue)
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
    floatingFilter: false,
    tabToNextCell: true,   // Enable tab navigation between cells
    stopEditingWhenGridLosesFocus: true  // Save changes when grid loses focus
  };

  // Grid ready event handler
  const onGridReady = (params: GridReadyEvent) => {
    gridRef.current = params.api;
    params.api.sizeColumnsToFit();
    // Use 'fullRow' to commit all changes together
    params.api.setGridOption('editType', 'fullRow');
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
            className="sg-input"
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
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary whitespace-nowrap"
          data-component-name="AdminFormGroupFields"
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
          {/* Search result count when filtering */}
          {searchTerm && (
            <div className="mb-2 text-sm text-gray-600">
              Found {filteredFields.length} {filteredFields.length === 1 ? 'result' : 'results'}
              {filteredFields.length === 0 && searchTerm && (
                <span key="search-no-results"> for "{searchTerm}". <button onClick={() => setSearchTerm('')} className="text-primary hover:underline">Clear search</button></span>
              )}
            </div>
          )}
          

          
          {/* Add Field Form */}
          {showAddForm && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-gray-900">Add New Field</h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <label htmlFor="fieldId" className="block text-sm font-medium text-gray-700 mb-1">
                    Field <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="fieldId"
                    name="FIELD_ID"
                    value={newGroupField.FIELD_ID || ''}
                    onChange={handleInputChange}
                    className="sg-dropdown w-full"
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
                
                <div className="md:col-span-3">
                  <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    id="sortOrder"
                    name="SORT_ORDER"
                    value={newGroupField.SORT_ORDER || 0}
                    onChange={handleInputChange}
                    className="sg-input w-full"
                    placeholder="Enter sort order"
                    min="0"
                  />
                </div>
                
                <div className="md:col-span-3 flex items-end">
                  <button
                    type="button"
                    onClick={(e) => handleAddGroupField(e)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary whitespace-nowrap w-full justify-center"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {filteredFields.length === 0 && !searchTerm ? (
            <div className="text-center py-4 text-gray-500">No fields added to this group yet. Add your first field above.</div>
          ) : (
            <div className="ag-theme-alpine" style={{ height: '300px', width: '100%' }}>
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
                stopEditingWhenCellsLoseFocus={true}
                suppressClickEdit={false}
                undoRedoCellEditing={true}
                undoRedoCellEditingLimit={20}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminFormGroupFields;

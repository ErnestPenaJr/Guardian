import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community';
// Import all modules from ag-grid-community instead of using the separate packages
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/StyleGuide.css';
import { Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import '../styles/ag-grid-custom.css';

// We'll use the built-in modules from ag-grid-community v33.3.0 instead of the separate packages

interface AdminFieldsLookupProps {
  fieldId: number;
}

interface FieldLookup {
  FIELD_LOOKUP_ID?: number;
  FIELD_ID: number;
  LOOKUP_CODE: string;
  LOOKUP_DESCRIPTION: string;
  SORT_ORDER: number;
  // Optional temporary ID for tracking new rows before they're saved
  tempId?: string;
  // IS_ACTIVE field removed as requested
}

const AdminFieldsLookup: React.FC<AdminFieldsLookupProps> = ({ fieldId }) => {
  const [lookups, setLookups] = useState<FieldLookup[]>([]);
  const [filteredLookups, setFilteredLookups] = useState<FieldLookup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [lookupToDelete, setLookupToDelete] = useState<FieldLookup | null>(null);
  
  // Create reusable auth headers
  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Column definitions with editable cells
  const columnDefs: ColDef[] = [
    { 
      field: 'LOOKUP_CODE', 
      headerName: 'Code', 
      editable: true,
      width: 150
    },
    { 
      field: 'LOOKUP_DESCRIPTION', 
      headerName: 'Description', 
      editable: true,
      flex: 1
    },
    { 
      field: 'SORT_ORDER', 
      headerName: 'Sort Order', 
      editable: true,
      width: 100,
      cellEditor: 'agNumberCellEditor'
    },
    // Active column removed as requested
    {
      headerName: 'Actions',
      width: 120,
      cellRenderer: (params: any) => {
        return (
          <button
            key={`delete-btn-${params.data?.FIELD_LOOKUP_ID || 'new'}`}
            onClick={(e) => {
              // Stop event propagation to prevent the modal from closing
              e.stopPropagation();
              e.preventDefault();
              // Open confirmation modal instead of deleting directly
              openDeleteConfirmation(params.data);
              return false; // Prevent default behavior
            }}
            className="text-red-600 hover:text-red-900 focus:outline-none"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        );
      }
    }
  ];

  // Default column definitions
  const defaultColDef = {
    resizable: true,
    sortable: true,
    filter: true,
    floatingFilter: false
  };

  // Fetch lookups for the specified field
  const fetchLookups = useCallback(async () => {
    if (!fieldId) {
      console.log('No fieldId provided, skipping fetch');
      return;
    }
    
    console.log(`Fetching lookups for fieldId: ${fieldId}`);
    setIsLoading(true);
    try {      
      // This endpoint should be in the fields.ts file, not field-lookups.ts
      const response = await axios.get(`/api/fields/${fieldId}/lookups`, { headers: authHeaders });
      console.log('Fetched lookups response:', response);
      console.log('Fetched lookups data:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        // Map the data to ensure all required fields are present
        const mappedData = response.data.map(item => ({
          FIELD_LOOKUP_ID: item.FIELD_LOOKUP_ID || null,
          FIELD_ID: item.FIELD_ID || fieldId,
          LOOKUP_CODE: item.LOOKUP_CODE || '',
          LOOKUP_DESCRIPTION: item.LOOKUP_DESCRIPTION || '',
          SORT_ORDER: typeof item.SORT_ORDER === 'number' ? item.SORT_ORDER : 0
        }));
        
        console.log(`Setting ${mappedData.length} lookups:`, mappedData);
        setLookups(mappedData);
        setFilteredLookups(mappedData); // Initialize filtered lookups with all lookups
      } else {
        console.warn('Received empty or non-array data from API:', response.data);
        setLookups([]);
        setFilteredLookups([]);
      }
    } catch (error) {
      console.error('Error fetching field lookups:', error);
      toast.error('Failed to load lookup values');
      setLookups([]);
      setFilteredLookups([]);
    } finally {
      setIsLoading(false);
    }
  }, [fieldId, authHeaders]);

  // Save a lookup value (create or update)
  const saveLookup = async (lookup: FieldLookup) => {
    try {
      // Ensure we have the required fields
      if (!lookup.LOOKUP_DESCRIPTION) {
        toast.warning('Description is required');
        return;
      }

      // Handle creation and updates differently
      if (lookup.FIELD_LOOKUP_ID && typeof lookup.FIELD_LOOKUP_ID === 'number' && lookup.FIELD_LOOKUP_ID > 0) {
        // Update existing lookup
        console.log('Updating existing lookup:', lookup);
        
        // Create a clean payload with only the fields needed by the server
        const updatePayload = {
          LOOKUP_CODE: lookup.LOOKUP_CODE || '',
          LOOKUP_DESCRIPTION: lookup.LOOKUP_DESCRIPTION,
          SORT_ORDER: typeof lookup.SORT_ORDER === 'number' ? lookup.SORT_ORDER : 0,
          FIELD_ID: fieldId
        };
        
        try {
          // Use the correct URL format for the update endpoint
          const updateUrl = `/api/field-lookups/${lookup.FIELD_LOOKUP_ID}`;
          console.log(`Sending PUT request to: ${updateUrl}`);
          
          const response = await axios.put(updateUrl, updatePayload, { headers: authHeaders });
          console.log('Update response:', response.data);
          
          // Update the local state
          const updatedLookups = lookups.map(item => 
            item.FIELD_LOOKUP_ID === lookup.FIELD_LOOKUP_ID ? {
              ...item,
              ...response.data
            } : item
          );
          
          setLookups(updatedLookups);
          toast.success('Lookup value updated successfully');
        } catch (error: any) {
          console.error('Update error details:', error.response?.data || error.message);
          
          // If server update fails, still update the UI to avoid confusion
          const updatedLookups = lookups.map(item => 
            item.FIELD_LOOKUP_ID === lookup.FIELD_LOOKUP_ID ? lookup : item
          );
          
          setLookups(updatedLookups);
          toast.warning('Lookup updated locally only. Server update failed.');
        }
      } else {
        // Create new lookup
        console.log('Creating new lookup:', lookup);
        
        // Create a clean payload with only the fields needed by the server
        const createPayload = {
          FIELD_ID: fieldId,
          LOOKUP_CODE: lookup.LOOKUP_CODE || '',
          LOOKUP_DESCRIPTION: lookup.LOOKUP_DESCRIPTION,
          SORT_ORDER: typeof lookup.SORT_ORDER === 'number' ? lookup.SORT_ORDER : 
            lookups.length > 0 ? Math.max(...lookups.map(l => l.SORT_ORDER || 0)) + 1 : 1
        };
        
        try {
          const response = await axios.post('/api/field-lookups', createPayload, { headers: authHeaders });
          console.log('Create response:', response.data);
          
          // Add the new lookup with the server-generated ID to the local state
          const newLookup = {
            ...lookup,
            ...response.data
          };
          
          // Get the new lookup with the server-generated ID
          const newLookupWithId = {
            ...lookup,
            ...response.data
          };
          
          // Replace any temporary item with the same content or remove duplicates
          const updatedLookups = lookups
            .filter(item => 
              // Keep items with IDs that are different from our new item
              (item.FIELD_LOOKUP_ID && item.FIELD_LOOKUP_ID !== newLookupWithId.FIELD_LOOKUP_ID) ||
              // Or keep temporary items that don't match our new item
              (!item.FIELD_LOOKUP_ID && 
               (item.LOOKUP_CODE !== lookup.LOOKUP_CODE || 
                item.LOOKUP_DESCRIPTION !== lookup.LOOKUP_DESCRIPTION))
            );
          
          // Add the new lookup with the server response
          console.log('Setting lookups with new item:', [...updatedLookups, newLookupWithId]);
          setLookups([...updatedLookups, newLookupWithId]);
          toast.success('Lookup value created successfully');
        } catch (error: any) {
          console.error('Create error details:', error.response?.data || error.message);
          toast.error(`Failed to create lookup: ${error.response?.data?.error || error.message}`);
        }
      }
    } catch (error) {
      console.error('Error saving lookup:', error);
      toast.error('Failed to save lookup value');
      // Refresh the grid to revert changes
      fetchLookups();
    }
  };

  // Track if a delete operation is in progress
  const isDeleting = React.useRef(false);

  // Function to open the confirmation modal
  const openDeleteConfirmation = (lookup: FieldLookup) => {
    setLookupToDelete(lookup);
    setIsConfirmModalOpen(true);
  };

  // Function to close the confirmation modal
  const closeConfirmModal = () => {
    setIsConfirmModalOpen(false);
    setLookupToDelete(null);
  };

  // Delete a lookup value
  const handleDelete = async () => {
    // Make sure we have a lookup to delete
    if (!lookupToDelete) return;

    // Prevent multiple delete operations
    if (isDeleting.current) {
      console.log('Delete operation already in progress, skipping');
      return;
    }

    try {
      // Set deleting flag to true
      isDeleting.current = true;
      
      if (!lookupToDelete.FIELD_LOOKUP_ID) {
        // If it's a new row that hasn't been saved yet
        setLookups(lookups.filter(item => item !== lookupToDelete));
        toast.success('Lookup value deleted successfully');
        isDeleting.current = false;
        return;
      }

      console.log(`Deleting lookup with ID: ${lookupToDelete.FIELD_LOOKUP_ID}`);
      
      try {
        // Optimistically update the UI first for better responsiveness
        setLookups(lookups.filter(item => item.FIELD_LOOKUP_ID !== lookupToDelete.FIELD_LOOKUP_ID));
        setFilteredLookups(filteredLookups.filter(item => item.FIELD_LOOKUP_ID !== lookupToDelete.FIELD_LOOKUP_ID));
        
        // Then perform the actual deletion
        await axios.delete(`/api/field-lookups/${lookupToDelete.FIELD_LOOKUP_ID}`, { headers: authHeaders });
        
        // Show success toast message
        toast.success('Lookup value deleted successfully');
      } catch (error: any) {
        console.error('Delete error details:', error.response?.data || error.message);
        
        // If server delete fails but it's a 404 (not found), we can assume it's already gone
        if (error.response?.status === 404) {
          toast.info('Lookup value was already deleted or not found');
        } else {
          // Revert the optimistic update if there was an error
          fetchLookups(); // Refresh from server to ensure consistency
          toast.error(`Failed to delete lookup: ${error.response?.data?.error || error.message}`);
        }
      } finally {
        isDeleting.current = false;
      }
    } catch (error) {
      console.error('Error in delete handler:', error);
      toast.error('Failed to process delete request');
      isDeleting.current = false;
    }
  };

  // Handle cell value changes
  const onCellValueChanged = (event: CellValueChangedEvent) => {
    console.log('Cell value changed:', event.data);
    saveLookup(event.data);
  };

  // Handle grid ready event
  const onGridReady = (params: GridReadyEvent) => {
    // Store the grid API reference for later use
    gridApiRef.current = params.api;
  };

  // Reference to the grid API
  const gridApiRef = React.useRef<any>(null);

  // Add a new empty row to the grid at the top
  const addNewRow = () => {
    // Generate a temporary unique identifier to track this row
    const tempId = `temp_${Date.now()}`;
    
    const newLookup: FieldLookup = {
      FIELD_ID: fieldId,
      LOOKUP_CODE: '',
      LOOKUP_DESCRIPTION: '',
      SORT_ORDER: lookups.length > 0 ? Math.max(...lookups.map(l => l.SORT_ORDER || 0)) + 1 : 1, // Higher sort order to place at bottom
      // Add a temporary property to identify this row (won't be sent to server)
      tempId: tempId
      // IS_ACTIVE field removed as requested
    } as FieldLookup & { tempId?: string };
    
    // Add the new row to the top of the grid
    const updatedLookups = [newLookup, ...lookups];
    console.log('Adding new row with tempId:', tempId);
    setLookups(updatedLookups);
    
    // Make sure filtered lookups is updated if no search is active
    if (!searchTerm.trim()) {
      setFilteredLookups(updatedLookups);
    } else {
      // Re-apply the filter with the new row
      const filtered = updatedLookups.filter(lookup => 
        lookup.LOOKUP_CODE.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lookup.LOOKUP_DESCRIPTION.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLookups(filtered);
    }
    
    // Scroll to top after state update
    setTimeout(() => {
      if (gridApiRef.current) {
        gridApiRef.current.ensureIndexVisible(0, 'top');
      }
    }, 100);
  };

  // Load lookups on component mount and when fieldId changes
  useEffect(() => {
    console.log('Component mounted or fieldId changed, fetching lookups...');
    // Only fetch if we have a valid fieldId
    if (fieldId) {
      fetchLookups();
    }
    
    // Debug: Log current state after a delay
    const timer = setTimeout(() => {
      console.log('Current state after delay:');
      console.log('fieldId:', fieldId);
      console.log('lookups:', lookups);
      console.log('filteredLookups:', filteredLookups);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [fetchLookups, fieldId]);

  // Filter lookups based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      // If search term is empty, show all lookups
      setFilteredLookups(lookups);
    } else {
      // Filter lookups based on search term (case-insensitive)
      const filtered = lookups.filter(lookup => 
        (lookup.LOOKUP_CODE || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lookup.LOOKUP_DESCRIPTION || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLookups(filtered);
    }
  }, [lookups, searchTerm]);

  return (
    <div className="w-full">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={closeConfirmModal}
        onConfirm={() => {
          handleDelete();
          closeConfirmModal();
        }}
        title="Confirm Delete"
        message={`Are you sure you want to delete this lookup value${lookupToDelete ? ` (${lookupToDelete.LOOKUP_CODE || 'New'})` : ''}?`}
        confirmText="Delete"
        cancelText="Cancel"
      />

      <div className="flex items-center mb-4 gap-4">
        {/* Left side: Header */}
        <h2 className="text-lg font-medium text-gray-900 whitespace-nowrap">Lookup Values</h2>
        
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
              className="sg-button-icon absolute right-3 top-1/2 transform -translate-y-1/2"
              data-component-name="AdminFieldLookups"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        
        {/* Right side: Add button */}
        <button
          type="button"
          onClick={addNewRow}
          className="sg-button-primary inline-flex items-center whitespace-nowrap"
          data-component-name="AdminFieldLookups"
        >
          Add New Lookup
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Show search result count when filtering */}
          {searchTerm && (
            <div className="mb-2 text-sm text-gray-600">
              Found {filteredLookups.length} {filteredLookups.length === 1 ? 'result' : 'results'}
              {filteredLookups.length === 0 && searchTerm && (
                <span key="search-no-results"> for "{searchTerm}". <button onClick={() => setSearchTerm('')} className="sg-button-text" data-component-name="AdminFieldLookups">Clear search</button></span>
              )}
            </div>
          )}
          
          <div className="ag-theme-alpine" style={{ height: '400px', width: '100%' }}>
            <AgGridReact
              rowData={filteredLookups}
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
        </>
      )}
    </div>
  );
};

export default AdminFieldsLookup;

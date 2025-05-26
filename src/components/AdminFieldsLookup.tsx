import React, { useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community';
// Import all modules from ag-grid-community instead of using the separate packages
import axios from 'axios';
import { toast } from 'react-toastify';
import { Trash2 } from 'lucide-react';
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
  // IS_ACTIVE field removed as requested
}

const AdminFieldsLookup: React.FC<AdminFieldsLookupProps> = ({ fieldId }) => {
  const [lookups, setLookups] = useState<FieldLookup[]>([]);
  const [filteredLookups, setFilteredLookups] = useState<FieldLookup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Column definitions with editable cells
  const columnDefs: ColDef[] = [
    { 
      field: 'LOOKUP_CODE', 
      headerName: 'Code', 
      editable: true,
      sortable: true,
      filter: 'text',
      width: 150
    },
    { 
      field: 'LOOKUP_DESCRIPTION', 
      headerName: 'Description', 
      editable: true,
      sortable: true,
      filter: 'text',
      flex: 1
    },
    { 
      field: 'SORT_ORDER', 
      headerName: 'Sort Order', 
      editable: true,
      sortable: true,
      filter: 'number',
      width: 100,
      cellEditor: 'agNumberCellEditor',
      valueParser: (params) => {
        return Number(params.newValue);
      }
    },
    // Active column removed as requested
    {
      headerName: 'Actions',
      width: 120,
      cellRenderer: (params: any) => {
        return (
          <button
            onClick={() => handleDelete(params.data)}
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
    suppressMovable: true,
    suppressSizeToFit: true, // Prevent columns from auto-resizing
    headerClass: 'ag-header-cell-tall'
  };

  // Fetch lookups for the specified field
  const fetchLookups = useCallback(async () => {
    if (!fieldId) return;
    
    setIsLoading(true);
    try {
      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // This endpoint should be in the fields.ts file, not field-lookups.ts
      const response = await axios.get(`/api/fields/${fieldId}/lookups`, { headers });
      console.log('Fetched lookups:', response.data);
      if (response.data && Array.isArray(response.data)) {
        setLookups(response.data);
      }
    } catch (error) {
      console.error('Error fetching field lookups:', error);
      toast.error('Failed to load lookup values');
    } finally {
      setIsLoading(false);
    }
  }, [fieldId]);

  // Save a lookup value (create or update)
  const saveLookup = async (lookup: FieldLookup) => {
    try {
      // Ensure we have the required fields
      if (!lookup.LOOKUP_DESCRIPTION) {
        toast.warning('Description is required');
        return;
      }

      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Handle creation and updates differently
      if (lookup.FIELD_LOOKUP_ID && typeof lookup.FIELD_LOOKUP_ID === 'number' && lookup.FIELD_LOOKUP_ID > 0) {
        // Update existing lookup
        console.log('Updating existing lookup:', lookup);
        
        // Create a clean payload with only the fields needed by the server
        const updatePayload = {
          LOOKUP_CODE: lookup.LOOKUP_CODE || '',
          LOOKUP_DESCRIPTION: lookup.LOOKUP_DESCRIPTION,
          SORT_ORDER: typeof lookup.SORT_ORDER === 'number' ? lookup.SORT_ORDER : 0
        };
        
        try {
          // Use the correct URL format for the update endpoint
          const updateUrl = `/api/field-lookups/${lookup.FIELD_LOOKUP_ID}`;
          console.log(`Sending PUT request to: ${updateUrl}`);
          
          const response = await axios.put(updateUrl, updatePayload, { headers });
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
          SORT_ORDER: typeof lookup.SORT_ORDER === 'number' ? lookup.SORT_ORDER : lookups.length
        };
        
        try {
          const response = await axios.post('/api/field-lookups', createPayload, { headers });
          console.log('Create response:', response.data);
          
          // Add the new lookup with the server-generated ID to the local state
          const newLookup = {
            ...lookup,
            ...response.data
          };
          
          setLookups([...lookups, newLookup]);
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

  // Delete a lookup value
  const handleDelete = async (lookup: FieldLookup) => {
    if (!lookup.FIELD_LOOKUP_ID) {
      // If it's a new row that hasn't been saved yet
      setLookups(lookups.filter(item => item !== lookup));
      return;
    }

    try {
      // Get the authentication token from localStorage
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      console.log(`Deleting lookup with ID: ${lookup.FIELD_LOOKUP_ID}`);
      
      try {
        await axios.delete(`/api/field-lookups/${lookup.FIELD_LOOKUP_ID}`, { headers });
        setLookups(lookups.filter(item => item.FIELD_LOOKUP_ID !== lookup.FIELD_LOOKUP_ID));
        toast.success('Lookup value deleted successfully');
      } catch (error: any) {
        console.error('Delete error details:', error.response?.data || error.message);
        
        // If server delete fails but it's a 404 (not found), we can assume it's already gone
        if (error.response?.status === 404) {
          setLookups(lookups.filter(item => item.FIELD_LOOKUP_ID !== lookup.FIELD_LOOKUP_ID));
          toast.info('Lookup value was already deleted or not found');
        } else {
          toast.error(`Failed to delete lookup: ${error.response?.data?.error || error.message}`);
        }
      }
    } catch (error) {
      console.error('Error in delete handler:', error);
      toast.error('Failed to process delete request');
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
    const newLookup: FieldLookup = {
      FIELD_ID: fieldId,
      LOOKUP_CODE: '',
      LOOKUP_DESCRIPTION: '',
      SORT_ORDER: 0 // Lower sort order to place at top
      // IS_ACTIVE field removed as requested
    };
    
    // Add the new row to the top of the grid
    setLookups([newLookup, ...lookups]);
    
    // Scroll to top after state update
    setTimeout(() => {
      if (gridApiRef.current) {
        gridApiRef.current.ensureIndexVisible(0, 'top');
      }
    }, 100);
  };

  // Load lookups on component mount and when fieldId changes
  useEffect(() => {
    fetchLookups();
  }, [fetchLookups, fieldId]);

  // Filter lookups based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      // If search term is empty, show all lookups
      setFilteredLookups(lookups);
    } else {
      // Filter lookups based on search term (case-insensitive)
      const filtered = lookups.filter(lookup => 
        lookup.LOOKUP_CODE.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lookup.LOOKUP_DESCRIPTION.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLookups(filtered);
    }
  }, [lookups, searchTerm]);

  return (
    <div className="w-full">
      <div className="flex items-center mb-4 gap-4">
        {/* Left side: Header */}
        <h2 className="text-lg font-medium text-gray-900 whitespace-nowrap">Lookup Values</h2>
        
        {/* Middle: Search filter */}
        <div className="flex-grow relative">
          <input
            type="text"
            placeholder="Search by code or description..."
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
        
        {/* Right side: Add button */}
        <button
          type="button"
          onClick={addNewRow}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary whitespace-nowrap"
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
                <span> for "{searchTerm}". <button onClick={() => setSearchTerm('')} className="text-primary hover:underline">Clear search</button></span>
              )}
            </div>
          )}
          
          <div className="ag-theme-alpine w-full" style={{ height: '400px' }}>
            <AgGridReact
              rowData={filteredLookups}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              onGridReady={onGridReady}
              onCellValueChanged={onCellValueChanged}
              editType="fullRow"
              suppressClickEdit={false}
              stopEditingWhenCellsLoseFocus={true}
              rowSelection="single"
              headerHeight={48}
              rowHeight={40}
              pagination={false}
              paginationPageSize={10}
              paginationAutoPageSize={false}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminFieldsLookup;

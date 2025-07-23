import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import AdminFieldsLookup from './AdminFieldLookups';
import axios from 'axios';
import { toast } from 'react-toastify';
// AG Grid imports - using latest version 33.3.0
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, GridApi } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
// Import styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import '../styles/ag-grid-custom.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const AdminFields: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // State for fields and loading indicator
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicFieldTypes, setDynamicFieldTypes] = useState<any[]>([]);
  const [lookupDisplayTypes, setLookupDisplayTypes] = useState<any[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authHeaders, setAuthHeaders] = useState<{[key: string]: string}>({});
  
  // State for search/filter functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFields, setFilteredFields] = useState<any[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<any>(null);
  const [currentField, setCurrentField] = useState<any>(null);

  // State for form
  const [formData, setFormData] = useState({
    FIELD_NAME: '',
    FIELD_TYPE_ID: '',
    REQUIRED: false,
    IS_ACTIVE: true,
    IS_DELETED: false,
    HAS_LOOKUP: false,
    DISPLAY_FORMAT: '',
    IS_PUBLIC: false,
    IS_SENSITIVE: false,
    CAN_SELECT_MULIPLE: false,
    FIELD_LOOKUP_DISPLAY_TYPE_ID: null,
    ORGANIZATION_ID: null
  });

  // Reference to the AG Grid API
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Custom cell renderer for Required column
  const RequiredCellRenderer = (props: any) => {
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
        >
          <FaEdit size={16} />
        </button>
        <button
          className="text-red-600 hover:text-red-800"
          onClick={() => openDeleteConfirmation(props.data)}
        >
          <FaTrash size={16} />
        </button>
      </div>
    );
  };

  // AG Grid Column Definitions with custom cell renderers
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'FIELD_ID',
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
      field: 'FIELD_NAME',
      headerName: 'Field Name',
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
      field: 'FIELD_TYPE_ID',
      headerName: 'Type',
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
        // Handle both object and primitive field type values
        if (params.data.FIELD_TYPE && typeof params.data.FIELD_TYPE === 'object') {
          return params.data.FIELD_TYPE.FIELD_TYPE_ID;
        }
        return params.data.FIELD_TYPE_ID;
      },
      cellRenderer: (params: any) => {
        // Define color classes for different field types
        const typeClasses: { [key: string]: string } = {
          'Text': 'bg-blue-100 text-blue-800',
          'Email': 'bg-purple-100 text-purple-800',
          'Phone': 'bg-green-100 text-green-800',
          'Date': 'bg-yellow-100 text-yellow-800',
          'TextArea': 'bg-pink-100 text-pink-800'
        };

        let fieldTypeId = params.value;
        let displayName = params.value;

        // Check if we have the field type object directly in the data
        if (params.data.FIELD_TYPE && typeof params.data.FIELD_TYPE === 'object') {
          displayName = params.data.FIELD_TYPE.FIELD_TYPE_DESC;
          fieldTypeId = params.data.FIELD_TYPE.FIELD_TYPE_ID;
        } else {
          // Try to find the field type in the dynamic types by ID
          const fieldType = dynamicFieldTypes.find(type =>
            type.FIELD_TYPE_ID.toString() === fieldTypeId.toString()
          );

          if (fieldType) {
            displayName = fieldType.FIELD_TYPE_DESC;
          }
        }

        // Get class based on the display name or default to gray
        const className = typeClasses[displayName] || 'bg-gray-100 text-gray-800';

        return (
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>
            {displayName}
          </div>
        );
      }
    },
    {
      field: 'REQUIRED',
      headerName: 'Required',
      sortable: true,
      filter: true,
      width: 120,
      cellRenderer: RequiredCellRenderer,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      field: 'IS_ACTIVE',
      headerName: 'Active',
      sortable: true,
      filter: true,
      width: 120,
      cellRenderer: (params: any) => {
        return (
          <div className="flex justify-center items-center h-full">
            {params.value ?
              <FaCheck className="text-green-500" /> :
              <FaTimes className="text-red-500" />
            }
          </div>
        );
      },
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      field: 'HAS_LOOKUP',
      headerName: 'Has Lookup',
      sortable: true,
      filter: true,
      width: 120,
      alignHeader: 'center',
      align: 'center',
      cellRenderer: (params: any) => {
        return (
          <div className="flex justify-center items-center h-full">
            {params.value ?
              <FaCheck className="text-green-500" /> :
              <FaTimes className="text-red-500" />
            }
          </div>
        );
      },
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      field: 'IS_DELETED',
      headerName: 'Deleted',
      sortable: true,
      filter: true,
      width: 120,
      cellRenderer: (params: any) => {
        return (
          <div className="flex justify-center items-center h-full">
            {params.value ?
              <FaTimes className="text-red-500" /> :
              <FaCheck className="text-green-500" />
            }
          </div>
        );
      },
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered',
      filterParams: {
        buttons: ['reset', 'apply'],
        closeOnApply: true
      }
    },
    {
      headerName: 'Actions',
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      width: 120,
      headerClass: 'ag-header-cell-centered',
      cellClass: 'ag-cell-centered'
    }
  ], []);

  // Default column definitions used in the AgGridReact component
  const defaultColDef = {
    flex: 1,
    minWidth: 100,
    filter: true,
    sortable: true,
    resizable: true
  };

  // Open modal for adding a new field
  const openAddModal = useCallback(() => {
    setCurrentField(null);
    // Set default field type to the first available type from API or empty if none available
    const defaultFieldType = dynamicFieldTypes.length > 0 ? dynamicFieldTypes[0].FIELD_TYPE_ID : '';
    setFormData({
      FIELD_NAME: '',
      FIELD_TYPE_ID: defaultFieldType,
      REQUIRED: false,
      IS_ACTIVE: true,
      IS_DELETED: false,
      HAS_LOOKUP: false,
      DISPLAY_FORMAT: '',
      IS_PUBLIC: false,
      IS_SENSITIVE: false,
      CAN_SELECT_MULIPLE: false,
      FIELD_LOOKUP_DISPLAY_TYPE_ID: null,
      ORGANIZATION_ID: null
    });
    // Open modal
    setIsModalOpen(true);
  }, [dynamicFieldTypes]);

  // Handle edit action
  const handleEdit = useCallback((field: any) => {
    console.log('Editing field:', field);
    setCurrentField(field);

    // Ensure FIELD_TYPE_ID is properly handled
    // It could be a number or an object with FIELD_TYPE_ID property
    const fieldTypeId = typeof field.FIELD_TYPE_ID === 'object' && field.FIELD_TYPE_ID !== null
      ? field.FIELD_TYPE_ID.FIELD_TYPE_ID
      : field.FIELD_TYPE_ID;

    const hasLookup = field.HAS_LOOKUP || false;

    setFormData({
      FIELD_NAME: field.FIELD_NAME,
      FIELD_TYPE_ID: fieldTypeId,
      REQUIRED: field.REQUIRED || field.IS_REQUIRED || false,
      IS_ACTIVE: field.IS_ACTIVE !== undefined ? field.IS_ACTIVE : true,
      IS_DELETED: field.IS_DELETED || false,
      HAS_LOOKUP: hasLookup,
      DISPLAY_FORMAT: field.DISPLAY_FORMAT || '',
      IS_PUBLIC: field.IS_PUBLIC || false,
      IS_SENSITIVE: field.IS_SENSITIVE || false,
      CAN_SELECT_MULIPLE: field.CAN_SELECT_MULIPLE || false,
      FIELD_LOOKUP_DISPLAY_TYPE_ID: field.FIELD_LOOKUP_DISPLAY_TYPE_ID || null,
      ORGANIZATION_ID: field.ORGANIZATION_ID || null
    });

    console.log('Form data set to:', {
      FIELD_NAME: field.FIELD_NAME,
      FIELD_TYPE_ID: fieldTypeId,
      REQUIRED: field.REQUIRED || field.IS_REQUIRED || false,
      IS_ACTIVE: field.IS_ACTIVE !== undefined ? field.IS_ACTIVE : true,
      HAS_LOOKUP: hasLookup,
      DISPLAY_FORMAT: field.DISPLAY_FORMAT || '',
      IS_PUBLIC: field.IS_PUBLIC || false,
      IS_SENSITIVE: field.IS_SENSITIVE || false,
      CAN_SELECT_MULIPLE: field.CAN_SELECT_MULIPLE || false,
      FIELD_LOOKUP_DISPLAY_TYPE_ID: field.FIELD_LOOKUP_DISPLAY_TYPE_ID || null,
      ORGANIZATION_ID: field.ORGANIZATION_ID || null
    });

    // Open modal
    setIsModalOpen(true);
  }, []);

  // Open confirmation modal for delete
  const openDeleteConfirmation = useCallback((field: any) => {
    setFieldToDelete(field);
    setIsConfirmModalOpen(true);
  }, []);

  // Handle delete action
  const handleDelete = useCallback(async () => {
    if (!fieldToDelete) return;

    try {
      setIsLoading(true);

      if (!authToken) {
        console.error('No authentication token found');
        toast.error('Authentication required. Please log in again.');
        setIsLoading(false);
        return;
      }

      // Make API call to delete the field
      try {
        await axios.delete(`/api/fields/${fieldToDelete.FIELD_ID}`, { headers: authHeaders });
        
        // Close the confirmation modal
        setIsConfirmModalOpen(false);
        
        // Show success message
        toast.success(`Field ${fieldToDelete.FIELD_NAME} deleted successfully`);
        
        // Refresh the fields to ensure we have the latest data
        // Don't update local state manually, just fetch fresh data
        await fetchFields();
      } catch (error: any) {
        console.error('Error deleting field:', error);

        if (error.response && error.response.status === 401) {
          toast.error('Your session has expired. Please log in again.');
        } else {
          toast.error('Failed to delete field. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Unexpected error in delete operation:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  }, [fieldToDelete, authToken, authHeaders]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const isChecked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : false;

    // Create updated form data
    const updatedFormData = {
      ...formData,
      [name]: type === 'checkbox' ? isChecked : value
    };

    // Special handling for HAS_LOOKUP
    if (name === 'HAS_LOOKUP') {
      // If HAS_LOOKUP is unchecked, also uncheck CAN_SELECT_MULIPLE
      if (!isChecked) {
        updatedFormData.CAN_SELECT_MULIPLE = false;
      }
    }

    setFormData(updatedFormData);
  };

  // Handle form submission

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.FIELD_NAME.trim()) {
      toast.error('Field name is required');
      return;
    }

    if (!formData.FIELD_TYPE_ID) {
      toast.error('Field type is required');
      return;
    }

    // Show loading indicator
    setIsLoading(true);

    try {
      // Ensure FIELD_TYPE_ID is a number
      const processedFormData = {
        ...formData,
        FIELD_TYPE_ID: parseInt(formData.FIELD_TYPE_ID.toString())
      };

      console.log('Processed form data:', processedFormData);
      
      if (!authToken) {
        console.error('No authentication token found');
        toast.error('Authentication required. Please log in again.');
        setIsLoading(false);
        return;
      }

      if (currentField) {
        // Update existing field
        const updatedField = {
          ...currentField,
          ...processedFormData
        };

        // Make API call to update field
        await axios.put(`/api/fields/${currentField.FIELD_ID}`, updatedField, { headers: authHeaders });

        // Update local state
        setFields(prevFields =>
          prevFields.map(field =>
            field.FIELD_ID === currentField.FIELD_ID
              ? updatedField
              : field
          )
        );
        toast.success(`Field ${formData.FIELD_NAME} updated successfully`);
      } else {
        // Add new field
        const newField = {
          FIELD_ID: Math.max(0, ...fields.map(f => f.FIELD_ID)) + 1,
          ...processedFormData
        };

        // Make API call to create field
        const response = await axios.post('/api/fields', newField, { headers: authHeaders });
        const createdField = response.data;

        // Update local state with the returned field (which should have an ID)
        setFields(prevFields => [...prevFields, createdField]);
        toast.success(`Field ${formData.FIELD_NAME} added successfully`);
      }

      // Close modal and reset form
      setIsModalOpen(false);

      // Refresh the fields from the server to ensure we have the latest data
      fetchFields();
    } catch (error: any) {
      console.error('Error saving field:', error);

      if (error.response && error.response.status === 401) {
        toast.error('Your session has expired. Please log in again.');
      } else {
        toast.error('Failed to save field. Please try again.');
      }
    } finally {
      setIsLoading(false);
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
      setAuthHeaders({ 'Authorization': `Bearer ${token}` });
    } else {
      console.error('No authentication token found');
      toast.error('Authentication required. Please log in again.');
    }
  }, []);

  // Fetch data when auth token is available
  useEffect(() => {
    if (authToken) {
      fetchFields();
      fetchFieldTypes();
      fetchLookupDisplayTypes();
    }
  }, [authToken]);

  // Filter fields based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      // If search term is empty, show all fields
      setFilteredFields(fields);
    } else {
      // Filter fields based on search term (case-insensitive)
      const filtered = fields.filter(field => 
        field.FIELD_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (field.FIELD_TYPE?.FIELD_TYPE_DESC || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredFields(filtered);
    }
  }, [fields, searchTerm]);

  // Fetch field types from API
  const fetchFieldTypes = async () => {
    try {
      if (!authToken) {
        console.error('No authentication token found');
        return;
      }

      const response = await axios.get('/api/field-types', { headers: authHeaders });

      if (response.data && response.data.length > 0) {
        setDynamicFieldTypes(response.data);
      }
    } catch (error) {
      console.error('Error fetching field types:', error);
    }
  };

  // Fetch lookup display types from API
  const fetchLookupDisplayTypes = async () => {
    try {
      if (!authToken) {
        console.error('No authentication token found');
        return;
      }

      const response = await axios.get('/api/field-lookup-display-types', { headers: authHeaders });

      if (response.data && response.data.length > 0) {
        setLookupDisplayTypes(response.data);
      }
    } catch (error) {
      console.error('Error fetching lookup display types:', error);
      // Fallback to default options if API fails
      setLookupDisplayTypes([
        { FIELD_LOOKUP_DISPLAY_TYPE_ID: 1, DISPLAY_TYPE_DESC: 'Dropdown List' },
        { FIELD_LOOKUP_DISPLAY_TYPE_ID: 2, DISPLAY_TYPE_DESC: 'Radio Buttons' },
        { FIELD_LOOKUP_DISPLAY_TYPE_ID: 3, DISPLAY_TYPE_DESC: 'Checkboxes' },
        { FIELD_LOOKUP_DISPLAY_TYPE_ID: 4, DISPLAY_TYPE_DESC: 'Multi-select List' },
        { FIELD_LOOKUP_DISPLAY_TYPE_ID: 5, DISPLAY_TYPE_DESC: 'Button Group' }
      ]);
    }
  };

  const fetchFields = async () => {
    setIsLoading(true);
    // Try to fetch from API
    try {
      if (!authToken) {
        console.error('No authentication token found');
        toast.error('Authentication required. Please log in again.');
        return;
      }

      const response = await axios.get('/api/fields', { headers: authHeaders });

      console.log('API Response:', response.data);
      if (response.data && response.data.length > 0) {
        // Log the structure of the first field to understand the data format
        console.log('Field structure example:', response.data[0]);

        // Process fields to ensure FIELD_TYPE_ID is properly formatted
        const processedFields = response.data.map((field: any) => {
          // Check if FIELD_TYPE_ID is an object with FIELD_TYPE_ID property
          if (field.FIELD_TYPE && typeof field.FIELD_TYPE === 'object') {
            console.log('Field type is an object:', field.FIELD_TYPE);
            return {
              ...field,
              FIELD_TYPE_ID: field.FIELD_TYPE.FIELD_TYPE_ID
            };
          }
          return field;
        });

        console.log('Processed fields:', processedFields);
        setFields(processedFields);
      } else {
        // If API returns empty array, set empty fields
        setFields([]);
      }
    } catch (apiError: any) {
      console.error('API Error:', apiError);

      if (apiError.response && apiError.response.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        // Optionally redirect to login page
        // navigate('/login');
      } else {
        toast.error('Failed to load fields. Please try again later.');
        // Initialize with empty array if API fails
        setFields([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect if user is not authenticated or doesn't have admin role
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  const isAdmin = user.roles?.some((role: any) => role.id === 1 || role.id === 6) ||
    user.role === '1' || user.role === '6';

  if (!isAdmin) return <Navigate to="/home" />;

  // Fallback field types for dropdown if API fails
  const fieldTypes = [
    { id: 'Text', name: 'Text' },
    { id: 'Email', name: 'Email' },
    { id: 'Phone', name: 'Phone' },
    { id: 'Date', name: 'Date' },
    { id: 'TextArea', name: 'Text Area' },
    { id: 'Number', name: 'Number' },
    { id: 'Select', name: 'Select' }
  ];

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
            <h1 className="text-2xl font-bold text-gray-900">Field Management</h1>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* Grid header with search filter and Add button */}
          <div className="flex items-center mb-6 gap-4">
            {/* Left side: Header */}
            <h2 className="text-lg font-semibold text-gray-800 whitespace-nowrap">Field Definitions</h2>
            
            {/* Middle: Search filter */}
            <div className="flex-grow relative flex justify-center items-center">
              <input
                type="text"
                placeholder="Filter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              onClick={openAddModal}
            >
              <FaPlus className="mr-2" /> Add New Field
            </button>
          </div>
          
          {/* Show search result count when filtering */}
          {searchTerm && (
            <div className="mb-2 text-sm text-gray-600">
              Found {filteredFields.length} {filteredFields.length === 1 ? 'result' : 'results'}
              {filteredFields.length === 0 && searchTerm && (
                <span> for "{searchTerm}". <button onClick={() => setSearchTerm('')} className="text-primary hover:underline">Clear search</button></span>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredFields.length === 0 && !searchTerm ? (
            <div className="text-center py-8 text-gray-500">
              <p>No fields found. Add your first field to get started.</p>
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
                rowData={filteredFields.length > 0 || searchTerm ? filteredFields : fields}
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

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleDelete}
        title="Confirm Delete"
        message={fieldToDelete ? `Are you sure you want to delete the field: ${fieldToDelete.FIELD_NAME}?` : 'Are you sure you want to delete this field?'}
        confirmText="Delete"
        cancelText="Cancel"
      />
      
      {/* Modal for adding/editing fields */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              {/* Modal Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {currentField ? 'Edit Field' : 'Add New Field'}
                </h3>
              </div>

              {/* Modal Body */}
              <div className="px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4">
                <form onSubmit={handleSubmit}>
                  {/* Form Fields - Two column layout when HAS_LOOKUP is true */}
                  <div className="flex flex-col md:flex-row md:space-x-6">
                    {/* Left column - Main form fields */}
                    <div className={`${formData.HAS_LOOKUP ? 'md:w-1/3' : 'w-full'}`}>
                      <div className="grid grid-cols-1 gap-4 mb-6">
                        {/* Field Name */}
                        <div>
                          <label htmlFor="fieldName" className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
                          <input
                            type="text"
                            id="fieldName"
                            name="FIELD_NAME"
                            value={formData.FIELD_NAME}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter field name"
                            required
                          />
                        </div>

                        {/* Field Type */}
                        <div>
                          <label htmlFor="fieldType" className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                          <select
                            id="fieldType"
                            name="FIELD_TYPE_ID"
                            value={formData.FIELD_TYPE_ID}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            required
                          >
                            <option value="">Select a type</option>
                            {dynamicFieldTypes.length > 0 ? (
                              dynamicFieldTypes.map((type) => (
                                <option key={type.FIELD_TYPE_ID} value={type.FIELD_TYPE_ID}>
                                  {type.FIELD_TYPE_DESC}
                                </option>
                              ))
                            ) : (
                              fieldTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                  {type.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {/* Display Format */}
                        <div>
                          <label htmlFor="displayFormat" className="block text-sm font-medium text-gray-700 mb-1">Display Format</label>
                          <input
                            type="text"
                            id="displayFormat"
                            name="DISPLAY_FORMAT"
                            value={formData.DISPLAY_FORMAT}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., MM/DD/YYYY for dates"
                          />
                        </div>

                        {/* Lookup Display Type - only show when HAS_LOOKUP is true */}
                        {formData.HAS_LOOKUP && (
                          <div>
                            <label htmlFor="lookupDisplayType" className="block text-sm font-medium text-gray-700 mb-1">Lookup Display Type</label>
                            <select
                              id="lookupDisplayType"
                              name="FIELD_LOOKUP_DISPLAY_TYPE_ID"
                              value={formData.FIELD_LOOKUP_DISPLAY_TYPE_ID || ''}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Select display type</option>
                              {lookupDisplayTypes.map((type) => (
                                <option key={type.FIELD_LOOKUP_DISPLAY_TYPE_ID} value={type.FIELD_LOOKUP_DISPLAY_TYPE_ID}>
                                  {type.DISPLAY_TYPE_DESC}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Checkboxes */}
                      <div className="space-y-3 mb-6">
                        <label htmlFor="isRequired" className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="isRequired"
                            name="REQUIRED"
                            checked={formData.REQUIRED}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Required Field</span>
                        </label>

                        <label htmlFor="isActive" className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="isActive"
                            name="IS_ACTIVE"
                            checked={formData.IS_ACTIVE}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active Field</span>
                        </label>

                        <label htmlFor="isPublic" className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="isPublic"
                            name="IS_PUBLIC"
                            checked={formData.IS_PUBLIC}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Public Field</span>
                        </label>

                        <label htmlFor="isSensitive" className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="isSensitive"
                            name="IS_SENSITIVE"
                            checked={formData.IS_SENSITIVE}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Sensitive Data</span>
                        </label>

                        <label htmlFor="isDeleted" className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="isDeleted"
                            name="IS_DELETED"
                            checked={formData.IS_DELETED}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Mark as Deleted</span>
                        </label>

                        <label htmlFor="hasLookup" className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="hasLookup"
                            name="HAS_LOOKUP"
                            checked={formData.HAS_LOOKUP}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Has Lookup Values</span>
                        </label>

                        {formData.HAS_LOOKUP && (
                          <label
                            htmlFor="canSelectMultiple"
                            className={`flex items-center ${formData.HAS_LOOKUP ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                          >
                            <input
                              type="checkbox"
                              id="canSelectMultiple"
                              name="CAN_SELECT_MULIPLE"
                              checked={formData.CAN_SELECT_MULIPLE}
                              onChange={handleInputChange}
                              disabled={!formData.HAS_LOOKUP}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">Allow Multiple Selection</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Right column - Lookup Values (only shown when HAS_LOOKUP is checked) */}
                    {formData.HAS_LOOKUP && (
                      <div className="md:w-2/3 mt-6 md:mt-0">
                        {currentField?.FIELD_ID ? (
                          <AdminFieldsLookup fieldId={currentField.FIELD_ID} />
                        ) : (
                          <div className="bg-gray-50 p-4 rounded-md">
                            <p className="text-sm text-gray-500">
                              Save the field first to manage lookup values.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
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
                      {currentField ? 'Update Field' : 'Add Field'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFields;

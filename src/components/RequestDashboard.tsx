import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import SendRequestForm from './SendRequestForm';
import api from '../utils/api';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const MySwal = withReactContent(Swal);

interface RequestRow {
  name: string;
  abbreviation: string;
  workflow: string;
  allowExternal: boolean;
  status: string;
}

const RequestDashboard: React.FC = () => {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<RequestRow[]>([]);

  useEffect(() => {
    api.get('/requests')
      .then(res => setRequests(res.data))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateRequest = () => {
    MySwal.fire({
      html: <SendRequestForm onSubmit={submitRequest} onCancel={() => MySwal.close()} />, // Pass submit handler
      showConfirmButton: false,
      showCancelButton: false,
      customClass: { popup: 'p-0 bg-transparent shadow-none flex items-center justify-center' },
      width: '40rem',
      background: '#f8fafc',
    });
  };

  const submitRequest = async (data: any) => {
    try {
      const res = await api.post('/requests', data);
      setRequests(prev => [...prev, res.data]);
      MySwal.close();
    } catch (err) {
      alert('Error creating request');
    }
  };

  const columnDefs = useMemo(() => [
    { headerName: 'Name', field: 'name', sortable: true, filter: true, checkboxSelection: true },
    { headerName: 'Abbreviation', field: 'abbreviation', sortable: true, filter: true },
    { headerName: 'Workflow', field: 'workflow', sortable: true, filter: true },
    { headerName: 'Allow External?', field: 'allowExternal', sortable: true, filter: true, valueFormatter: params => params.value ? 'Yes' : 'No' },
    { headerName: 'Status', field: 'status', sortable: true, filter: true },
  ], []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Request Dashboard</h2>
        <button
          className="bg-primary text-white px-4 py-2 rounded-full hover:bg-primary-dark"
          onClick={handleCreateRequest}
        >
          + New Request
        </button>
      </div>
      <div className="ag-theme-alpine rounded-lg shadow border" style={{ width: '100%', minHeight: 400 }}>
        <AgGridReact
          rowData={requests}
          columnDefs={columnDefs}
          rowSelection="multiple"
          pagination={true}
          paginationPageSize={10}
          domLayout="autoHeight"
          loadingOverlayComponentParams={{ loadingMessage: 'Loading...' }}
          onSelectionChanged={params => setSelectedRows(params.api.getSelectedRows())}
          overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading...</span>'}
        />
      </div>
      {/* Example: Show selected rows count */}
      <div className="mt-2 text-sm text-gray-500">Selected rows: {selectedRows.length}</div>
    </div>
  );
};

export default RequestDashboard;

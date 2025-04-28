import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import SendRequestForm from './SendRequestForm';
import api from '../utils/api';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ModuleRegistry } from 'ag-grid-community';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { ValidationModule } from 'ag-grid-community';
import { RowSelectionModule, PaginationModule, TextFilterModule, NumberFilterModule, DateFilterModule } from 'ag-grid-community';

// Register required ag-Grid modules
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ValidationModule,
  RowSelectionModule,
  PaginationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule
]);

const MySwal = withReactContent(Swal);

interface RequestRow {
  REQUEST_ID: string;
  REQUEST_NAME: string;
  EXTERNAL_USER: string;
  SUBMITTED_DATE: string;
  REQUESTOR_ID: string;
  ASSIGNED_ID: string;
  STATUS: string;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  CREATE_USER_ID: string;
  UPDATE_USER_ID: string;
  TRACKINGID: string;
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

  const columnDefs: ColDef[] = useMemo(() => [
    { headerName: 'Request ID', field: 'TRACKINGID', sortable: true, filter: true },
    { headerName: 'Request Name', field: 'REQUEST_NAME', sortable: true, filter: true },
    { headerName: 'External User', field: 'EXTERNAL_USER', sortable: true, filter: true },
    { headerName: 'Submitted Date', field: 'SUBMITTED_DATE', sortable: true, filter: true },
    {
      headerName: 'Requestor',
      valueGetter: params => params.data.requestor ? `${params.data.requestor.FIRST_NAME} ${params.data.requestor.LAST_NAME}` : '',
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Assigned',
      valueGetter: params => params.data.assigned ? `${params.data.assigned.FIRST_NAME} ${params.data.assigned.LAST_NAME}` : '',
      sortable: true,
      filter: true,
    },
    { headerName: 'Status', field: 'STATUS', sortable: true, filter: true },
    { headerName: 'Create Date', field: 'CREATE_DATE', sortable: true, filter: true },
    { headerName: 'Update Date', field: 'UPDATE_DATE', sortable: true, filter: true },
    { headerName: 'Create User ID', field: 'CREATE_USER_ID', sortable: true, filter: true },
    { headerName: 'Update User ID', field: 'UPDATE_USER_ID', sortable: true, filter: true }
  ], []);

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold text-uppercase fs-2">Request Dashboard</h2>
        <button
          className="btn btn-outline-primary d-flex align-items-center gap-2"
          onClick={handleCreateRequest}
        >
          + New Request
        </button>
      </div>
      <div className="ag-theme-alpine rounded-lg shadow border" style={{ width: '100%', minHeight: 400 }}>
        <AgGridReact
          rowData={requests}
          columnDefs={columnDefs}
          rowSelection={{ mode: 'multiRow', checkboxes: true }}
          pagination={true}
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 20, 50, 100]}
          domLayout="autoHeight"
          loadingOverlayComponentParams={{ loadingMessage: 'Loading...' }}
          onSelectionChanged={params => setSelectedRows(params.api.getSelectedRows())}
          overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading...</span>'}
          theme="legacy"
        />
      </div>
      {/* Example: Show selected rows count */}
      <div className="mt-2 text-sm text-gray-500">Selected rows: {selectedRows.length}</div>
    </div>
  );
};

export default RequestDashboard;

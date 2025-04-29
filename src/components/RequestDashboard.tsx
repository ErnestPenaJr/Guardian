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
  TYPE: string;
  PRIORITY: string;
  requestor: {
    FIRST_NAME: string;
    LAST_NAME: string;
  };
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
    {
      headerName: 'Status',
      field: 'STATUS',
      cellRenderer: (params: any) => {
        // Use the full status string, not just the initial
        const status = params.data.STATUS || params.value;
        let color = 'bg-teal-300';
        if (status === 'In Progress') color = 'bg-blue-400';
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${color}`}>{status}</span>
        );
      },
      width: 120,
    },
    {
      headerName: 'Requestor',
      field: 'REQUESTOR',
      valueGetter: (params: any) => {
        if (params.data.requestor) {
          return `${params.data.requestor.FIRST_NAME} ${params.data.requestor.LAST_NAME}`;
        }
        return params.data.REQUESTOR_ID || '';
      },
      cellRenderer: (params: any) => (
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="18" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>
          {params.value}
        </span>
      ),
      width: 180,
    },
    {
      headerName: 'Date/Time',
      field: 'SUBMITTED_DATE',
      valueGetter: (params: any) => {
        if (!params.value) return '';
        const date = new Date(params.value);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
      width: 170,
    },
    {
      headerName: 'Type',
      field: 'TYPE',
      width: 110,
    },
    {
      headerName: 'Priority',
      field: 'PRIORITY',
      cellRenderer: (params: any) => {
        let color = 'bg-green-300';
        if (params.value === 'Medium') color = 'bg-yellow-200';
        if (params.value === 'High') color = 'bg-red-400';
        return <span className={`inline-block w-4 h-4 rounded-full ${color}`}></span>;
      },
      width: 90,
    },
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

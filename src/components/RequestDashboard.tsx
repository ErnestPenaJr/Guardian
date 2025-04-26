import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import SendRequestForm from './SendRequestForm';
import api from '../utils/api';

const MySwal = withReactContent(Swal);

interface RequestRow {
  name: string;
  abbreviation: string;
  workflow: string;
  allowExternal: boolean;
  status: string;
}

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'abbreviation', label: 'Abbreviation' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'allowExternal', label: 'Allow External?' },
  { key: 'status', label: 'Status' },
];

const RequestDashboard: React.FC = () => {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch requests from backend
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
      background: '#f8fafc', // subtle slate-50 background for modal
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

  return (
    <div className="bg-white rounded-lg shadow p-6 md:p-8 max-w-5xl mx-auto mt-6">
      <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-900">Requests</h2>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button className="border rounded px-3 py-1 text-sm" disabled>Filter ▼</button>
          <button className="border rounded px-3 py-1 text-sm" disabled>Bulk Edit</button>
          <button className="border rounded px-3 py-1 text-sm" disabled>Export</button>
        </div>
        <button className="bg-primary text-white px-4 py-2 rounded" onClick={handleCreateRequest}>Create Request</button>
      </div>
      <table className="min-w-full border rounded">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-3 py-2 border-b text-left text-sm font-semibold">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} className="text-center py-8">Loading...</td></tr>
          ) : requests.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center py-8">No requests found.</td></tr>
          ) : (
            requests.map((row, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2 border-b">{row.name}</td>
                <td className="px-3 py-2 border-b">{row.abbreviation}</td>
                <td className="px-3 py-2 border-b">{row.workflow}</td>
                <td className="px-3 py-2 border-b">{row.allowExternal ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2 border-b">{row.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RequestDashboard;

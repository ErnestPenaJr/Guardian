import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Search, LogOut, Trash2 } from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import DataTable from 'react-data-table-component';
import Swal from 'sweetalert2';
import api from '../utils/api'; // Assuming the api is imported from a separate file

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

// Sample data for the pie chart
const pieData = {
  labels: ['Pending', 'Processed'],
  datasets: [
    {
      data: [30, 70],
      backgroundColor: ['#6C63FF', '#E0E0E0'],
      borderColor: ['#6C63FF', '#E0E0E0'],
      borderWidth: 1,
    },
  ],
};

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
    },
  },
};

// Sample data for request tables
const requestQueueColumns = [
  {
    name: 'Request ID',
    selector: (row: any) => row.id,
    sortable: true,
  },
  {
    name: 'Type',
    selector: (row: any) => row.type,
    sortable: true,
  },
  {
    name: 'Status',
    selector: (row: any) => row.status,
    sortable: true,
    cell: (row: any) => (
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
        row.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
        row.status === 'Processing' ? 'bg-blue-100 text-blue-800' : 
        'bg-green-100 text-green-800'
      }`}>
        {row.status}
      </div>
    ),
  },
  {
    name: 'Date',
    selector: (row: any) => row.date,
    sortable: true,
  },
  {
    name: 'Assigned To',
    selector: (row: any) => row.assignedTo,
    sortable: true,
  },
];

const myRequestsColumns = [
  {
    name: 'Request ID',
    selector: (row: any) => row.id,
    sortable: true,
  },
  {
    name: 'Type',
    selector: (row: any) => row.type,
    sortable: true,
  },
  {
    name: 'Status',
    selector: (row: any) => row.status,
    sortable: true,
    cell: (row: any) => (
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
        row.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
        row.status === 'Processing' ? 'bg-blue-100 text-blue-800' : 
        'bg-green-100 text-green-800'
      }`}>
        {row.status}
      </div>
    ),
  },
  {
    name: 'Date',
    selector: (row: any) => row.date,
    sortable: true,
  },
];

// Sample data
const sampleRequestQueue = [
  { id: 'REG-2025-001', type: 'Access Request', status: 'Pending', date: '2025-04-24', assignedTo: 'John Doe' },
  { id: 'PER-2025-002', type: 'Permission Change', status: 'Processing', date: '2025-04-23', assignedTo: 'Jane Smith' },
  { id: 'REG-2025-003', type: 'Access Request', status: 'Completed', date: '2025-04-22', assignedTo: 'John Doe' },
  { id: 'SYS-2025-004', type: 'System Access', status: 'Pending', date: '2025-04-21', assignedTo: 'Jane Smith' },
  { id: 'PER-2025-005', type: 'Permission Change', status: 'Completed', date: '2025-04-20', assignedTo: 'John Doe' },
];

const sampleMyRequests = [
  { id: 'REG-2025-006', type: 'Access Request', status: 'Pending', date: '2025-04-24' },
  { id: 'PER-2025-007', type: 'Permission Change', status: 'Completed', date: '2025-04-22' },
  { id: 'SYS-2025-008', type: 'System Access', status: 'Processing', date: '2025-04-20' },
  { id: 'REG-2025-009', type: 'Access Request', status: 'Completed', date: '2025-04-18' },
  { id: 'PER-2025-010', type: 'Permission Change', status: 'Pending', date: '2025-04-16' },
];

// Table styles
const customStyles = {
  table: {
    style: {
      backgroundColor: 'white',
      borderRadius: '0.5rem',
    },
  },
  headRow: {
    style: {
      backgroundColor: 'rgba(224, 224, 224, 0.2)',
      borderBottomWidth: '1px',
      borderBottomColor: '#E0E0E0',
      minHeight: '3rem',
    },
  },
  headCells: {
    style: {
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#333333',
      padding: '0.75rem 1rem',
    },
  },
  cells: {
    style: {
      fontSize: '0.875rem',
      padding: '0.75rem 1rem',
      color: '#4F4F4F',
    },
  },
  rows: {
    style: {
      backgroundColor: 'white',
      '&:hover': {
        backgroundColor: 'rgba(224, 224, 224, 0.1)',
        cursor: 'pointer',
      },
      borderBottomWidth: '1px',
      borderBottomColor: '#E0E0E0',
      minHeight: '3rem',
    },
  },
  pagination: {
    style: {
      borderTopWidth: '1px',
      borderTopColor: '#E0E0E0',
      padding: '0.5rem',
    },
  },
};

function Home() {
  const [filterText, setFilterText] = useState('');
  const navigate = useNavigate();
  
  // Get user data from localStorage
  const getUserData = () => {
    const userString = localStorage.getItem('user');
    if (userString) {
      try {
        return JSON.parse(userString);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  };

  const user = getUserData();
  
  // Format user name as first initial and last name
  const formatUserName = () => {
    if (!user) return 'User';
    
    const firstInitial = user.firstName ? user.firstName.charAt(0) : '';
    const lastName = user.lastName || '';
    
    return `${firstInitial}. ${lastName}`;
  };
  
  // Get user role
  const getUserRole = () => {
    if (!user || !user.roles || user.roles.length === 0) return 'User';
    
    // Map role IDs to role names - this would ideally come from a roles mapping
    const roleMap: Record<number, string> = {
      1: 'Administrator',
      2: 'Manager',
      3: 'Analyst',
      4: 'User'
    };
    
    return roleMap[user.roles[0]] || 'User';
  };
  
  // Handle logout
  const handleLogout = () => {
    // Show confirmation dialog
    Swal.fire({
      title: 'Logout',
      text: 'Are you sure you want to logout?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          // Get token from localStorage
          const token = localStorage.getItem('token');
          
          // Call the logout API
          await api.post('/logout', {}, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          // Clear localStorage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Show success message
          Swal.fire({
            title: 'Logged Out',
            text: 'You have been successfully logged out',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          
          // Redirect to login page
          navigate('/login');
        } catch (error) {
          console.error('Logout error:', error);
          
          // Even if the API call fails, still log out locally
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          Swal.fire({
            title: 'Logged Out',
            text: 'You have been logged out locally',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          
          // Redirect to login page
          navigate('/login');
        }
      }
    });
  };
  
  // Filter data based on search input
  const filteredQueueItems = sampleRequestQueue.filter(
    item => {
      const searchStr = filterText.toLowerCase();
      return (
        item.id.toLowerCase().includes(searchStr) ||
        item.type.toLowerCase().includes(searchStr) ||
        item.status.toLowerCase().includes(searchStr) ||
        item.date.toLowerCase().includes(searchStr) ||
        item.assignedTo.toLowerCase().includes(searchStr)
      );
    }
  );

  const filteredMyItems = sampleMyRequests.filter(
    item => {
      const searchStr = filterText.toLowerCase();
      return (
        item.id.toLowerCase().includes(searchStr) ||
        item.type.toLowerCase().includes(searchStr) ||
        item.status.toLowerCase().includes(searchStr) ||
        item.date.toLowerCase().includes(searchStr)
      );
    }
  );

  // --- INVITE MODAL STATE ---
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<{ email: string; roleId: number | null }[]>([{ email: '', roleId: null }]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Fetch roles on modal open
  useEffect(() => {
    if (showInviteModal) {
      api.get('/roles')
        .then(res => setRoles(res.data))
        .catch(() => setRoles([]));
    }
  }, [showInviteModal]);

  // --- INVITE MODAL LOGIC ---
  const handleAddEmailField = () => setInviteEmails([...inviteEmails, { email: '', roleId: null }]);
  const handleRemoveEmailField = (idx: number) => setInviteEmails(inviteEmails.filter((_, i) => i !== idx));
  const handleChangeEmail = (idx: number, value: string) => setInviteEmails(inviteEmails.map((v, i) => i === idx ? { ...v, email: value } : v));
  const handleChangeRole = (idx: number, value: number) => setInviteEmails(inviteEmails.map((v, i) => i === idx ? { ...v, roleId: value } : v));
  const handleSendInvites = async () => {
    setIsSending(true);
    try {
      const invites = inviteEmails.filter(e => e.email && e.roleId);
      await api.post('/invites/send', { invites });
      Swal.fire({ icon: 'success', title: 'Invites Sent', text: 'Invitations have been sent.' });
      setShowInviteModal(false);
      setInviteEmails([{ email: '', roleId: null }]);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || 'Failed to send invites.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-4 flex items-center gap-2 border-b border-gray-200">
          <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="w-6 h-6" />
          <span className="text-xl font-display font-bold text-primary">Guardian</span>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <Link to="/home" className="flex items-center gap-2 p-2 bg-secondary/10 text-secondary rounded-lg">
                <Shield size={18} />
                <span>Home</span>
              </Link>
            </li>
            <li>
              <Link to="/my-requests" className="flex items-center gap-2 p-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Shield size={18} />
                <span>My Requests</span>
              </Link>
            </li>
            <li>
              <Link to="/settings" className="flex items-center gap-2 p-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Shield size={18} />
                <span>Settings</span>
              </Link>
            </li>
            {getUserRole() === 'Administrator' && (
              <li>
                <button
                  className="ml-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
                  onClick={() => setShowInviteModal(true)}
                >
                  Send Invites
                </button>
              </li>
            )}
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Home</h1>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-800">
                {formatUserName()}
              </span>
              <span className="text-xs text-gray-500">
                {getUserRole()}
              </span>
            </div>
            <button 
              className="text-gray-600 hover:text-gray-800"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Search Bar */}
          <div className="mb-6 flex items-center">
            <div className="relative max-w-md flex-1">
              <div className="flex items-center">
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-full py-2 pl-10 pr-4 border border-gray-5 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                />
                <div className="absolute left-3 inset-y-0 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-3" />
                </div>
              </div>
            </div>
          </div>

          {/* Request Overview */}
          <section className="mb-6 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Request Overview</h2>
            <div className="h-64">
              <Pie data={pieData} options={chartOptions} />
            </div>
          </section>

          {/* Request Queue */}
          <section className="mb-6 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Request Queue</h2>
            <DataTable
              columns={requestQueueColumns}
              data={filteredQueueItems}
              customStyles={customStyles}
              pagination
              paginationPerPage={5}
              paginationRowsPerPageOptions={[5, 10, 15]}
              responsive
              highlightOnHover
              noDataComponent="No requests found"
            />
          </section>

          {/* My Requests */}
          <section className="mb-6 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">My Requests</h2>
            <DataTable
              columns={myRequestsColumns}
              data={filteredMyItems}
              customStyles={customStyles}
              pagination
              paginationPerPage={5}
              paginationRowsPerPageOptions={[5, 10, 15]}
              responsive
              highlightOnHover
              noDataComponent="No requests found"
            />
          </section>
        </main>
      </div>
      {showInviteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <h2 className="text-h4 font-bold mb-4">Send Invites</h2>
            <label className="block mb-2 font-medium">Invite Emails & Roles</label>
            {inviteEmails.map((item, idx) => (
              <div className="flex items-center mb-2 gap-2" key={idx}>
                <input
                  type="email"
                  className="flex-1 px-3 py-2 border rounded"
                  placeholder="user@email.com"
                  value={item.email}
                  onChange={e => handleChangeEmail(idx, e.target.value)}
                  required
                />
                <select
                  className="px-2 py-2 border rounded"
                  value={item.roleId ?? ''}
                  onChange={e => handleChangeRole(idx, Number(e.target.value))}
                  required
                >
                  <option value="" disabled>Select role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {inviteEmails.length > 1 && (
                  <button type="button" onClick={() => handleRemoveEmailField(idx)} className="text-red-500 p-1" title="Remove">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="mb-4 text-primary underline" onClick={handleAddEmailField}>+ Add another</button>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => setShowInviteModal(false)}
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                onClick={handleSendInvites}
                disabled={isSending || !inviteEmails.every(e => e.email && e.roleId)}
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;

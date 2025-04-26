import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Search, LogOut, Trash2 } from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import DataTable from 'react-data-table-component';
import withReactContent from 'sweetalert2-react-content';
import Swal from 'sweetalert2';
import SendInvitesForm from '../components/SendInvitesForm';
import api from '../utils/api'; // Assuming the api is imported from a separate file
import { useAuth } from '../hooks/useAuth'; // Import the useAuth hook
import AdminDashboard from './AdminDashboard';
import { FaThLarge, FaRegCommentDots, FaRegFileAlt, FaCog, FaUserShield, FaPaperPlane } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

// Register Chart.js components
ChartJS.register(ArcElement, ChartTooltip, Legend);

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

const MySwal = withReactContent(Swal);

function Home() {
  const [filterText, setFilterText] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth(); // Get the user object from the useAuth hook
  const [selectedSection, setSelectedSection] = useState('dashboard');
  
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

  const handleSendInvite = () => {
    MySwal.fire({
      html: (
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md mx-auto">
          <SendInvitesForm onClose={() => MySwal.close()} />
        </div>
      ),
      showConfirmButton: false,
      showCancelButton: false,
      customClass: {
        popup: 'p-0 bg-transparent shadow-none flex items-center justify-center'
      },
      width: '32rem',
      background: 'transparent',
    });
  };

  const navItems = [
    { key: 'dashboard', icon: <FaThLarge /> },
    { key: 'notices', icon: <FaRegCommentDots /> },
    { key: 'workorder', icon: <FaRegFileAlt /> },
    { key: 'settings', icon: <FaCog /> },
  ];

  // Add a custom color for the sidebar background (matches provided image)
  const sidebarBg = '#6DEBE8';

  return (
    <div className="flex h-screen bg-gray-100">
      <Tooltip id="sidebar-tooltip" place="right" />
      {/* Sidebar */}
      <aside style={{ backgroundColor: sidebarBg }} className="h-full flex flex-col items-center py-6 w-20 min-w-[80px]">
        {navItems.map(item => (
          <button
            key={item.key}
            className={`flex items-center justify-center w-12 h-12 mb-4 rounded-full transition-all duration-150
              ${selectedSection === item.key ? 'bg-white text-primary shadow-lg' : 'text-white hover:bg-primary/80'}`}
            onClick={() => setSelectedSection(item.key)}
            aria-label={item.key}
            title={item.key === 'dashboard' ? 'Go to Dashboard' : item.key === 'notices' ? 'View Notices' : item.key === 'workorder' ? 'View Requests' : 'Account Settings'}
            data-tooltip-id="sidebar-tooltip"
            data-tooltip-content={item.key === 'dashboard' ? 'Go to Dashboard' : item.key === 'notices' ? 'View Notices' : item.key === 'workorder' ? 'View Requests' : 'Account Settings'}
          >
            <span className="text-2xl">{item.icon}</span>
          </button>
        ))}
        {/* Admin-only links */}
        {user && user.roles && user.roles.includes(1) && (
          <>
            <button
              className={`flex items-center justify-center w-12 h-12 mb-4 rounded-full transition-all duration-150 ${selectedSection === 'admin' ? 'bg-white text-primary shadow-lg' : 'text-white hover:bg-primary/80'}`}
              onClick={() => setSelectedSection('admin')}
              aria-label="Admin Dashboard"
              title="Admin Dashboard"
              data-tooltip-id="sidebar-tooltip"
              data-tooltip-content="Admin Dashboard"
            >
              <span className="text-2xl"><FaUserShield /></span>
            </button>
            <button
              className="flex items-center justify-center w-12 h-12 mb-4 rounded-full text-white hover:bg-primary/80 transition-all duration-150"
              onClick={handleSendInvite}
              aria-label="Send Invites"
              title="Send User Invites"
              data-tooltip-id="sidebar-tooltip"
              data-tooltip-content="Send User Invites"
            >
              <span className="text-2xl"><FaPaperPlane /></span>
            </button>
          </>
        )}
        <div className="flex-1" />
      </aside>

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
          {selectedSection === 'admin' && user && user.roles && user.roles.includes(1) ? (
            <AdminDashboard />
          ) : (
            <>
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Home;

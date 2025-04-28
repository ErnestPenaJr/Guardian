import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Search, LogOut, Trash2, User, Settings, KeyRound, Bell, SunMoon } from 'lucide-react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import DataTable from 'react-data-table-component';
import withReactContent from 'sweetalert2-react-content';
import Swal from 'sweetalert2';
import SendInvitesForm from '../components/SendInvitesForm';
import RequestDashboard from '../components/RequestDashboard';
import api from '../utils/api'; // Assuming the api is imported from a separate file
import { useAuth } from '../hooks/useAuth'; // Import the useAuth hook
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';
import { FaThLarge, FaRegCommentDots, FaRegEdit, FaCog, FaUserShield, FaPaperPlane, FaSlidersH } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

// Register Chart.js components
ChartJS.register(ArcElement, ChartTooltip, Legend);

// Sample data for the pie chart
const requestStatusData = [
  { label: 'Pending', value: 12, color: '#6DEBE8' },
  { label: 'Processing', value: 7, color: '#FFD600' },
  { label: 'Completed', value: 25, color: '#6C63FF' },
  { label: 'Rejected', value: 4, color: '#FF6B6B' },
  { label: 'Failed', value: 2, color: '#BDBDBD' },
];

const totalRequests = requestStatusData.reduce((sum, s) => sum + s.value, 0);

const pieData = {
  labels: requestStatusData.map((s) => s.label),
  datasets: [
    {
      data: requestStatusData.map((s) => s.value),
      backgroundColor: requestStatusData.map((s) => s.color),
      borderColor: requestStatusData.map((s) => s.color),
      borderWidth: 1,
    },
  ],
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false, // Hide Chart.js legend (use only custom legend)
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          const label = context.label || '';
          const value = context.raw;
          const percent = ((value / totalRequests) * 100).toFixed(1);
          return `${label}: ${value} (${percent}%)`;
        },
      },
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
  const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'admin' | 'adminUserManagement'>('dashboard');
  
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
  
  // --- Theme State ---
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleToggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  // --- User Profile Dropdown State ---
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        <SendInvitesForm onClose={() => MySwal.close()} />
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
    { key: 'workorder', icon: <FaRegEdit /> },
  ];

  // Add a custom color for the sidebar background (matches provided image)
  const sidebarBg = '#6DEBE8';

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Top Bar */}
      <header className="fixed top-0 left-0 w-full h-16 bg-white shadow-md border-b-2 border-teal-500 flex items-center justify-between px-4 md:px-8 z-40">
        <div className="flex items-center gap-2 md:gap-3">
          <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="h-8 w-auto" />
          <span className="font-bold text-lg md:text-2xl text-gray-700 hidden sm:inline">Guardian</span>
        </div>
        <div className="flex-1 flex justify-center max-w-xs md:max-w-md">
          <input
            type="text"
            placeholder="Search requests..."
            className="w-full px-3 md:px-4 py-2 border rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-primary text-sm md:text-base"
          />
        </div>
        <div className="flex items-center gap-2 md:gap-3 relative" ref={profileMenuRef}>
          <div className="flex items-center gap-2 md:gap-3 relative cursor-pointer" onClick={() => setProfileMenuOpen(v => !v)} tabIndex={0} role="button" aria-haspopup="true" aria-expanded={profileMenuOpen}>
            <button
              className="bg-primary text-white rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center font-semibold text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Open user menu"
              tabIndex={-1}
              style={{ pointerEvents: 'none' }}
            >
              {user?.profilePhotoUrl ? (
                <img src={user.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover rounded-full" />
              ) : (
                (user?.firstName && user?.lastName)
                  ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                  : (user?.fullName ? user.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U')
              )}
            </button>
            <span className="font-medium text-gray-700 hidden sm:inline">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.fullName || user?.name || 'User'}</span>
            <svg
              className={`w-4 h-4 ml-1 text-gray-500 hidden sm:inline cursor-pointer transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : 'rotate-0'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {/* Dropdown Menu */}
          {profileMenuOpen && (
            <div className="absolute right-0 top-12 mt-2 w-56 bg-white rounded-lg shadow-lg py-2 z-50 border border-gray-100 animate-fade-in">
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" onClick={() => {/* Navigate to Account Settings */}}>
                <Settings size={16} /> Account Settings
              </button>
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" onClick={() => {/* Navigate to Update Profile */}}>
                <User size={16} /> Update Profile
              </button>
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" onClick={() => {/* Navigate to Change Password */}}>
                <KeyRound size={16} /> Change Password
              </button>
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" onClick={() => {/* Navigate to Notification Preferences */}}>
                <Bell size={16} /> Notification Preferences
              </button>
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" onClick={() => handleToggleTheme}>
                <SunMoon size={16} /> Theme: {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
              <div className="border-t my-2" />
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-red-600 text-sm" onClick={handleLogout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </header>
      {/* Sidebar: collapses to bottom bar on mobile */}
      <nav aria-label="Sidebar navigation" className="hidden sm:flex flex-col items-center pt-4 w-14 md:w-16 min-w-[56px] md:min-w-[64px] bg-[#6DEBE8] h-full fixed top-16 left-0 z-30">
        {navItems.filter(item => item.key !== 'settings').map(item => (
          <button
            key={item.key}
            className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 mb-3 md:mb-4 rounded-full transition-all duration-150 ${selectedSection === item.key ? 'bg-white text-primary shadow-lg' : 'text-white hover:bg-primary/80'}`}
            onClick={() => setSelectedSection(item.key)}
            aria-label={item.key === 'dashboard' ? 'Home' : item.key.charAt(0).toUpperCase() + item.key.slice(1)}
            data-tooltip-id="sidebar-tooltip"
            data-tooltip-content={item.key === 'dashboard' ? 'Go to Home' : item.key === 'notices' ? 'View Notices' : item.key === 'workorder' ? 'View Requests' : 'Account Settings'}
          >
            <span className="text-xl md:text-2xl" aria-hidden="true">{item.icon}</span>
            {item.key === 'dashboard' && (
              <span className="sr-only">Home</span>
            )}
          </button>
        ))}
        {user && user.roles && user.roles.includes(1) && (
          <>
            <button
              className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 mb-3 md:mb-4 rounded-full transition-all duration-150 ${selectedSection === 'admin' ? 'bg-white text-primary shadow-lg' : 'text-white hover:bg-primary/80'}`}
              onClick={() => setSelectedSection('admin')}
              aria-label="Admin Dashboard"
              data-tooltip-id="sidebar-tooltip"
              data-tooltip-content="Admin Dashboard"
            >
              <span className="text-xl md:text-2xl"><FaSlidersH /></span>
            </button>
            <button
              className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 mb-3 md:mb-4 rounded-full text-white hover:bg-primary/80 transition-all duration-150"
              onClick={handleSendInvite}
              aria-label="Send Invites"
              data-tooltip-id="sidebar-tooltip"
              data-tooltip-content="Send User Invites"
            >
              <span className="text-xl md:text-2xl"><FaPaperPlane /></span>
            </button>
          </>
        )}
        <Tooltip id="sidebar-tooltip" place="right" />
        {/* Logout button at bottom */}
        <div className="flex-1 flex flex-col justify-end w-full items-center pb-2">
          <button
            className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full text-white hover:bg-primary/80 transition-all duration-150 mt-4"
            onClick={handleLogout}
            aria-label="Logout"
            data-tooltip-id="sidebar-tooltip"
            data-tooltip-content="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>
      {/* Main Content: Switchable Dashboard */}
      <main className="flex-1 flex flex-col mt-16 px-2 sm:px-4 md:px-8 py-4 md:py-8 gap-6 md:gap-8 overflow-y-auto w-full ml-0 sm:ml-14 md:ml-16">
        {selectedSection === 'dashboard' ? (
          // Default Dashboard Overview (original content)
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 gap-y-10 md:gap-y-14 w-full">
            {/* Request Overview Card */}
            <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-4 md:p-6 w-full`}>
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 mt-4 md:mt-6">Request Overview</h2>
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="w-56 h-56 md:w-80 md:h-80 flex items-center justify-center mx-auto md:mx-0"> {/* Increased size */}
                  <Pie data={pieData} options={chartOptions} />
                </div>
                <div className="mt-4 md:mt-0 md:ml-4 flex flex-col gap-2 text-sm">
                  <div className="mb-2 text-gray-700 font-semibold">Total Requests: {totalRequests}</div>
                  {requestStatusData.map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></span>
                      <span>{s.label}</span>
                      <span className="ml-2 text-xs text-gray-500">{s.value} ({((s.value / totalRequests) * 100).toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            {/* Request Queue Card */}
            <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-4 md:p-6 w-full`}>
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 mt-4 md:mt-6">Request Queue</h2>
              <DataTable
                columns={requestQueueColumns}
                data={filteredQueueItems}
                pagination
                highlightOnHover
                striped
              />
            </section>
            {/* My Requests Card (spans both columns on large screens) */}
            <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-4 md:p-6 w-full md:col-span-2`}>
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 mt-4 md:mt-6">My Requests</h2>
              <DataTable
                columns={myRequestsColumns}
                data={filteredMyItems}
                pagination
                highlightOnHover
                striped
              />
            </section>
          </div>
        ) : selectedSection === 'workorder' ? (
          <div className="mt-4 md:mt-6">
            <RequestDashboard />
          </div>
        ) : selectedSection === 'admin' && user && user.roles && user.roles.includes(1) ? (
          <div className="mt-4 md:mt-6">
            <AdminDashboard onShowUserManagement={() => setSelectedSection('adminUserManagement')} />
          </div>
        ) : selectedSection === 'adminUserManagement' ? (
          <div className="mt-4 md:mt-6">
            <AdminUserManagement />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-2xl">
            Select a section from the left nav
          </div>
        )}
      </main>
    </div>
  );
}

export default Home;

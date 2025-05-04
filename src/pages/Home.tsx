import { useState, useEffect, useRef } from 'react';
import {
  LogOut, User, Settings, KeyRound, Bell, SunMoon, UserPlus, RefreshCw, 
  MessageCircle, CheckCircle, FileText, Monitor, CreditCard,
  LayoutDashboard, ChevronLeft, ChevronRight, Sliders, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/sidebar.css';
import MobileNavBar from '../components/MobileNavBar';
import DataTable from 'react-data-table-component';
import withReactContent from 'sweetalert2-react-content';
import Swal from 'sweetalert2';
import SendInvitesForm from '../components/SendInvitesForm';
import RequestDashboard from './RequestDashboard';
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';

const MySwal = withReactContent(Swal);

// Define Request interface
interface Request {
  REQUEST_ID: number;
  REQUEST_NAME: string;
  EXTERNAL_USER: string;
  SUBMITTED_DATE: string;
  REQUESTOR_ID: number | null;
  ASSIGNED_ID: number | null;
  STATUS: string;
  CREATE_DATE: string;
  UPDATE_DATE: string;
  CREATE_USER_ID: number | null;
  UPDATE_USER_ID: number | null;
  TRACKINGID: string;
  requestorName: string;
  assignedName: string;
  requestor?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
  assigned?: {
    FIRST_NAME: string;
    LAST_NAME: string;
    EMAIL: string;
  };
}

// Define columns for the requests table
const requestColumns = [
  {
    name: 'Request ID',
    selector: (row: Request) => row.REQUEST_ID,
    sortable: true,
  },
  {
    name: 'Type',
    selector: (row: Request) => row.REQUEST_NAME || 'N/A',
    sortable: true,
  },
  {
    name: 'Status',
    selector: (row: Request) => row.STATUS,
    sortable: true,
    cell: (row: Request) => {
      const statusColor = {
        'P': 'bg-yellow-200 text-yellow-800',
        'A': 'bg-green-200 text-green-800',
        'R': 'bg-red-200 text-red-800',
        'C': 'bg-blue-200 text-blue-800',
        'N': 'bg-gray-200 text-gray-800',
        'X': 'bg-red-200 text-red-800'
      }[row.STATUS] || 'bg-gray-200 text-gray-800';
      
      const statusText = {
        'P': 'In Progress',
        'A': 'Approved',
        'R': 'Rejected',
        'C': 'Completed',
        'N': 'New',
        'X': 'Cancelled'
      }[row.STATUS] || 'Unknown';

      return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
          {statusText}
        </span>
      );
    }
  },
  {
    name: 'Date',
    selector: (row: Request) => new Date(row.CREATE_DATE).toLocaleDateString(),
    sortable: true,
  },
  {
    name: 'Requestor',
    selector: (row: Request) => row.requestorName,
    sortable: true,
  },
  {
    name: 'Assigned To',
    selector: (row: Request) => row.assignedName,
    sortable: true,
  }
];

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'admin' | 'adminUserManagement'>('dashboard');
  const [mobileNav, setMobileNav] = useState<'dashboard' | 'search' | 'notifications' | 'profile'>('dashboard');
  const [notifOpen, setNotifOpen] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const notifications = [
    { id: 1, message: 'New user registered.', icon: <UserPlus className="w-5 h-5 text-primary" /> },
    { id: 2, message: 'System update available.', icon: <RefreshCw className="w-5 h-5 text-blue-500" /> },
    { id: 3, message: 'Password changed successfully.', icon: <KeyRound className="w-5 h-5 text-green-600" /> },
    { id: 4, message: 'New comment on your post.', icon: <MessageCircle className="w-5 h-5 text-yellow-500" /> },
    { id: 5, message: 'Access request approved.', icon: <CheckCircle className="w-5 h-5 text-green-700" /> },
    { id: 6, message: 'Weekly report is ready.', icon: <FileText className="w-5 h-5 text-indigo-500" /> },
    { id: 7, message: 'New device signed in.', icon: <Monitor className="w-5 h-5 text-orange-500" /> },
    { id: 8, message: 'Subscription renewed.', icon: <CreditCard className="w-5 h-5 text-pink-500" /> },
  ];

  // Get user role
  const getUserRole = () => {
    if (!user || !user.roles || user.roles.length === 0) return 'User';
    
    // Get the display name from the role object
    // The roles are now objects with id, name, and displayName properties
    const role = user.roles[0];
    return role.displayName || role.name || 'User';
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
    }).then(async (result: { isConfirmed: boolean }) => {
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
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(
    () => (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system'
  );

  // Track system theme if 'system' is selected
  useEffect(() => {
    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
  }, [theme]);

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => setTheme(value);

  // --- User Profile Dropdown State ---
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  // --- Theme Dropdown State ---
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeMenuDirection, setThemeMenuDirection] = useState<'left' | 'right'>('right');
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);

  // Dynamic direction for theme dropdown
  const handleThemeMenuOpen = () => {
    if (themeButtonRef.current) {
      const rect = themeButtonRef.current.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;
      const dropdownWidth = 170; // px, estimate
      if (spaceRight < dropdownWidth) {
        setThemeMenuDirection('left');
      } else {
        setThemeMenuDirection('right');
      }
    }
    setThemeMenuOpen(true);
  };

  useEffect(() => {
    if (!themeMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [themeMenuOpen]);

  // --- User Profile Dropdown State ---
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
    {
      icon: <LayoutDashboard className="w-6 h-6" />,
      label: 'Dashboard',
      onClick: () => setSelectedSection('dashboard'),
      active: selectedSection === 'dashboard',
    },
    // Notices item hidden per request
    /*{
      icon: <MessageSquareText className="w-6 h-6" />,
      label: 'Notices',
      onClick: () => navigate('/notices'),
      active: false,
    },*/
    {
      icon: <FileText className="w-6 h-6" />,
      label: 'My Requests',
      onClick: () => setSelectedSection('workorder'),
      active: selectedSection === 'workorder',
    },
    ...(user?.roles?.some((role: any) => role.id === 1) ? [
      {
        icon: <Sliders className="w-6 h-6" />,
        label: 'Settings',
        onClick: () => setSelectedSection('admin'),
        active: selectedSection === 'admin',
      },
      {
        icon: <Send className="w-6 h-6" />,
        label: 'Invites',
        onClick: handleSendInvite,
        active: false,
      }
    ] : [])
  ];

  // Center action handler (could open a modal or perform an action)
  const handleCenterAction = () => {
    Swal.fire({
      title: 'Quick Action',
      text: 'Center action tapped! Implement your quick action here.',
      icon: 'info',
      confirmButtonText: 'OK',
    });
  };

  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [selectedRows, setSelectedRows] = useState<Request[]>([]);
  const [toggleCleared, setToggleCleared] = useState(false);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const response = await api.get('/requests');
        console.log('Fetched requests:', response.data);
        setRequests(response.data);
        setFilteredRequests(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching requests:', err);
        setError('Failed to fetch requests');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
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
          <div className="relative mr-4 px-2 py-1">
            <div
              className="bg-white rounded-lg shadow-sm flex items-center justify-center cursor-pointer border border-gray-200"
              style={{ width: '42px', height: '42px' }}
              onClick={() => setNotifOpen((open) => !open)}
              tabIndex={0}
              aria-label="Show notifications"
            >
              <Bell className="w-6 h-6 text-gray-900" />
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full px-1.5 border-2 border-white" style={{minWidth:'1.2em',textAlign:'center'}}>{notifications.length}</span>
            </div>
            {/* Dropdown */}
            {notifOpen && (
              <div className="absolute z-50 right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden" style={{ maxHeight: '320px', minWidth: '260px' }}>
                <div className="border-b px-4 py-3 bg-gray-50 font-semibold text-gray-700 text-xs tracking-widest">NOTIFICATIONS</div>
                <div className="py-2 max-h-80 overflow-y-auto" style={{ maxHeight: '288px' }}>
                  {notifications.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 border-b last:border-b-0 text-gray-800 text-sm">
                        {notif.icon}
                        <span>{notif.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-3 relative cursor-pointer border border-gray-200 rounded-lg px-2 mr-4" onClick={() => setProfileMenuOpen(v => !v)} tabIndex={0} role="button" aria-haspopup="true" aria-expanded={profileMenuOpen}>
            {/* Profile */}
           
            <span className="flex flex-col items-start hidden sm:inline">
              <span className="font-bold text-lg leading-tight text-gray-900">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.fullName || user?.name || 'User'}
              </span><br></br>
              {user && user.roles && user.roles.some((role: any) => role.id === 1) && (
                <span className="text-sm text-gray-500 font-medium text-end">{getUserRole()}</span>
              )}
            </span>
            <svg
              className={`w-4 h-4 ml-1 text-gray-400 hidden sm:inline cursor-pointer transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : 'rotate-0'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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
              {/* Theme Nested Dropdown */}
              <div className="relative" ref={themeMenuRef}>
                <button
                  ref={themeButtonRef}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm"
                  onClick={() => { handleThemeMenuOpen(); }}
                  onMouseEnter={handleThemeMenuOpen}
                  onMouseLeave={() => setThemeMenuOpen(false)}
                  aria-haspopup="menu"
                  aria-expanded={themeMenuOpen}
                  type="button"
                >
                  <SunMoon size={16} /> Theme
                  <svg className="ml-auto w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
                {themeMenuOpen && (
                  <div
                    className={`absolute ${themeMenuDirection==='right' ? 'left-full ml-1' : 'right-full mr-1'} top-0 mt-0 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 animate-fade-in`}
                    onMouseEnter={handleThemeMenuOpen}
                    onMouseLeave={() => setThemeMenuOpen(false)}
                    role="menu"
                  >
                    <button className={`w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-gray-100 ${theme==='light'?'font-bold text-primary':'text-gray-700'}`} onClick={() => {handleThemeChange('light'); setThemeMenuOpen(false);}}>
                      <SunMoon size={16} /> Light {theme==='light' && <span className="ml-auto">✓</span>}
                    </button>
                    <button className={`w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-gray-100 ${theme==='dark'?'font-bold text-primary':'text-gray-700'}`} onClick={() => {handleThemeChange('dark'); setThemeMenuOpen(false);}}>
                      <SunMoon size={16} /> Dark {theme==='dark' && <span className="ml-auto">✓</span>}
                    </button>
                    <button className={`w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-gray-100 ${theme==='system'?'font-bold text-primary':'text-gray-700'}`} onClick={() => {handleThemeChange('system'); setThemeMenuOpen(false);}}>
                      <Monitor size={16} /> System {theme==='system' && <span className="ml-auto">✓</span>}
                    </button>
                  </div>
                )}
              </div>
              <div className="border-t my-2" />
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-red-600 text-sm" onClick={handleLogout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </header>
      {/* Sidebar: collapses to bottom bar on mobile */}
      <nav aria-label="Sidebar navigation" className={`hidden sm:flex flex-col items-center pt-1 ${isNavExpanded ? 'w-48' : 'w-16'} min-w-[56px] md:min-w-[64px] bg-[#6DEBE8] h-[calc(100vh-4rem)] fixed top-16 left-0 z-50 transition-all duration-300 ease-in-out`}>
        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsNavExpanded(!isNavExpanded)}
          className="mb-1 py-0.5 px-1 hover:bg-[#4AB0B9]/70 rounded transition-colors"
          aria-label={isNavExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isNavExpanded ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <div className="flex flex-col items-center w-full flex-1">
          {navItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className={`flex items-center ${isNavExpanded ? 'justify-start px-4' : 'justify-center'} w-full h-10 mb-3 transition-all duration-150 ${
                item.active ? 'bg-[#4AB0B9]' : 'hover:bg-[#4AB0B9]/70'
              }`}
              aria-label={item.label}
              data-tooltip-id={isNavExpanded ? undefined : "sidebar-tooltip"}
              data-tooltip-content={isNavExpanded ? undefined : item.label}
            >
              <span className="text-xl" aria-hidden="true">
                {item.icon}
              </span>
              {isNavExpanded && (
                <span className="ml-3 text-sm font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center w-full pb-2 mt-auto">
          <button
            className={`flex items-center ${isNavExpanded ? 'justify-start px-4' : 'justify-center'} w-full h-10 mb-3 transition-all duration-150 hover:bg-[#4AB0B9]/70`}
            onClick={handleLogout}
            aria-label="Logout"
            data-tooltip-id={isNavExpanded ? undefined : "sidebar-tooltip"}
            data-tooltip-content={isNavExpanded ? undefined : "Logout"}
          >
            <span className="text-xl" aria-hidden="true">
              <LogOut className="w-6 h-6" />
            </span>
            {isNavExpanded && (
              <span className="ml-3 text-sm font-medium">Logout</span>
            )}
          </button>
        </div>
        <Tooltip id="sidebar-tooltip" place="right" />
      </nav>
      {/* Main Content: Switchable Dashboard */}
      <main className={`flex-1 flex flex-col mt-16 px-2 sm:px-4 md:px-8 py-4 md:py-8 gap-6 md:gap-8 overflow-y-auto w-full ${isNavExpanded ? 'ml-48' : 'ml-16'} transition-all duration-300 ease-in-out`}>
        {mobileNav === 'dashboard' && selectedSection === 'dashboard' ? (
          // Dashboard Overview
          <div className="container">
            <h1 className="text-2xl font-bold uppercase fs-2 mb-8">Main Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 gap-y-10 md:gap-y-14 w-full">
              {/* Request Overview Card */}
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-4 md:p-6 w-full`}>
                <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 mt-4 md:mt-6">Request Overview</h2>
                <div className="flex flex-col md:flex-row items-center justify-between">
                  <div className="w-56 h-56 md:w-80 md:h-80 flex items-center justify-center mx-auto md:mx-0"> {/* Increased size */}
                    {/* <Pie data={pieData} options={chartOptions} /> */}
                  </div>
                  <div className="mt-4 md:mt-0 md:ml-4 flex flex-col gap-2 text-sm">
                    {/* <div className="mb-2 text-gray-700 font-semibold">Total Requests: {totalRequests}</div>
                    {requestStatusData.map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></span>
                        <span>{s.label}</span>
                        <span className="ml-2 text-xs text-gray-500">{s.value} ({((s.value / totalRequests) * 100).toFixed(1)}%)</span>
                      </div>
                    ))} */}
                  </div>
                </div>
              </section>
              {/* Request Queue Card */}
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-4 md:p-6 w-full`}>
                <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 mt-4 md:mt-6">Request Queue</h2>
                
                {error ? (
                  <div className="text-red-600 p-4 rounded bg-red-50">{error}</div>
                ) : loading ? (
                  <div className="flex justify-center items-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Search requests..."
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        onChange={(e) => {
                          const searchTerm = e.target.value.toLowerCase();
                          if (searchTerm) {
                            const filteredData = requests.filter(item => {
                              return (
                                (item.REQUEST_NAME?.toLowerCase().includes(searchTerm)) ||
                                (item.TRACKINGID?.toLowerCase().includes(searchTerm)) ||
                                (item.STATUS?.toLowerCase().includes(searchTerm)) ||
                                (item.requestorName?.toLowerCase().includes(searchTerm)) ||
                                (item.assignedName?.toLowerCase().includes(searchTerm))
                              );
                            });
                            setFilteredRequests(filteredData);
                          } else {
                            setFilteredRequests(requests);
                          }
                        }}
                      />
                    </div>
                    
                    <DataTable
                      columns={requestColumns}
                      data={filteredRequests || requests}
                      pagination
                      paginationPerPage={10}
                      paginationRowsPerPageOptions={[5, 10, 15, 20, 50]}
                      paginationComponentOptions={{
                        rowsPerPageText: 'Records per page:',
                        rangeSeparatorText: 'of',
                      }}
                      selectableRows
                      selectableRowsHighlight
                      onSelectedRowsChange={(state) => {
                        console.log('Selected Rows:', state.selectedRows);
                        setSelectedRows(state.selectedRows);
                      }}
                      clearSelectedRows={toggleCleared}
                      sortServer={false}
                      defaultSortFieldId={1}
                      defaultSortAsc={false}
                      noDataComponent={
                        <div className="p-4 text-center text-gray-500">No requests found</div>
                      }
                      customStyles={{
                        rows: {
                          style: {
                            minHeight: '60px',
                          },
                        },
                        headCells: {
                          style: {
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            fontWeight: '600',
                          },
                        },
                        cells: {
                          style: {
                            paddingLeft: '8px',
                            paddingRight: '8px',
                          },
                        },
                      }}
                    />
                    
                    {selectedRows && selectedRows.length > 0 && (
                      <div className="mt-4 p-3 bg-gray-100 rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{selectedRows.length} request(s) selected</span>
                          <button 
                            className="px-3 py-1 bg-teal-500 text-white rounded-md hover:bg-teal-600"
                            onClick={() => {
                              setToggleCleared(!toggleCleared);
                            }}
                          >
                            Clear Selection
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        ) : mobileNav === 'search' ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-2xl">
            Search (coming soon)
          </div>
        ) : mobileNav === 'notifications' ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-2xl">
            Notifications (coming soon)
          </div>
        ) : mobileNav === 'profile' ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-2xl">
            Profile (coming soon)
          </div>
        ) : (
          // Existing desktop logic
          selectedSection === 'workorder' ? (
            <div className="mt-4 md:mt-6">
              <RequestDashboard />
            </div>
          ) : selectedSection === 'admin' && user && user.roles && user.roles.some((role: any) => role.id === 1) ? (
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
          )
        )}
      </main>
      {/* Mobile Bottom Nav */}
      <MobileNavBar
        selected={mobileNav}
        onSelect={(key) => {
          if (["dashboard", "search", "notifications", "profile"].includes(key)) {
            setMobileNav(key as 'dashboard' | 'search' | 'notifications' | 'profile');
            if (key === 'dashboard') setSelectedSection('dashboard');
          }
        }}
        onCenterAction={handleCenterAction}
        onInvite={handleSendInvite}
      />
    </div>
  );
}

export default Home;

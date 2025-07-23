import { useState, useEffect, useRef } from 'react';
import { FaCode } from 'react-icons/fa';
import {
  LogOut, User, Settings, KeyRound, Bell, SunMoon, UserPlus, RefreshCw, 
  MessageCircle, CheckCircle, FileText, Monitor, CreditCard,
  LayoutDashboard, ChevronLeft, ChevronRight, Sliders, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
// Import the Modal component
import Modal from '../components/Modal';
import axios from 'axios';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/sidebar.css';
import MobileNavBar from '../components/MobileNavBar';
import DataTable from 'react-data-table-component';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import SendInvitesForm from '../components/SendInvitesForm';
import RequestDashboard from './RequestDashboard';
import RequestFulfillmentDashboard from './RequestFulfillmentDashboard';
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, ChartTooltip, Legend);

const MySwal = withReactContent(Swal);

// Define User interface
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
  companyId: number;
  roles: any[];
}

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
  ABBREVIATION?: string;
  REQUEST_DESCRIPTION?: string;
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

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'myRequests' | 'admin' | 'adminUserManagement' | 'apiManager'>('dashboard');
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
  
  // State for refresh button loading state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch requests when component mounts
  useEffect(() => {
    console.log('Home component mounted, fetching requests...');
    fetchRequests();
  }, []);

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
    {
      icon: <CheckCircle className="w-6 h-6" />,
      label: 'Assignments',
      onClick: () => setSelectedSection('myRequests'),
      active: selectedSection === 'myRequests',
    },
    ...((user?.roles?.some((role: any) => role.id === 1 || role.id === 6) || user?.role === '1' || user?.role === '6') ? [
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
  const handleCenterAction = async () => {
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
    }
  };

  // State for requests data
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [selectedRows, setSelectedRows] = useState<Request[]>([]);
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [currentRequest, setCurrentRequest] = useState<Request | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [toggleCleared, setToggleCleared] = useState<boolean>(false);
  const [requestStatusData, setRequestStatusData] = useState<Array<{ label: string; value: number; color: string }>>([]);
  const [totalRequests, setTotalRequests] = useState<number>(0);
  
  // User is already declared at the top of the component

  // Function to handle viewing a request
  const handleViewRequest = (request: Request) => {
    setCurrentRequest(request);
    setShowRequestModal(true);
    
    if (request.ASSIGNED_ID) {
      setSelectedUser({ id: request.ASSIGNED_ID, firstName: request.assignedName?.split(' ')[0] || '', lastName: request.assignedName?.split(' ')[1] || '' });
    } else {
      setSelectedUser(null);
    }
    
    // Fetch users for assignment dropdown if user has permission
    if (hasAssignPermission()) {
      fetchUsers();
    }
  };
  
  // Define columns for the requests table
  const requestColumns = [
    {
      name: 'Request ID',
      selector: (row: Request) => row.TRACKINGID || 'N/A',
      sortable: true,
      width: '300px',
      wrap: true, // Enable text wrapping
      cell: (row: Request) => {
        const trackingId = row.TRACKINGID || 'N/A';
        return (
          <div className="tracking-id-cell">
            {trackingId}
          </div>
        );
      }
    },
    {
      name: 'Type',
      selector: (row: Request) => row.REQUEST_NAME || 'N/A',
      sortable: true,
      width: '180px',
    },
    {
      name: 'Status',
      selector: (row: Request) => row.STATUS,
      sortable: true,
      width: '130px',
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
      width: '120px',
    },
    {
      name: 'Requestor',
      selector: (row: Request) => row.requestorName,
      sortable: true,
      width: '180px',
    },
    {
      name: 'Assigned To',
      selector: (row: Request) => row.assignedName || 'Unassigned',
      sortable: true,
      width: '180px',
    }
  ];

  // Function to fetch users for assignment dropdown
  const fetchUsers = async () => {
    if (hasAssignPermission()) {
      try {
        const response = await api.get('/api/users');
        // Extract the data array from the response structure
        setUsers(response.data.data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users for assignment');
      }
    }
  };
  
  // Function to handle assigning a request to a user
  const handleAssignRequest = async () => {
    if (!currentRequest || !selectedUser) {
      toast.error('Please select a user to assign the request to');
      return;
    }
    
    try {
      const authToken = localStorage.getItem('token');
      await axios.post(`/api/requests/${currentRequest.REQUEST_ID}/assign`, {
        userId: selectedUser.id
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // Update local state
      const updatedRequests = requests.map(req => {
        if (req.REQUEST_ID === currentRequest.REQUEST_ID) {
          return {
            ...req,
            ASSIGNED_ID: selectedUser.id,
            assignedName: `${selectedUser.firstName} ${selectedUser.lastName}`
          };
        }
        return req;
      });
      
      setRequests(updatedRequests);
      setFilteredRequests(updatedRequests);
      setShowRequestModal(false);
      
      // Show success toast
      toast.success(`Request assigned to ${selectedUser.firstName} ${selectedUser.lastName}`);
      
      // Refresh data after assignment
      fetchRequests();
    } catch (error) {
      console.error('Error assigning request:', error);
      toast.error('Failed to assign request. Please try again.');
    }
  };

  // Function to check if user has manager, admin or JAFAR role
  const hasAssignPermission = () => {
    if (!user) return false;
    
    // Check for role IDs 1 (admin), 6 (JAFAR), or 2 (manager)
    if (user.roles && user.roles.some((role: any) => [1, 2, 6].includes(role.id))) {
      return true;
    }
    
    // Check for role string '1' (admin), '6' (JAFAR), or '2' (manager)
    if (user.role === '1' || user.role === '2' || user.role === '6') {
      return true;
    }
    
    return false;
  };

  // Function to handle processing selected requests
  const handleProcessRequests = async () => {
    if (selectedRows.length === 0) {
      toast.warning('Please select requests to process');
      return;
    }

    try {
      const result = await MySwal.fire({
        title: 'Process Requests',
        text: `Are you sure you want to process ${selectedRows.length} request(s)? This will update their status to "In Progress".`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, process them!'
      });

      if (result.isConfirmed) {
        const authToken = localStorage.getItem('token');
        let successCount = 0;
        let errorCount = 0;

        // Process each selected request
        for (const request of selectedRows) {
          try {
            await axios.put(
              `/api/requests/${request.REQUEST_ID}`,
              {
                status: 'P', // Set status to 'P' for In Progress
                name: request.REQUEST_NAME,
                abbreviation: request.ABBREVIATION,
                description: request.REQUEST_DESCRIPTION || '',
                assignedId: request.ASSIGNED_ID
              },
              {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            successCount++;
          } catch (error) {
            console.error(`Error processing request ${request.REQUEST_ID}:`, error);
            errorCount++;
          }
        }

        // Show results
        if (successCount > 0) {
          toast.success(`Successfully processed ${successCount} request(s)`);
        }
        if (errorCount > 0) {
          toast.error(`Failed to process ${errorCount} request(s)`);
        }

        // Clear selection and refresh data
        setToggleCleared(!toggleCleared);
        fetchRequests();
      }
    } catch (error) {
      console.error('Error in handleProcessRequests:', error);
      toast.error('Failed to process requests. Please try again.');
    }
  };

  // Function to handle deleting selected requests
  const handleDeleteRequests = async () => {
    if (selectedRows.length === 0) {
      toast.warning('Please select requests to delete');
      return;
    }

    try {
      const result = await MySwal.fire({
        title: 'Delete Requests',
        text: `Are you sure you want to delete ${selectedRows.length} request(s)? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete them!'
      });

      if (result.isConfirmed) {
        const authToken = localStorage.getItem('token');
        let successCount = 0;
        let errorCount = 0;

        // Delete each selected request
        for (const request of selectedRows) {
          try {
            await axios.delete(
              `/api/requests/${request.REQUEST_ID}`,
              {
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            successCount++;
          } catch (error) {
            console.error(`Error deleting request ${request.REQUEST_ID}:`, error);
            errorCount++;
          }
        }

        // Show results
        if (successCount > 0) {
          toast.success(`Successfully deleted ${successCount} request(s)`);
        }
        if (errorCount > 0) {
          toast.error(`Failed to delete ${errorCount} request(s)`);
        }

        // Clear selection and refresh data
        setToggleCleared(!toggleCleared);
        fetchRequests();
      }
    } catch (error) {
      console.error('Error in handleDeleteRequests:', error);
      toast.error('Failed to delete requests. Please try again.');
    }
  };
  
  // Function to fetch requests and prepare chart data
  const fetchRequests = async () => {
    console.log('Fetching requests...');
    setLoading(true);
    setError(null);
    
    try {
      // Use axios directly with the full URL to bypass any proxy issues
      console.log('Fetching requests from backend server...');
      const authToken = localStorage.getItem('token');
      
      // Make direct request to backend server
      const response = await axios({
        method: 'get',
        url: '/api/requests',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        // Add timeout to prevent hanging requests
        timeout: 10000
      });
      
      console.log('API response status:', response.status);
      console.log('API response headers:', response.headers);
      
      const requestsData = response.data;
      console.log('Requests data type:', typeof requestsData);
      console.log('Is array?', Array.isArray(requestsData));
      
      if (Array.isArray(requestsData)) {
        console.log('Successfully received array data, length:', requestsData.length);
        setRequests(requestsData);
        setFilteredRequests(requestsData);
        setTotalRequests(requestsData.length);
      } else {
        console.error('Received non-array data from API:', requestsData);
        setError('Invalid data format received from server');
      }
      
      // Prepare chart data for request status visualization
      const statusCounts: Record<string, number> = {
        'N': 0, // New
        'P': 0, // In Progress
        'A': 0, // Approved
        'R': 0, // Rejected
        'C': 0, // Completed
        'X': 0  // Cancelled
      };
      
      // Count requests by status
      requestsData.forEach((req: Request) => {
        if (req.STATUS && statusCounts.hasOwnProperty(req.STATUS)) {
          statusCounts[req.STATUS]++;
        }
      });
      
      // Map to chart data format
      const chartData = [
        { label: 'New', value: statusCounts['N'], color: '#9CA3AF' },
        { label: 'In Progress', value: statusCounts['P'], color: '#FBBF24' },
        { label: 'Approved', value: statusCounts['A'], color: '#34D399' },
        { label: 'Rejected', value: statusCounts['R'], color: '#F87171' },
        { label: 'Completed', value: statusCounts['C'], color: '#60A5FA' },
        { label: 'Cancelled', value: statusCounts['X'], color: '#F87171' }
      ];
      
      setRequestStatusData(chartData);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Failed to load requests. Please try again.');
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  // Return the component JSX
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 w-full h-16 bg-white shadow-md border-b-2 border-teal-500 flex items-center justify-between px-4 md:px-8 z-40">
        <div className="flex items-center gap-2 md:gap-3">
          <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="h-8 w-auto" />
          <span className="font-bold text-lg md:text-2xl text-gray-700 hidden sm:inline">Guardian</span>
        </div>
        <div className="flex-1 flex justify-center max-w-xs md:max-w-md">
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search requests..."
              className="w-full py-2 px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-700 placeholder-gray-400 bg-gray-50"
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
              {user && ((user.roles && user.roles.some((role: any) => role.id === 1 || role.id === 6)) || user.role === '1' || user.role === '6') && (
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
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
              {(user?.roles?.some((role: any) => role.id === 6) || user?.role === '6') && (
                <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" onClick={() => navigate('/api-explorer')}>
                  <FaCode size={16} /> API Explorer
                </button>
              )}
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
      <main className={`flex-1 flex flex-col mt-16 px-2 sm:px-4 md:px-8 py-4 md:py-8 gap-6 md:gap-8 overflow-y-auto ${isNavExpanded ? 'ml-24' : 'ml-8'} transition-all duration-300 ease-in-out bg-gray-50`}>
        {mobileNav === 'dashboard' && selectedSection === 'dashboard' ? (
          // Dashboard Overview
          <div className="container">
            <h1 className="text-2xl font-bold uppercase fs-2 mb-8">HOME</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 gap-y-10 md:gap-y-14">
              {/* Request Overview Card */}
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-3 md:p-4 flex flex-col h-80 md:h-96`} data-component-name="Home">
                <h2 className="text-sm md:text-base font-semibold mb-2 md:mb-3 text-center flex-shrink-0">Request Overview</h2>
                <div className="flex flex-col items-center justify-center flex-1 min-h-0">
                  <div className="w-28 h-28 md:w-40 md:h-40 flex items-center justify-center relative flex-shrink-0" data-component-name="Home">
                    {loading ? (
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : error ? (
                      <div className="text-red-500 text-xs">Error loading data</div>
                    ) : (
                      <>
                        <Pie data={{
                          labels: requestStatusData.map(item => item.label),
                          datasets: [{
                            data: requestStatusData.map(item => item.value),
                            backgroundColor: requestStatusData.map(item => item.color),
                            borderWidth: 1
                          }]
                        }} 
                        options={{
                          plugins: {
                            legend: {
                              display: false
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const label = context.label || '';
                                  const value = context.raw || 0;
                                  const total = requestStatusData.reduce((sum, item) => sum + item.value, 0);
                                  const percentage = total > 0 ? Math.round((value as number / total) * 100) : 0;
                                  return `${label}: ${value} (${percentage}%)`;
                                }
                              }
                            }
                          },
                          cutout: '70%',
                          maintainAspectRatio: true,
                          responsive: true
                        }} />
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <span className="text-2xl md:text-3xl font-bold">{totalRequests}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-3 flex justify-center gap-3 text-xs flex-shrink-0 flex-wrap">
                    {requestStatusData.map((s) => (
                      <div key={s.label} className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                        <span className="dark:text-gray-300">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              {/* Request Queue Card */}
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-4 md:p-6 w-full md:col-span-3`} data-component-name="Home">
                <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Request Queue</h2>
                
                {error ? (
                  <div className="text-red-600 p-4 rounded bg-red-50">{error}</div>
                ) : loading ? (
                  <div className="flex justify-center items-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <button 
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center"
                          onClick={() => {
                            setIsRefreshing(true);
                            fetchRequests()
                              .finally(() => {
                                setIsRefreshing(false);
                                setToggleCleared(!toggleCleared);
                                setSelectedRows([]);
                              });
                          }}
                          disabled={isRefreshing}
                          data-component-name="Home"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                      </div>
                      <div className="relative w-64">
                        <input
                          type="text"
                          placeholder="Search requests..."
                          className="w-full py-2 px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-700 placeholder-gray-400 bg-gray-50"
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
                      onRowClicked={handleViewRequest}
                      pointerOnHover
                      clearSelectedRows={toggleCleared}
                      sortServer={false}
                      defaultSortFieldId={1}
                      defaultSortAsc={false}
                      noDataComponent={
                        <div className="p-4 text-center text-gray-500">No requests found</div>
                      }
                      customStyles={{
                        table: {
                          style: {
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #e2e8f0',
                            width: '100%',
                          },
                        },
                        cells: {
                          style: {
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            overflow: 'visible',
                            whiteSpace: 'normal',
                          },
                        },

                        header: {
                          style: {
                            padding: '0',
                          },
                        },
                        subHeader: {
                          style: {
                            padding: '0',
                          },
                        },
                        headRow: {
                          style: {
                            backgroundColor: '#f8fafc',
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: '#e2e8f0',
                            color: '#475569',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          },
                        },
                        headCells: {
                          style: {
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            paddingTop: '12px',
                            paddingBottom: '12px',
                            fontWeight: 'bold',
                          },
                        },
                        rows: {
                          style: {
                            backgroundColor: '#ffffff',
                            '&:not(:last-of-type)': {
                              borderBottomStyle: 'solid',
                              borderBottomWidth: '1px',
                              borderBottomColor: '#e2e8f0',
                            },
                            '&:hover': {
                              backgroundColor: '#f1f5f9',
                              cursor: 'pointer',
                            },
                          },
                          // Removed duplicate highlightOnHoverStyle
                        },
                        // Removed duplicate cells style
                        pagination: {
                          style: {
                            borderTopStyle: 'solid',
                            borderTopWidth: '1px',
                            borderTopColor: '#e2e8f0',
                            backgroundColor: '#f8fafc',
                          },
                          pageButtonsStyle: {
                            color: '#0284c7',
                            fill: '#0284c7',
                            '&:disabled': {
                              color: '#cbd5e1',
                              fill: '#cbd5e1',
                            },
                            '&:hover:not(:disabled)': {
                              backgroundColor: '#e0f2fe',
                            },
                            '&:focus': {
                              outline: 'none',
                              backgroundColor: '#e0f2fe',
                            },
                          },
                        },
                      }}
                    />
                    
                    {selectedRows && selectedRows.length > 0 && (
                      <div className="mt-4 p-3 bg-gray-100 rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{selectedRows.length} request(s) selected</span>
                          <div className="flex gap-2">
                            <button 
                              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                              onClick={handleProcessRequests}
                              disabled={selectedRows.length === 0}
                            >
                              Process
                            </button>
                            <button 
                              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                              onClick={handleDeleteRequests}
                              disabled={selectedRows.length === 0}
                            >
                              Delete
                            </button>
                            <button 
                              className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                              onClick={() => {
                                setToggleCleared(!toggleCleared);
                              }}
                            >
                              Clear
                            </button>
                          </div>
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
          ) : selectedSection === 'myRequests' ? (
            <div className="mt-4 md:mt-6">
              <RequestFulfillmentDashboard />
            </div>
          ) : selectedSection === 'admin' && user && ((user.roles && user.roles.some((role: any) => role.id === 1 || role.id === 6)) || user.role === '1' || user.role === '6') ? (
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

      {/* Request Details Modal */}
      {showRequestModal && currentRequest && (
        <Modal
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          title={`Request Details: ${currentRequest.TRACKINGID || 'N/A'}`}
          size="lg"
        >
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Request ID</h3>
                <p className="text-base">{currentRequest.TRACKINGID || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Type</h3>
                <p className="text-base">{currentRequest.REQUEST_NAME || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Status</h3>
                <p className="text-base">
                  {{
                    'P': 'In Progress',
                    'A': 'Approved',
                    'R': 'Rejected',
                    'C': 'Completed',
                    'N': 'New',
                    'X': 'Cancelled'
                  }[currentRequest.STATUS] || 'Unknown'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Date Submitted</h3>
                <p className="text-base">
                  {currentRequest.SUBMITTED_DATE ? new Date(currentRequest.SUBMITTED_DATE).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Requestor</h3>
                <p className="text-base">{currentRequest.requestorName || 'N/A'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">Currently Assigned To</h3>
                <p className="text-base">{currentRequest.assignedName || 'Unassigned'}</p>
              </div>
            </div>

            {/* Assignment Section - Only visible to admin, manager, and JAFAR roles */}
            {hasAssignPermission() && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-3">Assign Request</h3>
                <div className="flex flex-col md:flex-row gap-3">
                  <select
                    className="form-select rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring focus:ring-teal-200 focus:ring-opacity-50 flex-grow"
                    value={selectedUser ? selectedUser.id : ''}
                    onChange={(e) => {
                      const userId = e.target.value;
                      const user = users.find(u => u.id.toString() === userId.toString());
                      setSelectedUser(user || null);
                    }}
                  >
                    <option value="">Select a user to assign</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={handleAssignRequest}
                  >
                    Assign
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                className="btn btn-secondary px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700"
                onClick={() => setShowRequestModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
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

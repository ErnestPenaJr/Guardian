import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import {
  LogOut, FileText, LayoutDashboard, ChevronLeft, ChevronRight, Sliders, Send,
  UserPlus, RefreshCw, KeyRound, MessageCircle, CheckCircle, Monitor, CreditCard
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/sidebar.css';
import MobileNavBar from '../components/MobileNavBar';
import DataTable from 'react-data-table-component';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import SendInvitesForm from '../components/SendInvitesForm';
import RequestDashboard from './RequestDashboard';
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';
import AdminFields from './AdminFields';
import AdminFieldsLookupPage from './AdminFieldsLookupPage';
import Profile from './Profile';
import ChangePassword from './ChangePassword';
import AdminFormsGroups from './AdminFormsGroups';
import AdminFormGroupFieldsPage from './AdminFormGroupFieldsPage';
import StyleGuide from './StyleGuide';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, ChartTooltip, Legend);

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
    selector: (row: Request) => row.TRACKINGID || 'N/A',
    sortable: true,
    width: '120px',
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
    width: '150px',
  },
  {
    name: 'Assigned To',
    selector: (row: Request) => row.assignedName || 'Unassigned',
    sortable: true,
    width: '150px',
  }
];

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth(); // Renamed to avoid unused variable warning
  
  // Determine section based on URL path
  const getSectionFromPath = (path: string) => {
    if (path === '/my-requests') return 'workorder';
    if (path === '/settings' || path === '/admin' || path.startsWith('/admin-') || path === '/style-guide' || path === '/profile' || path === '/change-password') return 'admin';
    return 'dashboard'; // Default to dashboard for /home or /dashboard
  };
  
  const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'admin' | 'adminUserManagement' | 'apiManager'>(getSectionFromPath(location.pathname));
  
  // Update selected section when URL changes
  useEffect(() => {
    const section = getSectionFromPath(location.pathname);
    setSelectedSection(section);
  }, [location.pathname]);
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
  const themeMenuRef = useRef<HTMLDivElement>(null);

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
      onClick: () => navigate('/dashboard'),
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
      onClick: () => navigate('/my-requests'),
      active: selectedSection === 'workorder',
    },
    // Show Settings and Invites for all users
    {
      icon: <Sliders className="w-6 h-6" />,
      label: 'Settings',
      onClick: () => navigate('/admin'),
      active: selectedSection === 'admin',
    },
    {
      icon: <Send className="w-6 h-6" />,
      label: 'Invites',
      onClick: handleSendInvite,
      active: false,
    }
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
  const [requestStatusData, setRequestStatusData] = useState<{ label: string; value: number; color: string }[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const response = await api.get('/requests');
        console.log('Fetched requests:', response.data);
        setRequests(response.data);
        setFilteredRequests(response.data);
        
        // Process request data for the chart
        const statusCounts: Record<string, number> = {
          'Completed': 0,
          'In Progress': 0,
          'Pending': 0
        };
        
        response.data.forEach((request: Request) => {
          // Map status codes to display names
          let status = 'Pending';
          if (request.STATUS === 'C' || request.STATUS === 'Closed' || request.STATUS === 'A' || request.STATUS === 'Approved') {
            status = 'Completed';
          } else if (request.STATUS === 'IP' || request.STATUS === 'In Progress' || request.STATUS === 'P') {
            status = 'In Progress';
          } else {
            status = 'Pending'; // Default for 'N', 'New', 'Open', etc.
          }
          
          statusCounts[status]++;
        });
        
        // Create data for the chart
        const chartData = [
          { label: 'Completed', value: statusCounts['Completed'], color: '#005f73' },
          { label: 'In Progress', value: statusCounts['In Progress'], color: '#3a9396' },
          { label: 'Pending', value: statusCounts['Pending'], color: '#94d2bd' }
        ];
        
        setRequestStatusData(chartData);
        setTotalRequests(response.data.length);
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

  // Chart data and options
  const pieData = {
    labels: requestStatusData.map(item => item.label),
    datasets: [
      {
        data: requestStatusData.map(item => item.value),
        backgroundColor: ['#005f73', '#3a9396', '#94d2bd'],
        borderColor: '#ffffff',
        borderWidth: 0,
        cutout: '75%', // Make it a donut chart like in the image
        borderRadius: 15, // Increased rounded edges on segments for more curvature
        spacing: 4, // Add spacing between segments
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false, // Hide the default legend
      },
      tooltip: {
        enabled: false, // Disable tooltips to match the image
      }
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top Bar */}
      <Header 
        notifications={notifications}
        setNotifOpen={setNotifOpen}
        notifOpen={notifOpen}
        handleLogout={handleLogout}
        theme={theme}
        handleThemeChange={handleThemeChange}
      />
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
      <main className={`flex-1 flex flex-col pl-0 pr-2 sm:px-4 md:px-8 py-4 md:py-8 gap-6 md:gap-8 overflow-y-auto ml-0 ${isNavExpanded ? 'sm:ml-48' : 'sm:ml-16'} transition-all duration-300 ease-in-out bg-gray-50`}>
        {mobileNav === 'dashboard' && selectedSection === 'dashboard' ? (
          // Dashboard Overview
          <div className="container px-3 sm:px-4">
            <h1 className="text-2xl font-bold uppercase fs-2 mb-8">HOME</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 gap-y-10 md:gap-y-14">
              {/* Request Overview Card */}
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-3 md:p-4 flex flex-col items-center justify-center max-h-[300px] overflow-y-auto`} data-component-name="Home">
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Request Overview</h2>
                <div className="flex flex-col items-center justify-center">
                  <div className="w-28 h-28 md:w-40 md:h-40 flex items-center justify-center relative" data-component-name="Home">
                    {loading ? (
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : error ? (
                      <div className="text-red-500 text-xs">Error loading data</div>
                    ) : (
                      <>
                        <Pie data={pieData} options={chartOptions} />
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <span className="text-2xl md:text-3xl font-bold">{totalRequests}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-3 flex justify-center gap-3 text-xs">
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
                            setToggleCleared(!toggleCleared);
                            setSelectedRows([]);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </button>
                      </div>
                      <div className="relative w-64">
                        <input
                          type="text"
                          placeholder="Search requests..."
                          className="sg-input"
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
                          highlightOnHoverStyle: {
                            backgroundColor: '#f1f5f9',
                          },
                        },
                        cells: {
                          style: {
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            paddingTop: '12px',
                            paddingBottom: '12px',
                          },
                        },
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
                              onClick={() => {
                                console.log('Process selected', selectedRows);
                              }}
                            >
                              Process
                            </button>
                            <button 
                              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                              onClick={() => {
                                console.log('Delete selected', selectedRows);
                              }}
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
            <div>
              <RequestDashboard />
            </div>
          ) : selectedSection === 'admin' ? (
            <div>
              {location.pathname === '/admin-fields' ? (
                <AdminFields />
              ) : location.pathname === '/admin-fields-lookup' ? (
                <AdminFieldsLookupPage />
              ) : location.pathname === '/admin-forms-groups' ? (
                <AdminFormsGroups />
              ) : location.pathname.startsWith('/admin-form-group-fields/') ? (
                <AdminFormGroupFieldsPage />
              ) : location.pathname === '/admin-user-management' ? (
                <AdminUserManagement />
              ) : location.pathname === '/profile' ? (
                <Profile />
              ) : location.pathname === '/change-password' ? (
                <ChangePassword />
              ) : location.pathname === '/style-guide' ? (
                <StyleGuide />
              ) : (
                <AdminDashboard onShowUserManagement={() => navigate('/admin-user-management')} />
              )}
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

import { useState, useEffect, useRef } from 'react';
import {
  LogOut, User, FileText,
  LayoutDashboard, ChevronLeft, ChevronRight, Sliders, Send, MessageSquareText,
  Building2, Settings, KeyRound, Bell, SunMoon, Landmark, Globe, Network
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { can } from '../utils/permissions';
import { useRequestState } from '../hooks/useRequestState';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
// Import the RequestModal component
import RequestModal from '../components/RequestModal';
import axios from 'axios';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/sidebar.css';
import '../styles/StatusBadge.css';
import MobileNavBar from '../components/MobileNavBar';
import DataTable from 'react-data-table-component';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import SendInvitesForm from '../components/SendInvitesForm';
import NotificationDropdown from '../components/NotificationDropdown';
import WhatsNewDropdown from '../components/WhatsNewDropdown';
import RoleSwitcher from '../components/UserProfileSwitcher';
import RequestDashboard from './RequestDashboard';
import RequestFulfillmentDashboard from './RequestFulfillmentDashboard';
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';
import JafarAdministration from './JafarAdministration';
import JafarUserManagement from './JafarUserManagement';
import JafarRoleSettings from './JafarRoleSettings';
import SiteAnalysis from './SiteAnalysis';
import SecurityReport from './SecurityReport';
import { Modal } from 'react-bootstrap';
import ViewNotice from './ViewNotice';
import AllNotices from './AllNotices';
import requestService from '../services/requestService';
import NewRequestModal from './NewRequestModal';
import AccountCreatorInviteModal from '../components/AccountCreatorInviteModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
import UpdateProfileModal from '../components/UpdateProfileModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import NotificationPreferencesModal from '../components/NotificationPreferencesModal';
import formService from '../services/formService';
import noticeService from '../services/noticeService';
import MyNoticesService from '../services/mynotices';
import WorkspaceSelector from '../components/WorkspaceSelector';
import WorkspaceManagement from '../components/WorkspaceManagement';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import ReactModal from 'react-modal';

ChartJS.register(ArcElement, ChartTooltip, Legend);

// Set the app element for react-modal
ReactModal.setAppElement('#root');

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

// Define NavItem interface
interface NavItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active: boolean;
  badge?: number;
  disabled?: boolean;
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
  FORM_ID: number | null;
  ABBREVIATION?: string;
  REQUEST_DESCRIPTION?: string;
  PRIORITY_LEVEL?: string;
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
  const location = useLocation();
  const { user } = useAuth();
  const { subscribeToRefresh } = useRequestState();
  const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'myRequests' | 'admin' | 'adminUserManagement' | 'jafarAdministration' | 'jafarUserManagement' | 'jafarRoleSettings' | 'jafarSiteAnalysis' | 'jafarSecurityReport' | 'apiManager' | 'notices' | 'workspaces'>('dashboard');
  const [mobileNav, setMobileNav] = useState<'dashboard' | 'search' | 'notifications' | 'profile'>('dashboard');
  const [isNavExpanded, setIsNavExpanded] = useState(true);

  // Get user role
  const getUserRole = () => {
    if (!user || !user.roles || user.roles.length === 0) return 'User';
    
    // Get the display name from the role object
    // The roles are now objects with id, name, and displayName properties
    const role = user.roles[0];
    return role.displayName || role.name || 'User';
  };
  
  // Check if user is admin (role ID 1 or 6)
  const isAdmin = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 ===== CHECKING ADMIN STATUS =====');
      console.log('🔐 User object:', user);
    }
    
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 No user - returning false');
      }
      return false;
    }
    
    // Check roles array (objects with id property) - Admin (1), JAFAR (6)
    const hasRoleInArray = user.roles?.some((role: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Checking role:', role, 'ID:', role.id, 'Is Admin (1)?', role.id === 1, 'Is JAFAR (6)?', role.id === 6);
      }
      return role.id === 1 || role.id === 6;
    });
    
    // Check role string property
    const hasRoleAsString = user.role === '1' || user.role === '6';
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Roles array:', user.roles);
      console.log('🔐 Role string:', user.role);
      console.log('🔐 hasRoleInArray:', hasRoleInArray);
      console.log('🔐 hasRoleAsString:', hasRoleAsString);
    }
    
    const result = hasRoleInArray || hasRoleAsString;
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Final admin result:', result);
    }
    
    return result;
  };
  
  // Check if user is account creator and should see invite modal
  const checkAccountCreatorInviteModal = async () => {
    if (hasCheckedAccountCreatorInvite) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 ===== SKIPPING ACCOUNT CREATOR INVITE CHECK - ALREADY CHECKED =====');
        console.log('🎯 hasCheckedAccountCreatorInvite:', hasCheckedAccountCreatorInvite);
      }
      return;
    }
    
    // Only check for admins (role ID 1 or 6)
    if (!isAdmin()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 User is not admin, skipping account creator invite check');
      }
      setHasCheckedAccountCreatorInvite(true);
      return;
    }

    // Guard: companyId must be defined before making API calls
    const companyId = user?.companyId || user?.COMPANY_ID;
    if (!companyId) {
      setHasCheckedAccountCreatorInvite(true);
      return;
    }

    // Check if user has already completed the invite modal
    if (user?.accountCreatorInviteCompleted || user?.ACCOUNT_CREATOR_INVITE_COMPLETED) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 User has already completed account creator invite modal');
      }
      setHasCheckedAccountCreatorInvite(true);
      return;
    }

    // Check if this user is the account creator (first user in their company)
    try {
      const companyUsers = await api.get(`/api/users/company/${companyId}`);
      const isAccountCreator = companyUsers?.data && companyUsers.data.length > 0 && 
                              companyUsers.data[0].USER_ID === user?.id;
      
      if (!isAccountCreator) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 User is not the account creator, skipping invite modal');
          console.log('🎯 First user in company:', companyUsers?.data?.[0]);
          console.log('🎯 Current user ID:', user?.id);
        }
        setHasCheckedAccountCreatorInvite(true);
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 ===== SHOWING ACCOUNT CREATOR INVITE MODAL =====');
        console.log('🎯 User is account creator and hasn\'t completed invite modal');
      }
      
      setShowAccountCreatorInviteModal(true);
      setHasCheckedAccountCreatorInvite(true);
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('🎯 Error checking account creator status:', error);
      }
      setHasCheckedAccountCreatorInvite(true);
    }
  };

  // Check if user has existing form templates (for first-time admin experience)
  const checkForExistingTemplates = async () => {
    if (hasCheckedForExistingTemplates) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 ===== SKIPPING TEMPLATE CHECK - ALREADY CHECKED =====');
        console.log('🔍 hasCheckedForExistingTemplates:', hasCheckedForExistingTemplates);
      }
      return;
    }
    
    // Only check for admins (role ID 1 or 6) who are account creators
    if (!isAdmin()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 User is not admin, skipping template check');
      }
      setHasCheckedForExistingTemplates(true);
      return;
    }

    // Guard: companyId must be defined before making API calls
    const companyId = user?.companyId || user?.COMPANY_ID;
    if (!companyId) {
      setHasCheckedForExistingTemplates(true);
      return;
    }

    // Check if this user is the account creator (first user in their company)
    // This logic assumes the account creator would typically be the first user ID in their company
    try {
      const companyUsers = await api.get(`/api/users/company/${companyId}`);
      const isAccountCreator = companyUsers?.data && companyUsers.data.length > 0 && 
                              companyUsers.data[0].USER_ID === user?.id;
      
      if (!isAccountCreator) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 User is not the account creator, skipping template check');
          console.log('🔍 First user in company:', companyUsers?.data?.[0]);
          console.log('🔍 Current user ID:', user?.id);
        }
        setHasCheckedForExistingTemplates(true);
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 User is account creator:', isAccountCreator);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Could not verify account creator status, proceeding with template check');
      }
      // Continue with template check even if we can't verify account creator status
    }
    
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 ===== CHECKING FOR EXISTING FORM TEMPLATES =====');
        console.log('🔍 User object:', user);
        console.log('🔍 User company ID:', user?.companyId, 'Type:', typeof user?.companyId);
        console.log('🔍 User is admin:', isAdmin());
      }
      
      const forms = await formService.getAllForms();
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 ===== FORMS FROM API =====');
        console.log('🔍 Raw forms from API:', forms);
        console.log('🔍 Forms array length:', forms?.length);
        console.log('🔍 Forms is array?', Array.isArray(forms));
      }
      
      if (forms && forms.length > 0 && process.env.NODE_ENV === 'development') {
        console.log('🔍 ===== FIRST FORM ANALYSIS =====');
        console.log('🔍 First form structure:', forms[0]);
        console.log('🔍 Available form properties:', Object.keys(forms[0]));
      }
      
      // Filter for company-specific templates (not global ones)
      const companyForms = forms?.filter(form => 
        form.COMPANY_ID === user?.companyId && 
        form.IS_ACTIVE && 
        !form.IS_DELETED
      ) || [];
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 ===== COMPANY TEMPLATE COUNT =====');
        console.log('🔍 Total company forms found:', companyForms?.length || 0);
        console.log('🔍 User company ID:', user?.companyId);
      }
      
      // If no company-specific templates exist, show the first-time workflow creation modal
      if (!companyForms || companyForms.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🚨 ===== SHOWING WORKFLOW MODAL =====');
          console.log('🚨 No existing company templates found, showing first-time workflow creation modal');
          console.log('🚨 Setting showFirstTimeWorkflowModal to true...');
        }
        setShowFirstTimeWorkflowModal(true);
        
        // Force a small delay and check if state was actually set
        if (process.env.NODE_ENV === 'development') {
          setTimeout(() => {
            console.log('🚨 Modal state after setting:', showFirstTimeWorkflowModal);
          }, 100);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ ===== NOT SHOWING WORKFLOW MODAL =====');
          console.log('✅ Found existing company templates, not showing modal');
          console.log('✅ Company template count:', companyForms.length);
        }
      }
      
      setHasCheckedForExistingTemplates(true);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 ===== TEMPLATE CHECK COMPLETE =====');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ ===== ERROR IN TEMPLATE CHECK =====');
        console.error('❌ Error checking for existing templates:', error);
      }
      setHasCheckedForExistingTemplates(true);
    }
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

  // --- User Profile Modal State ---
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showUpdateProfile, setShowUpdateProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showNotificationPreferences, setShowNotificationPreferences] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  // State for refresh button loading state
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State for assigned requests count
  const [assignedRequestsCount, setAssignedRequestsCount] = useState<number>(0);

  // Handle navigation state from other pages
  useEffect(() => {
    if (location.state && location.state.activeSection) {
      setSelectedSection(location.state.activeSection);
      // Clear the state after using it
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Fetch requests and notices when component mounts
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Home component mounted, fetching data...');
    }
    fetchRequests();
    fetchAssignedRequestsCount();
    fetchNotices();
  }, []);
  
  // Subscribe to global request state changes for real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToRefresh(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Global state refresh triggered - updating Home.tsx data');
      }
      fetchRequests();
      fetchAssignedRequestsCount();
    });
    
    return unsubscribe;
  }, [subscribeToRefresh]);
  
  // Check for account creator invite and templates when user is loaded (sequential flow)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 ===== USE EFFECT FOR ACCOUNT CREATOR AND TEMPLATE CHECKS =====');
      console.log('🔄 User exists:', !!user);
    }
    
    if (user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Calling checkAccountCreatorInviteModal first...');
      }
      // First check account creator invite, then templates
      checkAccountCreatorInviteModal();
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Not checking - user not loaded');
      }
    }
  }, [user]);

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

  // Theme menu state removed - now handled by UserProfileModal

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
  
  // Handle first-time workflow template creation
  const handleFirstTimeWorkflowSave = async (formData: any) => {
    console.log('Saving first-time workflow template:', formData);
    try {
      // Create the form using the formService
      const formToSave: any = {
        FORM_NAME: formData.name,
        FORM_DESCRIPTION: formData.description,
        IS_PUBLIC: true,
        IS_ACTIVE: true,
        IS_DELETED: false,
        FORM_TYPE: formData.formType?.toLowerCase() || 'request'
      };
      
      // Convert form fields to DB fields format if needed
      const fieldsToSave = formData.formFields?.map((field: any, index: number) => ({
        FIELD_NAME: field.fieldName,
        FIELD_TYPE_ID: field.dbFieldTypeId || 1, // Default to text if not specified
        IS_REQUIRED: field.required || false,
        OPTIONS: field.options || null,
        SEQUENCE: index + 1,
        IS_ACTIVE: true,
        IS_DELETED: false
      })) || [];
      
      await formService.createForm(formToSave, fieldsToSave);
      
      // Close the modal and show success
      setShowFirstTimeWorkflowModal(false);
      toast.success('Your first workflow template has been created successfully! You can now create requests using this template.');
      
      // Refresh the templates check to update the UI
      checkForExistingTemplates();
    } catch (error: any) {
      console.error('Error saving first-time workflow template:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to create workflow template. Please try again.');
    }
  };
  
  const handleFirstTimeWorkflowClose = () => {
    setShowFirstTimeWorkflowModal(false);
  };

  // Handle account creator invite modal completion
  const handleAccountCreatorInviteComplete = () => {
    setShowAccountCreatorInviteModal(false);
    // After invite modal completes, check for form templates
    setTimeout(() => {
      checkForExistingTemplates();
    }, 500);
  };

  const handleAccountCreatorInviteClose = () => {
    setShowAccountCreatorInviteModal(false);
    // If user closes without completing, still check templates
    setTimeout(() => {
      checkForExistingTemplates();
    }, 500);
  };

  const navItems: NavItem[] = [
    {
      icon: <LayoutDashboard className="w-6 h-6" />,
      label: 'Home',
      onClick: () => setSelectedSection('dashboard'),
      active: selectedSection === 'dashboard',
    },
    {
      icon: <FileText className="w-6 h-6" />,
      label: 'Requests',
      onClick: () => setSelectedSection('workorder'),
      active: selectedSection === 'workorder',
    },
    {
      icon: <User className="w-6 h-6" />,
      label: 'Assignments',
      onClick: () => {
        setSelectedSection('myRequests');
        // Refresh count when user navigates to assignments
        fetchAssignedRequestsCount();
      },
      active: selectedSection === 'myRequests',
      badge: assignedRequestsCount > 0 ? assignedRequestsCount : undefined,
    },
    {
      icon: <MessageSquareText className="w-6 h-6" />,
      label: 'Notices',
      onClick: () => setSelectedSection('notices'),
      active: selectedSection === 'notices',
    },
    // Super Admin only navigation items (role_id = 6)
    ...((user?.roles?.some((role: any) => role.id === 6) || user?.role === '6') ? [
      {
        icon: <Building2 className="w-6 h-6" />,
        label: 'Workspaces',
        onClick: () => setSelectedSection('workspaces'),
        active: selectedSection === 'workspaces',
      }
    ] : []),
    ...((user?.roles?.some((role: any) => role.id === 6) || user?.role === '6') ? [
      {
        icon: <Landmark className="w-6 h-6" />,
        label: 'AIM-Financial',
        onClick: () => window.open('https://aim-financial.netlify.app/', '_blank'),
        active: false,
      },
      {
        icon: <Globe className="w-6 h-6" />,
        label: 'AIM-Wildlife',
        onClick: () => window.open('https://aim-wildlife.netlify.app/', '_blank'),
        active: false,
      },
    ] : []),
    {
      icon: <Network className="w-6 h-6" />,
      label: 'API Vendor',
      onClick: () => {},
      active: false,
      disabled: true,
    },
    // Admin and Super Admin navigation items (role_id = 1 or 6)
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
    ] : []),
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
  const [requestSearchTerm, setRequestSearchTerm] = useState('');
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsPerPage, setRequestsPerPage] = useState(5);
  const [selectedRows, setSelectedRows] = useState<Request[]>([]);
  const [showRequestModal, setShowRequestModal] = useState<boolean>(false);
  const [currentRequest, setCurrentRequest] = useState<Request | null>(null);
  const [toggleCleared, setToggleCleared] = useState<boolean>(false);
  const [requestStatusData, setRequestStatusData] = useState<Array<{ label: string; value: number; color: string }>>([]);
  const [totalRequests, setTotalRequests] = useState<number>(0);
  
  // State for notices data
  const [notices, setNotices] = useState<any[]>([]);
  const [noticeStats, setNoticeStats] = useState<{
    totalNotices: number;
    unreadNotices: number;
    issuedByMe: number;
    activeNotices: number;
  }>({
    totalNotices: 0,
    unreadNotices: 0,
    issuedByMe: 0,
    activeNotices: 0
  });
  const [noticeStatusData, setNoticeStatusData] = useState<Array<{ label: string; value: number; color: string }>>([]);
  const [totalNoticesCount, setTotalNoticesCount] = useState<number>(0);
  const [filteredNotices, setFilteredNotices] = useState<any[]>([]);
  const [noticeSearchTerm, setNoticeSearchTerm] = useState('');
  const [noticesPage, setNoticesPage] = useState(1);
  const [noticesPerPage, setNoticesPerPage] = useState(5);
  const [isRefreshingNotices, setIsRefreshingNotices] = useState(false);
  const [viewNoticeId, setViewNoticeId] = useState<number | null>(null);
  
  // First-time admin workflow creation modal (for admins with no form templates)
  const [showFirstTimeWorkflowModal, setShowFirstTimeWorkflowModal] = useState(false);
  const [hasCheckedForExistingTemplates, setHasCheckedForExistingTemplates] = useState(false);
  
  // Account creator invite modal (for account creators on first login)
  const [showAccountCreatorInviteModal, setShowAccountCreatorInviteModal] = useState(false);
  const [hasCheckedAccountCreatorInvite, setHasCheckedAccountCreatorInvite] = useState(false);
  
  // User is already declared at the top of the component

  // Function to handle viewing a request
  const handleViewRequest = (request: Request) => {
    setCurrentRequest(request);
    setShowRequestModal(true);
  };

  // Priority helper functions
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'High':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
      case 'Standard':
        return <div className="w-2 h-2 bg-green-500 rounded-full"></div>;
      case 'Low':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full"></div>;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600';
      case 'Standard':
        return 'text-green-600';
      case 'Low':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };
  
  // Define columns for the requests table - optimized for mobile
  const requestColumns = [
    {
      name: 'Request ID',
      selector: (row: Request) => row.TRACKINGID || 'N/A',
      sortable: true,
      wrap: true,
      cell: (row: Request) => {
        const trackingId = row.TRACKINGID || 'N/A';
        return (
          <div className="tracking-id-cell text-xs sm:text-sm break-words leading-tight py-1">
            {trackingId}
          </div>
        );
      }
    },
    {
      name: 'Request Name',
      selector: (row: Request) => row.REQUEST_NAME || 'N/A',
      sortable: true,
      wrap: true,
      cell: (row: Request) => (
        <div className="text-xs sm:text-sm break-words py-1">
          {row.REQUEST_NAME || 'N/A'}
        </div>
      )
    },
    {
      name: 'Status',
      selector: (row: Request) => row.STATUS,
      sortable: true,
      cell: (row: Request) => {
        const statusMap: Record<string, { text: string; cls: string }> = {
          'P': { text: 'Pending', cls: 'status-badge--pending' },
          'A': { text: 'Active', cls: 'status-badge--active' },
          'D': { text: 'Complete', cls: 'status-badge--complete' },
          'I': { text: 'In Progress', cls: 'status-badge--inprogress' },
          'X': { text: 'Cancelled', cls: 'status-badge--cancelled' },
          'H': { text: 'On hold', cls: 'status-badge--onhold' },
          'R': { text: 'Rejected', cls: 'status-badge--rejected' },
        };
        const s = statusMap[row.STATUS] || { text: 'Unknown', cls: '' };
        return <span className={`status-badge ${s.cls}`}>{s.text}</span>;
      }
    },
    {
      name: 'Date',
      selector: (row: Request) => new Date(row.CREATE_DATE).toLocaleDateString(),
      sortable: true,
      cell: (row: Request) => (
        <div className="text-xs py-1 whitespace-nowrap">
          {new Date(row.CREATE_DATE).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: '2-digit'
          })}
        </div>
      )
    },
    {
      name: 'Type',
      selector: (row: Request) => row.ABBREVIATION || 'General',
      sortable: true,
      cell: (row: Request) => (
        <div className="text-xs py-1 whitespace-nowrap">
          {row.ABBREVIATION || 'General'}
        </div>
      )
    },
    {
      name: 'Priority',
      selector: (row: Request) => row.PRIORITY_LEVEL || 'Standard',
      sortable: true,
      cell: (row: Request) => (
        <div className="flex items-center gap-2 py-1">
          {getPriorityIcon(row.PRIORITY_LEVEL || 'Standard')}
        </div>
      )
    },
    {
      name: 'Requestor',
      selector: (row: Request) => row.requestorName,
      sortable: true,
      wrap: true,
      cell: (row: Request) => (
        <div className="text-xs sm:text-sm break-words py-1">
          {row.requestorName}
        </div>
      )
    },
    {
      name: 'Assigned',
      selector: (row: Request) => row.assignedName || 'Unassigned',
      sortable: true,
      wrap: true,
      cell: (row: Request) => (
        <div className="text-xs sm:text-sm break-words py-1">
          {row.assignedName || 'Unassigned'}
        </div>
      )
    }
  ];



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
  
  // Function to fetch assigned requests count
  const fetchAssignedRequestsCount = async () => {
    try {
      const assignedRequests = await requestService.getAssignedRequests();
      // Count only active assignments (not completed or cancelled)
      const activeCount = assignedRequests.filter(req => 
        req.STATUS && !['D', 'X'].includes(req.STATUS)
      ).length;
      setAssignedRequestsCount(activeCount);
    } catch (error) {
      console.error('Error fetching assigned requests count:', error);
      setAssignedRequestsCount(0);
    }
  };

  // Function to fetch requests and prepare chart data
  // When silent=true, skip the full loading spinner (used for manual refresh)
  const fetchRequests = async (silent = false) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Fetching requests...');
    }
    if (!silent) setLoading(true);
    setError(null);
    
    try {
      // Use axios directly with the full URL to bypass any proxy issues
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetching requests from backend server...');
      }
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('API response status:', response.status);
        console.log('API response headers:', response.headers);
      }
      
      const requestsData = response.data;
      if (process.env.NODE_ENV === 'development') {
        console.log('Requests data type:', typeof requestsData);
        console.log('Is array?', Array.isArray(requestsData));
      }
      
      if (Array.isArray(requestsData)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Successfully received array data, length:', requestsData.length);
        }
        setRequests(requestsData);
        setFilteredRequests(requestsData);
        setTotalRequests(requestsData.length);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error('Received non-array data from API:', requestsData);
        }
        setError('Invalid data format received from server');
      }
      
      // Prepare chart data for request status visualization - only main status types
      const statusCounts: Record<string, number> = {
        'P': 0, // Pending
        'A': 0, // Active
        'D': 0, // Complete (stored as 'D' for Done in DB)
        'X': 0  // Cancelled
      };
      
      // Count requests by status
      requestsData.forEach((req: Request) => {
        if (req.STATUS && statusCounts.hasOwnProperty(req.STATUS)) {
          statusCounts[req.STATUS]++;
        }
      });
      
      // Map to chart data format - only showing main statuses
      const chartData = [
        { label: 'Pending', value: statusCounts['P'], color: '#FBBF24' },
        { label: 'Active', value: statusCounts['A'], color: '#3B82F6' },
        { label: 'Complete', value: statusCounts['D'], color: '#10B981' },
        { label: 'Cancelled', value: statusCounts['X'], color: '#F97316' }
      ].filter(item => item.value > 0); // Only show statuses that have requests
      
      setRequestStatusData(chartData);
      
      // Also refresh assigned requests count
      fetchAssignedRequestsCount();
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Failed to load requests. Please try again.');
      toast.error('Failed to load requests');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Function to fetch notices data for dashboard
  const fetchNotices = async () => {
    // Fetch from the MY_NOTICES system for both the card and the chart
    try {
      const result = await MyNoticesService.getMyNotices({ limit: 1000 });
      const allNotices = result.data || [];

      // Store all notices for the Notices card
      setNotices(allNotices);
      setFilteredNotices(allNotices);

      // Build chart data
      let sentCount = 0;
      let draftCount = 0;
      allNotices.forEach((n) => {
        if (n.BUTTON_STATUS === 'Sent') sentCount++;
        else if (n.BUTTON_STATUS === 'Draft') draftCount++;
      });

      const chartItems = [
        { label: 'Sent', value: sentCount, color: '#10B981' },
        { label: 'Draft', value: draftCount, color: '#FBBF24' },
      ].filter(item => item.value > 0);

      setNoticeStatusData(chartItems);
      setTotalNoticesCount(allNotices.length);
    } catch (err) {
      console.error('Error fetching my-notices:', err);
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
        <div className="flex-1"></div>
        <div className="flex items-center gap-2 md:gap-3 relative" ref={profileMenuRef}>
          <WhatsNewDropdown className="mr-2" />
          <NotificationDropdown className="mr-2" />
          
          {/* Workspace Selector */}
          <WorkspaceSelector />
          
          {/* Role Switcher - Show for testing purposes */}
          {(user?.roles?.some((role: any) => role.id === 1 || role.id === 6) || user?.role === '1' || user?.role === '6' || 
            localStorage.getItem('roleSwitcherEnabled') === 'true') && (
            <RoleSwitcher className="mr-2" />
          )}
          
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
            <div className="absolute right-0 top-12 mt-2 w-56 bg-white rounded-lg shadow-sm border-t-4 border-t-secondary py-2 z-50 border border-gray-100 animate-fade-in">
              <button 
                className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" 
                onClick={() => {
                  setProfileMenuOpen(false);
                  setShowAccountSettings(true);
                }}
              >
                <Settings size={16} /> Account Settings
              </button>
              <button 
                className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" 
                onClick={() => {
                  setProfileMenuOpen(false);
                  setShowUpdateProfile(true);
                }}
              >
                <User size={16} /> Update Profile
              </button>
              <button 
                className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" 
                onClick={() => {
                  setProfileMenuOpen(false);
                  setShowChangePassword(true);
                }}
              >
                <KeyRound size={16} /> Change Password
              </button>
              <button 
                className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" 
                onClick={() => {
                  setProfileMenuOpen(false);
                  setShowNotificationPreferences(true);
                }}
              >
                <Bell size={16} /> Notification Preferences
              </button>
              <div className="relative">
                <div className="px-4 py-2 text-gray-700 text-sm font-medium border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <SunMoon size={16} /> Theme
                  </div>
                  <div className="ml-6 space-y-1">
                    {['light', 'dark', 'system'].map((themeOption) => (
                      <button
                        key={themeOption}
                        className={`w-full text-left px-2 py-1 rounded text-xs ${
                          theme === themeOption 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                        onClick={() => {
                          handleThemeChange(themeOption as 'light' | 'dark' | 'system');
                          localStorage.setItem('theme', themeOption);
                        }}
                      >
                        {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t my-2" />
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-red-600 text-sm" onClick={handleLogout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </header>
      {/* Enhanced Professional Sidebar - Guardian Brand Colors */}
      <nav 
        aria-label="Main navigation" 
        role="navigation"
        className={`hidden sm:flex flex-col ${isNavExpanded ? 'w-64' : 'w-16'} min-w-[64px]
          bg-white border-r border-gray-200
          h-[calc(100vh-4rem)] fixed top-16 left-0 z-50
          transition-all duration-300 ease-in-out`}
      >
        {/* Collapse toggle */}
        <div className={`flex items-center px-3 py-3 ${isNavExpanded ? 'justify-end' : 'justify-center'}`}>
          <button
            onClick={() => setIsNavExpanded(!isNavExpanded)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-3
              hover:text-primary hover:bg-gray-5/60 transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-secondary/40"
            aria-label={isNavExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isNavExpanded ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* World-Class Navigation Items */}
        <div className="flex flex-col px-3 py-6 flex-1 space-y-2" role="menu" aria-orientation="vertical">
          {navItems.map((item, index) => (
            <button
              key={index}
              onClick={item.disabled ? undefined : item.onClick}
              disabled={item.disabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  item.onClick();
                }
                // Enhanced keyboard navigation
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const nextButton = e.currentTarget.parentElement?.children[index + 1] as HTMLButtonElement;
                  nextButton?.focus();
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prevButton = e.currentTarget.parentElement?.children[index - 1] as HTMLButtonElement;
                  prevButton?.focus();
                }
              }}
              className={`group relative flex items-center w-full h-11
                ${isNavExpanded ? 'px-3' : 'justify-center px-0'}
                rounded-lg transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-secondary/40
                ${item.disabled
                  ? 'opacity-40 cursor-not-allowed text-gray-400'
                  : item.active
                    ? 'bg-secondary/10 text-primary font-semibold'
                    : 'text-gray-2 hover:text-primary hover:bg-gray-100'
                }`}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
              tabIndex={0}
              role="menuitem"
              data-tooltip-id={isNavExpanded ? undefined : "sidebar-tooltip"}
              data-tooltip-content={isNavExpanded ? undefined : item.label}
              style={(item.label === 'Invites' || item.label === 'Assignments') ? { display: 'none' } : undefined}
            >
              {item.active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-secondary rounded-r-full"></div>
              )}
              
              <div className="flex items-center justify-center w-8 h-8" aria-hidden="true">
                {item.icon}
              </div>
              
              {isNavExpanded && (
                <span className="ml-3 text-sm">
                  {item.label}
                </span>
              )}
              
              {item.badge && (
                <div className={`absolute ${isNavExpanded ? 'top-1.5 right-2' : 'top-0.5 right-0.5'}
                  bg-red-500 text-white text-xs font-semibold
                  rounded-full min-w-[18px] h-[18px] px-1
                  flex items-center justify-center`}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </div>
              )}
              
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-200">
          <button
            className={`group flex items-center w-full h-11
              ${isNavExpanded ? 'px-3' : 'justify-center px-0'}
              rounded-lg transition-colors duration-150
              text-gray-3 hover:text-error hover:bg-red-50
              focus:outline-none focus:ring-2 focus:ring-error/30`}
            onClick={handleLogout}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleLogout();
              }
            }}
            aria-label="Logout from application"
            tabIndex={0}
            data-tooltip-id={isNavExpanded ? undefined : "sidebar-tooltip"}
            data-tooltip-content={isNavExpanded ? undefined : "Logout"}
          >
            <div className="flex items-center justify-center w-8 h-8">
              <LogOut className="w-4 h-4" />
            </div>
            {isNavExpanded && (
              <span className="ml-3 text-sm">Logout</span>
            )}
          </button>
        </div>
        
        <Tooltip
          id="sidebar-tooltip"
          place="right"
          className="!bg-gray-900 !text-white !rounded-md !px-2.5 !py-1.5 !text-xs !font-medium !shadow-md"
        />
      </nav>
      {/* Main Content: Switchable Dashboard */}
      <main className={`flex-1 flex flex-col mt-16 px-2 sm:px-4 md:px-8 py-4 md:py-8 pb-20 sm:pb-8 gap-4 sm:gap-6 md:gap-8 overflow-y-auto ${isNavExpanded ? 'sm:ml-64' : 'sm:ml-16'} transition-all duration-500 ease-out bg-gray-50 min-h-[calc(100vh-64px)]`}>
        {mobileNav === 'dashboard' && selectedSection === 'dashboard' ? (
          // Dashboard Overview
          <div className="container max-w-full">
            <h1 className="text-2xl font-bold uppercase fs-2 mb-4 sm:mb-8">HOME</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
              {!can(user, 'home.requestOverview') && !can(user, 'home.requestQueue') && (
                <div className="md:col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
                  Welcome! Your assignments and notices are available from the sidebar.
                </div>
              )}
              {/* Request Overview Card */}
              {can(user, 'home.requestOverview') && (
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-xl shadow-sm border-t-4 border-t-secondary p-4 sm:p-6 flex flex-col h-64 sm:h-80 md:h-96 md:col-span-1 border border-gray-200`} data-component-name="Home">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-center flex-shrink-0">Request Overview</h2>
                <div className="flex flex-col items-center justify-center flex-1 min-h-0">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 flex items-center justify-center relative flex-shrink-0" data-component-name="Home">
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
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                          <span className="text-xl sm:text-2xl md:text-3xl font-bold">{totalRequests}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-2 sm:mt-3 flex justify-center gap-2 sm:gap-3 text-xs flex-shrink-0 flex-wrap">
                    {requestStatusData.map((s) => (
                      <div key={s.label} className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                        <span className="dark:text-gray-300">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              )}
              {/* Request Queue Card */}
              {can(user, 'home.requestQueue') && (
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-xl shadow-sm border-t-4 border-t-secondary p-4 sm:p-6 w-full md:col-span-3 border border-gray-200`} data-component-name="Home">
                <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Request Queue</h2>
                
                {error ? (
                  <div className="text-red-600 p-4 rounded bg-red-50">{error}</div>
                ) : loading ? (
                  <div className="flex justify-center items-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
                      <div className="flex items-center">
                        <button
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center"
                          onClick={() => {
                            setIsRefreshing(true);
                            fetchRequests(true).finally(() => {
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
                      <div className="relative w-full sm:w-64">
                        <input
                          type="text"
                          placeholder="Search requests..."
                          value={requestSearchTerm}
                          className="w-full py-2 px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-700 placeholder-gray-400 bg-gray-50"
                          onChange={(e) => {
                            const term = e.target.value;
                            setRequestSearchTerm(term);
                            setRequestsPage(1);
                            const search = term.toLowerCase();
                            if (search) {
                              setFilteredRequests(requests.filter(item =>
                                (item.REQUEST_NAME?.toLowerCase().includes(search)) ||
                                (item.TRACKINGID?.toLowerCase().includes(search)) ||
                                (item.STATUS?.toLowerCase().includes(search)) ||
                                (item.requestorName?.toLowerCase().includes(search)) ||
                                (item.assignedName?.toLowerCase().includes(search))
                              ));
                            } else {
                              setFilteredRequests(requests);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {(filteredRequests || requests).length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No requests found</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto mb-4">
                          <table className="w-full text-sm text-left">
                            <thead className="text-gray-600 border-b uppercase text-xs tracking-wider">
                              <tr>
                                <th className="pb-3 font-semibold">REQUEST ID</th>
                                <th className="pb-3 font-semibold">REQUEST NAME</th>
                                <th className="pb-3 font-semibold text-center">STATUS</th>
                                <th className="pb-3 font-semibold text-center">DATE</th>
                                <th className="pb-3 font-semibold text-center">TYPE</th>
                                <th className="pb-3 font-semibold text-center">PRIORITY</th>
                                <th className="pb-3 font-semibold text-center">REQUESTOR</th>
                                <th className="pb-3 font-semibold text-center">ASSIGNED</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(filteredRequests || requests).slice((requestsPage - 1) * requestsPerPage, requestsPage * requestsPerPage).map((row) => {
                                const statusMap: Record<string, { text: string; cls: string }> = {
                                  'P': { text: 'Pending', cls: 'status-badge--pending' },
                                  'A': { text: 'Active', cls: 'status-badge--active' },
                                  'D': { text: 'Complete', cls: 'status-badge--complete' },
                                  'I': { text: 'In Progress', cls: 'status-badge--inprogress' },
                                  'X': { text: 'Cancelled', cls: 'status-badge--cancelled' },
                                  'H': { text: 'On hold', cls: 'status-badge--onhold' },
                                  'R': { text: 'Rejected', cls: 'status-badge--rejected' },
                                };
                                return (
                                  <tr
                                    key={row.REQUEST_ID}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleViewRequest(row)}
                                  >
                                    <td className="py-3 text-xs sm:text-sm text-gray-800">{row.TRACKINGID || 'N/A'}</td>
                                    <td className="py-3 font-medium text-gray-800 text-xs sm:text-sm">{row.REQUEST_NAME || 'N/A'}</td>
                                    <td className="py-3 text-center">
                                      <span className={`status-badge ${statusMap[row.STATUS]?.cls || ''}`}>
                                        {statusMap[row.STATUS]?.text || 'Unknown'}
                                      </span>
                                    </td>
                                    <td className="py-3 text-center text-xs whitespace-nowrap text-gray-600">
                                      {new Date(row.CREATE_DATE).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                                    </td>
                                    <td className="py-3 text-center text-xs text-gray-600">{row.ABBREVIATION || 'General'}</td>
                                    <td className="py-3 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        {getPriorityIcon(row.PRIORITY_LEVEL || 'Standard')}
                                      </div>
                                    </td>
                                    <td className="py-3 text-center text-xs sm:text-sm text-gray-600">{row.requestorName}</td>
                                    <td className="py-3 text-center text-xs sm:text-sm text-gray-600">{row.assignedName || 'Unassigned'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {(() => {
                          const data = filteredRequests || requests;
                          const totalPages = Math.ceil(data.length / requestsPerPage);
                          const startRow = (requestsPage - 1) * requestsPerPage + 1;
                          const endRow = Math.min(requestsPage * requestsPerPage, data.length);
                          return (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-gray-200 pt-3 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <span>Records per page:</span>
                                <select
                                  value={requestsPerPage}
                                  onChange={(e) => { setRequestsPerPage(Number(e.target.value)); setRequestsPage(1); }}
                                  className="border border-gray-200 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                >
                                  {[5, 10, 15, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <span className="ml-2">{startRow}-{endRow} of {data.length}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setRequestsPage(1)} disabled={requestsPage === 1} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">&laquo;</button>
                                <button onClick={() => setRequestsPage(p => Math.max(1, p - 1))} disabled={requestsPage === 1} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">&lsaquo;</button>
                                <span className="px-3 py-1 text-sm">Page {requestsPage} of {totalPages}</span>
                                <button onClick={() => setRequestsPage(p => Math.min(totalPages, p + 1))} disabled={requestsPage === totalPages} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">&rsaquo;</button>
                                <button onClick={() => setRequestsPage(totalPages)} disabled={requestsPage === totalPages} className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">&raquo;</button>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </>
                )}
              </section>
              )}

              {/* Notices Overview Chart */}
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-xl shadow-sm border-t-4 border-t-blue-500 p-4 sm:p-6 flex flex-col h-64 sm:h-80 md:h-96 md:col-span-1 border border-gray-200`} data-component-name="Home">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-center flex-shrink-0">Notices Overview</h2>
                <div className="flex flex-col items-center justify-center flex-1 min-h-0">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 flex items-center justify-center relative flex-shrink-0" data-component-name="Home">
                    {noticeStatusData.length === 0 ? (
                      <div className="text-gray-400 text-xs text-center">No notice data</div>
                    ) : (
                      <>
                        <Pie data={{
                          labels: noticeStatusData.map(item => item.label),
                          datasets: [{
                            data: noticeStatusData.map(item => item.value),
                            backgroundColor: noticeStatusData.map(item => item.color),
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
                                  const total = noticeStatusData.reduce((sum, item) => sum + item.value, 0);
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
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                          <span className="text-xl sm:text-2xl md:text-3xl font-bold">{totalNoticesCount}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-2 sm:mt-3 flex justify-center gap-2 sm:gap-3 text-xs flex-shrink-0 flex-wrap">
                    {noticeStatusData.map((s) => (
                      <div key={s.label} className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                        <span className="dark:text-gray-300">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Notices Card */}
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-xl shadow-sm border-t-4 border-t-blue-500 p-4 sm:p-6 w-full md:col-span-3 border border-gray-200`} data-component-name="Home">
                <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Notices Queue</h2>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
                  <div className="flex items-center">
                    <button
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center"
                      onClick={() => {
                        setIsRefreshingNotices(true);
                        fetchNotices().finally(() => setIsRefreshingNotices(false));
                      }}
                      disabled={isRefreshingNotices}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${isRefreshingNotices ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {isRefreshingNotices ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search notices..."
                      value={noticeSearchTerm}
                      className="w-full py-2 px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 placeholder-gray-400 bg-gray-50"
                      onChange={(e) => {
                        const term = e.target.value;
                        setNoticeSearchTerm(term);
                        setNoticesPage(1);
                        const search = term.toLowerCase();
                        if (search) {
                          setFilteredNotices(notices.filter(n =>
                            (n.NOTICE_TITLE?.toLowerCase().includes(search)) ||
                            (n.SENSITIVITY_CLASSIFICATION?.toLowerCase().includes(search)) ||
                            (n.BUTTON_STATUS?.toLowerCase().includes(search)) ||
                            (n.DISTRIBUTION_TYPE?.toLowerCase().includes(search)) ||
                            (n.CREATE_USER_NAME?.toLowerCase().includes(search))
                          ));
                        } else {
                          setFilteredNotices(notices);
                        }
                      }}
                    />
                  </div>
                </div>

                {filteredNotices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquareText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{noticeSearchTerm ? 'No notices match your search' : 'No notices available'}</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm text-left">
                        <thead className="text-gray-600 border-b uppercase text-xs tracking-wider">
                          <tr>
                            <th className="pb-3 font-semibold">TITLE</th>
                            <th className="pb-3 font-semibold">SENSITIVITY</th>
                            <th className="pb-3 font-semibold text-center">STATUS</th>
                            <th className="pb-3 font-semibold text-center">TYPE</th>
                            <th className="pb-3 font-semibold text-center">CREATED BY</th>
                            <th className="pb-3 font-semibold text-center">DATE CREATED</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredNotices.slice((noticesPage - 1) * noticesPerPage, noticesPage * noticesPerPage).map((notice) => (
                            <tr
                              key={notice.NOTICE_ID}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => setViewNoticeId(notice.NOTICE_ID)}
                            >
                              <td className="py-3 font-medium text-gray-800">{notice.NOTICE_TITLE}</td>
                              <td className="py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 text-xs rounded-full font-medium ${
                                  notice.SENSITIVITY_CLASSIFICATION === 'CJIS' ? 'bg-red-500 text-white' :
                                  notice.SENSITIVITY_CLASSIFICATION === 'High' ? 'bg-yellow-100 text-yellow-700' :
                                  notice.SENSITIVITY_CLASSIFICATION === 'Medium' ? 'bg-blue-700 text-white' :
                                  'bg-gray-200 text-gray-700'
                                }`}>
                                  {notice.SENSITIVITY_CLASSIFICATION}
                                </span>
                              </td>
                              <td className="py-3 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 text-xs rounded-full font-medium ${
                                  notice.BUTTON_STATUS === 'Sent' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-200 text-gray-700'
                                }`}>
                                  {notice.BUTTON_STATUS}
                                </span>
                              </td>
                              <td className="py-3 text-center text-gray-600">{notice.DISTRIBUTION_TYPE}</td>
                              <td className="py-3 text-center text-gray-600">{notice.CREATE_USER_NAME}</td>
                              <td className="py-3 text-center text-gray-600">{new Date(notice.CREATE_DATE).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {(() => {
                      const totalPages = Math.ceil(filteredNotices.length / noticesPerPage);
                      const startRow = (noticesPage - 1) * noticesPerPage + 1;
                      const endRow = Math.min(noticesPage * noticesPerPage, filteredNotices.length);
                      return (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-gray-200 pt-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span>Records per page:</span>
                            <select
                              value={noticesPerPage}
                              onChange={(e) => { setNoticesPerPage(Number(e.target.value)); setNoticesPage(1); }}
                              className="border border-gray-200 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {[5, 10, 15, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span className="ml-2">{startRow}-{endRow} of {filteredNotices.length}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setNoticesPage(1)}
                              disabled={noticesPage === 1}
                              className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              &laquo;
                            </button>
                            <button
                              onClick={() => setNoticesPage(p => Math.max(1, p - 1))}
                              disabled={noticesPage === 1}
                              className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              &lsaquo;
                            </button>
                            <span className="px-3 py-1 text-sm">Page {noticesPage} of {totalPages}</span>
                            <button
                              onClick={() => setNoticesPage(p => Math.min(totalPages, p + 1))}
                              disabled={noticesPage === totalPages}
                              className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              &rsaquo;
                            </button>
                            <button
                              onClick={() => setNoticesPage(totalPages)}
                              disabled={noticesPage === totalPages}
                              className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              &raquo;
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </section>
            </div>
          </div>
        ) : mobileNav === 'search' ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-2xl gap-4 mb-6 px-4">
            <div className="text-center">Search (coming soon)</div>
          </div>
        ) : mobileNav === 'notifications' ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-2xl mb-6 px-4">
            <div className="text-center">Notifications (coming soon)</div>
          </div>
        ) : mobileNav === 'profile' ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-2xl mb-6 px-4">
            <div className="text-center">Profile (coming soon)</div>
          </div>
        ) : (
          // Existing desktop logic
          selectedSection === 'workorder' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <RequestDashboard />
            </div>
          ) : selectedSection === 'myRequests' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <RequestFulfillmentDashboard />
            </div>
          ) : selectedSection === 'admin' && user && ((user.roles && user.roles.some((role: any) => role.id === 1 || role.id === 6)) || user.role === '1' || user.role === '6') ? (
            <div className="mt-4 md:mt-6 mb-6">
              <AdminDashboard
                onShowUserManagement={() => setSelectedSection('adminUserManagement')}
                onShowJafarAdministration={() => setSelectedSection('jafarAdministration')}
                onShowJafarSiteAnalysis={() => setSelectedSection('jafarSiteAnalysis')}
                onShowJafarUserManagement={() => setSelectedSection('jafarUserManagement')}
                onShowJafarRoleSettings={() => setSelectedSection('jafarRoleSettings')}
                onShowJafarSecurityReport={() => setSelectedSection('jafarSecurityReport')}
              />
            </div>
          ) : selectedSection === 'adminUserManagement' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <AdminUserManagement />
            </div>
          ) : selectedSection === 'jafarAdministration' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <JafarAdministration />
            </div>
          ) : selectedSection === 'jafarUserManagement' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <JafarUserManagement />
            </div>
          ) : selectedSection === 'jafarSiteAnalysis' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <SiteAnalysis />
            </div>
          ) : selectedSection === 'jafarRoleSettings' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <JafarRoleSettings />
            </div>
          ) : selectedSection === 'jafarSecurityReport' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <SecurityReport />
            </div>
          ) : selectedSection === 'notices' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <AllNotices
                openCreateNotice={() => navigate('/my-notices/create')}
                openViewNotice={(noticeId) => navigate(noticeId ? `/my-notices/view-notice/${noticeId}` : '/my-notices/view-notice')}
                editNotice={(noticeId) => navigate(noticeId ? `/my-notices/edit/${noticeId}` : '/my-notices/create')}
              />
            </div>
          ) : selectedSection === 'workspaces' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <WorkspaceManagement />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-2xl mb-6">
              Select a section from the left nav
            </div>
          )
        )}
      </main>

      {/* Request Details Modal */}
      {showRequestModal && currentRequest && (
        <RequestModal
          request={currentRequest}
          show={showRequestModal}
          onHide={() => setShowRequestModal(false)}
          onUpdate={() => {
            // Refresh the requests data when modal updates
            fetchRequests();
            // Also refresh assigned requests count since assignments might have changed
            fetchAssignedRequestsCount();
          }}
        />
      )}
      
      {/* Account Creator Invite Modal */}
      <AccountCreatorInviteModal
        isOpen={showAccountCreatorInviteModal}
        onClose={handleAccountCreatorInviteClose}
        onComplete={handleAccountCreatorInviteComplete}
        userFirstName={user?.firstName || user?.FIRST_NAME || 'Admin'}
        companyName={user?.companyName || 'your organization'}
      />

      {/* First-time Workflow Template Creation Modal */}
      <NewRequestModal
        isOpen={showFirstTimeWorkflowModal}
        onClose={handleFirstTimeWorkflowClose}
        onSave={handleFirstTimeWorkflowSave}
      />
      
      {/* Individual User Profile Modals */}
      <AccountSettingsModal
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />
      
      <UpdateProfileModal
        isOpen={showUpdateProfile}
        onClose={() => setShowUpdateProfile(false)}
      />
      
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
      
      <NotificationPreferencesModal
        isOpen={showNotificationPreferences}
        onClose={() => setShowNotificationPreferences(false)}
      />
      
      {/* View Notice Modal */}
      <Modal show={viewNoticeId !== null} onHide={() => setViewNoticeId(null)} size="lg" scrollable centered>
        <Modal.Header closeButton>
          <Modal.Title>Notice Details & Responses</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewNoticeId && (
            <ViewNotice
              modalMode
              noticeId={viewNoticeId}
              onClose={() => setViewNoticeId(null)}
            />
          )}
        </Modal.Body>
      </Modal>

      {/* Mobile Bottom Nav */}
      <MobileNavBar
        selected={mobileNav}
        onSelect={(key) => {
          if (["dashboard", "search", "notifications", "profile"].includes(key)) {
            setMobileNav(key as 'dashboard' | 'search' | 'notifications' | 'profile');
            if (key === 'dashboard') setSelectedSection('dashboard');
          } else if (["workorder", "myRequests", "admin", "adminUserManagement", "jafarAdministration", "jafarUserManagement"].includes(key)) {
            // Handle dashboard dropdown selections
            setSelectedSection(key as 'dashboard' | 'workorder' | 'myRequests' | 'admin' | 'adminUserManagement' | 'jafarAdministration' | 'jafarUserManagement');
            setMobileNav('dashboard'); // Keep mobile nav on dashboard but change content
          }
        }}
        onCenterAction={handleCenterAction}
        onInvite={handleSendInvite}
      />
    </div>
  );
}

export default Home;

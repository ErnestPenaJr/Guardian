import { useState, useEffect, useRef } from 'react';
import {
  LogOut, User, FileText,
  LayoutDashboard, ChevronLeft, ChevronRight, Sliders, Send, MessageSquareText,
  Building2, Settings, KeyRound, Bell, SunMoon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRequestState } from '../hooks/useRequestState';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
// Import the RequestModal component
import RequestModal from '../components/RequestModal';
import axios from 'axios';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/sidebar.css';
import MobileNavBar from '../components/MobileNavBar';
import DataTable from 'react-data-table-component';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import SendInvitesForm from '../components/SendInvitesForm';
import NotificationDropdown from '../components/NotificationDropdown';
import RoleSwitcher from '../components/UserProfileSwitcher';
import RequestDashboard from './RequestDashboard';
import RequestFulfillmentDashboard from './RequestFulfillmentDashboard';
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';
import NoticesLandingPage from './NoticesLandingPage';
import requestService from '../services/requestService';
import NewRequestModal from './NewRequestModal';
import AccountCreatorInviteModal from '../components/AccountCreatorInviteModal';
import AccountSettingsModal from '../components/AccountSettingsModal';
import UpdateProfileModal from '../components/UpdateProfileModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import NotificationPreferencesModal from '../components/NotificationPreferencesModal';
import formService from '../services/formService';
import noticeService from '../services/noticeService';
import WorkspaceSelector from '../components/WorkspaceSelector';
import WorkspaceManagement from '../components/WorkspaceManagement';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import Modal from 'react-modal';

ChartJS.register(ArcElement, ChartTooltip, Legend);

// Set the app element for react-modal
Modal.setAppElement('#root');

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
  const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'myRequests' | 'admin' | 'adminUserManagement' | 'apiManager' | 'notices' | 'workspaces'>('dashboard');
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
    if (!user?.companyId && !user?.COMPANY_ID) {
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
      const companyUsers = await api.get(`/api/users/company/${user?.companyId}`);
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
  
  // Debug function to manually trigger template check (for testing)
  const debugCheckTemplates = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ===== MANUAL DEBUG TRIGGER =====');
      setHasCheckedForExistingTemplates(false);
      checkForExistingTemplates();
    }
  };
  
  // Debug function to manually show/hide modal (for testing)
  const debugToggleModal = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ===== MANUAL MODAL TOGGLE =====');
      console.log('🔧 Current showFirstTimeWorkflowModal:', showFirstTimeWorkflowModal);
      console.log('🔧 Current user:', user);
      setShowFirstTimeWorkflowModal(!showFirstTimeWorkflowModal);
    }
  };
  
  // Debug function to manually show modal (for testing)
  const debugShowModal = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ===== MANUAL MODAL SHOW =====');
      console.log('🔧 Current showFirstTimeWorkflowModal:', showFirstTimeWorkflowModal);
      console.log('🔧 Setting to true...');
      setShowFirstTimeWorkflowModal(true);
      setTimeout(() => {
        console.log('🔧 Modal state after setting:', showFirstTimeWorkflowModal);
      }, 100);
    }
  };
  
  // Debug function to check current state
  const debugCurrentState = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ===== CURRENT STATE DEBUG =====');
      console.log('🔧 showFirstTimeWorkflowModal:', showFirstTimeWorkflowModal);
      console.log('🔧 hasCheckedForExistingTemplates:', hasCheckedForExistingTemplates);
      console.log('🔧 user:', user);
      console.log('🔧 isAdmin():', isAdmin());
      console.log('🔧 user?.companyId:', user?.companyId);
    }
  };
  
  // Debug function to examine templates data
  const debugTemplatesData = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 ===== TEMPLATES DATA DEBUG =====');
      try {
        const forms = await formService.getAllForms();
        console.log('🔧 All forms from API:', forms);
        console.log('🔧 Forms count:', forms?.length);
        
        const companyForms = forms?.filter(form => 
          form.COMPANY_ID === user?.companyId && 
          form.IS_ACTIVE && 
          !form.IS_DELETED
        ) || [];
        
        console.log('🔧 Company-specific forms:', companyForms);
        console.log('🔧 Company forms count:', companyForms?.length);
        
        if (forms && forms.length > 0) {
          console.log('🔧 First form sample:', forms[0]);
          console.log('🔧 Available properties:', Object.keys(forms[0]));
          
          // Show all forms
          forms.forEach((form, index) => {
            console.log(`🔧 Form ${index + 1}: "${form.FORM_NAME}" - ID: ${form.FORM_ID} - Company: ${form.COMPANY_ID}`);
          });
        }
        
        console.log('🔧 Should show modal?', !companyForms || companyForms.length === 0);
      } catch (error) {
        console.error('🔧 Error fetching templates data:', error);
      }
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
      label: 'My Requests',
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
    // Super Admin only navigation items (role_id = 6)
    ...((user?.roles?.some((role: any) => role.id === 6) || user?.role === '6') ? [
      {
        icon: <MessageSquareText className="w-6 h-6" />,
        label: 'Notices',
        onClick: () => setSelectedSection('notices'),
        active: selectedSection === 'notices',
      },
      {
        icon: <Building2 className="w-6 h-6" />,
        label: 'Workspaces',
        onClick: () => setSelectedSection('workspaces'),
        active: selectedSection === 'workspaces',
      }
    ] : []),
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
        const statusColor = {
          'P': 'bg-yellow-200 text-yellow-800',
          'A': 'bg-blue-200 text-blue-800',
          'D': 'bg-green-200 text-green-800',
          'I': 'bg-cyan-200 text-cyan-800',
          'X': 'bg-orange-200 text-orange-800',
          'H': 'bg-purple-200 text-purple-800',
          'R': 'bg-red-200 text-red-800'
        }[row.STATUS] || 'bg-gray-200 text-gray-800';
        
        const statusText = {
          'P': 'Pending',
          'A': 'Active',
          'D': 'Complete',
          'I': 'In Progress',
          'X': 'Cancelled',
          'H': 'On Hold',
          'R': 'Rejected'
        }[row.STATUS] || 'Unknown';

        return (
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${statusColor} inline-block whitespace-nowrap`}>
            {statusText}
          </span>
        );
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
  const fetchRequests = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Fetching requests...');
    }
    setLoading(true);
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
      setLoading(false);
    }
  };

  // Function to fetch notices data for dashboard
  const fetchNotices = async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetching notices for dashboard...');
      }
      
      // Get recent notices for current user
      const myNotices = await noticeService.getMyNotices({ 
        unreadOnly: false 
      });
      
      // Get notice statistics
      const stats = await noticeService.getNoticeStats();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('My notices:', myNotices);
        console.log('Notice stats:', stats);
      }
      
      setNotices(myNotices.slice(0, 5)); // Show recent 5 notices on dashboard
      setNoticeStats(stats);
      
    } catch (err) {
      console.error('Error fetching notices:', err);
      // Don't show error toast for notices to avoid overwhelming users
      // Just log the error and continue
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
              onClick={item.onClick}
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
                ${item.active
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
              {/* Request Overview Card */}
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
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
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
              {/* Request Queue Card */}
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
                      <div className="relative w-full sm:w-64">
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
                    
                    <div className="w-full mb-8">
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
                        onRowClicked={handleViewRequest}
                        pointerOnHover
                        sortServer={false}
                        defaultSortFieldId={1}
                        defaultSortAsc={false}
                        responsive
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
                              fontSize: '14px',
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
                              paddingLeft: '12px',
                              paddingRight: '12px',
                              paddingTop: '12px',
                              paddingBottom: '12px',
                              fontWeight: 'bold',
                            },
                          },
                          rows: {
                            style: {
                              backgroundColor: '#ffffff',
                              minHeight: '52px',
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
                          },
                          pagination: {
                            style: {
                              borderTopStyle: 'solid',
                              borderTopWidth: '1px',
                              borderTopColor: '#e2e8f0',
                              backgroundColor: '#f8fafc',
                              padding: '8px 12px',
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
                    </div>
                  </>
                )}
              </section>

              {/* My Notices Card */}
              <section className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} rounded-xl shadow-sm border-t-4 border-t-blue-500 p-4 sm:p-6 w-full md:col-span-4 border border-gray-200 mt-4`} data-component-name="Home">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h2 className="text-base md:text-lg font-semibold">My Notices</h2>
                  <div className="flex items-center gap-3">
                    {noticeStats.unreadNotices > 0 && (
                      <span className="bg-aqua-500 text-white text-xs px-2 py-1 rounded-full">
                        {noticeStats.unreadNotices} unread
                      </span>
                    )}
                    <button
                      onClick={() => navigate('/notices')}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View All
                    </button>
                  </div>
                </div>
                
                {notices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquareText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No notices available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notices.slice(0, 5).map((notice) => (
                      <div
                        key={notice.NOTICE_ID}
                        className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                          notice._isRead ? 'border-gray-200' : 'border-blue-300 bg-blue-50'
                        }`}
                        onClick={() => window.open(`/notices/${notice.NOTICE_ID}`, '_blank')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-sm font-medium truncate ${
                                notice._isRead ? 'text-gray-900' : 'text-blue-900 font-bold'
                              }`}>
                                {notice.TITLE}
                              </h3>
                              {!notice._isRead && (
                                <span className="bg-aqua-500 text-white text-xs px-2 py-1 rounded-full">
                                  NEW
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                              {notice.CONTENT?.substring(0, 100)}...
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>
                                By: {notice.ISSUED_BY_USER?.FIRST_NAME} {notice.ISSUED_BY_USER?.LAST_NAME}
                              </span>
                              <span>
                                {new Date(notice.ISSUE_DATE || notice.CREATE_DATE).toLocaleDateString()}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                notice.STATUS === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                                notice.STATUS === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {notice.STATUS}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : mobileNav === 'search' ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-2xl gap-4 mb-6 px-4">
            <div className="text-center">Search (coming soon)</div>
            {/* Debug buttons - development only */}
            {process.env.NODE_ENV === 'development' && (
              <div className="flex flex-col gap-2 text-sm">
              <button 
                onClick={debugCheckTemplates}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                🔧 Debug: Check Templates
              </button>
              <button 
                onClick={debugToggleModal}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                🔧 Debug: Toggle Modal
              </button>
              <button 
                onClick={debugShowModal}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                🔧 Debug: Force Show Modal
              </button>
              <button 
                onClick={debugCurrentState}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                🔧 Debug: Check State
              </button>
              <button 
                onClick={debugTemplatesData}
                className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
              >
                🔧 Debug: Check Templates
              </button>
              <div className="text-xs text-gray-600">
                Modal State: {showFirstTimeWorkflowModal ? 'SHOWING' : 'HIDDEN'}
              </div>
              <div className="text-xs text-gray-600">
                Has Checked Templates: {hasCheckedForExistingTemplates ? 'YES' : 'NO'}
              </div>
              <div className="text-xs text-gray-600">
                User ID: {user?.id || 'N/A'}
              </div>
              <div className="text-xs text-gray-600">
                Is Admin: {isAdmin() ? 'YES' : 'NO'}
              </div>
            </div>
            )}
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
              <AdminDashboard onShowUserManagement={() => setSelectedSection('adminUserManagement')} />
            </div>
          ) : selectedSection === 'adminUserManagement' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <AdminUserManagement />
            </div>
          ) : selectedSection === 'notices' ? (
            <div className="mt-4 md:mt-6 mb-6">
              <NoticesLandingPage />
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
      
      {/* Debug: Show modal state in UI */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'red',
          color: 'white',
          padding: '10px',
          zIndex: 9999,
          fontSize: '12px'
        }}>
          Modal State: {showFirstTimeWorkflowModal ? 'OPEN' : 'CLOSED'}
        </div>
      )}
      {/* Mobile Bottom Nav */}
      <MobileNavBar
        selected={mobileNav}
        onSelect={(key) => {
          if (["dashboard", "search", "notifications", "profile"].includes(key)) {
            setMobileNav(key as 'dashboard' | 'search' | 'notifications' | 'profile');
            if (key === 'dashboard') setSelectedSection('dashboard');
          } else if (["workorder", "myRequests", "admin", "adminUserManagement"].includes(key)) {
            // Handle dashboard dropdown selections
            setSelectedSection(key as 'dashboard' | 'workorder' | 'myRequests' | 'admin' | 'adminUserManagement');
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

import React from 'react';
import { Outlet } from 'react-router-dom';

interface AdminLayoutProps {
  children?: React.ReactNode;
}

/**
 * AdminLayout - A minimal layout component for admin pages
 * This provides consistent structure for admin pages without duplicating the sidebar
 */
const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Determine section based on URL path
  const getSectionFromPath = (path: string) => {
    if (path === '/my-requests') return 'workorder';
    if (path === '/settings') return 'admin';
    if (path.includes('admin-fields') || path.includes('admin-forms-groups')) return 'admin';
    return 'dashboard'; // Default to dashboard for /home or /dashboard
  };
  
  const [selectedSection, setSelectedSection] = useState<'dashboard' | 'workorder' | 'admin' | 'adminUserManagement' | 'apiManager'>(getSectionFromPath(location.pathname));
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeMenuDirection, setThemeMenuDirection] = useState<'left' | 'right'>('right');

  // Update selected section when URL changes
  useEffect(() => {
    const section = getSectionFromPath(location.pathname);
    setSelectedSection(section);
  }, [location.pathname]);

  // Profile menu ref for clicking outside
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  
  // Handle clicking outside of profile menu
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

  // Handle theme menu positioning
  const handleThemeMenuOpen = () => {
    // Check if theme button is close to the right edge of screen
    if (themeButtonRef.current) {
      const rect = themeButtonRef.current.getBoundingClientRect();
      const rightSpace = window.innerWidth - rect.right;
      setThemeMenuDirection(rightSpace < 150 ? 'left' : 'right');
    }
    setThemeMenuOpen(true);
  };

  // Handle clicking outside of theme menu
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

  // Theme state
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

  // Application nav items
  const navItems = [
    {
      icon: <LayoutDashboard className="w-6 h-6" />,
      label: 'Dashboard',
      onClick: () => navigate('/dashboard'),
      active: selectedSection === 'dashboard',
    },
    {
      icon: <FileText className="w-6 h-6" />,
      label: 'My Requests',
      onClick: () => navigate('/my-requests'),
      active: selectedSection === 'workorder',
    },
    ...((user?.roles?.some((role: any) => role.id === 1 || role.id === 6) || user?.role === '1' || user?.role === '6') ? [
      {
        icon: <Sliders className="w-6 h-6" />,
        label: 'Settings',
        onClick: () => navigate('/settings'),
        active: selectedSection === 'admin',
      }
    ] : [])
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
    }).then((result: { isConfirmed: boolean }) => {
      if (result.isConfirmed) {
        try {
          // Clear user data from localStorage
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          
          // Show success message
          Swal.fire({
            title: 'Logged Out',
            text: 'You have been logged out locally',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          
          // Redirect to login page
          navigate('/login');
        } catch (error) {
          console.error('Logout error:', error);
          Swal.fire({
            title: 'Error',
            text: 'Failed to logout. Please try again.',
            icon: 'error'
          });
        }
      }
    });
  };
  
  // Get user role
  const getUserRole = () => {
    if (!user || !user.roles || user.roles.length === 0) return 'User';
    
    // Get the display name from the role object
    // The roles are now objects with id, name, and displayName properties
    const role = user.roles[0];
    return role.displayName || role.name || 'User';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar Navigation */}
      <nav 
        className={`fixed left-0 top-0 h-full bg-primary text-white flex flex-col items-center ${
          isNavExpanded ? 'w-60' : 'w-20'
        } z-20 transition-all duration-300 ease-in-out py-6`}
      >
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img 
            src="/logo-white.png" 
            alt="Guardian Logo" 
            className={`w-auto ${isNavExpanded ? 'h-8' : 'h-10'} mb-4`}
          />
        </div>
        
        {/* Toggle button */}
        <button
          onClick={() => setIsNavExpanded(!isNavExpanded)}
          className="absolute -right-3 top-[72px] bg-primary rounded-full p-1 text-white border border-white"
          aria-label={isNavExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isNavExpanded ? 
            <ChevronLeft className="w-4 h-4" /> :
            <ChevronRight className="w-4 h-4" />
          }
        </button>
        
        {/* Navigation Items */}
        <div className="flex flex-col items-center w-full">
          {navItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onClick}
              className={`flex items-center ${isNavExpanded ? 'justify-start px-4' : 'justify-center'} w-full h-14 mb-1 transition-all duration-150 hover:bg-[#4AB0B9]/70 ${
                item.active ? 'bg-[#4AB0B9]/70' : 'bg-transparent'
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

      {/* Header & Main Content */}
      <div className="flex flex-col w-full">
        {/* Header */}
        <header className={`fixed top-0 ${isNavExpanded ? 'left-60' : 'left-20'} right-0 h-16 bg-white border-b border-gray-200 z-10 transition-all duration-300 ease-in-out flex items-center justify-end px-5 gap-4`}>
          {/* User Profile */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2 cursor-pointer select-none p-1 rounded-full hover:bg-gray-100"
              aria-haspopup="true"
              aria-expanded={profileMenuOpen}
            >
              <div className="hidden md:block">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.fullName || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 truncate max-w-[160px]">
                    {getUserRole()}
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  (user?.firstName && user?.lastName)
                    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                    : (user?.fullName ? user.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U')
                )}
              </div>
            </button>
            {/* Profile Dropdown Menu */}
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
                    <FileText size={16} /> API Explorer
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
                <button className="w-full flex items-center gap-2 text-left px-4 py-2 text-red-600 hover:bg-red-50" onClick={handleLogout}>
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>
        
        {/* Main Content */}
        <main className={`flex-1 flex flex-col px-2 sm:px-4 md:px-8 py-4 md:py-8 gap-6 md:gap-8 overflow-y-auto ${isNavExpanded ? 'ml-48' : 'ml-16'} transition-all duration-300 ease-in-out bg-gray-50`}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

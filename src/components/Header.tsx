import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FaCode } from 'react-icons/fa';
import {
  LogOut, User, Settings, KeyRound, Bell, SunMoon, Monitor
} from 'lucide-react';

interface HeaderProps {
  notifications: any[];
  setNotifOpen: React.Dispatch<React.SetStateAction<boolean>>;
  notifOpen: boolean;
  handleLogout: () => void;
  theme: 'light' | 'dark' | 'system';
  handleThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

const Header: React.FC<HeaderProps> = ({
  notifications,
  setNotifOpen,
  notifOpen,
  handleLogout,
  theme,
  handleThemeChange
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeMenuDirection, setThemeMenuDirection] = useState<'left' | 'right'>('right');
  
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);

  // Get user role for display
  const getUserRole = (): string => {
    if (!user) return '';
    
    if (user.roles && Array.isArray(user.roles)) {
      const adminRole = user.roles.find((role: any) => role.id === 1);
      if (adminRole) return 'Administrator';
      
      const developerRole = user.roles.find((role: any) => role.id === 6);
      if (developerRole) return 'Developer';
    }
    
    if (user.role === '1') return 'Administrator';
    if (user.role === '6') return 'Developer';
    
    return '';
  };

  // Handle theme menu direction based on available space
  const handleThemeMenuOpen = () => {
    if (themeButtonRef.current) {
      const rect = themeButtonRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.right;
      setThemeMenuDirection(spaceOnRight < 200 ? 'left' : 'right');
    }
    setThemeMenuOpen(true);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
        setThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 left-0 w-full h-16 bg-white shadow-md border-b-2 border-teal-500 flex items-center justify-between px-4 md:px-8 z-50">
      <div className="flex items-center gap-2 md:gap-3">
        <img src="/images/GuardianLogo.svg" alt="Guardian Logo" className="h-8 w-auto" />
        <span className="font-bold text-lg md:text-2xl text-gray-700 hidden sm:inline">Guardian</span>
      </div>
      <div className="flex-1 flex justify-center max-w-xs md:max-w-md py-2">
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Search requests..."
            className="sg-input"
            onChange={() => {
              // This functionality should be moved to the parent component
              // We'll keep the input but make it a controlled component
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
            <button 
              className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" 
              onClick={() => {
                navigate('/profile');
                setProfileMenuOpen(false);
              }}
            >
              <User size={16} /> Update Profile
            </button>
            {(user?.roles?.some((role: any) => role.id === 6) || user?.role === '6') && (
              <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" onClick={() => navigate('/api-explorer')}>
                <FaCode size={16} /> API Explorer
              </button>
            )}
            <button className="w-full flex items-center gap-2 text-left px-4 py-2 hover:bg-gray-100 text-gray-700 text-sm" onClick={() => navigate('/change-password')}>
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
  );
};

export default Header;

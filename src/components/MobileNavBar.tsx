import React, { useState, useRef, useEffect } from 'react';
import { Home, Bell, ChevronDown, Send, Shield } from 'lucide-react';

interface MobileNavBarProps {
  selected: string;
  onSelect: (key: string) => void;
  onCenterAction: () => void;
  onInvite: () => void;
}

const dashboards = [
  { key: 'dashboard', label: 'Main Dashboard' },
  { key: 'workorder', label: 'Requests Dashboard' },
  { key: 'myRequests', label: 'My Assignments' },
  { key: 'admin', label: 'Admin' },
  { key: 'adminUserManagement', label: 'User Management' },
];

const MobileNavBar: React.FC<MobileNavBarProps> = ({ selected, onSelect, onCenterAction, onInvite }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <nav 
      className="sm:hidden fixed bottom-0 left-0 w-full 
        bg-gradient-to-t from-white via-white/98 to-white/95 
        backdrop-blur-lg border-t border-gray-200/50 
        z-50 flex justify-between items-center px-4 h-20 
        shadow-2xl shadow-black/5"
      role="navigation"
      aria-label="Mobile navigation"
    >
      
      {/* Home Button */}
      <button
        className={`group flex flex-col items-center flex-1 py-2 px-1 rounded-xl
          transition-all duration-300 ease-out
          ${selected === 'dashboard' 
            ? 'bg-primary/5 text-primary' 
            : 'text-gray-500 hover:text-primary hover:bg-primary/5'
          }`}
        aria-label="Home"
        onClick={() => onSelect('dashboard')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect('dashboard');
          }
        }}
        tabIndex={0}
      >
        <div className={`p-2 rounded-lg transition-all duration-300 ${
          selected === 'dashboard' 
            ? 'bg-primary/10 shadow-lg shadow-primary/20' 
            : 'group-hover:bg-primary/10'
        }`}>
          <Home className="w-5 h-5" />
        </div>
        <span className="text-xs mt-1 font-medium">Home</span>
        {selected === 'dashboard' && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full"></div>
        )}
      </button>
      
      {/* Dashboards Dropdown */}
      <div className={`relative flex-1 flex flex-col items-center py-2 px-1 rounded-xl
        transition-all duration-300 ease-out
        ${dropdownOpen 
          ? 'bg-primary/5 text-primary' 
          : 'text-gray-500 hover:text-primary hover:bg-primary/5'
        }`} ref={dropdownRef}>
        <button
          className="flex flex-col items-center w-full group"
          aria-label="Dashboards"
          onClick={() => setDropdownOpen((v) => !v)}
        >
          <div className={`p-2 rounded-lg transition-all duration-300 ${
            dropdownOpen 
              ? 'bg-primary/10 shadow-lg shadow-primary/20' 
              : 'group-hover:bg-primary/10'
          }`}>
            <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </div>
          <span className="text-xs mt-1 font-medium">Dashboards</span>
        </button>
        
        {dropdownOpen && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 
            bg-white/95 backdrop-blur-xl border border-gray-200/50 
            rounded-2xl shadow-2xl shadow-black/10 z-50 w-48 
            overflow-hidden animate-fade-in">
            <div className="py-2">
              {dashboards.map((item, index) => (
                <button
                  key={item.key}
                  className={`w-full text-left px-4 py-3 text-sm transition-all duration-200
                    flex items-center space-x-3 group
                    ${selected === item.key 
                      ? 'bg-primary/10 text-primary font-semibold border-l-4 border-primary' 
                      : 'text-gray-700 hover:bg-primary/5 hover:text-primary'
                    }`}
                  onClick={() => {
                    setDropdownOpen(false);
                    onSelect(item.key);
                  }}
                >
                  <div className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    selected === item.key ? 'bg-primary' : 'bg-gray-300 group-hover:bg-primary/50'
                  }`}></div>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Enhanced Center Action Button */}
      <button
        className="absolute left-1/2 -translate-x-1/2 -top-4 
          bg-gradient-to-br from-secondary via-secondary/95 to-secondary/90
          hover:from-secondary/90 hover:via-secondary/85 hover:to-secondary/80
          active:from-secondary active:via-secondary active:to-secondary
          rounded-full shadow-2xl shadow-secondary/30 p-4 
          border-4 border-white/90 backdrop-blur-sm z-50
          transition-all duration-300 ease-out
          hover:scale-110 active:scale-95
          focus:outline-none focus:ring-4 focus:ring-secondary/20"
        aria-label="Center Action"
        onClick={onCenterAction}
      >
        <Shield className="w-6 h-6 text-white drop-shadow-sm" />
        <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
      </button>
      
      {/* Notifications Button */}
      <button
        className={`group flex flex-col items-center flex-1 py-2 px-1 rounded-xl
          transition-all duration-300 ease-out
          ${selected === 'notifications' 
            ? 'bg-primary/5 text-primary' 
            : 'text-gray-500 hover:text-primary hover:bg-primary/5'
          }`}
        aria-label="Notifications"
        onClick={() => onSelect('notifications')}
      >
        <div className={`p-2 rounded-lg transition-all duration-300 relative ${
          selected === 'notifications' 
            ? 'bg-primary/10 shadow-lg shadow-primary/20' 
            : 'group-hover:bg-primary/10'
        }`}>
          <Bell className="w-5 h-5" />
          {/* Optional notification dot */}
          {/* <div className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full animate-pulse"></div> */}
        </div>
        <span className="text-xs mt-1 font-medium">Notifications</span>
        {selected === 'notifications' && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full"></div>
        )}
      </button>
      
      {/* Invite Button */}
      <button
        className="group flex flex-col items-center flex-1 py-2 px-1 rounded-xl
          transition-all duration-300 ease-out
          text-secondary hover:text-secondary/80 hover:bg-secondary/5"
        aria-label="Invite"
        onClick={onInvite}
      >
        <div className="p-2 rounded-lg transition-all duration-300 group-hover:bg-secondary/10 group-hover:shadow-lg group-hover:shadow-secondary/20">
          <Send className="w-5 h-5" />
        </div>
        <span className="text-xs mt-1 font-medium">Invite</span>
      </button>
    </nav>
  );
};

export default MobileNavBar;

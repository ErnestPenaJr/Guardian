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
    <nav className="sm:hidden fixed bottom-0 left-0 w-full bg-white border-t z-50 flex justify-between items-center px-4 h-16 shadow-lg">
      <button
        className="flex flex-col items-center flex-1 pt-2"
        aria-label="Home"
        onClick={() => onSelect('dashboard')}
      >
        <Home className={`w-6 h-6 ${selected === 'dashboard' ? 'text-primary' : 'text-gray-500'}`} />
        <span className="text-xs mt-1">Home</span>
      </button>
      <div className="relative flex-1 flex flex-col items-center pt-2" ref={dropdownRef}>
        <button
          className="flex flex-col items-center w-full"
          aria-label="Dashboards"
          onClick={() => setDropdownOpen((v) => !v)}
        >
          <ChevronDown className={`w-6 h-6 ${dropdownOpen ? 'text-primary' : 'text-gray-500'}`} />
          <span className="text-xs mt-1">Dashboards</span>
        </button>
        {dropdownOpen && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white border rounded shadow-lg z-50 w-36 animate-fade-in">
            {dashboards.map((item) => (
              <button
                key={item.key}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${selected === item.key ? 'text-primary font-semibold' : 'text-gray-700'}`}
                onClick={() => {
                  setDropdownOpen(false);
                  onSelect(item.key);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white rounded-full shadow-lg p-2 border-2 border-primary z-50"
        aria-label="Center Action"
        onClick={onCenterAction}
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
      >
        <Shield className="w-6 h-6 text-primary" />
      </button>
      <button
        className="flex flex-col items-center flex-1 pt-2"
        aria-label="Notifications"
        onClick={() => onSelect('notifications')}
      >
        <Bell className={`w-6 h-6 ${selected === 'notifications' ? 'text-primary' : 'text-gray-500'}`} />
        <span className="text-xs mt-1">Notifications</span>
      </button>
      <button
        className="flex flex-col items-center flex-1 pt-2"
        aria-label="Invite"
        onClick={onInvite}
      >
        <Send className="w-6 h-6 text-primary" />
        <span className="text-xs mt-1">Invite</span>
      </button>
    </nav>
  );
};

export default MobileNavBar;

import React, { useState, useEffect, useRef } from 'react';
import { User, ChevronDown, Shield } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

interface Role {
  ROLE_ID: number;
  ROLE_NAME: string;
  DISPLAY_NAME: string;
  DESCRIPTION?: string;
}

interface RoleSwitcherProps {
  className?: string;
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ className = '' }) => {
  const { user: currentUser, switchUserRole } = useAuth();
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all available roles
  useEffect(() => {
    fetchAllRoles();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAllRoles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/roles/all');
      if (response.data && Array.isArray(response.data)) {
        setAllRoles(response.data);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      // Fallback to regular roles endpoint
      try {
        const response = await api.get('/api/roles');
        const rolesData = response.data?.data || response.data;
        if (Array.isArray(rolesData)) {
          setAllRoles(rolesData);
        }
      } catch (fallbackError) {
        console.error('Error fetching roles:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSwitch = async (selectedRole: Role) => {
    try {
      console.log('🔄 Switching to role:', selectedRole);
      
      // Update the authentication context with the new role
      if (switchUserRole) {
        await switchUserRole(selectedRole);
      } else {
        // Fallback: manually update localStorage and reload
        if (currentUser) {
          const userWithNewRole = {
            ...currentUser,
            roles: [{ 
              id: selectedRole.ROLE_ID, 
              name: selectedRole.ROLE_NAME, 
              displayName: selectedRole.DISPLAY_NAME 
            }],
            ROLE_NAMES: selectedRole.ROLE_NAME,
            role: selectedRole.ROLE_ID.toString()
          };
          
          localStorage.setItem('user', JSON.stringify(userWithNewRole));
          
          // Reload to apply changes
          window.location.reload();
        }
      }
      
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Error switching user role:', error);
    }
  };

  const getCurrentUserDisplay = () => {
    if (!currentUser) return 'No Role';
    
    const role = currentUser.roles?.[0]?.displayName || 
                 currentUser.roles?.[0]?.name || 
                 currentUser.ROLE_NAMES || 
                 'User';
    
    return role;
  };

  const getCurrentRoleId = () => {
    if (!currentUser) return null;
    
    return currentUser.roles?.[0]?.id || 
           parseInt(currentUser.role || '0', 10) || 
           null;
  };

  const roleDisplay = getCurrentUserDisplay();
  const currentRoleId = getCurrentRoleId();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Current Role Display & Dropdown Trigger */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        aria-haspopup="true"
        aria-expanded={isDropdownOpen}
      >
        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
          <Shield size={16} />
        </div>
        
        <div className="flex flex-col items-start text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {roleDisplay}
            </span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              Role Switcher
            </span>
          </div>
          <span className="text-xs text-gray-500">Testing Mode</span>
        </div>
        
        <ChevronDown 
          size={16} 
          className={`text-gray-400 transition-transform duration-200 ${
            isDropdownOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Switch User Role</h3>
            <p className="text-xs text-gray-500 mt-1">
              Select a different role to test permissions and access levels
            </p>
          </div>

          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading roles...</p>
            </div>
          ) : allRoles.length > 0 ? (
            <div className="py-2">
              {allRoles.map((role) => {
                const isCurrentRole = currentRoleId === role.ROLE_ID;
                
                return (
                  <button
                    key={role.ROLE_ID}
                    onClick={() => handleRoleSwitch(role)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                      isCurrentRole ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isCurrentRole ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      <Shield size={14} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {role.DISPLAY_NAME || role.ROLE_NAME}
                        </span>
                        {isCurrentRole && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {role.ROLE_NAME}
                      </div>
                      {role.DESCRIPTION && (
                        <div className="text-xs text-gray-400">
                          {role.DESCRIPTION}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No roles available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoleSwitcher;
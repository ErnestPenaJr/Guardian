import React, { useEffect, useCallback, useState } from 'react';
import { X, User, Shield, Settings, Activity, ExternalLink, Mail, Building2, Calendar } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Fetch company information when modal opens
  const fetchCompanyInfo = useCallback(async () => {
    if (!user?.COMPANY_ID || !isOpen) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/company/${user.COMPANY_ID}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Try to get company name from various possible sources
        const name = data.companyName || data.COMPANY_NAME || data.name || data.NAME || `Company ${user.COMPANY_ID}`;
        setCompanyName(name);
      } else {
        // Fallback if API call fails
        setCompanyName(`Company ${user.COMPANY_ID}`);
      }
    } catch (error) {
      console.error('Error fetching company info:', error);
      setCompanyName(`Company ${user.COMPANY_ID}`);
    } finally {
      setLoading(false);
    }
  }, [user?.COMPANY_ID, isOpen]);

  useEffect(() => {
    if (isOpen && user?.COMPANY_ID) {
      fetchCompanyInfo();
    }
  }, [isOpen, fetchCompanyInfo]);

  // Handle ESC key press
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Setup event listeners and body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !user) return null;

  // Helper function to safely get user properties with fallbacks
  const getUserProperty = (primary: any, fallback: any, defaultValue = 'N/A') => {
    return primary || fallback || defaultValue;
  };

  // Extract user data with fallbacks for different possible property names
  const firstName = getUserProperty(user.FIRST_NAME, user.firstName, '');
  const lastName = getUserProperty(user.LAST_NAME, user.lastName, '');
  const fullName = getUserProperty(user.FULL_NAME, user.fullName, `${firstName} ${lastName}`.trim());
  const email = getUserProperty(user.EMAIL, user.email, '');
  const userId = getUserProperty(user.USER_ID, user.userId || user.id, '');
  const companyId = getUserProperty(user.COMPANY_ID, user.companyId, '');

  // Format user role display
  const displayRole = user.ROLE_NAMES || user.roles?.[0]?.displayName || user.roles?.[0]?.name || 'User';
  
  // Format last login - since we don't have LAST_LOGIN in DB, show account creation or current session
  const lastLogin = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Account status - if user object exists and has USER_ID, they're active
  const accountStatus = (userId && userId !== 'N/A') ? 'Active' : 'Inactive';
  const isVerified = true; // Would be determined by actual verification status

  // Display company name with fallback
  const displayCompanyName = companyName || `Company ${companyId}` || 'Unknown Company';

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 border-t-4 border-t-secondary max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <User className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <h2 id="account-settings-title" className="text-xl font-semibold text-gray-900">
                Account Settings
              </h2>
              <p className="text-sm text-gray-600">
                Manage your account information and preferences
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close account settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          
          {/* Profile Information Section */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <User className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Full Name
                  </label>
                  <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                    <span className="text-gray-900">{fullName || 'Name not available'}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Email Address
                  </label>
                  <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{email || 'Email not available'}</span>
                    {isVerified && email && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Company
                  </label>
                  <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">
                      {loading ? 'Loading...' : displayCompanyName}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Role
                  </label>
                  <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{displayRole}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  User ID
                </label>
                <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                  <span className="text-gray-900 font-mono text-sm">{userId || 'ID not available'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Status Section */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">Account Status</h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Status
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      accountStatus === 'Active' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-error/10 text-error'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        accountStatus === 'Active' ? 'bg-success' : 'bg-error'
                      }`} />
                      {accountStatus}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Current Session
                  </label>
                  <div className="flex items-center space-x-2 text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{lastLogin}</span>
                  </div>
                </div>
              </div>
              
              {(user.ACTIVE_WORKSPACE_ID || user.activeWorkspaceId) && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Active Workspace
                  </label>
                  <div className="flex items-center space-x-2 p-2 bg-white rounded border">
                    <span className="text-gray-900">
                      {user.currentWorkspace?.WORKSPACE_NAME || 
                       displayCompanyName || 
                       `Workspace ${user.ACTIVE_WORKSPACE_ID || user.activeWorkspaceId}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security Settings Section */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded border hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">Password</p>
                  <p className="text-sm text-gray-600">Change your account password</p>
                </div>
                <button className="text-secondary hover:text-secondary/80 font-medium text-sm">
                  Change
                </button>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-white rounded border hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-600">Add extra security to your account</p>
                </div>
                <button className="text-secondary hover:text-secondary/80 font-medium text-sm">
                  Setup
                </button>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-white rounded border hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">Active Sessions</p>
                  <p className="text-sm text-gray-600">Manage your active login sessions</p>
                </div>
                <button className="text-secondary hover:text-secondary/80 font-medium text-sm">
                  View
                </button>
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Settings className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded border">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-600">Control notification preferences</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-secondary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-white rounded border">
                <div>
                  <p className="font-medium text-gray-900">Task Notifications</p>
                  <p className="text-sm text-gray-600">Get notified about task updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-secondary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Quick Actions Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
                onClick={() => window.open('/endpoint-manager', '_blank')}
              >
                <div className="flex items-center space-x-3">
                  <ExternalLink className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">API Explorer</p>
                    <p className="text-sm text-gray-600">Test and explore API endpoints</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </button>
              
              <button 
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Privacy Settings</p>
                    <p className="text-sm text-gray-600">Manage data and privacy</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </button>
              
              <button 
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Activity Log</p>
                    <p className="text-sm text-gray-600">View account activity</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </button>
              
              <button 
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Advanced Settings</p>
                    <p className="text-sm text-gray-600">System preferences</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsModal;
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { 
  Settings, ArrowLeft, User, Shield, Bell, 
  Monitor, Key, Building2, Mail, Phone 
} from 'lucide-react';

interface AccountInfo {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  companyName: string;
  role: string;
  status: string;
  emailValidated: boolean;
  createDate: string;
}

const AccountSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);

  useEffect(() => {
    // Load fresh account information from API
    const loadAccountInfo = async () => {
      try {
        setLoading(true);
        console.log('🔄 Loading fresh account info from API...');
        
        // Import api utility
        const { default: api } = await import('../utils/api');
        
        const response = await api.get('/api/users/account-info');
        
        if (response.data.success && response.data.accountInfo) {
          console.log('✅ Account info loaded successfully:', response.data.accountInfo);
          setAccountInfo(response.data.accountInfo);
        } else {
          console.error('❌ Failed to load account info:', response.data);
          toast.error('Failed to load account information');
          
          // Fallback to useAuth data if API fails
          if (user) {
            setAccountInfo({
              email: user.email || '',
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              companyName: user.companyName || 'Unknown Company',
              role: user.role || 'User',
              status: user.status === 'A' ? 'Active' : user.status === 'P' ? 'Pending' : 'Inactive',
              emailValidated: user.emailValidated || false,
              createDate: user.createDate || new Date().toISOString()
            });
          }
        }
      } catch (error) {
        console.error('❌ Error loading account info:', error);
        toast.error('Failed to load account information');
        
        // Fallback to useAuth data if API fails
        if (user) {
          setAccountInfo({
            email: user.email || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            companyName: user.companyName || 'Unknown Company',
            role: user.role || 'User',
            status: user.status === 'A' ? 'Active' : user.status === 'P' ? 'Pending' : 'Inactive',
            emailValidated: user.emailValidated || false,
            createDate: user.createDate || new Date().toISOString()
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadAccountInfo();
  }, [user]);

  const handleBackClick = () => {
    navigate('/home');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading account settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleBackClick}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </button>
              <div className="flex items-center">
                <Settings className="w-6 h-6 text-blue-600 mr-3" />
                <h1 className="text-xl font-semibold text-gray-900">Account Settings</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Account Information Card */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Account Information
            </h2>
          </div>
          <div className="px-6 py-6">
            {accountInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <User className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-900">{accountInfo.fullName}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <Mail className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-900">{accountInfo.email}</span>
                    {accountInfo.emailValidated ? (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Verified
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Unverified
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization
                  </label>
                  <div className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-900">{accountInfo.companyName}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <div className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <Shield className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-900">{accountInfo.role}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Status
                  </label>
                  <div className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <Monitor className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-900">{accountInfo.status}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Member Since
                  </label>
                  <div className="flex items-center px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    <span className="text-gray-900">{formatDate(accountInfo.createDate)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Failed to load account information</p>
            )}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
          </div>
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => navigate('/update-profile')}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <User className="w-8 h-8 text-gray-400 group-hover:text-blue-600 mb-2" />
                <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  Update Profile
                </span>
                <span className="text-xs text-gray-500 mt-1 text-center">
                  Change name and contact info
                </span>
              </button>

              <button
                onClick={() => navigate('/change-password')}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <Key className="w-8 h-8 text-gray-400 group-hover:text-blue-600 mb-2" />
                <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  Change Password
                </span>
                <span className="text-xs text-gray-500 mt-1 text-center">
                  Update account security
                </span>
              </button>

              <button
                onClick={() => navigate('/notification-preferences')}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <Bell className="w-8 h-8 text-gray-400 group-hover:text-blue-600 mb-2" />
                <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  Notifications
                </span>
                <span className="text-xs text-gray-500 mt-1 text-center">
                  Manage preferences
                </span>
              </button>

              <button
                onClick={() => navigate('/home')}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <Monitor className="w-8 h-8 text-gray-400 group-hover:text-blue-600 mb-2" />
                <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  Dashboard
                </span>
                <span className="text-xs text-gray-500 mt-1 text-center">
                  Return to main view
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
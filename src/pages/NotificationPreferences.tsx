import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { 
  Bell, ArrowLeft, Save, X, Mail, Smartphone, 
  Volume2, CheckCircle2, AlertCircle, Settings 
} from 'lucide-react';

interface NotificationPreferences {
  emailNotifications: {
    requestAssignments: boolean;
    requestUpdates: boolean;
    systemAnnouncements: boolean;
    weeklyReports: boolean;
  };
  inAppNotifications: {
    requestAssignments: boolean;
    requestUpdates: boolean;
    mentions: boolean;
    systemAlerts: boolean;
  };
  frequency: {
    immediate: boolean;
    daily: boolean;
    weekly: boolean;
  };
}

const NotificationPreferences = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: {
      requestAssignments: true,
      requestUpdates: true,
      systemAnnouncements: true,
      weeklyReports: false
    },
    inAppNotifications: {
      requestAssignments: true,
      requestUpdates: true,
      mentions: true,
      systemAlerts: true
    },
    frequency: {
      immediate: true,
      daily: false,
      weekly: false
    }
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPreferences, setOriginalPreferences] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    // Check for changes
    if (originalPreferences) {
      const hasFormChanges = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
      setHasChanges(hasFormChanges);
    }
  }, [preferences, originalPreferences]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/notification-preferences');
      const userPrefs = response.data.preferences || preferences;
      setPreferences(userPrefs);
      setOriginalPreferences(userPrefs);
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      // Use default preferences if API call fails
      setOriginalPreferences(preferences);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (
    category: keyof NotificationPreferences,
    key: string,
    value: boolean
  ) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const handleFrequencyChange = (selectedFrequency: keyof NotificationPreferences['frequency']) => {
    setPreferences(prev => ({
      ...prev,
      frequency: {
        immediate: selectedFrequency === 'immediate',
        daily: selectedFrequency === 'daily',
        weekly: selectedFrequency === 'weekly'
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    
    try {
      await api.put('/api/users/notification-preferences', { preferences });
      toast.success('Notification preferences updated successfully');
      setOriginalPreferences(preferences);
      setHasChanges(false);
      
      // Navigate back after success
      setTimeout(() => {
        navigate('/account-settings');
      }, 1500);
      
    } catch (error: any) {
      console.error('Error updating notification preferences:', error);
      toast.error('Failed to update preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate('/account-settings');
      }
    } else {
      navigate('/account-settings');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading notification preferences...</p>
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
                onClick={handleCancel}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Account Settings
              </button>
              <div className="flex items-center">
                <Bell className="w-6 h-6 text-blue-600 mr-3" />
                <h1 className="text-xl font-semibold text-gray-900">Notification Preferences</h1>
              </div>
            </div>
            {hasChanges && (
              <div className="flex items-center text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                Unsaved changes
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Email Notifications */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-blue-600" />
                Email Notifications
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose which notifications you'd like to receive via email
              </p>
            </div>
            <div className="px-6 py-6 space-y-4">
              {Object.entries(preferences.emailNotifications).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {key === 'requestAssignments' && 'Request Assignments'}
                      {key === 'requestUpdates' && 'Request Status Updates'}
                      {key === 'systemAnnouncements' && 'System Announcements'}
                      {key === 'weeklyReports' && 'Weekly Reports'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {key === 'requestAssignments' && 'When a new request is assigned to you'}
                      {key === 'requestUpdates' && 'When request status changes or comments are added'}
                      {key === 'systemAnnouncements' && 'Important system updates and maintenance notices'}
                      {key === 'weeklyReports' && 'Weekly summary of your activity and pending requests'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={enabled}
                      onChange={(e) => handlePreferenceChange('emailNotifications', key, e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* In-App Notifications */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Smartphone className="w-5 h-5 mr-2 text-blue-600" />
                In-App Notifications
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Configure notifications that appear within the application
              </p>
            </div>
            <div className="px-6 py-6 space-y-4">
              {Object.entries(preferences.inAppNotifications).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {key === 'requestAssignments' && 'Request Assignments'}
                      {key === 'requestUpdates' && 'Request Updates'}
                      {key === 'mentions' && 'Mentions & Comments'}
                      {key === 'systemAlerts' && 'System Alerts'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {key === 'requestAssignments' && 'Show notifications for new assignments'}
                      {key === 'requestUpdates' && 'Show notifications for status changes and updates'}
                      {key === 'mentions' && 'Show notifications when you are mentioned in comments'}
                      {key === 'systemAlerts' && 'Show critical system alerts and warnings'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={enabled}
                      onChange={(e) => handlePreferenceChange('inAppNotifications', key, e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Notification Frequency */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Volume2 className="w-5 h-5 mr-2 text-blue-600" />
                Notification Frequency
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose how often you receive notifications
              </p>
            </div>
            <div className="px-6 py-6">
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    id="immediate"
                    type="radio"
                    name="frequency"
                    checked={preferences.frequency.immediate}
                    onChange={() => handleFrequencyChange('immediate')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="immediate" className="ml-3 block text-sm">
                    <span className="font-medium text-gray-900">Immediate</span>
                    <p className="text-gray-500">Receive notifications as they happen</p>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="daily"
                    type="radio"
                    name="frequency"
                    checked={preferences.frequency.daily}
                    onChange={() => handleFrequencyChange('daily')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="daily" className="ml-3 block text-sm">
                    <span className="font-medium text-gray-900">Daily Summary</span>
                    <p className="text-gray-500">Receive a daily digest of all notifications</p>
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="weekly"
                    type="radio"
                    name="frequency"
                    checked={preferences.frequency.weekly}
                    onChange={() => handleFrequencyChange('weekly')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="weekly" className="ml-3 block text-sm">
                    <span className="font-medium text-gray-900">Weekly Summary</span>
                    <p className="text-gray-500">Receive a weekly digest of all notifications</p>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <div className="flex items-start">
              <Settings className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-blue-900">Quick Actions</h3>
                <div className="mt-2 flex space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPreferences(prev => ({
                        ...prev,
                        emailNotifications: {
                          requestAssignments: true,
                          requestUpdates: true,
                          systemAnnouncements: true,
                          weeklyReports: true
                        },
                        inAppNotifications: {
                          requestAssignments: true,
                          requestUpdates: true,
                          mentions: true,
                          systemAlerts: true
                        }
                      }));
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreferences(prev => ({
                        ...prev,
                        emailNotifications: {
                          requestAssignments: false,
                          requestUpdates: false,
                          systemAnnouncements: false,
                          weeklyReports: false
                        },
                        inAppNotifications: {
                          requestAssignments: false,
                          requestUpdates: false,
                          mentions: false,
                          systemAlerts: false
                        }
                      }));
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Disable All
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 flex justify-between">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className={`flex items-center px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  saving || !hasChanges
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NotificationPreferences;
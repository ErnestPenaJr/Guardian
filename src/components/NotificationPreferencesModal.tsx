import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { X, Bell, Mail, Clock, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'react-toastify';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationPreferences {
  email: {
    requestAssignments: boolean;
    requestUpdates: boolean;
    systemAnnouncements: boolean;
    weeklyReports: boolean;
    taskAssignments: boolean;
    formSubmissions: boolean;
  };
  inApp: {
    requestAssignments: boolean;
    requestUpdates: boolean;
    mentionsInComments: boolean;
    systemAlerts: boolean;
    taskDeadlines: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly';
  doNotDisturbStart: string;
  doNotDisturbEnd: string;
  enableDoNotDisturb: boolean;
}

const defaultPreferences: NotificationPreferences = {
  email: {
    requestAssignments: true,
    requestUpdates: true,
    systemAnnouncements: true,
    weeklyReports: false,
    taskAssignments: true,
    formSubmissions: true,
  },
  inApp: {
    requestAssignments: true,
    requestUpdates: true,
    mentionsInComments: true,
    systemAlerts: true,
    taskDeadlines: true,
  },
  frequency: 'immediate',
  doNotDisturbStart: '22:00',
  doNotDisturbEnd: '08:00',
  enableDoNotDisturb: false,
};

const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current preferences on mount
  useEffect(() => {
    if (isOpen) {
      loadPreferences();
    }
  }, [isOpen]);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/notification-preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences({ ...defaultPreferences, ...data });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      // Use default preferences on error
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/notification-preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        toast.success('Notification preferences saved successfully');
        setHasChanges(false);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const updateEmailPreference = (key: keyof NotificationPreferences['email'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      email: { ...prev.email, [key]: value }
    }));
    setHasChanges(true);
  };

  const updateInAppPreference = (key: keyof NotificationPreferences['inApp'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      inApp: { ...prev.inApp, [key]: value }
    }));
    setHasChanges(true);
  };

  const updateFrequency = (frequency: NotificationPreferences['frequency']) => {
    setPreferences(prev => ({ ...prev, frequency }));
    setHasChanges(true);
  };

  const updateDoNotDisturb = (field: 'enableDoNotDisturb' | 'doNotDisturbStart' | 'doNotDisturbEnd', value: boolean | string) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Toggle Switch Component
  const ToggleSwitch: React.FC<{
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
  }> = ({ id, checked, onChange, label, description, disabled = false }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-900 block cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
      <div className="ml-4">
        <div className="relative">
          <input
            type="checkbox"
            id={id}
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="sr-only"
          />
          <div
            onClick={() => !disabled && onChange(!checked)}
            className={`
              w-11 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out
              ${checked ? 'bg-blue-600' : 'bg-gray-300'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div
              className={`
                w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out
                ${checked ? 'translate-x-5' : 'translate-x-0'}
                mt-0.5 ml-0.5
              `}
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Modal show={isOpen} onHide={onClose} size="lg" centered>
        <Modal.Body className="p-8 text-center">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading notification preferences...</span>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  return (
    <Modal show={isOpen} onHide={handleClose} size="lg" centered>
      <Modal.Header className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center">
          <Bell className="h-5 w-5 text-blue-600 mr-3" />
          <Modal.Title className="text-lg font-semibold text-gray-900">
            Notification Preferences
          </Modal.Title>
        </div>
        <button
          onClick={handleClose}
          className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </Modal.Header>

      <Modal.Body className="px-6 py-4 max-h-96 overflow-y-auto">
        <div className="space-y-6">
          {/* Email Notifications Section */}
          <div>
            <div className="flex items-center mb-4">
              <Mail className="h-5 w-5 text-gray-600 mr-2" />
              <h3 className="text-base font-semibold text-gray-900">Email Notifications</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <ToggleSwitch
                id="email-request-assignments"
                checked={preferences.email.requestAssignments}
                onChange={(checked) => updateEmailPreference('requestAssignments', checked)}
                label="Request Assignments"
                description="When a new request is assigned to you"
              />
              <ToggleSwitch
                id="email-request-updates"
                checked={preferences.email.requestUpdates}
                onChange={(checked) => updateEmailPreference('requestUpdates', checked)}
                label="Request Updates"
                description="Status changes and progress updates on your requests"
              />
              <ToggleSwitch
                id="email-task-assignments"
                checked={preferences.email.taskAssignments}
                onChange={(checked) => updateEmailPreference('taskAssignments', checked)}
                label="Task Assignments"
                description="When a task is assigned to you"
              />
              <ToggleSwitch
                id="email-form-submissions"
                checked={preferences.email.formSubmissions}
                onChange={(checked) => updateEmailPreference('formSubmissions', checked)}
                label="Form Submissions"
                description="When someone submits a form you manage"
              />
              <ToggleSwitch
                id="email-system-announcements"
                checked={preferences.email.systemAnnouncements}
                onChange={(checked) => updateEmailPreference('systemAnnouncements', checked)}
                label="System Announcements"
                description="Important system updates and maintenance notifications"
              />
              <ToggleSwitch
                id="email-weekly-reports"
                checked={preferences.email.weeklyReports}
                onChange={(checked) => updateEmailPreference('weeklyReports', checked)}
                label="Weekly Reports"
                description="Summary of your activity and pending tasks"
              />
            </div>
          </div>

          {/* In-App Notifications Section */}
          <div>
            <div className="flex items-center mb-4">
              <Volume2 className="h-5 w-5 text-gray-600 mr-2" />
              <h3 className="text-base font-semibold text-gray-900">In-App Notifications</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <ToggleSwitch
                id="app-request-assignments"
                checked={preferences.inApp.requestAssignments}
                onChange={(checked) => updateInAppPreference('requestAssignments', checked)}
                label="Request Assignments"
                description="Pop-up notifications for new assignments"
              />
              <ToggleSwitch
                id="app-request-updates"
                checked={preferences.inApp.requestUpdates}
                onChange={(checked) => updateInAppPreference('requestUpdates', checked)}
                label="Request Updates"
                description="Real-time updates on request status changes"
              />
              <ToggleSwitch
                id="app-mentions"
                checked={preferences.inApp.mentionsInComments}
                onChange={(checked) => updateInAppPreference('mentionsInComments', checked)}
                label="Mentions in Comments"
                description="When someone mentions you in a comment"
              />
              <ToggleSwitch
                id="app-system-alerts"
                checked={preferences.inApp.systemAlerts}
                onChange={(checked) => updateInAppPreference('systemAlerts', checked)}
                label="System Alerts"
                description="Critical system notifications and warnings"
              />
              <ToggleSwitch
                id="app-task-deadlines"
                checked={preferences.inApp.taskDeadlines}
                onChange={(checked) => updateInAppPreference('taskDeadlines', checked)}
                label="Task Deadlines"
                description="Reminders for approaching task deadlines"
              />
            </div>
          </div>

          {/* Notification Frequency Section */}
          <div>
            <div className="flex items-center mb-4">
              <Clock className="h-5 w-5 text-gray-600 mr-2" />
              <h3 className="text-base font-semibold text-gray-900">Notification Frequency</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="frequency"
                    value="immediate"
                    checked={preferences.frequency === 'immediate'}
                    onChange={() => updateFrequency('immediate')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">Immediate</span>
                    <p className="text-xs text-gray-500">Receive notifications as they happen</p>
                  </div>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="frequency"
                    value="daily"
                    checked={preferences.frequency === 'daily'}
                    onChange={() => updateFrequency('daily')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">Daily Digest</span>
                    <p className="text-xs text-gray-500">One email summary per day at 9:00 AM</p>
                  </div>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="frequency"
                    value="weekly"
                    checked={preferences.frequency === 'weekly'}
                    onChange={() => updateFrequency('weekly')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">Weekly Summary</span>
                    <p className="text-xs text-gray-500">One email summary every Monday at 9:00 AM</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Do Not Disturb Section */}
          <div>
            <div className="flex items-center mb-4">
              <VolumeX className="h-5 w-5 text-gray-600 mr-2" />
              <h3 className="text-base font-semibold text-gray-900">Do Not Disturb</h3>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <ToggleSwitch
                id="enable-dnd"
                checked={preferences.enableDoNotDisturb}
                onChange={(checked) => updateDoNotDisturb('enableDoNotDisturb', checked)}
                label="Enable Do Not Disturb Hours"
                description="Pause in-app notifications during specified hours"
              />
              
              {preferences.enableDoNotDisturb && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={preferences.doNotDisturbStart}
                      onChange={(e) => updateDoNotDisturb('doNotDisturbStart', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={preferences.doNotDisturbEnd}
                      onChange={(e) => updateDoNotDisturb('doNotDisturbEnd', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer className="border-t border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center w-full">
          <div className="text-sm text-gray-500">
            {hasChanges && (
              <span className="text-amber-600">You have unsaved changes</span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={savePreferences}
              disabled={saving || !hasChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default NotificationPreferencesModal;
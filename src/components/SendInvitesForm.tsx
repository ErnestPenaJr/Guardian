import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../utils/api';
import { FaTrash } from 'react-icons/fa';

export default function SendInvitesForm({ onClose }: { onClose: () => void }) {
  interface InviteEmail {
    email: string;
    roleId: number | null;
  }

  const [inviteEmails, setInviteEmails] = useState<InviteEmail[]>([{ email: '', roleId: null }]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[SendInvitesForm] Fetching roles from /api/roles');
      const response = await api.get('/api/roles');
      
      // Log the complete response for debugging
      console.group('Roles API Response');
      console.log('Complete response:', response);
      console.log('Response data:', response.data);
      console.log('Response data type:', typeof response.data);
      console.log('Response data keys:', Object.keys(response.data));
      
      if (response.data && Array.isArray(response.data)) {
        console.log('Response is direct array, first item:', response.data[0]);
        const formattedRoles = response.data.map((role: any) => ({
          id: role.id || role.ROLE_ID,
          name: role.displayName || role.name || role.DISPLAY_NAME || role.NAME,
          displayName: role.displayName || role.DISPLAY_NAME || role.name || role.NAME
        }));
        console.log('Formatted roles:', formattedRoles);
        setRoles(formattedRoles);
      }
      else if (response.data && response.data.success && Array.isArray(response.data.data)) {
        console.log('Response has success flag with data array, first item:', response.data.data[0]);
        const formattedRoles = response.data.data.map((role: any) => ({
          id: role.id || role.ROLE_ID,
          name: role.displayName || role.name || role.DISPLAY_NAME || role.NAME,
          displayName: role.displayName || role.DISPLAY_NAME || role.name || role.NAME
        }));
        console.log('Formatted roles:', formattedRoles);
        setRoles(formattedRoles);
      } else {
        console.error('Unexpected roles data format:', response.data);
        throw new Error('Invalid roles data format received from server');
      }
      
      console.groupEnd();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Failed to load roles. Please try again.';
      setError(errorMessage);
      console.error('Error fetching roles:', err);
      // Re-throw to allow error boundary to catch it if needed
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles().catch(() => {
      // Error is already handled in fetchRoles
    });
  }, []);

  const handleAddEmailField = () => setInviteEmails([...inviteEmails, { email: '', roleId: null }]);
  const handleRemoveEmailField = (idx: number) => setInviteEmails(inviteEmails.filter((_, i) => i !== idx));
  const handleChangeEmail = (idx: number, value: string) => 
    setInviteEmails(inviteEmails.map((v, i) => i === idx ? { ...v, email: value } : v));
  const handleChangeRole = (idx: number, value: string) => {
    const roleId = value ? parseInt(value, 10) : null;
    setInviteEmails(inviteEmails.map((v, i) => i === idx ? { ...v, roleId } : v));
  };

  const handleSendInvites = async () => {
    setIsSending(true);
    try {
      const invites = inviteEmails.filter(e => e.email && e.roleId);
      
      if (invites.length === 0) {
        Swal.fire({ icon: 'warning', title: 'No Valid Invites', text: 'Please add at least one email with a role selected.' });
        return;
      }

      console.log('[SendInvitesForm] Sending invites:', invites);
      
      // Fix: Use correct API endpoint that exists in production server
      const response = await api.post('/api/invites', { invites });
      
      console.log('[SendInvitesForm] API Response:', response.data);
      
      // Check if response indicates success
      if (response.status === 200 || response.status === 201) {
        Swal.fire({ 
          icon: 'success', 
          title: 'Invites Sent', 
          text: `Successfully sent ${invites.length} invitation${invites.length > 1 ? 's' : ''}.` 
        });
        onClose();
        setInviteEmails([{ email: '', roleId: null }]);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (err: any) {
      console.error('[SendInvitesForm] Error sending invites:', err);
      
      // Enhanced error messages with authentication handling
      let errorMessage = 'Failed to send invites.';
      
      if (err?.response?.status === 401) {
        const errorType = err.response.data?.errorType;
        if (errorType === 'TOKEN_EXPIRED') {
          errorMessage = 'Your session has expired. Please log in again.';
          // Auto-redirect to login after showing error
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else if (errorType === 'TOKEN_MALFORMED' || errorType === 'TOKEN_INVALID') {
          errorMessage = 'Authentication error. Please log in again.';
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else {
          errorMessage = 'You are not authorized to send invites. Please log in again.';
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      } else if (err?.response?.status === 403) {
        errorMessage = 'You do not have permission to send invites.';
      } else if (err?.response?.status === 500) {
        errorMessage = 'Server error. This might be due to network connectivity issues.';
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      Swal.fire({ 
        icon: 'error', 
        title: 'Error Sending Invites', 
        text: errorMessage,
        footer: 'Check your network connection and try again.'
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading roles...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 mb-4">{error}</div>
        <button 
          onClick={() => fetchRoles().catch(() => {})}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-h4 font-bold mb-4">Send Invites</h2>
      <label className="block mb-2 font-medium">Invite Emails & Roles</label>
      {inviteEmails.map((item, idx) => (
        <div className="flex items-center mb-2 gap-2 w-full" key={idx}>
          <input
            type="email"
            className="flex-1 min-w-0 px-3 py-2 border rounded"
            placeholder="user@email.com"
            value={item.email}
            onChange={e => handleChangeEmail(idx, e.target.value)}
            required
          />
          <select
            className="px-2 py-2 border rounded"
            value={item.roleId ?? ''}
            onChange={e => handleChangeRole(idx, e.target.value)}
            required
          >
            <option value="" disabled>Select role</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          {inviteEmails.length > 1 && (
            <button
              type="button"
              onClick={() => handleRemoveEmailField(idx)}
              className="flex items-center justify-center text-red-500 p-2 rounded hover:bg-red-50 border border-gray-200 bg-white"
              title="Remove"
              style={{ height: '40px', width: '40px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <FaTrash size={18} />
            </button>
          )}
        </div>
      ))}
      <div className="flex justify-start">
        <button type="button" className="mb-4 text-primary underline" onClick={handleAddEmailField}>+ Add another</button>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={onClose}
          disabled={isSending}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          onClick={handleSendInvites}
          disabled={isSending || !inviteEmails.every(e => e.email && e.roleId)}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

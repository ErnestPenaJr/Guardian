import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../utils/api';
import { FaTrash } from 'react-icons/fa';

export default function SendInvitesForm({ onClose }: { onClose: () => void }) {
  const [inviteEmails, setInviteEmails] = useState([{ email: '', roleId: null }]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    api.get('/roles')
      .then(res => setRoles(res.data))
      .catch(() => setRoles([]));
  }, []);

  const handleAddEmailField = () => setInviteEmails([...inviteEmails, { email: '', roleId: null }]);
  const handleRemoveEmailField = (idx: number) => setInviteEmails(inviteEmails.filter((_, i) => i !== idx));
  const handleChangeEmail = (idx: number, value: string) => setInviteEmails(inviteEmails.map((v, i) => i === idx ? { ...v, email: value } : v));
  const handleChangeRole = (idx: number, value: number) => setInviteEmails(inviteEmails.map((v, i) => i === idx ? { ...v, roleId: value } : v));

  const handleSendInvites = async () => {
    setIsSending(true);
    try {
      const invites = inviteEmails.filter(e => e.email && e.roleId);
      await api.post('/invites/send', { invites });
      Swal.fire({ icon: 'success', title: 'Invites Sent', text: 'Invitations have been sent.' });
      onClose();
      setInviteEmails([{ email: '', roleId: null }]);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || 'Failed to send invites.' });
    } finally {
      setIsSending(false);
    }
  };

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
            onChange={e => handleChangeRole(idx, Number(e.target.value))}
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

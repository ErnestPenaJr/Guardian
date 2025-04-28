import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaUserPlus, FaFileExport, FaSyncAlt, FaTrashAlt, FaClock, FaEdit, FaEnvelope } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface UserRow {
  id: number;
  name: string;
  email: string;
  dateCreated: string;
  status: string;
  roles: number[];
}

interface InviteRow {
  INVITE_ID: number;
  EMAIL: string;
  ROLE_ID: number;
  STATUS: string;
  EXPIRES_AT: string;
  CREATED_AT: string;
  USED_AT: string | null;
  status: 'pending' | 'expired' | 'accepted';
}

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/invites'),
    ]).then(([usersRes, invitesRes]) => {
      setUsers(usersRes.data);
      setInvites(invitesRes.data);
    });
  }, []);

  const handleResendInvite = async (inviteId: number) => {
    setResendingInviteId(inviteId);
    try {
      // Try with { inviteId } first
      await api.post('/invites/resend', { inviteId });
      Swal.fire('Invite resent!', '', 'success');
    } catch (err1) {
      try {
        // Try with { INVITE_ID } if the first fails
        await api.post('/invites/resend', { INVITE_ID: inviteId });
        Swal.fire('Invite resent!', '', 'success');
      } catch (err2) {
        Swal.fire('Failed to resend invite', (err2 as any)?.message || 'Please check your network or contact support.', 'error');
      }
    } finally {
      const invitesRes = await api.get('/invites');
      setInvites(invitesRes.data);
      setResendingInviteId(null);
    }
  };

  const handleRemoveInvite = async (inviteId: number) => {
    await api.delete(`/invites/${inviteId}`);
    Swal.fire('Invite removed!', '', 'success');
    const invitesRes = await api.get('/invites');
    setInvites(invitesRes.data);
  };

  // Countdown state for invited users
  const [inviteCountdowns, setInviteCountdowns] = useState<{ [id: number]: string }>({});
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous interval
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    // Set up countdown interval
    countdownIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const newCountdowns: { [id: number]: string } = {};
      invites.forEach(invite => {
        if (invite.EXPIRES_AT) {
          const expires = new Date(invite.EXPIRES_AT).getTime();
          const diff = Math.max(0, Math.floor((expires - now) / 1000));
          if (diff > 0) {
            const hours = Math.floor(diff / 3600);
            const mins = Math.floor((diff % 3600) / 60);
            const secs = diff % 60;
            newCountdowns[invite.INVITE_ID] =
              hours > 0 ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
              : `${mins}:${String(secs).padStart(2, '0')}`;
          } else {
            newCountdowns[invite.INVITE_ID] = 'Expired';
          }
        }
      });
      setInviteCountdowns(newCountdowns);
    }, 1000);
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [invites]);

  // Export to Excel
  const handleExport = () => {
    const exportRows = [...users, ...invites].map((row, idx) => {
      if ('id' in row) {
        return {
          '#': idx + 1,
          'Name': row.name,
          'Email': row.email,
          'Date Created': new Date(row.dateCreated).toLocaleDateString(),
          'Role': row.roles.includes(1) ? 'Admin' : 'User',
          'Status': row.status === 'A' ? 'Active' : row.status === 'S' ? 'Suspended' : 'Inactive',
          'Type': 'User',
        };
      } else {
        return {
          '#': idx + 1,
          'Name': row.EMAIL,
          'Email': row.EMAIL,
          'Date Created': new Date(row.CREATED_AT).toLocaleDateString(),
          'Role': row.ROLE_ID === 1 ? 'Admin' : 'User',
          'Status': row.status.charAt(0).toUpperCase() + row.status.slice(1),
          'Type': 'Invite',
        };
      }
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UserManagement');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'user_management.xlsx');
  };

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold text-primary">User Management</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={handleExport}>
            <FaFileExport /> Export to Excel
          </button>
          <button className="btn btn-success d-flex align-items-center gap-2" onClick={() => {/* Add user logic */}}>
            <FaUserPlus /> Add New User
          </button>
        </div>
      </div>
      {/* Users Table */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-primary text-white fw-bold">Active Users</div>
        <div className="card-body p-0">
          <table className="table table-striped table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Name / Email</th>
                <th>Date Created</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={`user-${user.id}`}>
                  <td>{idx + 1}</td>
                  <td>
                    <b>{user.name}</b><br />
                    <span className="text-secondary small">{user.email}</span>
                  </td>
                  <td>{new Date(user.dateCreated).toLocaleDateString()}</td>
                  <td>{user.roles.includes(1) ? 'Admin' : 'User'}</td>
                  <td>
                    {user.status === 'A' ? <span className="text-success fw-semibold">Active</span> :
                      user.status === 'S' ? <span className="text-danger fw-semibold">Suspended</span> :
                        <span className="text-warning fw-semibold">Inactive</span>}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline-primary me-1" title="Edit User">
                      <FaEdit />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" title="Delete User"><FaTrashAlt /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Invited Users Table */}
      <div className="card shadow-sm">
        <div className="card-header bg-info text-white fw-bold">Invited Users</div>
        <div className="card-body p-0">
          <table className="table table-striped table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>#</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>Email</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>Date Invited</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>Role</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>Status</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>Expires In</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite, idx) => {
                const isExpired = inviteCountdowns[invite.INVITE_ID] === 'Expired' || invite.status === 'expired';
                return (
                  <tr key={`invite-${invite.INVITE_ID}`}> 
                    <td style={{ whiteSpace: 'nowrap' }}>{idx + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <b>{invite.EMAIL}</b><br />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(invite.CREATED_AT).toLocaleDateString()}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{invite.ROLE_ID === 1 ? 'Admin' : 'User'}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>
                      {invite.status === 'pending' && !isExpired && (
                        <span className="text-primary fw-semibold d-flex align-items-center justify-content-start gap-1">
                          Pending
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-danger fw-semibold d-flex align-items-center justify-content-start gap-1">
                          <FaClock className="me-1" />Expired
                        </span>
                      )}
                      {invite.status === 'accepted' && (
                        <span className="text-success fw-semibold d-flex align-items-center justify-content-start gap-1">
                          Accepted
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start' }}>
                      {inviteCountdowns[invite.INVITE_ID] && inviteCountdowns[invite.INVITE_ID] !== 'Expired'
                        ? inviteCountdowns[invite.INVITE_ID]
                        : <span className="text-danger fw-bold d-flex align-items-center justify-content-start gap-1">Expired!</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start', display: 'flex', gap: '0.5rem' }}>
                      {(isExpired || (invite.status === 'pending' && inviteCountdowns[invite.INVITE_ID] === 'Expired')) && (
                        <button className="btn btn-sm btn-outline-primary me-1 d-flex align-items-center justify-content-start" title="Resend Invite" onClick={() => handleResendInvite(invite.INVITE_ID)} disabled={resendingInviteId === invite.INVITE_ID}>
                          {resendingInviteId === invite.INVITE_ID ? (
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                          ) : <FaEnvelope className="me-1" />} Resend
                        </button>
                      )}
                      <button className="btn btn-sm btn-outline-danger d-flex align-items-end justify-content-end" title="Remove Invite" onClick={() => handleRemoveInvite(invite.INVITE_ID)}><FaTrashAlt /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;

import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaUserPlus, FaFileExport, FaSyncAlt, FaTrashAlt, FaClock, FaEdit, FaEnvelope } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth';

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

interface Role {
  id: number;
  name: string;
}

const AddUserModal: React.FC<{
  show: boolean;
  onClose: () => void;
  roles: Role[];
  user: any;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}> = ({ show, onClose, roles, user, onSubmit }) => {
  if (!show) return null;
  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Add New User
              <span className="text-muted" data-component-name="AddUserModal">
                ({user?.companyName || user?.organization || 'Company'}
                {user?.companyId ? ` | ID: ${user.companyId}` : ''})
              </span>
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <form id="add-user-form" onSubmit={onSubmit} autoComplete="off">
              <div className="mb-3">
                <label className="form-label">First Name</label>
                <input type="text" className="form-control" name="firstName" required />
              </div>
              <div className="mb-3">
                <label className="form-label">Last Name</label>
                <input type="text" className="form-control" name="lastName" required />
              </div>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" name="email" required />
              </div>
              <div className="mb-3">
                <label className="form-label">Role</label>
                <select className="form-select" name="role" required>
                  <option value="" disabled>Select role</option>
                  {roles.map((role, idx) => (
                    <option key={role.id ?? idx} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer px-0">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add User</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminUserManagement: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/invites'),
    ]).then(([usersRes, invitesRes]) => {
      setUsers(usersRes.data);
      setInvites(invitesRes.data);
    });
  }, []);

  useEffect(() => {
    api.get('/roles')
      .then(res => {
        // Normalize roles to { id, name }
        const normalized = res.data.map((r: any) => ({
          id: r.ROLE_ID ?? r.id,
          name: r.NAME ?? r.name,
        }));
        setRoles(normalized);
      })
      .catch(() => setRoles([]));
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

  const handleAddUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const roleId = formData.get('role') as string;

    // --- Verification ---
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !roleId) {
      Swal.fire('Missing Fields', 'Please fill in all required fields.', 'warning');
      return;
    }
    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Swal.fire('Invalid Email', 'Please enter a valid email address.', 'warning');
      return;
    }

    try {
      await api.post('/users', {
        firstName,
        lastName,
        email,
        roleId: Number(roleId),
        companyId: user?.companyId,
      });
      Swal.fire('User added!', '', 'success');
      setShowAddUserModal(false);
      // Refresh users list
      const usersRes = await api.get('/users');
      setUsers(usersRes.data);
    } catch (err: any) {
      Swal.fire('Failed to add user', err?.response?.data?.error || err.message || 'Unknown error', 'error');
    }
  };

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold text-uppercase fs-2">User Management</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={handleExport}>
            <FaFileExport /> Export to Excel
          </button>
          <button className="btn btn-success d-flex align-items-center gap-2" onClick={() => setShowAddUserModal(true)}>
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
      {showAddUserModal && <AddUserModal show={showAddUserModal} onClose={() => setShowAddUserModal(false)} roles={roles} user={user} onSubmit={handleAddUserSubmit} />}
    </div>
  );
};

export default AdminUserManagement;

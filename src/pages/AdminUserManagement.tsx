import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaUserPlus, FaFileExport, FaSyncAlt, FaTrashAlt, FaClock, FaEdit, FaEnvelope, FaSearch } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth';
import { Modal } from 'react-bootstrap';

interface UserRow {
  id: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  dateCreated: string;
  createdAt?: string;
  status: string;
  roles: any[];
  companyId: number | null;
  emailVerified?: boolean;
}

interface InviteRow {
  id?: number;
  INVITE_ID?: number;
  email?: string;
  EMAIL?: string;
  roleId?: number;
  ROLE_ID?: number;
  roleName?: string;
  status?: string;
  STATUS?: string;
  expiresAt?: string;
  EXPIRES_AT?: string;
  createdAt?: string;
  CREATED_AT?: string;
  usedAt?: string | null;
  USED_AT?: string | null;
  companyId: number | null;
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
  
  // Extract company information from user object
  const companyName = user?.company?.name || user?.companyName || user?.organization || 'Company';
  const companyId = user?.company?.id || user?.companyId || '';
  
  // Function to capitalize first letter of each word
  const capitalizeWords = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const words = value.split(' ');
    const capitalizedWords = words.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
    e.target.value = capitalizedWords.join(' ');
  };

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
              <span className="text-muted ms-2" data-component-name="AddUserModal">
                ({companyName}
                {companyId ? ` | ID: ${companyId}` : ''})
              </span>
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <form id="add-user-form" onSubmit={onSubmit} autoComplete="off">
              <div className="mb-3">
                <label className="form-label">First Name</label>
                <input type="text" className="form-control" name="firstName" required onChange={capitalizeWords} />
              </div>
              <div className="mb-3">
                <label className="form-label">Last Name</label>
                <input type="text" className="form-control" name="lastName" required onChange={capitalizeWords} />
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

interface InviteUserModalProps {
  show: boolean;
  onClose: () => void;
  roles: Role[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

const InviteUserModal = ({ show, onClose, roles, onSubmit }: InviteUserModalProps) => {
  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <h5 className="modal-title">Invite User <span className="text-muted ms-2">(DEV-TEAM | ID: 14)</span></h5>
      </Modal.Header>
      <Modal.Body>
        <form id="invite-user-form" onSubmit={onSubmit} autoComplete="off">
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" name="email" required />
          </div>
          <div className="mb-3">
            <label className="form-label">Role</label>
            <select className="form-select" name="role" required>
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="d-flex justify-content-end">
            <button type="button" className="btn btn-secondary me-2" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Send Invitation
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
};

const AdminUserManagement: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showInviteUserModal, setShowInviteUserModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(5);

  // Sorting state
  const [userSortField, setUserSortField] = useState<string>('name');
  const [userSortDirection, setUserSortDirection] = useState<'asc' | 'desc'>('asc');
  const [inviteSortField, setInviteSortField] = useState<string>('EMAIL');
  const [inviteSortDirection, setInviteSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    Promise.all([
      api.get('/api/users'),
      api.get('/api/invites'),
      api.get('/api/roles')
    ]).then(([usersRes, invitesRes, rolesRes]) => {
      // Format user data
      const formattedUsers = usersRes.data.map((user: any) => {
        // Format date properly
        let dateCreated = 'Invalid Date';
        try {
          if (user.createdAt) {
            dateCreated = new Date(user.createdAt).toISOString();
          }
        } catch (e) {
          console.error('Error formatting date:', e);
        }
        
        return {
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
          email: user.email,
          dateCreated,
          status: user.status || 'P',
          roles: user.roles || [],
          companyId: user.companyId || null
        };
      });
      
      // Format invite data
      const formattedInvites = invitesRes.data.map((invite: any) => {
        // Format dates properly
        let createdAt = 'Invalid Date';
        let expiresAt = null;
        
        try {
          if (invite.createdAt) {
            createdAt = new Date(invite.createdAt).toISOString();
          }
          if (invite.expiresAt) {
            expiresAt = new Date(invite.expiresAt).toISOString();
          }
        } catch (e) {
          console.error('Error formatting invite dates:', e);
        }
        
        return {
          INVITE_ID: invite.id,
          EMAIL: invite.email,
          ROLE_ID: invite.roleId,
          STATUS: invite.status,
          EXPIRES_AT: expiresAt,
          CREATED_AT: createdAt,
          USED_AT: invite.usedAt,
          companyId: invite.companyId || null,
          status: invite.status === 'P' ? 'pending' : 
                 invite.status === 'A' ? 'accepted' : 'expired'
        };
      });
      
      setUsers(formattedUsers);
      setInvites(formattedInvites);
      
      // Set roles from API response
      setRoles(rolesRes.data || []);
      
      // Ensure user has company information
      if (user && !user.company && localStorage.getItem('user')) {
        try {
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          if (storedUser.company) {
            user.company = storedUser.company;
            user.companyId = storedUser.company.id;
            user.companyName = storedUser.company.name;
          }
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
    }).catch(err => {
      console.error('Error fetching data:', err);
    });
  }, [user]);

  const handleResendInvite = async (inviteId: number) => {
    setResendingInviteId(inviteId);
    try {
      // Try with { inviteId } first
      await api.post('/api/invites/resend', { inviteId });
      Swal.fire('Invite resent!', '', 'success');
    } catch (err1) {
      try {
        // Try with { INVITE_ID } if the first fails
        await api.post('/api/invites/resend', { INVITE_ID: inviteId });
        Swal.fire('Invite resent!', '', 'success');
      } catch (err2) {
        Swal.fire('Failed to resend invite', (err2 as any)?.message || 'Please check your network or contact support.', 'error');
      }
    } finally {
      const invitesRes = await api.get('/api/invites');
      setInvites(invitesRes.data);
      setResendingInviteId(null);
    }
  };

  const handleRemoveInvite = async (inviteId: number) => {
    await api.delete(`/api/invites/${inviteId}`);
    Swal.fire('Invite removed!', '', 'success');
    const invitesRes = await api.get('/api/invites');
    setInvites(invitesRes.data);
  };

  const handleDeleteUser = async (userId: number) => {
    // Confirm deletion with the user
    const result = await Swal.fire({
      title: 'Delete User?',
      text: 'This action cannot be undone. Are you sure you want to delete this user?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete user',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        console.log(`Attempting to delete user with ID: ${userId}`);
        
        // Show loading state
        Swal.fire({
          title: 'Deleting User...',
          text: 'Please wait while we delete the user account.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        
        // Use the simplified endpoint
        const response = await api.delete(`/api/delete-user/${userId}`);
        console.log('Delete response:', response);
        
        // Close loading dialog
        Swal.close();
        
        // Show success message
        await Swal.fire({
          title: 'User Deleted!',
          text: 'The user has been successfully deleted.',
          icon: 'success',
          confirmButtonText: 'OK'
        });
        
        // Refresh data from both endpoints
        try {
          const [usersRes, invitesRes, rolesRes] = await Promise.all([
            api.get('/api/users'),
            api.get('/api/invites'),
            api.get('/api/roles')
          ]);
          
          // Format and update user data
          const formattedUsers = usersRes.data.map((user: any) => {
            // Format date properly
            let dateCreated = 'Invalid Date';
            try {
              if (user.createdAt) {
                dateCreated = new Date(user.createdAt).toISOString();
              }
            } catch (e) {
              console.error('Error formatting date:', e);
            }
            
            return {
              id: user.id,
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
              email: user.email,
              dateCreated,
              status: user.status || 'P',
              roles: user.roles || [],
              companyId: user.companyId || null
            };
          });
          
          // Format and update invite data
          const formattedInvites = invitesRes.data.map((invite: any) => {
            // Format dates properly
            let createdAt = 'Invalid Date';
            let expiresAt = null;
            
            try {
              if (invite.createdAt) {
                createdAt = new Date(invite.createdAt).toISOString();
              }
              if (invite.expiresAt) {
                expiresAt = new Date(invite.expiresAt).toISOString();
              }
            } catch (e) {
              console.error('Error formatting invite dates:', e);
            }
            
            return {
              INVITE_ID: invite.id,
              EMAIL: invite.email,
              ROLE_ID: invite.roleId,
              STATUS: invite.status,
              EXPIRES_AT: expiresAt,
              CREATED_AT: createdAt,
              USED_AT: invite.usedAt,
              companyId: invite.companyId || null,
              status: invite.status === 'P' ? 'pending' : 
                     invite.status === 'A' ? 'accepted' : 'expired'
            };
          });
          
          // Update state with fresh data
          setUsers(formattedUsers);
          setInvites(formattedInvites);
          setRoles(rolesRes.data || []);
          
          console.log('Table data refreshed successfully after deletion');
        } catch (refreshErr) {
          console.error('Error refreshing data after deletion:', refreshErr);
          // Show error but don't block the flow
          Swal.fire({
            title: 'Warning',
            text: 'User was deleted but there was an error refreshing the table data. Please reload the page.',
            icon: 'warning',
            confirmButtonText: 'OK'
          });
        }
      } catch (err: any) {
        // Close loading dialog if open
        Swal.close();
        
        console.error('Error deleting user:', err);
        Swal.fire(
          'Delete Failed', 
          err?.response?.data?.error || err.message || 'An error occurred while deleting the user.', 
          'error'
        );
      }
    }
  };

  // Countdown state for invited users
  const [inviteCountdowns, setInviteCountdowns] = useState<{ [key: number]: string }>({});
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous interval
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    // Set up countdown interval
    countdownIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const newCountdowns: { [key: number]: string } = {};
      invites.forEach(invite => {
        const expiryDate = invite.EXPIRES_AT || invite.expiresAt;
        if (expiryDate) {
          const expires = new Date(expiryDate).getTime();
          const diff = expires - now;
          if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            newCountdowns[invite.INVITE_ID || invite.id || 0] = `${days}d ${hours}h ${minutes}m`;
          } else {
            newCountdowns[invite.INVITE_ID || invite.id || 0] = 'Expired';
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
    const exportRows = [
      ...users.map((user) => ({
        '#': users.indexOf(user) + 1,
        'Name': user.name || '',
        'Email': user.email || '',
        'Date Created': user.dateCreated && user.dateCreated !== 'Invalid Date' 
          ? new Date(user.dateCreated).toLocaleDateString() 
          : 'N/A',
        'Role': user.roles && Array.isArray(user.roles) ? 
          (user.roles.some((role: any) => role.id === 1) ? 'Admin' : 'User') : 
          'User',
        'Status': user.status === 'A' ? 'Active' : user.status === 'S' ? 'Suspended' : 'Inactive',
        'Type': 'User',
      })),
      ...invites.map((invite) => ({
        '#': users.length + invites.indexOf(invite) + 1,
        'Name': invite.EMAIL || invite.email || '',
        'Email': invite.EMAIL || invite.email || '',
        'Date Created': (invite.CREATED_AT || invite.createdAt) && 
                       (invite.CREATED_AT !== 'Invalid Date' && invite.createdAt !== 'Invalid Date') ? 
          new Date(invite.CREATED_AT || invite.createdAt || '').toLocaleDateString() 
          : 'N/A',
        'Role': (invite.ROLE_ID === 1 || invite.roleId === 1) ? 'Admin' : 'User',
        'Status': invite.status ? 
          (invite.status.charAt(0).toUpperCase() + invite.status.slice(1)) : 
          (invite.STATUS === 'P' ? 'Pending' : invite.STATUS === 'A' ? 'Accepted' : 'Expired'),
        'Type': 'Invite',
      }))
    ];
    
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

    // Get company ID from user object or localStorage
    let companyId = null;
    if (user?.companyId) {
      companyId = user.companyId;
    } else if (user?.company?.id) {
      companyId = user.company.id;
    } else if (localStorage.getItem('user')) {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (storedUser.company && storedUser.company.id) {
          companyId = storedUser.company.id;
        }
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }

    console.log('Adding user with company ID:', companyId);

    try {
      // Show loading state
      Swal.fire({
        title: 'Adding User...',
        text: 'Please wait while we create the user account and send login details.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      const response = await api.post('/api/users', {
        firstName,
        lastName,
        email,
        roleId: Number(roleId),
        companyId
      });
      
      // Close loading dialog
      Swal.close();
      
      // Show success message with email notification info
      await Swal.fire({
        title: 'User Added!',
        text: response.data.message || 'User has been successfully added.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
      
      setShowAddUserModal(false);
      
      // Refresh data from both endpoints using the same approach as delete
      try {
        const [usersRes, invitesRes, rolesRes] = await Promise.all([
          api.get('/api/users'),
          api.get('/api/invites'),
          api.get('/api/roles')
        ]);
        
        // Format and update user data
        const formattedUsers = usersRes.data.map((user: any) => {
          // Format date properly
          let dateCreated = 'Invalid Date';
          try {
            if (user.createdAt) {
              dateCreated = new Date(user.createdAt).toISOString();
            }
          } catch (e) {
            console.error('Error formatting date:', e);
          }
          
          return {
            id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
            email: user.email,
            dateCreated,
            status: user.status || 'P',
            roles: user.roles || [],
            companyId: user.companyId || null
          };
        });
        
        // Format and update invite data
        const formattedInvites = invitesRes.data.map((invite: any) => {
          // Format dates properly
          let createdAt = 'Invalid Date';
          let expiresAt = null;
          
          try {
            if (invite.createdAt) {
              createdAt = new Date(invite.createdAt).toISOString();
            }
            if (invite.expiresAt) {
              expiresAt = new Date(invite.expiresAt).toISOString();
            }
          } catch (e) {
            console.error('Error formatting invite dates:', e);
          }
          
          return {
            INVITE_ID: invite.id,
            EMAIL: invite.email,
            ROLE_ID: invite.roleId,
            STATUS: invite.status,
            EXPIRES_AT: expiresAt,
            CREATED_AT: createdAt,
            USED_AT: invite.usedAt,
            companyId: invite.companyId || null,
            status: invite.status === 'P' ? 'pending' : 
                   invite.status === 'A' ? 'accepted' : 'expired'
          };
        });
        
        // Update state with fresh data
        setUsers(formattedUsers);
        setInvites(formattedInvites);
        setRoles(rolesRes.data || []);
        
        console.log('Table data refreshed successfully after adding user');
      } catch (refreshErr) {
        console.error('Error refreshing data after adding user:', refreshErr);
        // Show error but don't block the flow
        Swal.fire({
          title: 'Warning',
          text: 'User was added but there was an error refreshing the table data. Please reload the page.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
      }
    } catch (err: any) {
      // Close loading dialog
      Swal.close();
      
      Swal.fire('Failed to add user', err?.response?.data?.error || err.message || 'Unknown error', 'error');
    }
  };

  // Handle invite user form submission
  const handleInviteUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const roleId = formData.get('role') as string;

    // Validation
    if (!email.trim() || !roleId) {
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
      // Show loading state
      Swal.fire({
        title: 'Sending Invitation...',
        text: 'Please wait while we send the invitation.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      const response = await api.post('/api/invites', {
        email,
        roleId: Number(roleId)
      });
      
      // Close loading dialog
      Swal.close();
      
      // Show success message
      await Swal.fire({
        title: 'Invitation Sent!',
        text: response.data.message || 'Invitation has been successfully sent.',
        icon: 'success',
        confirmButtonText: 'OK'
      });
      
      setShowInviteUserModal(false);
      
      // Refresh data using the same approach as other operations
      try {
        const [usersRes, invitesRes, rolesRes] = await Promise.all([
          api.get('/api/users'),
          api.get('/api/invites'),
          api.get('/api/roles')
        ]);
        
        // Format and update data
        const formattedUsers = usersRes.data.map((user: any) => {
          let dateCreated = 'Invalid Date';
          try {
            if (user.createdAt) {
              dateCreated = new Date(user.createdAt).toISOString();
            }
          } catch (e) {
            console.error('Error formatting date:', e);
          }
          
          return {
            id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
            email: user.email,
            dateCreated,
            status: user.status || 'P',
            roles: user.roles || [],
            companyId: user.companyId || null
          };
        });
        
        const formattedInvites = invitesRes.data.map((invite: any) => {
          let createdAt = 'Invalid Date';
          let expiresAt = null;
          
          try {
            if (invite.createdAt) {
              createdAt = new Date(invite.createdAt).toISOString();
            }
            if (invite.expiresAt) {
              expiresAt = new Date(invite.expiresAt).toISOString();
            }
          } catch (e) {
            console.error('Error formatting invite dates:', e);
          }
          
          return {
            INVITE_ID: invite.id,
            EMAIL: invite.email,
            ROLE_ID: invite.roleId,
            STATUS: invite.status,
            EXPIRES_AT: expiresAt,
            CREATED_AT: createdAt,
            USED_AT: invite.usedAt,
            companyId: invite.companyId || null,
            status: invite.status === 'P' ? 'pending' : 
                   invite.status === 'A' ? 'accepted' : 'expired'
          };
        });
        
        setUsers(formattedUsers);
        setInvites(formattedInvites);
        setRoles(rolesRes.data || []);
        
        console.log('Table data refreshed successfully after sending invitation');
      } catch (refreshErr) {
        console.error('Error refreshing data after sending invitation:', refreshErr);
        Swal.fire({
          title: 'Warning',
          text: 'Invitation was sent but there was an error refreshing the table data. Please reload the page.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
      }
    } catch (err: any) {
      // Close loading dialog
      Swal.close();
      
      Swal.fire('Failed to send invitation', err?.response?.data?.error || err.message || 'Unknown error', 'error');
    }
  };

  // Handle column sorting for users
  const handleUserSort = (field: string) => {
    // If clicking the same field, toggle direction
    if (field === userSortField) {
      setUserSortDirection(userSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setUserSortField(field);
      setUserSortDirection('asc');
    }
    // Reset to first page when sorting
    setUserPage(1);
  };

  // Handle column sorting for invites
  const handleInviteSort = (field: string) => {
    // If clicking the same field, toggle direction
    if (field === inviteSortField) {
      setInviteSortDirection(inviteSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setInviteSortField(field);
      setInviteSortDirection('asc');
    }
    // Reset to first page when sorting
    setInvitePage(1);
  };

  // Sort function for any field
  const sortData = (data: any[], field: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      // Handle nested properties with dot notation (e.g., 'user.name')
      const getNestedValue = (obj: any, path: string) => {
        const keys = path.split('.');
        return keys.reduce((o, key) => (o && o[key] !== undefined) ? o[key] : null, obj);
      };
      
      let aValue = getNestedValue(a, field) || '';
      let bValue = getNestedValue(b, field) || '';
      
      // Handle date fields
      if (field.toLowerCase().includes('date') || field === 'CREATED_AT' || field === 'dateCreated') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } 
      // Handle string fields
      else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      // Compare based on direction
      if (direction === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };
  
  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchTerm = userSearch.toLowerCase();
    return (
      (user.name || '').toLowerCase().includes(searchTerm) ||
      (user.email || '').toLowerCase().includes(searchTerm)
    );
  });

  // Filter invites based on search term
  const filteredInvites = invites.filter(invite => {
    const searchTerm = inviteSearch.toLowerCase();
    return (
      ((invite.EMAIL || invite.email) || '').toLowerCase().includes(searchTerm)
    );
  });
  
  // Apply sorting to filtered data
  const sortedUsers = sortData(filteredUsers, userSortField, userSortDirection);
  const sortedInvites = sortData(filteredInvites, inviteSortField, inviteSortDirection);

  // Paginate users
  const paginatedUsers = sortedUsers.slice(
    (userPage - 1) * recordsPerPage,
    userPage * recordsPerPage
  );
  
  // Paginate invites
  const paginatedInvites = sortedInvites.slice(
    (invitePage - 1) * recordsPerPage,
    invitePage * recordsPerPage
  );
  
  // Calculate total pages
  const totalUserPages = Math.ceil(filteredUsers.length / recordsPerPage);
  const totalInvitePages = Math.ceil(filteredInvites.length / recordsPerPage);

  // Handle page changes
  const handleUserPageChange = (page: number) => {
    setUserPage(page);
  };

  const handleInvitePageChange = (page: number) => {
    setInvitePage(page);
  };

  // Handle records per page change
  const handleRecordsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRecordsPerPage(Number(e.target.value));
    // Reset to first page when changing records per page
    setUserPage(1);
    setInvitePage(1);
  };

  return (
    <div className="container-fluid px-4 pb-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-11 col-xl-10">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="fw-bold text-uppercase fs-2">User Management</h2>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary d-flex align-items-center gap-2 me-2" onClick={handleExport}>
                <FaFileExport /> Export to Excel
              </button>
              <button className="btn btn-primary d-flex align-items-center gap-2 me-2" onClick={() => setShowAddUserModal(true)}>
                <FaUserPlus /> Add User
              </button>
            </div>
          </div>
          
          {/* Users Table */}
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-primary text-white fw-bold d-flex justify-content-between align-items-center">
              <span>Active Users</span>
              <div className="d-flex align-items-center">
                <div className="input-group me-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1); // Reset to first page on search
                    }}
                  />
                  <span className="input-group-text">
                    <FaSearch />
                  </span>
                </div>
                <div className="d-flex align-items-center">
                  <label htmlFor="userRecordsPerPage" className="text-white me-2 mb-0">Show</label>
                  <select 
                    id="userRecordsPerPage" 
                    className="form-select form-select-sm"
                    value={recordsPerPage}
                    onChange={handleRecordsPerPageChange}
                    style={{ width: 'auto' }}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>
                        <div 
                          className="d-flex align-items-center cursor-pointer" 
                          onClick={() => handleUserSort('name')}
                          style={{ cursor: 'pointer' }}
                        >
                          Name/Email
                          {userSortField === 'name' && (
                            <span className="ms-1">
                              {userSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th>
                        <div 
                          className="d-flex align-items-center cursor-pointer" 
                          onClick={() => handleUserSort('dateCreated')}
                          style={{ cursor: 'pointer' }}
                        >
                          Date Added
                          {userSortField === 'dateCreated' && (
                            <span className="ms-1">
                              {userSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th>
                        <div 
                          className="d-flex align-items-center cursor-pointer" 
                          onClick={() => handleUserSort('roles')}
                          style={{ cursor: 'pointer' }}
                        >
                          Role
                          {userSortField === 'roles' && (
                            <span className="ms-1">
                              {userSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th>
                        <div 
                          className="d-flex align-items-center cursor-pointer" 
                          onClick={() => handleUserSort('status')}
                          style={{ cursor: 'pointer' }}
                        >
                          Status
                          {userSortField === 'status' && (
                            <span className="ms-1">
                              {userSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.length > 0 ? (
                      paginatedUsers.map((user, idx) => (
                        <tr key={`user-${user.id || idx}`}>
                          <td>{idx + 1}</td>
                          <td>
                            <b>{user.name}</b><br />
                            <span className="text-secondary small">{user.email}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {user.dateCreated && user.dateCreated !== 'Invalid Date' 
                              ? new Date(user.dateCreated).toLocaleDateString() 
                              : 'N/A'}
                          </td>
                          <td>{user.roles && Array.isArray(user.roles) ? 
                            (user.roles.some((role: any) => role.id === 1) ? 'Admin' : 'User') : 
                            'User'}</td>
                          <td>
                            {user.status === 'A' ? <span className="text-success fw-semibold">Active</span> :
                              user.status === 'S' ? <span className="text-danger fw-semibold">Suspended</span> :
                                <span className="text-warning fw-semibold">Inactive</span>}
                          </td>
                          <td>
                            <button className="btn btn-sm btn-outline-primary me-1" title="Edit User">
                              <FaEdit />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" title="Delete User" onClick={() => handleDeleteUser(user.id)}><FaTrashAlt /></button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center">
                          {userSearch ? 'No users match your search' : 'No users found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Pagination for Users */}
            {filteredUsers.length > 0 && (
              <div className="d-flex justify-content-between align-items-center mt-3 px-3 pb-3">
                <div className="ms-2">
                  Showing {Math.min((userPage - 1) * recordsPerPage + 1, filteredUsers.length)} to {Math.min(userPage * recordsPerPage, filteredUsers.length)} of {filteredUsers.length} users
                </div>
                <nav aria-label="User pagination">
                  <ul className="pagination mb-0">
                    <li className={`page-item ${userPage === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => handleUserPageChange(userPage - 1)}>
                        Previous
                      </button>
                    </li>
                    {[...Array(totalUserPages)].map((_, i) => (
                      <li key={i} className={`page-item ${userPage === i + 1 ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => handleUserPageChange(i + 1)}>
                          {i + 1}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${userPage === totalUserPages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => handleUserPageChange(userPage + 1)}>
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
          
          {/* Invite User button and Invited Users Table heading */}
          <div className="d-flex justify-content-end align-items-center mb-4 mt-5">
            
            <button className="btn btn-outline-primary d-flex align-items-center gap-2" onClick={() => setShowInviteUserModal(true)}>
              <FaEnvelope /> Invite User
            </button>
          </div>
          
          {/* Invited Users Table */}
          <div className="card shadow-sm">
            <div className="card-header bg-info text-white fw-bold d-flex justify-content-between align-items-center">
              <span>Invited Users</span>
              <div className="d-flex align-items-center">
                <div className="input-group me-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search invites..."
                    value={inviteSearch}
                    onChange={(e) => {
                      setInviteSearch(e.target.value);
                      setInvitePage(1); // Reset to first page on search
                    }}
                  />
                  <span className="input-group-text">
                    <FaSearch />
                  </span>
                </div>
                <div className="d-flex align-items-center">
                  <label htmlFor="inviteRecordsPerPage" className="text-white me-2 mb-0">Show</label>
                  <select 
                    id="inviteRecordsPerPage" 
                    className="form-select form-select-sm"
                    value={recordsPerPage}
                    onChange={handleRecordsPerPageChange}
                    style={{ width: 'auto' }}
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>
                        <div 
                          className="d-flex align-items-center cursor-pointer" 
                          onClick={() => handleInviteSort('EMAIL')}
                          style={{ cursor: 'pointer' }}
                        >
                          Email
                          {inviteSortField === 'EMAIL' && (
                            <span className="ms-1">
                              {inviteSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th>
                        <div 
                          className="d-flex align-items-center cursor-pointer" 
                          onClick={() => handleInviteSort('CREATED_AT')}
                          style={{ cursor: 'pointer' }}
                        >
                          Date Sent
                          {inviteSortField === 'CREATED_AT' && (
                            <span className="ms-1">
                              {inviteSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th>
                        <div 
                          className="d-flex align-items-center cursor-pointer" 
                          onClick={() => handleInviteSort('ROLE_ID')}
                          style={{ cursor: 'pointer' }}
                        >
                          Role
                          {inviteSortField === 'ROLE_ID' && (
                            <span className="ms-1">
                              {inviteSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th>
                        <div 
                          className="d-flex align-items-center cursor-pointer" 
                          onClick={() => handleInviteSort('status')}
                          style={{ cursor: 'pointer' }}
                        >
                          Status
                          {inviteSortField === 'status' && (
                            <span className="ms-1">
                              {inviteSortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th>Expires In</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvites.length > 0 ? (
                      paginatedInvites.map((invite, idx) => {
                        const isExpired = inviteCountdowns[invite.INVITE_ID || invite.id || 0] === 'Expired' || invite.status === 'expired';
                        return (
                          <tr key={`invite-${invite.INVITE_ID || invite.id || 0}`}> 
                            <td>{idx + 1}</td>
                            <td>
                              <b>{invite.EMAIL || invite.email}</b><br />
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {(invite.CREATED_AT || invite.createdAt) && 
                               (invite.CREATED_AT !== 'Invalid Date' && invite.createdAt !== 'Invalid Date') ? 
                                new Date(invite.CREATED_AT || invite.createdAt || '').toLocaleDateString() 
                                : 'N/A'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap'}}>{(invite.ROLE_ID === 1 || invite.roleId === 1) ? 'Admin' : 'User'}</td>
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
                              {inviteCountdowns[invite.INVITE_ID || invite.id || 0] && inviteCountdowns[invite.INVITE_ID || invite.id || 0] !== 'Expired'
                                ? inviteCountdowns[invite.INVITE_ID || invite.id || 0]
                                : <span className="text-danger fw-bold d-flex align-items-center justify-content-start gap-1">Expired!</span>}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', textAlign: 'start', verticalAlign: 'start', display: 'flex', gap: '0.5rem' }}>
                              {(isExpired || (invite.status === 'pending' && inviteCountdowns[invite.INVITE_ID || invite.id || 0] === 'Expired')) && (
                                <button className="btn btn-sm btn-outline-primary me-1 d-flex align-items-center justify-content-start" title="Resend Invite" onClick={() => handleResendInvite(invite.INVITE_ID || invite.id || 0)} disabled={resendingInviteId === (invite.INVITE_ID || invite.id || 0)}>
                                  {resendingInviteId === (invite.INVITE_ID || invite.id || 0) ? (
                                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                  ) : <FaEnvelope className="me-1" />} Resend
                                </button>
                              )}
                              <button className="btn btn-sm btn-outline-danger d-flex align-items-end justify-content-end" title="Remove Invite" onClick={() => handleRemoveInvite(invite.INVITE_ID || invite.id || 0)}><FaTrashAlt /></button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center">
                          {inviteSearch ? 'No invites match your search' : 'No pending invites'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Pagination for Invites */}
            {filteredInvites.length > 0 && (
              <div className="d-flex justify-content-between align-items-center mt-3 px-3 pb-3">
                <div className="ms-2">
                  Showing {Math.min((invitePage - 1) * recordsPerPage + 1, filteredInvites.length)} to {Math.min(invitePage * recordsPerPage, filteredInvites.length)} of {filteredInvites.length} invites
                </div>
                <nav aria-label="Invite pagination">
                  <ul className="pagination mb-0">
                    <li className={`page-item ${invitePage === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => handleInvitePageChange(invitePage - 1)}>
                        Previous
                      </button>
                    </li>
                    {[...Array(totalInvitePages)].map((_, i) => (
                      <li key={i} className={`page-item ${invitePage === i + 1 ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => handleInvitePageChange(i + 1)}>
                          {i + 1}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${invitePage === totalInvitePages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => handleInvitePageChange(invitePage + 1)}>
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
          {showAddUserModal && <AddUserModal show={showAddUserModal} onClose={() => setShowAddUserModal(false)} roles={roles} user={user} onSubmit={handleAddUserSubmit} />}
          {showInviteUserModal && <InviteUserModal show={showInviteUserModal} onClose={() => setShowInviteUserModal(false)} roles={roles} onSubmit={handleInviteUserSubmit} />}
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;

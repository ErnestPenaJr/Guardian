import React, { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { UserPlus, Trash2, Shield } from 'lucide-react'
import api from '../utils/api'
import { useAuth } from '../hooks/useAuth'

interface Role {
  id: number
  name: string
  displayName: string
}

interface JafarUser {
  USER_ID: number
  FIRST_NAME: string | null
  LAST_NAME: string | null
  EMAIL: string
  STATUS: string
  CREATE_DATE: string
  COMPANY_ID: number | null
  COMPANY_NAME: string | null
  roles: Role[]
}

const JafarUserManagement: React.FC = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState<JafarUser[]>([])
  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingRolesUserId, setEditingRolesUserId] = useState<number | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [savingRoles, setSavingRoles] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/jafar-admin/jafar-users')
      setUsers(res.data.data || [])
    } catch (err) {
      console.error('[JAFAR USER MGMT] Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await api.get('/api/roles')
      const roles = (res.data || []).map((r: any) => ({ id: r.id, name: r.name, displayName: r.displayName }))
      setAllRoles(roles)
    } catch (err) {
      console.error('[JAFAR USER MGMT] Failed to load roles:', err)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchRoles()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.email || !form.password) return

    const emailLower = form.email.trim().toLowerCase()

    if (form.password.length < 8) {
      Swal.fire('Weak Password', 'Password must be at least 8 characters.', 'warning')
      return
    }

    try {
      setSubmitting(true)
      await api.post('/api/jafar-admin/jafar-users', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: emailLower,
        password: form.password
      })
      Swal.fire('User Created', `${emailLower} has been added as a Jafar user.`, 'success')
      setForm({ firstName: '', lastName: '', email: '', password: '' })
      setShowAddForm(false)
      fetchUsers()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to create user'
      Swal.fire('Error', msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (target: JafarUser) => {
    const result = await Swal.fire({
      title: 'Remove Jafar User?',
      html: `This will remove <strong>${target.EMAIL}</strong> from the platform.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel'
    })
    if (!result.isConfirmed) return

    try {
      await api.delete(`/api/jafar-admin/jafar-users/${target.USER_ID}`)
      Swal.fire('Removed', `${target.EMAIL} has been removed.`, 'success')
      fetchUsers()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to remove user'
      Swal.fire('Error', msg, 'error')
    }
  }

  const startEditingRoles = (u: JafarUser) => {
    setEditingRolesUserId(u.USER_ID)
    setSelectedRoleIds(u.roles.map(r => r.id))
  }

  const cancelEditingRoles = () => {
    setEditingRolesUserId(null)
    setSelectedRoleIds([])
  }

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    )
  }

  const saveRoles = async () => {
    if (!editingRolesUserId) return
    if (selectedRoleIds.length === 0) {
      Swal.fire('No Roles', 'You must assign at least one role.', 'warning')
      return
    }

    const editingUser = users.find(u => u.USER_ID === editingRolesUserId)
    const wasDemoted = editingUser?.roles.some(r => r.id === 6) && !selectedRoleIds.includes(6)

    if (wasDemoted) {
      const confirm = await Swal.fire({
        title: 'Demote from Jafar?',
        html: `<strong>${editingUser?.EMAIL}</strong> will lose Jafar access and be removed from this list.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Demote',
        cancelButtonText: 'Cancel'
      })
      if (!confirm.isConfirmed) return
    }

    try {
      setSavingRoles(true)
      await api.put(`/api/jafar-admin/jafar-users/${editingRolesUserId}/roles`, { roleIds: selectedRoleIds })
      Swal.fire('Roles Updated', wasDemoted ? 'User has been demoted from Jafar.' : 'User roles have been updated.', 'success')
      setEditingRolesUserId(null)
      setSelectedRoleIds([])
      fetchUsers()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to update roles'
      Swal.fire('Error', msg, 'error')
    } finally {
      setSavingRoles(false)
    }
  }

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return d
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-2xl font-bold uppercase fs-2 mb-0">JAFAR User Management</h2>
        <button
          className="btn btn-primary d-flex align-items-center gap-2"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <UserPlus size={18} />
          {showAddForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showAddForm && (
        <div className="card mb-4 border-primary">
          <div className="card-body">
            <h5 className="card-title mb-3">Add New Jafar User</h5>
            <form onSubmit={handleAdd}>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    required
                    maxLength={30}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                    required
                    maxLength={30}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="user@example.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="mt-3">
                <button type="submit" className="btn btn-success" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : users.length === 0 ? (
        <div className="alert alert-info">No Jafar users found.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSelf = user?.id === u.USER_ID
                const isEditing = editingRolesUserId === u.USER_ID
                return (
                  <tr key={u.USER_ID}>
                    <td>{`${u.FIRST_NAME || ''} ${u.LAST_NAME || ''}`.trim() || '—'}</td>
                    <td>{u.EMAIL}</td>
                    <td>{u.COMPANY_NAME || '—'}</td>
                    <td>
                      {isEditing ? (
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                          {allRoles.map(role => (
                            <button
                              key={role.id}
                              type="button"
                              className={`btn btn-sm ${selectedRoleIds.includes(role.id) ? 'btn-primary' : 'btn-outline-secondary'}`}
                              onClick={() => toggleRole(role.id)}
                              title={role.displayName}
                              style={{ fontSize: '0.75rem' }}
                            >
                              {role.displayName || role.name}
                            </button>
                          ))}
                          <button className="btn btn-sm btn-success ms-2" onClick={saveRoles} disabled={savingRoles}>
                            {savingRoles ? '...' : 'Save'}
                          </button>
                          <button className="btn btn-sm btn-outline-secondary" onClick={cancelEditingRoles}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="d-flex flex-wrap gap-1">
                          {(u.roles || []).map(r => (
                            <span key={r.id} className="badge bg-info text-dark" style={{ fontSize: '0.75rem' }}>
                              {r.displayName || r.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.STATUS === 'A' ? 'bg-success' : 'bg-secondary'}`}>
                        {u.STATUS === 'A' ? 'Active' : u.STATUS}
                      </span>
                    </td>
                    <td>{formatDate(u.CREATE_DATE)}</td>
                    <td>
                      <div className="d-flex gap-1">
                        {!isEditing && (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            title="Change roles"
                            onClick={() => startEditingRoles(u)}
                          >
                            <Shield size={16} />
                          </button>
                        )}
                        {!isSelf && !isEditing && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            title="Remove user"
                            onClick={() => handleRemove(u)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default JafarUserManagement

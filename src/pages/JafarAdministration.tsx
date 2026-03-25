import React, { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import { Info } from 'lucide-react'
import api from '../utils/api'
import { useAuth } from '../hooks/useAuth'

type PurgeScope = 'user' | 'company'

type UserTarget = {
  USER_ID: number
  FIRST_NAME: string | null
  LAST_NAME: string | null
  EMAIL: string
  COMPANY_ID: number | null
  STATUS: string | null
  COMPANY_NAME: string | null
}

type CompanyTarget = {
  COMPANY_ID: number
  NAME: string
  USER_COUNT: number
}

type PreviewResponse = {
  target: Record<string, unknown>
  scope: PurgeScope
  allowed: boolean
  blockers: string[]
  counts: Record<string, number>
}

const countLabelMap: Record<string, string> = {
  userRoles: 'User Roles',
  userWorkspaces: 'User Workspace Links',
  companyInfo: 'Company Info Rows',
  notifications: 'Notifications',
  invites: 'Invites',
  noticesIssued: 'Notices',
  noticeRecipients: 'Notice Recipients',
  noticeReadStatus: 'Notice Read Status',
  workProgress: 'Work Progress',
  attachments: 'Attachments',
  tasks: 'Tasks',
  requests: 'Requests',
  formInstances: 'Form Instances',
  formInstanceValues: 'Form Instance Values',
  milestones: 'Milestones',
  workspaces: 'Workspaces',
  forms: 'Forms',
  formFields: 'Form Fields',
  users: 'Users',
  company: 'Company'
}

const formatUserTargetLabel = (target: UserTarget) => {
  const fullName = `${target.FIRST_NAME || ''} ${target.LAST_NAME || ''}`.trim()
  const primary = fullName || target.EMAIL
  return `${primary}${target.COMPANY_NAME ? ` | ${target.COMPANY_NAME}` : ''}`
}

const formatCompanyTargetLabel = (target: CompanyTarget) => `${target.NAME} | ${target.USER_COUNT} users`

const JafarAdministration: React.FC = () => {
  const { user } = useAuth()
  const [scope, setScope] = useState<PurgeScope>('user')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<UserTarget[]>([])
  const [companies, setCompanies] = useState<CompanyTarget[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [executing, setExecuting] = useState(false)

  const isJafar = useMemo(() => {
    return !!user && (user.roles?.some((role) => role.id === 6) || user.role === '6')
  }, [user])

  useEffect(() => {
    if (!isJafar) return

    let cancelled = false
    const loadTargets = async () => {
      try {
        setLoadingTargets(true)
        if (scope === 'user') {
          const response = await api.get('/api/jafar-admin/users', { params: { q: search || undefined } })
          if (!cancelled) setUsers(response.data.data || [])
        } else {
          const response = await api.get('/api/jafar-admin/companies', { params: { q: search || undefined } })
          if (!cancelled) {
            setCompanies((response.data.data || []).map((company: CompanyTarget) => ({
              ...company,
              USER_COUNT: Number(company.USER_COUNT)
            })))
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[JAFAR ADMIN] Failed to load targets:', error)
        }
      } finally {
        if (!cancelled) {
          setLoadingTargets(false)
        }
      }
    }

    void loadTargets()
    return () => {
      cancelled = true
    }
  }, [isJafar, scope, search])

  useEffect(() => {
    if (!isJafar) return

    const selectedId = scope === 'user' ? selectedUserId : selectedCompanyId
    if (!selectedId) {
      setPreview(null)
      setConfirmation('')
      return
    }

    let cancelled = false
    const loadPreview = async () => {
      try {
        setLoadingPreview(true)
        const url = scope === 'user'
          ? `/api/jafar-admin/purge/user/${selectedId}/preview`
          : `/api/jafar-admin/purge/company/${selectedId}/preview`
        const response = await api.get(url)
        if (!cancelled) {
          setPreview(response.data)
          setConfirmation('')
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[JAFAR ADMIN] Failed to load preview:', error)
          setPreview(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false)
        }
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [isJafar, scope, selectedUserId, selectedCompanyId])

  const selectedLabel = useMemo(() => {
    if (scope === 'user') {
      const target = users.find((entry) => entry.USER_ID === selectedUserId)
      if (!target) return ''
      return formatUserTargetLabel(target)
    }

    const target = companies.find((entry) => entry.COMPANY_ID === selectedCompanyId)
    return target ? formatCompanyTargetLabel(target) : ''
  }, [companies, scope, selectedCompanyId, selectedUserId, users])

  const visibleCounts = useMemo(() => {
    if (!preview) return []
    return Object.entries(preview.counts)
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
  }, [preview])

  const showUserMatches = scope === 'user' && search.trim().length > 0 && selectedUserId === null
  const showCompanyMatches = scope === 'company' && search.trim().length > 0 && selectedCompanyId === null

  const executePurge = async () => {
    if (!preview || !preview.allowed) return

    const confirmed = await Swal.fire({
      title: scope === 'user' ? 'Purge User?' : 'Wipe Company?',
      text: `This will permanently delete ${selectedLabel}. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Yes, continue',
      cancelButtonText: 'Cancel'
    })

    if (!confirmed.isConfirmed) return

    const selectedId = scope === 'user' ? selectedUserId : selectedCompanyId
    if (!selectedId) return

    try {
      setExecuting(true)
      const url = scope === 'user'
        ? `/api/jafar-admin/purge/user/${selectedId}`
        : `/api/jafar-admin/purge/company/${selectedId}`
      const response = await api.post(url, { confirmation: 'DELETE' })
      const deletedCounts = response.data.deletedCounts || {}

      await Swal.fire({
        title: 'Hard Delete Completed',
        html: Object.entries(deletedCounts)
          .filter(([, count]) => Number(count) > 0)
          .map(([key, count]) => `<div style="text-align:left"><strong>${countLabelMap[key] || key}:</strong> ${count}</div>`)
          .join(''),
        icon: 'success',
        confirmButtonText: 'OK'
      })

      setPreview(null)
      setConfirmation('')
      setSelectedUserId(null)
      setSelectedCompanyId(null)
      setSearch('')
    } catch (error: unknown) {
      const message = typeof error === 'object' && error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined
      console.error('[JAFAR ADMIN] Hard delete failed:', error)
      await Swal.fire({
        title: 'Hard Delete Failed',
        text: message || 'The destructive operation failed.',
        icon: 'error'
      })
    } finally {
      setExecuting(false)
    }
  }

  if (!isJafar) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger mb-0">JAFAR access required.</div>
      </div>
    )
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h2 className="fw-bold mb-1">JAFAR Administration</h2>
          <p className="text-muted mb-0">Hard delete users or wipe an entire company account from the system.</p>
        </div>
        <span className="badge text-bg-danger px-3 py-2">JAFAR ONLY</span>
      </div>

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="btn-group mb-3" role="group" aria-label="Destructive scope">
            <button
              type="button"
              className={`btn ${scope === 'user' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => {
                setScope('user')
                setPreview(null)
                setConfirmation('')
              }}
            >
              Purge User
              <span
                className="ms-2 d-inline-flex align-items-center"
                title="Deletes one selected user and the records directly tied to that user."
                aria-label="Purge User information"
              >
                <Info size={14} />
              </span>
            </button>
            <button
              type="button"
              className={`btn ${scope === 'company' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => {
                setScope('company')
                setPreview(null)
                setConfirmation('')
              }}
            >
              Wipe Company
              <span
                className="ms-2 d-inline-flex align-items-center"
                title="Deletes the entire company account, all users in it, and all company-linked data."
                aria-label="Wipe Company information"
              >
                <Info size={14} />
              </span>
            </button>
          </div>

          <div className="small text-muted mb-3">
            {scope === 'user'
              ? 'Purge User: search by email or name, then select the exact user match.'
              : 'Wipe Company: search by company name, then select the company to wipe.'}
          </div>

          <div className="row g-3 align-items-end">
            <div className="col-12">
              <label className="form-label fw-semibold d-flex align-items-center gap-2">
                <span>{scope === 'user' ? 'Find User by Email or Name' : 'Find Company by Name'}</span>
                <span
                  className="text-muted d-inline-flex align-items-center"
                  title={scope === 'user'
                    ? 'Start typing an email or name to see matching users from the database.'
                    : 'Start typing the company name to see matching companies from the database.'}
                  aria-label="Search help"
                >
                  <Info size={14} />
                </span>
              </label>
              <input
                className="form-control"
                value={search}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setSearch(nextValue)
                  setPreview(null)
                  setConfirmation('')
                  if (scope === 'user') {
                    setSelectedUserId(null)
                  } else {
                    setSelectedCompanyId(null)
                  }
                }}
                placeholder={scope === 'user' ? 'Type an email or name' : 'Type a company name'}
              />

              {showUserMatches && (
                <div className="list-group mt-2 shadow-sm">
                  {users.length > 0 ? users.map((target) => (
                    <button
                      key={target.USER_ID}
                      type="button"
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        setSelectedUserId(target.USER_ID)
                        setSearch(target.EMAIL)
                      }}
                    >
                      <div className="fw-semibold">{target.EMAIL}</div>
                      <div className="small text-muted">{formatUserTargetLabel(target)}</div>
                    </button>
                  )) : (
                    <div className="list-group-item text-muted">No matching users found.</div>
                  )}
                </div>
              )}

              {showCompanyMatches && (
                <div className="list-group mt-2 shadow-sm">
                  {companies.length > 0 ? companies.map((target) => (
                    <button
                      key={target.COMPANY_ID}
                      type="button"
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        setSelectedCompanyId(target.COMPANY_ID)
                        setSearch(target.NAME)
                      }}
                    >
                      <div className="fw-semibold">{target.NAME}</div>
                      <div className="small text-muted">{target.USER_COUNT} users</div>
                    </button>
                  )) : (
                    <div className="list-group-item text-muted">No matching companies found.</div>
                  )}
                </div>
              )}

              {selectedLabel && (
                <div className="alert alert-light border mt-3 mb-0 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="small text-muted">{scope === 'user' ? 'Selected User' : 'Selected Company'}</div>
                    <div className="fw-semibold">{selectedLabel}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setSearch('')
                      setPreview(null)
                      setConfirmation('')
                      if (scope === 'user') {
                        setSelectedUserId(null)
                      } else {
                        setSelectedCompanyId(null)
                      }
                    }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          </div>

          {loadingTargets && <div className="small text-muted mt-3">Loading targets...</div>}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Impact Preview</h5>
            {loadingPreview && <span className="small text-muted">Calculating impact...</span>}
          </div>

          {!preview && !loadingPreview && (
            <div className="alert alert-secondary mb-0">Select a target to preview the hard-delete impact.</div>
          )}

          {preview && (
            <>
              <div className={`alert ${preview.allowed ? 'alert-warning' : 'alert-danger'}`}>
                <div className="fw-semibold mb-1">{selectedLabel}</div>
                {preview.blockers.length > 0 ? (
                  <ul className="mb-0 ps-3">
                    {preview.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mb-0">No blockers detected. Typed confirmation is still required.</div>
                )}
              </div>

              <div className="row g-3 mb-4">
                {visibleCounts.length === 0 && (
                  <div className="col-12 text-muted">No linked records were found for this target.</div>
                )}
                {visibleCounts.map(([key, count]) => (
                  <div className="col-md-4" key={key}>
                    <div className="bg-light border rounded p-3 h-100">
                      <div className="small text-muted">{countLabelMap[key] || key}</div>
                      <div className="fs-4 fw-bold">{count}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="row g-3 align-items-end">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Type DELETE to unlock execution</label>
                  <input
                    className="form-control"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                <div className="col-md-6 d-flex justify-content-md-end">
                  <button
                    type="button"
                    className="btn btn-danger px-4"
                    disabled={!preview.allowed || confirmation !== 'DELETE' || executing}
                    onClick={executePurge}
                  >
                    {executing
                      ? (scope === 'user' ? 'Purging User...' : 'Wiping Company...')
                      : (scope === 'user' ? 'Execute User Purge' : 'Execute Company Wipe')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default JafarAdministration

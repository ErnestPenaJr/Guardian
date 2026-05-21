import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Building2, Eye, RotateCcw, Search, ArrowLeft, User as UserIcon } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

interface JafarCompany {
  COMPANY_ID: number;
  NAME: string;
  USER_COUNT: number;
  CREATED_AT?: string | null;
}

interface JafarUser {
  USER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
  ROLE_IDS: number[];
}

const formatCreatedAt = (raw?: string | null): string => {
  if (!raw) return 'Unknown date';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const ROLE_LABEL: Record<number, string> = {
  1: 'Administrator',
  2: 'General User',
  3: 'Processor',
  4: 'Manager',
  5: 'External User',
  6: 'Super Admin',
};
const roleLabelsFor = (ids: number[]): string =>
  ids.length === 0 ? 'No role' : ids.map((id) => ROLE_LABEL[id] || `Role ${id}`).join(', ');

interface JafarCompanySwitcherProps {
  className?: string;
}

// Active impersonation
const KEY_USER_ID = 'jafarImpersonateUserId';
const KEY_USER_NAME = 'jafarImpersonateUserName';
const KEY_COMPANY_ID = 'jafarImpersonateCompanyId';
const KEY_COMPANY_NAME = 'jafarImpersonateCompanyName';
// Stash of the JAFAR home identity (one-time, restored on exit)
const KEY_HOME_COMPANY_ID = 'jafarHomeCompanyId';
const KEY_HOME_COMPANY_NAME = 'jafarHomeCompanyName';
const KEY_HOME_ROLES = 'jafarHomeRoles';
// Legacy keys from the old "view as company" model — wiped on mount
const LEGACY_KEYS = ['jafarActiveCompanyId', 'jafarActiveCompanyName'];

// Mirror the impersonation override into the cached user object + localStorage.companyId
// so the many components that gate on user.companyId / user.roles also follow it.
const applyImpersonationToLocalUser = (
  companyId: number,
  companyName: string,
  roleIds: number[],
) => {
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return;
    const parsed = JSON.parse(rawUser);

    // One-time stash of the JAFAR home identity so "Return to home" can restore it.
    if (!localStorage.getItem(KEY_HOME_COMPANY_ID)) {
      const homeId = parsed.COMPANY_ID ?? parsed.companyId ?? localStorage.getItem('companyId');
      if (homeId != null) localStorage.setItem(KEY_HOME_COMPANY_ID, String(homeId));
      const homeName = parsed.COMPANY_NAME ?? parsed.companyName;
      if (homeName) localStorage.setItem(KEY_HOME_COMPANY_NAME, String(homeName));
      const homeRoles = parsed.roles ?? (parsed.role != null ? [{ id: Number(parsed.role) }] : []);
      localStorage.setItem(KEY_HOME_ROLES, JSON.stringify(homeRoles));
    }

    parsed.COMPANY_ID = companyId;
    parsed.companyId = companyId;
    parsed.COMPANY_NAME = companyName;
    parsed.companyName = companyName;
    parsed.roles = roleIds.map((id) => ({ id, name: ROLE_LABEL[id] || `Role ${id}` }));
    parsed.role = roleIds.length > 0 ? String(roleIds[0]) : undefined;

    localStorage.setItem('user', JSON.stringify(parsed));
    localStorage.setItem('companyId', String(companyId));
  } catch (err) {
    console.error('[JAFAR SWITCHER] Failed to apply impersonation to local user:', err);
  }
};

const restoreLocalUserToHome = () => {
  try {
    const homeId = localStorage.getItem(KEY_HOME_COMPANY_ID);
    const homeName = localStorage.getItem(KEY_HOME_COMPANY_NAME);
    const homeRolesRaw = localStorage.getItem(KEY_HOME_ROLES);
    if (!homeId) return;
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      const idNum = parseInt(homeId, 10);
      parsed.COMPANY_ID = Number.isFinite(idNum) ? idNum : homeId;
      parsed.companyId = parsed.COMPANY_ID;
      if (homeName) {
        parsed.COMPANY_NAME = homeName;
        parsed.companyName = homeName;
      }
      if (homeRolesRaw) {
        try {
          const homeRoles = JSON.parse(homeRolesRaw);
          parsed.roles = homeRoles;
          if (Array.isArray(homeRoles) && homeRoles.length > 0) {
            const firstId = homeRoles[0]?.id ?? homeRoles[0];
            if (firstId != null) parsed.role = String(firstId);
          }
        } catch {
          /* ignore parse failure */
        }
      }
      localStorage.setItem('user', JSON.stringify(parsed));
    }
    localStorage.setItem('companyId', homeId);
  } catch (err) {
    console.error('[JAFAR SWITCHER] Failed to restore home identity on local user:', err);
  } finally {
    localStorage.removeItem(KEY_HOME_COMPANY_ID);
    localStorage.removeItem(KEY_HOME_COMPANY_NAME);
    localStorage.removeItem(KEY_HOME_ROLES);
  }
};

const JafarCompanySwitcher: React.FC<JafarCompanySwitcherProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<JafarCompany[]>([]);
  const [users, setUsers] = useState<JafarUser[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<JafarCompany | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isJafar = useMemo(() => {
    if (!user) return false;
    if (Array.isArray(user.roles) && user.roles.some((r) => r?.id === 6)) return true;
    return String(user.role) === '6';
  }, [user]);

  const activeUserId = localStorage.getItem(KEY_USER_ID);
  const activeUserName = localStorage.getItem(KEY_USER_NAME);
  const activeCompanyId = localStorage.getItem(KEY_COMPANY_ID);
  const activeCompanyName = localStorage.getItem(KEY_COMPANY_NAME);
  const isImpersonating = !!activeUserId;

  // One-time cleanup of legacy "view-as-company" localStorage keys.
  useEffect(() => {
    let touched = false;
    for (const k of LEGACY_KEYS) {
      if (localStorage.getItem(k)) {
        localStorage.removeItem(k);
        touched = true;
      }
    }
    if (touched) console.log('[JAFAR SWITCHER] Cleared legacy view-as-company keys.');
  }, []);

  useEffect(() => {
    if (!isJafar) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedCompany(null);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isJafar]);

  useEffect(() => {
    if (!isJafar || !isOpen || selectedCompany || companies.length > 0) return;
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJafar, isOpen, selectedCompany]);

  useEffect(() => {
    if (!selectedCompany) return;
    fetchUsersForCompany(selectedCompany.COMPANY_ID);
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/jafar-admin/companies');
      const data = res.data?.data || res.data || [];
      if (Array.isArray(data)) setCompanies(data);
    } catch (err) {
      console.error('[JAFAR SWITCHER] Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersForCompany = async (companyId: number) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/jafar-admin/companies/${companyId}/users`);
      const data = res.data?.data || res.data || [];
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error('[JAFAR SWITCHER] Failed to load users for company:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = (company: JafarCompany) => {
    setSelectedCompany(company);
  };

  const handleBackToCompanies = () => {
    setSelectedCompany(null);
    setUsers([]);
    setSearch('');
  };

  const handleSelectUser = (u: JafarUser) => {
    if (!selectedCompany) return;
    const displayName = `${u.FIRST_NAME ?? ''} ${u.LAST_NAME ?? ''}`.trim() || u.EMAIL;
    localStorage.setItem(KEY_USER_ID, String(u.USER_ID));
    localStorage.setItem(KEY_USER_NAME, displayName);
    localStorage.setItem(KEY_COMPANY_ID, String(selectedCompany.COMPANY_ID));
    localStorage.setItem(KEY_COMPANY_NAME, selectedCompany.NAME);
    applyImpersonationToLocalUser(selectedCompany.COMPANY_ID, selectedCompany.NAME, u.ROLE_IDS);
    setIsOpen(false);
    setSelectedCompany(null);
    window.location.reload();
  };

  const handleReturnToHome = () => {
    restoreLocalUserToHome();
    localStorage.removeItem(KEY_USER_ID);
    localStorage.removeItem(KEY_USER_NAME);
    localStorage.removeItem(KEY_COMPANY_ID);
    localStorage.removeItem(KEY_COMPANY_NAME);
    setIsOpen(false);
    setSelectedCompany(null);
    window.location.reload();
  };

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.NAME?.toLowerCase().includes(q) || String(c.COMPANY_ID).includes(q));
  }, [companies, search]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = `${u.FIRST_NAME ?? ''} ${u.LAST_NAME ?? ''}`.toLowerCase();
      return name.includes(q) || (u.EMAIL ?? '').toLowerCase().includes(q);
    });
  }, [users, search]);

  if (!isJafar) return null;

  const displayLabel = isImpersonating
    ? `${activeUserName || 'User'} @ ${activeCompanyName || `Company #${activeCompanyId}`}`
    : 'JAFAR Home View';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
          isImpersonating
            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
            : 'border-gray-200 hover:bg-gray-50'
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={isImpersonating ? `Impersonating user ${activeUserId}` : 'JAFAR home view'}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isImpersonating ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
          {isImpersonating ? <Eye size={18} /> : <Building2 size={18} />}
        </div>
        <div className="flex flex-col items-start text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 max-w-[220px] truncate">{displayLabel}</span>
            {isImpersonating && (
              <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                Impersonating
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">JAFAR Switcher</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[26rem] bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[32rem] flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {selectedCompany && (
                <button
                  type="button"
                  onClick={handleBackToCompanies}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  title="Back to companies"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  {selectedCompany ? `Pick a user in ${selectedCompany.NAME}` : 'Pick a company'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedCompany
                    ? 'You will act as the selected user — their roles, their data, their writes.'
                    : 'Only companies with at least one active user are shown.'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={selectedCompany ? 'Search users...' : 'Search companies...'}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selectedCompany && (
              <button
                onClick={handleReturnToHome}
                disabled={!isImpersonating}
                className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-gray-100 transition-colors ${
                  isImpersonating ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-700">
                  <RotateCcw size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">Return to JAFAR Home View</div>
                  <div className="text-xs text-gray-500">
                    {isImpersonating ? 'End impersonation' : 'Not currently impersonating'}
                  </div>
                </div>
              </button>
            )}

            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : selectedCompany ? (
              filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {search ? 'No matching users' : 'No active users in this company'}
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const displayName = `${u.FIRST_NAME ?? ''} ${u.LAST_NAME ?? ''}`.trim() || u.EMAIL;
                  const isActive = String(u.USER_ID) === activeUserId;
                  return (
                    <button
                      key={u.USER_ID}
                      onClick={() => handleSelectUser(u)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                        isActive ? 'bg-amber-50 border-l-4 border-amber-500' : ''
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                        <UserIcon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 truncate">{displayName}</span>
                          {isActive && (
                            <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {u.EMAIL} · {roleLabelsFor(u.ROLE_IDS)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )
            ) : filteredCompanies.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {search ? 'No matching companies' : 'No companies with users found'}
              </div>
            ) : (
              filteredCompanies.map((company) => {
                const isActiveCompany = String(company.COMPANY_ID) === activeCompanyId;
                return (
                  <button
                    key={company.COMPANY_ID}
                    onClick={() => handleSelectCompany(company)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                      isActiveCompany ? 'bg-amber-50 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActiveCompany ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                      <Building2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 truncate">{company.NAME}</span>
                        {isActiveCompany && (
                          <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {company.COMPANY_ID} · {company.USER_COUNT ?? 0} user{company.USER_COUNT === 1 ? '' : 's'} · Created {formatCreatedAt(company.CREATED_AT)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JafarCompanySwitcher;

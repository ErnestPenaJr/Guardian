import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Building2, Eye, RotateCcw, Search } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

interface JafarCompany {
  COMPANY_ID: number;
  NAME: string;
  USER_COUNT: number;
  CREATED_AT?: string | null;
}

const formatCreatedAt = (raw?: string | null): string => {
  if (!raw) return 'Unknown date';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

interface JafarCompanySwitcherProps {
  className?: string;
}

const JAFAR_COMPANY_ID_KEY = 'jafarActiveCompanyId';
const JAFAR_COMPANY_NAME_KEY = 'jafarActiveCompanyName';
const JAFAR_HOME_COMPANY_ID_KEY = 'jafarHomeCompanyId';
const JAFAR_HOME_COMPANY_NAME_KEY = 'jafarHomeCompanyName';

// Mirror the override into the cached user object + localStorage.companyId so
// the many frontend components that filter on user.companyId / user.COMPANY_ID
// / localStorage.companyId follow the override too. We stash the real home
// values once so "Return to JAFAR view" can restore them.
const applyCompanyOverrideToLocalUser = (companyId: number, companyName: string) => {
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return;
    const parsed = JSON.parse(rawUser);

    if (!localStorage.getItem(JAFAR_HOME_COMPANY_ID_KEY)) {
      const homeId = parsed.COMPANY_ID ?? parsed.companyId ?? localStorage.getItem('companyId');
      if (homeId != null) localStorage.setItem(JAFAR_HOME_COMPANY_ID_KEY, String(homeId));
      const homeName = parsed.COMPANY_NAME ?? parsed.companyName;
      if (homeName) localStorage.setItem(JAFAR_HOME_COMPANY_NAME_KEY, String(homeName));
    }

    parsed.COMPANY_ID = companyId;
    parsed.companyId = companyId;
    parsed.COMPANY_NAME = companyName;
    parsed.companyName = companyName;
    localStorage.setItem('user', JSON.stringify(parsed));
    localStorage.setItem('companyId', String(companyId));
  } catch (err) {
    console.error('[JAFAR SWITCHER] Failed to apply override to local user:', err);
  }
};

const restoreLocalUserToHome = () => {
  try {
    const homeId = localStorage.getItem(JAFAR_HOME_COMPANY_ID_KEY);
    const homeName = localStorage.getItem(JAFAR_HOME_COMPANY_NAME_KEY);
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
      localStorage.setItem('user', JSON.stringify(parsed));
    }
    localStorage.setItem('companyId', homeId);
  } catch (err) {
    console.error('[JAFAR SWITCHER] Failed to restore home company on local user:', err);
  } finally {
    localStorage.removeItem(JAFAR_HOME_COMPANY_ID_KEY);
    localStorage.removeItem(JAFAR_HOME_COMPANY_NAME_KEY);
  }
};

const JafarCompanySwitcher: React.FC<JafarCompanySwitcherProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<JafarCompany[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isJafar = useMemo(() => {
    if (!user) return false;
    if (Array.isArray(user.roles) && user.roles.some((r) => r?.id === 6)) return true;
    return String(user.role) === '6';
  }, [user]);

  const activeOverrideId = localStorage.getItem(JAFAR_COMPANY_ID_KEY);
  const activeOverrideName = localStorage.getItem(JAFAR_COMPANY_NAME_KEY);
  const stashedHomeIdRaw = localStorage.getItem(JAFAR_HOME_COMPANY_ID_KEY);
  const stashedHomeId = stashedHomeIdRaw ? parseInt(stashedHomeIdRaw, 10) : null;
  // While an override is active the cached user.COMPANY_ID has been rewritten,
  // so fall back to the stashed real home id for the "Home" badge.
  const homeCompanyId = (stashedHomeId && Number.isFinite(stashedHomeId))
    ? stashedHomeId
    : user?.COMPANY_ID;

  useEffect(() => {
    if (!isJafar) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isJafar]);

  // Self-heal stale sessions: if jafarActiveCompanyId was set before the
  // user-object-mirroring helper existed, the cached user.companyId still
  // points at the home company and frontend post-filters strip the override
  // company's data. Detect that and apply the override retroactively, then
  // reload so all components pick up the corrected user object.
  useEffect(() => {
    if (!isJafar) return;
    const overrideId = localStorage.getItem(JAFAR_COMPANY_ID_KEY);
    if (!overrideId) return;
    const overrideIdNum = parseInt(overrideId, 10);
    if (!Number.isFinite(overrideIdNum)) return;
    const cachedCompanyId = user?.companyId ?? user?.COMPANY_ID;
    if (cachedCompanyId === overrideIdNum) return;
    const overrideName = localStorage.getItem(JAFAR_COMPANY_NAME_KEY) || `Company ${overrideIdNum}`;
    applyCompanyOverrideToLocalUser(overrideIdNum, overrideName);
    window.location.reload();
  }, [isJafar, user?.companyId, user?.COMPANY_ID]);

  useEffect(() => {
    if (!isJafar || !isOpen || companies.length > 0) return;
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJafar, isOpen]);

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

  const handleSelectCompany = (company: JafarCompany) => {
    localStorage.setItem(JAFAR_COMPANY_ID_KEY, String(company.COMPANY_ID));
    localStorage.setItem(JAFAR_COMPANY_NAME_KEY, company.NAME);
    applyCompanyOverrideToLocalUser(company.COMPANY_ID, company.NAME);
    setIsOpen(false);
    window.location.reload();
  };

  const handleReturnToHome = () => {
    restoreLocalUserToHome();
    localStorage.removeItem(JAFAR_COMPANY_ID_KEY);
    localStorage.removeItem(JAFAR_COMPANY_NAME_KEY);
    setIsOpen(false);
    window.location.reload();
  };

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.NAME?.toLowerCase().includes(q) || String(c.COMPANY_ID).includes(q));
  }, [companies, search]);

  if (!isJafar) return null;

  const isOverridden = !!activeOverrideId;
  const displayLabel = isOverridden
    ? activeOverrideName || `Company #${activeOverrideId}`
    : 'JAFAR Home View';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
          isOverridden
            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
            : 'border-gray-200 hover:bg-gray-50'
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={isOverridden ? `Viewing as company ${activeOverrideId}` : 'JAFAR home view (all companies)'}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isOverridden ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
          {isOverridden ? <Eye size={18} /> : <Building2 size={18} />}
        </div>
        <div className="flex flex-col items-start text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 max-w-[180px] truncate">{displayLabel}</span>
            {isOverridden && (
              <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                Viewing as
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">JAFAR Company Switcher</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[28rem] flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Switch Company View</h3>
            <p className="text-xs text-gray-500 mt-1">
              Browse the platform as a member of any company. Your audit identity stays as JAFAR.
            </p>
          </div>

          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <button
              onClick={handleReturnToHome}
              disabled={!isOverridden}
              className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-gray-100 transition-colors ${
                isOverridden ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-700">
                <RotateCcw size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">Return to JAFAR Home View</div>
                <div className="text-xs text-gray-500">
                  {isOverridden ? 'Clear company override' : 'Already on home view'}
                </div>
              </div>
            </button>

            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading companies...</p>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {search ? 'No matching companies' : 'No companies found'}
              </div>
            ) : (
              filteredCompanies.map((company) => {
                const isActive = String(company.COMPANY_ID) === activeOverrideId;
                const isHome = company.COMPANY_ID === homeCompanyId;
                return (
                  <button
                    key={company.COMPANY_ID}
                    onClick={() => handleSelectCompany(company)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                      isActive ? 'bg-amber-50 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                      <Building2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 truncate">{company.NAME}</span>
                        {isActive && (
                          <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                        {isHome && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            Home
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

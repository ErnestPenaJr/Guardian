import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';

/**
 * JAFAR-only page for managing the role access matrix and the External User
 * type allowlists. Backed by GUARDIAN.ROLE_PERMISSIONS,
 * ROLE_FORM_ALLOWLIST, and ROLE_NOTICE_TYPE_ALLOWLIST. A row in any table
 * is an EXPLICIT OVERRIDE; absence means the matrix default applies.
 *
 * The grid renders three states per (role, key) cell:
 *   ✓  granted  — checkbox checked
 *   ✗  denied   — checkbox unchecked
 *   default     — neither (no override row exists)
 * Saving sends only the deltas that differ from the current server snapshot.
 */

type Tristate = true | false | null;

interface RoleInfo { id: number; name: string }
interface PermissionsResponse {
  defaults: Record<string, number[]>;
  overrides: Record<string, Record<string, { global: boolean | null; byCompany: Record<string, boolean> }>>;
  roles: RoleInfo[];
}
interface FormItem { FORM_ID: number; FORM_NAME: string; FORM_DESCRIPTION?: string }
interface FormAllowlistResponse {
  overrides: Record<string, Record<string, { global: boolean | null; byCompany: Record<string, boolean> }>>;
  forms: FormItem[];
}
interface NoticeTypeAllowlistResponse {
  overrides: Record<string, Record<string, { global: boolean | null; byCompany: Record<string, boolean> }>>;
  noticeTypes: string[];
}

type Tab = 'permissions' | 'forms' | 'noticeTypes';

const KEY_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: 'Home', keys: ['home.requestQueue', 'home.requestOverview', 'home.myRequests', 'home.notices'] },
  { label: 'Requests', keys: ['requests.new', 'requests.viewAll', 'requests.viewAllDetails', 'requests.viewMy', 'requests.start', 'requests.assign', 'requests.reassign', 'requests.tasks', 'requests.complete'] },
  { label: 'Notices', keys: ['notices.new', 'notices.viewAll', 'notices.viewMy', 'notices.respond'] },
  { label: 'Workflows', keys: ['workflows.viewTemplates', 'workflows.createTemplate', 'workflows.editTemplate', 'workflows.deleteTemplate'] },
  { label: 'Reporting', keys: ['reports.workflow'] },
];

function readOverride(
  overrides: PermissionsResponse['overrides'],
  roleId: number,
  key: string,
): Tristate {
  const v = overrides?.[String(roleId)]?.[key]?.global;
  return v === true || v === false ? v : null;
}

function effective(defaultRoles: number[] | undefined, override: Tristate, roleId: number): boolean {
  if (override === true) return true;
  if (override === false) return false;
  return Array.isArray(defaultRoles) && defaultRoles.includes(roleId);
}

export default function JafarRoleSettings() {
  const [tab, setTab] = useState<Tab>('permissions');
  const [perms, setPerms] = useState<PermissionsResponse | null>(null);
  const [forms, setForms] = useState<FormAllowlistResponse | null>(null);
  const [noticeTypes, setNoticeTypes] = useState<NoticeTypeAllowlistResponse | null>(null);
  const [permEdits, setPermEdits] = useState<Map<string, Tristate>>(new Map());
  const [formEdits, setFormEdits] = useState<Map<string, Tristate>>(new Map());
  const [ntEdits, setNtEdits] = useState<Map<string, Tristate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, f, n] = await Promise.all([
        api.get<PermissionsResponse>('/api/admin/permissions'),
        api.get<FormAllowlistResponse>('/api/admin/form-allowlist'),
        api.get<NoticeTypeAllowlistResponse>('/api/admin/notice-type-allowlist'),
      ]);
      setPerms(p.data);
      setForms(f.data);
      setNoticeTypes(n.data);
      setPermEdits(new Map());
      setFormEdits(new Map());
      setNtEdits(new Map());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load role settings';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ---- Permissions tab ----
  const cellKey = (roleId: number, key: string) => `${roleId}::${key}`;
  const getPermValue = (roleId: number, key: string): Tristate => {
    const editKey = cellKey(roleId, key);
    if (permEdits.has(editKey)) return permEdits.get(editKey) as Tristate;
    return readOverride(perms?.overrides || {}, roleId, key);
  };

  const cyclePerm = (roleId: number, key: string) => {
    if (!perms) return;
    const current = getPermValue(roleId, key);
    // Cycle: default -> grant -> deny -> default
    const next: Tristate = current === null ? true : current === true ? false : null;
    const editKey = cellKey(roleId, key);
    setPermEdits((prev) => {
      const m = new Map(prev);
      const original = readOverride(perms.overrides || {}, roleId, key);
      if (next === original) m.delete(editKey);
      else m.set(editKey, next);
      return m;
    });
  };

  const savePerms = async () => {
    if (!perms || permEdits.size === 0) return;
    setSaving(true);
    try {
      const changes = Array.from(permEdits.entries()).map(([k, granted]) => {
        const [roleId, permissionKey] = k.split('::');
        return { roleId: Number(roleId), permissionKey, granted };
      });
      await api.put('/api/admin/permissions', { changes });
      toast.success(`Saved ${changes.length} permission change(s)`);
      await loadAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const resetPerms = async () => {
    if (!confirm('Reset ALL permission overrides to matrix defaults? This cannot be undone.')) return;
    setSaving(true);
    try {
      await api.post('/api/admin/permissions/reset?scope=permissions');
      toast.success('Permissions reset to defaults');
      await loadAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Form allowlist tab (External User only — id 5) ----
  const externalRoleId = 5;
  const formCellKey = (formId: number) => `${externalRoleId}::${formId}`;
  const getFormValue = (formId: number): Tristate => {
    const k = formCellKey(formId);
    if (formEdits.has(k)) return formEdits.get(k) as Tristate;
    const v = forms?.overrides?.[String(externalRoleId)]?.[String(formId)]?.global;
    return v === true || v === false ? v : null;
  };
  const cycleForm = (formId: number) => {
    if (!forms) return;
    const current = getFormValue(formId);
    const next: Tristate = current === null ? true : current === true ? false : null;
    const k = formCellKey(formId);
    setFormEdits((prev) => {
      const m = new Map(prev);
      const orig = forms.overrides?.[String(externalRoleId)]?.[String(formId)]?.global;
      const origTri: Tristate = orig === true || orig === false ? orig : null;
      if (next === origTri) m.delete(k);
      else m.set(k, next);
      return m;
    });
  };
  const saveForms = async () => {
    if (formEdits.size === 0) return;
    setSaving(true);
    try {
      const changes = Array.from(formEdits.entries()).map(([k, granted]) => {
        const [roleId, formId] = k.split('::');
        return { roleId: Number(roleId), formId: Number(formId), granted };
      });
      await api.put('/api/admin/form-allowlist', { changes });
      toast.success(`Saved ${changes.length} form allowlist change(s)`);
      await loadAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Notice type allowlist tab ----
  const ntCellKey = (nt: string) => `${externalRoleId}::${nt}`;
  const getNtValue = (nt: string): Tristate => {
    const k = ntCellKey(nt);
    if (ntEdits.has(k)) return ntEdits.get(k) as Tristate;
    const v = noticeTypes?.overrides?.[String(externalRoleId)]?.[nt]?.global;
    return v === true || v === false ? v : null;
  };
  const cycleNt = (nt: string) => {
    if (!noticeTypes) return;
    const current = getNtValue(nt);
    const next: Tristate = current === null ? true : current === true ? false : null;
    const k = ntCellKey(nt);
    setNtEdits((prev) => {
      const m = new Map(prev);
      const orig = noticeTypes.overrides?.[String(externalRoleId)]?.[nt]?.global;
      const origTri: Tristate = orig === true || orig === false ? orig : null;
      if (next === origTri) m.delete(k);
      else m.set(k, next);
      return m;
    });
  };
  const saveNts = async () => {
    if (ntEdits.size === 0) return;
    setSaving(true);
    try {
      const changes = Array.from(ntEdits.entries()).map(([k, granted]) => {
        const [roleId, noticeType] = k.split('::');
        return { roleId: Number(roleId), noticeType, granted };
      });
      await api.put('/api/admin/notice-type-allowlist', { changes });
      toast.success(`Saved ${changes.length} notice type allowlist change(s)`);
      await loadAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount = useMemo(
    () => (tab === 'permissions' ? permEdits.size : tab === 'forms' ? formEdits.size : ntEdits.size),
    [tab, permEdits, formEdits, ntEdits],
  );

  if (loading) return <div className="p-6">Loading role settings…</div>;
  if (!perms) return <div className="p-6 text-red-600">Failed to load role settings.</div>;

  return (
    <div className="container max-w-full p-6">
      <h1 className="text-2xl font-bold uppercase mb-6">JAFAR · Role Access Matrix</h1>

      <div className="flex gap-2 mb-4 border-b border-gray-200">
        <TabButton active={tab === 'permissions'} onClick={() => setTab('permissions')}>Feature Permissions</TabButton>
        <TabButton active={tab === 'forms'} onClick={() => setTab('forms')}>External User · Forms</TabButton>
        <TabButton active={tab === 'noticeTypes'} onClick={() => setTab('noticeTypes')}>External User · Notice Types</TabButton>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          className="btn btn-primary"
          disabled={saving || dirtyCount === 0}
          onClick={tab === 'permissions' ? savePerms : tab === 'forms' ? saveForms : saveNts}
        >
          {saving ? 'Saving…' : dirtyCount > 0 ? `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}` : 'No changes'}
        </button>
        {tab === 'permissions' && (
          <button className="btn btn-outline-danger" disabled={saving} onClick={resetPerms}>
            Reset all permissions to defaults
          </button>
        )}
        <span className="text-sm text-gray-500">
          Click a cell to cycle: <span className="font-mono">default → grant → deny → default</span>
        </span>
      </div>

      {tab === 'permissions' && (
        <PermissionsGrid
          perms={perms}
          getValue={getPermValue}
          onCellClick={cyclePerm}
        />
      )}

      {tab === 'forms' && forms && (
        <AllowlistGrid
          title="Forms (request types) visible to External User"
          subtitle="No rows = unrestricted (External sees all forms). Add explicit grants to restrict them to a curated list."
          items={forms.forms.map((f) => ({ id: f.FORM_ID, label: f.FORM_NAME, sub: f.FORM_DESCRIPTION }))}
          getValue={(id) => getFormValue(Number(id))}
          onCellClick={(id) => cycleForm(Number(id))}
        />
      )}

      {tab === 'noticeTypes' && noticeTypes && (
        <AllowlistGrid
          title="Notice types visible to External User"
          subtitle="No rows = unrestricted. Add explicit grants to restrict External Users to specific notice types."
          items={noticeTypes.noticeTypes.map((nt) => ({ id: nt, label: nt }))}
          getValue={(id) => getNtValue(String(id))}
          onCellClick={(id) => cycleNt(String(id))}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium ${active ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
    >
      {children}
    </button>
  );
}

function CellButton({ value, onClick }: { value: Tristate; onClick: () => void }) {
  const styles =
    value === true  ? 'bg-green-100 text-green-800 border-green-300' :
    value === false ? 'bg-red-100 text-red-800 border-red-300' :
                      'bg-gray-50 text-gray-400 border-gray-200';
  const label =
    value === true  ? '✓' :
    value === false ? '✗' :
                      '·';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-10 h-8 border rounded text-sm font-bold ${styles} hover:opacity-80`}
      title={value === true ? 'Granted (override)' : value === false ? 'Denied (override)' : 'Default'}
    >
      {label}
    </button>
  );
}

function PermissionsGrid({
  perms, getValue, onCellClick,
}: {
  perms: PermissionsResponse;
  getValue: (roleId: number, key: string) => Tristate;
  onCellClick: (roleId: number, key: string) => void;
}) {
  return (
    <div className="overflow-x-auto bg-white border border-gray-200 rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-gray-50">Permission</th>
            {perms.roles.map((r) => (
              <th key={r.id} className="px-3 py-2 font-semibold text-center">{r.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KEY_GROUPS.map((group) => (
            <React.Fragment key={group.label}>
              <tr className="bg-gray-100">
                <td colSpan={1 + perms.roles.length} className="px-3 py-1 font-semibold text-xs uppercase text-gray-600">
                  {group.label}
                </td>
              </tr>
              {group.keys.map((key) => {
                const defaults = perms.defaults[key] || [];
                return (
                  <tr key={key} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs sticky left-0 bg-white">{key}</td>
                    {perms.roles.map((r) => {
                      const override = getValue(r.id, key);
                      const eff = effective(defaults, override, r.id);
                      return (
                        <td key={r.id} className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <CellButton value={override} onClick={() => onCellClick(r.id, key)} />
                            <span className={`text-[10px] ${eff ? 'text-green-700' : 'text-gray-400'}`}>
                              {eff ? 'allowed' : 'blocked'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllowlistGrid({
  title, subtitle, items, getValue, onCellClick,
}: {
  title: string;
  subtitle: string;
  items: Array<{ id: number | string; label: string; sub?: string }>;
  getValue: (id: number | string) => Tristate;
  onCellClick: (id: number | string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{subtitle}</p>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-2 font-semibold">Item</th>
            <th className="px-3 py-2 font-semibold text-right">External User</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={2} className="px-3 py-6 text-center text-gray-500">No items.</td></tr>
          )}
          {items.map((it) => (
            <tr key={String(it.id)} className="border-t border-gray-100">
              <td className="px-3 py-2">
                <div className="font-medium">{it.label}</div>
                {it.sub && <div className="text-xs text-gray-500">{it.sub}</div>}
              </td>
              <td className="px-3 py-2 text-right">
                <CellButton value={getValue(it.id)} onClick={() => onCellClick(it.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

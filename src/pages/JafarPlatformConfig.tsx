// src/pages/JafarPlatformConfig.tsx
//
// JAFAR-only platform config page (US-CCL-05). Provides three controls
// (disclaimer text, locked field list, permitted subpoena file types) and
// displays the most recent platform audit entries.
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Lock, Plus, Trash2 } from 'lucide-react';
import platformAdminService, {
  type PlatformAuditEntry,
} from '../services/platformAdminService';

const JafarPlatformConfig: React.FC = () => {
  const [disclaimer, setDisclaimer] = useState('');
  const [savingDisclaimer, setSavingDisclaimer] = useState(false);

  const [lockedFields, setLockedFields] = useState<string[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [busyField, setBusyField] = useState<string | null>(null);

  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [newFileType, setNewFileType] = useState('');
  const [savingFileTypes, setSavingFileTypes] = useState(false);

  const [audit, setAudit] = useState<PlatformAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const { data } = await platformAdminService.getAudit();
      setAudit(data.entries || []);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error)?.message ??
        'Failed to load platform audit';
      setAuditError(message);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  // Disclaimer ---------------------------------------------------------------
  const handleSaveDisclaimer = async () => {
    if (!disclaimer.trim()) {
      toast.error('Disclaimer text cannot be empty.');
      return;
    }
    setSavingDisclaimer(true);
    try {
      await platformAdminService.setDisclaimer(disclaimer);
      toast.success('Disclaimer saved.');
      await fetchAudit();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save disclaimer';
      toast.error(message);
    } finally {
      setSavingDisclaimer(false);
    }
  };

  // Locked fields ------------------------------------------------------------
  const handleAddLockedField = async () => {
    const name = newFieldName.trim();
    if (!name) return;
    if (lockedFields.includes(name)) {
      toast.info(`${name} is already locked.`);
      return;
    }
    setBusyField(name);
    try {
      const { data } = await platformAdminService.setFieldLock(name, true);
      setLockedFields(data.lockedFields || [...lockedFields, name]);
      setNewFieldName('');
      toast.success(`Locked field "${name}".`);
      await fetchAudit();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to lock field';
      toast.error(message);
    } finally {
      setBusyField(null);
    }
  };

  const handleRemoveLockedField = async (name: string) => {
    setBusyField(name);
    try {
      const { data } = await platformAdminService.setFieldLock(name, false);
      setLockedFields(data.lockedFields || lockedFields.filter((f) => f !== name));
      toast.success(`Unlocked field "${name}".`);
      await fetchAudit();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to unlock field';
      toast.error(message);
    } finally {
      setBusyField(null);
    }
  };

  // File types ---------------------------------------------------------------
  const handleAddFileType = () => {
    const t = newFileType.trim();
    if (!t) return;
    if (fileTypes.includes(t)) {
      toast.info(`${t} is already in the list.`);
      return;
    }
    setFileTypes([...fileTypes, t]);
    setNewFileType('');
  };

  const handleRemoveFileType = (t: string) => {
    setFileTypes(fileTypes.filter((x) => x !== t));
  };

  const handleSaveFileTypes = async () => {
    if (fileTypes.length === 0) {
      toast.error('Add at least one permitted file type.');
      return;
    }
    setSavingFileTypes(true);
    try {
      await platformAdminService.setFileTypes(fileTypes);
      toast.success('Permitted file types saved.');
      await fetchAudit();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save file types';
      toast.error(message);
    } finally {
      setSavingFileTypes(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">JAFAR Platform Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Platform-wide settings that apply across all tenants. Every change is audited.
        </p>
      </div>

      {/* Disclaimer ------------------------------------------------------- */}
      <section className="bg-white border border-gray-200 rounded-md p-5 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Compliance Disclaimer Text</h2>
          <p className="text-sm text-gray-500">
            Shown on notice templates and forms that have the disclaimer toggle enabled.
          </p>
        </div>
        <textarea
          className="w-full min-h-[120px] border border-gray-300 rounded-md p-2 text-sm font-mono"
          value={disclaimer}
          onChange={(e) => setDisclaimer(e.target.value)}
          placeholder="Enter the platform compliance disclaimer text..."
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveDisclaimer}
            disabled={savingDisclaimer}
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {savingDisclaimer ? 'Saving…' : 'Save Disclaimer'}
          </button>
        </div>
      </section>

      {/* Locked fields ---------------------------------------------------- */}
      <section className="bg-white border border-gray-200 rounded-md p-5 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Locked Fields</h2>
          <p className="text-sm text-gray-500">
            Field names listed here cannot be added to any company template. Use exact
            field-name strings (e.g. <code className="font-mono">SSN</code>,{' '}
            <code className="font-mono">DOB</code>).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lockedFields.length === 0 && (
            <span className="text-sm text-gray-400 italic">No locked fields configured.</span>
          )}
          {lockedFields.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-xs"
            >
              <Lock className="h-3 w-3" />
              {name}
              <button
                type="button"
                onClick={() => handleRemoveLockedField(name)}
                disabled={busyField === name}
                className="ml-1 hover:text-red-900 disabled:opacity-50"
                aria-label={`Unlock ${name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="Field name (e.g. SSN)"
            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddLockedField();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddLockedField}
            disabled={!newFieldName.trim() || busyField !== null}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </section>

      {/* File types ------------------------------------------------------- */}
      <section className="bg-white border border-gray-200 rounded-md p-5 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Permitted Subpoena File Types</h2>
          <p className="text-sm text-gray-500">
            MIME types accepted when external users upload executed subpoenas
            (e.g. <code className="font-mono">application/pdf</code>).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {fileTypes.length === 0 && (
            <span className="text-sm text-gray-400 italic">No file types configured.</span>
          )}
          {fileTypes.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 border border-gray-200 rounded-full px-3 py-1 text-xs font-mono"
            >
              {t}
              <button
                type="button"
                onClick={() => handleRemoveFileType(t)}
                className="ml-1 hover:text-red-700"
                aria-label={`Remove ${t}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newFileType}
            onChange={(e) => setNewFileType(e.target.value)}
            placeholder="MIME type (e.g. application/pdf)"
            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddFileType();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddFileType}
            disabled={!newFileType.trim()}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveFileTypes}
            disabled={savingFileTypes}
            className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {savingFileTypes ? 'Saving…' : 'Save File Types'}
          </button>
        </div>
      </section>

      {/* Audit ------------------------------------------------------------ */}
      <section className="bg-white border border-gray-200 rounded-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Platform Audit Log</h2>
            <p className="text-sm text-gray-500">
              Most recent platform-scoped (cross-tenant) audit entries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchAudit()}
            disabled={auditLoading}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {auditLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {auditError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            {auditError}
          </div>
        )}
        {!auditError && audit.length === 0 && !auditLoading && (
          <div className="text-sm text-gray-500 italic">No audit entries yet.</div>
        )}
        {audit.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Event</th>
                  <th className="px-3 py-2 font-semibold">Actor</th>
                  <th className="px-3 py-2 font-semibold">Target</th>
                  <th className="px-3 py-2 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={String(row.ENTRY_ID)} className="border-t border-gray-100">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                      {new Date(row.CREATED_AT).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.EVENT_TYPE}</td>
                    <td className="px-3 py-2">{row.ACTOR_USER_ID ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.TARGET_ID ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-md truncate">
                      {row.EVENT_DETAIL || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default JafarPlatformConfig;

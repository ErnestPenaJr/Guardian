import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ShieldCheck, AlertCircle, User, Users, X } from 'lucide-react';
import api from '../../utils/api';
import { recipientService, type VerifiedStatus } from '../../services/recipientService';

export type RecipientKind = 'user' | 'group';
export interface RecipientOption {
  kind: RecipientKind;
  id: number;
  label: string;
  sublabel?: string;
}

interface Props {
  disabled?: boolean;
  selected: RecipientOption[];
  onChange: (next: RecipientOption[]) => void;
}

export default function RecipientPicker({ disabled, selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<RecipientOption[]>([]);
  const [groups, setGroups] = useState<RecipientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Phase 6 / US-CCL-03 — verification status keyed by USER_ID. We populate
  // this on-demand for selected recipients only (batch fetch on change), so
  // typing in the search box doesn't trigger any extra network traffic.
  const [verification, setVerification] = useState<Record<number, VerifiedStatus>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.get('/api/notices/eligible-recipients').then((r) => r.data),
      api.get('/api/contact-groups').then((r) => r.data),
    ])
      .then(([u, g]: [unknown, unknown]) => {
        const userOpts: RecipientOption[] = Array.isArray(u)
          ? u.map((x: Record<string, unknown>) => ({
              kind: 'user' as const,
              id: x.USER_ID as number,
              label: `${x.FIRST_NAME} ${x.LAST_NAME}`,
              sublabel: x.EMAIL as string | undefined,
            }))
          : [];
        const groupOpts: RecipientOption[] = Array.isArray(g)
          ? g
              .filter((x: Record<string, unknown>) => !x.GROUP_STATUS || x.GROUP_STATUS === 'ACTIVE')
              .map((x: Record<string, unknown>) => ({
                kind: 'group' as const,
                id: x.CONTACT_GROUP_ID as number,
                label: x.GROUP_NAME as string,
                sublabel: x.MEMBER_COUNT != null ? `${x.MEMBER_COUNT} members` : undefined,
              }))
          : [];
        setUsers(userOpts);
        setGroups(groupOpts);
      })
      .catch((e: unknown) => {
        const err = e as { response?: { status?: number; data?: { error?: string } }; message?: string };
        const status = err?.response?.status;
        const msg = err?.response?.data?.error || err?.message || 'Failed to load recipients';
        setLoadError(status === 403 ? 'You do not have permission to view recipients.' : msg);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Phase 6 / US-CCL-03 — batch-fetch verification for newly selected user
  // recipients. We only request IDs we haven't seen before; groups don't have
  // a verification status. Fallback to FIRST_TIME on any error so the UI still
  // surfaces the safer (amber) badge.
  useEffect(() => {
    const userIds = selected
      .filter((s) => s.kind === 'user')
      .map((s) => s.id)
      .filter((id) => !(id in verification));
    if (userIds.length === 0) return;
    let cancelled = false;
    Promise.all(
      userIds.map((id) =>
        recipientService
          .getVerification(id)
          .then((r) => [id, r.data.verifiedStatus] as const)
          .catch(() => [id, 'FIRST_TIME' as VerifiedStatus] as const),
      ),
    ).then((results) => {
      if (cancelled) return;
      setVerification((prev) => {
        const next = { ...prev };
        for (const [id, status] of results) next[id] = status;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selected, verification]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isSelected = (o: RecipientOption) =>
      selected.some((s) => s.kind === o.kind && s.id === o.id);
    const all = [...groups, ...users].filter((o) => !isSelected(o));
    if (!q) return all.slice(0, 30);
    return all
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.sublabel && o.sublabel.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [query, users, groups, selected]);

  const add = (o: RecipientOption) => {
    onChange([...selected, o]);
    setQuery('');
  };

  const remove = (o: RecipientOption) => {
    onChange(selected.filter((s) => !(s.kind === o.kind && s.id === o.id)));
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div
        style={{
          border: '1px solid #E0E0E0',
          borderRadius: 4,
          padding: '6px 8px',
          minHeight: 40,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          background: disabled ? '#F5F5F5' : '#FFFFFF',
        }}
        onClick={() => !disabled && setOpen(true)}
      >
        {selected.map((s) => {
          const status = s.kind === 'user' ? verification[s.id] : undefined;
          const isVerified = status === 'PREVIOUSLY_VERIFIED';
          const isFirstTime = status === 'FIRST_TIME';
          return (
            <span
              key={`${s.kind}-${s.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: s.kind === 'group' ? '#EBF5FE' : '#F5F5F5',
                color: '#1F1F1F',
                border: s.kind === 'group' ? '1px solid #B5D4F4' : '1px solid #E0E0E0',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {s.kind === 'group' ? <Users size={12} color="#2F8CED" /> : <User size={12} color="#4F4F4F" />}
              {s.label}
              {s.kind === 'user' && (isVerified || isFirstTime) && (
                <span
                  title={isVerified ? 'Previously Verified' : 'First-Time Recipient'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    background: isVerified ? '#E6F4EA' : '#FFF4E5',
                    color: isVerified ? '#1B6B33' : '#8A5A1F',
                    border: `1px solid ${isVerified ? '#B7DFC1' : '#F2D2A1'}`,
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                  data-testid={`recipient-verification-${s.id}`}
                  data-verified-status={isVerified ? 'PREVIOUSLY_VERIFIED' : 'FIRST_TIME'}
                >
                  {isVerified ? <ShieldCheck size={10} /> : <AlertCircle size={10} />}
                  {isVerified ? 'Previously Verified' : 'First-Time Recipient'}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(s);
                }}
                disabled={disabled}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                }}
              >
                <X size={12} color="#828282" />
              </button>
            </span>
          );
        })}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 140 }}>
          <Search size={14} color="#828282" />
          <input
            disabled={disabled}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length ? '' : 'Search users or contact groups'}
            style={{
              border: 'none',
              outline: 'none',
              flex: 1,
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              color: '#1F1F1F',
              background: 'transparent',
            }}
          />
        </div>
      </div>

      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            border: '1px solid #E0E0E0',
            borderRadius: 4,
            boxShadow: '0 4px 16px rgba(3, 36, 36, 0.12)',
            maxHeight: 260,
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {loading ? (
            <div style={{ padding: 12, color: '#828282', fontSize: 13 }}>Loading…</div>
          ) : loadError ? (
            <div style={{ padding: 12, color: '#8A1F1F', fontSize: 13 }}>{loadError}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 12, color: '#828282', fontSize: 13 }}>No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={`${o.kind}-${o.id}`}
                onClick={() => add(o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'Inter, sans-serif',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F5F9FE')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {o.kind === 'group' ? (
                  <Users size={14} color="#2F8CED" />
                ) : (
                  <User size={14} color="#4F4F4F" />
                )}
                <span style={{ fontSize: 14, color: '#1F1F1F' }}>{o.label}</span>
                {o.sublabel && (
                  <span style={{ fontSize: 12, color: '#828282', marginLeft: 'auto' }}>{o.sublabel}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

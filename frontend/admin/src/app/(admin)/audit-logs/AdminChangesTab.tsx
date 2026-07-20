'use client';

// Admin action trail (audit_logs) — who changed what, when, old -> new.
// Separate from the trader-activity tab, which reads user_audit_logs.
// Read-only by design: the trail is append-only, so there is no edit/delete UI.

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import DateField from '@/components/ui/DateField';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface AdminAuditRow {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  admin_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[];
  ip_address: string | null;
  created_at: string;
}

interface FilterOptions {
  modules: string[];
  admins: { id: string; email: string | null; name: string | null }[];
}

const PAGE_SIZE = 25;

function formatTime(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Actions are free-form verbs like "user.add_fund" / "kyc.approve". Colour by
// the destructive/creative sense so a delete stands out when scanning.
function actionTone(action: string) {
  const a = (action || '').toLowerCase();
  if (/delete|remove|reject|ban|terminate|revoke/.test(a)) return 'text-sell border-sell/40';
  if (/create|add|approve|grant|open/.test(a)) return 'text-buy border-buy/40';
  return 'text-text-secondary border-border-primary';
}

function renderValue(v: unknown) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function AdminChangesTab() {
  const [page, setPage] = useState(1);
  const [adminId, setAdminId] = useState('');
  const [moduleF, setModuleF] = useState('');
  const [actionF, setActionF] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [items, setItems] = useState<AdminAuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<FilterOptions>({ modules: [], admins: [] });
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .get<FilterOptions>('/admin-audit-logs/filters')
      .then(setOpts)
      .catch(() => { /* dropdowns just stay empty */ });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: String(PAGE_SIZE) };
      if (adminId) params.admin_id = adminId;
      if (moduleF) params.entity_type = moduleF;
      if (actionF) params.action = actionF;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await adminApi.get<{ items: AdminAuditRow[]; total: number }>(
        '/admin-audit-logs', params,
      );
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load admin changes');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, adminId, moduleF, actionF, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);
  // Any filter change returns to page 1, else you can land on an empty page.
  useEffect(() => { setPage(1); }, [adminId, moduleF, actionF, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectCls =
    'text-xs py-1.5 pl-2 pr-7 min-w-[9rem] appearance-none bg-bg-input border border-border-primary rounded-md text-text-primary';

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-md">
      <div className="flex flex-wrap items-end gap-3 p-3 border-b border-border-primary">
        <div>
          <span className="text-xxs text-text-tertiary block mb-1">Admin</span>
          <div className="relative">
            <select value={adminId} onChange={(e) => setAdminId(e.target.value)} className={selectCls}>
              <option value="">All admins</option>
              {opts.admins.map((a) => (
                <option key={a.id} value={a.id}>{a.name || a.email || a.id.slice(0, 8)}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
          </div>
        </div>
        <div>
          <span className="text-xxs text-text-tertiary block mb-1">Module</span>
          <div className="relative">
            <select value={moduleF} onChange={(e) => setModuleF(e.target.value)} className={selectCls}>
              <option value="">All modules</option>
              {opts.modules.map((m) => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
          </div>
        </div>
        <div>
          <span className="text-xxs text-text-tertiary block mb-1">Action</span>
          <input
            type="text"
            value={actionF}
            onChange={(e) => setActionF(e.target.value)}
            placeholder="e.g. approve…"
            className="text-xs py-1.5 px-2 w-40 bg-bg-input border border-border-primary rounded-md text-text-primary placeholder:text-text-tertiary"
          />
        </div>
        <div>
          <span className="text-xxs text-text-tertiary block mb-1">From</span>
          <DateField value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} />
        </div>
        <div>
          <span className="text-xxs text-text-tertiary block mb-1">To</span>
          <DateField value={dateTo} min={dateFrom || undefined} onChange={setDateTo} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-primary text-left text-text-tertiary uppercase tracking-wider">
              <th className="px-3 py-2 font-semibold">Admin</th>
              <th className="px-3 py-2 font-semibold">Action</th>
              <th className="px-3 py-2 font-semibold">Module</th>
              <th className="px-3 py-2 font-semibold">Record</th>
              <th className="px-3 py-2 font-semibold">Changes</th>
              <th className="px-3 py-2 font-semibold">IP</th>
              <th className="px-3 py-2 font-semibold">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-12 text-center text-text-tertiary">
                <Loader2 className="inline animate-spin mr-2" size={16} />Loading…
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-12 text-center text-text-tertiary">
                No admin changes for these filters
              </td></tr>
            ) : (
              items.map((r) => {
                const hasDiff = (r.changed_fields?.length || 0) > 0 || r.old_values || r.new_values;
                const open = expanded === r.id;
                return (
                  <tr key={r.id} className="border-b border-border-primary/50 align-top">
                    <td className="px-3 py-2">
                      <div className="text-text-primary">{r.admin_name || r.admin_email || '—'}</div>
                      {r.admin_name && r.admin_email ? (
                        <div className="text-xxs text-text-tertiary">{r.admin_email}</div>
                      ) : null}
                      {!r.admin_id ? (
                        <div className="text-xxs text-text-tertiary italic">account deleted</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-xxs font-medium ${actionTone(r.action)}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{(r.entity_type || '—').replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 font-mono text-xxs text-text-tertiary">
                      {r.entity_id ? r.entity_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-3 py-2 max-w-md">
                      {!hasDiff ? (
                        <span className="text-text-tertiary">—</span>
                      ) : (
                        <>
                          <button
                            onClick={() => setExpanded(open ? null : r.id)}
                            className="text-text-secondary hover:text-text-primary underline decoration-dotted"
                          >
                            {r.changed_fields?.length
                              ? `${r.changed_fields.length} field${r.changed_fields.length > 1 ? 's' : ''}: ${r.changed_fields.slice(0, 3).join(', ')}${r.changed_fields.length > 3 ? '…' : ''}`
                              : open ? 'hide' : 'view'}
                          </button>
                          {open ? (
                            <div className="mt-2 space-y-1">
                              {(r.changed_fields?.length
                                ? r.changed_fields
                                : Array.from(new Set([
                                    ...Object.keys(r.old_values || {}),
                                    ...Object.keys(r.new_values || {}),
                                  ]))
                              ).map((k) => (
                                <div key={k} className="flex flex-wrap gap-1 items-baseline">
                                  <span className="text-text-tertiary">{k}:</span>
                                  <span className="text-sell line-through break-all">
                                    {renderValue(r.old_values?.[k])}
                                  </span>
                                  <span className="text-text-tertiary">→</span>
                                  <span className="text-buy break-all">
                                    {renderValue(r.new_values?.[k])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xxs text-text-tertiary">{r.ip_address || '—'}</td>
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{formatTime(r.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-3 border-t border-border-primary">
        <span className="text-xxs text-text-tertiary">
          {total} record{total === 1 ? '' : 's'} · page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-md border border-border-primary text-text-secondary disabled:opacity-40 hover:text-text-primary transition-fast"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-md border border-border-primary text-text-secondary disabled:opacity-40 hover:text-text-primary transition-fast"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

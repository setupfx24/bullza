'use client';

/**
 * Admin review of RM funding requests — the two-admin approve → credit flow.
 *
 * Admin #1 verifies the proof (Approve). Admin #2 (a different person)
 * releases the money into the user's main wallet (Credit). Either can Reject
 * with a reason. The "Credit" button is blocked server-side for the same
 * admin who approved.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, FileText, Check, DollarSign, X } from 'lucide-react';
import { adminApi, getAdminApiBase } from '@/lib/api';

interface RMRequest {
  id: string; rm_name: string; user_id: string; user_name: string; user_email: string | null;
  amount: number; currency: string; method: string | null; note: string | null; has_proof: boolean;
  status: string; approved_by: string | null; approved_at: string | null;
  credited_by: string | null; credited_at: string | null; rejection_reason: string | null; created_at: string | null;
}

const fmt = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  approved: 'bg-accent/15 text-accent',
  credited: 'bg-success/15 text-success',
  rejected: 'bg-sell/15 text-sell',
};
const FILTERS = ['pending', 'approved', 'credited', 'rejected', 'all'];

export default function RMRequestsPage() {
  const [rows, setRows] = useState<RMRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminApi.get<{ requests: RMRequest[] }>('/rm/requests', { status: statusFilter });
      setRows(d.requests || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, kind: 'approve' | 'credit') => {
    setBusy(id);
    try {
      await adminApi.post(`/rm/requests/${id}/${kind}`);
      toast.success(kind === 'approve' ? 'Proof approved — a second admin must release funds' : 'Funds released to the user');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt('Reason for rejecting this request?');
    if (reason === null) return;
    if (!reason.trim()) return toast.error('A reason is required');
    setBusy(id);
    try {
      await adminApi.post(`/rm/requests/${id}/reject`, { reason: reason.trim() });
      toast.success('Request rejected');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Reject failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">RM Funding Requests</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">Two-admin flow: Approve the proof, then a different admin Credits the user.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-md capitalize border ${statusFilter === f ? 'bg-bg-hover text-text-primary border-border-primary' : 'text-text-secondary border-transparent hover:bg-bg-hover/60'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-text-tertiary" size={20} /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-xs text-text-tertiary">No {statusFilter !== 'all' ? statusFilter : ''} requests.</div>
      ) : (
        <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-text-tertiary text-left uppercase tracking-wide border-b border-border-primary">
              <th className="py-2.5 px-3">Date</th><th className="py-2.5 px-3">RM</th><th className="py-2.5 px-3">Client</th>
              <th className="py-2.5 px-3">Amount</th><th className="py-2.5 px-3">Method</th><th className="py-2.5 px-3">Proof</th>
              <th className="py-2.5 px-3">Status</th><th className="py-2.5 px-3 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border-primary/50 align-top">
                  <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  <td className="py-2.5 px-3 text-text-primary">{r.rm_name}</td>
                  <td className="py-2.5 px-3">
                    <a href={`/users/${r.user_id}`} className="text-accent hover:underline">{r.user_name}</a>
                    {r.user_email && <span className="block text-[10px] text-text-tertiary">{r.user_email}</span>}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-text-primary">{fmt(r.amount)}</td>
                  <td className="py-2.5 px-3 capitalize text-text-secondary">{r.method || '—'}{r.note && <span className="block text-[10px] text-text-tertiary">{r.note}</span>}</td>
                  <td className="py-2.5 px-3">
                    {r.has_proof ? (
                      <a href={`${getAdminApiBase()}/rm/requests/${r.id}/proof`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent hover:underline"><FileText size={12} /> View</a>
                    ) : '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[r.status] || 'bg-bg-tertiary text-text-tertiary'}`}>{r.status}</span>
                    {r.approved_by && <span className="block text-[10px] text-text-tertiary mt-0.5">Approved by {r.approved_by}</span>}
                    {r.credited_by && <span className="block text-[10px] text-text-tertiary">Credited by {r.credited_by}</span>}
                    {r.status === 'rejected' && r.rejection_reason && <span className="block text-[10px] text-text-tertiary mt-0.5">{r.rejection_reason}</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === 'pending' && (
                        <button disabled={busy === r.id} onClick={() => act(r.id, 'approve')}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-50">
                          <Check size={12} /> Approve
                        </button>
                      )}
                      {r.status === 'approved' && (
                        <button disabled={busy === r.id} onClick={() => act(r.id, 'credit')}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-success/15 text-success hover:bg-success/25 disabled:opacity-50">
                          <DollarSign size={12} /> Credit
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'approved') && (
                        <button disabled={busy === r.id} onClick={() => reject(r.id)}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-sell/15 text-sell hover:bg-sell/25 disabled:opacity-50">
                          <X size={12} /> Reject
                        </button>
                      )}
                      {busy === r.id && <Loader2 size={13} className="animate-spin text-text-tertiary" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

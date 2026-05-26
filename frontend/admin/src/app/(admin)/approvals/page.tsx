'use client';

/**
 * Pending dual-approval queue.
 *
 * Add-fund / deduct-fund actions ≥ ADMIN_DUAL_APPROVAL_THRESHOLD (default
 * $1,000) don't execute immediately — they create a row in the
 * admin_approval_requests table and return HTTP 202 to the requesting
 * admin. A second admin lands here, reviews, and clicks Approve or Reject.
 * After Approve, the original admin re-invokes their action with
 * ?approval_request_id=<id> to actually move the money.
 *
 * Backend routes (from services/admin/routes/approvals.py):
 *   GET  /admin/approvals
 *   POST /admin/approvals/{id}/approve
 *   POST /admin/approvals/{id}/reject  body={reason}
 */

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Check, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface ApprovalRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown> | null;
  requested_by: string;
  requested_at: string;
  status: string;
  expires_at: string;
}

function formatTime(d: string) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function formatPayload(p: Record<string, unknown> | null | undefined): string {
  if (!p) return '—';
  const amt = (p as { amount?: string | number }).amount;
  const desc = (p as { description?: string }).description;
  const parts: string[] = [];
  if (amt != null) parts.push(`$${Number(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  if (desc) parts.push(`"${desc}"`);
  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(p);
}

const ACTION_LABEL: Record<string, string> = {
  add_fund: 'Add Fund',
  deduct_fund: 'Deduct Fund',
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Custom confirmation modal — replaces the native window.confirm so
  // the dialog matches the rest of the admin UI (responsive, themed)
  // instead of falling back to the browser-default popup.
  const [confirmRow, setConfirmRow] = useState<ApprovalRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: ApprovalRow[] }>('/approvals');
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onApprove = (row: ApprovalRow) => {
    setConfirmRow(row);
  };

  const doApprove = async (row: ApprovalRow) => {
    setConfirmRow(null);
    setBusyId(row.id);
    try {
      await adminApi.post(`/approvals/${row.id}/approve`, {});
      toast.success('Approved — original admin must re-invoke to execute.');
      await fetchData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Approve failed';
      // 403 = same admin trying to approve their own request
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (row: ApprovalRow) => {
    if (!rejectReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setBusyId(row.id);
    try {
      await adminApi.post(`/approvals/${row.id}/reject`, { reason: rejectReason.trim() });
      toast.success('Rejected');
      setRejectFor(null);
      setRejectReason('');
      await fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <ShieldCheck size={16} className="text-buy" />
            Approval Queue
          </h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Dual-approval requests for high-value fund actions. A second admin must approve
            before the original action takes effect.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"
          aria-label="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-xs text-text-tertiary py-12">
            No pending approval requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-primary bg-bg-tertiary/40">
                  {['Action', 'Target', 'Amount / Note', 'Requested', 'Expires', ''].map((c) => (
                    <th
                      key={c}
                      className="text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const busy = busyId === row.id;
                  const isRejecting = rejectFor === row.id;
                  return (
                    <tr key={row.id} className="border-b border-border-primary/50 hover:bg-bg-hover">
                      <td className="px-4 py-2.5 text-xs text-text-primary font-medium">
                        {ACTION_LABEL[row.action] || row.action}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary font-mono">
                        {row.target_type}/{row.target_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-primary">
                        {formatPayload(row.payload)}
                      </td>
                      <td className="px-4 py-2.5 text-xxs text-text-tertiary">
                        {formatTime(row.requested_at)}
                      </td>
                      <td className="px-4 py-2.5 text-xxs text-text-tertiary">
                        {formatTime(row.expires_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        {!isRejecting ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => onApprove(row)}
                              disabled={busy}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-fast',
                                'bg-success/15 text-success border border-success/30 hover:bg-success/25',
                                busy && 'opacity-50',
                              )}
                            >
                              {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              Approve
                            </button>
                            <button
                              onClick={() => { setRejectFor(row.id); setRejectReason(''); }}
                              disabled={busy}
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-fast',
                                'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
                                busy && 'opacity-50',
                              )}
                            >
                              <X size={11} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 justify-end">
                            <input
                              type="text"
                              autoFocus
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason"
                              className="px-2 py-1 rounded-md text-xs bg-bg-input border border-border-primary text-text-primary w-44"
                            />
                            <button
                              onClick={() => onReject(row)}
                              disabled={busy || !rejectReason.trim()}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-danger text-white disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={11} className="animate-spin" /> : 'Confirm'}
                            </button>
                            <button
                              onClick={() => { setRejectFor(null); setRejectReason(''); }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-text-tertiary hover:text-text-primary"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom approval-confirmation modal — replaces native confirm() */}
      {confirmRow && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
          onClick={() => setConfirmRow(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border-primary bg-bg-secondary shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-border-primary/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-success/15 text-success">
                  <ShieldCheck size={14} />
                </span>
                <h2 className="text-sm font-semibold text-text-primary">
                  Confirm approval
                </h2>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                You&apos;re approving{' '}
                <strong className="text-text-primary">
                  {ACTION_LABEL[confirmRow.action] || confirmRow.action}
                </strong>{' '}
                of{' '}
                <strong className="text-text-primary font-mono">
                  {formatPayload(confirmRow.payload)}
                </strong>
                . The original admin will then need to re-invoke the action to actually
                move the funds.
              </p>
            </div>
            <div className="px-5 py-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmRow(null)}
                className="px-4 py-2 rounded-md text-xs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doApprove(confirmRow)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-success text-black hover:bg-success/90 transition-fast"
              >
                <Check size={13} /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Employee Tasks + Daily Reports (client 2026-06-16).
 *  - My Tasks: every employee sees their assigned work and marks each
 *    Done / Undone (Undone needs a reason).
 *  - Assign: managers with `tasks.assign` give work to employees.
 *  - Reports: managers with `tasks.view_all` review everyone's tasks.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, XCircle, Plus, ClipboardList } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import DateField from '@/components/ui/DateField';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  status: 'pending' | 'done' | 'undone';
  undone_reason?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  assigned_by_name?: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
}

interface Emp { user_id: string; name: string; email: string; role: string }

const STATUS_STYLE: Record<string, string> = {
  done: 'bg-success/15 text-success',
  undone: 'bg-danger/15 text-danger',
  pending: 'bg-warning/15 text-warning',
};

export default function TasksPage() {
  const [tab, setTab] = useState<'my' | 'assign' | 'reports'>('my');
  const [perms, setPerms] = useState<{ permissions: string[]; employee_role?: string }>({ permissions: [] });

  const isSuper = perms.employee_role === 'super_admin';
  const canAssign = isSuper || perms.permissions.includes('*') || perms.permissions.includes('tasks.assign');
  const canView = isSuper || perms.permissions.includes('*') || perms.permissions.includes('tasks.view_all');

  useEffect(() => {
    adminApi.get<{ permissions: string[]; employee_role?: string }>('/auth/me')
      .then((m) => setPerms({ permissions: m?.permissions || [], employee_role: m?.employee_role }))
      .catch(() => {});
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-text-secondary" />
        <h1 className="text-lg font-semibold text-text-primary">Tasks & Daily Reports</h1>
      </div>

      <div className="flex gap-1.5 border-b border-border-primary">
        {([['my', 'My Tasks']] as const)
          .concat(canAssign ? [['assign', 'Assign'] as any] : [])
          .concat(canView ? [['reports', 'Reports'] as any] : [])
          .map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={cn(
                'px-3 py-2 text-xs font-medium -mb-px border-b-2 transition-fast',
                tab === key ? 'border-buy text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
            >
              {label}
            </button>
          ))}
      </div>

      {tab === 'my' && <MyTasks />}
      {tab === 'assign' && canAssign && <AssignTask />}
      {tab === 'reports' && canView && <Reports />}
    </div>
  );
}

function MyTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.get<{ items: Task[] }>('/tasks/my');
      setTasks(r?.items || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const mark = async (id: string, status: 'done' | 'undone', undone_reason?: string) => {
    setBusy(id);
    try {
      await adminApi.patch(`/tasks/${id}`, { status, undone_reason });
      toast.success(status === 'done' ? 'Marked done' : 'Marked undone');
      setReasonFor(null); setReason('');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally { setBusy(null); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-text-tertiary" /></div>;
  if (!tasks.length) return <p className="text-sm text-text-tertiary py-8 text-center">No tasks assigned to you yet.</p>;

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t.id} className="rounded-lg border border-border-primary bg-bg-secondary p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-text-primary">{t.title}</span>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium uppercase', STATUS_STYLE[t.status])}>{t.status}</span>
              </div>
              {t.description ? <p className="text-xs text-text-secondary mt-1 leading-relaxed">{t.description}</p> : null}
              <p className="text-[11px] text-text-tertiary mt-1">
                {t.assigned_by_name ? `By ${t.assigned_by_name}` : ''}{t.due_date ? ` · Due ${t.due_date}` : ''}
              </p>
              {t.status === 'undone' && t.undone_reason ? (
                <p className="text-[11px] text-danger mt-1">Reason: {t.undone_reason}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                disabled={busy === t.id}
                onClick={() => mark(t.id, 'done')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xxs font-medium bg-success/15 text-success border border-success/30 hover:bg-success/25 disabled:opacity-50"
              >
                <CheckCircle2 size={13} /> Done
              </button>
              <button
                disabled={busy === t.id}
                onClick={() => { setReasonFor(reasonFor === t.id ? null : t.id); setReason(t.undone_reason || ''); }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xxs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 disabled:opacity-50"
              >
                <XCircle size={13} /> Undone
              </button>
            </div>
          </div>
          {reasonFor === t.id && (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason — kaam kyun nahi hua?"
                className="flex-1 text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
              />
              <button
                disabled={!reason.trim() || busy === t.id}
                onClick={() => mark(t.id, 'undone', reason.trim())}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-buy text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AssignTask() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.get<{ items: Emp[] }>('/tasks/assignable-employees')
      .then((r) => setEmps(r?.items || []))
      .catch((e: any) => toast.error(e?.message || 'Failed to load employees'));
  }, []);

  const submit = async () => {
    if (!assignedTo) { toast.error('Choose an employee'); return; }
    if (!title.trim()) { toast.error('Enter a task title'); return; }
    setBusy(true);
    try {
      await adminApi.post('/tasks', {
        assigned_to: assignedTo,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
      });
      toast.success('Task assigned');
      setTitle(''); setDescription(''); setDueDate('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign');
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-4 space-y-3 max-w-lg">
      <div>
        <label className="block text-xxs text-text-tertiary mb-1">Assign to</label>
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full text-xs py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary">
          <option value="">— Select employee —</option>
          {emps.map((e) => <option key={e.user_id} value={e.user_id}>{e.name} ({e.role}) — {e.email}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xxs text-text-tertiary mb-1">Task title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review pending KYC docs" className="w-full text-xs py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary" />
      </div>
      <div>
        <label className="block text-xxs text-text-tertiary mb-1">Details (optional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full text-xs py-2 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary resize-none" />
      </div>
      <div>
        <label className="block text-xxs text-text-tertiary mb-1">Due date (optional)</label>
        <DateField value={dueDate} onChange={setDueDate} />
      </div>
      <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-buy text-white hover:bg-buy-light disabled:opacity-50">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Assign task
      </button>
    </div>
  );
}

function Reports() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [filterEmp, setFilterEmp] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminApi.get<{ items: Emp[] }>('/tasks/assignable-employees').then((r) => setEmps(r?.items || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterEmp) qs.set('assigned_to', filterEmp);
      if (filterDate) qs.set('on_date', filterDate);
      const r = await adminApi.get<{ items: Task[] }>(`/tasks${qs.toString() ? `?${qs}` : ''}`);
      setTasks(r?.items || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load reports');
    } finally { setLoading(false); }
  }, [filterEmp, filterDate]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xxs text-text-tertiary mb-1">Employee</label>
          <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)} className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary">
            <option value="">All</option>
            {emps.map((e) => <option key={e.user_id} value={e.user_id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xxs text-text-tertiary mb-1">Date</label>
          <DateField value={filterDate} onChange={setFilterDate} />
        </div>
        {filterDate && <button onClick={() => setFilterDate('')} className="text-xxs text-text-tertiary hover:text-text-primary underline pb-2">Clear date</button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-text-tertiary" /></div>
      ) : !tasks.length ? (
        <p className="text-sm text-text-tertiary py-8 text-center">No tasks match.</p>
      ) : (
        <div className="rounded-lg border border-border-primary overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-bg-tertiary/40">
              <tr className="text-xxs uppercase text-text-tertiary">
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Reason (if undone)</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t border-border-primary/50 text-xs">
                  <td className="px-3 py-2 text-text-primary">{t.assigned_to_name || '—'}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {t.title}
                    {t.description ? <span className="block text-[11px] text-text-tertiary">{t.description}</span> : null}
                  </td>
                  <td className="px-3 py-2"><span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium uppercase', STATUS_STYLE[t.status])}>{t.status}</span></td>
                  <td className="px-3 py-2 text-danger text-[11px]">{t.status === 'undone' ? (t.undone_reason || '—') : ''}</td>
                  <td className="px-3 py-2 text-text-tertiary text-[11px]">{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

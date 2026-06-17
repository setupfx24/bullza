'use client';

/**
 * Custom employee roles (client 2026-06-16) — super admin creates a reusable
 * role (name + permission set) that can be assigned to many employees, just
 * like the built-in roles. Resolved by the backend require_permission().
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus, Save, Trash2, KeyRound } from 'lucide-react';
import { adminApi } from '@/lib/api';

interface CustomRole { id: string; name: string; permissions: string[] }

export default function RolesPage() {
  const [catalog, setCatalog] = useState<Record<string, string[]>>({});
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomRole | 'new' | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, list] = await Promise.all([
        adminApi.get<{ catalog: Record<string, string[]> }>('/employees/permissions/catalog'),
        adminApi.get<{ items: CustomRole[] }>('/employees/roles'),
      ]);
      setCatalog(cat?.catalog || {});
      setRoles(list?.items || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing('new'); setName(''); setSelected(new Set()); };
  const openEdit = (r: CustomRole) => { setEditing(r); setName(r.name); setSelected(new Set(r.permissions || [])); };

  const toggle = (p: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const save = async () => {
    const perms = Array.from(selected);
    if (editing === 'new' && !name.trim()) { toast.error('Role name required'); return; }
    setSaving(true);
    try {
      if (editing === 'new') {
        await adminApi.post('/employees/roles', { name: name.trim(), permissions: perms });
        toast.success('Role created');
      } else if (editing) {
        await adminApi.put(`/employees/roles/${editing.id}`, { name: editing.name, permissions: perms });
        toast.success('Role updated');
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const remove = async (r: CustomRole) => {
    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    try {
      await adminApi.delete(`/employees/roles/${r.id}`);
      toast.success('Role deleted');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-text-tertiary" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-text-secondary" />
          <h1 className="text-lg font-semibold text-text-primary">Custom Roles</h1>
        </div>
        {!editing && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-buy rounded-md hover:bg-buy-light">
            <Plus size={13} /> New role
          </button>
        )}
      </div>
      <p className="text-xxs text-text-tertiary -mt-1">
        Banaya gaya role kai employees ko assign ho sakta hai. Built-in roles (finance, support, etc.) yahan nahi dikhte — sirf custom roles.
      </p>

      {editing ? (
        <div className="rounded-md border border-border-primary bg-bg-secondary p-4 space-y-3">
          <div>
            <label className="block text-xxs text-text-tertiary mb-1">Role name</label>
            <input
              value={name}
              disabled={editing !== 'new'}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Accountant"
              className="w-64 text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary disabled:opacity-60"
            />
            {editing !== 'new' && <span className="ml-2 text-[11px] text-text-tertiary">(name can't be changed)</span>}
          </div>
          <div>
            <label className="block text-xxs text-text-tertiary mb-1.5">Permissions</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(catalog).map(([group, perms]) => (
                <div key={group} className="rounded-md border border-border-primary/60 p-2.5">
                  <p className="text-xxs font-semibold text-text-secondary mb-1.5">{group}</p>
                  <div className="space-y-1">
                    {perms.map((p) => (
                      <label key={p} className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer">
                        <input type="checkbox" checked={selected.has(p)} onChange={() => toggle(p)} className="w-3.5 h-3.5 accent-buy" />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy text-white disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save role
            </button>
          </div>
        </div>
      ) : roles.length === 0 ? (
        <p className="text-sm text-text-tertiary py-8 text-center">No custom roles yet. Click "New role" to create one.</p>
      ) : (
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="rounded-md border border-border-primary bg-bg-secondary p-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">{r.name}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5 break-words">
                  {r.permissions?.length ? r.permissions.join(', ') : 'No permissions'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => openEdit(r)} className="px-2.5 py-1 rounded-md text-xxs font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25">Edit</button>
                <button onClick={() => remove(r)} className="p-1.5 rounded-md text-text-tertiary hover:text-danger border border-border-primary"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

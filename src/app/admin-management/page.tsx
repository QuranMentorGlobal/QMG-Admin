// ============================================================
// PASTE THIS WHOLE FILE INTO:  src/app/admin-management/page.tsx
// Sub-Admin Management (Super Admin / granted admins). Create, edit, suspend,
// activate and delete sub-admins, assigning permissions via a clean matrix.
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'
import { PERMISSION_GROUPS, ROLE_PRESETS } from '@/lib/permissions'
import { Plus, Pencil, Trash2, Power, X, Check, ShieldCheck } from 'lucide-react'

const GOLD = '#B8952A', INK = '#1A1A1A', BORDER = '#E8E4DA', MUTED = '#9A9A8A', RED = '#DC2626', CREAM = '#F7F1E2'

type Sub = {
  id: string; email: string; first_name: string; last_name: string
  admin_permissions: string[]; admin_status: string; admin_role_label: string | null
}
type FormState = {
  id?: string; email: string; password: string; firstName: string; lastName: string
  roleLabel: string; perms: string[]
}
const EMPTY: FormState = { email: '', password: '', firstName: '', lastName: '', roleLabel: '', perms: [] }

export default function AdminManagementPage() {
  const [adminName, setAdminName] = useState('Admin')
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')

  const editing = !!form.id

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient(); const { data: { user } } = await sb.auth.getUser()
        if (user) { const { data: p } = await sb.from('profiles').select('first_name').eq('id', user.id).single(); setAdminName((p as any)?.first_name || 'Admin') }
      } catch {}
    })()
    load()
  }, [])

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 2600) }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/sub-admins')
      const d = await res.json()
      if (res.ok) setSubs(d.subAdmins || [])
    } catch {}
    setLoading(false)
  }

  function openCreate() { setForm(EMPTY); setErr(''); setOpen(true) }
  function openEdit(s: Sub) {
    setForm({ id: s.id, email: s.email, password: '', firstName: s.first_name || '', lastName: s.last_name || '', roleLabel: s.admin_role_label || '', perms: s.admin_permissions || [] })
    setErr(''); setOpen(true)
  }

  function togglePerm(k: string) {
    setForm(f => ({ ...f, perms: f.perms.includes(k) ? f.perms.filter(x => x !== k) : [...f.perms, k] }))
  }
  function applyPreset(p: typeof ROLE_PRESETS[0]) {
    setForm(f => ({ ...f, perms: [...p.perms], roleLabel: f.roleLabel || p.label }))
  }

  async function save() {
    setErr(''); setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/sub-admins/${form.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: form.perms, roleLabel: form.roleLabel }),
        })
        const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Update failed')
        showToast('✅ Sub-admin updated')
      } else {
        const res = await fetch('/api/sub-admins', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, roleLabel: form.roleLabel, permissions: form.perms }),
        })
        const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Create failed')
        showToast('✅ Sub-admin created')
      }
      setOpen(false); load()
    } catch (e: any) { setErr(e.message) }
    setSaving(false)
  }

  async function setStatus(s: Sub, status: 'active' | 'suspended') {
    await fetch(`/api/sub-admins/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    showToast(status === 'suspended' ? 'Sub-admin suspended' : 'Sub-admin activated'); load()
  }
  async function remove(s: Sub) {
    if (!confirm(`Delete ${s.email}? This permanently removes their account.`)) return
    const res = await fetch(`/api/sub-admins/${s.id}`, { method: 'DELETE' })
    if (res.ok) { showToast('Sub-admin deleted'); load() } else { const d = await res.json(); showToast(d.error || 'Delete failed') }
  }

  const canSave = editing ? form.perms.length > 0 : (!!form.email && form.password.length >= 8)

  return (
    <AdminLayout adminName={adminName}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Admin Management</h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '5px 0 0' }}>Create scoped admin accounts and assign exactly the permissions they need.</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11, border: 'none', cursor: 'pointer', background: GOLD, color: '#1A1400', fontSize: 13, fontWeight: 700 }}>
          <Plus size={16} /> Create Sub Admin
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading…</div>
          : subs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <ShieldCheck size={30} style={{ color: GOLD }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: INK, margin: '10px 0 4px' }}>No sub-admins yet</p>
              <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>Create one to delegate parts of the platform without sharing full access.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#FBF8F1' }}>
                    <th style={{ padding: '12px 16px' }}>Name</th><th style={{ padding: '12px 16px' }}>Email</th>
                    <th style={{ padding: '12px 16px' }}>Role</th><th style={{ padding: '12px 16px', textAlign: 'center' }}>Permissions</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th><th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: INK }}>{`${s.first_name || ''} ${s.last_name || ''}`.trim() || '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#555' }}>{s.email}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 11.5, fontWeight: 700, color: GOLD, background: CREAM, padding: '3px 9px', borderRadius: 8 }}>{s.admin_role_label || 'Sub Admin'}</span></td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: INK, fontWeight: 700 }}>{(s.admin_permissions || []).length}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.admin_status === 'suspended' ? '#FEE2E2' : '#F7F1E2', color: s.admin_status === 'suspended' ? RED : GOLD }}>
                          {s.admin_status === 'suspended' ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => openEdit(s)} title="Edit" style={iconBtn}><Pencil size={15} /></button>
                          <button onClick={() => setStatus(s, s.admin_status === 'suspended' ? 'active' : 'suspended')} title={s.admin_status === 'suspended' ? 'Activate' : 'Suspend'} style={iconBtn}><Power size={15} /></button>
                          <button onClick={() => remove(s)} title="Delete" style={{ ...iconBtn, color: RED }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 100%)', height: '100%', background: '#F5F0E8', overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,0.3)' }}>
            <div style={{ position: 'sticky', top: 0, background: '#141414', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{editing ? 'Edit Sub Admin' : 'Create Sub Admin'}</h2>
              <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 22 }}>
              {err && <div style={{ background: '#FEE2E2', color: RED, padding: '10px 14px', borderRadius: 10, fontSize: 12.5, marginBottom: 14 }}>{err}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <Field label="First name"><input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} style={inp} /></Field>
                <Field label="Last name"><input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} style={inp} /></Field>
              </div>
              <Field label="Email"><input type="email" disabled={editing} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ ...inp, opacity: editing ? 0.6 : 1 }} placeholder="manager@quranmentorglobal.com" /></Field>
              {!editing && <Field label="Temporary password (min 8 chars)"><input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inp} placeholder="Share securely; they can change it later" /></Field>}
              <Field label="Role label"><input value={form.roleLabel} onChange={e => setForm(f => ({ ...f, roleLabel: e.target.value }))} style={inp} placeholder="e.g. Support Manager" /></Field>

              <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '8px 0 8px' }}>Quick presets</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
                {ROLE_PRESETS.map(p => (
                  <button key={p.key} onClick={() => applyPreset(p)} title={p.description} style={{ border: `1px solid ${BORDER}`, background: '#fff', borderRadius: 9, padding: '7px 11px', fontSize: 12, fontWeight: 600, color: INK, cursor: 'pointer' }}>{p.label}</button>
                ))}
              </div>

              <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '0 0 10px' }}>Permissions ({form.perms.length} selected)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PERMISSION_GROUPS.map(g => {
                  const all = g.perms.every(p => form.perms.includes(p.key))
                  return (
                    <div key={g.key} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{g.label}</span>
                        <button onClick={() => setForm(f => ({ ...f, perms: all ? f.perms.filter(x => !g.perms.some(p => p.key === x)) : Array.from(new Set([...f.perms, ...g.perms.map(p => p.key)])) }))}
                          style={{ fontSize: 11, fontWeight: 700, color: GOLD, background: 'transparent', border: 'none', cursor: 'pointer' }}>{all ? 'Clear' : 'Select all'}</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {g.perms.map(p => {
                          const on = form.perms.includes(p.key)
                          return (
                            <button key={p.key} onClick={() => togglePerm(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `1px solid ${on ? GOLD : BORDER}`, background: on ? CREAM : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                              <span style={{ width: 17, height: 17, borderRadius: 5, background: on ? GOLD : '#fff', border: `1px solid ${on ? GOLD : '#CBC4B5'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <Check size={12} color="#1A1400" />}</span>
                              <span style={{ fontSize: 12, color: INK }}>{p.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setOpen(false)} style={{ flex: 1, padding: '11px', borderRadius: 11, border: `1px solid ${BORDER}`, background: '#fff', color: INK, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button onClick={save} disabled={!canSave || saving} style={{ flex: 2, padding: '11px', borderRadius: 11, border: 'none', background: (!canSave || saving) ? '#D9CFA8' : GOLD, color: '#1A1400', fontWeight: 700, cursor: (!canSave || saving) ? 'default' : 'pointer' }}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create sub-admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: '#141414', color: '#fff', padding: '11px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 70 }}>{toast}</div>}
    </AdminLayout>
  )
}

const iconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: INK }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 13, background: '#fff', color: INK, fontFamily: "'Inter',sans-serif" }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#6B6B6B', marginBottom: 5 }}>{label}</label>{children}</div>
}

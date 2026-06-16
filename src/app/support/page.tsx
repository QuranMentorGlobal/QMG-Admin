'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/AdminLayout'

interface Ticket {
  id: string
  user_id: string
  role: string
  subject: string
  category: string
  message: string
  priority: string
  status: string
  admin_reply: string | null
  created_at: string
  updated_at: string
  user_name?: string
  user_email?: string
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    urgent: { bg: 'rgba(239,68,68,0.12)',  color: '#DC2626' },
    high:   { bg: 'rgba(249,115,22,0.12)', color: '#EA580C' },
    normal: { bg: 'rgba(99,102,241,0.1)',  color: '#6366F1' },
    low:    { bg: 'rgba(0,0,0,0.06)',      color: '#666'    },
  }
  const s = map[priority] ?? map.normal
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase"
      style={{ background: s.bg, color: s.color }}>{priority}</span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    open:        { bg: 'rgba(184,149,42,0.12)', color: '#B8952A' },
    in_progress: { bg: 'rgba(99,102,241,0.1)',  color: '#6366F1' },
    resolved:    { bg: 'rgba(27,94,55,0.1)',    color: '#1B5E37' },
    closed:      { bg: 'rgba(0,0,0,0.06)',      color: '#666'    },
  }
  const s = map[status] ?? map.open
  return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase"
      style={{ background: s.bg, color: s.color }}>{status.replace('_', ' ')}</span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    student: { bg: 'rgba(27,94,55,0.1)',    color: '#1B5E37' },
    teacher: { bg: 'rgba(184,149,42,0.12)', color: '#B8952A' },
    parent:  { bg: 'rgba(99,102,241,0.1)',  color: '#6366F1' },
  }
  const s = map[role] ?? { bg: 'rgba(0,0,0,0.06)', color: '#666' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg capitalize"
      style={{ background: s.bg, color: s.color }}>{role}</span>
  )
}

export default function AdminSupportPage() {
  const supabase = createClient()
  const [tickets, setTickets]     = useState<Ticket[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Ticket | null>(null)
  const [reply, setReply]         = useState('')
  const [replyStatus, setReplyStatus] = useState('resolved')
  const [sending, setSending]     = useState(false)
  const [toast, setToast]         = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRole, setFilterRole]     = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await (supabase as any)
      .from('support_tickets')
      .select(`
        *,
        profiles!support_tickets_user_id_fkey(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })

    const enriched = (data ?? []).map((t: any) => ({
      ...t,
      user_name: t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : 'Unknown',
      user_email: t.profiles?.email ?? '',
    }))
    setTickets(enriched)
    setLoading(false)
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return
    setSending(true)

    const { error } = await (supabase as any)
      .from('support_tickets')
      .update({
        admin_reply: reply.trim(),
        status: replyStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id)

    if (!error) {
      setTickets(prev => prev.map(t =>
        t.id === selected.id
          ? { ...t, admin_reply: reply.trim(), status: replyStatus }
          : t
      ))
      setSelected(prev => prev ? { ...prev, admin_reply: reply.trim(), status: replyStatus } : null)
      setReply('')
      showToast('✅ Reply sent successfully!')
    } else {
      showToast('❌ Failed to send reply: ' + error.message)
    }
    setSending(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterRole !== 'all' && t.role !== filterRole) return false
    return true
  })

  const openCount = tickets.filter(t => t.status === 'open').length
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status === 'open').length

  return (
    <AdminLayout>
      <div className="w-full">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold"
            style={{ background: toast.startsWith('✅') ? '#1B5E37' : '#DC2626' }}>
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#0D3D20', fontFamily: "'Playfair Display', serif" }}>
            Support Tickets
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7A6B' }}>
            Manage and reply to user support requests
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total',    value: tickets.length,  color: '#0D3D20' },
            { label: 'Open',     value: openCount,        color: '#B8952A' },
            { label: 'Urgent',   value: urgentCount,      color: '#DC2626' },
            { label: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length, color: '#1B5E37' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-1 rounded-xl p-1 bg-gray-100">
            {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={filterStatus === s ? { background: '#1B5E37', color: '#fff' } : { color: '#666' }}>
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-xl p-1 bg-gray-100">
            {['all', 'student', 'teacher', 'parent'].map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={filterRole === r ? { background: '#B8952A', color: '#fff' } : { color: '#666' }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Ticket list */}
          <div className={`${selected ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                <div className="text-4xl mb-3">🎫</div>
                <p className="font-semibold text-gray-700">No tickets found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => { setSelected(ticket); setReply(ticket.admin_reply || '') }}
                    className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border transition-all hover:shadow-md"
                    style={{ borderColor: selected?.id === ticket.id ? '#1B5E37' : '#F0EDE6', borderWidth: selected?.id === ticket.id ? 1.5 : 1 }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-semibold text-sm" style={{ color: '#0D3D20' }}>{ticket.subject}</p>
                      <div className="flex gap-1 flex-shrink-0">
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <RoleBadge role={ticket.role} />
                      <span className="text-xs" style={{ color: '#9A9A8A' }}>{ticket.user_name}</span>
                      <span className="text-xs" style={{ color: '#B8B8A8' }}>·</span>
                      <span className="text-xs" style={{ color: '#9A9A8A' }}>{ticket.category}</span>
                      <span className="text-xs" style={{ color: '#B8B8A8' }}>·</span>
                      <span className="text-xs" style={{ color: '#9A9A8A' }}>
                        {new Date(ticket.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {!ticket.admin_reply && ticket.status === 'open' && (
                      <div className="mt-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>
                          Awaiting reply
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply panel */}
          {selected && (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 sticky top-4">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <RoleBadge role={selected.role} />
                      <p className="font-bold text-sm" style={{ color: '#0D3D20' }}>{selected.user_name}</p>
                    </div>
                    <p className="text-xs text-gray-500">{selected.user_email}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Subject */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold" style={{ color: '#0D3D20' }}>{selected.subject}</p>
                      <PriorityBadge priority={selected.priority} />
                    </div>
                    <p className="text-xs text-gray-400">{selected.category}</p>
                  </div>

                  {/* Original message */}
                  <div className="rounded-xl p-4" style={{ background: '#F9F7F4' }}>
                    <p className="text-xs font-semibold mb-2 text-gray-500">User message:</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#0D3D20' }}>{selected.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(selected.created_at).toLocaleString('en-GB')}
                    </p>
                  </div>

                  {/* Previous reply */}
                  {selected.admin_reply && (
                    <div className="rounded-xl p-4" style={{ background: 'rgba(27,94,55,0.06)', border: '1px solid rgba(27,94,55,0.1)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: '#1B5E37' }}>Your previous reply:</p>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: '#0D3D20' }}>{selected.admin_reply}</p>
                    </div>
                  )}

                  {/* Reply form */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-gray-500">
                      {selected.admin_reply ? 'Update reply' : 'Write reply'} *
                    </label>
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      rows={5}
                      placeholder="Type your reply to the user..."
                      className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                      style={{ borderColor: '#E0DDD5', fontFamily: "'DM Sans', sans-serif" }}
                      onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = '#1B5E37' }}
                      onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = '#E0DDD5' }}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-gray-500">
                      Update status
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                        <button key={s} onClick={() => setReplyStatus(s)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all"
                          style={replyStatus === s
                            ? { background: '#1B5E37', color: '#fff', borderColor: '#1B5E37' }
                            : { background: '#fff', color: '#666', borderColor: '#E0DDD5' }}>
                          {s.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                    style={{ background: '#1B5E37' }}
                    onMouseEnter={e => { if (!sending) (e.currentTarget as HTMLElement).style.background = '#0D3D20' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1B5E37' }}
                  >
                    {sending ? 'Sending…' : selected.admin_reply ? '✓ Update Reply' : '✓ Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

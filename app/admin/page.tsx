'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'

type Status = 'pending' | 'approved' | 'rejected'

interface AdminUser {
  id: string
  name: string | null
  email: string
  image: string | null
  createdAt: string
  status: Status
  approvedAt: string | null
  approvedBy: string | null
  _count: { conversations: number }
}

export default function AdminPage() {
  const { data: session, status: authStatus } = useSession()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetch('/api/admin/users')
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 403) throw new Error('You are not an admin.')
          throw new Error((await r.json()).error ?? 'Failed to load')
        }
        return r.json()
      })
      .then((d) => setUsers(d.users))
      .catch((e: Error) => setError(e.message))
  }

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.isAdmin) load()
  }, [authStatus, session?.user?.isAdmin])

  const act = async (id: string, action: 'approve' | 'reject') => {
    setPendingId(id)
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Update failed')
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  // ---- Auth states ----
  if (authStatus === 'loading') {
    return <Shell><div className="text-white/40 text-sm">Loading…</div></Shell>
  }

  if (authStatus === 'unauthenticated') {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <h1 className="text-white text-xl font-semibold">Admin</h1>
          <p className="text-white/50 text-sm">Sign in to manage user access.</p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/admin' })}
            className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-white/80 text-sm hover:bg-white/10 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </Shell>
    )
  }

  if (!session?.user?.isAdmin) {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto">
            <span className="text-red-300 text-lg">✕</span>
          </div>
          <h2 className="text-white/80 font-medium text-sm">Not an admin</h2>
          <p className="text-white/45 text-xs">You are signed in as {session?.user?.email} — that account is not in ADMIN_EMAILS.</p>
          <button onClick={() => signOut({ callbackUrl: '/' })} className="text-[11px] text-white/35 hover:text-white/65">Sign out</button>
        </div>
      </Shell>
    )
  }

  // ---- Admin view ----
  const pending = users?.filter((u) => u.status === 'pending') ?? []
  const others  = users?.filter((u) => u.status !== 'pending') ?? []

  return (
    <Shell wide>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-semibold tracking-tight">User access</h1>
          <p className="text-white/40 text-sm mt-1">Approve or reject sign-in requests for the voice demo.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/30">Signed in as {session.user.email}</span>
          <button onClick={() => signOut({ callbackUrl: '/' })} className="text-[11px] text-white/35 hover:text-white/65">Sign out</button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-xs">{error}</div>
      )}

      {!users && <div className="text-white/40 text-sm">Loading users…</div>}

      {users && (
        <div className="space-y-8">
          <Section
            title={`Pending (${pending.length})`}
            empty="No pending requests."
            users={pending}
            pendingId={pendingId}
            onAction={act}
            showActions
          />
          <Section
            title={`Approved & rejected (${others.length})`}
            empty="No history yet."
            users={others}
            pendingId={pendingId}
            onAction={act}
            showActions={false}
          />
        </div>
      )}
    </Shell>
  )
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-[#07070f] flex items-start justify-center px-6 py-12">
      <div className={wide ? 'w-full max-w-3xl' : 'w-full max-w-sm'}>{children}</div>
    </div>
  )
}

function Section({
  title, empty, users, pendingId, onAction, showActions,
}: {
  title: string
  empty: string
  users: AdminUser[]
  pendingId: string | null
  onAction: (id: string, action: 'approve' | 'reject') => void
  showActions: boolean
}) {
  return (
    <div>
      <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/35 mb-3">{title}</h2>
      {users.length === 0 ? (
        <p className="text-white/30 text-xs italic">{empty}</p>
      ) : (
        <ul className="divide-y divide-white/8 border border-white/8 rounded-2xl overflow-hidden">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-4 px-4 py-3 bg-white/[0.02]">
              {u.image
                ? <img src={u.image} alt="" className="w-9 h-9 rounded-full" />
                : <div className="w-9 h-9 rounded-full bg-white/10" />}
              <div className="flex-1 min-w-0">
                <div className="text-white/85 text-sm truncate">{u.name ?? u.email}</div>
                <div className="text-white/35 text-[11px] truncate">{u.email}</div>
                <div className="text-white/25 text-[11px] mt-0.5">
                  joined {new Date(u.createdAt).toLocaleDateString()} · {u._count.conversations} sessions
                  {u.approvedBy && ` · ${u.status} by ${u.approvedBy}`}
                </div>
              </div>
              <StatusBadge status={u.status} />
              {showActions && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAction(u.id, 'approve')}
                    disabled={pendingId === u.id}
                    className="text-xs px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onAction(u.id, 'reject')}
                    disabled={pendingId === u.id}
                    className="text-xs px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 disabled:opacity-40 transition"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    pending:  'border-amber-500/30 bg-amber-500/10 text-amber-300',
    approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    rejected: 'border-red-500/30 bg-red-500/10 text-red-300',
  }
  return (
    <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full border ${map[status]}`}>
      {status}
    </span>
  )
}

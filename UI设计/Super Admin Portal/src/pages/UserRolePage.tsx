import { useState } from 'react'
import { Plus, Eye, Trash2, Key, LogOut, Search, Shield } from 'lucide-react'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'
import Dialog from '../components/Dialog'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

interface AdminUser {
  id: string; name: string; email: string; role: string; status: 'active' | 'inactive'; lastLogin: string; created: string; sessions: number
}

const users: AdminUser[] = [
  { id: 'USR-001', name: 'Zhang Min', email: 'zhangmin@mtrip.com', role: 'Super Admin', status: 'active', lastLogin: '2024-12-15 09:22', created: '2019-01-10', sessions: 1 },
  { id: 'USR-002', name: 'Li Hao', email: 'lihao@mtrip.com', role: 'Verification Admin', status: 'active', lastLogin: '2024-12-15 08:45', created: '2020-03-22', sessions: 1 },
  { id: 'USR-003', name: 'Wang Fei', email: 'wangfei@mtrip.com', role: 'Finance Admin', status: 'active', lastLogin: '2024-12-14 16:30', created: '2021-06-15', sessions: 2 },
  { id: 'USR-004', name: 'Chen Jing', email: 'chenjing@mtrip.com', role: 'Support Admin', status: 'active', lastLogin: '2024-12-15 11:10', created: '2022-01-08', sessions: 1 },
  { id: 'USR-005', name: 'Liu Wei', email: 'liuwei@mtrip.com', role: 'Campaign Admin', status: 'active', lastLogin: '2024-12-13 14:20', created: '2022-08-20', sessions: 0 },
  { id: 'USR-006', name: 'Zhao Ting', email: 'zhaoting@mtrip.com', role: 'Read Only', status: 'inactive', lastLogin: '2024-11-10 10:00', created: '2023-03-01', sessions: 0 },
  { id: 'USR-007', name: 'Sun Kai', email: 'sunkai@mtrip.com', role: 'Support Admin', status: 'active', lastLogin: '2024-12-15 07:30', created: '2023-07-15', sessions: 1 },
]

const roles = [
  { name: 'Super Admin', users: 1, color: '#DC2626', permissions: ['view', 'create', 'edit', 'delete', 'approve', 'export', 'reports'] },
  { name: 'Verification Admin', users: 1, color: '#D97706', permissions: ['view', 'approve', 'edit'] },
  { name: 'Finance Admin', users: 1, color: '#7C3AED', permissions: ['view', 'approve', 'export', 'reports'] },
  { name: 'Campaign Admin', users: 1, color: '#059669', permissions: ['view', 'create', 'edit', 'delete'] },
  { name: 'Support Admin', users: 2, color: '#2563EB', permissions: ['view', 'edit'] },
  { name: 'Read Only', users: 1, color: '#94A3B8', permissions: ['view', 'reports'] },
]

const allPerms = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'reports']
const modules = ['Dashboard', 'Merchant Verification', 'Merchant Management', 'Booking Administration', 'Campaigns', 'Affiliates', 'Finance', 'Reports']

export default function UserRolePage({ tab, showToast }: Props) {
  const [search, setSearch] = useState('')
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [forceLogoutTarget, setForceLogoutTarget] = useState<AdminUser | null>(null)
  const [resetPwTarget, setResetPwTarget] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(false)

  const filtered = users.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search))

  const isPermTab = tab === 'users-roles-permissions' || tab === 'users-roles-list'

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>User & Role Management</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Manage admin users, roles, and access permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreateRoleOpen(true)} className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
            <Shield size={13} /> Create Role
          </button>
          <button onClick={() => setCreateUserOpen(true)} className="flex items-center gap-1.5 rounded-md px-3 text-white" style={{ height: 34, fontSize: 13, background: '#1664FF', fontWeight: 500 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0E4FCC')} onMouseLeave={(e) => (e.currentTarget.style.background = '#1664FF')}>
            <Plus size={13} /> Create User
          </button>
        </div>
      </div>

      {!isPermTab ? (
        <>
          {/* Search */}
          <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <Search size={13} color="#94A3B8" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users by name or email..." className="flex-1 outline-none bg-transparent" style={{ fontSize: 13 }} />
          </div>

          {/* Users Table */}
          <div className="rounded-lg overflow-hidden mb-5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #E3E8F0' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Admin Users</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                  {['User', 'Role', 'Status', 'Active Sessions', 'Last Login', 'Created', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4" style={{ height: 48 }}>
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ width: 30, height: 30, background: '#1664FF', fontSize: 11 }}>
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4">
                      <span className="rounded px-1.5 font-medium" style={{ fontSize: 11, background: u.role === 'Super Admin' ? '#FFF1F3' : '#EEF4FF', color: u.role === 'Super Admin' ? '#BE123C' : '#1664FF', height: 20, display: 'inline-flex', alignItems: 'center' }}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4">
                      <span className="rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: u.status === 'active' ? '#ECFDF3' : '#F1F5F9', color: u.status === 'active' ? '#027A48' : '#475569', height: 20, display: 'inline-flex', alignItems: 'center' }}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4">
                      <span className="rounded px-1.5 font-mono font-medium" style={{ fontSize: 12, background: u.sessions > 0 ? '#ECFDF3' : '#F8FAFC', color: u.sessions > 0 ? '#027A48' : '#94A3B8', height: 20, display: 'inline-flex', alignItems: 'center' }}>
                        {u.sessions} active
                      </span>
                    </td>
                    <td className="px-4" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{u.lastLogin}</td>
                    <td className="px-4" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{u.created}</td>
                    <td className="px-4">
                      <div className="flex items-center gap-1">
                        <ActionBtn onClick={() => showToast('info', 'View User', u.name)} color="#1664FF"><Eye size={12} /></ActionBtn>
                        <ActionBtn onClick={() => setResetPwTarget(u)} color="#D97706"><Key size={12} /></ActionBtn>
                        {u.sessions > 0 && <ActionBtn onClick={() => setForceLogoutTarget(u)} color="#DC2626"><LogOut size={12} /></ActionBtn>}
                        {u.role !== 'Super Admin' && <ActionBtn onClick={() => showToast('warning', 'User Deleted', u.name)} color="#DC2626"><Trash2 size={12} /></ActionBtn>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Roles Grid */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 12 }}>Roles</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {roles.map((r) => (
                <div key={r.name} className="rounded-lg p-4 cursor-pointer transition-all" style={{ background: '#fff', border: '1px solid #E3E8F0' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1664FF')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E3E8F0')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md flex items-center justify-center" style={{ width: 28, height: 28, background: r.color + '15' }}>
                        <Shield size={14} color={r.color} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{r.name}</div>
                    </div>
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>{r.users} user{r.users !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.map(p => (
                      <span key={p} className="rounded px-1.5 capitalize" style={{ fontSize: 10, background: '#F1F5F9', color: '#475569', height: 18, display: 'inline-flex', alignItems: 'center' }}>{p}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Permission Matrix */
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>Permission Matrix</h3>
          <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Define granular access rights per module for each role</p>
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                  <th className="text-left px-4 py-3" style={{ fontSize: 12, fontWeight: 600, color: '#64748B', minWidth: 160 }}>Module / Permission</th>
                  {roles.map(r => (
                    <th key={r.name} className="px-3 py-3" style={{ fontSize: 11, fontWeight: 600, color: r.color, textAlign: 'center', whiteSpace: 'nowrap' }}>{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod, mi) => (
                  allPerms.map((perm, pi) => (
                    <tr key={`${mod}-${perm}`} style={{ borderBottom: '1px solid #F8FAFC', background: pi === 0 && mi > 0 ? '#FAFBFC' : 'transparent' }}>
                      <td className="px-4 py-2" style={{ fontSize: pi === 0 ? 12 : 11, fontWeight: pi === 0 ? 600 : 400, color: pi === 0 ? '#1A2332' : '#64748B', paddingLeft: pi === 0 ? 16 : 32 }}>
                        {pi === 0 ? mod : `↳ ${perm}`}
                      </td>
                      {roles.map(r => (
                        <td key={r.name} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            defaultChecked={r.permissions.includes(perm)}
                            className="rounded cursor-pointer"
                            style={{ accentColor: r.color, width: 14, height: 14 }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={() => showToast('success', 'Permissions Saved', 'Permission matrix has been updated.')} className="rounded-md px-4 text-white font-medium" style={{ height: 36, fontSize: 13, background: '#1664FF' }}>
              Save Permissions
            </button>
          </div>
        </div>
      )}

      <Dialog open={createUserOpen} onClose={() => setCreateUserOpen(false)} variant="confirm" title="Create Admin User"
        confirmLabel="Create User"
        onConfirm={() => { setLoading(true); setTimeout(() => { setLoading(false); setCreateUserOpen(false); showToast('success', 'User Created', 'New admin user has been created.') }, 800) }} loading={loading}>
        <div className="space-y-3 mt-3">
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input placeholder="Full name" className="rounded-md px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E3E8F0' }} />
            <input placeholder="Email address" className="rounded-md px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E3E8F0' }} />
          </div>
          <select className="w-full rounded-md px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E3E8F0' }}>
            {roles.map(r => <option key={r.name}>{r.name}</option>)}
          </select>
        </div>
      </Dialog>

      <Dialog open={createRoleOpen} onClose={() => setCreateRoleOpen(false)} variant="confirm" title="Create Role"
        confirmLabel="Create Role"
        onConfirm={() => { setLoading(true); setTimeout(() => { setLoading(false); setCreateRoleOpen(false); showToast('success', 'Role Created', 'New role added.') }, 600) }} loading={loading}>
        <div className="space-y-3 mt-3">
          <input placeholder="Role name" className="w-full rounded-md px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E3E8F0' }} />
        </div>
      </Dialog>

      <Dialog open={!!forceLogoutTarget} onClose={() => setForceLogoutTarget(null)} variant="danger" title="Force Logout User"
        message={`Terminate all active sessions for "${forceLogoutTarget?.name}"? They will need to log in again.`}
        confirmLabel="Force Logout"
        onConfirm={() => { setLoading(true); setTimeout(() => { setLoading(false); setForceLogoutTarget(null); showToast('warning', 'User Logged Out', `${forceLogoutTarget?.name}'s sessions terminated.`) }, 600) }} loading={loading} />

      <Dialog open={!!resetPwTarget} onClose={() => setResetPwTarget(null)} variant="warning" title="Reset Password"
        message={`Send a password reset email to "${resetPwTarget?.email}"?`}
        confirmLabel="Send Reset Email"
        onConfirm={() => { setLoading(true); setTimeout(() => { setLoading(false); setResetPwTarget(null); showToast('success', 'Reset Email Sent', `Password reset sent to ${resetPwTarget?.email}`) }, 600) }} loading={loading} />
    </div>
  )
}

function ActionBtn({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center rounded transition-colors" style={{ width: 28, height: 28, color: '#94A3B8' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = color + '15'; e.currentTarget.style.color = color }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}>
      {children}
    </button>
  )
}

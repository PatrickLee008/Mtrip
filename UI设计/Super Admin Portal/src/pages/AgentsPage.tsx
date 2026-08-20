import { useState } from 'react'
import { Search, Plus, Download, Eye, Edit2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'

interface Agent {
  id: string
  name: string
  company: string
  type: 'ota' | 'corporate' | 'wholesale' | 'affiliate' | 'direct'
  email: string
  phone: string
  city: string
  bookings: number
  revenue: string
  commission: string
  rating: number
  status: 'active' | 'suspended' | 'pending'
  since: string
  lastActive: string
  change: string
  up: boolean
}

const agents: Agent[] = [
  { id: 'AGT-0014', name: 'Ctrip Auto-API', company: 'Trip.com Group', type: 'ota', email: 'api@ctrip.com', phone: '+86 21-3406-4880', city: 'Shanghai', bookings: 5974, revenue: '¥14.2M', commission: '¥1.42M', rating: 4.9, status: 'active', since: '2018-01', lastActive: '2024-12-15', change: '+11.2%', up: true },
  { id: 'AGT-0021', name: 'Meituan Hotel API', company: 'Meituan Inc.', type: 'ota', email: 'hotel-api@meituan.com', phone: '+86 10-5892-2022', city: 'Beijing', bookings: 4730, revenue: '¥11.6M', commission: '¥1.16M', rating: 4.8, status: 'active', since: '2019-03', lastActive: '2024-12-15', change: '+8.4%', up: true },
  { id: 'AGT-0038', name: 'Fliggy Travel API', company: 'Alibaba Group', type: 'ota', email: 'fliggy-b2b@alibaba.com', phone: '+86 571-8502-2088', city: 'Hangzhou', bookings: 2240, revenue: '¥5.8M', commission: '¥580K', rating: 4.7, status: 'active', since: '2020-06', lastActive: '2024-12-14', change: '+4.1%', up: true },
  { id: 'AGT-0052', name: 'CITIC Group Travel', company: 'CITIC Holdings', type: 'corporate', email: 'travel@citic.com', phone: '+86 10-6600-1688', city: 'Beijing', bookings: 1842, revenue: '¥8.9M', commission: '¥267K', rating: 4.9, status: 'active', since: '2019-11', lastActive: '2024-12-15', change: '+16.2%', up: true },
  { id: 'AGT-0067', name: 'China Eastern Corporate', company: 'China Eastern Airlines', type: 'corporate', email: 'corp@ceair.com', phone: '+86 21-5506-2099', city: 'Shanghai', bookings: 1204, revenue: '¥6.3M', commission: '¥189K', rating: 4.8, status: 'active', since: '2020-09', lastActive: '2024-12-13', change: '+9.8%', up: true },
  { id: 'AGT-0083', name: 'Qunar.com API', company: 'Qunar Inc.', type: 'ota', email: 'api@qunar.com', phone: '+86 10-5080-1800', city: 'Beijing', bookings: 980, revenue: '¥2.4M', commission: '¥240K', rating: 4.5, status: 'active', since: '2021-04', lastActive: '2024-12-12', change: '-2.3%', up: false },
  { id: 'AGT-0094', name: 'Tencent Travel', company: 'Tencent Holdings', type: 'affiliate', email: 'travel@tencent.com', phone: '+86 755-8601-3388', city: 'Shenzhen', bookings: 748, revenue: '¥1.9M', commission: '¥190K', rating: 4.6, status: 'active', since: '2022-01', lastActive: '2024-12-11', change: '+28.4%', up: true },
  { id: 'AGT-0108', name: 'Pingan Good Car Owner', company: 'Ping An Group', type: 'corporate', email: 'travel@pingan.com', phone: '+86 755-2262-3290', city: 'Shenzhen', bookings: 612, revenue: '¥3.1M', commission: '¥93K', rating: 4.7, status: 'active', since: '2021-08', lastActive: '2024-12-10', change: '+6.7%', up: true },
  { id: 'AGT-0122', name: 'Grand Horizon Travel', company: 'Grand Horizon Ltd.', type: 'wholesale', email: 'ops@grandhorizon.cn', phone: '+86 20-8622-1430', city: 'Guangzhou', bookings: 428, revenue: '¥1.1M', commission: '¥110K', rating: 4.3, status: 'pending', since: '2023-06', lastActive: '2024-12-08', change: '+3.1%', up: true },
  { id: 'AGT-0139', name: 'Silk Road Tours API', company: 'Silk Road Int\'l', type: 'wholesale', email: 'api@silkroadtours.com', phone: '+86 10-8441-2680', city: 'Beijing', bookings: 214, revenue: '¥540K', commission: '¥54K', rating: 4.2, status: 'active', since: '2022-11', lastActive: '2024-12-07', change: '-4.8%', up: false },
  { id: 'AGT-0151', name: 'UniWell Travel', company: 'UniWell Group', type: 'affiliate', email: 'partner@uniwell.cn', phone: '+86 571-8822-1104', city: 'Hangzhou', bookings: 96, revenue: '¥224K', commission: '¥22.4K', rating: 4.0, status: 'suspended', since: '2023-03', lastActive: '2024-11-22', change: '-18.2%', up: false },
]

const typeCfg: Record<string, { bg: string; color: string; label: string }> = {
  ota: { bg: '#EFF6FF', color: '#1D4ED8', label: 'OTA' },
  corporate: { bg: '#F0FDF4', color: '#15803D', label: 'Corporate' },
  wholesale: { bg: '#FDF4FF', color: '#7C3AED', label: 'Wholesale' },
  affiliate: { bg: '#FFF7ED', color: '#C2410C', label: 'Affiliate' },
  direct: { bg: '#F8FAFC', color: '#475569', label: 'Direct' },
}

const statCfg: Record<string, { bg: string; color: string }> = {
  active: { bg: '#ECFDF3', color: '#027A48' },
  pending: { bg: '#FFFAEB', color: '#B54708' },
  suspended: { bg: '#FFF1F3', color: '#C01048' },
}

export default function AgentsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10

  const filtered = agents.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.company.toLowerCase().includes(search.toLowerCase())
  )
  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Travel Agents</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{total} registered partners · OTA, corporate, wholesale &amp; affiliate channels</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <Download size={13} /> Export
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md px-3 text-white"
            style={{ height: 34, fontSize: 13, background: '#1664FF', fontWeight: 500 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0E4FCC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1664FF')}
          >
            <Plus size={13} /> Add Agent
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total Agents', value: '847', sub: 'Active partners' },
          { label: 'OTA Channels', value: '12', sub: '68% of volume' },
          { label: 'Corporate Clients', value: '234', sub: '23% of volume' },
          { label: 'Avg Commission Rate', value: '9.8%', sub: 'Across all channels' },
        ].map((c) => (
          <div key={c.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{c.value}</div>
            <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search agent name or company..."
          className="flex-1 outline-none bg-transparent"
          style={{ fontSize: 13, color: '#1A2332' }}
        />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} results</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Agent', 'Type', 'City', 'Bookings MTD', 'Revenue MTD', 'Commission', 'Rating', 'Change', 'Status', 'Last Active', ''].map((h) => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => {
              const tc = typeCfg[a.type]
              const sc = statCfg[a.status]
              return (
                <tr
                  key={a.id}
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-3" style={{ height: 48 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{a.company}</div>
                  </td>
                  <td className="px-3">
                    <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: tc.bg, color: tc.color, height: 20 }}>{tc.label}</span>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#475569' }}>{a.city}</td>
                  <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace', fontWeight: 500 }}>{a.bookings.toLocaleString()}</td>
                  <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace' }}>{a.revenue}</td>
                  <td className="px-3" style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>{a.commission}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <div className="rounded-full" style={{ width: 7, height: 7, background: a.rating >= 4.7 ? '#10B981' : a.rating >= 4.3 ? '#F59E0B' : '#EF4444' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A2332' }}>{a.rating}</span>
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      {a.up ? <TrendingUp size={11} color="#027A48" /> : <TrendingDown size={11} color="#C01048" />}
                      <span style={{ fontSize: 12, color: a.up ? '#027A48' : '#C01048', fontWeight: 500 }}>{a.change}</span>
                    </div>
                  </td>
                  <td className="px-3">
                    <span className="inline-flex items-center rounded px-1.5 capitalize font-medium" style={{ fontSize: 11, background: sc.bg, color: sc.color, height: 20 }}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{a.lastActive}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-0.5">
                      <ActionBtn><Eye size={12} /></ActionBtn>
                      <ActionBtn><Edit2 size={12} /></ActionBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Showing {start + 1}–{Math.min(start + perPage, total)} of {total} agents
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>{i + 1}</PagBtn>
            ))}
            <PagBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="flex items-center justify-center rounded"
      style={{ width: 26, height: 26, color: '#94A3B8' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
    >
      {children}
    </button>
  )
}

function PagBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center rounded"
      style={{
        minWidth: 28, height: 28, fontSize: 12,
        background: active ? '#1664FF' : 'transparent',
        color: active ? '#fff' : disabled ? '#CBD5E1' : '#475569',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = '#F1F5F9' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

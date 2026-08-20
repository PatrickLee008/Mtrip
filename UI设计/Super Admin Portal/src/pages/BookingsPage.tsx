import { useState } from 'react'
import { Search, Download, Calendar, ChevronLeft, ChevronRight, Eye, MessageSquare } from 'lucide-react'

interface Booking {
  id: string
  hotel: string
  city: string
  guest: string
  phone: string
  checkin: string
  checkout: string
  nights: number
  rooms: number
  type: string
  amount: string
  paid: string
  status: 'confirmed' | 'pending' | 'cancelled' | 'no-show' | 'checked-in' | 'completed'
  channel: string
  agent: string
  created: string
}

const bookings: Booking[] = [
  { id: 'BK-2024-84721', hotel: 'Grand Hyatt Shanghai', city: 'Shanghai', guest: 'Zhang Wei', phone: '+86 138****4521', checkin: '2024-12-20', checkout: '2024-12-22', nights: 2, rooms: 1, type: 'Deluxe King', amount: '¥3,840', paid: '¥3,840', status: 'confirmed', channel: 'Ctrip', agent: 'Ctrip Auto', created: '2024-12-15 14:22' },
  { id: 'BK-2024-84720', hotel: 'Marriott Beijing CBD', city: 'Beijing', guest: 'Li Mei', phone: '+86 135****8842', checkin: '2024-12-21', checkout: '2024-12-24', nights: 3, rooms: 1, type: 'Premier Suite', amount: '¥5,220', paid: '¥0', status: 'pending', channel: 'Direct', agent: 'Web Booking', created: '2024-12-15 13:08' },
  { id: 'BK-2024-84719', hotel: 'InterContinental Guangzhou', city: 'Guangzhou', guest: 'Wang Fang', phone: '+86 139****6631', checkin: '2024-12-19', checkout: '2024-12-20', nights: 1, rooms: 1, type: 'Standard Twin', amount: '¥1,680', paid: '¥1,680', status: 'confirmed', channel: 'Meituan', agent: 'Meituan Auto', created: '2024-12-14 09:45' },
  { id: 'BK-2024-84718', hotel: 'The Peninsula Beijing', city: 'Beijing', guest: 'Chen Jian', phone: '+86 186****2290', checkin: '2024-12-22', checkout: '2024-12-25', nights: 3, rooms: 2, type: 'Panoramic Suite', amount: '¥12,600', paid: '¥12,600', status: 'confirmed', channel: 'Corporate', agent: 'CITIC Group', created: '2024-12-14 16:33' },
  { id: 'BK-2024-84717', hotel: 'Shangri-La Shenzhen', city: 'Shenzhen', guest: 'Liu Yang', phone: '+86 177****9081', checkin: '2024-12-18', checkout: '2024-12-19', nights: 1, rooms: 1, type: 'Horizon Club', amount: '¥2,100', paid: '¥2,100', status: 'cancelled', channel: 'Fliggy', agent: 'Fliggy Auto', created: '2024-12-12 21:14' },
  { id: 'BK-2024-84716', hotel: 'W Hotel Chengdu', city: 'Chengdu', guest: 'Zhao Xin', phone: '+86 182****3317', checkin: '2024-12-23', checkout: '2024-12-26', nights: 3, rooms: 1, type: 'Wonderful Room', amount: '¥6,900', paid: '¥6,900', status: 'confirmed', channel: 'Direct', agent: 'Web Booking', created: '2024-12-13 11:50' },
  { id: 'BK-2024-84715', hotel: 'Fairmont Hangzhou', city: 'Hangzhou', guest: 'Wu Lei', phone: '+86 151****4409', checkin: '2024-12-20', checkout: '2024-12-21', nights: 1, rooms: 1, type: 'Deluxe Lake View', amount: '¥1,920', paid: '¥0', status: 'pending', channel: 'Ctrip', agent: 'Ctrip Auto', created: '2024-12-13 08:30' },
  { id: 'BK-2024-84714', hotel: 'Hilton Chengdu', city: 'Chengdu', guest: 'Sun Li', phone: '+86 158****7726', checkin: '2024-12-17', checkout: '2024-12-19', nights: 2, rooms: 2, type: 'Executive Room', amount: '¥4,320', paid: '¥4,320', status: 'completed', channel: 'Direct', agent: 'Web Booking', created: '2024-12-10 15:18' },
  { id: 'BK-2024-84713', hotel: 'Sofitel Guangzhou', city: 'Guangzhou', guest: 'Huang Tao', phone: '+86 136****8853', checkin: '2024-12-16', checkout: '2024-12-17', nights: 1, rooms: 1, type: 'Superior Room', amount: '¥1,440', paid: '¥1,440', status: 'completed', channel: 'Meituan', agent: 'Meituan Auto', created: '2024-12-09 19:42' },
  { id: 'BK-2024-84712', hotel: 'Novotel Nanjing East', city: 'Nanjing', guest: 'Zhou Qian', phone: '+86 133****2205', checkin: '2024-12-15', checkout: '2024-12-16', nights: 1, rooms: 1, type: 'Standard King', amount: '¥880', paid: '¥880', status: 'no-show', channel: 'Fliggy', agent: 'Fliggy Auto', created: '2024-12-08 12:07' },
  { id: 'BK-2024-84711', hotel: 'Wyndham Qingdao', city: 'Qingdao', guest: 'Xu Ming', phone: '+86 188****6640', checkin: '2024-12-20', checkout: '2024-12-22', nights: 2, rooms: 1, type: 'Sea View Room', amount: '¥1,580', paid: '¥1,580', status: 'checked-in', channel: 'Ctrip', agent: 'Ctrip Auto', created: '2024-12-11 10:25' },
  { id: 'BK-2024-84710', hotel: 'Radisson Blu Wuhan', city: 'Wuhan', guest: 'Ma Jing', phone: '+86 139****1134', checkin: '2024-12-22', checkout: '2024-12-24', nights: 2, rooms: 1, type: 'Superior Twin', amount: '¥1,760', paid: '¥880', status: 'pending', channel: 'Direct', agent: 'Web Booking', created: '2024-12-12 07:55' },
]

const statuses = ['all', 'confirmed', 'pending', 'checked-in', 'completed', 'cancelled', 'no-show']
const statusLabels: Record<string, string> = {
  all: 'All',
  confirmed: 'Confirmed',
  pending: 'Pending',
  'checked-in': 'Checked In',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
}
const statusCounts: Record<string, number> = {
  all: 24891, confirmed: 18420, pending: 3240, 'checked-in': 1844, completed: 892, cancelled: 412, 'no-show': 83,
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    confirmed: { bg: '#ECFDF3', color: '#027A48' },
    pending: { bg: '#FFFAEB', color: '#B54708' },
    cancelled: { bg: '#FFF1F3', color: '#C01048' },
    'no-show': { bg: '#F1F5F9', color: '#475569' },
    'checked-in': { bg: '#EFF6FF', color: '#1D4ED8' },
    completed: { bg: '#F8FAFC', color: '#334155' },
  }
  const c = cfg[status] || cfg.pending
  return (
    <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>
      {statusLabels[status] || status}
    </span>
  )
}

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10

  const filtered = bookings.filter((b) => {
    const matchTab = activeTab === 'all' || b.status === activeTab
    const matchSearch = !search || b.id.includes(search) || b.guest.toLowerCase().includes(search.toLowerCase()) || b.hotel.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })
  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Booking Management</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>All reservations across the mTrip network</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <Calendar size={13} /> Date Range
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-0 mb-4 rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => { setActiveTab(s); setPage(1) }}
            className="flex items-center gap-1.5 px-4 py-2.5 transition-colors relative"
            style={{
              fontSize: 13,
              fontWeight: activeTab === s ? 600 : 400,
              color: activeTab === s ? '#1664FF' : '#64748B',
              background: 'transparent',
              borderBottom: activeTab === s ? '2px solid #1664FF' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {statusLabels[s]}
            <span
              className="rounded-full px-1.5 font-mono"
              style={{
                fontSize: 11,
                background: activeTab === s ? '#EEF4FF' : '#F1F5F9',
                color: activeTab === s ? '#1664FF' : '#94A3B8',
                height: 18,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {s === 'all' ? '24.9k' : statusCounts[s].toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search booking ID, guest name, hotel..."
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
              {['Booking ID', 'Hotel', 'Guest', 'Check-in', 'Check-out', 'Nights', 'Room Type', 'Amount', 'Paid', 'Status', 'Channel', 'Created', ''].map((h) => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr
                key={b.id}
                style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="px-3" style={{ height: 44 }}>
                  <span style={{ fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 500 }}>{b.id}</span>
                </td>
                <td className="px-3">
                  <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }} className="max-w-[140px] truncate">{b.hotel}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.city}</div>
                </td>
                <td className="px-3">
                  <div style={{ fontSize: 12, color: '#1A2332' }}>{b.guest}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{b.phone}</div>
                </td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{b.checkin}</td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{b.checkout}</td>
                <td className="px-3 text-center" style={{ fontSize: 12, color: '#475569' }}>{b.nights}</td>
                <td className="px-3 max-w-[110px]" style={{ fontSize: 12, color: '#475569' }}>
                  <span className="truncate block max-w-[110px]">{b.type}</span>
                </td>
                <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{b.amount}</td>
                <td className="px-3" style={{ fontSize: 12, color: b.paid === b.amount ? '#027A48' : b.paid === '¥0' ? '#C01048' : '#B54708', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {b.paid}
                </td>
                <td className="px-3"><StatusBadge status={b.status} /></td>
                <td className="px-3" style={{ fontSize: 12, color: '#64748B' }}>{b.channel}</td>
                <td className="px-3" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{b.created}</td>
                <td className="px-3">
                  <div className="flex items-center gap-0.5">
                    <ActionBtn><Eye size={12} /></ActionBtn>
                    <ActionBtn><MessageSquare size={12} /></ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Showing {Math.min(start + 1, total)}–{Math.min(start + perPage, total)} of {total} bookings
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
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
      className="flex items-center justify-center rounded transition-colors"
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

import { useState } from 'react'
import { TrendingUp, TrendingDown, Download, Search, ChevronLeft, ChevronRight, Eye, FileText } from 'lucide-react'

const summaryCards = [
  { label: 'Total Revenue (MTD)', value: '¥48,312,400', change: '+12.4%', up: true, sub: 'December 2024' },
  { label: 'Pending Settlement', value: '¥6,284,800', change: '142 items', up: null, sub: 'Awaiting processing' },
  { label: 'Settled This Month', value: '¥41,248,200', change: '+8.7%', up: true, sub: 'Transferred to partners' },
  { label: 'Refunds Issued', value: '¥892,300', change: '-3.2%', up: true, sub: 'Lower than last month' },
  { label: 'Platform Commission', value: '¥4,831,240', change: '10.0% rate', up: null, sub: 'Net commission MTD' },
  { label: 'Disputed Amounts', value: '¥124,600', change: '18 disputes', up: null, sub: 'Under resolution' },
]

interface Settlement {
  id: string
  hotel: string
  city: string
  period: string
  bookings: number
  gross: string
  commission: string
  refunds: string
  net: string
  status: 'settled' | 'pending' | 'processing' | 'disputed'
  dueDate: string
  method: string
}

const settlements: Settlement[] = [
  { id: 'SET-2024-1247', hotel: 'The Peninsula Beijing', city: 'Beijing', period: 'Dec 1–15', bookings: 148, gross: '¥1,420,800', commission: '¥142,080', refunds: '¥0', net: '¥1,278,720', status: 'settled', dueDate: '2024-12-20', method: 'Bank Transfer' },
  { id: 'SET-2024-1246', hotel: 'Grand Hyatt Shanghai', city: 'Shanghai', period: 'Dec 1–15', bookings: 203, gross: '¥1,204,200', commission: '¥120,420', refunds: '¥18,600', net: '¥1,065,180', status: 'settled', dueDate: '2024-12-20', method: 'Bank Transfer' },
  { id: 'SET-2024-1245', hotel: 'Marriott Shenzhen', city: 'Shenzhen', period: 'Dec 1–15', bookings: 167, gross: '¥948,500', commission: '¥94,850', refunds: '¥9,200', net: '¥844,450', status: 'processing', dueDate: '2024-12-22', method: 'Bank Transfer' },
  { id: 'SET-2024-1244', hotel: 'Hilton Chengdu', city: 'Chengdu', period: 'Dec 1–15', bookings: 312, gross: '¥654,800', commission: '¥65,480', refunds: '¥0', net: '¥589,320', status: 'pending', dueDate: '2024-12-25', method: 'Alipay B2B' },
  { id: 'SET-2024-1243', hotel: 'Sofitel Guangzhou', city: 'Guangzhou', period: 'Dec 1–15', bookings: 189, gross: '¥742,600', commission: '¥74,260', refunds: '¥24,800', net: '¥643,540', status: 'pending', dueDate: '2024-12-25', method: 'Bank Transfer' },
  { id: 'SET-2024-1242', hotel: 'W Hotel Chengdu', city: 'Chengdu', period: 'Dec 1–15', bookings: 94, gross: '¥548,400', commission: '¥54,840', refunds: '¥0', net: '¥493,560', status: 'settled', dueDate: '2024-12-18', method: 'Bank Transfer' },
  { id: 'SET-2024-1241', hotel: 'Fairmont Hangzhou', city: 'Hangzhou', period: 'Dec 1–15', bookings: 121, gross: '¥490,800', commission: '¥49,080', refunds: '¥8,400', net: '¥433,320', status: 'disputed', dueDate: '2024-12-22', method: 'Bank Transfer' },
  { id: 'SET-2024-1240', hotel: 'InterContinental Xiamen', city: 'Xiamen', period: 'Dec 1–15', bookings: 98, gross: '¥421,200', commission: '¥42,120', refunds: '¥0', net: '¥379,080', status: 'settled', dueDate: '2024-12-19', method: 'Alipay B2B' },
  { id: 'SET-2024-1239', hotel: 'Radisson Blu Wuhan', city: 'Wuhan', period: 'Dec 1–15', bookings: 156, gross: '¥360,400', commission: '¥36,040', refunds: '¥4,200', net: '¥320,160', status: 'pending', dueDate: '2024-12-26', method: 'Bank Transfer' },
  { id: 'SET-2024-1238', hotel: 'Novotel Nanjing East', city: 'Nanjing', period: 'Dec 1–15', bookings: 84, gross: '¥260,800', commission: '¥26,080', refunds: '¥2,100', net: '¥232,620', status: 'processing', dueDate: '2024-12-24', method: 'Bank Transfer' },
]

function StatusBadge({ status }: { status: Settlement['status'] }) {
  const cfg = {
    settled: { bg: '#ECFDF3', color: '#027A48' },
    pending: { bg: '#FFFAEB', color: '#B54708' },
    processing: { bg: '#EFF6FF', color: '#1D4ED8' },
    disputed: { bg: '#FFF1F3', color: '#C01048' },
  }
  const c = cfg[status]
  return (
    <span className="inline-flex items-center rounded px-1.5 capitalize font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>
      {status}
    </span>
  )
}

export default function FinancePage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 8

  const filtered = settlements.filter((s) =>
    !search || s.hotel.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search)
  )
  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Revenue Overview</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Financial performance and settlement management</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <Download size={13} /> Export Report
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace', lineHeight: 1, marginBottom: 6 }}>{c.value}</div>
            <div className="flex items-center gap-1">
              {c.up !== null ? (
                c.up ? <TrendingUp size={11} color="#027A48" /> : <TrendingDown size={11} color="#C01048" />
              ) : null}
              <span style={{ fontSize: 11, color: c.up === true ? '#027A48' : c.up === false ? '#C01048' : '#64748B', fontWeight: 500 }}>
                {c.change}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue allocation bar */}
      <div className="rounded-lg p-4 mb-5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Revenue Allocation</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Breakdown of ¥48.3M total revenue</p>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden mb-3" style={{ height: 24 }}>
          {[
            { label: 'Settled', pct: 85.4, color: '#10B981' },
            { label: 'Processing', pct: 7.2, color: '#3B82F6' },
            { label: 'Pending', pct: 5.6, color: '#F59E0B' },
            { label: 'Disputed', pct: 1.8, color: '#EF4444' },
          ].map((seg) => (
            <div key={seg.label} style={{ width: `${seg.pct}%`, background: seg.color }} className="transition-all" title={`${seg.label}: ${seg.pct}%`} />
          ))}
        </div>
        <div className="flex items-center gap-5">
          {[
            { label: 'Settled', pct: 85.4, color: '#10B981', value: '¥41.2M' },
            { label: 'Processing', pct: 7.2, color: '#3B82F6', value: '¥3.5M' },
            { label: 'Pending', pct: 5.6, color: '#F59E0B', value: '¥2.7M' },
            { label: 'Disputed', pct: 1.8, color: '#EF4444', value: '¥0.9M' },
          ].map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <div className="rounded-sm" style={{ width: 10, height: 10, background: seg.color }} />
              <span style={{ fontSize: 12, color: '#475569' }}>{seg.label}</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>{seg.pct}%</span>
              <span style={{ fontSize: 12, color: '#1A2332', fontWeight: 600, fontFamily: 'monospace' }}>{seg.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Settlements table header */}
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#1A2332' }}>Settlement Records</h2>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by hotel or ID..."
            className="outline-none bg-transparent"
            style={{ fontSize: 12, color: '#1A2332', width: 200 }}
          />
        </div>
      </div>

      {/* Settlements table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Settlement ID', 'Hotel', 'Period', 'Bookings', 'Gross Revenue', 'Commission', 'Refunds', 'Net Payout', 'Method', 'Due Date', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr
                key={s.id}
                style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="px-3" style={{ height: 44 }}>
                  <span style={{ fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 500 }}>{s.id}</span>
                </td>
                <td className="px-3">
                  <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }} className="max-w-[150px] truncate">{s.hotel}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.city}</div>
                </td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{s.period}</td>
                <td className="px-3 text-center" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{s.bookings}</td>
                <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace' }}>{s.gross}</td>
                <td className="px-3" style={{ fontSize: 12, color: '#C01048', fontFamily: 'monospace' }}>{s.commission}</td>
                <td className="px-3" style={{ fontSize: 12, color: s.refunds === '¥0' ? '#CBD5E1' : '#B54708', fontFamily: 'monospace' }}>{s.refunds}</td>
                <td className="px-3" style={{ fontSize: 12, fontWeight: 700, color: '#027A48', fontFamily: 'monospace' }}>{s.net}</td>
                <td className="px-3" style={{ fontSize: 12, color: '#64748B' }}>{s.method}</td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{s.dueDate}</td>
                <td className="px-3"><StatusBadge status={s.status} /></td>
                <td className="px-3">
                  <div className="flex items-center gap-0.5">
                    <ActionBtn><Eye size={12} /></ActionBtn>
                    <ActionBtn><FileText size={12} /></ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Showing {start + 1}–{Math.min(start + perPage, total)} of {total} settlements
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

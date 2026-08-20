import { useState } from 'react'
import {
  Download, FileText, Calendar, Search, Eye, ChevronLeft, ChevronRight,
  Filter, RefreshCw, Plus, CheckCircle, XCircle,
  Building2, BarChart3, Users2, Megaphone, Layers, BookOpen,
} from 'lucide-react'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildPath(data: number[], w: number, h: number, pad = 12) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const uw = (w - pad * 2) / (data.length - 1)
  const pts: [number, number][] = data.map((v, i) => [pad + i * uw, pad + (1 - (v - min) / range) * (h - pad * 2)])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`
  return { line, area, pts }
}

function LineChart({ data, color, label, w = 460, h = 110 }: { data: number[]; color: string; label?: string; w?: number; h?: number }) {
  const id = `rg_${color.replace('#', '')}`
  const { line, area, pts } = buildPath(data, w, h)
  return (
    <div>
      {label && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{label}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={12} y1={12 + (1 - t) * (h - 24)} x2={w - 12} y2={12 + (1 - t) * (h - 24)} stroke="#F1F5F9" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={2.5} fill={color} />
            <text x={x} y={h - 1} textAnchor="middle" fill="#CBD5E1" fontSize={8}>{months[i]}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function BarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-2" style={{ height: 80 }}>
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
          <div className="w-full rounded-t" style={{ height: `${(v / max) * 64}px`, background: color, opacity: 0.8 + (i / data.length) * 0.2 }} />
          <span style={{ fontSize: 9, color: '#94A3B8' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

function ActionBtn({ children, onClick, color, title }: { children: React.ReactNode; onClick: () => void; color: string; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: 28, height: 28, color: '#94A3B8' }}
      onMouseEnter={e => { e.currentTarget.style.background = color + '18'; e.currentTarget.style.color = color }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}>
      {children}
    </button>
  )
}

function PagBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center justify-center rounded"
      style={{ minWidth: 28, height: 28, fontSize: 12, background: active ? '#1664FF' : 'transparent', color: active ? '#fff' : disabled ? '#CBD5E1' : '#475569', cursor: disabled ? 'not-allowed' : 'pointer' }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = '#F1F5F9' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}


function ExportBar({ onExport }: { onExport: (fmt: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onExport('PDF')}
        className="flex items-center gap-1.5 rounded-md px-3"
        style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
        <FileText size={13} /> PDF
      </button>
      <button onClick={() => onExport('Excel')}
        className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
        style={{ height: 34, fontSize: 13, background: '#059669' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
        onMouseLeave={e => (e.currentTarget.style.background = '#059669')}>
        <Download size={13} /> Excel
      </button>
      <button onClick={() => onExport('CSV')}
        className="flex items-center gap-1.5 rounded-md px-3"
        style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
        <Download size={13} /> CSV
      </button>
    </div>
  )
}

function PageShell({ title, subtitle, actions, children }: {
  title: string; subtitle: string; actions?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reports & Analytics</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{title}</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{subtitle}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

// ── 1. Executive Dashboard ────────────────────────────────────────────────────

const topMerchants = [
  { name: 'Sanya Bay Resort',       revenue: 'MMK 3.2B', bookings: 890, growth: '+24.1%' },
  { name: 'The Peninsula Beijing',  revenue: 'MMK 2.8B', bookings: 412, growth: '+6.4%' },
  { name: 'Grand Hyatt Shanghai',   revenue: 'MMK 2.4B', bookings: 568, growth: '+4.1%' },
  { name: 'Macau Galaxy Suites',    revenue: 'MMK 1.8B', bookings: 620, growth: '+18.2%' },
  { name: 'Marriott Shenzhen',      revenue: 'MMK 1.9B', bookings: 384, growth: '+11.2%' },
]

function ExecutiveDashboardPage({ showToast }: { showToast: Props['showToast'] }) {
  return (
    <PageShell title="Executive Dashboard" subtitle="High-level platform performance overview for executive monitoring"
      actions={
        <>
          <button className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            <Calendar size={13} /> Date Range
          </button>
          <ExportBar onExport={fmt => showToast('success', `Export ${fmt}`, 'Executive Dashboard report exported.')} />
        </>
      }>
      {/* KPI Cards */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Platform Revenue YTD',  value: 'MMK 578.9B', change: '+18.4% vs 2023', color: '#1664FF' },
          { label: 'Total Bookings YTD',    value: '284,710',     change: '+22.1% vs 2023', color: '#059669' },
          { label: 'Active Merchants',      value: '26',           change: '4 new this month', color: '#D97706' },
          { label: 'Avg Commission Rate',   value: '8.6%',         change: 'Effective rate MTD', color: '#7C3AED' },
        ].map(c => (
          <div key={c.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.color, fontFamily: 'monospace', lineHeight: 1.2 }}>{c.value}</div>
            <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>{c.change}</div>
          </div>
        ))}
      </div>

      {/* Line charts */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {[
          { label: 'Revenue (MMK B)', data: [38.2, 34.5, 42.1, 48.7, 52.3, 55.8, 61.4, 67.2, 63.8, 71.5, 68.9, 74.3], color: '#1664FF' },
          { label: 'Total Bookings (00s)', data: [28.4, 26.2, 31.8, 38.4, 41.2, 45.8, 52.4, 58.2, 54.8, 63.2, 59.8, 64.1], color: '#059669' },
        ].map(c => (
          <div key={c.label} className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>{c.label}</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>Monthly trend — FY 2024</p>
            <LineChart data={c.data} color={c.color} />
          </div>
        ))}
      </div>

      {/* Bar + top merchants */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 12 }}>Bookings by Channel</h3>
          <BarChart data={[28, 24, 19, 14, 9, 6]} labels={['Ctrip', 'Meituan', 'Direct', 'Corp', 'Fliggy', 'Other']} color="#1664FF" />
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Top Merchants by Revenue</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Merchant', 'Revenue', 'Bookings', 'Growth'].map(h => (
                  <th key={h} className="text-left px-4" style={{ height: 32, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topMerchants.map((m, i) => (
                <tr key={m.name} style={{ borderTop: '1px solid #F8FAFC' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4" style={{ height: 40 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 11, color: '#CBD5E1', fontFamily: 'monospace', minWidth: 14 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }}>{m.name}</span>
                    </div>
                  </td>
                  <td className="px-4" style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace' }}>{m.revenue}</td>
                  <td className="px-4" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{m.bookings.toLocaleString()}</td>
                  <td className="px-4" style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>{m.growth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  )
}

// ── 2. Transaction Reports ────────────────────────────────────────────────────

type TxType = 'Booking Payment' | 'Refund' | 'Merchant Settlement' | 'Affiliate Commission' | 'Campaign Budget' | 'Voucher Redemption' | 'Coupon Discount' | 'Promotion Discount' | 'Withdrawal'
type TxStatus = 'Completed' | 'Pending' | 'Failed' | 'Reversed' | 'Processing'
type PayMethod = 'Card' | 'Bank Transfer' | 'Alipay' | 'WeChat Pay' | 'Platform Credits' | 'Wallet'

interface Transaction {
  id: string; bookingId: string; customer: string; merchant: string
  type: TxType; method: PayMethod; gross: number; commission: number
  merchantPayout: number; net: number; status: TxStatus; datetime: string
}

const TX_TYPES: TxType[] = ['Booking Payment', 'Refund', 'Merchant Settlement', 'Affiliate Commission', 'Campaign Budget', 'Voucher Redemption', 'Coupon Discount', 'Promotion Discount', 'Withdrawal']
const TX_STATUSES: TxStatus[] = ['Completed', 'Pending', 'Failed', 'Reversed', 'Processing']
const PAY_METHODS: PayMethod[] = ['Card', 'Bank Transfer', 'Alipay', 'WeChat Pay', 'Platform Credits', 'Wallet']

const MERCHANTS = ['Sanya Bay Resort', 'The Peninsula Beijing', 'Grand Hyatt Shanghai', 'Macau Galaxy Suites', 'Marriott Shenzhen', 'Ritz-Carlton Chengdu']

const transactions: Transaction[] = [
  { id: 'TX-2024-00142', bookingId: 'BK-20241213-001', customer: 'Zhang Wei',     merchant: 'Sanya Bay Resort',      type: 'Booking Payment',    method: 'Card',            gross: 4280000,  commission: 385200,  merchantPayout: 3894800,  net: 3894800,  status: 'Completed',  datetime: '2024-12-13 14:22' },
  { id: 'TX-2024-00141', bookingId: 'BK-20241213-002', customer: 'Li Hua',        merchant: 'The Peninsula Beijing', type: 'Refund',              method: 'Card',            gross: -1500000, commission: -135000, merchantPayout: -1365000, net: -1365000, status: 'Completed',  datetime: '2024-12-13 12:05' },
  { id: 'TX-2024-00140', bookingId: 'BK-20241212-009', customer: 'Wang Fang',     merchant: 'Grand Hyatt Shanghai',  type: 'Voucher Redemption',  method: 'Platform Credits', gross: 2100000,  commission: 189000,  merchantPayout: 1911000,  net: 1911000,  status: 'Completed',  datetime: '2024-12-12 18:44' },
  { id: 'TX-2024-00139', bookingId: 'BK-20241212-007', customer: 'Chen Mingzhi', merchant: 'Macau Galaxy Suites',   type: 'Booking Payment',    method: 'Alipay',          gross: 6800000,  commission: 612000,  merchantPayout: 6188000,  net: 6188000,  status: 'Completed',  datetime: '2024-12-12 11:30' },
  { id: 'TX-2024-00138', bookingId: '—',               customer: '—',             merchant: 'Sanya Bay Resort',      type: 'Merchant Settlement', method: 'Bank Transfer',   gross: 18200000, commission: 0,       merchantPayout: 18200000, net: 18200000, status: 'Processing', datetime: '2024-12-12 09:00' },
  { id: 'TX-2024-00137', bookingId: 'BK-20241211-014', customer: 'Liu Yang',      merchant: 'Marriott Shenzhen',     type: 'Promotion Discount',  method: 'WeChat Pay',      gross: 3500000,  commission: 315000,  merchantPayout: 3185000,  net: 3185000,  status: 'Completed',  datetime: '2024-12-11 20:15' },
  { id: 'TX-2024-00136', bookingId: '—',               customer: 'TravelWithLily', merchant: '—',                   type: 'Affiliate Commission', method: 'Platform Credits', gross: 152000,   commission: 0,       merchantPayout: 0,        net: 152000,   status: 'Pending',    datetime: '2024-12-11 16:00' },
  { id: 'TX-2024-00135', bookingId: 'BK-20241210-022', customer: 'Zhao Xia',      merchant: 'Ritz-Carlton Chengdu',  type: 'Booking Payment',    method: 'Card',            gross: 9200000,  commission: 828000,  merchantPayout: 8372000,  net: 8372000,  status: 'Completed',  datetime: '2024-12-10 13:48' },
  { id: 'TX-2024-00134', bookingId: 'BK-20241210-019', customer: 'Sun Lei',       merchant: 'The Peninsula Beijing', type: 'Coupon Discount',     method: 'Bank Transfer',   gross: 2800000,  commission: 252000,  merchantPayout: 2548000,  net: 2548000,  status: 'Completed',  datetime: '2024-12-10 10:22' },
  { id: 'TX-2024-00133', bookingId: '—',               customer: 'Jason Hotel Reviews', merchant: '—',               type: 'Withdrawal',          method: 'WeChat Pay',      gross: -126000,  commission: 0,       merchantPayout: 0,        net: -126000,  status: 'Pending',    datetime: '2024-12-09 09:00' },
  { id: 'TX-2024-00132', bookingId: 'BK-20241208-031', customer: 'Huang Min',     merchant: 'Grand Hyatt Shanghai',  type: 'Booking Payment',    method: 'Alipay',          gross: 5100000,  commission: 459000,  merchantPayout: 4641000,  net: 4641000,  status: 'Completed',  datetime: '2024-12-08 21:07' },
  { id: 'TX-2024-00131', bookingId: 'BK-20241207-008', customer: 'Wu Jing',       merchant: 'Macau Galaxy Suites',   type: 'Refund',             method: 'Alipay',          gross: -890000,  commission: -80100,  merchantPayout: -809900,  net: -809900,  status: 'Reversed',   datetime: '2024-12-07 15:33' },
  { id: 'TX-2024-00130', bookingId: 'BK-20241206-041', customer: 'Ma Qiang',      merchant: 'Sanya Bay Resort',      type: 'Campaign Budget',    method: 'Platform Credits', gross: 350000,   commission: 0,       merchantPayout: 0,        net: 350000,   status: 'Completed',  datetime: '2024-12-06 08:50' },
  { id: 'TX-2024-00129', bookingId: 'BK-20241205-017', customer: 'Gao Yan',       merchant: 'Marriott Shenzhen',     type: 'Booking Payment',    method: 'WeChat Pay',      gross: 2650000,  commission: 238500,  merchantPayout: 2411500,  net: 2411500,  status: 'Failed',     datetime: '2024-12-05 19:41' },
  { id: 'TX-2024-00128', bookingId: '—',               customer: '—',             merchant: 'Ritz-Carlton Chengdu',  type: 'Merchant Settlement', method: 'Bank Transfer',   gross: 32400000, commission: 0,       merchantPayout: 32400000, net: 32400000, status: 'Completed',  datetime: '2024-12-04 09:00' },
]

function fmtMMK(n: number): string {
  const abs = Math.abs(n)
  const s = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(2)}M` : abs >= 1000 ? `${(abs / 1000).toFixed(0)}K` : String(abs)
  return `${n < 0 ? '-' : ''}MMK ${s}`
}

const TX_STATUS_STYLE: Record<TxStatus, { bg: string; color: string }> = {
  Completed:  { bg: '#ECFDF3', color: '#027A48' },
  Pending:    { bg: '#FFFAEB', color: '#B54708' },
  Failed:     { bg: '#FFF1F3', color: '#C01048' },
  Reversed:   { bg: '#F1F5F9', color: '#475569' },
  Processing: { bg: '#EFF6FF', color: '#1D4ED8' },
}

const TX_TYPE_COLOR: Record<TxType, string> = {
  'Booking Payment':     '#1664FF',
  'Refund':             '#DC2626',
  'Merchant Settlement':'#059669',
  'Affiliate Commission':'#7C3AED',
  'Campaign Budget':    '#D97706',
  'Voucher Redemption': '#0EA5E9',
  'Coupon Discount':    '#F59E0B',
  'Promotion Discount': '#10B981',
  'Withdrawal':         '#EF4444',
}

type TxSortCol = 'datetime' | 'gross' | 'commission' | 'net'

function SortTh({ col, label, sortCol, sortDir, onSort }: {
  col: TxSortCol; label: string
  sortCol: TxSortCol; sortDir: 'asc' | 'desc'
  onSort: (col: TxSortCol) => void
}) {
  const isActive = sortCol === col
  return (
    <th className="text-left px-3 cursor-pointer select-none" style={{ height: 36, fontSize: 11, fontWeight: 600, color: isActive ? '#1664FF' : '#64748B', whiteSpace: 'nowrap' }}
      onClick={() => onSort(col)}>
      <div className="flex items-center gap-1">{label}<span style={{ opacity: isActive ? 1 : 0.3 }}>{sortDir === 'asc' && isActive ? '↑' : '↓'}</span></div>
    </th>
  )
}

function TransactionReportsPage({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMerchant, setFilterMerchant] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortCol, setSortCol] = useState<TxSortCol>('datetime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [viewTarget, setViewTarget] = useState<Transaction | null>(null)
  const perPage = 10

  function handleSort(col: TxSortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const filtered = transactions.filter(t => {
    if (filterType && t.type !== filterType) return false
    if (filterMerchant && t.merchant !== filterMerchant) return false
    if (filterStatus && t.status !== filterStatus) return false
    if (filterMethod && t.method !== filterMethod) return false
    if (search && !t.id.toLowerCase().includes(search.toLowerCase()) &&
        !t.bookingId.toLowerCase().includes(search.toLowerCase()) &&
        !t.customer.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    const vals: Record<string, number> = {
      datetime: a.datetime.localeCompare(b.datetime),
      gross: a.gross - b.gross,
      commission: a.commission - b.commission,
      net: a.net - b.net,
    }
    return sortDir === 'asc' ? vals[sortCol] : -vals[sortCol]
  })

  const total = filtered.length
  const rows = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const kpis = [
    { label: 'Total Volume',     value: fmtMMK(transactions.reduce((s, t) => s + Math.max(0, t.gross), 0)), color: '#1664FF' },
    { label: 'Commission Earned', value: fmtMMK(transactions.reduce((s, t) => s + Math.max(0, t.commission), 0)), color: '#059669' },
    { label: 'Transactions',     value: transactions.length,                                                  color: '#D97706' },
    { label: 'Pending',          value: transactions.filter(t => t.status === 'Pending').length,             color: '#F59E0B', sub: 'Awaiting processing' },
    { label: 'Failed / Reversed', value: transactions.filter(t => t.status === 'Failed' || t.status === 'Reversed').length, color: '#DC2626' },
  ]

  return (
    <PageShell title="Transaction Reports" subtitle="Detailed financial and operational transaction ledger across all activity types"
      actions={<ExportBar onExport={fmt => showToast('success', `Export ${fmt}`, 'Transaction report exported.')} />}>
      {/* KPIs */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: 'monospace', lineHeight: 1.2 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search Transaction ID, Booking ID, Customer…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Types</option>
            {TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Statuses</option>
            {TX_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 rounded px-2"
            style={{ height: 28, fontSize: 12, color: showFilters ? '#1664FF' : '#64748B', background: showFilters ? '#EFF6FF' : 'transparent', border: showFilters ? '1px solid #BFDBFE' : '1px solid transparent' }}>
            <Filter size={12} /> Filters
          </button>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} records</span>
        </div>
        {showFilters && (
          <div className="grid gap-3 rounded-lg px-4 py-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Date From</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full rounded px-2" style={{ height: 32, fontSize: 12, border: '1px solid #E3E8F0', outline: 'none', background: '#fff' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Date To</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full rounded px-2" style={{ height: 32, fontSize: 12, border: '1px solid #E3E8F0', outline: 'none', background: '#fff' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Merchant</label>
              <select value={filterMerchant} onChange={e => setFilterMerchant(e.target.value)} className="w-full rounded px-2 outline-none" style={{ height: 32, fontSize: 12, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                <option value="">All Merchants</option>
                {MERCHANTS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Payment Method</label>
              <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="w-full rounded px-2 outline-none" style={{ height: 32, fontSize: 12, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                <option value="">All Methods</option>
                {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ minWidth: 1280 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>Transaction ID</th>
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>Booking ID</th>
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Customer</th>
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Merchant</th>
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>Type</th>
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>Method</th>
                <SortTh col="gross" label="Gross (MMK)" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="commission" label="Commission" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>Merchant Payout</th>
                <SortTh col="net" label="Net (MMK)" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Status</th>
                <SortTh col="datetime" label="Date & Time" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const ss = TX_STATUS_STYLE[t.status]
                const tc = TX_TYPE_COLOR[t.type]
                return (
                  <tr key={t.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 52 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1664FF', fontFamily: 'monospace' }}>{t.id}</div>
                    </td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{t.bookingId}</td>
                    <td className="px-3" style={{ fontSize: 12, color: '#1A2332' }}>{t.customer}</td>
                    <td className="px-3" style={{ fontSize: 12, color: '#475569' }}>{t.merchant === '—' ? <span style={{ color: '#CBD5E1' }}>—</span> : t.merchant}</td>
                    <td className="px-3">
                      <span style={{ fontSize: 11, color: tc, background: tc + '14', padding: '2px 6px', borderRadius: 4, fontWeight: 500, whiteSpace: 'nowrap' }}>{t.type}</span>
                    </td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B' }}>{t.method}</td>
                    <td className="px-3" style={{ fontSize: 12, fontWeight: 700, color: t.gross < 0 ? '#DC2626' : '#1A2332', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmtMMK(t.gross)}</td>
                    <td className="px-3" style={{ fontSize: 12, color: t.commission < 0 ? '#DC2626' : '#059669', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{t.commission !== 0 ? fmtMMK(t.commission) : '—'}</td>
                    <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{t.merchantPayout !== 0 ? fmtMMK(t.merchantPayout) : '—'}</td>
                    <td className="px-3" style={{ fontSize: 12, fontWeight: 700, color: t.net < 0 ? '#DC2626' : '#1A2332', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmtMMK(t.net)}</td>
                    <td className="px-3">
                      <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, height: 20, background: ss.bg, color: ss.color }}>{t.status}</span>
                    </td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{t.datetime}</td>
                    <td className="px-3">
                      <ActionBtn color="#1664FF" onClick={() => setViewTarget(t)} title="View Details"><Eye size={12} /></ActionBtn>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={13} style={{ textAlign: 'center', padding: 32, fontSize: 13, color: '#94A3B8' }}>No transactions match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: totalPages }).map((_, i) => <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>{i + 1}</PagBtn>)}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>

      {/* Transaction detail drawer */}
      {viewTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setViewTarget(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 520, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{viewTarget.id}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{viewTarget.type} · {viewTarget.datetime}</div>
              </div>
              <button onClick={() => setViewTarget(null)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E3E8F0', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#94A3B8' }}>×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Status banner */}
              <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: TX_STATUS_STYLE[viewTarget.status].bg, border: `1px solid ${TX_STATUS_STYLE[viewTarget.status].color}22` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: TX_STATUS_STYLE[viewTarget.status].color }}>{viewTarget.status}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: TX_TYPE_COLOR[viewTarget.type] }}>{viewTarget.type}</span>
              </div>
              {/* Amounts */}
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[
                  { label: 'Gross Amount',      value: fmtMMK(viewTarget.gross),          color: viewTarget.gross < 0 ? '#DC2626' : '#1A2332' },
                  { label: 'Platform Commission',value: fmtMMK(viewTarget.commission),     color: '#059669' },
                  { label: 'Merchant Payout',   value: fmtMMK(viewTarget.merchantPayout), color: '#D97706' },
                  { label: 'Net Amount',         value: fmtMMK(viewTarget.net),            color: viewTarget.net < 0 ? '#DC2626' : '#1664FF' },
                ].map(f => (
                  <div key={f.label} className="rounded px-3 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: f.color, fontFamily: 'monospace' }}>{f.value}</div>
                  </div>
                ))}
              </div>
              {/* Details */}
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[
                  { label: 'Transaction ID',  value: viewTarget.id,         mono: true },
                  { label: 'Booking ID',      value: viewTarget.bookingId,  mono: true },
                  { label: 'Customer',        value: viewTarget.customer },
                  { label: 'Merchant',        value: viewTarget.merchant },
                  { label: 'Payment Method',  value: viewTarget.method },
                  { label: 'Date & Time',     value: viewTarget.datetime,   mono: true },
                ].map(f => (
                  <div key={f.label} className="rounded px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

// ── 3. Business Reports ───────────────────────────────────────────────────────

interface ReportCard {
  id: string; title: string; description: string; icon: React.ReactNode
  iconBg: string; iconColor: string; lastGenerated: string; records: number
  filters: string[]
}

const BUSINESS_REPORTS: ReportCard[] = [
  {
    id: 'merchant', title: 'Merchant Reports', description: 'Merchant onboarding, verification status, activity, revenue performance, and settlement history',
    icon: <Building2 size={18} />, iconBg: '#EFF6FF', iconColor: '#1664FF',
    lastGenerated: '2024-12-13', records: 26, filters: ['Date Range', 'Merchant Status', 'Merchant Type', 'Region'],
  },
  {
    id: 'booking', title: 'Booking Reports', description: 'All booking transactions with check-in/out, room types, cancellation rates, and source channel breakdown',
    icon: <BookOpen size={18} />, iconBg: '#ECFDF3', iconColor: '#059669',
    lastGenerated: '2024-12-13', records: 284710, filters: ['Date Range', 'Merchant', 'Status', 'Channel', 'Room Type'],
  },
  {
    id: 'revenue', title: 'Revenue Reports', description: 'Gross revenue, platform commissions, refunds, net settlements, and revenue by category',
    icon: <BarChart3 size={18} />, iconBg: '#FFF1F3', iconColor: '#BE123C',
    lastGenerated: '2024-12-12', records: 15403, filters: ['Date Range', 'Merchant', 'Revenue Type', 'Currency'],
  },
  {
    id: 'campaign', title: 'Campaign Reports', description: 'Campaign performance, budget utilization, ROI by campaign type, merchant vs platform campaigns',
    icon: <Megaphone size={18} />, iconBg: '#FFF7ED', iconColor: '#D97706',
    lastGenerated: '2024-12-11', records: 10, filters: ['Date Range', 'Campaign Type', 'Owner', 'Status'],
  },
  {
    id: 'affiliate', title: 'Affiliate Reports', description: 'Affiliate partner performance, referral counts, commission payouts, and fraud detection summary',
    icon: <Users2 size={18} />, iconBg: '#EDE9FE', iconColor: '#7C3AED',
    lastGenerated: '2024-12-10', records: 22, filters: ['Date Range', 'Partner Type', 'Status', 'Commission Range'],
  },
  {
    id: 'inventory', title: 'Inventory Reports', description: 'Room availability rates, occupancy metrics, sync status, and inventory alert history by merchant',
    icon: <Layers size={18} />, iconBg: '#F0FDF4', iconColor: '#166534',
    lastGenerated: '2024-12-09', records: 1240, filters: ['Date Range', 'Merchant', 'Room Type', 'Availability Status'],
  },
]

interface BusinessReportFilter { dateFrom: string; dateTo: string; merchant: string; status: string }

function BusinessReportsPage({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [activeReport, setActiveReport] = useState<ReportCard | null>(null)
  const [filters, setFilters] = useState<BusinessReportFilter>({ dateFrom: '', dateTo: '', merchant: '', status: '' })
  const [generating, setGenerating] = useState(false)

  const visible = BUSINESS_REPORTS.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())
  )

  function generate(report: ReportCard, fmt: string) {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      showToast('success', `${fmt} Generated`, `${report.title} exported as ${fmt}.`)
    }, 900)
  }

  return (
    <PageShell title="Business Reports" subtitle="Generate, filter, and export structured reports across all platform domains"
      actions={
        <div className="flex items-center gap-2 rounded-lg px-4 py-2" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
            className="outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332', width: 200 }} />
        </div>
      }>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {visible.map(report => (
          <div key={report.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: report.iconBg, color: report.iconColor }}>
                  {report.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>{report.title}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, lineHeight: 1.5 }}>{report.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded px-2 py-1" style={{ background: '#F8FAFC', fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
                  {report.records.toLocaleString()} records
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Last: {report.lastGenerated}</div>
              </div>
              {/* Filter chips */}
              <div className="flex flex-wrap gap-1 mb-4">
                {report.filters.map(f => (
                  <span key={f} style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{f}</span>
                ))}
              </div>
            </div>
            <div className="px-4 pb-4 flex items-center gap-2">
              <button onClick={() => setActiveReport(report)}
                className="flex items-center gap-1.5 rounded-md px-3 font-medium flex-1 justify-center"
                style={{ height: 32, fontSize: 12, color: report.iconColor, border: `1px solid ${report.iconBg}`, background: report.iconBg }}>
                <Filter size={11} /> Configure & Export
              </button>
              <button onClick={() => generate(report, 'PDF')} disabled={generating}
                className="flex items-center gap-1 rounded-md px-2"
                style={{ height: 32, fontSize: 11, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
                <FileText size={11} /> PDF
              </button>
              <button onClick={() => generate(report, 'Excel')} disabled={generating}
                className="flex items-center gap-1 rounded-md px-2 text-white font-medium"
                style={{ height: 32, fontSize: 11, background: '#059669' }}>
                <Download size={11} /> XLS
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Configure drawer */}
      {activeReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setActiveReport(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 480, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{activeReport.title}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Configure filters and export format</div>
              </div>
              <button onClick={() => setActiveReport(null)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E3E8F0', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#94A3B8' }}>×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Date From</label>
                  <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                    className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Date To</label>
                  <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                    className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Merchant</label>
                <select value={filters.merchant} onChange={e => setFilters(f => ({ ...f, merchant: e.target.value }))}
                  className="w-full rounded-md px-3 outline-none" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                  <option value="">All Merchants</option>
                  {MERCHANTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Status Filter</label>
                <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                  className="w-full rounded-md px-3 outline-none" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                  <option value="">All Statuses</option>
                  <option value="active">Active</option><option value="completed">Completed</option><option value="pending">Pending</option>
                </select>
              </div>
              <div className="pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 8 }}>Export Format</div>
                <div className="flex gap-2">
                  {['PDF', 'Excel', 'CSV'].map(fmt => (
                    <button key={fmt} disabled={generating} onClick={() => { generate(activeReport, fmt); setActiveReport(null) }}
                      className="flex items-center gap-1.5 rounded-md px-4 font-medium"
                      style={{ height: 36, fontSize: 13, background: fmt === 'Excel' ? '#059669' : '#fff', color: fmt === 'Excel' ? '#fff' : '#475569', border: fmt === 'Excel' ? 'none' : '1px solid #E3E8F0' }}>
                      <Download size={13} /> {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

// ── 4. Custom Reports ─────────────────────────────────────────────────────────

const REPORT_TYPE_COLUMNS: Record<string, string[]> = {
  'Booking Summary':       ['Booking ID', 'Customer', 'Merchant', 'Room Type', 'Check-In', 'Check-Out', 'Nights', 'Gross Amount', 'Commission', 'Status', 'Channel', 'Created At'],
  'Revenue Breakdown':     ['Period', 'Merchant', 'Gross Revenue', 'Commission Rate', 'Commission Earned', 'Refunds', 'Net Revenue', 'Currency'],
  'Merchant Performance':  ['Merchant', 'Total Bookings', 'Revenue', 'Avg Daily Rate', 'Occupancy %', 'Commission Paid', 'Join Date', 'Status'],
  'Affiliate Performance': ['Partner Name', 'Partner Type', 'Referrals', 'Bookings', 'Revenue Attributed', 'Commission Paid', 'Conversion Rate', 'Status'],
  'Campaign Analytics':    ['Campaign', 'Owner', 'Type', 'Budget Allocated', 'Budget Used', 'Revenue', 'ROI', 'Claims', 'Conv. Rate', 'Status'],
  'Transaction Ledger':    ['Transaction ID', 'Booking ID', 'Customer', 'Merchant', 'Type', 'Method', 'Gross', 'Commission', 'Net', 'Status', 'Date'],
  'Inventory Availability':['Merchant', 'Room Type', 'Total Rooms', 'Available', 'Occupied', 'Maintenance', 'Occupancy %', 'Last Sync'],
}

function CustomReportsPage({ showToast }: { showToast: Props['showToast'] }) {
  const [reportType, setReportType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [merchant, setMerchant] = useState('')
  const [exportFmt, setExportFmt] = useState<'PDF' | 'Excel' | 'CSV'>('Excel')
  const [selectedCols, setSelectedCols] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [addFilter, setAddFilter] = useState<{ key: string; value: string }[]>([])

  const availableCols = reportType ? REPORT_TYPE_COLUMNS[reportType] ?? [] : []

  function toggleCol(col: string) {
    setSelectedCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])
  }

  function handleGenerate() {
    if (!reportType) { showToast('error', 'Report Type Required', 'Select a report type to continue.'); return }
    if (selectedCols.length === 0) { showToast('error', 'Columns Required', 'Select at least one column to include.'); return }
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
      showToast('success', `Report Generated`, `${reportType} exported as ${exportFmt} — ${selectedCols.length} columns, ${merchant || 'all merchants'}.`)
    }, 1200)
  }

  const canGenerate = !!reportType && selectedCols.length > 0

  return (
    <PageShell title="Custom Reports" subtitle="Build ad-hoc reports by selecting report type, date range, columns, filters, and export format">
      <div className="grid gap-5" style={{ gridTemplateColumns: '360px 1fr' }}>
        {/* Builder panel */}
        <div className="space-y-4">
          {/* Report Type */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 10 }}>Report Type</div>
            <div className="space-y-1.5">
              {Object.keys(REPORT_TYPE_COLUMNS).map(type => (
                <button key={type} onClick={() => { setReportType(type); setSelectedCols([]); setGenerated(false) }}
                  className="flex items-center gap-2 w-full rounded-md px-3 text-left transition-all"
                  style={{ height: 34, fontSize: 13, background: reportType === type ? '#EFF6FF' : 'transparent', color: reportType === type ? '#1664FF' : '#475569', border: reportType === type ? '1px solid #BFDBFE' : '1px solid transparent', fontWeight: reportType === type ? 600 : 400 }}>
                  {reportType === type ? <CheckCircle size={13} color="#1664FF" /> : <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid #CBD5E1' }} />}
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 10 }}>Date Range</div>
            <div className="space-y-2">
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full rounded-md px-3" style={{ height: 34, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full rounded-md px-3" style={{ height: 34, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
              </div>
              <div className="flex gap-2 flex-wrap pt-1">
                {[['Today', 0], ['Last 7d', 7], ['Last 30d', 30], ['Last 90d', 90]].map(([label, days]) => (
                  <button key={label} onClick={() => {
                    const to = new Date()
                    const from = new Date(); from.setDate(from.getDate() - Number(days))
                    setDateTo(to.toISOString().split('T')[0])
                    setDateFrom(from.toISOString().split('T')[0])
                  }}
                    className="rounded px-2"
                    style={{ height: 26, fontSize: 11, color: '#475569', border: '1px solid #E3E8F0', background: '#F8FAFC' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 10 }}>Filters</div>
            <div className="space-y-2">
              <div>
                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>Merchant</label>
                <select value={merchant} onChange={e => setMerchant(e.target.value)}
                  className="w-full rounded-md px-3 outline-none" style={{ height: 34, fontSize: 13, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                  <option value="">All Merchants</option>
                  {MERCHANTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {/* Dynamic filter rows */}
              {addFilter.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <input value={f.key} onChange={e => setAddFilter(prev => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                    placeholder="Field name" className="flex-1 rounded-md px-2" style={{ height: 32, fontSize: 12, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
                  <input value={f.value} onChange={e => setAddFilter(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    placeholder="Value" className="flex-1 rounded-md px-2" style={{ height: 32, fontSize: 12, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
                  <button onClick={() => setAddFilter(prev => prev.filter((_, j) => j !== i))}
                    style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #FECDD3', background: '#FFF1F3', color: '#DC2626', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
              <button onClick={() => setAddFilter(prev => [...prev, { key: '', value: '' }])}
                className="flex items-center gap-1.5 w-full justify-center rounded-md"
                style={{ height: 32, fontSize: 12, color: '#1664FF', border: '1px dashed #BFDBFE', background: 'transparent' }}>
                <Plus size={12} /> Add Filter
              </button>
            </div>
          </div>

          {/* Export format */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 10 }}>Export Format</div>
            <div className="flex gap-2">
              {(['PDF', 'Excel', 'CSV'] as const).map(fmt => (
                <button key={fmt} onClick={() => setExportFmt(fmt)}
                  className="flex-1 rounded-md font-medium"
                  style={{ height: 34, fontSize: 13, background: exportFmt === fmt ? '#1664FF' : '#fff', color: exportFmt === fmt ? '#fff' : '#475569', border: exportFmt === fmt ? 'none' : '1px solid #E3E8F0' }}>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Column selector + preview */}
        <div className="space-y-4">
          {/* Column selector */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="flex items-center justify-between mb-3">
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>Select Columns</div>
              {availableCols.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => setSelectedCols(availableCols)} style={{ fontSize: 11, color: '#1664FF', cursor: 'pointer', background: 'none', border: 'none' }}>Select All</button>
                  <span style={{ color: '#CBD5E1' }}>·</span>
                  <button onClick={() => setSelectedCols([])} style={{ fontSize: 11, color: '#DC2626', cursor: 'pointer', background: 'none', border: 'none' }}>Clear</button>
                </div>
              )}
            </div>
            {!reportType ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>Select a report type to see available columns</div>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {availableCols.map(col => {
                  const isSelected = selectedCols.includes(col)
                  return (
                    <button key={col} onClick={() => toggleCol(col)}
                      className="flex items-center gap-2 rounded-md px-3 text-left transition-all"
                      style={{ height: 34, fontSize: 12, background: isSelected ? '#EFF6FF' : '#F8FAFC', color: isSelected ? '#1664FF' : '#475569', border: isSelected ? '1px solid #BFDBFE' : '1px solid #F1F5F9', fontWeight: isSelected ? 600 : 400 }}>
                      {isSelected ? <CheckCircle size={12} color="#1664FF" /> : <XCircle size={12} color="#CBD5E1" />}
                      <span className="truncate">{col}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Preview / Summary */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 12 }}>Report Summary</div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {[
                { label: 'Report Type',    value: reportType || '—' },
                { label: 'Date Range',     value: dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `From ${dateFrom}` : '—' },
                { label: 'Merchant',       value: merchant || 'All Merchants' },
                { label: 'Columns',        value: selectedCols.length > 0 ? `${selectedCols.length} selected` : '0 selected', color: selectedCols.length === 0 ? '#DC2626' : '#059669' },
                { label: 'Export Format',  value: exportFmt },
                { label: 'Extra Filters',  value: addFilter.filter(f => f.key).length > 0 ? `${addFilter.filter(f => f.key).length} custom filters` : '—' },
              ].map(f => (
                <div key={f.label} className="rounded px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: (f as any).color ?? '#1A2332', fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>
            {selectedCols.length > 0 && (
              <div className="mt-3">
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>Included columns:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedCols.map(c => (
                    <span key={c} style={{ fontSize: 10, color: '#1664FF', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="flex items-center gap-3">
            <button onClick={handleGenerate} disabled={!canGenerate || generating}
              className="flex items-center gap-2 rounded-md px-6 text-white font-medium"
              style={{ height: 40, fontSize: 14, background: canGenerate ? '#1664FF' : '#CBD5E1', cursor: canGenerate ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}
              onMouseEnter={e => { if (canGenerate) e.currentTarget.style.background = '#0E4FCC' }}
              onMouseLeave={e => { if (canGenerate) e.currentTarget.style.background = '#1664FF' }}>
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              {generating ? 'Generating…' : `Generate ${exportFmt} Report`}
            </button>
            {generated && !generating && (
              <div className="flex items-center gap-1.5" style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>
                <CheckCircle size={14} /> Report generated successfully
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function ReportsPage({ tab, showToast }: Props) {
  if (tab === 'reports-transactions') return <TransactionReportsPage showToast={showToast} />
  if (tab === 'reports-business')     return <BusinessReportsPage    showToast={showToast} />
  if (tab === 'reports-custom')       return <CustomReportsPage      showToast={showToast} />
  return <ExecutiveDashboardPage showToast={showToast} />
}

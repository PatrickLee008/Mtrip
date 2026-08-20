import {
  TrendingUp, TrendingDown, ArrowUpRight, ShieldCheck, Building2,
  CalendarCheck, DollarSign, Users2, Megaphone, AlertCircle,
  CheckCircle, Clock, ChevronRight, RefreshCw, AlertTriangle,
  UserCog, FileText, Tag, Ticket,
} from 'lucide-react'
import { platformStats, merchants } from '../data/platformData'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'

interface Props {
  showToast: (type: Toast['type'], title: string, message?: string) => void
  onNavigate: (page: PageId) => void
}

// ── KPI data ──────────────────────────────────────────────────────────────────

const kpis = [
  {
    label: 'Pending Merchant Approvals',
    value: String(platformStats.pendingVerification),
    change: '+3 since yesterday',
    pct: '+42%',
    up: false,
    icon: ShieldCheck,
    color: '#D97706',
    bg: '#FFFBEB',
    spark: [4, 5, 6, 5, 7, 6, 8, 9, 8, 11],
  },
  {
    label: 'Active Merchants',
    value: String(platformStats.approvedMerchants),
    change: '+2 this week',
    pct: '+8%',
    up: true,
    icon: Building2,
    color: '#1664FF',
    bg: '#EEF4FF',
    spark: [18, 19, 19, 20, 21, 21, 22, 23, 24, 26],
  },
  {
    label: "Today's Bookings",
    value: String(platformStats.todayBookings),
    change: '+18% vs yesterday',
    pct: '+18%',
    up: true,
    icon: CalendarCheck,
    color: '#059669',
    bg: '#ECFDF3',
    spark: [280, 310, 290, 340, 360, 320, 380, 400, 420, 384],
  },
  {
    label: 'Platform Revenue MTD',
    value: 'MMK 48.3B',
    change: '+12.4% YoY',
    pct: '+12.4%',
    up: true,
    icon: DollarSign,
    color: '#059669',
    bg: '#ECFDF3',
    spark: [38, 34, 42, 48, 52, 55, 61, 67, 63, 72],
  },
  {
    label: 'Pending Refund Requests',
    value: String(platformStats.pendingRefunds),
    change: '3 marked urgent',
    pct: '+2',
    up: false,
    icon: AlertCircle,
    color: '#DC2626',
    bg: '#FFF1F2',
    spark: [8, 7, 9, 11, 8, 10, 9, 12, 10, 13],
  },
  {
    label: 'Pending Settlement',
    value: String(platformStats.pendingSettlements),
    change: 'MMK 2.1M total value',
    pct: null,
    up: null,
    icon: Clock,
    color: '#7C3AED',
    bg: '#F5F3FF',
    spark: [3, 4, 4, 5, 3, 6, 4, 5, 6, 7],
  },
  {
    label: 'Affiliate Applications',
    value: '3',
    change: '2 new today',
    pct: '+2',
    up: null,
    icon: Users2,
    color: '#0EA5E9',
    bg: '#F0F9FF',
    spark: [1, 2, 1, 3, 2, 1, 3, 2, 3, 3],
  },
  {
    label: 'System Alerts',
    value: '5',
    change: '2 critical',
    pct: null,
    up: false,
    icon: AlertTriangle,
    color: '#E11D48',
    bg: '#FFF1F3',
    spark: [1, 3, 2, 4, 3, 5, 4, 6, 5, 5],
  },
]

// ── Campaign performance data ─────────────────────────────────────────────────

const campaignKpis = [
  {
    label: 'Active Platform Campaigns',
    value: '7',
    sub: 'mTrip-managed campaigns',
    footer: '+2 launched this month',
    icon: Megaphone,
    color: '#1664FF',
    bg: '#EEF4FF',
    up: true as const,
  },
  {
    label: 'Merchant Promo Participation',
    value: '30 / 100',
    sub: 'Merchants with active promotions',
    footer: '30% merchant promo adoption rate',
    icon: Tag,
    color: '#D97706',
    bg: '#FFFBEB',
    up: true as const,
  },
  {
    label: 'Campaign Budget Used',
    value: 'MMK 173.0M',
    sub: 'of MMK 280.0M total budget',
    footer: '62% utilization across all campaigns',
    icon: DollarSign,
    color: '#7C3AED',
    bg: '#F5F3FF',
    up: null as null,
  },
  {
    label: 'Coupons Redeemed',
    value: '41,836',
    sub: 'of 58,420 claimed',
    footer: '71.6% redemption rate this month',
    icon: Ticket,
    color: '#059669',
    bg: '#ECFDF3',
    up: true as const,
  },
  {
    label: 'Welcome Rewards Performance',
    value: '8,140',
    sub: 'New users converted',
    footer: '83.1% conv. rate · MMK 4.9M revenue',
    icon: Ticket,
    color: '#BE123C',
    bg: '#FFF1F3',
    up: true as const,
  },
]

const campaignRows = [
  { name: 'Summer Escape',       merchants: 28, claimed: 12400, redeemed: 8960,  budget: 'MMK 42.0M', status: 'active'    },
  { name: 'Thingyan Special',    merchants: 45, claimed: 22000, redeemed: 15840, budget: 'MMK 78.0M', status: 'active'    },
  { name: 'Weekend Flash Sale',  merchants: 12, claimed: 8200,  redeemed: 5740,  budget: 'MMK 24.0M', status: 'active'    },
  { name: 'New User Welcome',    merchants: 30, claimed: 15820, redeemed: 11296, budget: 'MMK 29.0M', status: 'paused'    },
  { name: 'Early Bird 2025',     merchants: 18, claimed: 4200,  redeemed: 3024,  budget: 'MMK 18.0M', status: 'scheduled' },
]

const couponStats = [
  { label: 'Coupons Issued',    value: '80,000',     color: '#1664FF' },
  { label: 'Coupons Claimed',   value: '58,420',     color: '#D97706' },
  { label: 'Coupons Redeemed',  value: '41,836',     color: '#059669' },
  { label: 'Discount Given',    value: 'MMK 86.4M',  color: '#DC2626' },
]

// ── Chart data ────────────────────────────────────────────────────────────────

const revenueData = [38.2, 34.5, 42.1, 48.7, 52.3, 55.8, 61.4, 67.2, 63.8, 71.5, 68.9, 74.3]
const bookingData = [2840, 2620, 3180, 3840, 4120, 4580, 5240, 5820, 5480, 6320, 5980, 6410]
const merchantGrowth = [12, 14, 14, 16, 17, 19, 21, 23, 24, 26, 28, 30]
const refundData = [38, 42, 31, 44, 39, 51, 46, 58, 43, 62, 54, 67]
const affiliateData = [4, 6, 5, 7, 8, 9, 11, 13, 12, 15, 14, 17]
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildPath(
  data: number[], w: number, h: number, pad = 14,
): { line: string; area: string; pts: [number, number][] } {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const uw = (w - pad * 2) / (data.length - 1)
  const pts: [number, number][] = data.map((v, i) => [
    pad + i * uw,
    pad + (1 - (v - min) / range) * (h - pad * 2),
  ])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`
  return { line, area, pts }
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const { line, area } = buildPath(data, 80, 32, 4)
  const id = `sp_${color.replace('#', '')}`
  return (
    <svg viewBox="0 0 80 32" style={{ width: 80, height: 32, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function MiniChart({ data, color, w = 260, h = 64 }: { data: number[]; color: string; w?: number; h?: number }) {
  const { line, area } = buildPath(data, w, h)
  const id = `mc_${color.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[0.3, 0.6, 0.9].map((t) => (
        <line key={t} x1={14} y1={14 + (1 - t) * (h - 28)} x2={w - 14} y2={14 + (1 - t) * (h - 28)} stroke="#F1F5F9" strokeWidth="1" />
      ))}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// ── Sample queue data ─────────────────────────────────────────────────────────

const pendingVerifs = merchants.filter(m => m.verificationStatus === 'pending').slice(0, 6)

const reviewers = ['Zhang Wei', 'Li Min', 'Wang Fang', 'Chen Jing', 'Liu Yang']
const verifStatuses = ['Pending', 'Under Review', 'Resubmission']

// ── Activity feed ─────────────────────────────────────────────────────────────

const activities = [
  { type: 'Merchant Approved', msg: '"Suzhou Lakeside Boutique" successfully verified and activated', time: '6 min ago', color: '#059669', icon: CheckCircle },
  { type: 'Merchant Suspended', msg: 'MCH-0026 "Chongqing Skyline Hotel" suspended for policy violation', time: '14 min ago', color: '#DC2626', icon: AlertCircle },
  { type: 'Refund Approved', msg: 'Refund request #RF-0482 approved · MMK 1,680 refunded to guest', time: '31 min ago', color: '#2563EB', icon: RefreshCw },
  { type: 'Settlement Completed', msg: 'MMK 4.2M settlement cycle for November closed successfully', time: '1 hr ago', color: '#7C3AED', icon: DollarSign },
  { type: 'Affiliate Approved', msg: '@MichelleWanderlust (3.8M followers) application approved', time: '2 hr ago', color: '#0EA5E9', icon: Users2 },
  { type: 'Campaign Created', msg: '"Winter VIP Escape" campaign launched · 42 merchants enrolled', time: '3 hr ago', color: '#D97706', icon: Megaphone },
  { type: 'User Role Updated', msg: 'Agent Liu Yang promoted to Senior Reviewer', time: '4 hr ago', color: '#475569', icon: UserCog },
  { type: 'Platform Rule Published', msg: 'New "Response Time SLA" policy effective from Jan 1', time: '5 hr ago', color: '#1664FF', icon: FileText },
]

// ── System notifications ──────────────────────────────────────────────────────

const notifications = [
  { severity: 'danger', msg: '3 merchant documents expiring within 7 days', cta: 'Review' },
  { severity: 'warning', msg: '8 merchant verifications pending — oldest 5 days', cta: 'View Queue' },
  { severity: 'danger', msg: '2 affiliates flagged for suspected fraud activity', cta: 'Investigate' },
  { severity: 'warning', msg: 'Settlement cycle closes Dec 31 · MMK 6.2M pending', cta: 'Reconcile' },
  { severity: 'info', msg: '5 affiliate withdrawal requests awaiting approval', cta: 'Approve' },
  { severity: 'warning', msg: 'Campaign "Mid-Week Rate" paused — review needed', cta: 'Review' },
  { severity: 'info', msg: 'System maintenance Dec 28, 02:00–04:00 CST', cta: 'Details' },
]

// ── Components ────────────────────────────────────────────────────────────────

function KpiCard({ k }: { k: typeof kpis[0] }) {
  const Icon = k.icon
  return (
    <div className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, background: k.bg }}>
          <Icon size={15} color={k.color} />
        </div>
        <Spark data={k.spark} color={k.color} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace', lineHeight: 1 }}>{k.value}</div>
      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginTop: 3, marginBottom: 4 }}>{k.label}</div>
      <div className="flex items-center gap-1">
        {k.up === true && <TrendingUp size={11} color="#059669" />}
        {k.up === false && <TrendingDown size={11} color="#DC2626" />}
        {k.pct && (
          <span className="rounded px-1" style={{ fontSize: 10, fontWeight: 600, background: k.up === true ? '#ECFDF3' : k.up === false ? '#FFF1F2' : '#F8FAFC', color: k.up === true ? '#059669' : k.up === false ? '#DC2626' : '#94A3B8' }}>
            {k.pct}
          </span>
        )}
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{k.change}</span>
      </div>
    </div>
  )
}

function CampaignKpiCard({ k }: { k: typeof campaignKpis[0] }) {
  const Icon = k.icon
  return (
    <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, background: k.bg }}>
          <Icon size={16} color={k.color} />
        </div>
        {k.up !== null && (
          <span className="flex items-center gap-0.5 rounded px-1.5" style={{ fontSize: 11, fontWeight: 600, height: 20, background: k.up === true ? '#ECFDF3' : '#FFF1F2', color: k.up === true ? '#059669' : '#DC2626' }}>
            {k.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {k.up ? 'Up' : 'Down'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.01em' }}>{k.value}</div>
      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginTop: 3 }}>{k.sub}</div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F8FAFC' }}>
        <span style={{ fontSize: 11, color: k.color, fontWeight: 500 }}>{k.footer}</span>
      </div>
    </div>
  )
}

// ── Donut chart (SVG) for Promotion Adoption ──────────────────────────────────

function DonutChart({ pct, color }: { pct: number; color: string }) {
  const r = 36, cx = 44, cy = 44
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg viewBox="0 0 88 88" style={{ width: 88, height: 88, flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={10} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#1A2332" fontSize={14} fontWeight="700" fontFamily="monospace">{pct}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#94A3B8" fontSize={8}>Adoption</text>
    </svg>
  )
}

export default function DashboardPage({ onNavigate }: Props) {
  const { pts: revPts, line: revLine, area: revArea } = buildPath(revenueData, 500, 128)

  const notifColors = {
    danger: { icon: <AlertCircle size={12} color="#DC2626" />, bg: '#FFF5F5', border: '#FED7D7' },
    warning: { icon: <AlertTriangle size={12} color="#D97706" />, bg: '#FFFBEB', border: '#FDE68A' },
    info: { icon: <CheckCircle size={12} color="#2563EB" />, bg: '#EFF6FF', border: '#BFDBFE' },
  }

  const campStatusCfg: Record<string, { bg: string; color: string }> = {
    active:    { bg: '#ECFDF3', color: '#027A48' },
    paused:    { bg: '#FFFBEB', color: '#B54708' },
    scheduled: { bg: '#EFF6FF', color: '#1D4ED8' },
    ended:     { bg: '#F1F5F9', color: '#475569' },
  }

  return (
    <div className="p-5" style={{ minWidth: 1060 }}>

      {/* 8 KPI cards — 4+4 layout */}
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {kpis.slice(0, 4).map(k => <KpiCard key={k.label} k={k} />)}
      </div>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {kpis.slice(4).map(k => <KpiCard key={k.label} k={k} />)}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>

        {/* Revenue trend — wide */}
        <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Platform Revenue Trend</h3>
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Monthly gross revenue (MMK B) · 2024</p>
            </div>
            <button className="flex items-center gap-1 rounded px-2 py-1" style={{ fontSize: 12, color: '#1664FF' }}
              onClick={() => onNavigate('reports')}
              onMouseEnter={e => (e.currentTarget.style.background = '#EEF4FF')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              Full Report <ArrowUpRight size={12} />
            </button>
          </div>
          <svg viewBox="0 0 500 128" className="w-full" style={{ height: 128, display: 'block' }}>
            <defs>
              <linearGradient id="revGradMain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1664FF" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#1664FF" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map(t => (
              <line key={t} x1={14} y1={14 + (1 - t) * 100} x2={486} y2={14 + (1 - t) * 100} stroke="#F1F5F9" strokeWidth="1" />
            ))}
            <path d={revArea} fill="url(#revGradMain)" />
            <path d={revLine} fill="none" stroke="#1664FF" strokeWidth="2" strokeLinejoin="round" />
            {revPts.map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={3} fill="#1664FF" />
                <text x={x} y={126} textAnchor="middle" fill="#CBD5E1" fontSize={9}>{months[i]}</text>
              </g>
            ))}
          </svg>
        </div>

        {/* Booking Trend */}
        <div className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Booking Trend</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>bookings / month</div>
          <MiniChart data={bookingData} color="#059669" h={68} />
        </div>

        {/* Merchant Growth */}
        <div className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Merchant Growth</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>total active merchants</div>
          <MiniChart data={merchantGrowth} color="#7C3AED" h={68} />
        </div>
      </div>

      {/* Second chart row */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Refund Trend</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>refund requests / month</div>
          <MiniChart data={refundData} color="#DC2626" h={64} />
        </div>
        <div className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Settlement Trend</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>MMK M settled / month</div>
          <MiniChart data={revenueData.map(v => v * 0.86)} color="#D97706" h={64} />
        </div>
        <div className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Affiliate Growth</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>total active affiliates</div>
          <MiniChart data={affiliateData} color="#0EA5E9" h={64} />
        </div>
      </div>

      {/* Bottom row: queue + activity + notifications */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Pending Verification Queue */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Merchant Verification Queue</h3>
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Requires review · {pendingVerifs.length} merchants</p>
            </div>
            <button onClick={() => onNavigate('verification')} className="flex items-center gap-1 rounded px-2 py-1" style={{ fontSize: 12, color: '#1664FF' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EEF4FF')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              View All <ChevronRight size={12} />
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Merchant', 'Category', 'City', 'Submitted', 'Status', 'Reviewer', 'Action'].map(h => (
                  <th key={h} className="text-left px-3" style={{ height: 32, fontSize: 10, fontWeight: 600, color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingVerifs.map((m, i) => {
                const status = verifStatuses[i % verifStatuses.length]
                const reviewer = reviewers[i % reviewers.length]
                const statusCfg: Record<string, { bg: string; color: string }> = {
                  'Pending': { bg: '#FFFBEB', color: '#B45308' },
                  'Under Review': { bg: '#EFF6FF', color: '#1D4ED8' },
                  'Resubmission': { bg: '#FFF7ED', color: '#C2410C' },
                }
                const sc = statusCfg[status]
                return (
                  <tr key={m.id} style={{ borderBottom: i < pendingVerifs.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 40 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#1A2332' }}>{m.merchantName.slice(0, 18)}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{m.id}</div>
                    </td>
                    <td className="px-3" style={{ fontSize: 10, color: '#64748B', textTransform: 'capitalize' }}>{m.category.replace('_', ' ')}</td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B' }}>{m.city}</td>
                    <td className="px-3" style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{m.joinDate}</td>
                    <td className="px-3">
                      <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 10, height: 18, background: sc.bg, color: sc.color }}>{status}</span>
                    </td>
                    <td className="px-3" style={{ fontSize: 10, color: '#475569' }}>{reviewer.split(' ')[0]}</td>
                    <td className="px-3">
                      <button onClick={() => onNavigate('verification')} className="rounded px-2 font-medium" style={{ height: 22, fontSize: 10, background: '#EEF4FF', color: '#1664FF' }}>Review</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Right column: activity + notifications */}
        <div className="flex flex-col gap-3">

          {/* Recent Activity */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Recent Activity</h3>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Last 24 hours</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activities.slice(0, 5).map((a, i) => {
                const Icon = a.icon
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 22, height: 22, background: `${a.color}14`, marginTop: 1 }}>
                      <Icon size={11} color={a.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 11, fontWeight: 500, color: a.color }}>{a.type}</div>
                      <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.4 }}>{a.msg}</p>
                      <p style={{ fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>{a.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* System Notifications — full width */}
          <div className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 8 }}>System Notifications</h3>
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {notifications.slice(0, 6).map((n, i) => {
                const nc = notifColors[n.severity as keyof typeof notifColors]
                return (
                  <div key={i} className="flex items-start gap-2 rounded px-2 py-1.5" style={{ background: nc.bg, border: `1px solid ${nc.border}` }}>
                    <div style={{ flexShrink: 0, marginTop: 1 }}>{nc.icon}</div>
                    <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.35, flex: 1 }}>{n.msg}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Campaign Performance Overview ────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #E3E8F0', paddingTop: 20 }}>

        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md flex items-center justify-center" style={{ width: 30, height: 30, background: '#F5F3FF' }}>
              <Megaphone size={14} color="#7C3AED" />
            </div>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>Campaign Performance Overview</h2>
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Active promotions, coupon tracking, and merchant adoption · Dec 2024</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('campaigns-analytics')}
            className="flex items-center gap-1 rounded px-2.5 py-1.5 font-medium"
            style={{ fontSize: 12, color: '#7C3AED', border: '1px solid #DDD6FE', background: '#FAFAFA' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.borderColor = '#C4B5FD' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.borderColor = '#DDD6FE' }}>
            Full Analytics <ArrowUpRight size={12} />
          </button>
        </div>

        {/* 4 Campaign KPI cards */}
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {campaignKpis.map(k => <CampaignKpiCard key={k.label} k={k} />)}
        </div>

        {/* Campaign table + sidebar (Promotion Adoption + Coupon Stats) */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>

          {/* Campaign Performance Table */}
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Campaign Performance</h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Coupon claims, redemptions, and budget utilization</p>
              </div>
              <button onClick={() => onNavigate('campaigns')} className="flex items-center gap-1 rounded px-2 py-1" style={{ fontSize: 12, color: '#1664FF' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#EEF4FF')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                Manage <ChevronRight size={12} />
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                  {['Campaign Name', 'Merchants', 'Coupons Claimed', 'Coupons Redeemed', 'Redemption Rate', 'Budget Used (MMK)', 'Status'].map(h => (
                    <th key={h} className="text-left px-3" style={{ height: 34, fontSize: 10, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((c, i) => {
                  const rate = Math.round(c.redeemed / c.claimed * 100)
                  const sc = campStatusCfg[c.status]
                  return (
                    <tr key={c.name} style={{ borderBottom: i < campaignRows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-3" style={{ height: 42 }}>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{c.name}</span>
                        </div>
                      </td>
                      <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{c.merchants}</td>
                      <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{c.claimed.toLocaleString()}</td>
                      <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#059669', fontFamily: 'monospace' }}>{c.redeemed.toLocaleString()}</td>
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 44, height: 5, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${rate}%`, height: '100%', background: rate >= 70 ? '#059669' : rate >= 50 ? '#D97706' : '#DC2626', borderRadius: 9999 }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{rate}%</span>
                        </div>
                      </td>
                      <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{c.budget}</td>
                      <td className="px-3">
                        <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 10, height: 18, background: sc.bg, color: sc.color }}>{c.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Right sidebar: Promotion Adoption + Coupon Statistics stacked */}
          <div className="flex flex-col gap-3">

            {/* Promotion Adoption */}
            <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: '#1A2332' }}>Promotion Adoption</h3>
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Merchants running self-promos</p>
                </div>
              </div>

              {/* Donut + legend */}
              <div className="flex items-center gap-4">
                <DonutChart pct={30} color="#1664FF" />
                <div className="flex-1 space-y-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: '#1664FF', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#475569' }}>Running Promos</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1664FF', fontFamily: 'monospace' }}>30</span>
                    </div>
                    <div style={{ height: 5, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ width: '30%', height: '100%', background: '#1664FF', borderRadius: 9999 }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: '#E3E8F0', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#475569' }}>Not Running</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace' }}>70</span>
                    </div>
                    <div style={{ height: 5, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ width: '70%', height: '100%', background: '#E3E8F0', borderRadius: 9999 }} />
                    </div>
                  </div>
                  <div className="rounded px-2 py-1.5 mt-2" style={{ background: '#EEF4FF', border: '1px solid #BFDBFE' }}>
                    <div style={{ fontSize: 10, color: '#64748B' }}>Total Merchants</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1664FF', fontFamily: 'monospace' }}>100</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #F8FAFC' }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Adoption Rate</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1664FF', fontFamily: 'monospace' }}>30%</span>
              </div>
            </div>

            {/* Coupon Statistics */}
            <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 12 }}>Coupon Statistics</h3>
              <div className="space-y-2.5">
                {couponStats.map((s, i) => {
                  const pcts = [100, 73, 52, null]
                  const p = pcts[i]
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontSize: 11, color: '#64748B' }}>{s.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</span>
                      </div>
                      {p !== null && (
                        <div style={{ height: 4, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ width: `${p}%`, height: '100%', background: s.color, borderRadius: 9999, opacity: 0.8 }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-3 rounded px-2 py-1.5" style={{ borderTop: '1px solid #F8FAFC', background: '#F8FAFC' }}>
                <Ticket size={11} color="#059669" />
                <span style={{ fontSize: 11, color: '#475569' }}>71.6% overall redemption rate this month</span>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}

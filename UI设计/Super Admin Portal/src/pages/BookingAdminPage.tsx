import { useState, useRef, useEffect } from 'react'
import { Search, Download, Eye, ChevronLeft, ChevronRight, Filter, Calendar, CheckCircle, DollarSign, MoreHorizontal, FileText, Receipt, Clock, XCircle, Info, CheckCircle2, AlertCircle, CircleDot, StickyNote, ShieldCheck, RotateCcw, UserCheck, LogIn, LogOut, RefreshCw, Banknote, BadgeCheck, CircleX, Landmark, Send, Flag } from 'lucide-react'
import { bookings } from '../data/platformData'
import type { Booking, BookingStatus, RefundStatus, SettlementStatus } from '../data/platformData'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'
import Drawer from '../components/Drawer'
import Dialog from '../components/Dialog'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

interface MenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
}

const tabPageConfig: Record<string, { title: string; subtitle: string }> = {
  'bookings-admin': { title: 'All Bookings', subtitle: 'Manage all platform bookings, refunds, and settlements' },
  'bookings-refunds': { title: 'Refund Requests', subtitle: 'Review and process guest refund requests' },
  'bookings-settlements': { title: 'Settlement & Reconciliation', subtitle: 'Financial settlements, payouts, and reconciliation records' },
  'bookings-history': { title: 'Booking History', subtitle: 'Completed and historical booking records with full audit trail' },
}

function BookingBadge({ status }: { status: BookingStatus }) {
  const cfg = {
    confirmed: { bg: '#ECFDF3', color: '#027A48' }, completed: { bg: '#F1F5F9', color: '#334155' },
    cancelled: { bg: '#FFF1F3', color: '#C01048' }, no_show: { bg: '#F8FAFC', color: '#64748B' },
    checked_in: { bg: '#EFF6FF', color: '#1D4ED8' },
  }
  const c = cfg[status]
  const label = status.replace('_', '-')
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20, textTransform: 'capitalize' }}>{label}</span>
}

function RefundBadge({ status }: { status: RefundStatus }) {
  if (status === 'none') return <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
  const cfg = { requested: { bg: '#FFFAEB', color: '#B54708' }, approved: { bg: '#ECFDF3', color: '#027A48' }, rejected: { bg: '#FFF1F3', color: '#C01048' }, processed: { bg: '#F1F5F9', color: '#334155' } }
  const c = cfg[status as keyof typeof cfg] ?? cfg.requested
  return <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{status}</span>
}

function SettleBadge({ status }: { status: SettlementStatus }) {
  const cfg = { settled: { bg: '#ECFDF3', color: '#027A48' }, pending: { bg: '#FFFAEB', color: '#B54708' }, processing: { bg: '#EFF6FF', color: '#1D4ED8' }, overdue: { bg: '#FFF1F3', color: '#C01048' } }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{status}</span>
}

function InvoiceBadge({ status }: { status: 'Issued' | 'Pending' | 'Overdue' }) {
  const cfg = {
    Issued: { bg: '#ECFDF3', color: '#027A48' },
    Pending: { bg: '#FFFAEB', color: '#B54708' },
    Overdue: { bg: '#FFF1F3', color: '#C01048' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{status}</span>
}

function ReconciliationBadge({ status }: { status: 'Matched' | 'Unmatched' | 'In Review' }) {
  const cfg = {
    Matched: { bg: '#ECFDF3', color: '#027A48' },
    'In Review': { bg: '#EFF6FF', color: '#1D4ED8' },
    Unmatched: { bg: '#FFF7ED', color: '#C2410C' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{status}</span>
}

function PriorityBadge({ priority }: { priority: 'High' | 'Medium' | 'Low' }) {
  const cfg = {
    High: { bg: '#FFF1F3', color: '#C01048' },
    Medium: { bg: '#FFFBEB', color: '#B45308' },
    Low: { bg: '#ECFDF3', color: '#027A48' },
  }
  const c = cfg[priority]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{priority}</span>
}

function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center justify-center rounded transition-colors"
        style={{ width: 28, height: 28, color: '#94A3B8' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 rounded-lg py-1"
          style={{ top: 32, minWidth: 200, background: '#fff', border: '1px solid #E3E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
              style={{ fontSize: 12, color: item.danger ? '#DC2626' : '#374151' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = item.danger ? '#FFF1F3' : '#F8FAFC' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {item.icon && <span style={{ opacity: 0.6 }}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysFromNow(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function deriveInvoiceStatus(b: Booking): 'Issued' | 'Pending' | 'Overdue' {
  if (b.settlementStatus === 'settled') return 'Issued'
  if (b.settlementStatus === 'overdue') return 'Overdue'
  return 'Pending'
}

function deriveReconciliationStatus(b: Booking): 'Matched' | 'Unmatched' | 'In Review' {
  if (b.settlementStatus === 'settled') return 'Matched'
  if (b.settlementStatus === 'processing') return 'In Review'
  return 'Unmatched'
}

function deriveRefundReason(b: Booking): string {
  if (b.bookingStatus === 'cancelled') return 'Guest Cancellation'
  if (b.bookingStatus === 'no_show') return 'No Show — Policy Refund'
  return 'Service Issue'
}

function deriveRefundMethod(idx: number): string {
  const methods = ['Original Payment', 'Bank Transfer', 'Platform Credit'] as const
  return methods[idx % 3]
}

function derivePriority(b: Booking): 'High' | 'Medium' | 'Low' {
  if (b.amount >= 3000) return 'High'
  if (b.amount >= 1000) return 'Medium'
  return 'Low'
}

function SlaTimer({ createdAt }: { createdAt: string }) {
  const deadline = addDays(createdAt, 5)
  const remaining = daysFromNow(deadline)
  let color = '#059669'
  let label = `${remaining}d left`
  if (remaining <= 0) { color = '#DC2626'; label = 'Overdue' }
  else if (remaining <= 2) { color = '#D97706' }
  return <span style={{ fontSize: 12, fontFamily: 'monospace', color, fontWeight: 600 }}>{label}</span>
}

export default function BookingAdminPage({ tab, showToast }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [drawerBooking, setDrawerBooking] = useState<Booking | null>(null)
  const [refundTarget, setRefundTarget] = useState<Booking | null>(null)
  const [settleTarget, setSettleTarget] = useState<Booking | null>(null)
  const [markPaidTarget, setMarkPaidTarget] = useState<Booking | null>(null)
  const [settleDrawer, setSettleDrawer] = useState<Booking | null>(null)
  const [reconcileTarget, setReconcileTarget] = useState<Booking | null>(null)
  const [noteValue, setNoteValue] = useState('')
  const [timelineDrawer, setTimelineDrawer] = useState<Booking | null>(null)
  const [approveRefundTarget, setApproveRefundTarget] = useState<Booking | null>(null)
  const [rejectRefundTarget, setRejectRefundTarget] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(false)
  const perPage = 10

  const pageConfig = tabPageConfig[tab] ?? tabPageConfig['bookings-admin']

  const filtered = bookings.filter((b) => {
    const matchTab = tab === 'bookings-admin' ? true :
      tab === 'bookings-refunds' ? b.refundStatus === 'requested' :
      tab === 'bookings-settlements' ? true :
      tab === 'bookings-history' ? b.bookingStatus === 'completed' || b.bookingStatus === 'cancelled' : true
    const matchSearch = !search || b.id.includes(search) || b.guestName.toLowerCase().includes(search.toLowerCase()) ||
      b.merchantName.toLowerCase().includes(search.toLowerCase()) || b.hotelName.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // ── Stats per tab ──────────────────────────────────────────────────────────
  const adminStats = [
    { label: "Today's Bookings", value: 142, color: '#1664FF' },
    { label: 'Completed', value: bookings.filter(b => b.bookingStatus === 'completed').length, color: '#059669' },
    { label: 'Cancelled', value: bookings.filter(b => b.bookingStatus === 'cancelled').length, color: '#DC2626' },
    { label: 'Refund Requested', value: bookings.filter(b => b.refundStatus === 'requested').length, color: '#D97706' },
    { label: 'Pending Settlement', value: bookings.filter(b => b.settlementStatus === 'pending').length, color: '#7C3AED' },
  ]

  const settlementStats = [
    { label: 'Total Settlements', value: bookings.length, color: '#1664FF' },
    { label: 'Settled', value: bookings.filter(b => b.settlementStatus === 'settled').length, color: '#059669' },
    { label: 'Pending Payout', value: bookings.filter(b => b.settlementStatus === 'pending' || b.settlementStatus === 'processing').length, color: '#D97706' },
    { label: 'Overdue', value: bookings.filter(b => b.settlementStatus === 'overdue').length, color: '#DC2626' },
  ]

  const refundRows = bookings.filter(b => b.refundStatus === 'requested')
  const totalRefundAmount = refundRows.reduce((s, b) => s + (b.refundAmount ?? b.amount * 0.5), 0)
  const refundStats = [
    { label: 'Pending Refunds', value: refundRows.length, color: '#1664FF' },
    { label: 'Total Requested', value: `¥${Math.round(totalRefundAmount).toLocaleString()}`, color: '#D97706' },
    { label: 'Avg Processing Time', value: '3.2 days', color: '#059669' },
    { label: 'SLA Breaches', value: 2, color: '#DC2626' },
  ]

  const historyRows = bookings.filter(b => b.bookingStatus === 'completed' || b.bookingStatus === 'cancelled')
  const historyStats = [
    { label: 'Total Historical', value: historyRows.length, color: '#1664FF' },
    { label: 'Completed', value: historyRows.filter(b => b.bookingStatus === 'completed').length, color: '#059669' },
    { label: 'Cancelled', value: historyRows.filter(b => b.bookingStatus === 'cancelled').length, color: '#DC2626' },
    { label: 'With Refunds', value: historyRows.filter(b => b.refundStatus !== 'none').length, color: '#D97706' },
    { label: 'Settled', value: historyRows.filter(b => b.settlementStatus === 'settled').length, color: '#7C3AED' },
  ]

  const currentStats = tab === 'bookings-settlements' ? settlementStats
    : tab === 'bookings-refunds' ? refundStats
    : tab === 'bookings-history' ? historyStats
    : adminStats

  const statsGridCols = currentStats.length === 4 ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)'

  const handleConfirm = (onDone: () => void) => {
    setLoading(true)
    setTimeout(() => { setLoading(false); onDone() }, 800)
  }

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{pageConfig.title}</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{pageConfig.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
            <Calendar size={13} /> Date Range
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: statsGridCols }}>
        {currentStats.map((s) => (
          <div key={s.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search booking ID, guest name, merchant, hotel..." className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        {tab !== 'bookings-settlements' && (
          <>
            <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Booking Status</option><option>Confirmed</option><option>Completed</option><option>Cancelled</option></select>
            <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Refund Status</option><option>Requested</option><option>Approved</option><option>Processed</option></select>
          </>
        )}
        {tab === 'bookings-settlements' && (
          <>
            <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Settlement Status</option><option>Settled</option><option>Pending</option><option>Overdue</option></select>
            <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Invoice Status</option><option>Issued</option><option>Pending</option><option>Overdue</option></select>
          </>
        )}
        <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Settlement</option><option>Settled</option><option>Pending</option><option>Overdue</option></select>
        <span style={{ fontSize: 12, color: '#94A3B8' }}><Filter size={12} className="inline mr-1" />{total} results</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>

        {/* ── Settlement & Reconciliation Table ── */}
        {tab === 'bookings-settlements' && (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Settlement ID', 'Merchant', 'Settlement Period', 'Gross Revenue', 'Commission', 'Net Payout', 'Settlement Status', 'Payment Date', 'Invoice Status', 'Reconciliation', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => {
                const invoiceStatus = deriveInvoiceStatus(b)
                const reconcStatus = deriveReconciliationStatus(b)
                const paymentDate = addDays(b.checkOut, 7)
                const netPayout = b.amount - b.commission
                return (
                  <tr key={b.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 44 }}>
                      <span style={{ fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 500 }}>SET-{b.id}</span>
                    </td>
                    <td className="px-3">
                      <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }} className="max-w-[120px] truncate">{b.merchantName}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }} className="max-w-[120px] truncate">{b.hotelName}</div>
                    </td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {b.checkIn} – {b.checkOut}
                    </td>
                    <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ¥{b.amount.toLocaleString()}
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#C01048', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ¥{b.commission.toLocaleString()}
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#059669', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ¥{netPayout.toLocaleString()}
                    </td>
                    <td className="px-3"><SettleBadge status={b.settlementStatus} /></td>
                    <td className="px-3" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{paymentDate}</td>
                    <td className="px-3"><InvoiceBadge status={invoiceStatus} /></td>
                    <td className="px-3"><ReconciliationBadge status={reconcStatus} /></td>
                    <td className="px-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn title="View settlement details" onClick={() => { setSettleDrawer(b); setNoteValue('') }} color="#1664FF">
                          <Eye size={12} />
                        </ActionBtn>
                        <MoreMenu items={[
                          { label: 'Download Settlement Report', icon: <Download size={12} />, onClick: () => showToast('info', 'Download Started', `Settlement report for SET-${b.id} downloading.`) },
                          { label: 'Generate Invoice', icon: <FileText size={12} />, onClick: () => showToast('success', 'Invoice Generated', `Invoice for SET-${b.id} generated.`) },
                          { label: 'Mark as Paid', icon: <CheckCircle size={12} />, onClick: () => setMarkPaidTarget(b) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* ── Booking History Table ── */}
        {tab === 'bookings-history' && (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Booking ID', 'Guest', 'Merchant / Hotel', 'Amount', 'Commission', 'Booking Status', 'Refund Status', 'Settlement', 'Final Status', 'Refund Outcome', 'Settlement Outcome', 'Completed', 'TL', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-3" style={{ height: 44 }}><span style={{ fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 500 }}>{b.id}</span></td>
                  <td className="px-3">
                    <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }}>{b.guestName}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.guestPhone}</div>
                  </td>
                  <td className="px-3">
                    <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }} className="max-w-[110px] truncate">{b.merchantName}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.roomType}</div>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>¥{b.amount.toLocaleString()}</td>
                  <td className="px-3" style={{ fontSize: 12, color: '#C01048', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>¥{b.commission.toLocaleString()}</td>
                  <td className="px-3"><BookingBadge status={b.bookingStatus} /></td>
                  <td className="px-3"><RefundBadge status={b.refundStatus} /></td>
                  <td className="px-3"><SettleBadge status={b.settlementStatus} /></td>
                  <td className="px-3"><BookingBadge status={b.bookingStatus} /></td>
                  <td className="px-3"><RefundBadge status={b.refundStatus} /></td>
                  <td className="px-3"><SettleBadge status={b.settlementStatus} /></td>
                  <td className="px-3" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{b.checkOut}</td>
                  <td className="px-3">
                    <button
                      title="View Timeline"
                      onClick={() => setTimelineDrawer(b)}
                      className="flex items-center justify-center rounded-md"
                      style={{ width: 28, height: 28, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', flexShrink: 0 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#DBEAFE' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#EFF6FF' }}
                    >
                      <Clock size={13} />
                    </button>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn title="View booking details" onClick={() => setDrawerBooking(b)} color="#1664FF"><Eye size={12} /></ActionBtn>
                      <MoreMenu items={[
                        { label: 'View Timeline', icon: <Clock size={12} />, onClick: () => setTimelineDrawer(b) },
                        { label: 'Export Record', icon: <Download size={12} />, onClick: () => showToast('info', 'Export', `Exporting record for ${b.id}`) },
                        { label: 'View Related Settlement', icon: <Receipt size={12} />, onClick: () => showToast('info', 'Settlement', `Viewing settlement for ${b.id}`) },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── Refund Requests Table ── */}
        {tab === 'bookings-refunds' && (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Booking ID', 'Guest', 'Merchant', 'Refund Reason', 'Requested Amount', 'Requested By', 'Refund Method', 'Priority', 'SLA Timer', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => {
                const reason = deriveRefundReason(b)
                const requestedAmount = b.refundAmount ?? Math.round(b.amount * 0.5)
                const refundMethod = deriveRefundMethod(i)
                const priority = derivePriority(b)
                return (
                  <tr key={b.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 44 }}><span style={{ fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 500 }}>{b.id}</span></td>
                    <td className="px-3">
                      <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }}>{b.guestName}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.guestPhone}</div>
                    </td>
                    <td className="px-3">
                      <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }} className="max-w-[110px] truncate">{b.merchantName}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }} className="max-w-[110px] truncate">{b.hotelName}</div>
                    </td>
                    <td className="px-3">
                      <span style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>{reason}</span>
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#D97706', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      ¥{requestedAmount.toLocaleString()}
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#64748B' }}>Guest</td>
                    <td className="px-3" style={{ fontSize: 12, color: '#64748B' }}>{refundMethod}</td>
                    <td className="px-3"><PriorityBadge priority={priority} /></td>
                    <td className="px-3"><SlaTimer createdAt={b.createdAt} /></td>
                    <td className="px-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn onClick={() => setDrawerBooking(b)} color="#1664FF"><Eye size={12} /></ActionBtn>
                        <MoreMenu items={[
                          { label: 'Approve Refund', icon: <CheckCircle size={12} />, onClick: () => setApproveRefundTarget(b) },
                          { label: 'Reject Refund', icon: <XCircle size={12} />, onClick: () => setRejectRefundTarget(b), danger: true },
                          { label: 'Request Additional Info', icon: <Info size={12} />, onClick: () => showToast('info', 'Info Requested', `Additional info requested for ${b.id}`) },
                          { label: 'View Booking', icon: <Eye size={12} />, onClick: () => showToast('info', 'Booking', `Viewing booking ${b.id}`) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* ── All Bookings Table (default) ── */}
        {tab === 'bookings-admin' && (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Booking ID', 'Guest', 'Merchant / Hotel', 'Amount', 'Commission', 'Booking Status', 'Refund Status', 'Settlement', 'Channel', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-3" style={{ height: 44 }}><span style={{ fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 500 }}>{b.id}</span></td>
                  <td className="px-3">
                    <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }}>{b.guestName}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.guestPhone}</div>
                  </td>
                  <td className="px-3">
                    <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }} className="max-w-[130px] truncate">{b.merchantName}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{b.roomType}</div>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>¥{b.amount.toLocaleString()}</td>
                  <td className="px-3" style={{ fontSize: 12, color: '#C01048', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>¥{b.commission.toLocaleString()}</td>
                  <td className="px-3"><BookingBadge status={b.bookingStatus} /></td>
                  <td className="px-3"><RefundBadge status={b.refundStatus} /></td>
                  <td className="px-3"><SettleBadge status={b.settlementStatus} /></td>
                  <td className="px-3" style={{ fontSize: 12, color: '#64748B' }}>{b.channel}</td>
                  <td className="px-3" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{b.createdAt.slice(0, 10)}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn onClick={() => setDrawerBooking(b)} color="#1664FF"><Eye size={12} /></ActionBtn>
                      {b.refundStatus === 'requested' && <ActionBtn onClick={() => setRefundTarget(b)} color="#D97706"><CheckCircle size={12} /></ActionBtn>}
                      {(b.settlementStatus === 'pending' || b.settlementStatus === 'processing') && <ActionBtn onClick={() => setSettleTarget(b)} color="#059669"><DollarSign size={12} /></ActionBtn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min(start + 1, total)}–{Math.min(start + perPage, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: Math.min(totalPages, 6) }).map((_, i) => <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>{i + 1}</PagBtn>)}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>

      {/* ── Booking Detail Drawer ── */}
      <Drawer open={!!drawerBooking} onClose={() => setDrawerBooking(null)} title={`Booking ${drawerBooking?.id}`} subtitle={`${drawerBooking?.merchantName} · ${drawerBooking?.checkIn} to ${drawerBooking?.checkOut}`} width={600}>
        {drawerBooking && (
          <div className="space-y-5">
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Booking Timeline</h4>
              <div className="relative pl-5" style={{ borderLeft: '2px solid #E3E8F0' }}>
                {[
                  { label: 'Booking Created', date: drawerBooking.createdAt, color: '#1664FF' },
                  { label: 'Payment Received', date: drawerBooking.createdAt, color: '#059669' },
                  { label: drawerBooking.bookingStatus === 'confirmed' ? 'Awaiting Check-in' : drawerBooking.bookingStatus === 'checked_in' ? 'Guest Checked In' : 'Booking Completed', date: drawerBooking.checkIn, color: drawerBooking.bookingStatus === 'confirmed' ? '#D97706' : '#059669' },
                ].map((t, i) => (
                  <div key={i} className="mb-3 relative">
                    <div className="absolute rounded-full" style={{ width: 10, height: 10, left: -22, top: 3, background: t.color }} />
                    <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{t.date}</div>
                    <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500 }}>{t.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <DrawerGrid>
              <DrawerField label="Guest Name" value={drawerBooking.guestName} />
              <DrawerField label="Guest Email" value={drawerBooking.guestEmail} />
              <DrawerField label="Guest Phone" value={drawerBooking.guestPhone} mono />
              <DrawerField label="Channel" value={drawerBooking.channel} />
              <DrawerField label="Room Type" value={drawerBooking.roomType} />
              <DrawerField label="Nights" value={String(drawerBooking.nights)} />
              <DrawerField label="Check-in" value={drawerBooking.checkIn} mono />
              <DrawerField label="Check-out" value={drawerBooking.checkOut} mono />
              <DrawerField label="Booking Amount" value={`¥${drawerBooking.amount.toLocaleString()}`} />
              <DrawerField label="Commission" value={`¥${drawerBooking.commission.toLocaleString()} (${(drawerBooking.commission / drawerBooking.amount * 100).toFixed(0)}%)`} />
              <DrawerField label="Booking Status" value={drawerBooking.bookingStatus.replace('_', '-')} />
              <DrawerField label="Settlement Status" value={drawerBooking.settlementStatus} />
              {drawerBooking.promotionCode && <DrawerField label="Promo Code Applied" value={drawerBooking.promotionCode} mono />}
              {drawerBooking.refundStatus !== 'none' && <DrawerField label="Refund Status" value={drawerBooking.refundStatus} />}
              {drawerBooking.refundAmount && <DrawerField label="Refund Amount" value={`¥${drawerBooking.refundAmount.toLocaleString()}`} />}
            </DrawerGrid>
          </div>
        )}
      </Drawer>

      {/* ── Refund Review Dialog (All Bookings tab) ── */}
      <Dialog open={!!refundTarget} onClose={() => setRefundTarget(null)} variant="warning"
        title="Review Refund Request"
        message={`Approve refund of ¥${refundTarget?.amount.toLocaleString()} for booking ${refundTarget?.id} — ${refundTarget?.guestName}?`}
        confirmLabel="Approve Refund"
        onConfirm={() => handleConfirm(() => { setRefundTarget(null); showToast('success', 'Refund Approved', `Refund for ${refundTarget?.id} approved.`) })}
        loading={loading} />

      {/* ── Settlement Dialog (All Bookings tab) ── */}
      <Dialog open={!!settleTarget} onClose={() => setSettleTarget(null)} variant="confirm"
        title="Process Settlement"
        message={`Process settlement of ¥${settleTarget?.amount.toLocaleString()} for booking ${settleTarget?.id}?`}
        confirmLabel="Process Settlement"
        onConfirm={() => handleConfirm(() => { setSettleTarget(null); showToast('success', 'Settlement Processed', `Settlement for ${settleTarget?.id} completed.`) })}
        loading={loading} />

      {/* ── Mark as Paid Dialog (Settlements tab) ── */}
      <Dialog open={!!markPaidTarget} onClose={() => setMarkPaidTarget(null)} variant="confirm"
        title="Mark Settlement as Paid"
        message={`Mark settlement SET-${markPaidTarget?.id} as paid? Net payout ¥${markPaidTarget ? (markPaidTarget.amount - markPaidTarget.commission).toLocaleString() : ''} will be recorded.`}
        confirmLabel="Mark as Paid"
        onConfirm={() => handleConfirm(() => { setMarkPaidTarget(null); showToast('success', 'Marked as Paid', `Settlement SET-${markPaidTarget?.id} marked as paid.`) })}
        loading={loading} />

      {/* ── Approve Refund Dialog (Refunds tab) ── */}
      <Dialog open={!!approveRefundTarget} onClose={() => setApproveRefundTarget(null)} variant="success"
        title="Approve Refund Request"
        message={`Approve refund of ¥${approveRefundTarget ? Math.round((approveRefundTarget.refundAmount ?? approveRefundTarget.amount * 0.5)).toLocaleString() : ''} for booking ${approveRefundTarget?.id} — ${approveRefundTarget?.guestName}?`}
        confirmLabel="Approve Refund"
        onConfirm={() => handleConfirm(() => { setApproveRefundTarget(null); showToast('success', 'Refund Approved', `Refund for ${approveRefundTarget?.id} has been approved.`) })}
        loading={loading} />

      {/* ── Reject Refund Dialog (Refunds tab) ── */}
      <Dialog open={!!rejectRefundTarget} onClose={() => setRejectRefundTarget(null)} variant="danger"
        title="Reject Refund Request"
        message={`Reject the refund request for booking ${rejectRefundTarget?.id} — ${rejectRefundTarget?.guestName}? This action cannot be undone.`}
        confirmLabel="Reject Refund"
        onConfirm={() => handleConfirm(() => { setRejectRefundTarget(null); showToast('error', 'Refund Rejected', `Refund for ${rejectRefundTarget?.id} has been rejected.`) })}
        loading={loading} />

      {/* ── Booking Timeline Drawer ── */}
      <BookingTimelineDrawer booking={timelineDrawer} onClose={() => setTimelineDrawer(null)} />

      {/* ── Settlement Detail Drawer ── */}
      <SettlementDetailDrawer
        booking={settleDrawer}
        noteValue={noteValue}
        onNoteChange={setNoteValue}
        onClose={() => setSettleDrawer(null)}
        onReconcile={(b) => setReconcileTarget(b)}
        showToast={showToast}
      />

      {/* ── Reconcile Confirmation Dialog ── */}
      <Dialog
        open={!!reconcileTarget}
        onClose={() => setReconcileTarget(null)}
        variant="confirm"
        title="Mark as Reconciled"
        message={`Mark settlement SET-${reconcileTarget?.id} as reconciled? This will record the investigation notes and close the reconciliation review.`}
        confirmLabel="Mark as Reconciled"
        onConfirm={() => handleConfirm(() => { setReconcileTarget(null); setSettleDrawer(null); showToast('success', 'Settlement Reconciled', `SET-${reconcileTarget?.id} has been marked as reconciled.`) })}
        loading={loading}
      />
    </div>
  )
}

// ─── Booking Timeline Drawer ──────────────────────────────────────────────────

type TimelineEventKind =
  | 'created' | 'confirmed' | 'checkin' | 'checkout' | 'cancelled'
  | 'refund_requested' | 'refund_approved' | 'refund_rejected' | 'refund_processed'
  | 'settlement_generated' | 'settlement_paid' | 'completed'

interface TimelineEvent {
  kind: TimelineEventKind
  label: string
  date: string
  actor: string
  note?: string
  exception?: boolean
}

const timelineIconMap: Record<TimelineEventKind, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  created:              { icon: <Send size={13} />,        color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE' },
  confirmed:            { icon: <UserCheck size={13} />,   color: '#059669', bg: '#ECFDF3', border: '#A7F3D0' },
  checkin:              { icon: <LogIn size={13} />,        color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD' },
  checkout:             { icon: <LogOut size={13} />,       color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  cancelled:            { icon: <CircleX size={13} />,      color: '#DC2626', bg: '#FFF1F3', border: '#FECDD3' },
  refund_requested:     { icon: <RefreshCw size={13} />,   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  refund_approved:      { icon: <BadgeCheck size={13} />,  color: '#059669', bg: '#ECFDF3', border: '#A7F3D0' },
  refund_rejected:      { icon: <XCircle size={13} />,     color: '#DC2626', bg: '#FFF1F3', border: '#FECDD3' },
  refund_processed:     { icon: <Banknote size={13} />,    color: '#059669', bg: '#ECFDF3', border: '#A7F3D0' },
  settlement_generated: { icon: <FileText size={13} />,    color: '#475569', bg: '#F8FAFC', border: '#E3E8F0' },
  settlement_paid:      { icon: <Landmark size={13} />,    color: '#059669', bg: '#ECFDF3', border: '#A7F3D0' },
  completed:            { icon: <Flag size={13} />,         color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE' },
}

function buildTimeline(b: Booking): TimelineEvent[] {
  const events: TimelineEvent[] = []

  events.push({ kind: 'created', label: 'Booking Created', date: b.createdAt + ' 09:14', actor: b.guestName, note: `${b.nights} nights · ${b.roomType} · ¥${b.amount.toLocaleString()}` })
  events.push({ kind: 'confirmed', label: 'Merchant Confirmed', date: b.createdAt + ' 11:02', actor: b.merchantName, note: 'Booking confirmed and room reserved' })

  if (b.bookingStatus === 'cancelled') {
    events.push({ kind: 'cancelled', label: 'Booking Cancelled', date: b.checkIn + ' 08:30', actor: b.guestName, note: 'Guest requested cancellation before check-in', exception: true })
    if (b.refundStatus !== 'none') {
      events.push({ kind: 'refund_requested', label: 'Refund Requested', date: b.checkIn + ' 08:31', actor: b.guestName, note: `¥${(b.refundAmount ?? Math.round(b.amount * 0.8)).toLocaleString()} refund submitted`, exception: true })
    }
  } else {
    events.push({ kind: 'checkin', label: 'Guest Check-in', date: b.checkIn + ' 14:05', actor: b.guestName })
    events.push({ kind: 'checkout', label: 'Guest Check-out', date: b.checkOut + ' 11:30', actor: b.guestName, note: `Stay completed — ${b.nights} nights` })

    if (b.refundStatus !== 'none') {
      events.push({ kind: 'refund_requested', label: 'Refund Requested', date: b.checkOut + ' 13:45', actor: b.guestName, note: 'Service quality dispute filed', exception: true })
    }
  }

  if (b.refundStatus === 'approved' || b.refundStatus === 'processed') {
    events.push({ kind: 'refund_approved', label: 'Refund Approved', date: addDays(b.checkOut, 2) + ' 10:00', actor: 'Zhang Wei (Admin)', note: `¥${(b.refundAmount ?? Math.round(b.amount * 0.8)).toLocaleString()} approved for processing` })
  }
  if (b.refundStatus === 'rejected') {
    events.push({ kind: 'refund_rejected', label: 'Refund Rejected', date: addDays(b.checkOut, 2) + ' 10:00', actor: 'Li Min (Admin)', note: 'Insufficient grounds — policy non-applicable', exception: true })
  }
  if (b.refundStatus === 'processed') {
    events.push({ kind: 'refund_processed', label: 'Refund Disbursed', date: addDays(b.checkOut, 3) + ' 15:20', actor: 'System', note: 'Refund transferred to original payment method' })
  }

  events.push({ kind: 'settlement_generated', label: 'Settlement Generated', date: addDays(b.checkOut, 1) + ' 00:05', actor: 'System', note: `SET-${b.id} · Net payout ¥${(b.amount - b.commission).toLocaleString()}` })

  if (b.settlementStatus === 'settled') {
    events.push({ kind: 'settlement_paid', label: 'Settlement Paid', date: addDays(b.checkOut, 7) + ' 09:00', actor: 'Finance System', note: `¥${(b.amount - b.commission).toLocaleString()} transferred to merchant bank account` })
    events.push({ kind: 'completed', label: 'Booking Completed', date: addDays(b.checkOut, 7) + ' 09:01', actor: 'System' })
  } else if (b.settlementStatus === 'overdue') {
    events.push({ kind: 'settlement_generated', label: 'Settlement Overdue', date: addDays(b.checkOut, 10) + ' 00:00', actor: 'System', note: 'Payment not received — escalation triggered', exception: true })
  }

  return events.sort((a, z) => a.date.localeCompare(z.date))
}

function BookingTimelineDrawer({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const events = booking ? buildTimeline(booking) : []
  const hasExceptions = events.some(e => e.exception)

  return (
    <Drawer
      open={!!booking}
      onClose={onClose}
      title={`Booking Timeline · ${booking?.id ?? ''}`}
      subtitle={booking ? `${booking.merchantName} · ${booking.guestName} · ${booking.checkIn} → ${booking.checkOut}` : ''}
      width={560}
    >
      {booking && (
        <div>
          {/* Summary strip */}
          <div className="flex items-center gap-3 rounded-lg px-4 py-3 mb-5" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Booking Status</div>
              <BookingBadge status={booking.bookingStatus} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Refund</div>
              <RefundBadge status={booking.refundStatus} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Settlement</div>
              <SettleBadge status={booking.settlementStatus} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Events</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{events.length}</div>
            </div>
          </div>

          {/* Exception banner */}
          {hasExceptions && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <AlertCircle size={13} color="#D97706" />
              <span style={{ fontSize: 12, color: '#92400E' }}>
                This booking contains exceptions — cancellation, refund, or settlement issue detected.
              </span>
            </div>
          )}

          {/* Timeline */}
          <div className="relative">
            {/* Vertical rail */}
            <div className="absolute" style={{ left: 19, top: 16, bottom: 16, width: 2, background: '#E3E8F0' }} />

            <div className="space-y-1">
              {events.map((ev, idx) => {
                const cfg = timelineIconMap[ev.kind]
                const isLast = idx === events.length - 1
                return (
                  <div key={idx} className="relative flex gap-3" style={{ paddingBottom: isLast ? 0 : 4 }}>
                    {/* Icon node */}
                    <div
                      className="relative z-10 flex items-center justify-center flex-shrink-0 rounded-full"
                      style={{ width: 38, height: 38, background: ev.exception ? '#FFF1F3' : cfg.bg, border: `2px solid ${ev.exception ? '#FECDD3' : cfg.border}`, color: ev.exception ? '#DC2626' : cfg.color }}
                    >
                      {ev.exception
                        ? <AlertCircle size={13} color="#DC2626" />
                        : cfg.icon}
                    </div>

                    {/* Content card */}
                    <div
                      className="flex-1 rounded-lg px-3 py-2.5 mb-1"
                      style={{
                        background: ev.exception ? '#FFFBF9' : '#fff',
                        border: `1px solid ${ev.exception ? '#FECDD3' : '#F1F5F9'}`,
                        marginTop: 4,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: ev.exception ? '#DC2626' : '#1A2332' }}>
                            {ev.label}
                          </div>
                          {ev.note && (
                            <div style={{ fontSize: 12, color: ev.exception ? '#C01048' : '#64748B', marginTop: 2, lineHeight: 1.5 }}>
                              {ev.note}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{ev.date}</span>
                            <span style={{ fontSize: 11, color: '#CBD5E1' }}>·</span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-1.5"
                              style={{ fontSize: 11, height: 18, background: ev.actor === 'System' || ev.actor === 'Finance System' ? '#F1F5F9' : '#EEF4FF', color: ev.actor === 'System' || ev.actor === 'Finance System' ? '#64748B' : '#1664FF' }}
                            >
                              {ev.actor}
                            </span>
                          </div>
                        </div>
                        {/* Status chip for final events */}
                        {(ev.kind === 'completed' || ev.kind === 'settlement_paid' || ev.kind === 'refund_approved') && (
                          <CheckCircle2 size={16} color="#059669" className="flex-shrink-0 mt-0.5" />
                        )}
                        {ev.exception && (
                          <AlertCircle size={16} color="#DC2626" className="flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
            <button
              onClick={() => {/* export */}}
              className="flex items-center gap-1.5 rounded-md px-3 font-medium"
              style={{ height: 32, fontSize: 12, color: '#475569', background: '#fff', border: '1px solid #E3E8F0' }}>
              <Download size={13} /> Export Audit Log
            </button>
            <span style={{ fontSize: 11, color: '#CBD5E1', marginLeft: 'auto' }}>
              {events.length} events · Last updated {events[events.length - 1]?.date.slice(0, 10)}
            </span>
          </div>
        </div>
      )}
    </Drawer>
  )
}

// ─── Settlement Detail Drawer ─────────────────────────────────────────────────

type RowStatus = 'match' | 'mismatch' | 'pending'

interface ReconcRowData {
  label: string
  expected: string
  actual: string
  status: RowStatus
}

function RowIcon({ s }: { s: RowStatus }) {
  if (s === 'match')    return <CheckCircle2 size={14} color="#059669" />
  if (s === 'mismatch') return <AlertCircle  size={14} color="#DC2626" />
  return <CircleDot size={14} color="#D97706" />
}

interface SettlementDetailDrawerProps {
  booking: Booking | null
  noteValue: string
  onNoteChange: (v: string) => void
  onClose: () => void
  onReconcile: (b: Booking) => void
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

function SettlementDetailDrawer({ booking: b, noteValue, onNoteChange, onClose, onReconcile, showToast }: SettlementDetailDrawerProps) {
  if (!b) return (
    <Drawer open={false} onClose={onClose} title="" width={560}>{null}</Drawer>
  )

  const invoiceStatus = deriveInvoiceStatus(b)
  const reconcStatus = deriveReconciliationStatus(b)
  const netPayout = b.amount - b.commission
  const paymentDate = addDays(b.checkOut, 7)

  // Simulate slight actual-vs-expected discrepancies for non-settled rows
  const isSettled = b.settlementStatus === 'settled'
  const isOverdue = b.settlementStatus === 'overdue'
  const actualGross = isSettled ? b.amount : b.amount - (isOverdue ? Math.round(b.amount * 0.03) : 0)
  const actualComm = isSettled ? b.commission : b.commission + (isOverdue ? Math.round(b.commission * 0.01) : 0)
  const actualNet = actualGross - actualComm
  const grossMatch = actualGross === b.amount
  const commMatch = actualComm === b.commission
  const netMatch = actualNet === netPayout
  const invoiceMatch = invoiceStatus === 'Issued'
  const paymentMatch = isSettled

  const overallResult: 'Matched' | 'Unmatched' | 'Under Review' =
    isSettled ? 'Matched' :
    b.settlementStatus === 'processing' ? 'Under Review' :
    'Unmatched'

  const mismatchReasons: string[] = []
  if (!grossMatch) mismatchReasons.push('Gross revenue differs from expected booking amount')
  if (!commMatch) mismatchReasons.push('Commission fee calculation discrepancy')
  if (!netMatch) mismatchReasons.push('Net payout does not match expected transfer amount')
  if (!invoiceMatch) mismatchReasons.push(invoiceStatus === 'Overdue' ? 'Invoice is overdue — not yet issued' : 'Invoice has not been issued')
  if (!paymentMatch) mismatchReasons.push(isOverdue ? 'Payment is overdue — payout not received' : 'Payout pending — settlement not confirmed')

  const overallColor = overallResult === 'Matched' ? '#027A48' : overallResult === 'Under Review' ? '#1D4ED8' : '#C01048'
  const overallBg   = overallResult === 'Matched' ? '#ECFDF3'  : overallResult === 'Under Review' ? '#EFF6FF'  : '#FFF1F3'
  const overallBorder = overallResult === 'Matched' ? '#A7F3D0' : overallResult === 'Under Review' ? '#BFDBFE' : '#FECDD3'

  const reconcRows: ReconcRowData[] = [
    { label: 'Gross Revenue',   expected: `¥${b.amount.toLocaleString()}`,      actual: `¥${actualGross.toLocaleString()}`,  status: grossMatch   ? 'match' : 'mismatch' },
    { label: 'Commission',      expected: `¥${b.commission.toLocaleString()}`,  actual: `¥${actualComm.toLocaleString()}`,   status: commMatch    ? 'match' : 'mismatch' },
    { label: 'Net Payout',      expected: `¥${netPayout.toLocaleString()}`,     actual: `¥${actualNet.toLocaleString()}`,    status: netMatch     ? 'match' : 'mismatch' },
    { label: 'Invoice Status',  expected: 'Issued',                              actual: invoiceStatus,                       status: invoiceMatch  ? 'match' : isSettled ? 'match' : 'pending' },
    { label: 'Payment Status',  expected: 'Settled',                             actual: b.settlementStatus.charAt(0).toUpperCase() + b.settlementStatus.slice(1), status: paymentMatch ? 'match' : isOverdue ? 'mismatch' : 'pending' },
  ]

  return (
    <Drawer
      open={!!b}
      onClose={onClose}
      title={`Settlement SET-${b.id}`}
      subtitle={`${b.merchantName} · ${b.checkIn} → ${b.checkOut}`}
      width={600}
    >
      <div className="space-y-5">

        {/* Overall Result Banner */}
        <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: overallBg, border: `1px solid ${overallBorder}` }}>
          {overallResult === 'Matched'
            ? <ShieldCheck size={20} color={overallColor} />
            : overallResult === 'Under Review'
            ? <Clock size={20} color={overallColor} />
            : <AlertCircle size={20} color={overallColor} />}
          <div className="flex-1">
            <div style={{ fontSize: 13, fontWeight: 700, color: overallColor }}>
              Reconciliation Result: {overallResult}
            </div>
            {mismatchReasons.length > 0 && (
              <div style={{ fontSize: 12, color: overallColor, opacity: 0.85, marginTop: 2 }}>
                {mismatchReasons[0]}{mismatchReasons.length > 1 ? ` +${mismatchReasons.length - 1} more` : ''}
              </div>
            )}
          </div>
          <span className="rounded-full px-2 font-medium" style={{ fontSize: 11, height: 22, lineHeight: '22px', background: overallBg, color: overallColor, border: `1px solid ${overallBorder}`, whiteSpace: 'nowrap' }}>
            {reconcStatus}
          </span>
        </div>

        {/* Settlement Identity */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Settlement Info</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {[
              { label: 'Settlement ID', value: `SET-${b.id}`, mono: true },
              { label: 'Booking Reference', value: b.id, mono: true },
              { label: 'Merchant', value: b.merchantName },
              { label: 'Hotel', value: b.hotelName },
              { label: 'Settlement Period', value: `${b.checkIn} – ${b.checkOut}`, mono: true },
              { label: 'Payment Date', value: paymentDate, mono: true },
              { label: 'Invoice Status', value: invoiceStatus },
              { label: 'Settlement Status', value: b.settlementStatus },
            ].map((f, fi) => (
              <div key={fi} className="px-4 py-2.5" style={{ borderBottom: fi < 6 ? '1px solid #F8FAFC' : 'none', borderRight: fi % 2 === 0 ? '1px solid #F8FAFC' : 'none' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332', fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Reconciliation Summary Table */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reconciliation Summary</span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>Expected vs Actual</span>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                {['Line Item', 'Expected', 'Actual', 'Status'].map(h => (
                  <th key={h} className="text-left px-4" style={{ height: 32, fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reconcRows.map((row, ri) => (
                <tr key={ri} style={{
                  borderBottom: ri < reconcRows.length - 1 ? '1px solid #F8FAFC' : 'none',
                  background: row.status === 'mismatch' ? '#FFFBF9' : 'transparent',
                }}>
                  <td className="px-4" style={{ height: 40, fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{row.label}</td>
                  <td className="px-4" style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748B' }}>{row.expected}</td>
                  <td className="px-4" style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: row.status === 'mismatch' ? 600 : 400, color: row.status === 'mismatch' ? '#DC2626' : row.status === 'pending' ? '#D97706' : '#059669' }}>{row.actual}</td>
                  <td className="px-4">
                    <div className="flex items-center gap-1.5">
                      <RowIcon s={row.status} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: row.status === 'mismatch' ? '#DC2626' : row.status === 'pending' ? '#D97706' : '#059669' }}>
                        {row.status === 'match' ? 'Matched' : row.status === 'mismatch' ? 'Unmatched' : 'Pending'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mismatch Reasons */}
        {mismatchReasons.length > 0 && (
          <div className="rounded-lg px-4 py-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={13} color="#D97706" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discrepancy Reasons</span>
            </div>
            <ul className="space-y-1">
              {mismatchReasons.map((r, ri) => (
                <li key={ri} className="flex items-start gap-2" style={{ fontSize: 12, color: '#92400E' }}>
                  <span style={{ marginTop: 3, flexShrink: 0 }}>•</span> {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Investigation Notes */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <StickyNote size={12} color="#64748B" />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Investigation Notes</span>
          </div>
          <div className="p-3">
            <textarea
              value={noteValue}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Add investigation notes, findings, or follow-up actions for this settlement…"
              className="w-full rounded-md outline-none resize-none"
              style={{ fontSize: 12, color: '#1A2332', background: '#F8FAFC', border: '1px solid #E3E8F0', padding: '8px 10px', lineHeight: 1.6, minHeight: 72 }}
            />
            {noteValue && (
              <button
                onClick={() => showToast('success', 'Note Saved', `Investigation note saved for SET-${b.id}.`)}
                className="mt-2 rounded-md px-3 text-white font-medium"
                style={{ height: 28, fontSize: 12, background: '#1664FF' }}>
                Save Note
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {overallResult !== 'Matched' && (
            <button
              onClick={() => onReconcile(b)}
              className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
              style={{ height: 34, fontSize: 13, background: '#1664FF' }}>
              <ShieldCheck size={14} /> Mark as Reconciled
            </button>
          )}
          {overallResult === 'Unmatched' && (
            <button
              onClick={() => showToast('info', 'Under Review', `Settlement SET-${b.id} moved to Under Review.`)}
              className="flex items-center gap-1.5 rounded-md px-4 font-medium"
              style={{ height: 34, fontSize: 13, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <RotateCcw size={14} /> Set to Under Review
            </button>
          )}
          <button
            onClick={() => showToast('info', 'Download Started', `Settlement report for SET-${b.id} downloading.`)}
            className="flex items-center gap-1.5 rounded-md px-4 font-medium ml-auto"
            style={{ height: 34, fontSize: 13, color: '#475569', background: '#fff', border: '1px solid #E3E8F0' }}>
            <Download size={14} /> Download Report
          </button>
        </div>

      </div>
    </Drawer>
  )
}

function DrawerGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>{children}</div>
}

function DrawerField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit', textTransform: 'capitalize' }}>{value}</div>
    </div>
  )
}

function ActionBtn({ children, onClick, color, title }: { children: React.ReactNode; onClick: () => void; color: string; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="flex items-center justify-center rounded transition-colors" style={{ width: 28, height: 28, color: '#94A3B8' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = color + '15'; e.currentTarget.style.color = color }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}>
      {children}
    </button>
  )
}

function PagBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center justify-center rounded"
      style={{ minWidth: 28, height: 28, fontSize: 12, background: active ? '#1664FF' : 'transparent', color: active ? '#fff' : disabled ? '#CBD5E1' : '#475569', cursor: disabled ? 'not-allowed' : 'pointer' }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = '#F1F5F9' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}

import { useState, useRef, useEffect } from 'react'
import {
  Search, Plus, Filter, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, Clock, Eye, Edit2, Trash2,
  ShieldAlert, FileText, History, BarChart2, ChevronDown,
  Settings, LayoutTemplate, MoreHorizontal, UserCheck, Ban,
  RotateCcw, XCircle, FolderOpen, Copy, Archive, Globe,
  GlobeLock, CalendarClock, TrendingUp, Download, Store,
} from 'lucide-react'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'
import Dialog from '../components/Dialog'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

// ── Sample data ──────────────────────────────────────────────────────────────

const rules = [
  { id: 'RUL-001', title: 'Merchant Cancellation Policy', category: 'Booking', status: 'active', severity: 'high', created: '2024-01-15', lastUpdated: '2024-11-20', applies: 'All Merchants' },
  { id: 'RUL-002', title: 'Minimum Photo Requirements', category: 'Listing', status: 'active', severity: 'medium', created: '2024-02-03', lastUpdated: '2024-09-14', applies: 'Hotel, Resort' },
  { id: 'RUL-003', title: 'Response Time SLA (24h)', category: 'Operations', status: 'active', severity: 'high', created: '2024-02-18', lastUpdated: '2024-12-01', applies: 'All Merchants' },
  { id: 'RUL-004', title: 'Price Parity Enforcement', category: 'Pricing', status: 'active', severity: 'critical', created: '2024-03-01', lastUpdated: '2024-12-10', applies: 'All Merchants' },
  { id: 'RUL-005', title: 'Guest Review Response Policy', category: 'Reviews', status: 'draft', severity: 'low', created: '2024-03-20', lastUpdated: '2024-10-05', applies: 'All Merchants' },
  { id: 'RUL-006', title: 'Commission Clawback on Fraud', category: 'Finance', status: 'active', severity: 'critical', created: '2024-04-05', lastUpdated: '2024-11-30', applies: 'All Merchants' },
  { id: 'RUL-007', title: 'Document Renewal Reminder (30d)', category: 'Compliance', status: 'active', severity: 'medium', created: '2024-04-12', lastUpdated: '2024-08-22', applies: 'All Merchants' },
  { id: 'RUL-008', title: 'Influencer Disclosure Requirements', category: 'Marketing', status: 'draft', severity: 'medium', created: '2024-05-01', lastUpdated: '2024-12-18', applies: 'Affiliates' },
]

const violations = [
  { id: 'VIO-001', merchant: 'Chongqing Skyline Hotel', merchantId: 'MCH-0026', rule: 'Response Time SLA (24h)', severity: 'high', status: 'open', date: '2024-12-18', action: 'Warning Issued', assignedTo: 'Zhang Wei' },
  { id: 'VIO-002', merchant: 'Guilin Karst View Inn', merchantId: 'MCH-0019', rule: 'Minimum Photo Requirements', severity: 'medium', status: 'resolved', date: '2024-12-15', action: 'Merchant Updated', assignedTo: 'Li Min' },
  { id: 'VIO-003', merchant: 'Nanjing Imperial Suites', merchantId: 'MCH-0031', rule: 'Price Parity Enforcement', severity: 'critical', status: 'open', date: '2024-12-17', action: 'Under Investigation', assignedTo: 'Compliance Team' },
  { id: 'VIO-004', merchant: 'Wuhan Riverview Hotel', merchantId: 'MCH-0044', rule: 'Guest Review Response Policy', severity: 'low', status: 'resolved', date: '2024-12-10', action: 'Merchant Updated', assignedTo: 'Wang Fang' },
  { id: 'VIO-005', merchant: 'Kunming Lake Retreat', merchantId: 'MCH-0037', rule: 'Commission Clawback on Fraud', severity: 'critical', status: 'open', date: '2024-12-19', action: 'Suspended Pending Review', assignedTo: 'Compliance Team' },
  { id: 'VIO-006', merchant: 'Tianjin Harbor Inn', merchantId: 'MCH-0012', rule: 'Merchant Cancellation Policy', severity: 'medium', status: 'open', date: '2024-12-16', action: 'Warning Issued', assignedTo: 'Chen Jing' },
]

const warnings = [
  { id: 'WRN-001', merchant: 'Chongqing Skyline Hotel', merchantId: 'MCH-0026', reason: 'Slow response to guest inquiries', level: '1st Warning', date: '2024-12-18', issuedBy: 'Zhang Wei', expires: '2025-01-18' },
  { id: 'WRN-002', merchant: 'Tianjin Harbor Inn', merchantId: 'MCH-0012', reason: 'Cancellation policy violation', level: '1st Warning', date: '2024-12-16', issuedBy: 'Li Min', expires: '2025-01-16' },
  { id: 'WRN-003', merchant: 'Harbin Snow Resort', merchantId: 'MCH-0048', reason: 'Duplicate listing detected', level: '2nd Warning', date: '2024-11-20', issuedBy: 'Wang Fang', expires: '2024-12-20' },
  { id: 'WRN-004', merchant: 'Dalian Seafront Hotel', merchantId: 'MCH-0033', reason: 'Price manipulation detected', level: '3rd Warning', date: '2024-10-05', issuedBy: 'Zhang Wei', expires: '2025-01-05' },
  { id: 'WRN-005', merchant: 'Xi\'an Ancient City Lodge', merchantId: 'MCH-0055', reason: 'Unapproved promotional material', level: '1st Warning', date: '2024-12-01', issuedBy: 'Li Min', expires: '2025-01-01' },
]

const complianceHistory = [
  { id: 'CMP-001', merchant: 'Sanya Bay Resort', merchantId: 'MCH-0001', event: 'Annual compliance review passed', result: 'Pass', score: 94, date: '2024-12-01', reviewer: 'Zhang Wei' },
  { id: 'CMP-002', merchant: 'Grand Hyatt Shanghai', merchantId: 'MCH-0003', event: 'Document renewal completed', result: 'Pass', score: 88, date: '2024-11-28', reviewer: 'Li Min' },
  { id: 'CMP-003', merchant: 'Chongqing Skyline Hotel', merchantId: 'MCH-0026', event: 'Violation investigation closed', result: 'Warning', score: 61, date: '2024-11-15', reviewer: 'Wang Fang' },
  { id: 'CMP-004', merchant: 'Nanjing Imperial Suites', merchantId: 'MCH-0031', event: 'Price parity audit', result: 'Fail', score: 38, date: '2024-12-17', reviewer: 'Zhang Wei' },
  { id: 'CMP-005', merchant: 'The Peninsula Beijing', merchantId: 'MCH-0002', event: 'Annual compliance review passed', result: 'Pass', score: 97, date: '2024-10-30', reviewer: 'Li Min' },
  { id: 'CMP-006', merchant: 'Harbin Snow Resort', merchantId: 'MCH-0048', event: 'Document renewal overdue', result: 'Fail', score: 42, date: '2024-11-10', reviewer: 'Wang Fang' },
]

// ── Badge helpers ─────────────────────────────────────────────────────────────

function SeverityBadge({ s }: { s: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    critical: { bg: '#FFF1F3', color: '#C01048' },
    high: { bg: '#FFF7ED', color: '#C2410C' },
    medium: { bg: '#FFFBEB', color: '#B45308' },
    low: { bg: '#F0F9FF', color: '#0369A1' },
  }
  const c = cfg[s] ?? cfg.low
  return (
    <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, height: 20, background: c.bg, color: c.color }}>
      {s}
    </span>
  )
}

function StatusBadge({ s }: { s: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#ECFDF3', color: '#027A48', label: 'Active' },
    draft: { bg: '#F8FAFC', color: '#475569', label: 'Draft' },
    open: { bg: '#FFF7ED', color: '#C2410C', label: 'Open' },
    resolved: { bg: '#ECFDF3', color: '#027A48', label: 'Resolved' },
    Pass: { bg: '#ECFDF3', color: '#027A48', label: 'Pass' },
    Warning: { bg: '#FFFBEB', color: '#B45308', label: 'Warning' },
    Fail: { bg: '#FFF1F3', color: '#C01048', label: 'Fail' },
  }
  const c = cfg[s] ?? cfg.draft
  return (
    <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, height: 20, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

function ActionBtn({ onClick, color, children, title }: { onClick?: () => void; color: string; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: 26, height: 26, color, background: 'transparent', border: `1px solid ${color}22` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}12` }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

interface MenuItem {
  label: string
  icon: React.ReactNode
  color?: string
  divider?: boolean
  onClick: () => void
}

function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        title="More actions"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center rounded transition-colors"
        style={{ width: 26, height: 26, color: '#64748B', background: 'transparent', border: '1px solid #E3E8F022' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.borderColor = '#E3E8F0' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#E3E8F022' }}
      >
        <MoreHorizontal size={13} />
      </button>
      {open && (
        <div className="absolute z-50 rounded-lg overflow-hidden" style={{ right: 0, top: 30, minWidth: 192, background: '#fff', border: '1px solid #E3E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => { item.onClick(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 text-left"
              style={{
                height: 34,
                fontSize: 12,
                color: item.color ?? '#1A2332',
                borderTop: item.divider ? '1px solid #F1F5F9' : 'none',
                background: 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: item.color ?? '#64748B', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Pagination({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / perPage)
  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 12, color: '#94A3B8' }}>
        Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
          className="flex items-center justify-center rounded" style={{ width: 28, height: 28, border: '1px solid #E3E8F0', background: '#fff', color: page === 1 ? '#CBD5E1' : '#475569', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
          <ChevronLeft size={13} />
        </button>
        {Array.from({ length: Math.min(pages, 4) }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => onChange(p)}
            className="flex items-center justify-center rounded font-medium"
            style={{ width: 28, height: 28, fontSize: 12, border: '1px solid', borderColor: p === page ? '#1664FF' : '#E3E8F0', background: p === page ? '#1664FF' : '#fff', color: p === page ? '#fff' : '#475569', cursor: 'pointer' }}>
            {p}
          </button>
        ))}
        <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages}
          className="flex items-center justify-center rounded" style={{ width: 28, height: 28, border: '1px solid #E3E8F0', background: '#fff', color: page === pages ? '#CBD5E1' : '#475569', cursor: page === pages ? 'not-allowed' : 'pointer' }}>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Sub-pages ─────────────────────────────────────────────────────────────────

type RuleDialog = { type: 'publish' | 'unpublish' | 'archive' | 'delete'; id: string; title: string }
type ViolationDialog = { type: 'suspend' | 'warn' | 'resolve' | 'reopen'; id: string; merchant: string }
type WarningDialog = { type: 'revoke' | 'escalate'; id: string; merchant: string; level: string }
type ComplianceDialog = { type: 'reopen'; id: string; merchant: string }

function PlatformRulesTab({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<RuleDialog | null>(null)
  const perPage = 6

  const filtered = rules.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  )
  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const dlgCfg: Record<RuleDialog['type'], { variant: 'danger' | 'warning' | 'confirm'; title: string; message: string; confirmLabel: string; toastType: Toast['type']; toastTitle: string }> = {
    publish:   { variant: 'confirm',  title: 'Publish Rule',    message: `Publish "${dialog?.title}"? It will immediately apply to all matching merchants.`,          confirmLabel: 'Publish',        toastType: 'success', toastTitle: 'Rule Published' },
    unpublish: { variant: 'warning',  title: 'Unpublish Rule',  message: `Unpublish "${dialog?.title}"? It will become a draft and stop being enforced.`,             confirmLabel: 'Unpublish',      toastType: 'warning', toastTitle: 'Rule Unpublished' },
    archive:   { variant: 'warning',  title: 'Archive Rule',    message: `Archive "${dialog?.title}"? It will be hidden from active rules but preserved for audits.`,  confirmLabel: 'Archive Rule',   toastType: 'info',    toastTitle: 'Rule Archived' },
    delete:    { variant: 'danger',   title: 'Delete Rule',     message: `Permanently delete "${dialog?.title}"? This action cannot be undone.`,                       confirmLabel: 'Delete Rule',    toastType: 'success', toastTitle: 'Rule Deleted' },
  }
  const cfg = dialog ? dlgCfg[dialog.type] : null

  return (
    <div>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total Rules', value: '8', icon: FileText, color: '#1664FF', bg: '#EEF4FF' },
          { label: 'Active Rules', value: '6', icon: CheckCircle, color: '#059669', bg: '#ECFDF3' },
          { label: 'Draft Rules', value: '2', icon: Clock, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Open Violations', value: '4', icon: AlertTriangle, color: '#DC2626', bg: '#FFF1F2' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-lg p-3 flex items-center gap-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, background: s.bg }}><Icon size={16} color={s.color} /></div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Platform Rules</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md px-3" style={{ height: 32, background: '#F8FAFC', border: '1px solid #E3E8F0', width: 220 }}>
              <Search size={12} color="#94A3B8" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search rules..." className="flex-1 bg-transparent outline-none" style={{ fontSize: 12 }} />
            </div>
            <button className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium" style={{ height: 32, fontSize: 12, background: '#1664FF' }}
              onClick={() => showToast('success', 'Rule Created', 'New platform rule has been drafted.')}>
              <Plus size={13} /> New Rule
            </button>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Rule ID', 'Title', 'Category', 'Applies To', 'Severity', 'Status', 'Created', 'Last Updated', 'Actions'].map(h => (
                <th key={h} className="text-left px-4" style={{ height: 34, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < paged.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-4" style={{ height: 42, fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{r.id}</td>
                <td className="px-4" style={{ fontSize: 12, fontWeight: 500, color: '#1A2332', maxWidth: 220 }}><div className="truncate">{r.title}</div></td>
                <td className="px-4" style={{ fontSize: 12, color: '#475569' }}>{r.category}</td>
                <td className="px-4" style={{ fontSize: 11, color: '#64748B' }}>{r.applies}</td>
                <td className="px-4"><SeverityBadge s={r.severity} /></td>
                <td className="px-4"><StatusBadge s={r.status} /></td>
                <td className="px-4" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{r.created}</td>
                <td className="px-4" style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{r.lastUpdated}</td>
                <td className="px-4">
                  <div className="flex items-center gap-1">
                    <ActionBtn title="View rule details" onClick={() => showToast('info', 'View Rule', r.title)} color="#1664FF">
                      <Eye size={12} />
                    </ActionBtn>
                    <MoreMenu items={[
                      { label: 'Edit Rule',       icon: <Edit2 size={13} />,    onClick: () => showToast('info', 'Edit Rule', r.title) },
                      { label: 'Duplicate Rule',  icon: <Copy size={13} />,     onClick: () => showToast('success', 'Rule Duplicated', `A copy of "${r.title}" was created as a draft.`) },
                      r.status === 'draft'
                        ? { label: 'Publish Rule',   icon: <Globe size={13} />,    onClick: () => setDialog({ type: 'publish',   id: r.id, title: r.title }) }
                        : { label: 'Unpublish Rule', icon: <GlobeLock size={13} />, onClick: () => setDialog({ type: 'unpublish', id: r.id, title: r.title }) },
                      { label: 'Archive Rule',    icon: <Archive size={13} />,  divider: true, onClick: () => setDialog({ type: 'archive', id: r.id, title: r.title }) },
                      { label: 'Delete Rule',     icon: <Trash2 size={13} />,   color: '#DC2626', onClick: () => setDialog({ type: 'delete', id: r.id, title: r.title }) },
                    ]} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </div>

      {dialog && cfg && (
        <Dialog
          open
          variant={cfg.variant}
          title={cfg.title}
          message={cfg.message}
          confirmLabel={cfg.confirmLabel}
          onConfirm={() => { showToast(cfg.toastType, cfg.toastTitle, `${dialog.title} — ${dialog.id}`); setDialog(null) }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function MerchantViolationsTab({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<ViolationDialog | null>(null)
  const perPage = 6

  const filtered = violations.filter(v =>
    v.merchant.toLowerCase().includes(search.toLowerCase()) ||
    v.rule.toLowerCase().includes(search.toLowerCase())
  )
  const paged = filtered.slice((page - 1) * perPage, page * perPage)

  const dlgCfg: Record<ViolationDialog['type'], { variant: 'danger' | 'warning' | 'confirm'; title: string; message: (d: ViolationDialog) => string; confirmLabel: string; toastType: Toast['type']; toastTitle: string; toastMsg: (d: ViolationDialog) => string }> = {
    suspend: { variant: 'danger',   title: 'Suspend Merchant',  message: d => `Suspend ${d.merchant}? Their listings will be hidden from all travellers immediately.`,                   confirmLabel: 'Suspend Merchant', toastType: 'warning', toastTitle: 'Merchant Suspended',  toastMsg: d => `${d.merchant} has been suspended.` },
    warn:    { variant: 'warning',  title: 'Issue Warning',     message: d => `Issue a formal warning to ${d.merchant} for ${d.id}? The merchant will be notified by email.`,           confirmLabel: 'Issue Warning',    toastType: 'warning', toastTitle: 'Warning Issued',      toastMsg: d => `Formal warning sent to ${d.merchant}.` },
    resolve: { variant: 'confirm',  title: 'Mark as Resolved',  message: d => `Mark ${d.id} as resolved? This will close the case and notify the assigned administrator.`,              confirmLabel: 'Mark Resolved',    toastType: 'success', toastTitle: 'Violation Resolved',  toastMsg: d => `Violation ${d.id} has been closed.` },
    reopen:  { variant: 'warning',  title: 'Reopen Case',       message: d => `Reopen ${d.id} for ${d.merchant}? The case will return to Open status and be reassigned.`,               confirmLabel: 'Reopen Case',      toastType: 'info',    toastTitle: 'Case Reopened',       toastMsg: d => `Violation ${d.id} has been reopened.` },
  }
  const cfg = dialog ? dlgCfg[dialog.type] : null

  return (
    <div>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total Violations', value: String(violations.length), color: '#1664FF', bg: '#EEF4FF' },
          { label: 'Open', value: String(violations.filter(v => v.status === 'open').length), color: '#DC2626', bg: '#FFF1F2' },
          { label: 'Resolved', value: String(violations.filter(v => v.status === 'resolved').length), color: '#059669', bg: '#ECFDF3' },
          { label: 'Critical Severity', value: String(violations.filter(v => v.severity === 'critical').length), color: '#C01048', bg: '#FFF1F3' },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Merchant Violations</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md px-3" style={{ height: 32, background: '#F8FAFC', border: '1px solid #E3E8F0', width: 220 }}>
              <Search size={12} color="#94A3B8" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search violations..." className="flex-1 bg-transparent outline-none" style={{ fontSize: 12 }} />
            </div>
            <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 32, fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
              <Filter size={12} /> Filter
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Violation ID', 'Merchant', 'Rule Violated', 'Severity', 'Status', 'Date', 'Action Taken', 'Assigned To', 'Actions'].map(h => (
                <th key={h} className="text-left px-4" style={{ height: 34, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((v, i) => (
              <tr key={v.id} style={{ borderBottom: i < paged.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-4" style={{ height: 42, fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{v.id}</td>
                <td className="px-4">
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{v.merchant}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{v.merchantId}</div>
                </td>
                <td className="px-4" style={{ fontSize: 12, color: '#475569', maxWidth: 180 }}><div className="truncate">{v.rule}</div></td>
                <td className="px-4"><SeverityBadge s={v.severity} /></td>
                <td className="px-4"><StatusBadge s={v.status} /></td>
                <td className="px-4" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{v.date}</td>
                <td className="px-4" style={{ fontSize: 11, color: '#64748B' }}>{v.action}</td>
                <td className="px-4">
                  <div className="flex items-center gap-1.5">
                    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
                      style={{ width: 20, height: 20, fontSize: 8, background: v.assignedTo === 'Compliance Team' ? '#7C3AED' : '#1664FF' }}>
                      {v.assignedTo === 'Compliance Team' ? 'CT' : v.assignedTo.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <span style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{v.assignedTo}</span>
                  </div>
                </td>
                <td className="px-4">
                  <div className="flex items-center gap-1">
                    <ActionBtn title="View violation details" onClick={() => showToast('info', 'View Violation', v.id)} color="#1664FF">
                      <Eye size={12} />
                    </ActionBtn>
                    <MoreMenu items={v.status === 'open' ? [
                      { label: 'Assign / Reassign',    icon: <UserCheck size={13} />,    onClick: () => showToast('info', 'Reassign', `Violation ${v.id} reassigned.`) },
                      { label: 'Issue Warning',         icon: <AlertTriangle size={13} />, onClick: () => setDialog({ type: 'warn',    id: v.id, merchant: v.merchant }) },
                      { label: 'Suspend Merchant',      icon: <Ban size={13} />,          color: '#DC2626', onClick: () => setDialog({ type: 'suspend', id: v.id, merchant: v.merchant }) },
                      { label: 'Mark as Resolved',      icon: <CheckCircle size={13} />,  color: '#059669', divider: true, onClick: () => setDialog({ type: 'resolve', id: v.id, merchant: v.merchant }) },
                    ] : [
                      { label: 'View Resolution',  icon: <FolderOpen size={13} />,  onClick: () => showToast('info', 'View Resolution', `Resolution details for ${v.id}.`) },
                      { label: 'Reopen Case',       icon: <RotateCcw size={13} />,   color: '#D97706', divider: true, onClick: () => setDialog({ type: 'reopen', id: v.id, merchant: v.merchant }) },
                    ]} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </div>

      {dialog && cfg && (
        <Dialog
          open
          variant={cfg.variant}
          title={cfg.title}
          message={cfg.message(dialog)}
          confirmLabel={cfg.confirmLabel}
          onConfirm={() => { showToast(cfg.toastType, cfg.toastTitle, cfg.toastMsg(dialog)); setDialog(null) }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function WarningHistoryTab({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<WarningDialog | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = warnings.filter(w =>
    w.merchant.toLowerCase().includes(search.toLowerCase()) ||
    w.reason.toLowerCase().includes(search.toLowerCase())
  )

  const levelColor: Record<string, { bg: string; color: string }> = {
    '1st Warning': { bg: '#FFFBEB', color: '#B45308' },
    '2nd Warning': { bg: '#FFF7ED', color: '#C2410C' },
    '3rd Warning': { bg: '#FFF1F3', color: '#C01048' },
  }

  const dlgCfg: Record<WarningDialog['type'], { variant: 'danger' | 'warning' | 'confirm'; title: string; message: (d: WarningDialog) => string; confirmLabel: string; toastType: Toast['type']; toastTitle: string }> = {
    revoke:   { variant: 'danger',  title: 'Revoke Warning',     message: d => `Revoke ${d.level} issued to ${d.merchant}? This will remove it from their compliance record.`,    confirmLabel: 'Revoke Warning',    toastType: 'success', toastTitle: 'Warning Revoked' },
    escalate: { variant: 'warning', title: 'Escalate Warning',   message: d => `Escalate ${d.level} for ${d.merchant} to the next severity level? This action will be logged.`,  confirmLabel: 'Escalate Warning',  toastType: 'warning', toastTitle: 'Warning Escalated' },
  }
  const cfg = dialog ? dlgCfg[dialog.type] : null

  return (
    <div>
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Warning History</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md px-3" style={{ height: 32, background: '#F8FAFC', border: '1px solid #E3E8F0', width: 220 }}>
              <Search size={12} color="#94A3B8" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search warnings..." className="flex-1 bg-transparent outline-none" style={{ fontSize: 12 }} />
            </div>
            <div className="relative" ref={menuRef}>
              <button
                className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
                style={{ height: 32, fontSize: 12, background: '#D97706' }}
                onClick={() => setMenuOpen(o => !o)}>
                <AlertTriangle size={12} /> Issue Warning <ChevronDown size={11} style={{ marginLeft: 2, opacity: 0.85 }} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-50 rounded-lg overflow-hidden" style={{ top: 36, minWidth: 180, background: '#fff', border: '1px solid #E3E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
                  {[
                    { label: 'Issue Warning',      icon: <AlertTriangle size={13} color="#D97706" />, action: () => { showToast('warning', 'Warning Issued', 'New warning has been sent to merchant.'); setMenuOpen(false) } },
                    { label: 'Warning Templates',  icon: <LayoutTemplate size={13} color="#475569" />, action: () => { showToast('info', 'Warning Templates', 'Manage reusable warning templates.'); setMenuOpen(false) } },
                    { label: 'Warning Settings',   icon: <Settings size={13} color="#475569" />,       action: () => { showToast('info', 'Warning Settings', 'Configure warning thresholds and escalations.'); setMenuOpen(false) } },
                  ].map((item, idx, arr) => (
                    <button key={item.label} onClick={item.action} className="w-full flex items-center gap-2.5 px-3 text-left"
                      style={{ height: 36, fontSize: 12, color: '#1A2332', borderBottom: idx < arr.length - 1 ? '1px solid #F1F5F9' : 'none', background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Warning ID', 'Merchant', 'Violation Reason', 'Warning Level', 'Issued By', 'Date', 'Expires', 'Actions'].map(h => (
                <th key={h} className="text-left px-4" style={{ height: 34, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((w, i) => {
              const lc = levelColor[w.level] ?? levelColor['1st Warning']
              const isExpired = new Date(w.expires) < new Date()
              return (
                <tr key={w.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4" style={{ height: 42, fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{w.id}</td>
                  <td className="px-4">
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{w.merchant}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{w.merchantId}</div>
                  </td>
                  <td className="px-4" style={{ fontSize: 12, color: '#475569', maxWidth: 200 }}><div className="truncate">{w.reason}</div></td>
                  <td className="px-4">
                    <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, height: 20, background: lc.bg, color: lc.color }}>{w.level}</span>
                  </td>
                  <td className="px-4" style={{ fontSize: 12, color: '#475569' }}>{w.issuedBy}</td>
                  <td className="px-4" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{w.date}</td>
                  <td className="px-4" style={{ fontSize: 11, fontFamily: 'monospace', color: isExpired ? '#C01048' : '#94A3B8' }}>{w.expires}</td>
                  <td className="px-4">
                    <div className="flex items-center gap-1">
                      <ActionBtn title="View warning details" onClick={() => showToast('info', 'Warning Detail', `${w.id} — ${w.merchant}`)} color="#1664FF">
                        <Eye size={12} />
                      </ActionBtn>
                      <MoreMenu items={[
                        { label: 'View Warning Details', icon: <FileText size={13} />,        onClick: () => showToast('info', 'Warning Details', `Full record for ${w.id}.`) },
                        { label: 'Extend Expiry',         icon: <CalendarClock size={13} />,   onClick: () => showToast('success', 'Expiry Extended', `Warning ${w.id} expiry extended by 30 days.`) },
                        { label: 'Escalate Warning',      icon: <TrendingUp size={13} />,      color: '#C2410C', onClick: () => setDialog({ type: 'escalate', id: w.id, merchant: w.merchant, level: w.level }) },
                        { label: 'Revoke Warning',        icon: <XCircle size={13} />,         color: '#DC2626', divider: true, onClick: () => setDialog({ type: 'revoke', id: w.id, merchant: w.merchant, level: w.level }) },
                      ]} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {dialog && cfg && (
        <Dialog
          open
          variant={cfg.variant}
          title={cfg.title}
          message={cfg.message(dialog)}
          confirmLabel={cfg.confirmLabel}
          onConfirm={() => { showToast(cfg.toastType, cfg.toastTitle, `${dialog.id} — ${dialog.merchant}`); setDialog(null) }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function ComplianceHistoryTab({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<ComplianceDialog | null>(null)

  const filtered = complianceHistory.filter(c =>
    c.merchant.toLowerCase().includes(search.toLowerCase()) ||
    c.event.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Compliance History</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md px-3" style={{ height: 32, background: '#F8FAFC', border: '1px solid #E3E8F0', width: 220 }}>
              <Search size={12} color="#94A3B8" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="flex-1 bg-transparent outline-none" style={{ fontSize: 12 }} />
            </div>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Record ID', 'Merchant', 'Event', 'Compliance Score', 'Result', 'Reviewer', 'Date', 'Actions'].map(h => (
                <th key={h} className="text-left px-4" style={{ height: 34, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-4" style={{ height: 42, fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{c.id}</td>
                <td className="px-4">
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{c.merchant}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{c.merchantId}</div>
                </td>
                <td className="px-4" style={{ fontSize: 12, color: '#475569' }}>{c.event}</td>
                <td className="px-4">
                  {(() => {
                    const s = c.score
                    const color = s >= 80 ? '#027A48' : s >= 60 ? '#B45308' : '#C01048'
                    const bg    = s >= 80 ? '#ECFDF3' : s >= 60 ? '#FFFBEB' : '#FFF1F3'
                    const bar   = s >= 80 ? '#6EE7B7' : s >= 60 ? '#FDE68A' : '#FECDD3'
                    return (
                      <div className="flex items-center gap-2">
                        <div className="rounded-full overflow-hidden flex-shrink-0" style={{ width: 48, height: 5, background: '#F1F5F9' }}>
                          <div style={{ width: `${s}%`, height: '100%', background: bar, borderRadius: 999 }} />
                        </div>
                        <span className="rounded px-1.5 font-medium font-mono" style={{ fontSize: 11, height: 20, lineHeight: '20px', display: 'inline-block', background: bg, color }}>{s}%</span>
                      </div>
                    )
                  })()}
                </td>
                <td className="px-4"><StatusBadge s={c.result} /></td>
                <td className="px-4" style={{ fontSize: 12, color: '#475569' }}>{c.reviewer}</td>
                <td className="px-4" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{c.date}</td>
                <td className="px-4">
                  <div className="flex items-center gap-1">
                    <ActionBtn title="View compliance record" onClick={() => showToast('info', 'Compliance Record', c.id)} color="#1664FF">
                      <Eye size={12} />
                    </ActionBtn>
                    <MoreMenu items={[
                      { label: 'Export Record',           icon: <Download size={13} />,    onClick: () => showToast('success', 'Export Started', `Record ${c.id} is being exported.`) },
                      { label: 'View Related Merchant',   icon: <Store size={13} />,       onClick: () => showToast('info', 'Merchant Profile', `Opening profile for ${c.merchant}.`) },
                      ...(c.result === 'Fail' || c.result === 'Warning' ? [
                        { label: 'Reopen Investigation', icon: <RotateCcw size={13} />, color: '#D97706', divider: true, onClick: () => setDialog({ type: 'reopen', id: c.id, merchant: c.merchant }) },
                      ] : []),
                    ]} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (
        <Dialog
          open
          variant="warning"
          title="Reopen Investigation"
          message={`Reopen compliance investigation for ${dialog.merchant} (${dialog.id})? A new review cycle will be initiated and the reviewer will be notified.`}
          confirmLabel="Reopen Investigation"
          onConfirm={() => { showToast('info', 'Investigation Reopened', `${dialog.id} — ${dialog.merchant}`); setDialog(null) }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

// ── Page header tabs ──────────────────────────────────────────────────────────

const tabs: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: 'platform-rules', label: 'Platform Rules', icon: <FileText size={13} /> },
  { id: 'merchant-violations', label: 'Merchant Violations', icon: <ShieldAlert size={13} /> },
  { id: 'warning-history', label: 'Warning History', icon: <AlertTriangle size={13} /> },
  { id: 'compliance-history', label: 'Compliance History', icon: <History size={13} /> },
]

export default function PlatformRulesPage({ tab, showToast }: Props) {
  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      {/* Page title */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Platform Rules & Compliance</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Manage platform policies, violations, and merchant compliance records</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
            <BarChart2 size={13} /> Compliance Report
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-5 rounded-lg p-1" style={{ background: '#F1F5F9', width: 'fit-content' }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <div
              key={t.id}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 cursor-pointer select-none"
              style={{
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? '#fff' : '#64748B',
                background: active ? '#1664FF' : 'transparent',
                boxShadow: active ? '0 1px 4px rgba(22,100,255,0.25)' : 'none',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#E8EDF2' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              {t.icon}
              {t.label}
            </div>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'platform-rules' && <PlatformRulesTab showToast={showToast} />}
      {tab === 'merchant-violations' && <MerchantViolationsTab showToast={showToast} />}
      {tab === 'warning-history' && <WarningHistoryTab showToast={showToast} />}
      {tab === 'compliance-history' && <ComplianceHistoryTab showToast={showToast} />}
    </div>
  )
}

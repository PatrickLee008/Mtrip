import { useState } from 'react'
import {
  Search, Plus, Download, Eye, ChevronLeft, ChevronRight, LogIn,
  MoreHorizontal, Star, Filter, FileText, ShieldCheck, Clock,
  AlertTriangle, RefreshCw, History, CheckCircle,
  AlertCircle, Calendar, Bell,
} from 'lucide-react'
import { merchants } from '../data/platformData'
import type { Merchant, MerchantStatus } from '../data/platformData'
import type { PageId, Impersonation } from '../App'
import type { Toast } from '../hooks/useToast'
import Drawer from '../components/Drawer'
import Dialog from '../components/Dialog'
import NotificationDrawer, { type NotifRecipient } from '../components/NotificationDrawer'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
  onImpersonate: (imp: Impersonation) => void
}

const impersonateReasons = ['Technical Support', 'Booking Investigation', 'Payment Investigation', 'Customer Complaint', 'Other']

// ─── Dynamic page context per tab ────────────────────────────────────────────

const tabPageConfig: Partial<Record<PageId, { title: string; subtitle: string }>> = {
  merchants: {
    title: 'All Merchants',
    subtitle: 'Manage platform merchants, commissions, and account access',
  },
  'merchants-suspended': {
    title: 'Suspended Merchants',
    subtitle: 'Merchants currently suspended from accepting new bookings',
  },
  'merchants-blacklisted': {
    title: 'Blacklisted Merchants',
    subtitle: 'Merchants permanently removed from the platform',
  },
  'merchants-activities': {
    title: 'Merchant Activities',
    subtitle: 'Audit log of all merchant and administrator actions across the platform',
  },
}

const statusFilter: Partial<Record<PageId, MerchantStatus[]>> = {
  merchants: ['active', 'suspended', 'inactive'],
  'merchants-documents': ['active', 'suspended', 'inactive'],
  'merchants-suspended': ['suspended'],
  'merchants-blacklisted': ['inactive'],
  'merchants-activities': ['active', 'suspended', 'inactive'],
}

// ─── Document data ────────────────────────────────────────────────────────────

type DocStatus = 'verified' | 'pending' | 'expired' | 'resubmission_required'

interface MerchantDoc {
  id: string
  merchantId: string
  merchantName: string
  merchantCity: string
  docType: string
  fileName: string
  fileSize: string
  uploadedDate: string
  expiryDate: string | null
  lastVerifiedDate: string | null
  reviewer: string
  status: DocStatus
  notes?: string
  history: { date: string; action: string; by: string; note?: string }[]
}

const reviewers = ['Zhang Wei', 'Li Min', 'Wang Fang', 'Chen Jing', 'Liu Yang']

const docTypes = [
  'Business Registration Certificate',
  'Hotel Operating License',
  'Owner Identity Document',
  'Bank Account Verification Letter',
  'Tax Registration Certificate',
  'Fire Safety Certificate',
  'Tourism Operator License',
  'Food & Beverage License',
]

const docStatuses: DocStatus[] = ['verified', 'verified', 'verified', 'pending', 'expired', 'resubmission_required']

function makeHistory(status: DocStatus, merchant: string, reviewer: string) {
  const base = [
    { date: '2024-01-10', action: 'Document uploaded', by: merchant, note: 'Initial submission' },
    { date: '2024-01-11', action: 'Assigned to reviewer', by: 'System' },
    { date: '2024-01-13', action: 'Review started', by: reviewer },
  ]
  if (status === 'verified') base.push({ date: '2024-01-15', action: 'Document verified', by: reviewer, note: 'All details confirmed valid' })
  if (status === 'resubmission_required') base.push({ date: '2024-01-14', action: 'Resubmission requested', by: reviewer, note: 'Document quality insufficient' })
  if (status === 'expired') base.push({ date: '2024-06-01', action: 'Document expired', by: 'System', note: 'Expiry date passed' })
  return base
}

const merchantDocs: MerchantDoc[] = merchants.flatMap((m, mi) => {
  const count = 3 + (mi % 3)
  return Array.from({ length: count }, (_, di) => {
    const docType = docTypes[(mi + di) % docTypes.length]
    const status = docStatuses[(mi * 3 + di) % docStatuses.length]
    const reviewer = reviewers[(mi + di) % reviewers.length]
    const year = 2024 + (di % 2)
    const month = String(1 + ((mi + di) % 12)).padStart(2, '0')
    const expMonth = String(1 + ((mi + di + 6) % 12)).padStart(2, '0')
    return {
      id: `DOC-${String(mi * 5 + di + 1).padStart(4, '0')}`,
      merchantId: m.id,
      merchantName: m.merchantName,
      merchantCity: m.city,
      docType,
      fileName: `${m.id}_${docType.replace(/\s+/g, '_').toLowerCase()}.pdf`,
      fileSize: `${(180 + mi * 37 + di * 23) % 800 + 50} KB`,
      uploadedDate: `${year}-${month}-${String(1 + di * 3).padStart(2, '0')}`,
      expiryDate: status !== 'pending' ? `${year + 1}-${expMonth}-30` : null,
      lastVerifiedDate: status === 'verified' ? `${year}-${month}-15` : null,
      reviewer,
      status,
      notes: status === 'resubmission_required' ? 'Document image unclear, please resubmit higher resolution scan' : undefined,
      history: makeHistory(status, m.merchantName, reviewer),
    }
  })
})

// ─── Shared small components ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: MerchantStatus }) {
  const cfg = { active: { bg: '#ECFDF3', color: '#027A48' }, suspended: { bg: '#FFF1F3', color: '#C01048' }, inactive: { bg: '#F8FAFC', color: '#475569' } }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{status}</span>
}

function PlanBadge({ plan }: { plan: Merchant['commissionPlan'] }) {
  const cfg = { vip: { bg: '#FEF3C7', color: '#92400E' }, premium: { bg: '#EDE9FE', color: '#5B21B6' }, standard: { bg: '#F1F5F9', color: '#475569' }, custom: { bg: '#F0FDF4', color: '#166534' } }
  const c = cfg[plan]
  return <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{plan}</span>
}

function VerifBadge({ status }: { status: Merchant['verificationStatus'] }) {
  const cfg = {
    approved: { bg: '#ECFDF3', color: '#027A48' },
    pending: { bg: '#FFFAEB', color: '#B54708' },
    rejected: { bg: '#FFF1F3', color: '#C01048' },
    resubmission: { bg: '#EFF6FF', color: '#1D4ED8' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{status}</span>
}

function ActionBtn({ children, onClick, color, title }: { children: React.ReactNode; onClick: () => void; color: string; title?: string }) {
  return (
    <button title={title} onClick={onClick} className="flex items-center justify-center rounded transition-colors"
      style={{ width: 28, height: 28, color: '#94A3B8', border: '1px solid transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = color + '15'; e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color + '30' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = 'transparent' }}>
      {children}
    </button>
  )
}

function PagBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center justify-center rounded transition-colors"
      style={{ minWidth: 28, height: 28, fontSize: 12, background: active ? '#1664FF' : 'transparent', color: active ? '#fff' : disabled ? '#CBD5E1' : '#475569', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: active ? 600 : 400 }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = '#F1F5F9' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}

// ─── Document status badge ────────────────────────────────────────────────────

function DocStatusBadge({ status }: { status: DocStatus }) {
  const cfg: Record<DocStatus, { bg: string; color: string; border: string; label: string; icon: React.ReactNode }> = {
    verified: { bg: '#ECFDF3', color: '#027A48', border: '#A7F3D0', label: 'Verified', icon: <CheckCircle size={11} /> },
    pending: { bg: '#FFFBEB', color: '#B45308', border: '#FDE68A', label: 'Pending Review', icon: <Clock size={11} /> },
    expired: { bg: '#FFF1F3', color: '#C01048', border: '#FECDD3', label: 'Expired', icon: <AlertCircle size={11} /> },
    resubmission_required: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', label: 'Resubmission Required', icon: <RefreshCw size={11} /> },
  }
  const c = cfg[status]
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 font-medium" style={{ fontSize: 11, height: 22, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {c.icon} {c.label}
    </span>
  )
}

// ─── Document thumbnail (mock preview) ───────────────────────────────────────

function DocThumbnail({ doc }: { doc: MerchantDoc }) {
  const statusColors: Record<DocStatus, string> = {
    verified: '#059669', pending: '#D97706', expired: '#DC2626', resubmission_required: '#2563EB',
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
      {/* Mock document body */}
      <div className="flex flex-col items-center justify-center gap-3 py-10"
        style={{ background: 'linear-gradient(145deg, #F8FAFC 0%, #EEF2F6 100%)', minHeight: 200 }}>
        <div className="rounded-xl flex items-center justify-center" style={{ width: 64, height: 64, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <FileText size={28} color={statusColors[doc.status]} />
        </div>
        <div className="text-center px-4">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', wordBreak: 'break-all' }}>{doc.fileName}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{doc.fileSize} · PDF Document</div>
        </div>
        {/* Skeleton lines to suggest document content */}
        <div className="w-3/4 flex flex-col gap-2 mt-2">
          {[80, 60, 75, 50].map((w, i) => (
            <div key={i} className="rounded-full" style={{ height: 6, width: `${w}%`, background: '#E3E8F0' }} />
          ))}
        </div>
      </div>
      {/* File metadata strip */}
      <div className="grid px-4 py-3 gap-1" style={{ background: '#fff', borderTop: '1px solid #F1F5F9', gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>UPLOADED</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332', fontFamily: 'monospace' }}>{doc.uploadedDate}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>FILE SIZE</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{doc.fileSize}</div>
        </div>
        {doc.expiryDate && (
          <div className="col-span-2 mt-1">
            <div style={{ fontSize: 10, color: '#94A3B8' }}>EXPIRY DATE</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: doc.status === 'expired' ? '#DC2626' : '#1A2332', fontFamily: 'monospace' }}>
              {doc.expiryDate}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Merchant Documents Page ──────────────────────────────────────────────────

function MerchantDocumentsPage({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [statusFilter2, setStatusFilter2] = useState<DocStatus | 'all'>('all')
  const [docTypeFilter, setDocTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [drawerDoc, setDrawerDoc] = useState<MerchantDoc | null>(null)
  const [drawerDocTab, setDrawerDocTab] = useState<'preview' | 'history'>('preview')
  const [resubTarget, setResubTarget] = useState<MerchantDoc | null>(null)
  const [resubComment, setResubComment] = useState('')
  const [verifyTarget, setVerifyTarget] = useState<MerchantDoc | null>(null)
  const [loadingDialog, setLoadingDialog] = useState(false)
  const perPage = 12

  const filtered = merchantDocs.filter((d) => {
    const matchStatus = statusFilter2 === 'all' || d.status === statusFilter2
    const matchType = docTypeFilter === 'all' || d.docType === docTypeFilter
    const matchSearch = !search ||
      d.merchantName.toLowerCase().includes(search.toLowerCase()) ||
      d.merchantId.toLowerCase().includes(search.toLowerCase()) ||
      d.docType.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchType && matchSearch
  })

  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const statCards = [
    {
      label: 'Total Documents', value: merchantDocs.length,
      icon: <FileText size={15} />, color: '#1664FF', bg: '#EEF4FF',
      filter: 'all' as const,
    },
    {
      label: 'Verified', value: merchantDocs.filter(d => d.status === 'verified').length,
      icon: <ShieldCheck size={15} />, color: '#059669', bg: '#ECFDF3',
      filter: 'verified' as const,
    },
    {
      label: 'Pending Review', value: merchantDocs.filter(d => d.status === 'pending').length,
      icon: <Clock size={15} />, color: '#D97706', bg: '#FFFBEB',
      filter: 'pending' as const,
    },
    {
      label: 'Expired', value: merchantDocs.filter(d => d.status === 'expired').length,
      icon: <AlertTriangle size={15} />, color: '#DC2626', bg: '#FFF1F2',
      filter: 'expired' as const,
    },
    {
      label: 'Resubmission Required', value: merchantDocs.filter(d => d.status === 'resubmission_required').length,
      icon: <RefreshCw size={15} />, color: '#2563EB', bg: '#EFF6FF',
      filter: 'resubmission_required' as const,
    },
  ]

  const handleVerify = () => {
    setLoadingDialog(true)
    setTimeout(() => {
      setLoadingDialog(false)
      setVerifyTarget(null)
      showToast('success', 'Document Verified', `${verifyTarget?.docType} for ${verifyTarget?.merchantName} marked as verified.`)
    }, 900)
  }

  const handleResubmit = () => {
    if (!resubComment.trim()) return
    setLoadingDialog(true)
    setTimeout(() => {
      setLoadingDialog(false)
      setResubTarget(null)
      setResubComment('')
      showToast('info', 'Resubmission Requested', `${resubTarget?.merchantName} has been notified to resubmit their document.`)
    }, 900)
  }

  const expiryWarning = (d: MerchantDoc) => {
    if (!d.expiryDate) return false
    const days = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86400000)
    return days > 0 && days <= 30
  }

  return (
    <div className="p-6" style={{ minWidth: 1060 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Merchant Management
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Merchant Documents</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
            Review, verify, and manage compliance documents submitted by merchants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            onClick={() => showToast('success', 'Export Started', 'Document report is being generated.')}>
            <Download size={13} /> Export Report
          </button>
        </div>
      </div>

      {/* Stats cards — 5 columns, clickable to filter */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {statCards.map((s) => {
          const isActive = statusFilter2 === s.filter
          return (
            <button
              key={s.label}
              onClick={() => { setStatusFilter2(s.filter); setPage(1) }}
              className="rounded-lg p-3 text-left transition-all"
              style={{
                background: isActive ? s.bg : '#fff',
                border: `1px solid ${isActive ? s.color + '44' : '#E3E8F0'}`,
                boxShadow: isActive ? `0 0 0 1px ${s.color}22` : 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#FAFBFC' } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = '#E3E8F0'; e.currentTarget.style.background = '#fff' } }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="rounded-md flex items-center justify-center" style={{ width: 28, height: 28, background: isActive ? '#fff' : s.bg, color: s.color }}>
                  {s.icon}
                </div>
                {isActive && <span className="rounded-full" style={{ width: 6, height: 6, background: s.color, flexShrink: 0 }} />}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: isActive ? s.color : '#94A3B8', fontWeight: isActive ? 600 : 400, marginTop: 4 }}>{s.label}</div>
            </button>
          )
        })}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by merchant name, ID, or document type…"
          className="flex-1 outline-none bg-transparent"
          style={{ fontSize: 13, color: '#1A2332' }}
        />
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select
          value={statusFilter2}
          onChange={(e) => { setStatusFilter2(e.target.value as DocStatus | 'all'); setPage(1) }}
          className="outline-none bg-transparent"
          style={{ fontSize: 12, color: '#64748B' }}
        >
          <option value="all">All Statuses</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending Review</option>
          <option value="expired">Expired</option>
          <option value="resubmission_required">Resubmission Required</option>
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select
          value={docTypeFilter}
          onChange={(e) => { setDocTypeFilter(e.target.value); setPage(1) }}
          className="outline-none bg-transparent"
          style={{ fontSize: 12, color: '#64748B' }}
        >
          <option value="all">All Document Types</option>
          {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>
          <Filter size={12} className="inline mr-1" />{total} results
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Merchant', 'Document Type', 'Verification Status', 'Expiry Date', 'Last Verified', 'Reviewer', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-14">
                  <FileText size={28} color="#E3E8F0" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13, color: '#94A3B8' }}>No documents found</div>
                  <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 2 }}>Try adjusting your search or filters</div>
                </td>
              </tr>
            )}
            {rows.map((doc, i) => {
              const nearExpiry = expiryWarning(doc)
              return (
                <tr
                  key={doc.id}
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Merchant */}
                  <td className="px-4" style={{ height: 52 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{doc.merchantName}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{doc.merchantId} · {doc.merchantCity}</div>
                  </td>

                  {/* Document type */}
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, background: '#F1F5F9' }}>
                        <FileText size={13} color="#64748B" />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{doc.docType}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{doc.fileSize} · PDF</div>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4">
                    <DocStatusBadge status={doc.status} />
                  </td>

                  {/* Expiry date */}
                  <td className="px-4">
                    {doc.expiryDate ? (
                      <div className="flex items-center gap-1.5">
                        {nearExpiry && <AlertTriangle size={11} color="#D97706" />}
                        <span style={{
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: doc.status === 'expired' ? '#DC2626' : nearExpiry ? '#D97706' : '#475569',
                          fontWeight: (doc.status === 'expired' || nearExpiry) ? 500 : 400,
                        }}>
                          {doc.expiryDate}
                        </span>
                        {nearExpiry && <span style={{ fontSize: 10, color: '#D97706' }}>expiring soon</span>}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
                    )}
                  </td>

                  {/* Last verified */}
                  <td className="px-4">
                    {doc.lastVerifiedDate ? (
                      <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{doc.lastVerifiedDate}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#CBD5E1' }}>Not verified</span>
                    )}
                  </td>

                  {/* Reviewer */}
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold" style={{ width: 22, height: 22, background: '#1664FF', fontSize: 9 }}>
                        {doc.reviewer.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontSize: 12, color: '#475569' }}>{doc.reviewer}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4">
                    <div className="flex items-center gap-1">
                      <ActionBtn
                        title="Preview document"
                        onClick={() => { setDrawerDoc(doc); setDrawerDocTab('preview') }}
                        color="#1664FF"
                      >
                        <Eye size={12} />
                      </ActionBtn>
                      <ActionBtn
                        title="Download document"
                        onClick={() => showToast('success', 'Download Started', `${doc.docType} is downloading.`)}
                        color="#475569"
                      >
                        <Download size={12} />
                      </ActionBtn>
                      <ActionBtn
                        title="Verification history"
                        onClick={() => { setDrawerDoc(doc); setDrawerDocTab('history') }}
                        color="#7C3AED"
                      >
                        <History size={12} />
                      </ActionBtn>
                      {(doc.status === 'pending' || doc.status === 'expired') && (
                        <ActionBtn
                          title="Verify document"
                          onClick={() => setVerifyTarget(doc)}
                          color="#059669"
                        >
                          <CheckCircle size={12} />
                        </ActionBtn>
                      )}
                      {doc.status !== 'resubmission_required' && (
                        <ActionBtn
                          title="Request resubmission"
                          onClick={() => setResubTarget(doc)}
                          color="#D97706"
                        >
                          <RefreshCw size={12} />
                        </ActionBtn>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Showing {Math.min(start + 1, total)}–{Math.min(start + perPage, total)} of {total} documents
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>{i + 1}</PagBtn>
            ))}
            {totalPages > 5 && <span style={{ fontSize: 12, color: '#94A3B8', padding: '0 4px' }}>…</span>}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>

      {/* Document Preview / History Drawer */}
      <Drawer
        open={!!drawerDoc}
        onClose={() => setDrawerDoc(null)}
        title={drawerDoc?.docType ?? ''}
        subtitle={`${drawerDoc?.merchantName} · ${drawerDoc?.merchantId}`}
        width={520}
        footer={
          drawerDoc && (drawerDoc.status === 'pending' || drawerDoc.status === 'expired') ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setDrawerDoc(null); setResubTarget(drawerDoc) }}
                className="flex items-center gap-1.5 rounded-md px-3 font-medium"
                style={{ height: 36, fontSize: 13, color: '#D97706', border: '1px solid #FDE68A', background: '#FFFBEB' }}>
                <RefreshCw size={13} /> Request Resubmission
              </button>
              <button
                onClick={() => { setDrawerDoc(null); setVerifyTarget(drawerDoc) }}
                className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
                style={{ height: 36, fontSize: 13, background: '#059669' }}>
                <CheckCircle size={13} /> Verify Document
              </button>
            </div>
          ) : undefined
        }
      >
        {drawerDoc && (
          <>
            {/* Drawer tabs */}
            <div className="flex items-center -mx-6 px-6 mb-5" style={{ borderBottom: '1px solid #E3E8F0' }}>
              {(['preview', 'history'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDrawerDocTab(t)}
                  className="px-4 py-2.5 capitalize transition-colors"
                  style={{
                    fontSize: 13,
                    fontWeight: drawerDocTab === t ? 600 : 400,
                    color: drawerDocTab === t ? '#1664FF' : '#64748B',
                    borderBottom: drawerDocTab === t ? '2px solid #1664FF' : '2px solid transparent',
                  }}
                >
                  {t === 'preview' ? 'Document Preview' : 'Verification History'}
                </button>
              ))}
            </div>

            {drawerDocTab === 'preview' && (
              <div className="space-y-4">
                {/* Status banner */}
                <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{
                  background: drawerDoc.status === 'verified' ? '#ECFDF3' : drawerDoc.status === 'expired' ? '#FFF1F3' : drawerDoc.status === 'resubmission_required' ? '#EFF6FF' : '#FFFBEB',
                  border: `1px solid ${drawerDoc.status === 'verified' ? '#A7F3D0' : drawerDoc.status === 'expired' ? '#FECDD3' : drawerDoc.status === 'resubmission_required' ? '#BFDBFE' : '#FDE68A'}`,
                }}>
                  <DocStatusBadge status={drawerDoc.status} />
                  {drawerDoc.notes && <p style={{ fontSize: 12, color: '#64748B', maxWidth: 260 }}>{drawerDoc.notes}</p>}
                </div>

                {/* Document thumbnail */}
                <DocThumbnail doc={drawerDoc} />

                {/* Metadata grid */}
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
                  {[
                    { label: 'Document Type', value: drawerDoc.docType },
                    { label: 'Merchant', value: `${drawerDoc.merchantName} (${drawerDoc.merchantId})` },
                    { label: 'File Name', value: drawerDoc.fileName, mono: true },
                    { label: 'Uploaded Date', value: drawerDoc.uploadedDate, mono: true },
                    { label: 'Expiry Date', value: drawerDoc.expiryDate ?? 'No expiry', mono: true, warn: drawerDoc.status === 'expired' },
                    { label: 'Last Verified', value: drawerDoc.lastVerifiedDate ?? 'Not yet verified', mono: true },
                    { label: 'Assigned Reviewer', value: drawerDoc.reviewer },
                  ].map((f, fi) => (
                    <div key={fi} className="flex items-center px-4" style={{ height: 40, borderBottom: fi < 6 ? '1px solid #F8FAFC' : 'none', background: fi % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <div style={{ fontSize: 12, color: '#94A3B8', width: 160, flexShrink: 0 }}>{f.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: f.warn ? '#DC2626' : '#1A2332', fontFamily: f.mono ? 'monospace' : 'inherit', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                {/* Download button */}
                <button
                  onClick={() => showToast('success', 'Download Started', `${drawerDoc.docType} is downloading.`)}
                  className="flex items-center gap-2 w-full justify-center rounded-lg font-medium"
                  style={{ height: 40, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#F8FAFC' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                >
                  <Download size={14} /> Download Original Document
                </button>
              </div>
            )}

            {drawerDocTab === 'history' && (
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>
                  Complete audit trail for this document
                </div>
                <div className="relative pl-5" style={{ borderLeft: '2px solid #E3E8F0' }}>
                  {drawerDoc.history.map((h, hi) => {
                    const isLast = hi === drawerDoc.history.length - 1
                    const dotColor = hi === drawerDoc.history.length - 1
                      ? (drawerDoc.status === 'verified' ? '#059669' : drawerDoc.status === 'expired' ? '#DC2626' : '#D97706')
                      : '#94A3B8'
                    return (
                      <div key={hi} className="mb-5 relative">
                        <div
                          className="absolute rounded-full border-2 bg-white"
                          style={{ width: 10, height: 10, left: -22, top: 3, borderColor: dotColor, background: isLast ? dotColor : '#fff' }}
                        />
                        <div className="flex items-center gap-2 mb-0.5">
                          <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{h.date}</span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: '#64748B' }}>{h.by}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{h.action}</div>
                        {h.note && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{h.note}</div>}
                      </div>
                    )
                  })}
                </div>

                {/* Expiry warning */}
                {drawerDoc.expiryDate && drawerDoc.status !== 'expired' && expiryWarning(drawerDoc) && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <Calendar size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12, color: '#92400E' }}>
                      This document expires on <strong>{drawerDoc.expiryDate}</strong>. Consider requesting a renewal.
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Verify dialog */}
      <Dialog
        open={!!verifyTarget}
        onClose={() => setVerifyTarget(null)}
        variant="success"
        title="Verify Document"
        message={`Confirm that "${verifyTarget?.docType}" submitted by ${verifyTarget?.merchantName} is valid and meets platform requirements.`}
        confirmLabel="Mark as Verified"
        onConfirm={handleVerify}
        loading={loadingDialog}
      />

      {/* Request Resubmission dialog */}
      <Dialog
        open={!!resubTarget}
        onClose={() => { setResubTarget(null); setResubComment('') }}
        variant="warning"
        title="Request Document Resubmission"
        message={`Notify ${resubTarget?.merchantName} to resubmit their "${resubTarget?.docType}".`}
        confirmLabel="Send Notification"
        onConfirm={handleResubmit}
        loading={loadingDialog}
      >
        <div className="mt-3">
          <label style={{ fontSize: 12, color: '#64748B', display: 'block', marginBottom: 6 }}>
            Reason for Resubmission <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <select
            className="w-full rounded-md px-3 py-2 outline-none mb-2"
            style={{ fontSize: 13, border: '1px solid #E3E8F0', background: '#fff' }}
            onChange={(e) => setResubComment(e.target.value)}
          >
            <option value="">Select reason…</option>
            <option value="Document image is unclear or too low resolution">Document image is unclear or too low resolution</option>
            <option value="Document has expired">Document has expired</option>
            <option value="Information does not match registration records">Information does not match registration records</option>
            <option value="Missing required sections or signatures">Missing required sections or signatures</option>
            <option value="Wrong document type submitted">Wrong document type submitted</option>
            <option value="Document appears to be tampered with">Document appears to be tampered with</option>
          </select>
          <textarea
            value={resubComment}
            onChange={(e) => setResubComment(e.target.value)}
            placeholder="Add additional instructions for the merchant (optional)…"
            className="w-full rounded-md px-3 py-2 outline-none resize-none"
            style={{ fontSize: 13, border: '1px solid #E3E8F0', height: 80 }}
          />
        </div>
      </Dialog>
    </div>
  )
}

// ─── Activity log data ────────────────────────────────────────────────────────

type ActivityType = 'login' | 'profile_update' | 'suspension' | 'reactivation' | 'document_upload' | 'verification' | 'warning' | 'impersonation' | 'booking'

interface ActivityLog {
  id: string
  timestamp: string
  merchantId: string
  merchantName: string
  activityType: ActivityType
  description: string
  performedBy: string
  ipAddress: string
  status: 'success' | 'failed' | 'pending'
}

const admins = ['Zhang Wei', 'Li Min', 'Wang Fang', 'Chen Jing', 'Liu Yang', 'System']

const activityDescriptions: Record<ActivityType, string[]> = {
  login: ['Merchant portal login', 'Login via mobile app', 'Login from new device detected'],
  profile_update: ['Updated hotel description', 'Changed contact phone number', 'Updated bank account details', 'Modified room pricing'],
  suspension: ['Account suspended for policy violation', 'Account suspended pending investigation', 'Suspended due to repeated violations'],
  reactivation: ['Account reactivated after review', 'Suspension lifted — appeal approved', 'Account restored by admin'],
  document_upload: ['Uploaded Business Registration Certificate', 'Submitted Hotel Operating License', 'Uploaded Owner Identity Document', 'Submitted Tax Registration Certificate'],
  verification: ['Business registration verified', 'Hotel license approved', 'Identity document verified', 'Bank account verification completed'],
  warning: ['1st warning issued for slow response SLA', '2nd warning issued for cancellation policy', 'Warning issued for price parity violation'],
  impersonation: ['Admin impersonation session started', 'Admin impersonation session ended'],
  booking: ['Booking dispute investigated', 'Refund request processed by admin'],
}

const activityTypes: ActivityType[] = ['login', 'profile_update', 'suspension', 'reactivation', 'document_upload', 'verification', 'warning', 'impersonation', 'booking']

function makeIp(seed: number) {
  return `${(seed * 17 % 223) + 10}.${(seed * 31 % 255)}.${(seed * 7 % 255)}.${(seed * 13 % 254) + 1}`
}

const activityLogs: ActivityLog[] = merchants.flatMap((m, mi) =>
  Array.from({ length: 4 + (mi % 3) }, (_, ai) => {
    const type = activityTypes[(mi * 4 + ai) % activityTypes.length]
    const descs = activityDescriptions[type]
    const ts = new Date(2024, 11, 15 - ((mi + ai) % 15), 8 + ((mi + ai) % 14), (ai * 17) % 60)
    return {
      id: `ACT-${String(mi * 6 + ai + 1).padStart(5, '0')}`,
      timestamp: ts.toISOString().replace('T', ' ').slice(0, 16),
      merchantId: m.id,
      merchantName: m.merchantName,
      activityType: type,
      description: descs[(mi + ai) % descs.length],
      performedBy: type === 'login' || type === 'profile_update' || type === 'document_upload' ? m.merchantName : admins[(mi + ai) % admins.length],
      ipAddress: makeIp(mi * 10 + ai),
      status: ((mi + ai) % 7 === 0 ? 'failed' : (mi + ai) % 11 === 0 ? 'pending' : 'success') as 'success' | 'failed' | 'pending',
    }
  })
).sort((a, b) => b.timestamp.localeCompare(a.timestamp))

// Activity type visual config
const activityConfig: Record<ActivityType, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  login: { label: 'Login', color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE', icon: <LogIn size={13} /> },
  profile_update: { label: 'Profile Update', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: <FileText size={13} /> },
  suspension: { label: 'Suspension', color: '#DC2626', bg: '#FFF1F2', border: '#FECDD3', icon: <AlertTriangle size={13} /> },
  reactivation: { label: 'Reactivation', color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', icon: <CheckCircle size={13} /> },
  document_upload: { label: 'Document Upload', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: <FileText size={13} /> },
  verification: { label: 'Verification', color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', icon: <ShieldCheck size={13} /> },
  warning: { label: 'Warning', color: '#C2410C', bg: '#FFF7ED', border: '#FDBA74', icon: <AlertCircle size={13} /> },
  impersonation: { label: 'Impersonation', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', icon: <LogIn size={13} /> },
  booking: { label: 'Booking', color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', icon: <Calendar size={13} /> },
}


function ActivityStatusBadge({ status }: { status: ActivityLog['status'] }) {
  const cfg = {
    success: { bg: '#ECFDF3', color: '#027A48', label: 'Success' },
    failed: { bg: '#FFF1F3', color: '#C01048', label: 'Failed' },
    pending: { bg: '#FFFBEB', color: '#B45308', label: 'Pending' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, height: 20, background: c.bg, color: c.color }}>{c.label}</span>
}

// Activity icon pill shown in the drawer timeline
function ActivityIcon({ type }: { type: ActivityType }) {
  const c = activityConfig[type]
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.icon}
    </div>
  )
}

function MerchantActivitiesPage({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all')
  const [adminFilter, setAdminFilter] = useState('all')
  const [merchantFilter, setMerchantFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [drawerLog, setDrawerLog] = useState<ActivityLog | null>(null)
  const perPage = 15

  const filtered = activityLogs.filter((a) => {
    const matchType = typeFilter === 'all' || a.activityType === typeFilter
    const matchAdmin = adminFilter === 'all' || a.performedBy === adminFilter
    const matchMerchant = merchantFilter === 'all' || a.merchantId === merchantFilter
    const matchSearch = !search ||
      a.merchantName.toLowerCase().includes(search.toLowerCase()) ||
      a.merchantId.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.performedBy.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase())
    return matchType && matchAdmin && matchMerchant && matchSearch
  })

  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  // Stat counts
  const typeCounts = Object.fromEntries(
    activityTypes.map(t => [t, activityLogs.filter(a => a.activityType === t).length])
  )

  const highlightStats = [
    { type: 'login' as ActivityType },
    { type: 'suspension' as ActivityType },
    { type: 'verification' as ActivityType },
    { type: 'warning' as ActivityType },
    { type: 'document_upload' as ActivityType },
    { type: 'profile_update' as ActivityType },
  ]

  return (
    <div className="p-6" style={{ minWidth: 1060 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Merchant Management
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Merchant Activities</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Audit log of all merchant and administrator actions across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            onClick={() => showToast('success', 'Export Started', 'Activity log is being exported.')}>
            <Download size={13} /> Export Log
          </button>
        </div>
      </div>

      {/* Activity type stat pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => { setTypeFilter('all'); setPage(1) }}
          className="flex items-center gap-1.5 rounded-full px-3 font-medium transition-all"
          style={{ height: 30, fontSize: 12, background: typeFilter === 'all' ? '#1A2332' : '#F1F5F9', color: typeFilter === 'all' ? '#fff' : '#475569', border: '1px solid transparent' }}>
          All Activities
          <span className="rounded-full px-1.5 font-mono" style={{ fontSize: 10, background: typeFilter === 'all' ? 'rgba(255,255,255,0.2)' : '#E3E8F0', color: typeFilter === 'all' ? '#fff' : '#64748B' }}>{activityLogs.length}</span>
        </button>
        {highlightStats.map(({ type }) => {
          const c = activityConfig[type]
          const isActive = typeFilter === type
          return (
            <button
              key={type}
              onClick={() => { setTypeFilter(type); setPage(1) }}
              className="flex items-center gap-1.5 rounded-full px-3 font-medium transition-all"
              style={{ height: 30, fontSize: 12, background: isActive ? c.color : c.bg, color: isActive ? '#fff' : c.color, border: `1px solid ${isActive ? c.color : c.border}` }}>
              {c.icon} {c.label}
              <span className="rounded-full px-1.5 font-mono" style={{ fontSize: 10, background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)', color: isActive ? '#fff' : c.color }}>
                {typeCounts[type]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by merchant name, activity description, performed by, or log ID…"
          className="flex-1 outline-none bg-transparent"
          style={{ fontSize: 13, color: '#1A2332' }}
        />
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as ActivityType | 'all'); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="all">All Activity Types</option>
          {activityTypes.map(t => <option key={t} value={t}>{activityConfig[t].label}</option>)}
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select value={adminFilter} onChange={(e) => { setAdminFilter(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="all">All Administrators</option>
          {admins.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select value={merchantFilter} onChange={(e) => { setMerchantFilter(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B', maxWidth: 160 }}>
          <option value="all">All Merchants</option>
          {merchants.slice(0, 20).map(m => <option key={m.id} value={m.id}>{m.merchantName}</option>)}
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>
          <Filter size={12} className="inline mr-1" />{total} results
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Activity Time', 'Merchant', 'Activity Type', 'Description', 'Performed By', 'IP Address', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-14">
                  <History size={28} color="#E3E8F0" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13, color: '#94A3B8' }}>No activity logs found</div>
                  <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 2 }}>Try adjusting your filters</div>
                </td>
              </tr>
            )}
            {rows.map((log, i) => {
              const cfg = activityConfig[log.activityType]
              return (
                <tr
                  key={log.id}
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Timestamp */}
                  <td className="px-4" style={{ height: 52, whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#1A2332', fontWeight: 500 }}>{log.timestamp.slice(0, 10)}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{log.timestamp.slice(11)}</div>
                  </td>

                  {/* Merchant */}
                  <td className="px-4">
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{log.merchantName}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{log.merchantId}</div>
                  </td>

                  {/* Activity type */}
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ width: 26, height: 26, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.icon}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
                    </div>
                  </td>

                  {/* Description */}
                  <td className="px-4" style={{ maxWidth: 240 }}>
                    <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.description}
                    </div>
                  </td>

                  {/* Performed by */}
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
                        style={{ width: 22, height: 22, fontSize: 9, background: log.performedBy === 'System' ? '#94A3B8' : log.performedBy === log.merchantName ? '#7C3AED' : '#1664FF' }}>
                        {log.performedBy === 'System' ? 'SYS' : log.performedBy.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{log.performedBy}</span>
                    </div>
                  </td>

                  {/* IP Address */}
                  <td className="px-4">
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{log.ipAddress}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4">
                    <ActivityStatusBadge status={log.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-4">
                    <ActionBtn
                      title="View activity details"
                      onClick={() => setDrawerLog(log)}
                      color="#1664FF"
                    >
                      <Eye size={12} />
                    </ActionBtn>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Showing {Math.min(start + 1, total)}–{Math.min(start + perPage, total)} of {total} events
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>{i + 1}</PagBtn>
            ))}
            {totalPages > 5 && <span style={{ fontSize: 12, color: '#94A3B8', padding: '0 4px' }}>…</span>}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>

      {/* Activity Detail Drawer */}
      <Drawer
        open={!!drawerLog}
        onClose={() => setDrawerLog(null)}
        title="Activity Detail"
        subtitle={`Log ID: ${drawerLog?.id}`}
        width={480}
      >
        {drawerLog && (() => {
          const cfg = activityConfig[drawerLog.activityType]
          return (
            <div className="space-y-5">
              {/* Type banner */}
              <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <ActivityIcon type={drawerLog.activityType} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{drawerLog.description}</div>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <ActivityStatusBadge status={drawerLog.status} />
                </div>
              </div>

              {/* Detail fields */}
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
                {[
                  { label: 'Log ID', value: drawerLog.id, mono: true },
                  { label: 'Activity Time', value: drawerLog.timestamp, mono: true },
                  { label: 'Merchant', value: `${drawerLog.merchantName} (${drawerLog.merchantId})` },
                  { label: 'Activity Type', value: cfg.label },
                  { label: 'Description', value: drawerLog.description },
                  { label: 'Performed By', value: drawerLog.performedBy },
                  { label: 'IP Address', value: drawerLog.ipAddress, mono: true },
                  { label: 'Status', value: drawerLog.status.charAt(0).toUpperCase() + drawerLog.status.slice(1) },
                ].map((f, fi) => (
                  <div key={fi} className="flex items-center px-4"
                    style={{ height: 44, borderBottom: fi < 7 ? '1px solid #F8FAFC' : 'none', background: fi % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <div style={{ fontSize: 12, color: '#94A3B8', width: 148, flexShrink: 0 }}>{f.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332', fontFamily: f.mono ? 'monospace' : 'inherit', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Session context note */}
              <div className="rounded-lg px-4 py-3" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Audit Note</div>
                <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                  This activity was automatically recorded by the mTrip audit system. All platform actions are logged for compliance and security purposes.
                  {drawerLog.activityType === 'impersonation' && ' Impersonation sessions require admin approval and are fully auditable.'}
                  {drawerLog.status === 'failed' && ' This action failed — review server logs for further details.'}
                </p>
              </div>
            </div>
          )
        })()}
      </Drawer>
    </div>
  )
}

// ─── Main Merchant Page ───────────────────────────────────────────────────────

export default function MerchantPage({ tab, showToast, onImpersonate }: Props) {
  // Route documents tab to its own view
  if (tab === 'merchants-documents') {
    return <MerchantDocumentsPage showToast={showToast} />
  }

  // Route activities tab to its own view
  if (tab === 'merchants-activities') {
    return <MerchantActivitiesPage showToast={showToast} />
  }

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [drawerMerchant, setDrawerMerchant] = useState<Merchant | null>(null)
  const [notifMerchant, setNotifMerchant] = useState<Merchant | null>(null)
  const [impersonateTarget, setImpersonateTarget] = useState<Merchant | null>(null)
  const [impersonateReason, setImpersonateReason] = useState('')
  const [suspendTarget, setSuspendTarget] = useState<Merchant | null>(null)
  const [loading, setLoading] = useState(false)

  const notifRecipient: NotifRecipient | null = notifMerchant ? {
    kind: 'merchant', id: notifMerchant.id, name: notifMerchant.merchantName,
    email: notifMerchant.email, phone: notifMerchant.phone,
    avatar: notifMerchant.merchantName.slice(0, 2).toUpperCase(),
    avatarBg: '#1664FF',
  } : null
  const perPage = 10

  const allowedStatuses = statusFilter[tab] ?? ['active', 'suspended', 'inactive']
  const filtered = merchants.filter((m) => {
    const matchStatus = allowedStatuses.includes(m.status)
    const matchSearch = !search || m.merchantName.toLowerCase().includes(search.toLowerCase()) ||
      m.id.includes(search) || m.email.includes(search) || m.phone.includes(search) || m.businessRegNo.includes(search)
    return matchStatus && matchSearch
  })

  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const stats = [
    { label: 'Total Merchants', value: merchants.length },
    { label: 'Active', value: merchants.filter(m => m.status === 'active').length },
    { label: 'Suspended', value: merchants.filter(m => m.status === 'suspended').length },
    { label: 'Blacklisted Merchants', value: merchants.filter(m => m.status === 'inactive').length },
  ]

  const handleImpersonate = () => {
    if (!impersonateReason) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setImpersonateTarget(null)
      setImpersonateReason('')
      onImpersonate({ merchantName: impersonateTarget!.merchantName, merchantId: impersonateTarget!.id, reason: impersonateReason })
    }, 800)
  }

  const handleSuspend = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSuspendTarget(null)
      showToast('warning', 'Merchant Suspended', `${suspendTarget?.merchantName} has been suspended.`)
    }, 800)
  }

  return (
    <>
    <NotificationDrawer open={!!notifMerchant} recipient={notifRecipient} onClose={() => setNotifMerchant(null)} showToast={showToast} />
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Merchant Management
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{(tabPageConfig[tab] ?? tabPageConfig['merchants'])!.title}</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{(tabPageConfig[tab] ?? tabPageConfig['merchants'])!.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
            <Download size={13} /> Export
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-3 text-white" style={{ height: 34, fontSize: 13, background: '#1664FF', fontWeight: 500 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0E4FCC')} onMouseLeave={(e) => (e.currentTarget.style.background = '#1664FF')}>
            <Plus size={13} /> Add Merchant
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((s) => {
          const isBlacklisted = s.label === 'Blacklisted Merchants'
          return (
            <div key={s.label} className="rounded-lg p-3" style={{ background: isBlacklisted ? '#FFF8F8' : '#fff', border: `1px solid ${isBlacklisted ? '#FECDD3' : '#E3E8F0'}` }}>
              <div className="flex items-center gap-1.5 mb-1">
                {isBlacklisted && <AlertCircle size={12} color="#DC2626" />}
                <div style={{ fontSize: 11, color: isBlacklisted ? '#DC2626' : '#94A3B8', fontWeight: 500 }}>{s.label}</div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: isBlacklisted ? '#DC2626' : '#1A2332', fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          )
        })}
      </div>

      {/* Search/Filter */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search merchant name, ID, registration, email..." className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Status</option><option>Active</option><option>Suspended</option><option>Inactive</option></select>
        <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Categories</option><option>Hotel</option><option>Resort</option><option>Boutique</option></select>
        <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Plans</option><option>VIP</option><option>Premium</option><option>Standard</option></select>
        <span style={{ fontSize: 12, color: '#94A3B8' }}><Filter size={12} className="inline mr-1" />{total} results</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Merchant ID', 'Merchant Name', 'Category', 'Commission Plan', 'Verification', 'Account Status', 'Revenue MTD', 'Last Login', 'Actions'].map((h) => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-3" style={{ height: 48 }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 500 }}>{m.id}</span>
                    {m.isVip && <Star size={11} fill="#F59E0B" color="#F59E0B" />}
                  </div>
                </td>
                <td className="px-3">
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{m.merchantName}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.city} · {m.stars}★</div>
                </td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569', textTransform: 'capitalize' }}>{m.category.replace('_', ' ')}</td>
                <td className="px-3"><PlanBadge plan={m.commissionPlan} /></td>
                <td className="px-3"><VerifBadge status={m.verificationStatus} /></td>
                <td className="px-3"><StatusBadge status={m.status} /></td>
                <td className="px-3">
                  {m.monthlyRevenue > 0 ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace' }}>¥{(m.monthlyRevenue / 1000000).toFixed(1)}M</span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>
                  )}
                </td>
                <td className="px-3" style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {m.lastLogin === 'Never' ? <span style={{ color: '#CBD5E1' }}>Never</span> : m.lastLogin.slice(0, 10)}
                </td>
                <td className="px-3">
                  <div className="flex items-center gap-1">
                    <ActionBtn onClick={() => setDrawerMerchant(m)} color="#1664FF"><Eye size={12} /></ActionBtn>
                    <ActionBtn onClick={() => setNotifMerchant(m)} color="#6366F1" title="Notify Merchant"><Bell size={12} /></ActionBtn>
                    <ActionBtn onClick={() => setImpersonateTarget(m)} color="#D97706"><LogIn size={12} /></ActionBtn>
                    {m.status === 'active' && <ActionBtn onClick={() => setSuspendTarget(m)} color="#DC2626"><MoreHorizontal size={12} /></ActionBtn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min(start + 1, total)}–{Math.min(start + perPage, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: totalPages }).map((_, i) => <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>{i + 1}</PagBtn>)}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>

      {/* Merchant Profile Drawer */}
      <Drawer open={!!drawerMerchant} onClose={() => setDrawerMerchant(null)} title={drawerMerchant?.merchantName ?? ''} subtitle={`${drawerMerchant?.id} · ${drawerMerchant?.city}`} width={600}>
        {drawerMerchant && (
          <div className="space-y-5">
            <div className="flex items-start justify-between rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332' }}>{drawerMerchant.merchantName}</h3>
                  {drawerMerchant.isVip && <span className="rounded px-1.5 font-medium" style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E' }}>VIP</span>}
                </div>
                <div style={{ fontSize: 13, color: '#64748B' }}>{drawerMerchant.businessName}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{drawerMerchant.city}, {drawerMerchant.country} · {drawerMerchant.stars}★ · {drawerMerchant.rooms} rooms</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={drawerMerchant.status} />
                <VerifBadge status={drawerMerchant.verificationStatus} />
              </div>
            </div>
            <DrawerGrid>
              <DrawerField label="Merchant ID" value={drawerMerchant.id} mono />
              <DrawerField label="Business Reg. No." value={drawerMerchant.businessRegNo} mono />
              <DrawerField label="Owner" value={drawerMerchant.ownerName} />
              <DrawerField label="Commission Plan" value={`${drawerMerchant.commissionPlan} (${drawerMerchant.commissionRate}%)`} />
              <DrawerField label="Email" value={drawerMerchant.email} />
              <DrawerField label="Phone" value={drawerMerchant.phone} mono />
              <DrawerField label="Bank Name" value={drawerMerchant.bankName} />
              <DrawerField label="Bank Account" value={drawerMerchant.bankAccount} mono />
              <DrawerField label="Join Date" value={drawerMerchant.joinDate} mono />
              <DrawerField label="Last Login" value={drawerMerchant.lastLogin} mono />
            </DrawerGrid>
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Monthly Performance</h4>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="rounded-lg p-3 text-center" style={{ background: '#EEF4FF', border: '1px solid #BFDBFE' }}>
                  <div style={{ fontSize: 11, color: '#2563EB', marginBottom: 4 }}>Revenue MTD</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1E40AF', fontFamily: 'monospace' }}>
                    {drawerMerchant.monthlyRevenue > 0 ? `¥${(drawerMerchant.monthlyRevenue / 1000000).toFixed(2)}M` : '—'}
                  </div>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ background: '#ECFDF3', border: '1px solid #A7F3D0' }}>
                  <div style={{ fontSize: 11, color: '#059669', marginBottom: 4 }}>Bookings MTD</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#065F46', fontFamily: 'monospace' }}>
                    {drawerMerchant.monthlyBookings > 0 ? drawerMerchant.monthlyBookings.toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setDrawerMerchant(null); setImpersonateTarget(drawerMerchant) }} className="flex items-center gap-2 rounded-md px-4 font-medium" style={{ height: 36, fontSize: 13, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                <LogIn size={13} /> Impersonate
              </button>
              <button onClick={() => { const m = drawerMerchant; setDrawerMerchant(null); setNotifMerchant(m) }} className="flex items-center gap-2 rounded-md px-4 font-medium" style={{ height: 36, fontSize: 13, background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' }}>
                <Bell size={13} /> Notify Merchant
              </button>
              {drawerMerchant.status === 'active' && (
                <button onClick={() => { setDrawerMerchant(null); setSuspendTarget(drawerMerchant) }} className="flex items-center gap-2 rounded-md px-4 font-medium" style={{ height: 36, fontSize: 13, background: '#FFF1F3', color: '#BE123C', border: '1px solid #FECDD3' }}>
                  Suspend
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Impersonation dialog */}
      <Dialog open={!!impersonateTarget} onClose={() => { setImpersonateTarget(null); setImpersonateReason('') }} variant="warning"
        title="Start Impersonation Session"
        message={`You are about to impersonate "${impersonateTarget?.merchantName}". All actions during this session will be recorded in the audit log.`}
        confirmLabel="Start Impersonation" onConfirm={handleImpersonate} loading={loading}>
        <div className="mt-3">
          <label style={{ fontSize: 12, color: '#64748B', display: 'block', marginBottom: 6 }}>Reason for Impersonation <span style={{ color: '#DC2626' }}>*</span></label>
          <select className="w-full rounded-md px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E3E8F0', background: '#fff' }}
            value={impersonateReason} onChange={(e) => setImpersonateReason(e.target.value)}>
            <option value="">Select reason...</option>
            {impersonateReasons.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={!!suspendTarget} onClose={() => setSuspendTarget(null)} variant="danger"
        title="Suspend Merchant"
        message={`This will immediately suspend "${suspendTarget?.merchantName}" and prevent new bookings. Existing confirmed bookings will not be affected.`}
        confirmLabel="Suspend Merchant" onConfirm={handleSuspend} loading={loading} />
    </div>
    </>
  )
}

function DrawerGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>{children}</div>
}

function DrawerField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  )
}

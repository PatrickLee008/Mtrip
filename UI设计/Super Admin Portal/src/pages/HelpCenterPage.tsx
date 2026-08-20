import { useState } from 'react'
import {
  Search, Plus, Download, Eye, Edit2, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Star, Bold, Italic, Link, Image,
  Paperclip, Clock, Filter, RefreshCw, XCircle,
} from 'lucide-react'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

// ── Shared components ─────────────────────────────────────────────────────────

type Audience = 'Customer' | 'Merchant' | 'Affiliate' | 'Influencer' | 'All'
type ArticleStatus = 'published' | 'draft' | 'archived'
type AnnouncementStatus = 'active' | 'scheduled' | 'expired' | 'draft'

const AUDIENCES: Audience[] = ['Customer', 'Merchant', 'Affiliate', 'Influencer', 'All']

const AUDIENCE_STYLE: Record<Audience, { bg: string; color: string }> = {
  Customer:   { bg: '#EFF6FF', color: '#1D4ED8' },
  Merchant:   { bg: '#FFF7ED', color: '#9A3412' },
  Affiliate:  { bg: '#EDE9FE', color: '#5B21B6' },
  Influencer: { bg: '#FFF1F3', color: '#BE123C' },
  All:        { bg: '#F0FDF4', color: '#166534' },
}

const ARTICLE_STATUS_STYLE: Record<ArticleStatus, { bg: string; color: string; label: string }> = {
  published: { bg: '#ECFDF3', color: '#027A48', label: 'Published' },
  draft:     { bg: '#F8FAFC', color: '#475569', label: 'Draft' },
  archived:  { bg: '#FFF1F3', color: '#C01048', label: 'Archived' },
}

const CATEGORIES = ['Booking', 'Payment', 'Merchant', 'Affiliate', 'Promotion', 'Refund', 'Account', 'Platform']

const CAT_COLOR: Record<string, { bg: string; color: string }> = {
  Booking:   { bg: '#EFF6FF', color: '#1664FF' },
  Payment:   { bg: '#ECFDF3', color: '#059669' },
  Merchant:  { bg: '#FFF7ED', color: '#D97706' },
  Affiliate: { bg: '#EDE9FE', color: '#7C3AED' },
  Promotion: { bg: '#FFF1F3', color: '#BE123C' },
  Refund:    { bg: '#FFFAEB', color: '#B54708' },
  Account:   { bg: '#F0FDF4', color: '#166534' },
  Platform:  { bg: '#F1F5F9', color: '#475569' },
}

function AudienceBadge({ audience }: { audience: Audience }) {
  const s = AUDIENCE_STYLE[audience]
  return (
    <span className="inline-flex items-center rounded px-1.5 font-medium"
      style={{ fontSize: 11, height: 20, background: s.bg, color: s.color }}>{audience}</span>
  )
}

function CatBadge({ cat }: { cat: string }) {
  const s = CAT_COLOR[cat] ?? { bg: '#F1F5F9', color: '#475569' }
  return (
    <span className="inline-flex items-center rounded px-1.5 font-medium"
      style={{ fontSize: 11, height: 20, background: s.bg, color: s.color }}>{cat}</span>
  )
}

function StatusDot({ status }: { status: ArticleStatus }) {
  const s = ARTICLE_STATUS_STYLE[status]
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{s.label}</span>
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

function PageShell({ title, subtitle, actions, kpis, children }: {
  title: string; subtitle: string; actions?: React.ReactNode
  kpis?: { label: string; value: string | number; color: string; sub?: string }[]
  children: React.ReactNode
}) {
  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Help Center Management</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{title}</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{subtitle}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {kpis && (
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: `repeat(${kpis.length}, 1fr)` }}>
          {kpis.map(k => (
            <div key={k.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Data ─────────────────────────────────────────────────────────────────────

interface Article {
  id: string; title: string; category: string; audience: Audience
  views: number; lastUpdated: string; status: ArticleStatus
  content: string; attachments: number; images: number; author: string
}

const initialArticles: Article[] = [
  { id: 'ART-001', title: 'How to make a hotel booking on mTrip',         category: 'Booking',   audience: 'Customer',   views: 12840, lastUpdated: '2024-12-10', status: 'published', content: 'Step-by-step guide for booking hotels through the mTrip platform...', attachments: 0, images: 3, author: 'Admin Chen' },
  { id: 'ART-002', title: 'How to cancel or modify a booking',            category: 'Booking',   audience: 'Customer',   views: 9210,  lastUpdated: '2024-12-09', status: 'published', content: 'To cancel or modify your booking, follow these steps...', attachments: 1, images: 2, author: 'Admin Li' },
  { id: 'ART-003', title: 'Supported payment methods',                    category: 'Payment',   audience: 'Customer',   views: 8740,  lastUpdated: '2024-12-08', status: 'published', content: 'mTrip supports the following payment methods: Alipay, WeChat Pay...', attachments: 0, images: 1, author: 'Admin Zhang' },
  { id: 'ART-004', title: 'How to submit your hotel for review',          category: 'Merchant',  audience: 'Merchant',   views: 6320,  lastUpdated: '2024-12-07', status: 'published', content: 'To list your hotel on mTrip, complete the onboarding form...', attachments: 2, images: 4, author: 'Admin Chen' },
  { id: 'ART-005', title: 'Understanding your commission structure',      category: 'Affiliate', audience: 'Affiliate',  views: 5180,  lastUpdated: '2024-12-06', status: 'published', content: 'Commission is calculated based on your tier and booking value...', attachments: 1, images: 0, author: 'Admin Li' },
  { id: 'ART-006', title: 'How to request a refund',                     category: 'Refund',    audience: 'Customer',   views: 7890,  lastUpdated: '2024-12-05', status: 'published', content: 'Refund requests must be submitted within 48 hours of check-out...', attachments: 0, images: 2, author: 'Admin Zhang' },
  { id: 'ART-007', title: 'Setting up your influencer referral link',    category: 'Affiliate', audience: 'Influencer', views: 3240,  lastUpdated: '2024-12-04', status: 'published', content: 'Your personal referral link can be found in your dashboard...', attachments: 0, images: 1, author: 'Admin Chen' },
  { id: 'ART-008', title: 'Platform service fees explained',              category: 'Platform',  audience: 'All',        views: 4510,  lastUpdated: '2024-12-03', status: 'published', content: 'mTrip charges a platform service fee on all bookings...', attachments: 0, images: 0, author: 'Admin Li' },
  { id: 'ART-009', title: 'How to apply a promotional voucher',          category: 'Promotion', audience: 'Customer',   views: 5640,  lastUpdated: '2024-12-02', status: 'published', content: 'Vouchers can be applied at checkout. Enter the code in the promo field...', attachments: 0, images: 2, author: 'Admin Zhang' },
  { id: 'ART-010', title: 'Account verification requirements',           category: 'Account',   audience: 'Merchant',   views: 2910,  lastUpdated: '2024-12-01', status: 'published', content: 'To verify your merchant account, upload the following documents...', attachments: 3, images: 0, author: 'Admin Chen' },
  { id: 'ART-011', title: 'Merchant settlement schedule and timelines',  category: 'Payment',   audience: 'Merchant',   views: 2180,  lastUpdated: '2024-11-28', status: 'draft',     content: 'Settlements are processed on the 1st and 15th of each month...', attachments: 1, images: 0, author: 'Admin Li' },
  { id: 'ART-012', title: 'How to dispute a transaction',                category: 'Payment',   audience: 'Customer',   views: 1840,  lastUpdated: '2024-11-25', status: 'draft',     content: 'To dispute a transaction, contact support within 30 days...', attachments: 0, images: 1, author: 'Admin Zhang' },
  { id: 'ART-013', title: 'Affiliate payout withdrawal guide',           category: 'Affiliate', audience: 'Affiliate',  views: 980,   lastUpdated: '2024-11-20', status: 'draft',     content: 'Withdrawals can be requested once your balance exceeds ¥100...', attachments: 1, images: 0, author: 'Admin Chen' },
  { id: 'ART-014', title: 'Legacy booking system migration guide',       category: 'Platform',  audience: 'Merchant',   views: 420,   lastUpdated: '2024-10-15', status: 'archived',  content: 'This guide covers migration from the old system...', attachments: 2, images: 3, author: 'Admin Li' },
]

interface Announcement {
  id: string; title: string; audience: Audience
  startDate: string; startTime: string; endDate: string; endTime: string
  status: AnnouncementStatus; content: string; priority: 'high' | 'normal' | 'low'
}

const ANN_STATUS_STYLE: Record<AnnouncementStatus, { bg: string; color: string; label: string }> = {
  active:    { bg: '#ECFDF3', color: '#027A48', label: 'Active' },
  scheduled: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Scheduled' },
  expired:   { bg: '#F1F5F9', color: '#475569', label: 'Expired' },
  draft:     { bg: '#FFFAEB', color: '#B54708', label: 'Draft' },
}

const initialAnnouncements: Announcement[] = [
  { id: 'ANN-001', title: 'Platform maintenance scheduled for Dec 20, 2024 02:00–04:00 UTC', audience: 'All',        startDate: '2024-12-20', startTime: '02:00', endDate: '2024-12-20', endTime: '04:00', status: 'scheduled', content: 'mTrip will undergo scheduled maintenance...', priority: 'high' },
  { id: 'ANN-002', title: 'New commission structure effective Jan 1, 2025',                  audience: 'Affiliate',  startDate: '2024-12-15', startTime: '00:00', endDate: '2025-01-15', endTime: '23:59', status: 'active',    content: 'Starting January 1, all affiliate tiers will be updated...', priority: 'high' },
  { id: 'ANN-003', title: 'Holiday booking campaign — earn 2× referral rewards',            audience: 'Influencer', startDate: '2024-12-01', startTime: '00:00', endDate: '2024-12-31', endTime: '23:59', status: 'active',    content: 'During December, all referral rewards are doubled...', priority: 'normal' },
  { id: 'ANN-004', title: 'Merchant document re-verification required',                     audience: 'Merchant',   startDate: '2024-12-10', startTime: '09:00', endDate: '2025-01-10', endTime: '23:59', status: 'active',    content: 'All merchants must re-submit verification documents...', priority: 'high' },
  { id: 'ANN-005', title: 'App update v4.2.1 — new booking flow improvements',             audience: 'Customer',   startDate: '2024-12-05', startTime: '10:00', endDate: '2024-12-19', endTime: '23:59', status: 'active',    content: 'We have released a major update to the booking flow...', priority: 'normal' },
  { id: 'ANN-006', title: 'WeChat Pay temporarily unavailable Nov 28',                     audience: 'Customer',   startDate: '2024-11-28', startTime: '08:00', endDate: '2024-11-28', endTime: '16:00', status: 'expired',   content: 'WeChat Pay integration is temporarily offline...', priority: 'high' },
  { id: 'ANN-007', title: 'New fraud detection rules effective December 15',               audience: 'Affiliate',  startDate: '2024-12-15', startTime: '00:00', endDate: '2025-01-15', endTime: '23:59', status: 'scheduled', content: 'Enhanced fraud detection will be applied...', priority: 'normal' },
  { id: 'ANN-008', title: 'Year-end platform summary report available',                    audience: 'Merchant',   startDate: '2024-11-01', startTime: '09:00', endDate: '2024-11-30', endTime: '23:59', status: 'expired',   content: 'The annual platform performance summary is now available...', priority: 'low' },
]

interface FaqCategory {
  id: string; name: string; icon: string; description: string
  articleCount: number; order: number; visible: boolean
}

const initialCategories: FaqCategory[] = [
  { id: 'CAT-001', name: 'Booking',   icon: '📅', description: 'Hotel bookings, reservations, check-in/check-out procedures', articleCount: 18, order: 1, visible: true },
  { id: 'CAT-002', name: 'Payment',   icon: '💳', description: 'Supported payment methods, transactions, billing issues',     articleCount: 14, order: 2, visible: true },
  { id: 'CAT-003', name: 'Merchant',  icon: '🏨', description: 'Hotel listing, property management, merchant portal',         articleCount: 11, order: 3, visible: true },
  { id: 'CAT-004', name: 'Affiliate', icon: '🤝', description: 'Affiliate program, commission rates, referral tracking',      articleCount: 9,  order: 4, visible: true },
  { id: 'CAT-005', name: 'Promotion', icon: '🎁', description: 'Vouchers, promo codes, campaign participation',               articleCount: 8,  order: 5, visible: true },
  { id: 'CAT-006', name: 'Refund',    icon: '↩️', description: 'Refund policies, how to request refunds, timelines',          articleCount: 7,  order: 6, visible: true },
  { id: 'CAT-007', name: 'Account',   icon: '👤', description: 'Account settings, verification, security',                   articleCount: 6,  order: 7, visible: true },
  { id: 'CAT-008', name: 'Platform',  icon: '⚙️', description: 'Platform rules, policies, technical documentation',          articleCount: 5,  order: 8, visible: true },
]

const BLANK_ARTICLE_FORM = {
  title: '', category: 'Booking', audience: 'Customer' as Audience,
  content: '', status: 'draft' as ArticleStatus,
}

const BLANK_ANN_FORM = {
  title: '', audience: 'All' as Audience, startDate: '', startTime: '09:00',
  endDate: '', endTime: '23:59', status: 'draft' as AnnouncementStatus, content: '', priority: 'normal' as 'high' | 'normal' | 'low',
}

// ── 1. FAQ Articles ───────────────────────────────────────────────────────────

function ArticleDrawer({ article, onClose, onSave, showToast }: {
  article: Partial<Article> | null; onClose: () => void
  onSave: (a: Partial<Article>) => void; showToast: Props['showToast']
}) {
  const isEdit = !!article?.id
  const [form, setForm] = useState({ ...BLANK_ARTICLE_FORM, ...(article ?? {}) })

  if (!article) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 620, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{isEdit ? 'Edit Article' : 'Create FAQ Article'}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{isEdit ? article.id : 'New help center article'}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E3E8F0', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#94A3B8' }}>×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Article Title <span style={{ color: '#DC2626' }}>*</span></label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Enter a clear, descriptive title…"
              className="w-full rounded-md px-3" style={{ height: 38, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
          </div>
          {/* Category + Audience */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-md px-3 outline-none" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Audience</label>
              <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value as Audience }))}
                className="w-full rounded-md px-3 outline-none" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          {/* Rich Text Editor (simulated) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Content <span style={{ color: '#DC2626' }}>*</span></label>
            <div className="rounded-t-md" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0', borderBottom: 'none', padding: '6px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { icon: <Bold size={13} />, label: 'Bold' },
                { icon: <Italic size={13} />, label: 'Italic' },
                { icon: <Link size={13} />, label: 'Link' },
                { icon: <Image size={13} />, label: 'Image' },
              ].map(tool => (
                <button key={tool.label} title={tool.label} onClick={() => showToast('info', tool.label, `${tool.label} formatting applied`)}
                  className="flex items-center justify-center rounded"
                  style={{ width: 28, height: 26, color: '#475569', background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#E3E8F0')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {tool.icon}
                </button>
              ))}
              <div style={{ width: 1, height: 24, background: '#E3E8F0', margin: '1px 4px' }} />
              <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B', height: 26 }}>
                <option>Paragraph</option><option>Heading 1</option><option>Heading 2</option>
              </select>
            </div>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Write the article content here. Use the toolbar above to format text, add links, or insert images…"
              className="w-full px-3 py-3 rounded-b-md outline-none"
              style={{ minHeight: 220, fontSize: 13, border: '1px solid #E3E8F0', borderTop: 'none', color: '#1A2332', resize: 'vertical', lineHeight: 1.7, fontFamily: 'inherit' }} />
          </div>
          {/* Images + Attachments */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 6 }}>Images</label>
              <button onClick={() => showToast('info', 'Upload Image', 'Image upload dialog opened.')}
                className="flex items-center gap-2 w-full rounded-md px-3"
                style={{ height: 36, fontSize: 12, color: '#475569', border: '1px dashed #CBD5E1', background: '#F8FAFC' }}>
                <Image size={13} color="#94A3B8" /> Add images to article
              </button>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>PNG, JPG, GIF up to 5 MB each</div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 6 }}>Attachments</label>
              <button onClick={() => showToast('info', 'Upload File', 'File upload dialog opened.')}
                className="flex items-center gap-2 w-full rounded-md px-3"
                style={{ height: 36, fontSize: 12, color: '#475569', border: '1px dashed #CBD5E1', background: '#F8FAFC' }}>
                <Paperclip size={13} color="#94A3B8" /> Add attachments
              </button>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>PDF, DOCX up to 10 MB each</div>
            </div>
          </div>
          {/* Status */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 8 }}>Publish Status</label>
            <div className="flex gap-3">
              {(['draft', 'published', 'archived'] as ArticleStatus[]).map(s => {
                const st = ARTICLE_STATUS_STYLE[s]
                return (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => setForm(f => ({ ...f, status: s }))}
                      style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${form.status === s ? st.color : '#CBD5E1'}`, background: form.status === s ? st.color : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: form.status === s ? st.color : '#475569', fontWeight: form.status === s ? 600 : 400 }}>{st.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button onClick={() => { if (!form.title.trim()) { showToast('error', 'Title Required', 'Article title is required.'); return }; if (!form.content.trim()) { showToast('error', 'Content Required', 'Article content is required.'); return }; onSave({ ...article, ...form }) }}
            className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: '#1664FF' }}>
            <CheckCircle size={13} /> {form.status === 'published' ? 'Publish Article' : 'Save Draft'}
          </button>
          <button onClick={onClose} className="rounded-md px-4 font-medium"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function FaqArticlesPage({ showToast }: { showToast: Props['showToast'] }) {
  const [articles, setArticles] = useState<Article[]>(initialArticles)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterAudience, setFilterAudience] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [drawerArticle, setDrawerArticle] = useState<Partial<Article> | null>(null)
  const perPage = 8

  const filtered = articles.filter(a => {
    if (filterCat && a.category !== filterCat) return false
    if (filterAudience && a.audience !== filterAudience) return false
    if (filterStatus && a.status !== filterStatus) return false
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const total = filtered.length
  const rows = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  function handleSave(form: Partial<Article>) {
    if (form.id) {
      setArticles(prev => prev.map(a => a.id === form.id ? { ...a, ...form, lastUpdated: new Date().toISOString().split('T')[0] } : a))
      showToast('success', 'Article Updated', `"${form.title}" has been saved.`)
    } else {
      const newArt: Article = {
        id: `ART-${String(articles.length + 1).padStart(3, '0')}`,
        title: form.title!, category: form.category!, audience: form.audience!,
        content: form.content!, status: form.status!,
        views: 0, lastUpdated: new Date().toISOString().split('T')[0],
        attachments: 0, images: 0, author: 'Admin (You)',
      }
      setArticles(prev => [newArt, ...prev])
      showToast('success', 'Article Created', `"${form.title}" ${form.status === 'published' ? 'published' : 'saved as draft'}.`)
    }
    setDrawerArticle(null)
  }

  function handleDelete(a: Article) {
    setArticles(prev => prev.filter(x => x.id !== a.id))
    showToast('info', 'Article Deleted', `"${a.title}" removed.`)
  }

  const kpis = [
    { label: 'Total Articles',  value: articles.length,                                         color: '#1664FF' },
    { label: 'Published',       value: articles.filter(a => a.status === 'published').length,    color: '#059669', sub: 'Live in Help Center' },
    { label: 'Draft',           value: articles.filter(a => a.status === 'draft').length,        color: '#D97706', sub: 'Pending review' },
    { label: 'Most Viewed',     value: Math.max(...articles.map(a => a.views)).toLocaleString(), color: '#7C3AED', sub: 'Single article views' },
  ]

  return (
    <PageShell title="FAQ Articles" subtitle="Create, manage, and publish help center articles for all user audiences"
      kpis={kpis}
      actions={<>
        <button onClick={() => showToast('info', 'Export', 'Articles list exported.')}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export
        </button>
        <button onClick={() => setDrawerArticle(BLANK_ARTICLE_FORM)}
          className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
          style={{ height: 34, fontSize: 13, background: '#1664FF' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0E4FCC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1664FF')}>
          <Plus size={13} /> New Article
        </button>
      </>}>

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search articles…"
          className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterAudience} onChange={e => { setFilterAudience(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="">All Audiences</option>
          {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} articles</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Article Title', 'Category', 'Audience', 'Views', 'Last Updated', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-3" style={{ height: 56, maxWidth: 320 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                    {a.id}
                    {a.attachments > 0 && <span style={{ marginLeft: 6 }}><Paperclip size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {a.attachments}</span>}
                    {a.images > 0 && <span style={{ marginLeft: 6 }}><Image size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {a.images}</span>}
                  </div>
                </td>
                <td className="px-3"><CatBadge cat={a.category} /></td>
                <td className="px-3"><AudienceBadge audience={a.audience} /></td>
                <td className="px-3" style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace' }}>{a.views.toLocaleString()}</td>
                <td className="px-3">
                  <div className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>
                    <Clock size={11} color="#94A3B8" /> {a.lastUpdated}
                  </div>
                </td>
                <td className="px-3"><StatusDot status={a.status} /></td>
                <td className="px-3">
                  <div className="flex items-center gap-1">
                    <ActionBtn color="#1664FF" onClick={() => setDrawerArticle(a)} title="Edit"><Edit2 size={12} /></ActionBtn>
                    <ActionBtn color="#7C3AED" onClick={() => showToast('info', 'Preview', `Previewing: ${a.title}`)} title="Preview"><Eye size={12} /></ActionBtn>
                    <ActionBtn color="#DC2626" onClick={() => handleDelete(a)} title="Delete"><Trash2 size={12} /></ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, fontSize: 13, color: '#94A3B8' }}>No articles match your filters.</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: totalPages }).map((_, i) => <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>{i + 1}</PagBtn>)}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>

      <ArticleDrawer article={drawerArticle} onClose={() => setDrawerArticle(null)} onSave={handleSave} showToast={showToast} />
    </PageShell>
  )
}

// ── 2. Categories ─────────────────────────────────────────────────────────────

function CategoriesPage({ showToast }: { showToast: Props['showToast'] }) {
  const [categories, setCategories] = useState<FaqCategory[]>(initialCategories)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FaqCategory | null>(null)
  const [form, setForm] = useState({ name: '', icon: '📄', description: '', visible: true })

  const BLANK = { name: '', icon: '📄', description: '', visible: true }

  function openCreate() { setForm(BLANK); setCreateOpen(true) }
  function openEdit(cat: FaqCategory) { setForm({ name: cat.name, icon: cat.icon, description: cat.description, visible: cat.visible }); setEditTarget(cat) }

  function handleSave() {
    if (!form.name.trim()) { showToast('error', 'Name Required', 'Category name is required.'); return }
    if (editTarget) {
      setCategories(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...form } : c))
      showToast('success', 'Category Updated', `"${form.name}" saved.`)
      setEditTarget(null)
    } else {
      const newCat: FaqCategory = { id: `CAT-${String(categories.length + 1).padStart(3, '0')}`, ...form, articleCount: 0, order: categories.length + 1 }
      setCategories(prev => [...prev, newCat])
      showToast('success', 'Category Created', `"${form.name}" added to Help Center.`)
      setCreateOpen(false)
    }
  }

  function toggleVisible(cat: FaqCategory) {
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, visible: !c.visible } : c))
    showToast('info', cat.visible ? 'Category Hidden' : 'Category Visible', cat.name)
  }

  const kpis = [
    { label: 'Total Categories', value: categories.length,                                         color: '#1664FF' },
    { label: 'Visible',          value: categories.filter(c => c.visible).length,                 color: '#059669', sub: 'Shown in Help Center' },
    { label: 'Total Articles',   value: categories.reduce((s, c) => s + c.articleCount, 0),        color: '#D97706', sub: 'Across all categories' },
    { label: 'Hidden',           value: categories.filter(c => !c.visible).length,                 color: '#94A3B8', sub: 'Not shown to users' },
  ]

  function CategoryForm() {
    return (
      <div className="space-y-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: '80px 1fr' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Icon</label>
            <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              className="w-full rounded-md text-center" style={{ height: 36, fontSize: 20, border: '1px solid #E3E8F0', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Category Name <span style={{ color: '#DC2626' }}>*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Booking, Payment, Refund…"
              className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of this category's content…"
            className="w-full rounded-md px-3 py-2 outline-none"
            style={{ height: 80, fontSize: 13, border: '1px solid #E3E8F0', color: '#1A2332', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6 }} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setForm(f => ({ ...f, visible: !f.visible }))}
            style={{ width: 40, height: 22, borderRadius: 11, background: form.visible ? '#059669' : '#E3E8F0', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.visible ? 21 : 3, transition: 'left 0.2s' }} />
          </button>
          <span style={{ fontSize: 13, color: '#475569' }}>Visible to users in Help Center</span>
        </div>
        <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button onClick={handleSave} className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: '#1664FF' }}>
            <CheckCircle size={13} /> {editTarget ? 'Save Changes' : 'Create Category'}
          </button>
          <button onClick={() => { setCreateOpen(false); setEditTarget(null) }} className="rounded-md px-4 font-medium"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <PageShell title="Categories" subtitle="Organize FAQ articles into categories for easy navigation in the Help Center"
      kpis={kpis}
      actions={
        <button onClick={openCreate}
          className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
          style={{ height: 34, fontSize: 13, background: '#1664FF' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0E4FCC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1664FF')}>
          <Plus size={13} /> New Category
        </button>
      }>

      {/* Create form inline */}
      {createOpen && (
        <div className="rounded-lg p-4 mb-4" style={{ background: '#fff', border: '1px solid #BFDBFE', boxShadow: '0 2px 8px rgba(22,100,255,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 12 }}>New Category</div>
          <CategoryForm />
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {categories.map(cat => (
          <div key={cat.id} className="rounded-lg" style={{ background: '#fff', border: `1px solid ${editTarget?.id === cat.id ? '#BFDBFE' : '#E3E8F0'}`, overflow: 'hidden' }}>
            {editTarget?.id === cat.id ? (
              <div className="p-4">
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 12 }}>Edit: {cat.name}</div>
                <CategoryForm />
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ width: 40, height: 40, background: '#F8FAFC', border: '1px solid #E3E8F0', fontSize: 20 }}>
                      {cat.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>{cat.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Order #{cat.order} · {cat.articleCount} articles</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleVisible(cat)}
                      style={{ width: 36, height: 20, borderRadius: 10, background: cat.visible ? '#059669' : '#E3E8F0', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: cat.visible ? 19 : 3, transition: 'left 0.2s' }} />
                    </button>
                    <ActionBtn color="#1664FF" onClick={() => openEdit(cat)} title="Edit"><Edit2 size={12} /></ActionBtn>
                    <ActionBtn color="#DC2626" onClick={() => { setCategories(prev => prev.filter(c => c.id !== cat.id)); showToast('info', 'Category Deleted', cat.name) }} title="Delete">
                      <Trash2 size={12} />
                    </ActionBtn>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{cat.description}</div>
                <div className="flex items-center gap-2 mt-3">
                  <span style={{ fontSize: 11, background: cat.visible ? '#ECFDF3' : '#F1F5F9', color: cat.visible ? '#027A48' : '#475569', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                    {cat.visible ? 'Visible' : 'Hidden'}
                  </span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{cat.id}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  )
}

// ── 3. Announcements ──────────────────────────────────────────────────────────

function AnnouncementsPage({ showToast }: { showToast: Props['showToast'] }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [search, setSearch] = useState('')
  const [filterAudience, setFilterAudience] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Announcement | null>(null)
  const [form, setForm] = useState({ ...BLANK_ANN_FORM })

  const filtered = announcements.filter(a => {
    if (filterAudience && a.audience !== filterAudience) return false
    if (filterStatus && a.status !== filterStatus) return false
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openCreate() { setForm({ ...BLANK_ANN_FORM }); setEditTarget(null); setDrawerOpen(true) }
  function openEdit(ann: Announcement) { setForm({ title: ann.title, audience: ann.audience, startDate: ann.startDate, startTime: ann.startTime, endDate: ann.endDate, endTime: ann.endTime, status: ann.status, content: ann.content, priority: ann.priority }); setEditTarget(ann); setDrawerOpen(true) }

  function handleSave() {
    if (!form.title.trim()) { showToast('error', 'Title Required', 'Announcement title is required.'); return }
    if (!form.startDate || !form.endDate) { showToast('error', 'Dates Required', 'Start and end dates are required.'); return }
    if (editTarget) {
      setAnnouncements(prev => prev.map(a => a.id === editTarget.id ? { ...a, ...form } : a))
      showToast('success', 'Announcement Updated', form.title)
    } else {
      const newAnn: Announcement = { id: `ANN-${String(announcements.length + 1).padStart(3, '0')}`, ...form }
      setAnnouncements(prev => [newAnn, ...prev])
      showToast('success', 'Announcement Created', form.title)
    }
    setDrawerOpen(false)
  }

  const priorityColor = { high: '#DC2626', normal: '#D97706', low: '#059669' }

  const kpis = [
    { label: 'Total',     value: announcements.length,                                              color: '#1664FF' },
    { label: 'Active',    value: announcements.filter(a => a.status === 'active').length,           color: '#059669', sub: 'Currently showing' },
    { label: 'Scheduled', value: announcements.filter(a => a.status === 'scheduled').length,        color: '#1D4ED8', sub: 'Upcoming' },
    { label: 'High Priority', value: announcements.filter(a => a.priority === 'high').length,        color: '#DC2626' },
  ]

  return (
    <PageShell title="Announcements" subtitle="Create and manage platform-wide announcements shown to specific user audiences"
      kpis={kpis}
      actions={<>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
          style={{ height: 34, fontSize: 13, background: '#1664FF' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0E4FCC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1664FF')}>
          <Plus size={13} /> New Announcement
        </button>
      </>}>

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search announcements…"
          className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
        <select value={filterAudience} onChange={e => setFilterAudience(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="">All Audiences</option>
          {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option><option value="scheduled">Scheduled</option>
          <option value="expired">Expired</option><option value="draft">Draft</option>
        </select>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{filtered.length} announcements</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Title', 'Audience', 'Priority', 'Start Date & Time', 'End Date & Time', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ann, i) => {
              const ss = ANN_STATUS_STYLE[ann.status]
              return (
                <tr key={ann.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-3" style={{ height: 56, maxWidth: 340 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.title}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{ann.id}</div>
                  </td>
                  <td className="px-3"><AudienceBadge audience={ann.audience} /></td>
                  <td className="px-3">
                    <span style={{ fontSize: 11, color: priorityColor[ann.priority], background: priorityColor[ann.priority] + '14', padding: '2px 6px', borderRadius: 4, fontWeight: 600, textTransform: 'capitalize' }}>
                      {ann.priority}
                    </span>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{ann.startDate} {ann.startTime}</td>
                  <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{ann.endDate} {ann.endTime}</td>
                  <td className="px-3">
                    <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, height: 20, background: ss.bg, color: ss.color }}>{ss.label}</span>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn color="#1664FF" onClick={() => openEdit(ann)} title="Edit"><Edit2 size={12} /></ActionBtn>
                      <ActionBtn color="#DC2626" onClick={() => { setAnnouncements(prev => prev.filter(a => a.id !== ann.id)); showToast('info', 'Deleted', ann.title) }} title="Delete"><Trash2 size={12} /></ActionBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, fontSize: 13, color: '#94A3B8' }}>No announcements match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Announcement Drawer */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setDrawerOpen(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)' }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 560, background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{editTarget ? 'Edit Announcement' : 'New Announcement'}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Platform-wide message for selected audience</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E3E8F0', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#94A3B8' }}>×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Title <span style={{ color: '#DC2626' }}>*</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Announcement title…"
                  className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Audience</label>
                  <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value as Audience }))}
                    className="w-full rounded-md px-3 outline-none" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                    {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'high' | 'normal' | 'low' }))}
                    className="w-full rounded-md px-3 outline-none" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', background: '#fff', color: '#1A2332' }}>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Start Date <span style={{ color: '#DC2626' }}>*</span></label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Start Time</label>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>End Date <span style={{ color: '#DC2626' }}>*</span></label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>End Time</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Content</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Announcement body text shown to users…"
                  className="w-full rounded-md px-3 py-2 outline-none"
                  style={{ height: 120, fontSize: 13, border: '1px solid #E3E8F0', color: '#1A2332', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 8 }}>Status</label>
                <div className="flex gap-3">
                  {(['draft', 'scheduled', 'active'] as AnnouncementStatus[]).map(s => {
                    const ss = ANN_STATUS_STYLE[s]
                    return (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <div onClick={() => setForm(f => ({ ...f, status: s }))}
                          style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${form.status === s ? ss.color : '#CBD5E1'}`, background: form.status === s ? ss.color : 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: form.status === s ? ss.color : '#475569' }}>{ss.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid #F1F5F9' }}>
              <button onClick={handleSave} className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
                style={{ height: 34, fontSize: 13, background: '#1664FF' }}>
                <CheckCircle size={13} /> {editTarget ? 'Save Changes' : 'Create Announcement'}
              </button>
              <button onClick={() => setDrawerOpen(false)} className="rounded-md px-4 font-medium"
                style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}

// ── 4. Search Analytics ───────────────────────────────────────────────────────

const topKeywords = [
  { keyword: 'how to cancel booking',    searches: 4820, trend: 'up',   results: 12 },
  { keyword: 'refund policy',           searches: 3940, trend: 'up',   results: 8  },
  { keyword: 'payment failed',          searches: 3210, trend: 'down', results: 5  },
  { keyword: 'voucher not working',     searches: 2860, trend: 'up',   results: 4  },
  { keyword: 'check-in time',           searches: 2540, trend: 'up',   results: 9  },
  { keyword: 'commission rate',         searches: 2180, trend: 'up',   results: 6  },
  { keyword: 'merchant verification',   searches: 1920, trend: 'down', results: 7  },
  { keyword: 'withdraw earnings',       searches: 1640, trend: 'up',   results: 3  },
  { keyword: 'promo code',             searches: 1380, trend: 'down', results: 11 },
  { keyword: 'account suspended',      searches: 1120, trend: 'down', results: 2  },
]

const noResultKeywords = [
  { keyword: 'instant refund',          searches: 892, lastSearched: '2024-12-13' },
  { keyword: 'split payment',           searches: 740, lastSearched: '2024-12-12' },
  { keyword: 'loyalty points',         searches: 618, lastSearched: '2024-12-11' },
  { keyword: 'group booking discount',  searches: 524, lastSearched: '2024-12-10' },
  { keyword: 'pet friendly hotels',     searches: 412, lastSearched: '2024-12-09' },
  { keyword: 'early check out fee',     searches: 384, lastSearched: '2024-12-08' },
]

const topViewedArticles = [
  { title: 'How to make a hotel booking on mTrip', views: 12840, rating: 4.8, helpful: 94 },
  { title: 'How to request a refund',              views: 7890,  rating: 4.6, helpful: 88 },
  { title: 'Supported payment methods',            views: 8740,  rating: 4.7, helpful: 91 },
  { title: 'How to cancel or modify a booking',   views: 9210,  rating: 4.5, helpful: 86 },
  { title: 'How to apply a promotional voucher',  views: 5640,  rating: 4.4, helpful: 82 },
]

const lowRatedArticles = [
  { title: 'Account verification requirements',         rating: 2.9, views: 2910, feedback: 'Too technical, needs screenshots' },
  { title: 'Platform service fees explained',           rating: 3.1, views: 4510, feedback: 'Incomplete — missing MMK examples' },
  { title: 'Setting up your influencer referral link', rating: 3.3, views: 3240, feedback: 'Outdated UI screenshots' },
  { title: 'Legacy booking system migration guide',    rating: 2.4, views: 420,  feedback: 'No longer relevant — needs update' },
]

function SearchAnalyticsPage({ showToast }: { showToast: Props['showToast'] }) {
  const [period, setPeriod] = useState('30d')

  const kpis = [
    { label: 'Total Searches',      value: '48,240', color: '#1664FF', sub: 'Last 30 days' },
    { label: 'Searches w/ Results', value: '93.4%',  color: '#059669', sub: '45,056 searches' },
    { label: 'Zero-Result Queries', value: '3,184',  color: '#DC2626', sub: '6.6% of all searches' },
    { label: 'Avg. Rating',         value: '4.2 / 5', color: '#D97706', sub: 'Across all articles' },
  ]

  return (
    <PageShell title="Search Analytics" subtitle="Insights into how users search the Help Center — identify gaps and improve discoverability"
      kpis={kpis}
      actions={<>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F1F5F9', display: 'inline-flex' }}>
          {(['7d', '30d', '90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="rounded-md px-3 font-medium"
              style={{ height: 28, fontSize: 12, background: period === p ? '#fff' : 'transparent', color: period === p ? '#1A2332' : '#64748B', boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {p}
            </button>
          ))}
        </div>
        <button onClick={() => showToast('success', 'Export', 'Search analytics exported.')}
          className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
          style={{ height: 34, fontSize: 13, background: '#059669' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
          onMouseLeave={e => (e.currentTarget.style.background = '#059669')}>
          <Download size={13} /> Export
        </button>
      </>}>
      <div className="space-y-5">

        {/* Most Searched Keywords */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>Most Searched Keywords</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Top search queries in the Help Center — past {period}</div>
            </div>
            <Filter size={14} color="#94A3B8" />
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                {['#', 'Keyword', 'Searches', 'Trend', 'Articles Found', 'Action'].map(h => (
                  <th key={h} className="text-left px-4" style={{ height: 32, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topKeywords.map((kw, i) => (
                <tr key={kw.keyword} style={{ borderBottom: i < topKeywords.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4" style={{ height: 44, fontSize: 11, color: '#CBD5E1', fontFamily: 'monospace', width: 32 }}>{i + 1}</td>
                  <td className="px-4" style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{kw.keyword}</td>
                  <td className="px-4" style={{ fontSize: 13, fontWeight: 700, color: '#1664FF', fontFamily: 'monospace' }}>{kw.searches.toLocaleString()}</td>
                  <td className="px-4">
                    {kw.trend === 'up'
                      ? <div className="flex items-center gap-1" style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}><TrendingUp size={13} /> Up</div>
                      : <div className="flex items-center gap-1" style={{ fontSize: 12, color: '#DC2626', fontWeight: 500 }}><TrendingDown size={13} /> Down</div>
                    }
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-1.5">
                      <div style={{ width: 48, height: 5, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(kw.results * 8, 100)}%`, height: '100%', background: kw.results >= 5 ? '#059669' : '#D97706', borderRadius: 9999 }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{kw.results}</span>
                    </div>
                  </td>
                  <td className="px-4">
                    <button onClick={() => showToast('info', 'Create Article', `Opening editor for keyword: "${kw.keyword}"`)}
                      className="flex items-center gap-1 rounded px-2"
                      style={{ height: 26, fontSize: 11, color: '#1664FF', border: '1px solid #BFDBFE', background: '#EFF6FF' }}>
                      <Plus size={10} /> Article
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Most Viewed Articles */}
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>Most Viewed Articles</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Top-performing articles by view count</div>
            </div>
            <div>
              {topViewedArticles.map((art, i) => (
                <div key={art.title} className="px-4 py-3 flex items-start gap-3"
                  style={{ borderBottom: i < topViewedArticles.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 11, color: '#CBD5E1', fontFamily: 'monospace', minWidth: 14, marginTop: 2 }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.title}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{art.views.toLocaleString()} views</span>
                      <div className="flex items-center gap-0.5">
                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                        <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>{art.rating}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#059669' }}>{art.helpful}% helpful</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zero Result Searches */}
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>No-Result Searches</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Keywords with zero matching articles — content gaps to fill</div>
            </div>
            <div>
              {noResultKeywords.map((kw, i) => (
                <div key={kw.keyword} className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: i < noResultKeywords.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div>
                    <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500 }}>{kw.keyword}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{kw.searches.toLocaleString()} searches · Last: {kw.lastSearched}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded px-1.5" style={{ background: '#FFF1F3', height: 20 }}>
                      <XCircle size={10} color="#BE123C" />
                      <span style={{ fontSize: 10, color: '#BE123C', fontWeight: 600 }}>No results</span>
                    </div>
                    <button onClick={() => showToast('info', 'Create Article', `Creating article for: "${kw.keyword}"`)}
                      className="flex items-center gap-1 rounded px-2"
                      style={{ height: 26, fontSize: 11, color: '#1664FF', border: '1px solid #BFDBFE', background: '#EFF6FF' }}>
                      <Plus size={10} /> Fix
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Low-rated Articles */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>Low-Rated Articles</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Articles with ratings below 3.5 — prioritize for improvement</div>
            </div>
            <div className="flex items-center gap-1.5 rounded px-2.5 py-1" style={{ background: '#FFF1F3', border: '1px solid #FECDD3' }}>
              <AlertTriangle size={12} color="#BE123C" />
              <span style={{ fontSize: 12, color: '#BE123C', fontWeight: 600 }}>{lowRatedArticles.length} articles need attention</span>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                {['Article Title', 'Rating', 'Views', 'User Feedback', 'Action'].map(h => (
                  <th key={h} className="text-left px-4" style={{ height: 32, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lowRatedArticles.map((art, i) => (
                <tr key={art.title} style={{ borderBottom: i < lowRatedArticles.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4" style={{ height: 52, fontSize: 13, fontWeight: 500, color: '#1A2332', maxWidth: 280 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.title}</div>
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-1">
                      <Star size={12} color={art.rating < 3 ? '#DC2626' : '#D97706'} fill={art.rating < 3 ? '#DC2626' : '#D97706'} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: art.rating < 3 ? '#DC2626' : '#D97706', fontFamily: 'monospace' }}>{art.rating}</span>
                    </div>
                  </td>
                  <td className="px-4" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{art.views.toLocaleString()}</td>
                  <td className="px-4" style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>{art.feedback}</td>
                  <td className="px-4">
                    <button onClick={() => showToast('info', 'Edit Article', `Opening editor for: "${art.title}"`)}
                      className="flex items-center gap-1.5 rounded-md px-3 font-medium"
                      style={{ height: 28, fontSize: 12, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
                      <RefreshCw size={11} /> Improve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </PageShell>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function HelpCenterPage({ tab, showToast }: Props) {
  if (tab === 'helpcenter-categories')    return <CategoriesPage       showToast={showToast} />
  if (tab === 'helpcenter-announcements') return <AnnouncementsPage    showToast={showToast} />
  if (tab === 'helpcenter-analytics')    return <SearchAnalyticsPage   showToast={showToast} />
  return <FaqArticlesPage showToast={showToast} />
}

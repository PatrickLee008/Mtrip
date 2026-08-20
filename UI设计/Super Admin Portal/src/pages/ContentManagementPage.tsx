import { useState } from 'react'
import {
  Search, Plus, Eye, Edit2, Copy, Trash2, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Image, Calendar, Palette, Clock,
  AlertCircle, Download, Monitor, Smartphone, ToggleLeft, ToggleRight,
  Layers, MoreHorizontal, ArrowRight, ArrowLeft, Upload,
} from 'lucide-react'
import Drawer from '../components/Drawer'
import Dialog from '../components/Dialog'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BannerStatus   = 'active' | 'scheduled' | 'draft' | 'expired'
type BannerPlacement = 'Home Page' | 'Hotel Search' | 'Hotel Detail' | 'Booking Confirmation' | 'Login & Register'
type BannerAction   = 'No Action' | 'Hotel Detail' | 'Campaign' | 'Promotion' | 'Voucher' | 'Deep Link' | 'External URL'
type BannerAudience = 'All Users' | 'New Users' | 'Returning Users' | 'Membership Tier' | 'Country' | 'Language'

interface Banner {
  id: string; name: string; description: string
  placement: BannerPlacement; linkedCampaign: string | null
  scheduleStart: string; scheduleEnd: string
  priority: number; status: BannerStatus; createdDate: string
  action: BannerAction; audience: BannerAudience; color: string
}

type ThemeStatus   = 'active' | 'scheduled' | 'draft' | 'inactive'
type ThemeCategory = 'Built-in' | 'Custom'
type ThemeType     = 'Default' | 'Seasonal' | 'Promotion' | 'Anniversary' | 'Destination' | 'Partnership' | 'Custom'

interface Theme {
  id: string; name: string; description: string
  category: ThemeCategory; type: ThemeType
  scheduleStart: string | null; scheduleEnd: string | null
  priority: number; status: ThemeStatus; lastUpdated: string
  primaryColor: string; secondaryColor: string; accentColor: string; buttonColor: string
  deletable: boolean
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const INIT_BANNERS: Banner[] = [
  { id: 'BNR-001', name: 'Year-End Travel Sale', description: 'Main homepage banner for year-end campaign', placement: 'Home Page', linkedCampaign: 'YE-SALE-2024', scheduleStart: '2024-12-01 00:00', scheduleEnd: '2024-12-31 23:59', priority: 1, status: 'active',    createdDate: '2024-11-20', action: 'Campaign',    audience: 'All Users',       color: '#1664FF' },
  { id: 'BNR-002', name: 'New Year Hotel Deals',  description: 'Promote New Year hotel packages',            placement: 'Hotel Search',  linkedCampaign: 'NY-DEALS-2025', scheduleStart: '2024-12-26 00:00', scheduleEnd: '2025-01-05 23:59', priority: 2, status: 'scheduled', createdDate: '2024-11-25', action: 'Promotion',   audience: 'All Users',       color: '#7C3AED' },
  { id: 'BNR-003', name: 'Thingyan Festival Promo', description: 'Myanmar New Year seasonal banner',         placement: 'Home Page',     linkedCampaign: 'THINGYAN-2025', scheduleStart: '2025-04-10 00:00', scheduleEnd: '2025-04-20 23:59', priority: 1, status: 'draft',     createdDate: '2024-12-01', action: 'Campaign',    audience: 'All Users',       color: '#059669' },
  { id: 'BNR-004', name: 'Flash Sale — Weekend',  description: 'Weekend flash sale on hotel detail',         placement: 'Hotel Detail',  linkedCampaign: 'FLASH-WK',      scheduleStart: '2024-11-30 00:00', scheduleEnd: '2024-12-01 23:59', priority: 3, status: 'expired',   createdDate: '2024-11-28', action: 'Voucher',     audience: 'Returning Users', color: '#D97706' },
  { id: 'BNR-005', name: 'New User Welcome',      description: 'Encourage new user registration',            placement: 'Login & Register', linkedCampaign: null,          scheduleStart: '2024-01-01 00:00', scheduleEnd: '2024-12-31 23:59', priority: 1, status: 'active',    createdDate: '2024-01-01', action: 'Promotion',   audience: 'New Users',       color: '#0EA5E9' },
  { id: 'BNR-006', name: 'Booking Thank You',     description: 'Post-booking upsell promotion',              placement: 'Booking Confirmation', linkedCampaign: 'UPSELL-Q4', scheduleStart: '2024-10-01 00:00', scheduleEnd: '2024-12-31 23:59', priority: 2, status: 'active',    createdDate: '2024-09-20', action: 'Voucher',     audience: 'All Users',       color: '#059669' },
  { id: 'BNR-007', name: 'Mandalay Destination',  description: 'Promote Mandalay hotels',                    placement: 'Hotel Search',  linkedCampaign: null,            scheduleStart: '2025-01-15 00:00', scheduleEnd: '2025-02-28 23:59', priority: 2, status: 'draft',     createdDate: '2024-12-03', action: 'Hotel Detail', audience: 'All Users',       color: '#C2410C' },
  { id: 'BNR-008', name: 'Membership Tier Upgrade', description: 'Encourage Gold tier upgrade',              placement: 'Home Page',     linkedCampaign: 'TIER-UPGRADE',  scheduleStart: '2024-12-15 00:00', scheduleEnd: '2025-01-15 23:59', priority: 3, status: 'scheduled', createdDate: '2024-12-05', action: 'Deep Link',   audience: 'Membership Tier', color: '#B45309' },
  { id: 'BNR-009', name: 'Christmas Special Deals', description: 'Christmas promotional banner',             placement: 'Home Page',     linkedCampaign: 'XMAS-2024',     scheduleStart: '2024-12-20 00:00', scheduleEnd: '2024-12-26 23:59', priority: 1, status: 'scheduled', createdDate: '2024-12-06', action: 'Campaign',    audience: 'All Users',       color: '#DC2626' },
  { id: 'BNR-010', name: 'App Download CTA',      description: 'Drive app downloads from web',               placement: 'Hotel Search',  linkedCampaign: null,            scheduleStart: '2024-01-01 00:00', scheduleEnd: '2024-12-31 23:59', priority: 4, status: 'active',    createdDate: '2024-01-05', action: 'External URL', audience: 'All Users',       color: '#1664FF' },
  { id: 'BNR-011', name: 'Weekend Getaway',       description: 'Weekend staycation promotion',                placement: 'Hotel Detail',  linkedCampaign: 'WEEKEND-GT',    scheduleStart: '2024-12-06 00:00', scheduleEnd: '2024-12-31 23:59', priority: 2, status: 'active',    createdDate: '2024-12-04', action: 'Promotion',   audience: 'Returning Users', color: '#7C3AED' },
  { id: 'BNR-012', name: 'Chinese New Year 2025', description: 'CNY seasonal campaign banner',               placement: 'Home Page',     linkedCampaign: 'CNY-2025',      scheduleStart: '2025-01-25 00:00', scheduleEnd: '2025-02-10 23:59', priority: 1, status: 'draft',     createdDate: '2024-12-08', action: 'Campaign',    audience: 'All Users',       color: '#DC2626' },
]

const INIT_THEMES: Theme[] = [
  { id: 'THM-001', name: 'Default mTrip Theme',         description: 'Standard platform theme used year-round',          category: 'Built-in', type: 'Default',     scheduleStart: null,         scheduleEnd: null,         priority: 0, status: 'active',    lastUpdated: '2024-01-01', primaryColor: '#1664FF', secondaryColor: '#1A2332', accentColor: '#0EA5E9', buttonColor: '#1664FF', deletable: false },
  { id: 'THM-002', name: 'Myanmar New Year (Thingyan)', description: 'Thingyan Water Festival seasonal theme',            category: 'Built-in', type: 'Seasonal',    scheduleStart: '2025-04-10', scheduleEnd: '2025-04-20', priority: 1, status: 'draft',     lastUpdated: '2024-11-15', primaryColor: '#0EA5E9', secondaryColor: '#0369A1', accentColor: '#7DD3FC', buttonColor: '#0284C7', deletable: false },
  { id: 'THM-003', name: 'Thadingyut',                  description: 'Festival of Lights seasonal theme',                 category: 'Built-in', type: 'Seasonal',    scheduleStart: '2025-10-05', scheduleEnd: '2025-10-07', priority: 1, status: 'draft',     lastUpdated: '2024-10-10', primaryColor: '#D97706', secondaryColor: '#92400E', accentColor: '#FDE68A', buttonColor: '#F59E0B', deletable: false },
  { id: 'THM-004', name: 'Christmas',                   description: 'Christmas holiday seasonal theme',                  category: 'Built-in', type: 'Seasonal',    scheduleStart: '2024-12-20', scheduleEnd: '2024-12-26', priority: 1, status: 'scheduled', lastUpdated: '2024-12-01', primaryColor: '#DC2626', secondaryColor: '#166534', accentColor: '#FCA5A5', buttonColor: '#B91C1C', deletable: false },
  { id: 'THM-005', name: 'New Year',                    description: 'New Year celebration theme',                         category: 'Built-in', type: 'Seasonal',    scheduleStart: '2024-12-31', scheduleEnd: '2025-01-02', priority: 1, status: 'scheduled', lastUpdated: '2024-12-01', primaryColor: '#7C3AED', secondaryColor: '#1A2332', accentColor: '#C4B5FD', buttonColor: '#6D28D9', deletable: false },
  { id: 'THM-006', name: 'Chinese New Year',            description: 'Spring Festival / Lunar New Year theme',            category: 'Built-in', type: 'Seasonal',    scheduleStart: '2025-01-25', scheduleEnd: '2025-02-10', priority: 1, status: 'draft',     lastUpdated: '2024-11-20', primaryColor: '#DC2626', secondaryColor: '#92400E', accentColor: '#FCA5A5', buttonColor: '#B91C1C', deletable: false },
  { id: 'THM-007', name: 'Mandalay Destination',        description: 'Custom destination theme for Mandalay promotion',   category: 'Custom',   type: 'Destination', scheduleStart: '2025-01-15', scheduleEnd: '2025-03-31', priority: 2, status: 'draft',     lastUpdated: '2024-12-05', primaryColor: '#C2410C', secondaryColor: '#7C2D12', accentColor: '#FDBA74', buttonColor: '#EA580C', deletable: true },
  { id: 'THM-008', name: 'Partner — Visa Campaign',     description: 'Co-branded theme for Visa partnership campaign',    category: 'Custom',   type: 'Partnership', scheduleStart: '2025-02-01', scheduleEnd: '2025-03-31', priority: 2, status: 'draft',     lastUpdated: '2024-12-06', primaryColor: '#1A56DB', secondaryColor: '#F5C518', accentColor: '#93C5FD', buttonColor: '#1D4ED8', deletable: true },
  { id: 'THM-009', name: 'Summer Escape',               description: 'Summer travel promotion theme',                     category: 'Custom',   type: 'Promotion',   scheduleStart: null,         scheduleEnd: null,         priority: 3, status: 'inactive',  lastUpdated: '2024-08-01', primaryColor: '#059669', secondaryColor: '#065F46', accentColor: '#6EE7B7', buttonColor: '#047857', deletable: true },
]

// ─── Shared components ────────────────────────────────────────────────────────

function BannerStatusBadge({ status }: { status: BannerStatus }) {
  const cfg: Record<BannerStatus, { bg: string; color: string; border: string; label: string }> = {
    active:    { bg: '#ECFDF3', color: '#027A48', border: '#A7F3D0', label: 'Active' },
    scheduled: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', label: 'Scheduled' },
    draft:     { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0', label: 'Draft' },
    expired:   { bg: '#FFF1F3', color: '#C01048', border: '#FECDD3', label: 'Expired' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded-full px-2 font-medium" style={{ fontSize: 11, height: 22, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{c.label}</span>
}

function ThemeStatusBadge({ status }: { status: ThemeStatus }) {
  const cfg: Record<ThemeStatus, { bg: string; color: string; border: string; label: string }> = {
    active:    { bg: '#ECFDF3', color: '#027A48', border: '#A7F3D0', label: 'Active' },
    scheduled: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', label: 'Scheduled' },
    draft:     { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0', label: 'Draft' },
    inactive:  { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1', label: 'Inactive' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded-full px-2 font-medium" style={{ fontSize: 11, height: 22, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{c.label}</span>
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

function KpiCard({ label, value, color, bg, border, icon }: { label: string; value: number; color: string; bg: string; border: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg p-4 flex-1" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div className="rounded-md flex items-center justify-center" style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.7)', color }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}

function UploadSlot({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="mb-4">
      <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      <div className="flex items-center justify-center rounded-lg cursor-pointer transition-all"
        style={{ height: 72, border: '2px dashed #E3E8F0', background: '#F8FAFC' }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1664FF'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E3E8F0'}>
        <div className="text-center">
          <Image size={18} color="#CBD5E1" style={{ margin: '0 auto 4px' }} />
          <div style={{ fontSize: 11, color: '#94A3B8' }}>Click to upload{hint && <span style={{ color: '#CBD5E1' }}> · {hint}</span>}</div>
        </div>
      </div>
    </div>
  )
}

function FormRow({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 12, marginTop: 8, paddingBottom: 8, borderBottom: '1px solid #F1F5F9' }}>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = { fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', borderRadius: 6, padding: '0 12px', height: 36, width: '100%', outline: 'none', background: '#fff', boxSizing: 'border-box' }
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
const ta:  React.CSSProperties = { ...inp, height: 72, padding: '8px 12px', resize: 'none', lineHeight: 1.5 }

// ─── Banner Drawer ────────────────────────────────────────────────────────────

type BannerForm = {
  name: string; description: string; placement: BannerPlacement
  action: BannerAction; actionValue: string; audience: BannerAudience
  scheduleStart: string; scheduleEnd: string; priority: string
  linkedCampaign: string; status: BannerStatus
}
const BLANK_BANNER_FORM: BannerForm = {
  name: '', description: '', placement: 'Home Page',
  action: 'No Action', actionValue: '', audience: 'All Users',
  scheduleStart: '', scheduleEnd: '', priority: '1',
  linkedCampaign: '', status: 'draft',
}

function BannerDrawer({ open, onClose, editing, onSave }: {
  open: boolean; onClose: () => void; editing: Banner | null
  onSave: (form: BannerForm, id?: string) => void
}) {
  const [form, setForm] = useState<BannerForm>(BLANK_BANNER_FORM)
  const [preview, setPreview] = useState<'desktop' | 'mobile'>('desktop')

  // Sync form when editing changes
  if (open && editing && form.name === '' && editing.name !== '') {
    setForm({
      name: editing.name, description: editing.description,
      placement: editing.placement, action: editing.action,
      actionValue: '', audience: editing.audience,
      scheduleStart: editing.scheduleStart, scheduleEnd: editing.scheduleEnd,
      priority: String(editing.priority), linkedCampaign: editing.linkedCampaign ?? '',
      status: editing.status,
    })
  }

  function handleClose() { setForm(BLANK_BANNER_FORM); onClose() }
  function handleSave(status: BannerStatus) {
    onSave({ ...form, status }, editing?.id)
    handleClose()
  }

  const needsActionValue = form.action !== 'No Action'

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={editing ? 'Edit Banner' : 'Create Banner'}
      subtitle={editing ? `Editing ${editing.id}` : 'Add a new marketing banner'}
      width={520}
      footer={
        <div className="flex items-center gap-2 w-full">
          <button onClick={handleClose} className="rounded-md px-4 font-medium"
            style={{ height: 36, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
            Cancel
          </button>
          <div className="flex-1" />
          <button onClick={() => handleSave('draft')} className="rounded-md px-4 font-medium"
            style={{ height: 36, fontSize: 13, color: '#1664FF', border: '1px solid #BFDBFE', background: '#EEF4FF' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#DBEAFE'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#EEF4FF'}>
            Save Draft
          </button>
          <button onClick={() => handleSave('scheduled')} disabled={!form.name.trim()}
            className="rounded-md px-4 font-medium text-white"
            style={{ height: 36, fontSize: 13, background: !form.name.trim() ? '#94A3B8' : '#1664FF', cursor: !form.name.trim() ? 'not-allowed' : 'pointer' }}>
            {editing ? 'Save Changes' : 'Create Banner'}
          </button>
        </div>
      }
    >
      <div>
        <SectionLabel>Basic Information</SectionLabel>
        <FormRow label="Banner Name" required>
          <input style={inp} value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Year-End Travel Sale" />
        </FormRow>
        <FormRow label="Internal Description">
          <textarea style={ta} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description for internal reference…" />
        </FormRow>

        <SectionLabel>Banner Assets</SectionLabel>
        <div className="flex items-center gap-2 mb-4 rounded-md overflow-hidden" style={{ border: '1px solid #E3E8F0', width: 'fit-content' }}>
          {(['desktop', 'mobile'] as const).map((v) => (
            <button key={v} onClick={() => setPreview(v)} className="flex items-center gap-1.5 px-3 capitalize"
              style={{ height: 32, fontSize: 12, fontWeight: 500, background: preview === v ? '#1A2332' : 'transparent', color: preview === v ? '#fff' : '#64748B' }}>
              {v === 'desktop' ? <Monitor size={12} /> : <Smartphone size={12} />} {v}
            </button>
          ))}
        </div>
        {preview === 'desktop' ? (
          <UploadSlot label="Desktop Banner" hint="1920×480px, PNG/JPG, max 2MB" required />
        ) : (
          <UploadSlot label="Mobile Banner" hint="750×400px, PNG/JPG, max 1MB" required />
        )}
        <UploadSlot label="Thumbnail" hint="300×200px, used in the banner list" />

        <SectionLabel>Display Placement</SectionLabel>
        <FormRow label="Placement" required>
          <select style={sel} value={form.placement} onChange={(e) => setForm(f => ({ ...f, placement: e.target.value as BannerPlacement }))}>
            {(['Home Page', 'Hotel Search', 'Hotel Detail', 'Booking Confirmation', 'Login & Register'] as BannerPlacement[]).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormRow>
        <FormRow label="Linked Campaign">
          <input style={inp} value={form.linkedCampaign} onChange={(e) => setForm(f => ({ ...f, linkedCampaign: e.target.value }))} placeholder="Campaign ID (optional)" />
        </FormRow>

        <SectionLabel>Banner Action</SectionLabel>
        <FormRow label="Action Type">
          <select style={sel} value={form.action} onChange={(e) => setForm(f => ({ ...f, action: e.target.value as BannerAction, actionValue: '' }))}>
            {(['No Action', 'Hotel Detail', 'Campaign', 'Promotion', 'Voucher', 'Deep Link', 'External URL'] as BannerAction[]).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </FormRow>
        {needsActionValue && (
          <FormRow label={form.action === 'External URL' ? 'URL' : form.action === 'Deep Link' ? 'Deep Link Path' : `${form.action} ID`}>
            <input style={inp} value={form.actionValue} onChange={(e) => setForm(f => ({ ...f, actionValue: e.target.value }))} placeholder={form.action === 'External URL' ? 'https://…' : `Enter ${form.action} ID`} />
          </FormRow>
        )}

        <SectionLabel>Audience</SectionLabel>
        <FormRow label="Target Audience">
          <select style={sel} value={form.audience} onChange={(e) => setForm(f => ({ ...f, audience: e.target.value as BannerAudience }))}>
            {(['All Users', 'New Users', 'Returning Users', 'Membership Tier', 'Country', 'Language'] as BannerAudience[]).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </FormRow>

        <SectionLabel>Schedule & Priority</SectionLabel>
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormRow label="Start Date & Time" required>
            <input style={inp} type="datetime-local" value={form.scheduleStart} onChange={(e) => setForm(f => ({ ...f, scheduleStart: e.target.value }))} />
          </FormRow>
          <FormRow label="End Date & Time" required>
            <input style={inp} type="datetime-local" value={form.scheduleEnd} onChange={(e) => setForm(f => ({ ...f, scheduleEnd: e.target.value }))} />
          </FormRow>
        </div>
        <FormRow label="Priority" hint="Lower number = higher priority when banners overlap">
          <input style={{ ...inp, width: 100 }} type="number" min={1} max={99} value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))} />
        </FormRow>
      </div>
    </Drawer>
  )
}

// ─── Banner List Page ─────────────────────────────────────────────────────────

function BannerListPage({ showToast }: { showToast: Props['showToast'] }) {
  const [banners, setBanners] = useState<Banner[]>(INIT_BANNERS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BannerStatus | 'all'>('all')
  const [placementFilter, setPlacementFilter] = useState<BannerPlacement | 'all'>('all')
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)
  const perPage = 10

  const filtered = banners.filter(b => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter
    const matchPlacement = placementFilter === 'all' || b.placement === placementFilter
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchPlacement && matchSearch
  })
  const total = filtered.length
  const rows = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const counts = {
    active:    banners.filter(b => b.status === 'active').length,
    scheduled: banners.filter(b => b.status === 'scheduled').length,
    draft:     banners.filter(b => b.status === 'draft').length,
    expired:   banners.filter(b => b.status === 'expired').length,
  }

  function handleSave(form: BannerForm, id?: string) {
    if (id) {
      setBanners(prev => prev.map(b => b.id === id ? { ...b, ...form, priority: Number(form.priority) } : b))
      showToast('success', 'Banner Updated', `"${form.name}" has been updated.`)
    } else {
      const nb: Banner = {
        id: `BNR-${String(banners.length + 1).padStart(3, '0')}`,
        name: form.name, description: form.description, placement: form.placement,
        linkedCampaign: form.linkedCampaign || null, scheduleStart: form.scheduleStart,
        scheduleEnd: form.scheduleEnd, priority: Number(form.priority),
        status: form.status, createdDate: new Date().toISOString().slice(0, 10),
        action: form.action, audience: form.audience,
        color: ['#1664FF','#7C3AED','#059669','#D97706','#0EA5E9','#DC2626'][Math.floor(Math.random()*6)],
      }
      setBanners(prev => [nb, ...prev])
      showToast('success', 'Banner Created', `"${form.name}" has been created.`)
    }
  }

  function toggleStatus(b: Banner) {
    const next: BannerStatus = b.status === 'active' ? 'draft' : 'active'
    setBanners(prev => prev.map(x => x.id === b.id ? { ...x, status: next } : x))
    showToast('success', next === 'active' ? 'Banner Activated' : 'Banner Deactivated', `"${b.name}" is now ${next}.`)
  }

  function duplicate(b: Banner) {
    const nb: Banner = { ...b, id: `BNR-${String(banners.length + 1).padStart(3, '0')}`, name: b.name + ' (Copy)', status: 'draft', createdDate: new Date().toISOString().slice(0, 10) }
    setBanners(prev => [nb, ...prev])
    showToast('success', 'Banner Duplicated', `"${nb.name}" created as a draft.`)
  }

  function handleDelete() {
    if (!deleteTarget) return
    setBanners(prev => prev.filter(b => b.id !== deleteTarget.id))
    showToast('success', 'Banner Deleted', `"${deleteTarget.name}" has been removed.`)
    setDeleteTarget(null)
  }

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Management</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Banner Management</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Manage promotional banners across all app placements</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => showToast('success', 'Export Started', 'Banner list is being exported.')}
            className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
            <Download size={13} /> Export
          </button>
          <button onClick={() => { setEditing(null); setDrawerOpen(true) }}
            className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: '#1664FF' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#1451CC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#1664FF'}>
            <Plus size={14} /> Create Banner
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="flex gap-3 mb-5">
        <KpiCard label="Active Banners"    value={counts.active}    color="#027A48" bg="#ECFDF3" border="#A7F3D0" icon={<CheckCircle size={14} />} />
        <KpiCard label="Scheduled Banners" value={counts.scheduled} color="#1D4ED8" bg="#EFF6FF" border="#BFDBFE" icon={<Calendar    size={14} />} />
        <KpiCard label="Draft Banners"     value={counts.draft}     color="#475569" bg="#F8FAFC" border="#E2E8F0" icon={<MoreHorizontal size={14} />} />
        <KpiCard label="Expired Banners"   value={counts.expired}   color="#C01048" bg="#FFF1F3" border="#FECDD3" icon={<XCircle     size={14} />} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search by banner name or ID…" className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as BannerStatus | 'all'); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
          <option value="expired">Expired</option>
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select value={placementFilter} onChange={(e) => { setPlacementFilter(e.target.value as BannerPlacement | 'all'); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="all">All Placements</option>
          {(['Home Page','Hotel Search','Hotel Detail','Booking Confirmation','Login & Register'] as BannerPlacement[]).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>{total} banners</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Preview', 'Banner Name', 'Placement', 'Linked Campaign', 'Schedule', 'Priority', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="text-left px-4" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-14">
                <Image size={28} color="#E3E8F0" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, color: '#94A3B8' }}>No banners found</div>
                <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 2 }}>Try adjusting your filters</div>
              </td></tr>
            )}
            {rows.map((b, i) => (
              <tr key={b.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFC'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                {/* Preview */}
                <td className="px-4" style={{ height: 52 }}>
                  <div className="rounded-md flex items-center justify-center" style={{ width: 52, height: 30, background: b.color + '18', border: `1px solid ${b.color}30` }}>
                    <Image size={14} color={b.color} />
                  </div>
                </td>
                {/* Name */}
                <td className="px-4">
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{b.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{b.id}</div>
                </td>
                {/* Placement */}
                <td className="px-4">
                  <span className="rounded-full px-2 font-medium" style={{ fontSize: 11, height: 20, display: 'inline-flex', alignItems: 'center', background: '#F1F5F9', color: '#475569', whiteSpace: 'nowrap' }}>{b.placement}</span>
                </td>
                {/* Campaign */}
                <td className="px-4">
                  {b.linkedCampaign
                    ? <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1664FF' }}>{b.linkedCampaign}</span>
                    : <span style={{ fontSize: 12, color: '#CBD5E1' }}>—</span>}
                </td>
                {/* Schedule */}
                <td className="px-4" style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>{b.scheduleStart.slice(0, 10)}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>→ {b.scheduleEnd.slice(0, 10)}</div>
                </td>
                {/* Priority */}
                <td className="px-4">
                  <div className="flex items-center justify-center rounded-full" style={{ width: 24, height: 24, fontSize: 11, fontWeight: 700, background: b.priority === 1 ? '#FEF3C7' : '#F1F5F9', color: b.priority === 1 ? '#92400E' : '#64748B' }}>
                    {b.priority}
                  </div>
                </td>
                {/* Status */}
                <td className="px-4"><BannerStatusBadge status={b.status} /></td>
                {/* Created */}
                <td className="px-4"><span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{b.createdDate}</span></td>
                {/* Actions */}
                <td className="px-4">
                  <div className="flex items-center gap-0.5">
                    <ActionBtn title="Edit"      onClick={() => { setEditing(b); setDrawerOpen(true) }} color="#1664FF"><Edit2 size={12} /></ActionBtn>
                    <ActionBtn title="Duplicate" onClick={() => duplicate(b)}                          color="#7C3AED"><Copy  size={12} /></ActionBtn>
                    <ActionBtn title={b.status === 'active' ? 'Deactivate' : 'Activate'}
                      onClick={() => toggleStatus(b)} color={b.status === 'active' ? '#D97706' : '#059669'}>
                      {b.status === 'active' ? <XCircle size={12} /> : <CheckCircle size={12} />}
                    </ActionBtn>
                    <ActionBtn title="Delete" onClick={() => setDeleteTarget(b)} color="#DC2626"><Trash2 size={12} /></ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}</span>
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

      <BannerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} editing={editing} onSave={handleSave} />
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="danger"
        title="Delete Banner" message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Banner" onConfirm={handleDelete} />
    </div>
  )
}

// ─── Theme Preview Modal ──────────────────────────────────────────────────────

function ThemePreviewModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const [screen, setScreen] = useState<'splash' | 'login' | 'home' | 'search' | 'booking' | 'voucher'>('home')
  const screens = ['splash', 'login', 'home', 'search', 'booking', 'voucher'] as const
  const screenLabels: Record<typeof screens[number], string> = {
    splash: 'Splash Screen', login: 'Login', home: 'Home', search: 'Hotel Search',
    booking: 'Booking Confirmation', voucher: 'Booking Voucher',
  }
  const p = theme.primaryColor; const s = theme.secondaryColor; const a = theme.accentColor; const b = theme.buttonColor

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.5)', zIndex: 100 }}>
      <div className="rounded-xl shadow-2xl flex flex-col" style={{ background: '#fff', border: '1px solid #E3E8F0', width: 680, maxHeight: '90vh' }}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>Theme Preview — {theme.name}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Simulated app appearance with this theme applied</div>
          </div>
          <button onClick={onClose} style={{ fontSize: 18, color: '#94A3B8', lineHeight: 1, padding: '0 4px' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1A2332'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}>✕</button>
        </div>
        {/* Screen selector */}
        <div className="flex items-center gap-1 px-5 py-3 overflow-x-auto" style={{ borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          {screens.map(sc => (
            <button key={sc} onClick={() => setScreen(sc)}
              className="rounded-full px-3 font-medium flex-shrink-0"
              style={{ height: 28, fontSize: 12, background: screen === sc ? p : '#F1F5F9', color: screen === sc ? '#fff' : '#64748B' }}>
              {screenLabels[sc]}
            </button>
          ))}
        </div>
        {/* Phone mockup */}
        <div className="flex-1 flex items-center justify-center py-8 overflow-auto" style={{ background: '#F8FAFC' }}>
          <div className="rounded-3xl overflow-hidden shadow-xl" style={{ width: 220, height: 420, border: '8px solid #1A2332', position: 'relative', flexShrink: 0 }}>
            {/* Status bar */}
            <div className="flex items-center justify-between px-3" style={{ height: 24, background: s, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>09:41</span>
              <div className="flex items-center gap-1">
                {[4,3,2,1].map(i => <div key={i} style={{ width: 3, height: i*2+2, background: `rgba(255,255,255,${0.3 + i*0.15})`, borderRadius: 1 }} />)}
                <div style={{ width: 14, height: 7, borderRadius: 2, border: '1px solid rgba(255,255,255,0.5)', marginLeft: 2 }}>
                  <div style={{ width: '70%', height: '100%', background: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
                </div>
              </div>
            </div>

            {/* Screen content */}
            <div style={{ flex: 1, overflow: 'hidden', height: '100%', background: '#fff' }}>
              {screen === 'splash' && (
                <div className="flex flex-col items-center justify-center h-full" style={{ background: `linear-gradient(160deg, ${s}, ${p})` }}>
                  <div className="rounded-2xl flex items-center justify-center mb-3" style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.2)' }}>
                    <div className="rounded-xl" style={{ width: 40, height: 40, background: '#fff' }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>mTrip</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Your travel companion</div>
                  <div className="mt-auto mb-6" style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.4)' }} />
                </div>
              )}
              {screen === 'login' && (
                <div className="flex flex-col h-full" style={{ background: '#fff' }}>
                  <div style={{ height: 100, background: `linear-gradient(135deg, ${s}, ${p})`, flexShrink: 0 }} />
                  <div className="flex flex-col items-center px-4 py-4 flex-1">
                    <div style={{ fontSize: 12, fontWeight: 700, color: s, marginBottom: 12 }}>Welcome Back</div>
                    <div className="w-full rounded-lg mb-2" style={{ height: 28, background: '#F8FAFC', border: '1px solid #E3E8F0' }} />
                    <div className="w-full rounded-lg mb-3" style={{ height: 28, background: '#F8FAFC', border: '1px solid #E3E8F0' }} />
                    <div className="w-full rounded-lg" style={{ height: 28, background: b }}>
                      <div className="flex items-center justify-center h-full" style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>Login</div>
                    </div>
                    <div style={{ fontSize: 9, color: p, marginTop: 8 }}>Register · Forgot Password</div>
                  </div>
                </div>
              )}
              {screen === 'home' && (
                <div className="flex flex-col h-full" style={{ background: '#F8FAFC' }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ background: s, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>mTrip</div>
                    <div className="rounded-full" style={{ width: 18, height: 18, background: 'rgba(255,255,255,0.2)' }} />
                  </div>
                  <div className="mx-3 mt-3 rounded-lg flex items-center justify-center" style={{ height: 60, background: `linear-gradient(90deg, ${p}, ${a})`, flexShrink: 0 }}>
                    <div style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>Hero Banner</div>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mx-3 mt-2">
                    {['Hotel','Tour','Transfer','More'].map(svc => (
                      <div key={svc} className="flex flex-col items-center gap-1 py-2 rounded-lg" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
                        <div className="rounded-full" style={{ width: 20, height: 20, background: p + '20' }} />
                        <div style={{ fontSize: 7, color: '#64748B' }}>{svc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mx-3 mt-2">
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#1A2332', marginBottom: 6 }}>Recommended Hotels</div>
                    {[1,2].map(i => (
                      <div key={i} className="flex gap-2 rounded-lg p-2 mb-1.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
                        <div className="rounded-md flex-shrink-0" style={{ width: 36, height: 36, background: p + '20' }} />
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 600, color: '#1A2332' }}>Hotel Name {i}</div>
                          <div style={{ fontSize: 7, color: '#94A3B8' }}>Yangon · ★ 4.{5+i}</div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: p }}>MMK 45,000</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {screen === 'search' && (
                <div className="flex flex-col h-full" style={{ background: '#F8FAFC' }}>
                  <div className="px-3 py-2" style={{ background: s }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Find Hotels</div>
                    <div className="rounded-md flex items-center px-2 gap-1" style={{ height: 22, background: 'rgba(255,255,255,0.15)' }}>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Search destinations…</div>
                    </div>
                  </div>
                  <div className="mx-3 mt-2 rounded-lg flex items-center justify-center" style={{ height: 40, background: `linear-gradient(90deg, ${a}50, ${p}50)`, flexShrink: 0 }}>
                    <div style={{ fontSize: 8, color: p, fontWeight: 600 }}>Promotional Banner</div>
                  </div>
                  <div className="mx-3 mt-2 space-y-1.5">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex gap-2 rounded-lg p-2" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
                        <div className="rounded-md flex-shrink-0" style={{ width: 44, height: 40, background: p + '15' }} />
                        <div className="flex-1">
                          <div style={{ fontSize: 8, fontWeight: 600, color: '#1A2332' }}>Hotel Result {i}</div>
                          <div style={{ fontSize: 7, color: '#94A3B8' }}>Yangon · ★ 4.{i+2}</div>
                          <div className="flex items-center justify-between mt-0.5">
                            <div style={{ fontSize: 8, fontWeight: 700, color: p }}>MMK {40+i*5},000</div>
                            <div className="rounded" style={{ width: 30, height: 14, background: b, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 7, color: '#fff', fontWeight: 600 }}>Book</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {screen === 'booking' && (
                <div className="flex flex-col h-full" style={{ background: '#F8FAFC' }}>
                  <div className="px-3 py-3 flex flex-col items-center" style={{ background: `linear-gradient(160deg, ${s}, ${p})`, flexShrink: 0 }}>
                    <div className="rounded-full flex items-center justify-center mb-1" style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)' }}>
                      <CheckCircle size={18} color="#fff" />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>Booking Confirmed!</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>Enjoy your stay</div>
                  </div>
                  <div className="mx-3 mt-2 rounded-lg p-2" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
                    <div style={{ fontSize: 8, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>Booking Details</div>
                    {['Hotel Name','Check-in','Check-out','Guests'].map((lbl, li) => (
                      <div key={lbl} className="flex justify-between" style={{ marginBottom: 3 }}>
                        <span style={{ fontSize: 7, color: '#94A3B8' }}>{lbl}</span>
                        <span style={{ fontSize: 7, fontWeight: 500, color: '#1A2332' }}>{['The Strand Hotel','Dec 20, 2024','Dec 22, 2024','2 Adults'][li]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mx-3 mt-1.5 rounded-lg flex items-center justify-center" style={{ height: 36, background: `linear-gradient(90deg, ${a}40, ${p}40)`, border: `1px solid ${p}30` }}>
                    <div style={{ fontSize: 8, color: p, fontWeight: 600 }}>Exclusive Post-Booking Offer</div>
                  </div>
                </div>
              )}
              {screen === 'voucher' && (
                <div className="flex flex-col h-full" style={{ background: '#F8FAFC' }}>
                  <div className="px-3 py-2" style={{ background: s, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>Booking Voucher</div>
                  </div>
                  <div className="mx-3 mt-2 rounded-t-lg p-2" style={{ background: `linear-gradient(135deg, ${s}, ${p})` }}>
                    <div style={{ fontSize: 8, fontWeight: 600, color: '#fff' }}>The Strand Hotel</div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)' }}>Booking #MTRIP-20241220</div>
                  </div>
                  <div className="mx-3 p-2" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
                    {['Guest Name','Room Type','Check-in','Check-out'].map((lbl, li) => (
                      <div key={lbl} className="flex justify-between mb-1.5">
                        <span style={{ fontSize: 7, color: '#94A3B8' }}>{lbl}</span>
                        <span style={{ fontSize: 7, fontWeight: 500, color: '#1A2332' }}>{['Aung Kyaw','Deluxe Room','Dec 20','Dec 22'][li]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mx-3 rounded-b-lg p-2 flex items-center justify-between" style={{ background: p }}>
                    <span style={{ fontSize: 8, color: '#fff', fontWeight: 600 }}>Total</span>
                    <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>MMK 90,000</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-2">
            <div className="rounded-full" style={{ width: 10, height: 10, background: p }} />
            <span style={{ fontSize: 12, color: '#64748B' }}>Primary: <strong style={{ color: '#1A2332' }}>{p}</strong></span>
            <div className="rounded-full" style={{ width: 10, height: 10, background: s, marginLeft: 8 }} />
            <span style={{ fontSize: 12, color: '#64748B' }}>Secondary: <strong style={{ color: '#1A2332' }}>{s}</strong></span>
            <div className="rounded-full" style={{ width: 10, height: 10, background: a, marginLeft: 8 }} />
            <span style={{ fontSize: 12, color: '#64748B' }}>Accent: <strong style={{ color: '#1A2332' }}>{a}</strong></span>
          </div>
          <button onClick={onClose} className="rounded-md px-4 font-medium"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Theme Editor (Full-Page) ────────────────────────────────────────────────

type ThemeAssetKey =
  | 'defaultLogo' | 'seasonalLogo' | 'appIcon'
  | 'splashDefault' | 'splashSeasonal' | 'splashPromo'
  | 'loginBg' | 'regBg' | 'authIllustration'
  | 'homeHeaderLogo' | 'homePromoBanner'
  | 'serviceHotels' | 'serviceFlights' | 'serviceBuses' | 'serviceFood' | 'serviceCars' | 'servicePackages'
  | 'seasonalHotels' | 'seasonalFlights' | 'seasonalBuses' | 'seasonalFood' | 'seasonalCars' | 'seasonalPackages'
  | 'searchHeaderBg' | 'searchPromoBanner'
  | 'navHome' | 'navMyTrips' | 'navPromotions' | 'navMore'
  | 'bookingSuccess' | 'celebrationBanner'
  | 'voucherHeader' | 'voucherFooter' | 'voucherGraphics' | 'voucherDecorations' | 'voucherBadge'

interface SplashConfig { enabled: boolean; duration: number; order: number }

type ThemeForm = {
  name: string; description: string; type: ThemeType; status: ThemeStatus
  assets: Partial<Record<ThemeAssetKey, boolean>>
  splashDefault: SplashConfig; splashSeasonal: SplashConfig; splashPromo: SplashConfig
  primaryColor: string; secondaryColor: string; accentColor: string; buttonColor: string; backgroundColor: string
  scheduleStart: string; scheduleStartTime: string; scheduleEnd: string; scheduleEndTime: string; priority: string
}

const BLANK_THEME_FORM: ThemeForm = {
  name: '', description: '', type: 'Seasonal', status: 'draft',
  assets: {},
  splashDefault: { enabled: true, duration: 4, order: 1 },
  splashSeasonal: { enabled: false, duration: 4, order: 2 },
  splashPromo: { enabled: false, duration: 3, order: 3 },
  primaryColor: '#1664FF', secondaryColor: '#1A2332', accentColor: '#0EA5E9', buttonColor: '#1664FF', backgroundColor: '#FFFFFF',
  scheduleStart: '', scheduleStartTime: '00:00', scheduleEnd: '', scheduleEndTime: '23:59', priority: '2',
}

const EDITOR_SECTIONS = [
  { id: 'basic',    label: 'Basic Information'   },
  { id: 'branding', label: 'App Branding'         },
  { id: 'splash',   label: 'Splash Screens'       },
  { id: 'auth',     label: 'Login & Registration' },
  { id: 'home',     label: 'Home Screen'          },
  { id: 'search',   label: 'Search Page'          },
  { id: 'nav',      label: 'Bottom Navigation'    },
  { id: 'booking',  label: 'Booking & Voucher'    },
  { id: 'colors',   label: 'Theme Colors'         },
  { id: 'schedule', label: 'Schedule & Priority'  },
  { id: 'preview',  label: 'Preview & Publish'    },
] as const
type EditorSection = typeof EDITOR_SECTIONS[number]['id']

const REQUIRED_ASSETS: { key: ThemeAssetKey; label: string; section: EditorSection }[] = [
  { key: 'defaultLogo',     label: 'App Logo',              section: 'branding' },
  { key: 'splashDefault',   label: 'Default Splash',        section: 'splash'   },
  { key: 'loginBg',         label: 'Login Background',      section: 'auth'     },
  { key: 'homePromoBanner', label: 'Home Banner',           section: 'home'     },
  { key: 'serviceHotels',   label: 'Service Icons',         section: 'home'     },
  { key: 'searchPromoBanner', label: 'Search Banner',       section: 'search'   },
  { key: 'navHome',         label: 'Bottom Navigation',     section: 'nav'      },
  { key: 'bookingSuccess',  label: 'Booking Confirmation',  section: 'booking'  },
  { key: 'voucherHeader',   label: 'Booking Voucher',       section: 'booking'  },
]

function ThemeAssetSlot({ label, hint, required, uploaded, onToggle, size }: {
  label: string; hint?: string; required?: boolean
  uploaded: boolean; onToggle: () => void; size?: 'sm' | 'md'
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}{required && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      <button onClick={onToggle} className="w-full flex flex-col items-center justify-center gap-1 rounded-lg cursor-pointer"
        style={{ height: size === 'sm' ? 64 : 80, border: `2px dashed ${uploaded ? '#6EE7B7' : '#E3E8F0'}`, background: uploaded ? '#F0FDF4' : '#F8FAFC', transition: 'border-color 0.15s, background 0.15s' }}>
        {uploaded ? <CheckCircle size={15} color="#059669" /> : <Upload size={15} color="#CBD5E1" />}
        <span style={{ fontSize: 11, color: uploaded ? '#059669' : '#94A3B8', fontWeight: uploaded ? 600 : 400 }}>
          {uploaded ? 'Uploaded ✓ — click to remove' : 'Click to upload'}
        </span>
      </button>
      {hint && <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

function SplashCard({ title, subtitle, config, onToggleEnabled, onDurationChange, onOrderChange, uploaded, onAssetToggle }: {
  title: string; subtitle: string; config: SplashConfig
  onToggleEnabled: () => void; onDurationChange: (v: number) => void; onOrderChange: (v: number) => void
  uploaded: boolean; onAssetToggle: () => void
}) {
  const inp2: React.CSSProperties = { fontSize: 13, height: 36, padding: '0 12px', border: '1px solid #E3E8F0', borderRadius: 8, background: '#fff', outline: 'none', width: '100%' }
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: config.enabled ? '#F8FAFC' : '#FAFBFC', border: `1px solid ${config.enabled ? '#E3E8F0' : '#F1F5F9'}` }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: config.enabled ? '#1A2332' : '#94A3B8' }}>{title}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{subtitle}</div>
        </div>
        <button onClick={onToggleEnabled} className="flex items-center gap-1.5">
          {config.enabled ? <ToggleRight size={20} color="#1664FF" /> : <ToggleLeft size={20} color="#94A3B8" />}
          <span style={{ fontSize: 11, color: config.enabled ? '#1664FF' : '#94A3B8', fontWeight: 600 }}>{config.enabled ? 'Enabled' : 'Disabled'}</span>
        </button>
      </div>
      {config.enabled && (
        <>
          <ThemeAssetSlot label="Splash Image" hint="1080×1920px, PNG/JPG" uploaded={uploaded} onToggle={onAssetToggle} size="sm" />
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginBottom: 4, display: 'block' }}>Duration (seconds)</label>
              <input style={inp2} type="number" min={1} max={15} value={config.duration} onChange={e => onDurationChange(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginBottom: 4, display: 'block' }}>Display Order</label>
              <input style={inp2} type="number" min={1} max={99} value={config.order} onChange={e => onOrderChange(Number(e.target.value))} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function VoucherPreview({ form }: { form: ThemeForm }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E3E8F0', width: 240, flexShrink: 0 }}>
      <div className="flex items-center justify-center" style={{ height: 48, background: form.assets.voucherHeader ? form.primaryColor : '#E3E8F0' }}>
        {form.assets.voucherHeader
          ? <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Booking Voucher</span>
          : <span style={{ fontSize: 11, color: '#94A3B8' }}>Voucher Header</span>}
      </div>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ background: '#fff', borderBottom: '1px solid #F1F5F9' }}>
        <div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>Booking ID</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>BK-2024-08891</div>
        </div>
        {form.assets.voucherBadge
          ? <span className="rounded-full px-2.5 font-medium" style={{ fontSize: 9, height: 18, display: 'inline-flex', alignItems: 'center', background: form.accentColor + '25', color: form.accentColor }}>CONFIRMED</span>
          : <span className="rounded-full px-2.5" style={{ fontSize: 9, height: 18, display: 'inline-flex', alignItems: 'center', background: '#F1F5F9', color: '#94A3B8' }}>Badge</span>}
      </div>
      {form.assets.voucherGraphics && <div style={{ height: 3, background: `linear-gradient(to right, ${form.primaryColor}, ${form.accentColor})` }} />}
      <div className="px-3 py-2.5" style={{ background: '#F8FAFC' }}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, background: form.primaryColor + '15', flexShrink: 0, fontSize: 16 }}>🏨</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1A2332' }}>Grand Palace Hotel</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>Yangon · 2 nights</div>
          </div>
        </div>
      </div>
      {form.assets.voucherDecorations && (
        <div className="flex items-center justify-center gap-1 py-1.5" style={{ background: '#FFF7ED', fontSize: 10 }}>
          <span>🌸</span><span style={{ color: '#D97706' }}>Seasonal Decoration</span><span>🌸</span>
        </div>
      )}
      <div className="flex items-center justify-center" style={{ height: 36, background: form.assets.voucherFooter ? form.secondaryColor : '#F1F5F9' }}>
        <span style={{ fontSize: 10, color: form.assets.voucherFooter ? '#fff' : '#94A3B8' }}>
          {form.assets.voucherFooter ? 'mTrip · Powered by mTrip' : 'Voucher Footer'}
        </span>
      </div>
    </div>
  )
}

function ThemeEditor({ editing, onClose, onSave }: {
  editing: Theme | null; onClose: () => void
  onSave: (form: ThemeForm, id?: string) => void
}) {
  const [form, setForm] = useState<ThemeForm>(() =>
    editing ? {
      ...BLANK_THEME_FORM,
      name: editing.name, description: editing.description, type: editing.type, status: editing.status,
      primaryColor: editing.primaryColor, secondaryColor: editing.secondaryColor,
      accentColor: editing.accentColor, buttonColor: editing.buttonColor,
      scheduleStart: editing.scheduleStart ?? '', scheduleEnd: editing.scheduleEnd ?? '',
      priority: String(editing.priority),
    } : BLANK_THEME_FORM
  )
  const [activeSection, setActiveSection] = useState<EditorSection>('basic')
  const [showPreview, setShowPreview] = useState(false)
  const isBuiltIn = editing !== null && !editing.deletable

  const inp2: React.CSSProperties = { fontSize: 13, height: 36, padding: '0 12px', border: '1px solid #E3E8F0', borderRadius: 8, background: '#fff', outline: 'none', width: '100%' }
  const sel2: React.CSSProperties = { ...inp2, cursor: 'pointer' }
  const ta2: React.CSSProperties = { ...inp2, height: 'auto', padding: '10px 12px', resize: 'vertical' as const }

  function toggleAsset(key: ThemeAssetKey) {
    setForm(f => ({ ...f, assets: { ...f.assets, [key]: !f.assets[key] } }))
  }
  function setField(k: keyof ThemeForm, v: unknown) { setForm(f => ({ ...f, [k]: v })) }
  function setSplash(which: 'splashDefault' | 'splashSeasonal' | 'splashPromo', patch: Partial<SplashConfig>) {
    setForm(f => ({ ...f, [which]: { ...f[which], ...patch } }))
  }

  function assetSlot(key: ThemeAssetKey, label: string, hint?: string, required?: boolean, size?: 'sm' | 'md') {
    return <ThemeAssetSlot key={key} label={label} hint={hint} required={required} uploaded={!!form.assets[key]} onToggle={() => toggleAsset(key)} size={size} />
  }

  const completedCount = REQUIRED_ASSETS.filter(ra => !!form.assets[ra.key]).length + 1
  const totalRequired = REQUIRED_ASSETS.length + 1

  function sectionDone(id: EditorSection): boolean {
    if (id === 'basic')    return !!form.name.trim()
    if (id === 'branding') return !!form.assets.defaultLogo
    if (id === 'splash')   return !!form.assets.splashDefault
    if (id === 'auth')     return !!form.assets.loginBg
    if (id === 'home')     return !!form.assets.homePromoBanner && !!form.assets.serviceHotels
    if (id === 'search')   return !!form.assets.searchPromoBanner
    if (id === 'nav')      return !!form.assets.navHome
    if (id === 'booking')  return !!form.assets.bookingSuccess && !!form.assets.voucherHeader
    if (id === 'colors')   return true
    if (id === 'schedule') return true
    return false
  }

  const previewTheme: Theme = {
    id: editing?.id ?? 'PREVIEW', name: form.name || 'Preview', description: form.description,
    category: editing?.category ?? 'Custom', type: form.type,
    scheduleStart: form.scheduleStart || null, scheduleEnd: form.scheduleEnd || null,
    priority: Number(form.priority), status: form.status, lastUpdated: new Date().toISOString().slice(0, 10),
    primaryColor: form.primaryColor, secondaryColor: form.secondaryColor,
    accentColor: form.accentColor, buttonColor: form.buttonColor, deletable: editing?.deletable ?? true,
  }

  function handleSave(status: ThemeStatus) { onSave({ ...form, status }, editing?.id); onClose() }

  function renderSection() {
    if (activeSection === 'basic') return (
      <>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Basic Information</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Theme name, type, and thumbnail</p>
        <FormRow label="Theme Name" required>
          <input style={inp2} value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Christmas 2025" disabled={isBuiltIn} />
        </FormRow>
        <FormRow label="Description">
          <textarea style={ta2} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Brief description of this theme…" rows={3} />
        </FormRow>
        <FormRow label="Theme Type">
          <select style={sel2} value={form.type} onChange={e => setField('type', e.target.value)} disabled={isBuiltIn}>
            {(['Default','Seasonal','Promotion','Anniversary','Destination','Partnership','Custom'] as ThemeType[]).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
        {assetSlot('defaultLogo', 'Theme Thumbnail', '800×600px, PNG/JPG')}
      </>
    )

    if (activeSection === 'branding') return (
      <>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Application Branding</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Core brand assets displayed throughout the app</p>
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {assetSlot('defaultLogo', 'Default App Logo', 'SVG or PNG, transparent background', true)}
          {assetSlot('seasonalLogo', 'Seasonal App Logo', 'Replaces default during theme period')}
        </div>
        <SectionLabel>App Store Icon</SectionLabel>
        {assetSlot('appIcon', 'App Icon', '1024×1024px PNG')}
        <div className="rounded-lg px-3 py-2.5 mb-4 flex items-start gap-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <AlertCircle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>Changing the App Store or Play Store icon requires a new application release and cannot be applied through theme management alone.</p>
        </div>
      </>
    )

    if (activeSection === 'splash') return (
      <>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Splash Screens</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Configure up to 3 splash screens shown at app launch</p>
        <SplashCard
          title="Default Splash" subtitle="Shown outside seasonal / promo periods"
          config={form.splashDefault} onToggleEnabled={() => setSplash('splashDefault', { enabled: !form.splashDefault.enabled })}
          onDurationChange={v => setSplash('splashDefault', { duration: v })} onOrderChange={v => setSplash('splashDefault', { order: v })}
          uploaded={!!form.assets.splashDefault} onAssetToggle={() => toggleAsset('splashDefault')} />
        <SplashCard
          title="Seasonal Splash" subtitle="Active only during the theme schedule window"
          config={form.splashSeasonal} onToggleEnabled={() => setSplash('splashSeasonal', { enabled: !form.splashSeasonal.enabled })}
          onDurationChange={v => setSplash('splashSeasonal', { duration: v })} onOrderChange={v => setSplash('splashSeasonal', { order: v })}
          uploaded={!!form.assets.splashSeasonal} onAssetToggle={() => toggleAsset('splashSeasonal')} />
        <SplashCard
          title="Promotional Splash" subtitle="Promotional announcement, shown before other splashes"
          config={form.splashPromo} onToggleEnabled={() => setSplash('splashPromo', { enabled: !form.splashPromo.enabled })}
          onDurationChange={v => setSplash('splashPromo', { duration: v })} onOrderChange={v => setSplash('splashPromo', { order: v })}
          uploaded={!!form.assets.splashPromo} onAssetToggle={() => toggleAsset('splashPromo')} />
      </>
    )

    if (activeSection === 'auth') return (
      <>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Login & Registration</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Background imagery and illustrations for authentication screens</p>
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {assetSlot('loginBg', 'Login Background', '1080×1920px', true)}
          {assetSlot('regBg', 'Registration Background', '1080×1920px')}
        </div>
        {assetSlot('authIllustration', 'Auth Illustration', 'SVG or PNG, centered on screen')}
      </>
    )

    if (activeSection === 'home') {
      const defaultSvcs: [ThemeAssetKey, string, boolean][] = [
        ['serviceHotels','Hotels',true],['serviceFlights','Flights',false],['serviceBuses','Buses',false],
        ['serviceFood','Food',false],['serviceCars','Cars',false],['servicePackages','Packages',false],
      ]
      const seasonalSvcs: [ThemeAssetKey, string][] = [
        ['seasonalHotels','Hotels'],['seasonalFlights','Flights'],['seasonalBuses','Buses'],
        ['seasonalFood','Food'],['seasonalCars','Cars'],['seasonalPackages','Packages'],
      ]
      return (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Home Screen</h2>
          <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Header logo, promotional banner, and service category icons</p>
          <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {assetSlot('homeHeaderLogo', 'Header Logo', 'SVG or PNG, ~240×60px')}
            {assetSlot('homePromoBanner', 'Promotional Banner', '1080×480px', true)}
          </div>
          <SectionLabel>Service Menu Icons — Default Set</SectionLabel>
          <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>96×96px SVG or PNG for each service category</p>
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {defaultSvcs.map(([key, lbl, req]) => assetSlot(key, lbl, '96×96px', req, 'sm'))}
          </div>
          <SectionLabel>Service Menu Icons — Seasonal Set</SectionLabel>
          <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>Optional seasonal variants shown during theme schedule</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {seasonalSvcs.map(([key, lbl]) => assetSlot(key as ThemeAssetKey, lbl, '96×96px', false, 'sm'))}
          </div>
        </>
      )
    }

    if (activeSection === 'search') return (
      <>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Search Page</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Assets displayed on hotel, flight, and service search screens</p>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {assetSlot('searchHeaderBg', 'Search Header Background', '1080×280px')}
          {assetSlot('searchPromoBanner', 'Search Promotional Banner', '1080×280px', true)}
        </div>
      </>
    )

    if (activeSection === 'nav') {
      const navItems: [ThemeAssetKey, string, boolean][] = [
        ['navHome','Home',true], ['navMyTrips','My Trips',false],
        ['navPromotions','Promotions',false], ['navMore','More',false],
      ]
      return (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Bottom Navigation</h2>
          <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Icon sets for the 4 main navigation tabs</p>
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {navItems.map(([key, lbl, req]) => assetSlot(key, lbl + ' Icon', '24×24px SVG', req, 'sm'))}
          </div>
          <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <AlertCircle size={14} color="#1664FF" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>Upload a ZIP archive containing both active (coloured) and inactive (grey) variants, e.g. <code>home_active.svg</code> and <code>home_inactive.svg</code>. Active state is additionally tinted with the primary colour.</p>
          </div>
        </>
      )
    }

    if (activeSection === 'booking') return (
      <>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Booking Confirmation & Voucher</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Assets for post-booking screens and the digital/PDF voucher</p>
        <SectionLabel>Booking Confirmation Screen</SectionLabel>
        <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {assetSlot('bookingSuccess', 'Success Illustration', 'SVG or PNG', true)}
          {assetSlot('celebrationBanner', 'Celebration Banner', '1080×300px')}
        </div>
        <SectionLabel>Booking Voucher Assets</SectionLabel>
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {assetSlot('voucherHeader', 'Voucher Header', '1080×200px', true, 'sm')}
              {assetSlot('voucherFooter', 'Voucher Footer', '1080×200px', false, 'sm')}
              {assetSlot('voucherGraphics', 'Decorative Graphics', 'Dividers / watermarks', false, 'sm')}
              {assetSlot('voucherDecorations', 'Seasonal Decorations', 'Festive borders / accents', false, 'sm')}
            </div>
            {assetSlot('voucherBadge', 'Promotional Badge', 'Stamp or ribbon overlay, 200×200px', false, 'sm')}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Live Preview</div>
            <VoucherPreview form={form} />
          </div>
        </div>
      </>
    )

    if (activeSection === 'colors') {
      const colorFields: [keyof ThemeForm, string][] = [
        ['primaryColor','Primary Color'], ['secondaryColor','Secondary Color'],
        ['accentColor','Accent Color'], ['buttonColor','Button Color'],
        ['backgroundColor','Background Color'],
      ]
      return (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Theme Colors</h2>
          <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Core colour palette applied across all app screens</p>
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {colorFields.map(([k, lbl]) => (
              <div key={k as string}>
                <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 6 }}>{lbl}</label>
                <div className="flex items-center gap-3 rounded-lg px-3" style={{ height: 44, border: '1px solid #E3E8F0', background: '#fff' }}>
                  <input type="color" value={form[k] as string} onChange={e => setField(k, e.target.value)}
                    style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#1A2332', fontWeight: 600 }}>{form[k] as string}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{lbl}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <SectionLabel>Colour Preview</SectionLabel>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
            <div className="flex items-center justify-between px-4" style={{ height: 50, background: form.primaryColor }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{form.name || 'App Header'}</span>
              <span className="rounded-md px-3 font-medium" style={{ fontSize: 11, height: 26, display: 'inline-flex', alignItems: 'center', background: form.buttonColor, color: '#fff' }}>Book Now</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: form.backgroundColor }}>
              <div className="rounded-lg flex items-center justify-center" style={{ width: 40, height: 40, background: form.accentColor + '25', flexShrink: 0 }}>
                <div className="rounded-full" style={{ width: 16, height: 16, background: form.accentColor }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: form.secondaryColor }}>Grand Palace Hotel</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Yangon · MMK 85,000/night</div>
              </div>
              <div className="ml-auto rounded-md px-3 font-medium" style={{ fontSize: 11, height: 28, display: 'inline-flex', alignItems: 'center', background: form.primaryColor, color: '#fff' }}>Select</div>
            </div>
            <div className="flex" style={{ borderTop: '1px solid #F1F5F9' }}>
              {[form.primaryColor, form.secondaryColor, form.accentColor, form.buttonColor, form.backgroundColor].map((c, i) => (
                <div key={i} style={{ flex: 1, height: 10, background: c }} />
              ))}
            </div>
          </div>
        </>
      )
    }

    if (activeSection === 'schedule') return (
      <>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Schedule & Priority</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Control when this theme is active and its display priority</p>
        <SectionLabel>Activation Window</SectionLabel>
        <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <FormRow label="Start Date">
              <input style={inp2} type="date" value={form.scheduleStart} onChange={e => setField('scheduleStart', e.target.value)} />
            </FormRow>
            <FormRow label="Start Time">
              <input style={inp2} type="time" value={form.scheduleStartTime} onChange={e => setField('scheduleStartTime', e.target.value)} />
            </FormRow>
          </div>
          <div>
            <FormRow label="End Date">
              <input style={inp2} type="date" value={form.scheduleEnd} onChange={e => setField('scheduleEnd', e.target.value)} />
            </FormRow>
            <FormRow label="End Time">
              <input style={inp2} type="time" value={form.scheduleEndTime} onChange={e => setField('scheduleEndTime', e.target.value)} />
            </FormRow>
          </div>
        </div>
        <SectionLabel>Priority & Status</SectionLabel>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormRow label="Priority" hint="Lower = higher priority when themes overlap">
            <input style={inp2} type="number" min={0} max={99} value={form.priority} onChange={e => setField('priority', e.target.value)} disabled={editing?.id === 'THM-001'} />
          </FormRow>
          <FormRow label="Theme Status">
            <select style={sel2} value={form.status} onChange={e => setField('status', e.target.value as ThemeStatus)}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormRow>
        </div>
      </>
    )

    if (activeSection === 'preview') return (
      <>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2332', marginBottom: 4 }}>Preview & Publish</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>Review theme completeness before publishing</p>
        <div className="rounded-xl p-5 mb-5" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Theme Completeness</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: completedCount >= totalRequired ? '#059669' : '#D97706' }}>{completedCount}/{totalRequired} assets</span>
          </div>
          <div className="rounded-full overflow-hidden mb-5" style={{ height: 8, background: '#E3E8F0' }}>
            <div className="rounded-full h-full" style={{ width: `${(completedCount / totalRequired) * 100}%`, background: completedCount >= totalRequired ? '#059669' : '#1664FF', transition: 'width 0.3s ease' }} />
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {REQUIRED_ASSETS.map(ra => {
              const done = !!form.assets[ra.key]
              return (
                <div key={ra.key} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fff', border: `1px solid ${done ? '#A7F3D0' : '#E3E8F0'}` }}>
                  <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 18, height: 18, background: done ? '#059669' : '#F1F5F9', fontSize: 9, fontWeight: 700, color: done ? '#fff' : '#CBD5E1' }}>
                    {done ? '✓' : '!'}
                  </div>
                  <span style={{ fontSize: 12, color: done ? '#059669' : '#64748B', fontWeight: done ? 600 : 400 }}>{ra.label}</span>
                  {!done && (
                    <button onClick={() => setActiveSection(ra.section)} className="ml-auto" style={{ fontSize: 10, color: '#1664FF', textDecoration: 'underline', whiteSpace: 'nowrap' }}>Fix →</button>
                  )}
                </div>
              )
            })}
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fff', border: '1px solid #A7F3D0' }}>
              <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 18, height: 18, background: '#059669', fontSize: 9, fontWeight: 700, color: '#fff' }}>✓</div>
              <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>Theme Colors</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 6 }}>Mobile App Preview</div>
          <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14 }}>Preview how the colour palette and layout will appear across key screens</p>
          <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 rounded-lg px-4 font-medium"
            style={{ height: 36, fontSize: 13, color: '#0EA5E9', border: '1px solid #BAE6FD', background: '#F0F9FF' }}>
            <Eye size={14} /> Open Preview
          </button>
          {completedCount < totalRequired && (
            <div className="rounded-lg px-3 py-2.5 mt-4 flex items-start gap-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <AlertCircle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                {totalRequired - completedCount} required asset{totalRequired - completedCount !== 1 ? 's are' : ' is'} still missing. Complete all required assets before publishing.
              </p>
            </div>
          )}
        </div>
      </>
    )

    return null
  }

  const pct = Math.round((completedCount / totalRequired) * 100)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 flex-shrink-0" style={{ height: 56, borderBottom: '1px solid #E3E8F0', background: '#fff' }}>
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 32, fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', background: '#F8FAFC', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
          onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}>
          <ArrowLeft size={13} /> Back
        </button>
        <div style={{ width: 1, height: 20, background: '#E3E8F0' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>{editing ? `Edit Theme — ${editing.id}` : 'Create New Theme'}</div>
          {form.name && <div style={{ fontSize: 11, color: '#94A3B8' }}>{form.name}</div>}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
          <div className="rounded-full" style={{ width: 7, height: 7, background: pct >= 100 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626' }} />
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{completedCount}/{totalRequired} Assets</span>
          <div className="rounded-full overflow-hidden" style={{ width: 64, height: 5, background: '#E3E8F0' }}>
            <div className="rounded-full h-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#059669' : '#1664FF', transition: 'width 0.3s ease' }} />
          </div>
        </div>
        <button onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 32, fontSize: 12, color: '#0EA5E9', border: '1px solid #BAE6FD', background: '#F0F9FF', cursor: 'pointer' }}>
          <Eye size={13} /> Preview
        </button>
        <button onClick={() => handleSave('draft')} className="rounded-md px-3"
          style={{ height: 32, fontSize: 12, color: '#1664FF', border: '1px solid #BFDBFE', background: '#EEF4FF', cursor: 'pointer' }}>
          Save Draft
        </button>
        <button onClick={() => handleSave(form.scheduleStart ? 'scheduled' : 'active')} disabled={!form.name.trim()}
          className="rounded-md px-4 font-medium text-white"
          style={{ height: 32, fontSize: 12, background: !form.name.trim() ? '#94A3B8' : '#1664FF', cursor: !form.name.trim() ? 'not-allowed' : 'pointer' }}>
          {editing ? 'Save Changes' : 'Create Theme'}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div style={{ width: 214, flexShrink: 0, borderRight: '1px solid #E3E8F0', background: '#FAFBFC', overflowY: 'auto' }}>
          <div style={{ padding: '12px 10px' }}>
            {EDITOR_SECTIONS.map((sec, i) => {
              const isActive = activeSection === sec.id
              const isDone = sectionDone(sec.id)
              return (
                <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 mb-0.5 text-left"
                  style={{ background: isActive ? '#EEF4FF' : 'transparent', borderLeft: `3px solid ${isActive ? '#1664FF' : 'transparent'}`, cursor: 'pointer' }}>
                  <div className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ width: 20, height: 20, background: isDone ? '#059669' : isActive ? '#1664FF' : '#E3E8F0', fontSize: 9, fontWeight: 700, color: isDone || isActive ? '#fff' : '#94A3B8' }}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#1664FF' : '#475569' }}>{sec.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ background: '#fff' }}>
          <div style={{ maxWidth: 680, padding: '32px 40px' }}>
            {renderSection()}
          </div>
        </div>
      </div>

      {showPreview && <ThemePreviewModal theme={previewTheme} onClose={() => setShowPreview(false)} />}
    </div>
  )
}

// ─── Theme List Page ──────────────────────────────────────────────────────────

function ThemeListPage({ showToast }: { showToast: Props['showToast'] }) {
  const [themes, setThemes] = useState<Theme[]>(INIT_THEMES)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ThemeStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<ThemeCategory | 'all'>('all')
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Theme | null>(null)
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Theme | null>(null)
  const perPage = 8

  const filtered = themes.filter(t => {
    const matchStatus   = statusFilter === 'all'   || t.status === statusFilter
    const matchCategory = categoryFilter === 'all' || t.category === categoryFilter
    const matchSearch   = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchCategory && matchSearch
  })
  const total = filtered.length
  const rows = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const counts = {
    active:    themes.filter(t => t.status === 'active').length,
    scheduled: themes.filter(t => t.status === 'scheduled').length,
    draft:     themes.filter(t => t.status === 'draft').length,
    builtIn:   themes.filter(t => t.category === 'Built-in').length,
    custom:    themes.filter(t => t.category === 'Custom').length,
  }
  const upcoming = themes.filter(t => t.status === 'scheduled' && t.scheduleStart).sort((a, b) => (a.scheduleStart ?? '').localeCompare(b.scheduleStart ?? '')).slice(0, 4)

  function handleSave(form: ThemeForm, id?: string) {
    if (id) {
      setThemes(prev => prev.map(t => t.id === id ? { ...t, ...form, priority: Number(form.priority), lastUpdated: new Date().toISOString().slice(0, 10) } : t))
      showToast('success', 'Theme Updated', `"${form.name}" has been updated.`)
    } else {
      const nt: Theme = {
        id: `THM-${String(themes.length + 1).padStart(3, '0')}`, name: form.name, description: form.description,
        category: 'Custom', type: form.type,
        scheduleStart: form.scheduleStart || null, scheduleEnd: form.scheduleEnd || null,
        priority: Number(form.priority), status: form.status, lastUpdated: new Date().toISOString().slice(0, 10),
        primaryColor: form.primaryColor, secondaryColor: form.secondaryColor,
        accentColor: form.accentColor, buttonColor: form.buttonColor, deletable: true,
      }
      setThemes(prev => [nt, ...prev])
      showToast('success', 'Theme Created', `"${form.name}" has been created as a draft.`)
    }
  }

  function toggleStatus(t: Theme) {
    const next: ThemeStatus = t.status === 'active' ? 'inactive' : t.status === 'inactive' ? 'draft' : 'active'
    setThemes(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x))
    showToast('success', `Theme ${next.charAt(0).toUpperCase() + next.slice(1)}`, `"${t.name}" is now ${next}.`)
  }

  function duplicate(t: Theme) {
    const nt: Theme = { ...t, id: `THM-${String(themes.length + 1).padStart(3, '0')}`, name: t.name + ' (Copy)', status: 'draft', category: 'Custom', deletable: true, lastUpdated: new Date().toISOString().slice(0, 10) }
    setThemes(prev => [nt, ...prev])
    showToast('success', 'Theme Duplicated', `"${nt.name}" created as a custom draft.`)
  }

  function handleDelete() {
    if (!deleteTarget) return
    setThemes(prev => prev.filter(t => t.id !== deleteTarget.id))
    showToast('success', 'Theme Deleted', `"${deleteTarget.name}" has been removed.`)
    setDeleteTarget(null)
  }

  if (drawerOpen) {
    return <ThemeEditor editing={editing} onClose={() => { setDrawerOpen(false); setEditing(null) }} onSave={(form, id) => { handleSave(form, id); setDrawerOpen(false); setEditing(null) }} />
  }

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content Management</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Theme Management</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Manage application branding and visual themes across all screens</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditing(null); setDrawerOpen(true) }}
            className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: '#1664FF' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#1451CC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#1664FF'}>
            <Plus size={14} /> Create Theme
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="flex gap-3 mb-5">
        <KpiCard label="Active Theme"     value={counts.active}    color="#027A48" bg="#ECFDF3" border="#A7F3D0" icon={<CheckCircle size={14} />} />
        <KpiCard label="Scheduled Themes" value={counts.scheduled} color="#1D4ED8" bg="#EFF6FF" border="#BFDBFE" icon={<Calendar    size={14} />} />
        <KpiCard label="Draft Themes"     value={counts.draft}     color="#475569" bg="#F8FAFC" border="#E2E8F0" icon={<Clock       size={14} />} />
        <KpiCard label="Built-in Themes"  value={counts.builtIn}   color="#B45309" bg="#FFFBEB" border="#FDE68A" icon={<Layers      size={14} />} />
        <KpiCard label="Custom Themes"    value={counts.custom}    color="#6D28D9" bg="#F5F3FF" border="#DDD6FE" icon={<Palette     size={14} />} />
      </div>

      {/* Upcoming schedule timeline */}
      {upcoming.length > 0 && (
        <div className="rounded-lg p-4 mb-5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming Theme Schedule</div>
          <div className="flex items-center gap-0">
            {upcoming.map((t, i) => (
              <div key={t.id} className="flex items-center gap-0 flex-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
                    <div className="rounded-md flex-shrink-0" style={{ width: 28, height: 28, background: t.primaryColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="rounded-full" style={{ width: 10, height: 10, background: t.primaryColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{t.scheduleStart} → {t.scheduleEnd}</div>
                    </div>
                    <ThemeStatusBadge status={t.status} />
                  </div>
                </div>
                {i < upcoming.length - 1 && <ArrowRight size={14} color="#CBD5E1" style={{ flexShrink: 0, margin: '0 8px' }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search by theme name or ID…" className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as ThemeStatus | 'all'); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value as ThemeCategory | 'all'); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option value="all">All Categories</option>
          <option value="Built-in">Built-in</option>
          <option value="Custom">Custom</option>
        </select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>{total} themes</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Preview', 'Theme Name', 'Category', 'Type', 'Schedule', 'Priority', 'Status', 'Last Updated', 'Actions'].map(h => (
                <th key={h} className="text-left px-4" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-14">
                <Palette size={28} color="#E3E8F0" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, color: '#94A3B8' }}>No themes found</div>
              </td></tr>
            )}
            {rows.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#FAFBFC'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                {/* Preview swatches */}
                <td className="px-4" style={{ height: 52 }}>
                  <div className="flex items-center gap-1">
                    {[t.primaryColor, t.secondaryColor, t.accentColor].map((c, ci) => (
                      <div key={ci} className="rounded-md" style={{ width: 16, height: 28, background: c }} />
                    ))}
                  </div>
                </td>
                {/* Name */}
                <td className="px-4">
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{t.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{t.id}</div>
                </td>
                {/* Category */}
                <td className="px-4">
                  <span className="rounded-full px-2 font-medium" style={{ fontSize: 11, height: 20, display: 'inline-flex', alignItems: 'center', background: t.category === 'Built-in' ? '#FEF3C7' : '#EDE9FE', color: t.category === 'Built-in' ? '#92400E' : '#5B21B6', whiteSpace: 'nowrap' }}>
                    {t.category}
                  </span>
                </td>
                {/* Type */}
                <td className="px-4"><span style={{ fontSize: 12, color: '#475569' }}>{t.type}</span></td>
                {/* Schedule */}
                <td className="px-4" style={{ whiteSpace: 'nowrap' }}>
                  {t.scheduleStart
                    ? <><div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>{t.scheduleStart}</div><div style={{ fontSize: 11, color: '#94A3B8' }}>→ {t.scheduleEnd ?? '∞'}</div></>
                    : <span style={{ fontSize: 12, color: '#CBD5E1' }}>Always on</span>}
                </td>
                {/* Priority */}
                <td className="px-4">
                  <div className="flex items-center justify-center rounded-full" style={{ width: 24, height: 24, fontSize: 11, fontWeight: 700, background: t.priority === 0 ? '#EEF4FF' : t.priority === 1 ? '#FEF3C7' : '#F1F5F9', color: t.priority === 0 ? '#1664FF' : t.priority === 1 ? '#92400E' : '#64748B' }}>
                    {t.priority === 0 ? 'D' : t.priority}
                  </div>
                </td>
                {/* Status */}
                <td className="px-4"><ThemeStatusBadge status={t.status} /></td>
                {/* Last updated */}
                <td className="px-4"><span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{t.lastUpdated}</span></td>
                {/* Actions */}
                <td className="px-4">
                  <div className="flex items-center gap-0.5">
                    <ActionBtn title="Preview"   onClick={() => setPreviewTheme(t)}                            color="#0EA5E9"><Eye    size={12} /></ActionBtn>
                    <ActionBtn title="Edit"      onClick={() => { setEditing(t); setDrawerOpen(true) }}       color="#1664FF"><Edit2  size={12} /></ActionBtn>
                    <ActionBtn title="Duplicate" onClick={() => duplicate(t)}                                 color="#7C3AED"><Copy   size={12} /></ActionBtn>
                    <ActionBtn title={t.status === 'active' ? 'Deactivate' : 'Activate'}
                      onClick={() => toggleStatus(t)} color={t.status === 'active' ? '#D97706' : '#059669'}>
                      {t.status === 'active' ? <XCircle size={12} /> : <CheckCircle size={12} />}
                    </ActionBtn>
                    {t.deletable && (
                      <ActionBtn title="Delete" onClick={() => setDeleteTarget(t)} color="#DC2626"><Trash2 size={12} /></ActionBtn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}</span>
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

      {previewTheme && <ThemePreviewModal theme={previewTheme} onClose={() => setPreviewTheme(null)} />}
      {/* ThemeEditor is rendered as full-page overlay via early return above */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="danger"
        title="Delete Theme" message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Theme" onConfirm={handleDelete} />
    </div>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function ContentManagementPage({ tab, showToast }: Props) {
  if (tab === 'contentmgmt-themes') return <ThemeListPage showToast={showToast} />
  return <BannerListPage showToast={showToast} />
}

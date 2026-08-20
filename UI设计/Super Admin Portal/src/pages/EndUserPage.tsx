import { useState, useRef, useEffect } from 'react'
import {
  Search, Plus, Download, Eye, ChevronLeft, ChevronRight,
  UserX, UserCheck, KeyRound, LogOut, LogIn, Phone, Mail, Globe,
  Smartphone, Monitor, Shield, ShieldOff, Clock, Star, Gift, Tag,
  Ticket, RotateCcw, ChevronDown, CheckCircle, CalendarCheck,
  AlertTriangle, XCircle, TrendingUp, Calendar, CreditCard,
  Activity, Filter, MessageCircle, Building2, X, Minus, ExternalLink, Bell,
  Send, BellOff, RefreshCw,
  MessageSquare, Flag, ShieldAlert, FileDown, Store,
  Hotel, UtensilsCrossed, Plane, Car, Users,
} from 'lucide-react'
import Drawer from '../components/Drawer'
import NotificationDrawer, { type NotifRecipient, type SentNotifPayload } from '../components/NotificationDrawer'
import UserTransactionsPage from './UserTransactionsPage'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
  onEndUserChange?: (ctx: { name: string; avatar: string; tier: string } | null) => void
  onNavigate?: (page: PageId) => void
}

// ── Shared ────────────────────────────────────────────────────────────────────

type UserStatus = 'active' | 'suspended' | 'blacklisted' | 'inactive'
type MemberTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'pending'
type RefundStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'processed'
type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed'

const TIER_STYLE: Record<MemberTier, { bg: string; color: string }> = {
  Bronze:   { bg: '#FFF7ED', color: '#9A3412' },
  Silver:   { bg: '#F1F5F9', color: '#475569' },
  Gold:     { bg: '#FFFBEB', color: '#B45309' },
  Platinum: { bg: '#EFF6FF', color: '#1D4ED8' },
}

const STATUS_STYLE: Record<UserStatus, { bg: string; color: string; label: string }> = {
  active:      { bg: '#ECFDF3', color: '#027A48', label: 'Active' },
  suspended:   { bg: '#FFFAEB', color: '#B54708', label: 'Suspended' },
  blacklisted: { bg: '#FFF1F3', color: '#C01048', label: 'Blacklisted' },
  inactive:    { bg: '#F8FAFC', color: '#64748B', label: 'Inactive' },
}

const BOOKING_STATUS_STYLE: Record<BookingStatus, { bg: string; color: string; label: string }> = {
  confirmed:  { bg: '#EFF6FF', color: '#1D4ED8', label: 'Confirmed' },
  completed:  { bg: '#ECFDF3', color: '#027A48', label: 'Completed' },
  cancelled:  { bg: '#F1F5F9', color: '#475569', label: 'Cancelled' },
  pending:    { bg: '#FFFAEB', color: '#B54708', label: 'Pending' },
}

const REFUND_STYLE: Record<RefundStatus, { color: string; label: string }> = {
  none:      { color: '#94A3B8', label: '—' },
  requested: { color: '#D97706', label: 'Requested' },
  approved:  { color: '#1664FF', label: 'Approved' },
  rejected:  { color: '#DC2626', label: 'Rejected' },
  processed: { color: '#059669', label: 'Processed' },
}

const TICKET_STYLE: Record<TicketStatus, { bg: string; color: string; label: string }> = {
  'open':        { bg: '#FFF1F3', color: '#C01048', label: 'Open' },
  'in-progress': { bg: '#EFF6FF', color: '#1D4ED8', label: 'In Progress' },
  'resolved':    { bg: '#ECFDF3', color: '#027A48', label: 'Resolved' },
  'closed':      { bg: '#F1F5F9', color: '#475569', label: 'Closed' },
}

const COUNTRIES = ['Myanmar', 'Thailand', 'Singapore', 'Malaysia', 'Vietnam', 'Indonesia', 'Philippines', 'Cambodia']

function TierBadge({ tier }: { tier: MemberTier }) {
  const s = TIER_STYLE[tier]
  return (
    <div className="inline-flex items-center gap-1 rounded px-1.5 font-semibold"
      style={{ fontSize: 11, height: 20, background: s.bg, color: s.color }}>
      <Star size={9} fill={s.color} /> {tier}
    </div>
  )
}

function StatusPill({ status }: { status: UserStatus }) {
  const s = STATUS_STYLE[status]
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
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>End User Management</div>
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

// ── Synthetic Data ─────────────────────────────────────────────────────────────

interface EndUser {
  id: string; name: string; email: string; phone: string
  country: string; totalBookings: number; totalSpending: number
  tier: MemberTier; registeredAt: string; status: UserStatus
  avatar: string; lastLogin: string; referralCode: string
  points: number
}

const AVATARS = ['WL', 'AT', 'KM', 'SC', 'TH', 'NP', 'YW', 'ZL', 'MM', 'RB', 'JC', 'EY']
const AVATAR_COLORS = ['#1664FF', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0EA5E9', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#EF4444']

const USERS: EndUser[] = [
  { id: 'USR-001', name: 'Wei Lin', email: 'wei.lin@example.com', phone: '+95 9 7712 3456', country: 'Myanmar', totalBookings: 28, totalSpending: 4_820_000, tier: 'Platinum', registeredAt: '2022-03-14', status: 'active', avatar: 'WL', lastLogin: '2024-12-13 09:14', referralCode: 'WEILIN', points: 4820 },
  { id: 'USR-042', name: 'Zar Ni', email: 'zarni.aung@example.com', phone: '+95 9 8812 3399', country: 'Myanmar', totalBookings: 14, totalSpending: 2_150_000, tier: 'Gold', registeredAt: '2023-05-20', status: 'active', avatar: 'ZN', lastLogin: '2024-12-10 14:30', referralCode: 'ZARNI42', points: 2150 },
  { id: 'USR-002', name: 'Aung Thu', email: 'aung.thu@email.com', phone: '+95 9 4421 8870', country: 'Myanmar', totalBookings: 15, totalSpending: 2_140_000, tier: 'Gold', registeredAt: '2022-08-22', status: 'active', avatar: 'AT', lastLogin: '2024-12-12 18:30', referralCode: 'AUNGTHU', points: 2140 },
  { id: 'USR-003', name: 'Khin May', email: 'khin.may@gmail.com', phone: '+95 9 3301 0045', country: 'Myanmar', totalBookings: 8, totalSpending: 980_000, tier: 'Silver', registeredAt: '2023-01-09', status: 'active', avatar: 'KM', lastLogin: '2024-12-11 14:22', referralCode: 'KHINMAY', points: 980 },
  { id: 'USR-004', name: 'Su Cho', email: 'su.cho@outlook.com', phone: '+66 81 234 5678', country: 'Thailand', totalBookings: 21, totalSpending: 3_350_000, tier: 'Gold', registeredAt: '2022-11-30', status: 'active', avatar: 'SC', lastLogin: '2024-12-13 07:05', referralCode: 'SUCHO21', points: 3350 },
  { id: 'USR-005', name: 'Thant Hla', email: 'thant.hla@yahoo.com', phone: '+95 9 8810 2233', country: 'Myanmar', totalBookings: 4, totalSpending: 420_000, tier: 'Bronze', registeredAt: '2023-06-17', status: 'suspended', avatar: 'TH', lastLogin: '2024-11-28 20:44', referralCode: 'THANT05', points: 420 },
  { id: 'USR-006', name: 'Nyan Phyo', email: 'nyan.phyo@email.com', phone: '+95 9 5530 9981', country: 'Myanmar', totalBookings: 12, totalSpending: 1_660_000, tier: 'Silver', registeredAt: '2023-02-05', status: 'active', avatar: 'NP', lastLogin: '2024-12-10 11:18', referralCode: 'NYANP06', points: 1660 },
  { id: 'USR-007', name: 'Yin Win', email: 'yin.win@hotmail.com', phone: '+65 9123 4567', country: 'Singapore', totalBookings: 33, totalSpending: 5_780_000, tier: 'Platinum', registeredAt: '2021-09-03', status: 'active', avatar: 'YW', lastLogin: '2024-12-13 10:01', referralCode: 'YINWIN7', points: 5780 },
  { id: 'USR-008', name: 'Zaw Linn', email: 'zaw.linn@email.com', phone: '+95 9 9920 1122', country: 'Myanmar', totalBookings: 2, totalSpending: 180_000, tier: 'Bronze', registeredAt: '2024-01-20', status: 'inactive', avatar: 'ZL', lastLogin: '2024-09-15 08:30', referralCode: 'ZAWL008', points: 180 },
  { id: 'USR-009', name: 'Myat Min', email: 'myat.min@gmail.com', phone: '+60 11-2345 6789', country: 'Malaysia', totalBookings: 7, totalSpending: 870_000, tier: 'Bronze', registeredAt: '2023-09-11', status: 'suspended', avatar: 'MM', lastLogin: '2024-12-01 16:55', referralCode: 'MYATM09', points: 870 },
  { id: 'USR-010', name: 'Rina Bakar', email: 'rina.bakar@email.com', phone: '+62 812-3456-7890', country: 'Indonesia', totalBookings: 18, totalSpending: 2_490_000, tier: 'Gold', registeredAt: '2022-05-28', status: 'active', avatar: 'RB', lastLogin: '2024-12-12 21:10', referralCode: 'RINA010', points: 2490 },
  { id: 'USR-011', name: 'James Cho', email: 'james.cho@corp.com', phone: '+63 917 123 4567', country: 'Philippines', totalBookings: 1, totalSpending: 95_000, tier: 'Bronze', registeredAt: '2024-03-08', status: 'blacklisted', avatar: 'JC', lastLogin: '2024-06-20 12:00', referralCode: 'JCHO011', points: 0 },
  { id: 'USR-012', name: 'Ei Yee', email: 'ei.yee@email.com', phone: '+95 9 7700 5544', country: 'Myanmar', totalBookings: 9, totalSpending: 1_120_000, tier: 'Silver', registeredAt: '2023-04-15', status: 'active', avatar: 'EY', lastLogin: '2024-12-09 13:45', referralCode: 'EIYEE12', points: 1120 },
]

// ── Create User Drawer ────────────────────────────────────────────────────────

const BLANK_USER_FORM = {
  firstName: '', lastName: '', email: '', phone: '',
  country: COUNTRIES[0], status: 'active' as UserStatus, tier: 'Bronze' as MemberTier,
  sendWelcome: true,
}

type UserFormState = typeof BLANK_USER_FORM

interface CreateUserDrawerProps {
  open: boolean
  onClose: () => void
  onSave: (form: UserFormState) => void
}

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md px-3 outline-none"
      style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', color: '#1A2332', background: '#fff' }}
      onFocus={e => (e.currentTarget.style.borderColor = '#1664FF')}
      onBlur={e => (e.currentTarget.style.borderColor = '#E3E8F0')}
    />
  )
}

function SelectInput({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded-md px-3 outline-none"
      style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', color: '#1A2332', background: '#fff' }}
      onFocus={e => (e.currentTarget.style.borderColor = '#1664FF')}
      onBlur={e => (e.currentTarget.style.borderColor = '#E3E8F0')}
    >
      {children}
    </select>
  )
}

function CreateUserDrawer({ open, onClose, onSave }: CreateUserDrawerProps) {
  const [form, setForm] = useState<UserFormState>({ ...BLANK_USER_FORM })
  const [errors, setErrors] = useState<Partial<Record<keyof UserFormState, string>>>({})

  function set<K extends keyof UserFormState>(key: K, val: UserFormState[K]) {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const errs: typeof errors = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required'
    if (!form.email.trim())     errs.email     = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address'
    if (!form.phone.trim())     errs.phone     = 'Phone number is required'
    return errs
  }

  function handleSubmit() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave(form)
    setForm({ ...BLANK_USER_FORM })
    setErrors({})
  }

  function handleClose() {
    onClose()
    setForm({ ...BLANK_USER_FORM })
    setErrors({})
  }

  const TIER_DESCRIPTIONS: Record<MemberTier, string> = {
    Bronze:   'Default tier for new users — 1× bonus points',
    Silver:   'Mid-tier — 1.5× bonus points',
    Gold:     '2× bonus points + priority support',
    Platinum: '3× bonus points + all benefits',
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Create User"
      subtitle="Add a new end user account to the platform"
      width={540}
      footer={
        <>
          <button
            onClick={handleClose}
            className="rounded-md px-4 font-medium"
            style={{ height: 36, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
            style={{ height: 36, fontSize: 13, background: '#1664FF' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#0E4FCC')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1664FF')}
          >
            <Plus size={13} /> Create User
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Section: Personal Information */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Personal Information
          </div>
          <div className="space-y-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <FormRow label="First Name" required>
                <TextInput value={form.firstName} onChange={v => set('firstName', v)} placeholder="e.g. Wei" />
                {errors.firstName && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.firstName}</div>}
              </FormRow>
              <FormRow label="Last Name" required>
                <TextInput value={form.lastName} onChange={v => set('lastName', v)} placeholder="e.g. Lin" />
                {errors.lastName && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.lastName}</div>}
              </FormRow>
            </div>
            <FormRow label="Country">
              <SelectInput value={form.country} onChange={v => set('country', v)}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
            </FormRow>
          </div>
        </div>

        <div style={{ height: 1, background: '#F1F5F9' }} />

        {/* Section: Contact Information */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Contact Information
          </div>
          <div className="space-y-3">
            <FormRow label="Email Address" required>
              <div className="relative">
                <Mail size={13} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="email" value={form.email} onChange={e => { set('email', e.target.value) }}
                  placeholder="user@example.com"
                  className="w-full rounded-md outline-none"
                  style={{ height: 36, fontSize: 13, border: `1px solid ${errors.email ? '#DC2626' : '#E3E8F0'}`, color: '#1A2332', background: '#fff', paddingLeft: 30, paddingRight: 12 }}
                  onFocus={e => (e.currentTarget.style.borderColor = errors.email ? '#DC2626' : '#1664FF')}
                  onBlur={e => (e.currentTarget.style.borderColor = errors.email ? '#DC2626' : '#E3E8F0')}
                />
              </div>
              {errors.email && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.email}</div>}
            </FormRow>
            <FormRow label="Phone Number" required>
              <div className="relative">
                <Phone size={13} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+95 9 7712 3456"
                  className="w-full rounded-md outline-none"
                  style={{ height: 36, fontSize: 13, border: `1px solid ${errors.phone ? '#DC2626' : '#E3E8F0'}`, color: '#1A2332', background: '#fff', paddingLeft: 30, paddingRight: 12 }}
                  onFocus={e => (e.currentTarget.style.borderColor = errors.phone ? '#DC2626' : '#1664FF')}
                  onBlur={e => (e.currentTarget.style.borderColor = errors.phone ? '#DC2626' : '#E3E8F0')}
                />
              </div>
              {errors.phone && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.phone}</div>}
            </FormRow>
          </div>
        </div>

        <div style={{ height: 1, background: '#F1F5F9' }} />

        {/* Section: Account Settings */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Account Settings
          </div>
          <div className="space-y-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <FormRow label="Account Status">
                <SelectInput value={form.status} onChange={v => set('status', v as UserStatus)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </SelectInput>
              </FormRow>
              <FormRow label="Membership Tier">
                <SelectInput value={form.tier} onChange={v => set('tier', v as MemberTier)}>
                  <option value="Bronze">Bronze</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </SelectInput>
              </FormRow>
            </div>
            {/* Tier info */}
            <div className="rounded-md px-3 py-2.5 flex items-start gap-2"
              style={{ background: TIER_STYLE[form.tier].bg, border: `1px solid ${TIER_STYLE[form.tier].color}22` }}>
              <Star size={12} fill={TIER_STYLE[form.tier].color} color={TIER_STYLE[form.tier].color} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: TIER_STYLE[form.tier].color }}>{TIER_DESCRIPTIONS[form.tier]}</span>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: '#F1F5F9' }} />

        {/* Section: Notifications */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Notifications
          </div>
          <label className="flex items-start gap-3 cursor-pointer" onClick={() => set('sendWelcome', !form.sendWelcome)}>
            <div
              style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                background: form.sendWelcome ? '#1664FF' : '#fff',
                border: `2px solid ${form.sendWelcome ? '#1664FF' : '#CBD5E1'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {form.sendWelcome && <CheckCircle size={10} color="#fff" />}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>Send welcome email</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>
                Sends account credentials and a getting-started guide to the user's email address.
              </div>
            </div>
          </label>
        </div>
      </div>
    </Drawer>
  )
}

// ── 1. User Directory ─────────────────────────────────────────────────────────

function UserDirectoryPage({ showToast, onViewProfile }: { showToast: Props['showToast']; onViewProfile?: (u: EndUser) => void }) {
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [users, setUsers] = useState<EndUser[]>(USERS)
  const perPage = 8

  const filtered = users.filter(u => {
    if (filterCountry && u.country !== filterCountry) return false
    if (filterStatus && u.status !== filterStatus) return false
    if (filterTier && u.tier !== filterTier) return false
    if (search) {
      const q = search.toLowerCase()
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q) || u.id.toLowerCase().includes(q)
    }
    return true
  })

  const total = filtered.length
  const rows = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  function handleCreateUser(form: UserFormState) {
    const newUser: EndUser = {
      id: `USR-${String(users.length + 1).padStart(3, '0')}`,
      name: `${form.firstName} ${form.lastName}`,
      email: form.email,
      phone: form.phone,
      country: form.country,
      totalBookings: 0,
      totalSpending: 0,
      tier: form.tier,
      registeredAt: new Date().toISOString().split('T')[0],
      status: form.status,
      avatar: (form.firstName[0] + form.lastName[0]).toUpperCase(),
      lastLogin: '—',
      referralCode: (form.firstName.slice(0, 4) + form.lastName.slice(0, 3)).toUpperCase(),
      points: 0,
    }
    setUsers(prev => [newUser, ...prev])
    setCreateOpen(false)
    showToast('success', 'User Created', `${newUser.name}'s account has been created successfully.`)
  }

  const kpis = [
    { label: 'Total Users',         value: users.length,                                           color: '#1664FF' },
    { label: 'Active Users',        value: users.filter(u => u.status === 'active').length,        color: '#059669', sub: 'Currently active accounts' },
    { label: 'New Registrations',   value: users.filter(u => u.registeredAt >= '2024-01-01').length, color: '#D97706', sub: 'Joined in 2024' },
    { label: 'Suspended',           value: users.filter(u => u.status === 'suspended').length,     color: '#DC2626', sub: 'Accounts under suspension' },
  ]

  return (
    <PageShell title="User Directory" subtitle="Browse and manage all registered end users across the platform" kpis={kpis}
      actions={<>
        <button onClick={() => showToast('info', 'Export', 'User list exported.')}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export
        </button>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
          style={{ height: 34, fontSize: 13, background: '#1664FF' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0E4FCC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1664FF')}>
          <Plus size={13} /> Add User
        </button>
      </>}>

      {/* Search bar */}
      <div className="rounded-lg mb-2" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name, email, phone, or user ID…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 rounded-md px-2.5"
            style={{ height: 28, fontSize: 12, color: showFilters ? '#1664FF' : '#64748B', border: `1px solid ${showFilters ? '#BFDBFE' : '#E3E8F0'}`, background: showFilters ? '#EFF6FF' : 'transparent' }}>
            <Filter size={11} /> Filters {showFilters ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} users</span>
        </div>
        {showFilters && (
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <div className="flex items-center gap-2">
              <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Country</label>
              <select value={filterCountry} onChange={e => { setFilterCountry(e.target.value); setPage(1) }}
                className="rounded-md px-2 outline-none bg-white" style={{ height: 30, fontSize: 12, border: '1px solid #E3E8F0', color: '#1A2332' }}>
                <option value="">All</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Status</label>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                className="rounded-md px-2 outline-none bg-white" style={{ height: 30, fontSize: 12, border: '1px solid #E3E8F0', color: '#1A2332' }}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="blacklisted">Blacklisted</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Tier</label>
              <select value={filterTier} onChange={e => { setFilterTier(e.target.value); setPage(1) }}
                className="rounded-md px-2 outline-none bg-white" style={{ height: 30, fontSize: 12, border: '1px solid #E3E8F0', color: '#1A2332' }}>
                <option value="">All</option>
                <option value="Bronze">Bronze</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
              </select>
            </div>
            {(filterCountry || filterStatus || filterTier) && (
              <button onClick={() => { setFilterCountry(''); setFilterStatus(''); setFilterTier('') }}
                style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['User', 'Email', 'Phone', 'Country', 'Bookings', 'Total Spending', 'Tier', 'Registered', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-3" style={{ height: 54 }}>
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
                      style={{ width: 32, height: 32, background: AVATAR_COLORS[AVATARS.indexOf(u.avatar) % AVATAR_COLORS.length], fontSize: 11 }}>
                      {u.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{u.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569' }}>{u.email}</td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{u.phone}</td>
                <td className="px-3">
                  <div className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                    <Globe size={11} color="#94A3B8" /> {u.country}
                  </div>
                </td>
                <td className="px-3" style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace' }}>{u.totalBookings}</td>
                <td className="px-3" style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace' }}>
                  {u.totalSpending.toLocaleString()} <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>MMK</span>
                </td>
                <td className="px-3"><TierBadge tier={u.tier} /></td>
                <td className="px-3" style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{u.registeredAt}</td>
                <td className="px-3"><StatusPill status={u.status} /></td>
                <td className="px-3">
                  <div className="flex items-center gap-0.5">
                    <ActionBtn color="#1664FF" onClick={() => onViewProfile?.(u)} title="View Profile"><Eye size={12} /></ActionBtn>
                    <ActionBtn color="#059669" onClick={() => showToast('success', 'Email Sent', `Reset link sent to ${u.email}`)} title="Reset Password"><KeyRound size={12} /></ActionBtn>
                    <ActionBtn color="#DC2626" onClick={() => showToast('warning', 'User Suspended', `${u.name} has been suspended.`)} title="Suspend"><UserX size={12} /></ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, fontSize: 13, color: '#94A3B8' }}>No users match your filters.</td></tr>
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

      <CreateUserDrawer open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreateUser} />
    </PageShell>
  )
}

// ── 2. User Profile ───────────────────────────────────────────────────────────

const DEVICES = [
  { id: 1, type: 'mobile', name: 'iPhone 14 Pro', os: 'iOS 17.1', location: 'Yangon, Myanmar', lastSeen: '2024-12-13 09:14', current: true },
  { id: 2, type: 'desktop', name: 'Chrome / macOS', os: 'macOS 14.1', location: 'Yangon, Myanmar', lastSeen: '2024-12-10 18:30', current: false },
]

const LOGIN_HISTORY = [
  { date: '2024-12-13 09:14', device: 'iPhone 14 Pro', location: 'Yangon, Myanmar', ip: '203.81.x.x', status: 'success' },
  { date: '2024-12-12 18:30', device: 'Chrome / macOS', location: 'Yangon, Myanmar', ip: '203.81.x.x', status: 'success' },
  { date: '2024-12-10 07:12', device: 'iPhone 14 Pro', location: 'Mandalay, Myanmar', ip: '202.69.x.x', status: 'success' },
  { date: '2024-12-05 14:44', device: 'Unknown Device', location: 'Bangkok, Thailand', ip: '118.175.x.x', status: 'failed' },
  { date: '2024-12-01 09:00', device: 'iPhone 14 Pro', location: 'Yangon, Myanmar', ip: '203.81.x.x', status: 'success' },
]

function UserProfilePage({ showToast, user }: { showToast: Props['showToast']; user: EndUser }) {
  const u = user
  const avIdx = AVATARS.indexOf(u.avatar)
  const avColor = AVATAR_COLORS[avIdx % AVATAR_COLORS.length]

  return (
    <PageShell title="User Profile" subtitle={`Detailed profile and account information for ${u.name}`}
      actions={<>
        <button onClick={() => showToast('info', 'Force Logout', `${u.name} has been logged out from all devices.`)}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
          <LogOut size={13} /> Force Logout
        </button>
        <button onClick={() => showToast('success', 'Password Reset', `Reset link sent to ${u.email}.`)}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
          <KeyRound size={13} /> Reset Password
        </button>
        {u.status === 'active'
          ? <button onClick={() => showToast('warning', 'Account Suspended', `${u.name} has been suspended.`)}
              className="flex items-center gap-1.5 rounded-md px-3 font-medium"
              style={{ height: 34, fontSize: 13, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
              <UserX size={13} /> Suspend
            </button>
          : <button onClick={() => showToast('success', 'Account Activated', `${u.name} is now active.`)}
              className="flex items-center gap-1.5 rounded-md px-3 font-medium"
              style={{ height: 34, fontSize: 13, color: '#059669', border: '1px solid #A7F3D0', background: '#ECFDF3' }}>
              <UserCheck size={13} /> Activate
            </button>
        }
      </>}>
      <div className="grid gap-4" style={{ gridTemplateColumns: '300px 1fr' }}>
        {/* Left: Identity card */}
        <div className="space-y-3">
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="flex flex-col items-center text-center py-2">
              <div className="rounded-full flex items-center justify-center text-white font-bold mb-3"
                style={{ width: 72, height: 72, background: avColor, fontSize: 22 }}>{u.avatar}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1A2332' }}>{u.name}</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, fontFamily: 'monospace' }}>{u.id}</div>
              <div className="mt-2"><TierBadge tier={u.tier} /></div>
              <div className="mt-2"><StatusPill status={u.status} /></div>
            </div>
            <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 12, paddingTop: 12 }} className="space-y-2">
              {[
                { icon: <Mail size={12} />, label: u.email },
                { icon: <Phone size={12} />, label: u.phone },
                { icon: <Globe size={12} />, label: u.country },
                { icon: <Clock size={12} />, label: `Last login: ${u.lastLogin}` },
                { icon: <Calendar size={12} />, label: `Joined: ${u.registeredAt}` },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-2" style={{ fontSize: 12, color: '#475569' }}>
                  <span style={{ color: '#94A3B8', flexShrink: 0 }}>{row.icon}</span>
                  <span className="truncate">{row.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Reward summary */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A2332', marginBottom: 10 }}>Rewards Summary</div>
            {[
              { label: 'Reward Points', value: u.points.toLocaleString() + ' pts', color: '#7C3AED' },
              { label: 'Total Bookings', value: u.totalBookings, color: '#1664FF' },
              { label: 'Total Spending', value: u.totalSpending.toLocaleString() + ' MMK', color: '#059669' },
              { label: 'Referral Code', value: u.referralCode, color: '#D97706' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: row.color, fontFamily: 'monospace' }}>{String(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Details panels */}
        <div className="space-y-4">
          {/* Personal + Contact */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A2332', marginBottom: 10 }}>Personal Information</div>
              {[
                { label: 'Full Name', value: u.name },
                { label: 'Display Name', value: u.name.split(' ')[0] },
                { label: 'Country', value: u.country },
                { label: 'Language', value: 'Myanmar (Burmese)' },
                { label: 'Timezone', value: 'Asia/Rangoon (UTC+6:30)' },
              ].map(row => (
                <div key={row.label} className="flex flex-col py-1.5" style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: '#1A2332', marginTop: 1 }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A2332', marginBottom: 10 }}>Contact Information</div>
              {[
                { label: 'Email Address', value: u.email },
                { label: 'Phone Number', value: u.phone },
                { label: 'Email Verified', value: '✓ Verified' },
                { label: 'Phone Verified', value: '✓ Verified' },
                { label: 'Notification Pref', value: 'Email + Push' },
              ].map(row => (
                <div key={row.label} className="flex flex-col py-1.5" style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: '#1A2332', marginTop: 1 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Login Devices */}
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>Login Devices</div>
            </div>
            {DEVICES.map(d => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ width: 36, height: 36, background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
                    {d.type === 'mobile' ? <Smartphone size={16} color="#64748B" /> : <Monitor size={16} color="#64748B" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{d.name}</span>
                      {d.current && <span style={{ fontSize: 10, background: '#ECFDF3', color: '#027A48', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Current</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{d.os} · {d.location} · {d.lastSeen}</div>
                  </div>
                </div>
                <button onClick={() => showToast('warning', 'Device Removed', `${d.name} has been signed out.`)}
                  style={{ fontSize: 11, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  Sign out
                </button>
              </div>
            ))}
          </div>

          {/* Login History */}
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>Login History</div>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                  {['Date & Time', 'Device', 'Location', 'IP Address', 'Result'].map(h => (
                    <th key={h} className="text-left px-4" style={{ height: 32, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LOGIN_HISTORY.map((l, i) => (
                  <tr key={i} style={{ borderBottom: i < LOGIN_HISTORY.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                    <td className="px-4" style={{ height: 40, fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{l.date}</td>
                    <td className="px-4" style={{ fontSize: 12, color: '#475569' }}>{l.device}</td>
                    <td className="px-4" style={{ fontSize: 12, color: '#475569' }}>{l.location}</td>
                    <td className="px-4" style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' }}>{l.ip}</td>
                    <td className="px-4">
                      {l.status === 'success'
                        ? <span style={{ fontSize: 11, color: '#027A48', background: '#ECFDF3', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Success</span>
                        : <span style={{ fontSize: 11, color: '#C01048', background: '#FFF1F3', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Failed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

// ── 3. Booking History ────────────────────────────────────────────────────────

interface UserBooking {
  id: string; hotel: string; checkIn: string; checkOut: string
  amount: number; status: BookingStatus; refund: RefundStatus; nights: number
}

const USER_BOOKINGS: UserBooking[] = [
  { id: 'BKG-8821', hotel: 'Sedona Hotel Yangon', checkIn: '2024-12-05', checkOut: '2024-12-08', amount: 480_000, status: 'completed', refund: 'none', nights: 3 },
  { id: 'BKG-8640', hotel: 'Novotel Inle Lake Resort', checkIn: '2024-11-15', checkOut: '2024-11-17', amount: 320_000, status: 'completed', refund: 'none', nights: 2 },
  { id: 'BKG-8310', hotel: 'The Strand Rangoon', checkIn: '2024-10-22', checkOut: '2024-10-25', amount: 680_000, status: 'cancelled', refund: 'processed', nights: 3 },
  { id: 'BKG-7990', hotel: 'Chatrium Hotel Mandalay', checkIn: '2024-09-10', checkOut: '2024-09-12', amount: 240_000, status: 'completed', refund: 'none', nights: 2 },
  { id: 'BKG-7654', hotel: 'Aureum Palace Hotel', checkIn: '2024-08-01', checkOut: '2024-08-04', amount: 520_000, status: 'completed', refund: 'none', nights: 3 },
  { id: 'BKG-7210', hotel: 'Governor Residence Hotel', checkIn: '2024-07-18', checkOut: '2024-07-20', amount: 290_000, status: 'cancelled', refund: 'requested', nights: 2 },
  { id: 'BKG-6998', hotel: 'Tharabar Gate Hotel Bagan', checkIn: '2024-06-05', checkOut: '2024-06-07', amount: 360_000, status: 'completed', refund: 'none', nights: 2 },
  { id: 'BKG-9001', hotel: 'Pullman Yangon Centrepoint', checkIn: '2025-01-15', checkOut: '2025-01-18', amount: 540_000, status: 'confirmed', refund: 'none', nights: 3 },
]

function BookingHistoryPage({ showToast, user: _user }: { showToast: Props['showToast']; user: EndUser }) {
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = USER_BOOKINGS.filter(b => !filterStatus || b.status === filterStatus)
  const totalSpend = filtered.reduce((s, b) => s + b.amount, 0)

  const kpis = [
    { label: 'Total Bookings',    value: USER_BOOKINGS.length,                                              color: '#1664FF' },
    { label: 'Completed',         value: USER_BOOKINGS.filter(b => b.status === 'completed').length,        color: '#059669' },
    { label: 'Cancelled',         value: USER_BOOKINGS.filter(b => b.status === 'cancelled').length,        color: '#DC2626' },
    { label: 'Total Spent (MMK)', value: USER_BOOKINGS.reduce((s, b) => s + b.amount, 0).toLocaleString(), color: '#7C3AED' },
  ]

  return (
    <PageShell title="Booking History" subtitle="Complete booking record for the selected user" kpis={kpis}
      actions={<>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-md px-3 outline-none" style={{ height: 34, fontSize: 13, border: '1px solid #E3E8F0', background: '#fff', color: '#475569' }}>
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="pending">Pending</option>
        </select>
        <button onClick={() => showToast('info', 'Export', 'Booking history exported.')}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
          <Download size={13} /> Export
        </button>
      </>}>
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Booking ID', 'Hotel', 'Check-in', 'Check-out', 'Nights', 'Payment (MMK)', 'Booking Status', 'Refund Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => {
              const bs = BOOKING_STATUS_STYLE[b.status]
              const rs = REFUND_STYLE[b.refund]
              return (
                <tr key={b.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-3" style={{ height: 50, fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 600 }}>{b.id}</td>
                  <td className="px-3" style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.hotel}</div>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{b.checkIn}</td>
                  <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{b.checkOut}</td>
                  <td className="px-3" style={{ fontSize: 12, color: '#64748B', textAlign: 'center' }}>{b.nights}</td>
                  <td className="px-3" style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{b.amount.toLocaleString()}</td>
                  <td className="px-3">
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, background: bs.bg, color: bs.color }}>{bs.label}</span>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: rs.color, fontWeight: 500 }}>{rs.label}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-0.5">
                      <ActionBtn color="#1664FF" onClick={() => showToast('info', 'Booking Detail', b.id)} title="View"><Eye size={12} /></ActionBtn>
                      {b.refund === 'requested' && (
                        <ActionBtn color="#059669" onClick={() => showToast('success', 'Refund Approved', b.id)} title="Approve Refund"><RotateCcw size={12} /></ActionBtn>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{filtered.length} bookings · Total: {totalSpend.toLocaleString()} MMK shown</span>
        </div>
      </div>
    </PageShell>
  )
}

// ── 4. User Activities ────────────────────────────────────────────────────────

type UActType =
  | 'login' | 'logout' | 'registration' | 'phone_verification' | 'email_verification'
  | 'hotel_search' | 'hotel_view'
  | 'booking_created' | 'booking_modified' | 'booking_cancelled' | 'booking_completed'
  | 'payment' | 'payment_failed' | 'refund_requested' | 'refund_processed'
  | 'coupon_applied' | 'voucher_redeemed'
  | 'reward_earned' | 'reward_redeemed' | 'referral' | 'referral_reward_received'
  | 'review_submitted'
  | 'support_opened' | 'support_resolved'
  | 'profile_updated' | 'password_changed' | 'device_changed'

type UActCat = 'all' | 'auth' | 'browse' | 'booking' | 'payment' | 'rewards' | 'promotions' | 'reviews' | 'support' | 'account'

interface UActEvent {
  id: string; type: UActType; title: string; timestamp: string
  device?: string; platform?: string; location?: string
  bookingId?: string; merchantName?: string; amount?: number
  details: { label: string; value: string }[]
}

const UACT: Record<UActType, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; cat: UActCat }> = {
  login:             { label: 'Login',             icon: <LogIn size={13} />,          color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE', cat: 'auth' },
  logout:            { label: 'Logout',            icon: <LogOut size={13} />,         color: '#64748B', bg: '#F8FAFC', border: '#E3E8F0', cat: 'auth' },
  hotel_search:      { label: 'Hotel Search',      icon: <Search size={13} />,         color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', cat: 'browse' },
  hotel_view:        { label: 'Hotel View',        icon: <Eye size={13} />,            color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', cat: 'browse' },
  booking_created:   { label: 'Booking Created',   icon: <CalendarCheck size={13} />,  color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', cat: 'booking' },
  booking_modified:  { label: 'Booking Modified',  icon: <Calendar size={13} />,       color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', cat: 'booking' },
  booking_cancelled: { label: 'Booking Cancelled', icon: <XCircle size={13} />,        color: '#DC2626', bg: '#FFF1F3', border: '#FECDD3', cat: 'booking' },
  booking_completed: { label: 'Stay Completed',    icon: <CheckCircle size={13} />,    color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', cat: 'booking' },
  payment:           { label: 'Payment',           icon: <CreditCard size={13} />,     color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE', cat: 'payment' },
  payment_failed:    { label: 'Payment Failed',    icon: <AlertTriangle size={13} />,  color: '#DC2626', bg: '#FFF1F3', border: '#FECDD3', cat: 'payment' },
  refund_requested:  { label: 'Refund Requested',  icon: <RotateCcw size={13} />,      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', cat: 'payment' },
  refund_processed:  { label: 'Refund Processed',  icon: <CheckCircle size={13} />,    color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', cat: 'payment' },
  coupon_applied:         { label: 'Coupon Applied',         icon: <Tag size={13} />,            color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8', cat: 'promotions' },
  voucher_redeemed:       { label: 'Voucher Redeemed',       icon: <Ticket size={13} />,         color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', cat: 'promotions' },
  reward_earned:          { label: 'Reward Earned',          icon: <Gift size={13} />,           color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', cat: 'rewards' },
  reward_redeemed:        { label: 'Reward Redeemed',        icon: <Ticket size={13} />,         color: '#6D28D9', bg: '#EDE9FE', border: '#DDD6FE', cat: 'rewards' },
  referral:               { label: 'Referral Sent',          icon: <TrendingUp size={13} />,     color: '#14B8A6', bg: '#F0FDFA', border: '#99F6E4', cat: 'rewards' },
  referral_reward_received:{ label: 'Referral Reward',       icon: <Gift size={13} />,           color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', cat: 'rewards' },
  review_submitted:       { label: 'Review Submitted',       icon: <Star size={13} />,           color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', cat: 'reviews' },
  support_opened:         { label: 'Support Ticket',         icon: <MessageCircle size={13} />,  color: '#C2410C', bg: '#FFF7ED', border: '#FDBA74', cat: 'support' },
  support_resolved:       { label: 'Ticket Resolved',        icon: <CheckCircle size={13} />,    color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', cat: 'support' },
  profile_updated:        { label: 'Profile Updated',        icon: <UserCheck size={13} />,      color: '#475569', bg: '#F8FAFC', border: '#E3E8F0', cat: 'account' },
  password_changed:       { label: 'Password Changed',       icon: <KeyRound size={13} />,       color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE', cat: 'account' },
  device_changed:         { label: 'Device Changed',         icon: <Smartphone size={13} />,     color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', cat: 'account' },
  registration:           { label: 'Registered',             icon: <UserCheck size={13} />,      color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', cat: 'auth' },
  phone_verification:     { label: 'Phone Verified',         icon: <Phone size={13} />,          color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE', cat: 'auth' },
  email_verification:     { label: 'Email Verified',         icon: <Mail size={13} />,           color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE', cat: 'auth' },
}

const UA_CATS: { id: UActCat; label: string }[] = [
  { id: 'all',        label: 'All Activities' },
  { id: 'auth',       label: 'Authentication' },
  { id: 'browse',     label: 'Search & Browse' },
  { id: 'booking',    label: 'Booking' },
  { id: 'payment',    label: 'Payment' },
  { id: 'rewards',    label: 'Rewards' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'reviews',    label: 'Reviews' },
  { id: 'support',    label: 'Support' },
  { id: 'account',    label: 'Account Settings' },
]

const SAMPLE_ACTIVITIES: UActEvent[] = [
  { id: 'UA001', type: 'login',            title: 'Logged in from iPhone 14 Pro',                    timestamp: '2024-12-13 09:14', device: 'iPhone 14 Pro', platform: 'iOS 17.2', location: 'Yangon, Myanmar',     details: [{ label: 'Device', value: 'iPhone 14 Pro' }, { label: 'OS', value: 'iOS 17.2' }, { label: 'App Version', value: 'mTrip 3.4.1' }, { label: 'IP Address', value: '202.91.xx.xx' }, { label: 'Location', value: 'Yangon, Myanmar' }, { label: 'Session Duration', value: '32 minutes' }] },
  { id: 'UA002', type: 'hotel_search',     title: 'Searched hotels in Yangon for Dec 20–22',         timestamp: '2024-12-13 09:18', device: 'iPhone 14 Pro', platform: 'iOS',                                        details: [{ label: 'Destination', value: 'Yangon, Myanmar' }, { label: 'Check-in', value: 'December 20, 2024' }, { label: 'Check-out', value: 'December 22, 2024' }, { label: 'Guests', value: '2 adults' }, { label: 'Filters Applied', value: '5-star · Pool · Breakfast' }, { label: 'Results Shown', value: '14 hotels' }] },
  { id: 'UA003', type: 'hotel_view',       title: 'Viewed Chatrium Riverside Hotel Yangon',           timestamp: '2024-12-13 09:22', device: 'iPhone 14 Pro', merchantName: 'Chatrium Riverside Hotel',               details: [{ label: 'Hotel', value: 'Chatrium Riverside Hotel Yangon' }, { label: 'Listed Price', value: 'MMK 320,000 / night' }, { label: 'Time on Page', value: '3 min 14 sec' }, { label: 'Photos Viewed', value: '8 photos' }, { label: 'Reviews Read', value: '5 reviews' }, { label: 'Action', value: 'Added to Wishlist' }] },
  { id: 'UA004', type: 'hotel_view',       title: 'Viewed Novotel Yangon Max',                       timestamp: '2024-12-13 09:35', device: 'iPhone 14 Pro', merchantName: 'Novotel Yangon Max',                     details: [{ label: 'Hotel', value: 'Novotel Yangon Max' }, { label: 'Listed Price', value: 'MMK 285,000 / night' }, { label: 'Time on Page', value: '2 min 08 sec' }, { label: 'Photos Viewed', value: '5 photos' }, { label: 'Room Checked', value: 'Deluxe King Room' }, { label: 'Action', value: 'Viewed room types' }] },
  { id: 'UA005', type: 'login',            title: 'Logged in from Chrome on MacBook Pro',             timestamp: '2024-12-12 18:30', device: 'MacBook Pro', platform: 'Chrome / macOS', location: 'Yangon, Myanmar',  details: [{ label: 'Browser', value: 'Chrome 120' }, { label: 'OS', value: 'macOS Sonoma 14.1' }, { label: 'IP Address', value: '202.91.xx.xx' }, { label: 'Location', value: 'Yangon, Myanmar' }, { label: 'Login Method', value: 'Email & Password' }, { label: 'Session Duration', value: '1h 12 min' }] },
  { id: 'UA006', type: 'booking_completed',title: 'Completed stay at Sedona Hotel Yangon',            timestamp: '2024-12-08 12:00', bookingId: 'BKG-8821', merchantName: 'Sedona Hotel Yangon',                      details: [{ label: 'Booking ID', value: 'BKG-8821' }, { label: 'Hotel', value: 'Sedona Hotel Yangon' }, { label: 'Room Type', value: 'Deluxe Room' }, { label: 'Stay Duration', value: '2 nights (Dec 6 – Dec 8)' }, { label: 'Total Paid', value: 'MMK 480,000' }, { label: 'Check-out Status', value: 'Completed on time' }] },
  { id: 'UA007', type: 'reward_earned',    title: 'Earned 480 reward points from stay',               timestamp: '2024-12-08 12:05', bookingId: 'BKG-8821', amount: 480,                                            details: [{ label: 'Points Earned', value: '+480 pts' }, { label: 'Source', value: 'Booking Completion — BKG-8821' }, { label: 'Point Rate', value: '1 pt per MMK 1,000' }, { label: 'Total Balance After', value: '4,820 pts' }, { label: 'Tier Multiplier', value: 'Platinum 1.0×' }, { label: 'Expiry', value: 'December 8, 2025' }] },
  { id: 'UA008', type: 'booking_created',  title: 'Booked Sedona Hotel Yangon for Dec 6–8',           timestamp: '2024-12-05 11:30', bookingId: 'BKG-8821', merchantName: 'Sedona Hotel Yangon',   amount: 480_000, details: [{ label: 'Booking ID', value: 'BKG-8821' }, { label: 'Hotel', value: 'Sedona Hotel Yangon' }, { label: 'Room Type', value: 'Deluxe Room' }, { label: 'Check-in', value: 'December 6, 2024' }, { label: 'Check-out', value: 'December 8, 2024' }, { label: 'Guests', value: '2 adults' }, { label: 'Coupon Applied', value: 'WINTER20 (–20%)' }, { label: 'Total Amount', value: 'MMK 480,000' }] },
  { id: 'UA009', type: 'coupon_applied',   title: 'Applied coupon WINTER20 — 20% off',                timestamp: '2024-12-05 11:30', bookingId: 'BKG-8821', amount: 120_000,                                         details: [{ label: 'Coupon Code', value: 'WINTER20' }, { label: 'Discount Type', value: '20% off total' }, { label: 'Original Amount', value: 'MMK 600,000' }, { label: 'Discount Applied', value: '–MMK 120,000' }, { label: 'Final Amount', value: 'MMK 480,000' }, { label: 'Booking ID', value: 'BKG-8821' }] },
  { id: 'UA010', type: 'payment',          title: 'Paid MMK 480,000 via Wave Pay',                    timestamp: '2024-12-05 11:32', bookingId: 'BKG-8821', amount: 480_000,                                         details: [{ label: 'Transaction ID', value: 'TXN-WP-20241205-8821' }, { label: 'Payment Method', value: 'Wave Pay' }, { label: 'Amount', value: 'MMK 480,000' }, { label: 'Currency', value: 'MMK' }, { label: 'Gateway Response', value: 'APPROVED' }, { label: 'Processing Time', value: '2.1 seconds' }] },
  { id: 'UA011', type: 'booking_completed',title: 'Completed stay at Novotel Inle Lake Resort',       timestamp: '2024-11-28 11:00', bookingId: 'BKG-8640', merchantName: 'Novotel Inle Lake Resort', amount: 960_000, details: [{ label: 'Booking ID', value: 'BKG-8640' }, { label: 'Hotel', value: 'Novotel Inle Lake Resort' }, { label: 'Room Type', value: 'Lake View Suite' }, { label: 'Stay Duration', value: '3 nights (Nov 25 – Nov 28)' }, { label: 'Total Paid', value: 'MMK 960,000' }, { label: 'Check-out Status', value: 'Completed on time' }] },
  { id: 'UA012', type: 'reward_earned',    title: 'Earned 960 points — Inle Lake stay',               timestamp: '2024-11-28 11:05', bookingId: 'BKG-8640',                                                          details: [{ label: 'Points Earned', value: '+960 pts' }, { label: 'Source', value: 'Booking Completion — BKG-8640' }, { label: 'Bonus', value: '2× Inle Lake Destination Bonus' }, { label: 'Total Balance After', value: '4,340 pts' }, { label: 'Expiry', value: 'November 28, 2025' }, { label: 'Tier', value: 'Platinum' }] },
  { id: 'UA013', type: 'booking_created',  title: 'Booked Novotel Inle Lake Resort Nov 25–28',        timestamp: '2024-11-14 20:18', bookingId: 'BKG-8640', merchantName: 'Novotel Inle Lake Resort', amount: 960_000, details: [{ label: 'Booking ID', value: 'BKG-8640' }, { label: 'Hotel', value: 'Novotel Inle Lake Resort' }, { label: 'Room Type', value: 'Lake View Suite' }, { label: 'Check-in', value: 'November 25, 2024' }, { label: 'Check-out', value: 'November 28, 2024' }, { label: 'Guests', value: '2 adults' }, { label: 'Total Amount', value: 'MMK 960,000' }] },
  { id: 'UA014', type: 'payment',          title: 'Paid MMK 960,000 via KBZ Pay',                     timestamp: '2024-11-14 20:20', bookingId: 'BKG-8640', amount: 960_000,                                         details: [{ label: 'Transaction ID', value: 'TXN-KBZ-20241114-8640' }, { label: 'Payment Method', value: 'KBZ Pay' }, { label: 'Amount', value: 'MMK 960,000' }, { label: 'Gateway Response', value: 'APPROVED' }, { label: 'Processing Time', value: '1.8 seconds' }, { label: 'Receipt Sent', value: 'wei.lin@example.com' }] },
  { id: 'UA015', type: 'support_opened',   title: 'Opened support ticket — Wrong room type assigned', timestamp: '2024-10-20 08:45', bookingId: 'BKG-8380',                                                          details: [{ label: 'Ticket ID', value: 'TKT-20241020-004' }, { label: 'Category', value: 'Booking Issue' }, { label: 'Issue', value: 'Checked in but received Standard room instead of Deluxe' }, { label: 'Booking ID', value: 'BKG-8380' }, { label: 'Hotel', value: 'The Strand Hotel Yangon' }, { label: 'Status', value: 'Opened' }] },
  { id: 'UA016', type: 'support_resolved', title: 'Support ticket resolved — Room upgrade provided',  timestamp: '2024-10-20 14:30', bookingId: 'BKG-8380',                                                          details: [{ label: 'Ticket ID', value: 'TKT-20241020-004' }, { label: 'Resolution', value: 'Complimentary room upgrade arranged with hotel' }, { label: 'Resolved By', value: 'Support Agent — Li Min' }, { label: 'Resolution Time', value: '5 hours 45 min' }, { label: 'Customer Rating', value: '5/5 — Very Satisfied' }, { label: 'Follow-up Required', value: 'No' }] },
  { id: 'UA017', type: 'referral',         title: 'Khin May (USR-003) registered via referral link',  timestamp: '2024-09-10 10:30',                                                                                  details: [{ label: 'Referred User', value: 'Khin May (USR-003)' }, { label: 'Referral Code', value: 'WEILIN' }, { label: 'Reward Earned', value: '+500 pts' }, { label: 'Referred User Reward', value: '+200 pts welcome bonus' }, { label: 'Balance After', value: '3,380 pts' }, { label: 'Program', value: 'mTrip Friends Program' }] },
  { id: 'UA018', type: 'reward_earned',    title: 'Earned 500 referral reward points',                timestamp: '2024-09-10 10:31',                                                                                  details: [{ label: 'Points Earned', value: '+500 pts' }, { label: 'Source', value: 'Successful Referral — Khin May' }, { label: 'Total Balance After', value: '3,380 pts' }, { label: 'Program', value: 'Referral Bonus Program' }, { label: 'Expiry', value: 'September 10, 2025' }] },
  { id: 'UA019', type: 'reward_redeemed',  title: 'Redeemed 500 pts for MMK 5,000 discount',          timestamp: '2024-08-05 15:20', bookingId: 'BKG-8210', amount: 5_000,                                            details: [{ label: 'Points Redeemed', value: '500 pts' }, { label: 'Discount Value', value: 'MMK 5,000' }, { label: 'Rate', value: '100 pts = MMK 1,000' }, { label: 'Booking ID', value: 'BKG-8210' }, { label: 'Balance Before', value: '2,880 pts' }, { label: 'Balance After', value: '2,380 pts' }] },
  { id: 'UA020', type: 'booking_cancelled',title: "Cancelled booking at Governor's Residence Hotel",  timestamp: '2024-07-17 14:00', bookingId: 'BKG-7210', merchantName: "Governor's Residence Hotel",               details: [{ label: 'Booking ID', value: 'BKG-7210' }, { label: 'Hotel', value: "Governor's Residence Hotel Yangon" }, { label: 'Original Dates', value: 'July 20–23, 2024' }, { label: 'Cancellation Reason', value: 'Change of travel plans' }, { label: 'Policy', value: 'Free cancellation (72+ hrs before check-in)' }, { label: 'Refund Status', value: 'Full refund eligible' }] },
  { id: 'UA021', type: 'refund_requested', title: 'Refund requested for BKG-7210 — MMK 290,000',      timestamp: '2024-07-17 14:02', bookingId: 'BKG-7210', amount: 290_000,                                         details: [{ label: 'Refund Request ID', value: 'REF-20240717-210' }, { label: 'Booking ID', value: 'BKG-7210' }, { label: 'Refund Amount', value: 'MMK 290,000' }, { label: 'Original Payment', value: 'Wave Pay' }, { label: 'Reason', value: 'Booking cancellation — policy eligible' }, { label: 'Expected Processing', value: '3–5 business days' }] },
  { id: 'UA022', type: 'refund_processed', title: 'Refund of MMK 290,000 processed to Wave Pay',      timestamp: '2024-07-22 10:00', bookingId: 'BKG-7210', amount: 290_000,                                         details: [{ label: 'Refund ID', value: 'REF-20240717-210' }, { label: 'Amount Refunded', value: 'MMK 290,000' }, { label: 'Refund Method', value: 'Wave Pay (original payment method)' }, { label: 'Processing Time', value: '5 business days' }, { label: 'Processed By', value: 'Finance Team' }, { label: 'Transaction Ref', value: 'TXN-REF-20240722-210' }] },
  { id: 'UA023', type: 'payment_failed',   title: 'Payment failed for BKG-7210 — KBZ Pay declined',  timestamp: '2024-07-15 16:40', bookingId: 'BKG-7210', amount: 290_000,                                         details: [{ label: 'Booking ID', value: 'BKG-7210' }, { label: 'Attempted Method', value: 'KBZ Pay' }, { label: 'Amount', value: 'MMK 290,000' }, { label: 'Error Code', value: 'INSUFFICIENT_FUNDS' }, { label: 'Gateway', value: 'KBZ Pay Gateway' }, { label: 'Action Taken', value: 'User retried with Wave Pay' }] },
  { id: 'UA024', type: 'booking_created',  title: "Booked Governor's Residence Hotel Jul 20–23",     timestamp: '2024-07-15 16:35', bookingId: 'BKG-7210', merchantName: "Governor's Residence Hotel", amount: 290_000, details: [{ label: 'Booking ID', value: 'BKG-7210' }, { label: 'Hotel', value: "Governor's Residence Hotel Yangon" }, { label: 'Room Type', value: 'Colonial Suite' }, { label: 'Check-in', value: 'July 20, 2024' }, { label: 'Check-out', value: 'July 23, 2024' }, { label: 'Guests', value: '2 adults' }, { label: 'Total Amount', value: 'MMK 290,000' }] },
  { id: 'UA025', type: 'payment',          title: 'Paid MMK 290,000 via Wave Pay (retry)',             timestamp: '2024-07-15 16:42', bookingId: 'BKG-7210', amount: 290_000,                                         details: [{ label: 'Transaction ID', value: 'TXN-WP-20240715-7210' }, { label: 'Payment Method', value: 'Wave Pay (retry after KBZ Pay failure)' }, { label: 'Amount', value: 'MMK 290,000' }, { label: 'Gateway Response', value: 'APPROVED' }, { label: 'Processing Time', value: '1.6 seconds' }, { label: 'Receipt', value: 'Sent to wei.lin@example.com' }] },
  { id: 'UA026', type: 'booking_modified', title: 'Modified booking dates for BKG-6880',               timestamp: '2024-06-10 09:15', bookingId: 'BKG-6880', merchantName: 'Aureum Palace Hotel',                    details: [{ label: 'Booking ID', value: 'BKG-6880' }, { label: 'Original Dates', value: 'June 20–22, 2024' }, { label: 'New Dates', value: 'June 22–24, 2024' }, { label: 'Price Difference', value: '+MMK 0 (same rate)' }, { label: 'Modification Fee', value: 'Waived (Platinum tier)' }, { label: 'Hotel', value: 'Aureum Palace Hotel Naypyidaw' }] },
  { id: 'UA027', type: 'profile_updated',  title: 'Updated profile — phone number added',              timestamp: '2024-05-03 11:30',                                                                                  details: [{ label: 'Field Updated', value: 'Phone Number' }, { label: 'Previous Value', value: '(not set)' }, { label: 'New Value', value: '+95 9 7712 3456' }, { label: 'Verification', value: 'SMS OTP verified' }, { label: 'IP Address', value: '202.91.xx.xx' }, { label: 'Device', value: 'Chrome / macOS' }] },
  { id: 'UA028', type: 'password_changed', title: 'Password changed successfully',                      timestamp: '2024-03-02 14:00',                                                                                  details: [{ label: 'Method', value: 'Email verification' }, { label: 'Initiated By', value: 'User (self-service)' }, { label: 'IP Address', value: '202.91.xx.xx' }, { label: 'Device', value: 'Chrome / macOS' }, { label: 'Reason', value: 'Routine security update' }, { label: 'Notification Sent', value: 'Email + SMS' }] },
  { id: 'UA029', type: 'login',            title: 'First login after account registration',             timestamp: '2022-03-14 10:05', device: 'Samsung Galaxy S21', platform: 'Android 12', location: 'Yangon, Myanmar', details: [{ label: 'Device', value: 'Samsung Galaxy S21' }, { label: 'OS', value: 'Android 12' }, { label: 'App Version', value: 'mTrip 1.0.2' }, { label: 'IP Address', value: '202.91.xx.xx' }, { label: 'Registration Date', value: 'March 14, 2022' }, { label: 'Source', value: 'Organic — App Store' }] },
]


const ZAR_NI_ACTIVITIES: UActEvent[] = [
  { id: 'ZN001', type: 'login',            title: 'Logged in from iPhone 15 Pro',                      timestamp: '2024-12-10 14:30', device: 'iPhone 15 Pro', platform: 'iOS 17.3', location: 'Yangon, Myanmar',     details: [{ label: 'Device', value: 'iPhone 15 Pro' }, { label: 'OS', value: 'iOS 17.3' }, { label: 'App Version', value: 'mTrip 3.4.2' }, { label: 'IP Address', value: '203.81.xx.xx' }, { label: 'Location', value: 'Yangon, Myanmar' }, { label: 'Session Duration', value: '28 minutes' }] },
  { id: 'ZN002', type: 'hotel_search',     title: 'Searched hotels in Yangon for Dec 12–14',            timestamp: '2024-12-10 14:33', device: 'iPhone 15 Pro', platform: 'iOS',                                        details: [{ label: 'Destination', value: 'Yangon, Myanmar' }, { label: 'Check-in', value: 'December 12, 2024' }, { label: 'Check-out', value: 'December 14, 2024' }, { label: 'Guests', value: '2 adults' }, { label: 'Filters Applied', value: '5-star · Breakfast' }, { label: 'Results Shown', value: '11 hotels' }] },
  { id: 'ZN003', type: 'hotel_view',       title: 'Viewed The Strand Hotel Yangon',                     timestamp: '2024-12-10 14:36', device: 'iPhone 15 Pro', merchantName: 'The Strand Hotel Yangon',                details: [{ label: 'Hotel', value: 'The Strand Hotel Yangon' }, { label: 'Listed Price', value: 'MMK 520,000 / night' }, { label: 'Time on Page', value: '4 min 02 sec' }, { label: 'Photos Viewed', value: '12 photos' }, { label: 'Reviews Read', value: '8 reviews' }, { label: 'Action', value: 'Proceeded to booking' }] },
  { id: 'ZN004', type: 'coupon_applied',   title: 'Applied coupon GOLD15 — 15% Gold member discount',  timestamp: '2024-12-10 14:41', bookingId: 'BKG-9912', amount: 78_000,                                           details: [{ label: 'Coupon Code', value: 'GOLD15' }, { label: 'Discount Type', value: '15% off — Gold member exclusive' }, { label: 'Original Amount', value: 'MMK 598,000' }, { label: 'Discount Applied', value: '–MMK 78,000' }, { label: 'Final Amount', value: 'MMK 520,000' }, { label: 'Booking ID', value: 'BKG-9912' }] },
  { id: 'ZN005', type: 'booking_created',  title: 'Booked The Strand Hotel Yangon Dec 12–14',           timestamp: '2024-12-10 14:43', bookingId: 'BKG-9912', merchantName: 'The Strand Hotel Yangon', amount: 520_000, details: [{ label: 'Booking ID', value: 'BKG-9912' }, { label: 'Hotel', value: 'The Strand Hotel Yangon' }, { label: 'Room Type', value: 'Superior Room' }, { label: 'Check-in', value: 'December 12, 2024' }, { label: 'Check-out', value: 'December 14, 2024' }, { label: 'Guests', value: '2 adults' }, { label: 'Coupon Applied', value: 'GOLD15 (–15%)' }, { label: 'Total Amount', value: 'MMK 520,000' }] },
  { id: 'ZN006', type: 'payment',          title: 'Paid MMK 520,000 via KBZ Pay',                       timestamp: '2024-12-10 14:45', bookingId: 'BKG-9912', amount: 520_000,                                         details: [{ label: 'Transaction ID', value: 'TXN-KBZ-20241210-9912' }, { label: 'Payment Method', value: 'KBZ Pay' }, { label: 'Amount', value: 'MMK 520,000' }, { label: 'Currency', value: 'MMK' }, { label: 'Gateway Response', value: 'APPROVED' }, { label: 'Processing Time', value: '1.9 seconds' }] },
  { id: 'ZN007', type: 'hotel_search',     title: 'Searched hotels in Chatrium Riverside Yangon',       timestamp: '2024-11-05 10:14', device: 'iPhone 15 Pro', platform: 'iOS',                                        details: [{ label: 'Destination', value: 'Yangon, Myanmar' }, { label: 'Check-in', value: 'November 8, 2024' }, { label: 'Check-out', value: 'November 10, 2024' }, { label: 'Guests', value: '2 adults' }, { label: 'Results Shown', value: '9 hotels' }] },
  { id: 'ZN008', type: 'booking_created',  title: 'Booked Chatrium Riverside Hotel Nov 8–10',           timestamp: '2024-11-05 10:22', bookingId: 'BKG-9344', merchantName: 'Chatrium Riverside Hotel', amount: 380_000, details: [{ label: 'Booking ID', value: 'BKG-9344' }, { label: 'Hotel', value: 'Chatrium Riverside Hotel' }, { label: 'Room Type', value: 'Deluxe River View' }, { label: 'Check-in', value: 'November 8, 2024' }, { label: 'Check-out', value: 'November 10, 2024' }, { label: 'Total Amount', value: 'MMK 380,000' }] },
  { id: 'ZN009', type: 'payment',          title: 'Paid MMK 380,000 via Wave Pay',                      timestamp: '2024-11-05 10:24', bookingId: 'BKG-9344', amount: 380_000,                                         details: [{ label: 'Transaction ID', value: 'TXN-WP-20241105-9344' }, { label: 'Payment Method', value: 'Wave Pay' }, { label: 'Amount', value: 'MMK 380,000' }, { label: 'Gateway Response', value: 'APPROVED' }, { label: 'Processing Time', value: '2.1 seconds' }] },
  { id: 'ZN010', type: 'booking_completed',title: 'Completed stay at Chatrium Riverside Hotel',         timestamp: '2024-11-10 12:00', bookingId: 'BKG-9344', merchantName: 'Chatrium Riverside Hotel', amount: 380_000, details: [{ label: 'Booking ID', value: 'BKG-9344' }, { label: 'Hotel', value: 'Chatrium Riverside Hotel' }, { label: 'Stay Duration', value: '2 nights (Nov 8–10)' }, { label: 'Total Paid', value: 'MMK 380,000' }, { label: 'Check-out Status', value: 'Completed on time' }] },
  { id: 'ZN011', type: 'reward_earned',    title: 'Earned 380 reward points from stay',                 timestamp: '2024-11-10 12:05', bookingId: 'BKG-9344', amount: 380,                                             details: [{ label: 'Points Earned', value: '+380 pts' }, { label: 'Source', value: 'Booking Completion — BKG-9344' }, { label: 'Point Rate', value: '1 pt per MMK 1,000' }, { label: 'Total Balance After', value: '2,150 pts' }, { label: 'Tier Multiplier', value: 'Gold 1.0×' }, { label: 'Expiry', value: 'November 10, 2025' }] },
  { id: 'ZN012', type: 'review_submitted', title: 'Submitted 5-star review for Chatrium Riverside',     timestamp: '2024-11-11 09:30', merchantName: 'Chatrium Riverside Hotel',                                         details: [{ label: 'Hotel', value: 'Chatrium Riverside Hotel' }, { label: 'Rating', value: '5 / 5 stars' }, { label: 'Booking ID', value: 'BKG-9344' }, { label: 'Review Length', value: '142 words' }, { label: 'Photos Attached', value: '3 photos' }, { label: 'Published', value: 'Yes' }] },
  { id: 'ZN013', type: 'voucher_redeemed', title: 'Redeemed Gold anniversary voucher — MMK 30,000',     timestamp: '2024-10-02 19:40', bookingId: 'BKG-8860', amount: 30_000,                                            details: [{ label: 'Voucher Code', value: 'VOC-GOLD-ANNIV-2024' }, { label: 'Voucher Value', value: 'MMK 30,000' }, { label: 'Type', value: 'Gold Anniversary Voucher' }, { label: 'Booking ID', value: 'BKG-8860' }, { label: 'Hotel', value: 'Novotel Inle Lake Resort' }, { label: 'Expiry Date', value: 'December 31, 2024' }] },
  { id: 'ZN014', type: 'booking_created',  title: 'Booked Novotel Inle Lake Resort Oct 5–7',            timestamp: '2024-10-02 19:44', bookingId: 'BKG-8860', merchantName: 'Novotel Inle Lake Resort', amount: 420_000, details: [{ label: 'Booking ID', value: 'BKG-8860' }, { label: 'Hotel', value: 'Novotel Inle Lake Resort' }, { label: 'Room Type', value: 'Lake View Room' }, { label: 'Check-in', value: 'October 5, 2024' }, { label: 'Check-out', value: 'October 7, 2024' }, { label: 'Voucher Applied', value: 'VOC-GOLD-ANNIV-2024 (–MMK 30,000)' }, { label: 'Total Amount', value: 'MMK 420,000' }] },
  { id: 'ZN015', type: 'booking_cancelled',title: 'Cancelled booking at Mandalay Hill Resort',          timestamp: '2024-08-15 16:10', bookingId: 'BKG-7501', merchantName: 'Mandalay Hill Resort',                      details: [{ label: 'Booking ID', value: 'BKG-7501' }, { label: 'Hotel', value: 'Mandalay Hill Resort' }, { label: 'Original Dates', value: 'Aug 18–20, 2024' }, { label: 'Reason', value: 'Change of travel plans' }, { label: 'Policy', value: 'Free cancellation (>48 hrs)' }, { label: 'Refund Status', value: 'Full refund eligible' }] },
  { id: 'ZN016', type: 'refund_processed', title: 'Refund of MMK 290,000 processed to KBZ Pay',        timestamp: '2024-08-20 09:30', bookingId: 'BKG-7501', amount: 290_000,                                           details: [{ label: 'Refund ID', value: 'REF-20240815-501' }, { label: 'Amount Refunded', value: 'MMK 290,000' }, { label: 'Refund Method', value: 'KBZ Pay (original payment method)' }, { label: 'Processing Time', value: '5 business days' }, { label: 'Processed By', value: 'Finance Team' }] },
  { id: 'ZN017', type: 'support_opened',   title: 'Opened support ticket — Refund delay query',         timestamp: '2024-08-18 11:00', bookingId: 'BKG-7501',                                                           details: [{ label: 'Ticket ID', value: 'TKT-20240818-021' }, { label: 'Category', value: 'Refund Inquiry' }, { label: 'Issue', value: 'Refund not received after 3 days' }, { label: 'Booking ID', value: 'BKG-7501' }, { label: 'Status', value: 'Resolved' }] },
  { id: 'ZN018', type: 'support_resolved', title: 'Support ticket resolved — Refund confirmed',         timestamp: '2024-08-18 15:00', bookingId: 'BKG-7501',                                                           details: [{ label: 'Ticket ID', value: 'TKT-20240818-021' }, { label: 'Resolution', value: 'Refund expedited, will arrive by Aug 20' }, { label: 'Resolved By', value: 'Support Agent — Aung Win' }, { label: 'Resolution Time', value: '4 hours' }, { label: 'Customer Rating', value: '4/5 — Satisfied' }] },
  { id: 'ZN019', type: 'reward_redeemed',  title: 'Redeemed 500 pts for MMK 5,000 discount',            timestamp: '2024-06-12 11:05', bookingId: 'BKG-PROMO', amount: 5_000,                                            details: [{ label: 'Points Redeemed', value: '500 pts' }, { label: 'Discount Value', value: 'MMK 5,000' }, { label: 'Rate', value: '100 pts = MMK 1,000' }, { label: 'Balance Before', value: '1,770 pts' }, { label: 'Balance After', value: '1,270 pts' }] },
  { id: 'ZN020', type: 'profile_updated',  title: 'Updated profile — email address verified',            timestamp: '2024-05-21 10:00',                                                                                   details: [{ label: 'Field Updated', value: 'Email Address' }, { label: 'New Value', value: 'zarni.aung@example.com' }, { label: 'Verification', value: 'Email OTP confirmed' }, { label: 'IP Address', value: '203.81.xx.xx' }, { label: 'Device', value: 'Chrome / Windows' }] },
  { id: 'ZN021', type: 'device_changed',   title: 'New device registered — iPhone 15 Pro',              timestamp: '2024-04-10 08:45', device: 'iPhone 15 Pro', platform: 'iOS 17.3', location: 'Yangon, Myanmar',     details: [{ label: 'New Device', value: 'iPhone 15 Pro' }, { label: 'Previous Device', value: 'Samsung Galaxy S22' }, { label: 'OS', value: 'iOS 17.3' }, { label: 'App Version', value: 'mTrip 3.3.0' }, { label: 'Verification', value: '2FA SMS confirmed' }, { label: 'IP Address', value: '203.81.xx.xx' }] },
  { id: 'ZN022', type: 'registration',     title: 'Account created via mTrip mobile app',               timestamp: '2023-05-20 14:15', device: 'Samsung Galaxy S22', platform: 'Android 13', location: 'Yangon, Myanmar', details: [{ label: 'Registration Method', value: 'Email & Password' }, { label: 'Device', value: 'Samsung Galaxy S22' }, { label: 'OS', value: 'Android 13' }, { label: 'App Version', value: 'mTrip 2.1.0' }, { label: 'Referral Code Used', value: 'None' }, { label: 'Welcome Email Sent', value: 'Yes' }] },
  { id: 'ZN023', type: 'email_verification',title: 'Email address verified after registration',          timestamp: '2023-05-20 14:17',                                                                                   details: [{ label: 'Email', value: 'zarni.aung@example.com' }, { label: 'Verification Method', value: 'Email OTP (6-digit)' }, { label: 'Time to Verify', value: '2 minutes' }, { label: 'IP Address', value: '203.81.xx.xx' }, { label: 'Status', value: 'Verified' }] },
  { id: 'ZN024', type: 'phone_verification',title: 'Phone number verified',                              timestamp: '2023-05-20 14:20',                                                                                   details: [{ label: 'Phone', value: '+95 9 8812 3399' }, { label: 'Verification Method', value: 'SMS OTP' }, { label: 'Carrier', value: 'Ooredoo Myanmar' }, { label: 'Time to Verify', value: '1 minute' }, { label: 'Status', value: 'Verified' }] },
]

function getActivities(u: EndUser): UActEvent[] {
  if (u.id === 'USR-001') return SAMPLE_ACTIVITIES
  if (u.id === 'USR-042') return ZAR_NI_ACTIVITIES
  // Generate plausible activity set for other users
  const clr = AVATAR_COLORS[parseInt(u.id.replace('USR-', ''), 10) % AVATAR_COLORS.length]
  const base: UActEvent[] = [
    { id: 'GEN01', type: 'login',           title: 'Logged in via mobile app',                            timestamp: u.lastLogin,         device: 'Mobile', platform: 'iOS', location: u.country, details: [{ label: 'Device', value: 'Mobile App' }, { label: 'Location', value: u.country }, { label: 'App Version', value: 'mTrip 3.4.1' }, { label: 'Session Duration', value: '18 min' }] },
    { id: 'GEN02', type: 'hotel_search',    title: `Searched hotels in ${u.country}`,                     timestamp: u.lastLogin.slice(0,10) + ' 08:45', details: [{ label: 'Destination', value: u.country }, { label: 'Guests', value: '2 adults' }, { label: 'Results Shown', value: '8 hotels' }] },
    { id: 'GEN03', type: 'booking_created', title: 'Booked hotel stay',                                   timestamp: u.registeredAt + ' 14:20', bookingId: `BKG-${u.id.slice(-3)}0`, amount: Math.round(u.totalSpending / Math.max(u.totalBookings, 1) / 1000) * 1000, details: [{ label: 'Hotel', value: 'Hotel in ' + u.country }, { label: 'Guests', value: '2 adults' }, { label: 'Total Amount', value: (Math.round(u.totalSpending / Math.max(u.totalBookings,1) / 1000) * 1000).toLocaleString() + ' MMK' }] },
    { id: 'GEN04', type: 'payment',         title: 'Payment completed',                                   timestamp: u.registeredAt + ' 14:22', bookingId: `BKG-${u.id.slice(-3)}0`, amount: Math.round(u.totalSpending / Math.max(u.totalBookings, 1) / 1000) * 1000, details: [{ label: 'Payment Method', value: 'Wave Pay' }, { label: 'Gateway Response', value: 'APPROVED' }] },
    { id: 'GEN05', type: 'reward_earned',   title: `Earned ${u.points} reward points total`,              timestamp: u.registeredAt + ' 14:23', amount: u.points, details: [{ label: 'Points Earned', value: `+${u.points} pts` }, { label: 'Current Balance', value: `${u.points} pts` }] },
  ]
  void clr
  return base
}

function fmtSpend(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toString()
}

function fmtDateHeader(d: string) {
  const TODAY = '2024-12-13'
  const YESTERDAY = '2024-12-12'
  if (d === TODAY) return 'Today'
  if (d === YESTERDAY) return 'Yesterday'
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5" style={{ fontSize: 11, color, background: bg, height: 18, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function UserActivitiesPage({ showToast, user }: { showToast: Props['showToast']; user: EndUser }) {
  const selectedUser = user
  const [catFilter, setCatFilter]       = useState<UActCat>('all')
  const [dateRange, setDateRange]       = useState<'7d' | '30d' | '90d' | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [searchQuery, setSearchQuery]   = useState('')
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const allActivities = getActivities(selectedUser)

  const cutoff = dateRange === 'all' ? '' : (() => {
    const d = new Date('2024-12-13')
    d.setDate(d.getDate() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90))
    return d.toISOString().slice(0, 10)
  })()

  const filtered = allActivities.filter(a => {
    if (catFilter !== 'all' && UACT[a.type].cat !== catFilter) return false
    if (cutoff && a.timestamp.slice(0, 10) < cutoff) return false
    if (platformFilter !== 'all') {
      const pf = (a.platform ?? a.device ?? '').toLowerCase()
      if (platformFilter === 'ios' && !pf.includes('ios') && !pf.includes('iphone') && !pf.includes('ipad')) return false
      if (platformFilter === 'android' && !pf.includes('android') && !pf.includes('samsung') && !pf.includes('galaxy')) return false
      if (platformFilter === 'web' && !pf.includes('chrome') && !pf.includes('safari') && !pf.includes('macos') && !pf.includes('windows')) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!a.title.toLowerCase().includes(q) && !(a.bookingId ?? '').toLowerCase().includes(q) && !(a.merchantName ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const grouped: { date: string; events: UActEvent[] }[] = []
  for (const evt of filtered) {
    const d = evt.timestamp.slice(0, 10)
    const last = grouped[grouped.length - 1]
    if (last && last.date === d) last.events.push(evt)
    else grouped.push({ date: d, events: [evt] })
  }

  const categoryCounts = Object.fromEntries(
    (['auth','browse','booking','payment','rewards','promotions','reviews','support','account'] as UActCat[]).map(cat => [
      cat, allActivities.filter(a => UACT[a.type].cat === cat).length,
    ])
  )

  return (
    <div className="p-6" style={{ minWidth: 1060 }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>Activity Timeline</h2>
          <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Browsing, booking, payment, and account events for {selectedUser.name}</p>
        </div>
        <button onClick={() => showToast('success', 'Export', `Activity timeline for ${selectedUser.name} exported.`)}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 32, fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', background: '#fff', cursor: 'pointer' }}>
          <Download size={12} /> Export Timeline
        </button>
      </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {UA_CATS.map(({ id, label }) => {
              const count = id === 'all' ? allActivities.length : (categoryCounts[id] ?? 0)
              const active = catFilter === id
              return (
                <button key={id} onClick={() => setCatFilter(id)}
                  className="flex items-center gap-1.5 rounded-full px-3 font-medium"
                  style={{ height: 28, fontSize: 12, background: active ? '#1A2332' : '#F1F5F9', color: active ? '#fff' : '#475569', border: '1px solid transparent' }}>
                  {label}
                  <span className="rounded-full px-1.5 font-mono" style={{ fontSize: 10, background: active ? 'rgba(255,255,255,0.2)' : '#E3E8F0', color: active ? '#fff' : '#64748B' }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <Search size={13} color="#94A3B8" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by booking ID, hotel, or activity keyword…"
              className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
            <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
            <select value={dateRange} onChange={e => setDateRange(e.target.value as typeof dateRange)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
            <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
              <option value="all">All Platforms</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
              <option value="web">Web</option>
            </select>
            <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
            <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>
              <Filter size={12} className="inline mr-1" />{filtered.length} events
            </span>
          </div>

          {/* Timeline */}
          {grouped.length === 0 ? (
            <div className="rounded-xl flex flex-col items-center justify-center py-16" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <Activity size={28} color="#E3E8F0" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, color: '#94A3B8' }}>No activities found</div>
              <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>Try adjusting your filters or date range</div>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 mb-3">
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{fmtDateHeader(group.date)}</span>
                    <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
                    <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{group.events.length} event{group.events.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
                    {group.events.map((evt, ei) => {
                      const cfg = UACT[evt.type]
                      const expanded = expandedIds.has(evt.id)
                      const isLast = ei === group.events.length - 1
                      return (
                        <div key={evt.id} style={{ borderBottom: isLast ? 'none' : '1px solid #F8FAFC' }}>
                          <div className="flex items-start gap-4 px-4 py-3.5 relative"
                            onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            {!isLast && <div style={{ position: 'absolute', left: 35, top: 52, bottom: 0, width: 1, background: '#F1F5F9', zIndex: 0 }} />}
                            <div className="flex items-center justify-center rounded-full flex-shrink-0"
                              style={{ width: 32, height: 32, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, marginTop: 1, position: 'relative', zIndex: 1 }}>
                              {cfg.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{evt.title}</span>
                                <span className="rounded px-1.5 font-medium" style={{ fontSize: 10, background: cfg.bg, color: cfg.color, height: 18, display: 'inline-flex', alignItems: 'center' }}>{cfg.label}</span>
                              </div>
                              <div className="flex items-center flex-wrap gap-2">
                                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{evt.timestamp.slice(11)}</span>
                                {evt.location && <Chip color="#475569" bg="#F1F5F9">{evt.location}</Chip>}
                                {evt.device && !evt.location && <Chip color="#475569" bg="#F1F5F9">{evt.device}</Chip>}
                                {evt.platform && <Chip color="#64748B" bg="#F8FAFC">{evt.platform}</Chip>}
                                {evt.bookingId && <Chip color="#1664FF" bg="#EEF4FF"><span style={{ fontFamily: 'monospace' }}>{evt.bookingId}</span></Chip>}
                                {evt.merchantName && <Chip color="#7C3AED" bg="#EDE9FE">{evt.merchantName}</Chip>}
                                {evt.amount !== undefined && (
                                  <Chip color="#059669" bg="#ECFDF3">
                                    <span style={{ fontFamily: 'monospace' }}>{evt.amount >= 1000 ? 'MMK ' + evt.amount.toLocaleString() : '+' + evt.amount + ' pts'}</span>
                                  </Chip>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {evt.bookingId && (
                                <ActionBtn title="View Booking" onClick={() => showToast('info', 'View Booking', `Opening booking ${evt.bookingId}.`)} color="#1664FF">
                                  <Calendar size={12} />
                                </ActionBtn>
                              )}
                              {evt.merchantName && (
                                <ActionBtn title="View Merchant" onClick={() => showToast('info', 'View Merchant', `Opening ${evt.merchantName}.`)} color="#7C3AED">
                                  <Building2 size={12} />
                                </ActionBtn>
                              )}
                              {evt.amount !== undefined && evt.amount >= 1000 && (
                                <ActionBtn title="View Transaction" onClick={() => showToast('info', 'View Transaction', 'Opening transaction record.')} color="#059669">
                                  <CreditCard size={12} />
                                </ActionBtn>
                              )}
                              {evt.amount !== undefined && evt.amount < 1000 && (
                                <ActionBtn title="View Reward Record" onClick={() => showToast('info', 'Reward Record', 'Opening reward ledger entry.')} color="#F59E0B">
                                  <Gift size={12} />
                                </ActionBtn>
                              )}
                              <ActionBtn title={expanded ? 'Collapse' : 'Expand details'} onClick={() => toggleExpand(evt.id)} color="#94A3B8">
                                <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                              </ActionBtn>
                            </div>
                          </div>
                          {expanded && (
                            <div className="px-4 pb-4" style={{ paddingLeft: 64 }}>
                              <div className="rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                                <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                  {evt.details.map((d, di) => (
                                    <div key={di}>
                                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{d.label}</div>
                                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332', fontFamily: /^(TXN|REF|TKT|BKG|MMK|[0-9+\-])/.test(d.value) ? 'monospace' : 'inherit' }}>{d.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  )
}

// ── 5. Rewards & Coupons ──────────────────────────────────────────────────────

// ── Data models ────────────────────────────────────────────────────────────────
interface RCoupon {
  code: string; name: string; campaign: string
  discountType: 'percent' | 'fixed'
  discountValue: number; minSpend: number
  issueDate: string; expiry: string
  status: 'available' | 'used' | 'expired' | 'revoked'
  redemptionDate?: string; bookingId?: string
}

interface RVoucher {
  id: string; name: string; campaign: string
  value: number; issueDate: string; expiry: string
  status: 'available' | 'redeemed' | 'expired' | 'cancelled'
  redemptionDate?: string; bookingId?: string
}

interface WalletTx {
  id: string; type: 'earned' | 'redeemed' | 'referral' | 'campaign' | 'manual_credit' | 'manual_deduct' | 'expired'
  points: number; date: string; source: string
  bookingId?: string; campaign?: string; admin?: string
}

interface RHistoryEvent {
  id: string; type: 'earned' | 'redeemed' | 'referral' | 'campaign' | 'welcome' | 'coupon_issued' | 'coupon_redeemed' | 'voucher_issued' | 'voucher_redeemed' | 'tier_upgrade' | 'manual_credit' | 'manual_deduct'
  title: string; date: string; points?: number; value?: number
  bookingId?: string; campaign?: string; admin?: string; note?: string
}

const TIER_THRESHOLDS: Record<MemberTier, { minSpend: number; next?: MemberTier; nextSpend?: number }> = {
  Bronze:   { minSpend: 0,          next: 'Silver',   nextSpend: 1_000_000  },
  Silver:   { minSpend: 1_000_000,  next: 'Gold',     nextSpend: 5_000_000  },
  Gold:     { minSpend: 5_000_000,  next: 'Platinum', nextSpend: 15_000_000 },
  Platinum: { minSpend: 15_000_000 },
}

const TIER_BENEFITS: Record<MemberTier, { label: string; value: string }[]> = {
  Bronze:   [{ label: 'Point Rate', value: '1 pt / MMK 1,000' }, { label: 'Bonus Multiplier', value: '1×' }, { label: 'Priority Support', value: 'No' }, { label: 'Exclusive Vouchers', value: 'No'  }, { label: 'Early Access', value: 'No'  }, { label: 'Free Cancellation', value: 'No'  }],
  Silver:   [{ label: 'Point Rate', value: '1 pt / MMK 1,000' }, { label: 'Bonus Multiplier', value: '1.5×' }, { label: 'Priority Support', value: 'No' }, { label: 'Exclusive Vouchers', value: 'No'  }, { label: 'Early Access', value: 'No'  }, { label: 'Free Cancellation', value: 'Limited' }],
  Gold:     [{ label: 'Point Rate', value: '1 pt / MMK 1,000' }, { label: 'Bonus Multiplier', value: '2×'  }, { label: 'Priority Support', value: 'Yes' }, { label: 'Exclusive Vouchers', value: 'Yes' }, { label: 'Early Access', value: 'No'  }, { label: 'Free Cancellation', value: 'Yes' }],
  Platinum: [{ label: 'Point Rate', value: '1 pt / MMK 1,000' }, { label: 'Bonus Multiplier', value: '3×'  }, { label: 'Priority Support', value: 'Yes' }, { label: 'Exclusive Vouchers', value: 'Yes' }, { label: 'Early Access', value: 'Yes' }, { label: 'Free Cancellation', value: 'Always' }],
}

// ── Zar Ni datasets ─────────────────────────────────────────────────────────
const ZN_WALLET: WalletTx[] = [
  { id: 'W001', type: 'earned',       points:  520, date: '2024-12-10', source: 'Hotel Booking — The Strand Yangon',        bookingId: 'BKG-9912' },
  { id: 'W002', type: 'earned',       points:  380, date: '2024-11-10', source: 'Hotel Booking — Chatrium Riverside',        bookingId: 'BKG-9344' },
  { id: 'W003', type: 'earned',       points:  420, date: '2024-10-07', source: 'Hotel Booking — Novotel Inle Lake',         bookingId: 'BKG-8860' },
  { id: 'W004', type: 'redeemed',     points: -500, date: '2024-06-12', source: 'Redemption — MMK 5,000 discount',           bookingId: 'BKG-PROMO' },
  { id: 'W005', type: 'referral',     points:  200, date: '2024-04-15', source: 'Referral reward — Ko Aung joined via ZARNI42' },
  { id: 'W006', type: 'campaign',     points:  300, date: '2024-03-01', source: 'Double Points Campaign — Q1 2024',          campaign: 'Q1 Double Points 2024' },
  { id: 'W007', type: 'manual_credit',points:  150, date: '2024-01-20', source: 'Manual credit — Compensation for BKG-6201', admin: 'Admin Thida', bookingId: 'BKG-6201' },
  { id: 'W008', type: 'earned',       points:  320, date: '2023-12-25', source: 'Hotel Booking — Aureum Palace Hotel',       bookingId: 'BKG-6201' },
  { id: 'W009', type: 'campaign',     points:  100, date: '2023-11-11', source: '11.11 Sale Bonus — Campaign Reward',        campaign: '11.11 Super Sale 2023' },
  { id: 'W010', type: 'earned',       points:   80, date: '2023-07-10', source: 'Hotel Booking — Hotel Minn Mandalay',       bookingId: 'BKG-4450' },
]

const ZN_COUPONS: RCoupon[] = [
  { code: 'GOLD15',     name: 'Gold Member 15% Off',           campaign: 'Gold Member Benefits Q4 2024', discountType: 'percent', discountValue: 15, minSpend: 300_000, issueDate: '2024-10-01', expiry: '2024-12-31', status: 'used',      redemptionDate: '2024-12-10', bookingId: 'BKG-9912' },
  { code: 'GOLD50K',    name: 'Gold Flat MMK 50,000 Off',      campaign: 'Gold Member Benefits Q4 2024', discountType: 'fixed',   discountValue: 50_000, minSpend: 350_000, issueDate: '2024-10-01', expiry: '2024-12-31', status: 'available' },
  { code: 'NYE2025',    name: 'New Year 2025 — 20% Off',       campaign: 'New Year 2025 Promotion',      discountType: 'percent', discountValue: 20, minSpend: 200_000, issueDate: '2024-12-15', expiry: '2025-01-10', status: 'available' },
  { code: 'WINTER20',   name: 'Winter Season 20% Off',         campaign: 'Winter Season Sale 2024',      discountType: 'percent', discountValue: 20, minSpend: 200_000, issueDate: '2024-11-20', expiry: '2024-12-01', status: 'expired' },
  { code: 'REFCOMP150', name: 'Service Compensation MMK 15K',  campaign: 'Customer Care — Compensation', discountType: 'fixed',   discountValue: 15_000, minSpend: 0, issueDate: '2024-08-18', expiry: '2024-09-30', status: 'expired' },
  { code: 'INLE100K',   name: 'Inle Package MMK 100,000 Off',  campaign: 'Inle Lake Exclusive Q3 2024',  discountType: 'fixed',   discountValue: 100_000, minSpend: 600_000, issueDate: '2024-07-01', expiry: '2024-09-30', status: 'expired' },
]

const ZN_VOUCHERS: RVoucher[] = [
  { id: 'VOC-GOLD-ANNIV-2024', name: 'Gold Anniversary Voucher',    campaign: 'Gold Anniversary 2024',    value: 30_000, issueDate: '2024-09-20', expiry: '2024-12-31', status: 'redeemed', redemptionDate: '2024-10-02', bookingId: 'BKG-8860' },
  { id: 'VOC-BDAY-2024',       name: 'Birthday Gift Voucher',       campaign: 'Happy Birthday Campaign',  value: 20_000, issueDate: '2024-05-20', expiry: '2024-06-20', status: 'expired' },
  { id: 'VOC-GOLD-Q4-2024',    name: 'Q4 Gold Exclusive Voucher',   campaign: 'Gold Member Benefits Q4',  value: 25_000, issueDate: '2024-12-01', expiry: '2025-01-31', status: 'available' },
  { id: 'VOC-NYE-2025',        name: 'New Year Stay Package Bonus', campaign: 'New Year 2025 Promotion',  value: 50_000, issueDate: '2024-12-15', expiry: '2025-01-10', status: 'available' },
]

const ZN_HISTORY: RHistoryEvent[] = [
  { id: 'H001', type: 'earned',         title: 'Points earned — The Strand Hotel Yangon',            date: '2024-12-10', points: 520,  bookingId: 'BKG-9912' },
  { id: 'H002', type: 'coupon_redeemed',title: 'Coupon GOLD15 redeemed — 15% off',                   date: '2024-12-10', value: 78_000, bookingId: 'BKG-9912' },
  { id: 'H003', type: 'earned',         title: 'Points earned — Chatrium Riverside Hotel',            date: '2024-11-10', points: 380,  bookingId: 'BKG-9344' },
  { id: 'H004', type: 'voucher_redeemed',title: 'Voucher VOC-GOLD-ANNIV-2024 redeemed — MMK 30,000', date: '2024-10-02', value: 30_000, bookingId: 'BKG-8860' },
  { id: 'H005', type: 'earned',         title: 'Points earned — Novotel Inle Lake Resort',            date: '2024-10-07', points: 420,  bookingId: 'BKG-8860' },
  { id: 'H006', type: 'coupon_issued',  title: 'Coupon NYE2025 issued — New Year 2025 20% off',      date: '2024-12-15', campaign: 'New Year 2025 Promotion' },
  { id: 'H007', type: 'voucher_issued', title: 'Voucher VOC-NYE-2025 issued — MMK 50,000',           date: '2024-12-15', value: 50_000, campaign: 'New Year 2025 Promotion' },
  { id: 'H008', type: 'voucher_issued', title: 'Voucher VOC-GOLD-Q4-2024 issued — MMK 25,000',       date: '2024-12-01', value: 25_000, campaign: 'Gold Member Benefits Q4' },
  { id: 'H009', type: 'redeemed',       title: 'Points redeemed — MMK 5,000 discount',               date: '2024-06-12', points: -500, bookingId: 'BKG-PROMO' },
  { id: 'H010', type: 'referral',       title: 'Referral reward — Ko Aung joined via ZARNI42',        date: '2024-04-15', points: 200 },
  { id: 'H011', type: 'campaign',       title: 'Campaign reward — Q1 Double Points 2024',             date: '2024-03-01', points: 300,  campaign: 'Q1 Double Points 2024' },
  { id: 'H012', type: 'tier_upgrade',   title: 'Membership upgraded Silver → Gold',                   date: '2024-01-01', note: 'Lifetime spending passed MMK 5,000,000' },
  { id: 'H013', type: 'manual_credit',  title: 'Manual credit — Compensation for service failure',   date: '2024-01-20', points: 150,  bookingId: 'BKG-6201', admin: 'Admin Thida' },
  { id: 'H014', type: 'earned',         title: 'Points earned — Aureum Palace Hotel Bagan',           date: '2023-12-25', points: 320,  bookingId: 'BKG-6201' },
  { id: 'H015', type: 'campaign',       title: 'Campaign reward — 11.11 Super Sale 2023',             date: '2023-11-11', points: 100,  campaign: '11.11 Super Sale 2023' },
  { id: 'H016', type: 'coupon_issued',  title: 'Coupon INLE100K issued — Inle Exclusive MMK 100K',   date: '2023-07-01', campaign: 'Inle Lake Exclusive Q3 2024' },
  { id: 'H017', type: 'earned',         title: 'Points earned — Hotel Minn Mandalay',                 date: '2023-07-10', points: 80,   bookingId: 'BKG-4450' },
  { id: 'H018', type: 'tier_upgrade',   title: 'Membership upgraded Bronze → Silver',                 date: '2023-09-01', note: 'Lifetime spending passed MMK 1,000,000' },
  { id: 'H019', type: 'welcome',        title: 'Welcome reward granted on registration',              date: '2023-05-20', points: 50, note: 'First-time registration bonus' },
]

function getRewardsData(u: EndUser) {
  if (u.id === 'USR-042') return { wallet: ZN_WALLET, coupons: ZN_COUPONS, vouchers: ZN_VOUCHERS, history: ZN_HISTORY }
  const base = u.points
  const wallet: WalletTx[] = [
    { id: 'W1', type: 'earned', points: Math.floor(base * 0.6), date: '2024-11-20', source: 'Hotel Booking', bookingId: 'BKG-AUTO1' },
    { id: 'W2', type: 'earned', points: Math.floor(base * 0.4), date: '2024-09-05', source: 'Hotel Booking', bookingId: 'BKG-AUTO2' },
  ]
  const coupons: RCoupon[] = [
    { code: 'WELCOME10', name: 'Welcome 10% Off', campaign: 'New Member Welcome', discountType: 'percent', discountValue: 10, minSpend: 100_000, issueDate: '2023-01-10', expiry: '2025-06-30', status: 'available' },
  ]
  const vouchers: RVoucher[] = [
    { id: 'VOC-AUT01', name: 'Seasonal Voucher', campaign: 'Year-End Campaign', value: 15_000, issueDate: '2024-11-01', expiry: '2025-01-31', status: 'available' },
  ]
  const history: RHistoryEvent[] = [
    { id: 'AH1', type: 'welcome', title: 'Welcome reward on registration', date: '2023-01-10', points: 50 },
    { id: 'AH2', type: 'earned', title: 'Points earned — Hotel Booking', date: '2024-09-05', points: Math.floor(base * 0.4), bookingId: 'BKG-AUTO2' },
    { id: 'AH3', type: 'earned', title: 'Points earned — Hotel Booking', date: '2024-11-20', points: Math.floor(base * 0.6), bookingId: 'BKG-AUTO1' },
  ]
  return { wallet, coupons, vouchers, history }
}

// ── Helper constants ────────────────────────────────────────────────────────
const HISTORY_CFG: Record<RHistoryEvent['type'], { label: string; color: string; bg: string; border: string; icon: string }> = {
  earned:          { label: 'Pts Earned',        color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', icon: 'plus' },
  redeemed:        { label: 'Pts Redeemed',      color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE', icon: 'minus' },
  referral:        { label: 'Referral Reward',   color: '#14B8A6', bg: '#F0FDFA', border: '#99F6E4', icon: 'plus' },
  campaign:        { label: 'Campaign Reward',   color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: 'plus' },
  welcome:         { label: 'Welcome Reward',    color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE', icon: 'plus' },
  coupon_issued:   { label: 'Coupon Issued',     color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8', icon: 'tag' },
  coupon_redeemed: { label: 'Coupon Redeemed',   color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8', icon: 'tag' },
  voucher_issued:  { label: 'Voucher Issued',    color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', icon: 'ticket' },
  voucher_redeemed:{ label: 'Voucher Redeemed',  color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', icon: 'ticket' },
  tier_upgrade:    { label: 'Tier Upgrade',      color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', icon: 'star' },
  manual_credit:   { label: 'Manual Credit',     color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', icon: 'plus' },
  manual_deduct:   { label: 'Manual Deduction',  color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: 'minus' },
}

const COUPON_STATUS_STYLE: Record<RCoupon['status'], { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: '#027A48', bg: '#ECFDF3' },
  used:      { label: 'Used',      color: '#475569', bg: '#F1F5F9' },
  expired:   { label: 'Expired',   color: '#94A3B8', bg: '#F8FAFC' },
  revoked:   { label: 'Revoked',   color: '#DC2626', bg: '#FEF2F2' },
}

const VOUCHER_STATUS_STYLE: Record<RVoucher['status'], { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: '#027A48', bg: '#ECFDF3' },
  redeemed:  { label: 'Redeemed',  color: '#7C3AED', bg: '#EDE9FE' },
  expired:   { label: 'Expired',   color: '#94A3B8', bg: '#F8FAFC' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: '#FEF2F2' },
}

const WALLET_TYPE_CFG: Record<WalletTx['type'], { label: string; color: string; sign: string }> = {
  earned:        { label: 'Earned',          color: '#059669', sign: '+' },
  redeemed:      { label: 'Redeemed',        color: '#7C3AED', sign: '−' },
  referral:      { label: 'Referral Reward', color: '#14B8A6', sign: '+' },
  campaign:      { label: 'Campaign Reward', color: '#F59E0B', sign: '+' },
  manual_credit: { label: 'Manual Credit',   color: '#059669', sign: '+' },
  manual_deduct: { label: 'Manual Deduct',   color: '#DC2626', sign: '−' },
  expired:       { label: 'Pts Expired',     color: '#94A3B8', sign: '−' },
}

// ── Small sub-components (module level) ───────────────────────────────────
function RcStatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color, background: bg }}>
      {label}
    </span>
  )
}

function RcTableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
        {cols.map(c => (
          <th key={c} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{c}</th>
        ))}
        <th style={{ padding: '8px 14px', width: 32 }} />
      </tr>
    </thead>
  )
}

function RcEmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr>
      <td colSpan={cols + 1} style={{ padding: '36px 14px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
        {label}
      </td>
    </tr>
  )
}

function HistoryIcon({ type }: { type: RHistoryEvent['type'] }) {
  const cfg = HISTORY_CFG[type]
  let icon
  if (cfg.icon === 'plus') icon = <TrendingUp size={13} />
  else if (cfg.icon === 'minus') icon = <RotateCcw size={13} />
  else if (cfg.icon === 'tag') icon = <Tag size={13} />
  else if (cfg.icon === 'ticket') icon = <Ticket size={13} />
  else icon = <Star size={13} />
  return (
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
  )
}

// ── Main RewardsCouponsPage ────────────────────────────────────────────────
function RewardsCouponsPage({ showToast, user }: { showToast: Props['showToast']; user: EndUser }) {
  const selectedUser = user
  const [activeTab, setActiveTab]   = useState<'wallet' | 'coupons' | 'vouchers' | 'membership' | 'history'>('wallet')
  const [manualPtsMode, setManualPtsMode] = useState<'credit' | 'deduct' | null>(null)
  const [manualPts, setManualPts]         = useState('')
  const [manualReason, setManualReason]   = useState('')

  const data = getRewardsData(selectedUser)
  const tier = selectedUser.tier
  const threshold = TIER_THRESHOLDS[tier]
  const tierColor = TIER_STYLE[tier].color
  const tierS     = TIER_STYLE[tier]
  const spending = selectedUser.totalSpending
  const spendPct = threshold.nextSpend ? Math.min((spending / threshold.nextSpend) * 100, 100) : 100

  const earnedTotal    = data.wallet.filter(w => w.points > 0).reduce((s, w) => s + w.points, 0)
  const redeemedTotal  = data.wallet.filter(w => w.points < 0).reduce((s, w) => s + Math.abs(w.points), 0)
  const activeCoupons  = data.coupons.filter(c => c.status === 'available').length
  const activeVouchers = data.vouchers.filter(v => v.status === 'available').length
  const expiringSoon   = [
    ...data.coupons.filter(c => c.status === 'available' && c.expiry <= '2025-01-31'),
    ...data.vouchers.filter(v => v.status === 'available' && v.expiry <= '2025-01-31'),
  ].length

  const TABS: { id: typeof activeTab; label: string }[] = [
    { id: 'wallet',     label: 'Reward Wallet' },
    { id: 'coupons',    label: `Coupons (${data.coupons.length})` },
    { id: 'vouchers',   label: `Vouchers (${data.vouchers.length})` },
    { id: 'membership', label: 'Membership' },
    { id: 'history',    label: 'Reward History' },
  ]

  return (
    <div className="p-6" style={{ minWidth: 1060 }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>Loyalty & Rewards</h2>
          <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Points wallet, coupons, vouchers, membership tier, and reward history for {selectedUser.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => showToast('success', 'Export', `Reward history for ${selectedUser.name} exported.`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
            <Download size={12} /> Export
          </button>
          <button onClick={() => setManualPtsMode('credit')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 12, color: '#059669', border: '1px solid #A7F3D0', borderRadius: 8, background: '#ECFDF3', cursor: 'pointer' }}>
            <Plus size={12} /> Credit Points
          </button>
          <button onClick={() => setManualPtsMode('deduct')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 12, color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, background: '#FEF2F2', cursor: 'pointer' }}>
            <Minus size={12} /> Deduct Points
          </button>
        </div>
      </div>

          {/* KPI cards */}
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 20 }}>
            {[
              { label: 'Reward Balance', value: selectedUser.points.toLocaleString() + ' pts', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
              { label: 'Total Pts Earned', value: earnedTotal.toLocaleString() + ' pts', color: '#059669', bg: '#ECFDF3', border: '#A7F3D0' },
              { label: 'Total Pts Redeemed', value: redeemedTotal.toLocaleString() + ' pts', color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE' },
              { label: 'Active Coupons', value: String(activeCoupons), color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8' },
              { label: 'Active Vouchers', value: String(activeVouchers), color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
              { label: 'Expiring Soon', value: String(expiringSoon), color: expiringSoon > 0 ? '#D97706' : '#94A3B8', bg: expiringSoon > 0 ? '#FFFBEB' : '#F8FAFC', border: expiringSoon > 0 ? '#FDE68A' : '#E3E8F0' },
            ].map(k => (
              <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.color, fontFamily: 'monospace', marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E3E8F0', marginBottom: 20 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 16px', fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400, color: activeTab === t.id ? '#1664FF' : '#64748B', borderBottom: activeTab === t.id ? '2px solid #1664FF' : '2px solid transparent', background: 'transparent', border: 'none', borderBottomStyle: 'solid', borderBottomWidth: activeTab === t.id ? 2 : 2, borderBottomColor: activeTab === t.id ? '#1664FF' : 'transparent', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Wallet Tab ── */}
          {activeTab === 'wallet' && (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '260px 1fr' }}>
              {/* Left summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A2332', marginBottom: 14 }}>Point Balance</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#F59E0B', fontFamily: 'monospace', marginBottom: 4 }}>{selectedUser.points.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>Available reward points</div>
                </div>
                {[
                  { label: 'Lifetime Earned',   value: earnedTotal.toLocaleString() + ' pts',   color: '#059669', bg: '#ECFDF3' },
                  { label: 'Lifetime Redeemed', value: redeemedTotal.toLocaleString() + ' pts', color: '#7C3AED', bg: '#EDE9FE' },
                  { label: 'Expired Points',    value: '0 pts',                                 color: '#94A3B8', bg: '#F8FAFC' },
                  { label: 'Manual Adjustments',value: data.wallet.filter(w => w.type === 'manual_credit' || w.type === 'manual_deduct').length + ' transactions', color: '#475569', bg: '#F1F5F9' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</span>
                  </div>
                ))}
              </div>
              {/* Transaction history */}
              <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Transaction History</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <RcTableHeader cols={['Date', 'Type', 'Source / Description', 'Points', 'Booking ID']} />
                  <tbody>
                    {data.wallet.length === 0
                      ? <RcEmptyRow cols={5} label="No wallet transactions" />
                      : data.wallet.map(w => {
                          const cfg = WALLET_TYPE_CFG[w.type]
                          return (
                            <tr key={w.id} style={{ borderBottom: '1px solid #F8FAFC' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
                              onMouseLeave={e => e.currentTarget.style.background = ''}>
                              <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{w.date}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.color + '18' }}>{cfg.label}</span>
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: 12, color: '#1A2332', maxWidth: 280 }}>{w.source}{w.campaign && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>· {w.campaign}</span>}{w.admin && <span style={{ fontSize: 11, color: '#D97706', marginLeft: 6 }}>· {w.admin}</span>}</td>
                              <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: w.points >= 0 ? '#059669' : '#DC2626', whiteSpace: 'nowrap' }}>{cfg.sign}{Math.abs(w.points).toLocaleString()} pts</td>
                              <td style={{ padding: '10px 14px' }}>{w.bookingId ? <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1664FF', background: '#EEF4FF', padding: '2px 6px', borderRadius: 4 }}>{w.bookingId}</span> : <span style={{ color: '#E3E8F0' }}>—</span>}</td>
                              <td style={{ padding: '10px 8px', width: 32 }}>
                                {w.bookingId && <button onClick={() => showToast('info', 'View Booking', `Opening ${w.bookingId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><ExternalLink size={12} /></button>}
                              </td>
                            </tr>
                          )
                        })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Coupons Tab ── */}
          {activeTab === 'coupons' && (
            <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>All Coupons</span>
                <button onClick={() => showToast('success', 'Issue Coupon', 'Coupon issuance dialog would open here.')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', fontSize: 12, fontWeight: 600, color: '#1664FF', border: '1px solid #BFDBFE', borderRadius: 6, background: '#EEF4FF', cursor: 'pointer' }}>
                  <Plus size={12} /> Issue Coupon
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <RcTableHeader cols={['Code', 'Coupon Name', 'Campaign', 'Discount', 'Min. Spend', 'Issue Date', 'Expiry', 'Status', 'Redeemed']} />
                <tbody>
                  {data.coupons.length === 0
                    ? <RcEmptyRow cols={9} label="No coupons found" />
                    : data.coupons.map(c => {
                        const s = COUPON_STATUS_STYLE[c.status]
                        return (
                          <tr key={c.code} style={{ borderBottom: '1px solid #F8FAFC' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1A2332' }}>{c.code}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#1A2332' }}>{c.name}</td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748B' }}>{c.campaign}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#1A2332', whiteSpace: 'nowrap' }}>
                              {c.discountType === 'percent' ? `${c.discountValue}% off` : `MMK ${c.discountValue.toLocaleString()} off`}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              {c.minSpend === 0 ? 'No min.' : 'MMK ' + c.minSpend.toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>{c.issueDate}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: c.status === 'available' ? '#D97706' : '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.expiry}</td>
                            <td style={{ padding: '10px 14px' }}><RcStatusBadge {...s} /></td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
                              {c.redemptionDate ? <><div>{c.redemptionDate}</div>{c.bookingId && <div style={{ color: '#1664FF', marginTop: 1 }}>{c.bookingId}</div>}</> : <span style={{ color: '#E3E8F0' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 8px', width: 32 }}>
                              {c.status === 'available' && (
                                <button onClick={() => showToast('warning', 'Revoke Coupon', `Coupon ${c.code} revoked.`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }} title="Revoke"><XCircle size={13} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            </div>
          )}

          {/* ── Vouchers Tab ── */}
          {activeTab === 'vouchers' && (
            <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>All Vouchers</span>
                <button onClick={() => showToast('success', 'Issue Voucher', 'Voucher issuance dialog would open here.')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', fontSize: 12, fontWeight: 600, color: '#6366F1', border: '1px solid #C7D2FE', borderRadius: 6, background: '#EEF2FF', cursor: 'pointer' }}>
                  <Plus size={12} /> Issue Voucher
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <RcTableHeader cols={['Voucher ID', 'Voucher Name', 'Campaign', 'Value', 'Issue Date', 'Expiry', 'Status', 'Redeemed']} />
                <tbody>
                  {data.vouchers.length === 0
                    ? <RcEmptyRow cols={8} label="No vouchers found" />
                    : data.vouchers.map(v => {
                        const s = VOUCHER_STATUS_STYLE[v.status]
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid #F8FAFC' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#1A2332' }}>{v.id}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#1A2332' }}>{v.name}</td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748B' }}>{v.campaign}</td>
                            <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#6366F1', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>MMK {v.value.toLocaleString()}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>{v.issueDate}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: v.status === 'available' ? '#D97706' : '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{v.expiry}</td>
                            <td style={{ padding: '10px 14px' }}><RcStatusBadge {...s} /></td>
                            <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
                              {v.redemptionDate ? <><div>{v.redemptionDate}</div>{v.bookingId && <div style={{ color: '#1664FF', marginTop: 1 }}>{v.bookingId}</div>}</> : <span style={{ color: '#E3E8F0' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 8px', width: 32 }}>
                              {v.status === 'available' && (
                                <button onClick={() => showToast('warning', 'Revoke Voucher', `Voucher ${v.id} revoked.`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }} title="Revoke"><XCircle size={13} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            </div>
          )}

          {/* ── Membership Tab ── */}
          {activeTab === 'membership' && (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
              {/* Current tier + progress */}
              <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 16 }}>Current Membership Tier</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: tierS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={24} fill={tierColor} color={tierColor} />
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: tierColor }}>{tier}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Member since {selectedUser.registeredAt}</div>
                  </div>
                </div>
                {threshold.next && threshold.nextSpend && (
                  <>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
                      Progress to <strong style={{ color: tierColor }}>{threshold.next}</strong>
                    </div>
                    <div style={{ height: 8, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ width: `${spendPct}%`, height: '100%', background: tierColor, borderRadius: 99, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
                      <span>MMK {fmtSpend(spending)} spent</span>
                      <span>MMK {fmtSpend(threshold.nextSpend - spending)} more needed</span>
                    </div>
                  </>
                )}
                {!threshold.next && (
                  <div style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>Highest tier — Maximum benefits unlocked</div>
                )}
                <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Lifetime Spending</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>MMK {fmtSpend(selectedUser.totalSpending)}</div>
                  </div>
                  <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Completed Bookings</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{selectedUser.totalBookings}</div>
                  </div>
                </div>
              </div>
              {/* Benefits */}
              <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 16 }}>Tier Benefits</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {TIER_BENEFITS[tier].map(b => (
                    <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#F8FAFC' }}>
                      <span style={{ fontSize: 12, color: '#64748B' }}>{b.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: b.value === 'Yes' || b.value === 'Always' ? '#059669' : b.value === 'No' ? '#94A3B8' : b.value.includes('×') ? tierColor : '#1A2332' }}>{b.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Tier upgrade history */}
              <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, padding: 20, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 16 }}>Tier Upgrade History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.history.filter(h => h.type === 'tier_upgrade').length === 0
                    ? <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8', fontSize: 13 }}>No tier upgrades recorded</div>
                    : data.history.filter(h => h.type === 'tier_upgrade').map(h => (
                        <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
                          <Star size={18} fill="#B45309" color="#B45309" />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{h.title}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{h.date} {h.note && '· ' + h.note}</div>
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── History Tab ── */}
          {activeTab === 'history' && (
            <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Reward History Timeline</div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {data.history.map((h, i) => {
                  const cfg = HISTORY_CFG[h.type]
                  const isLast = i === data.history.length - 1
                  return (
                    <div key={h.id} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 16, position: 'relative' }}>
                      {!isLast && <div style={{ position: 'absolute', left: 14, top: 32, bottom: 0, width: 1, background: '#F1F5F9', zIndex: 0 }} />}
                      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, marginTop: 2 }}>
                        <HistoryIcon type={h.type} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{h.title}</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{h.date}</span>
                              {h.bookingId && <Chip color="#1664FF" bg="#EEF4FF"><span style={{ fontFamily: 'monospace' }}>{h.bookingId}</span></Chip>}
                              {h.campaign && <Chip color="#F59E0B" bg="#FFFBEB">{h.campaign}</Chip>}
                              {h.admin && <Chip color="#D97706" bg="#FFF7ED">{h.admin}</Chip>}
                              {h.note && <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>{h.note}</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {h.points !== undefined && (
                              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: h.points >= 0 ? '#059669' : '#DC2626' }}>
                                {h.points >= 0 ? '+' : ''}{h.points.toLocaleString()} pts
                              </div>
                            )}
                            {h.value !== undefined && (
                              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#6366F1' }}>
                                MMK {h.value.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                        {!isLast && <div style={{ height: 1, background: 'transparent', marginTop: 12 }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
      {/* Manual pts modal */}
      {manualPtsMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2332', marginBottom: 6 }}>
              {manualPtsMode === 'credit' ? 'Credit Points' : 'Deduct Points'}
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
              {manualPtsMode === 'credit' ? `Manually add reward points to ${selectedUser?.name}'s account.` : `Manually deduct reward points from ${selectedUser?.name}'s account.`}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Points</label>
              <input value={manualPts} onChange={e => setManualPts(e.target.value)} type="number" placeholder="e.g. 200"
                style={{ width: '100%', height: 40, border: '1.5px solid #E3E8F0', borderRadius: 8, padding: '0 12px', fontSize: 14, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Reason</label>
              <input value={manualReason} onChange={e => setManualReason(e.target.value)} placeholder="e.g. Compensation for service failure"
                style={{ width: '100%', height: 40, border: '1.5px solid #E3E8F0', borderRadius: 8, padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setManualPtsMode(null); setManualPts(''); setManualReason('') }}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #E3E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => {
                  if (!manualPts || !manualReason) { showToast('warning', 'Validation', 'Please enter points and a reason.'); return }
                  showToast('success', manualPtsMode === 'credit' ? 'Points Credited' : 'Points Deducted', `${manualPts} pts ${manualPtsMode === 'credit' ? 'credited to' : 'deducted from'} ${selectedUser?.name}.`)
                  setManualPtsMode(null); setManualPts(''); setManualReason('')
                }}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: manualPtsMode === 'credit' ? '#059669' : '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {manualPtsMode === 'credit' ? 'Credit Points' : 'Deduct Points'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 6. User Support ───────────────────────────────────────────────────────────

interface SupportTicket {
  id: string; subject: string; category: string; status: TicketStatus
  created: string; updated: string; assignee: string; priority: 'high' | 'normal' | 'low'
  messages: number; description?: string; bookingId?: string; transactionId?: string; internalNote?: string
}

const ZN_TICKETS_INIT: SupportTicket[] = [
  { id: 'TKT-4421', subject: 'Refund not received for BKG-7501', category: 'Refund', status: 'in-progress', created: '2024-08-18', updated: '2024-12-10', assignee: 'Agent Sarah', priority: 'high', messages: 6, bookingId: 'BKG-7501', description: 'Customer cancelled booking BKG-7501 on Aug 15 and expected full refund within 5 business days. Refund not received as of Aug 18. Customer is requesting urgent follow-up.' },
  { id: 'TKT-4180', subject: 'Cannot apply coupon GOLD50K at checkout', category: 'Payment', status: 'open', created: '2024-12-11', updated: '2024-12-11', assignee: 'Unassigned', priority: 'normal', messages: 1, description: 'Customer reports that coupon GOLD50K shows as valid but fails to apply when proceeding to payment. Booking value meets minimum spend requirement.' },
  { id: 'TKT-3995', subject: 'Booking confirmation email not received', category: 'Booking', status: 'resolved', created: '2024-11-05', updated: '2024-11-06', assignee: 'Agent Lin', priority: 'normal', messages: 4, bookingId: 'BKG-9344', description: 'Customer did not receive email confirmation after completing booking BKG-9344 for Chatrium Riverside Hotel. Booking appeared in app but no email.' },
  { id: 'TKT-3740', subject: 'Room type mismatch on arrival at Novotel Inle Lake', category: 'Complaint', status: 'closed', created: '2024-10-06', updated: '2024-10-10', assignee: 'Agent Phyo', priority: 'high', messages: 9, bookingId: 'BKG-8860', description: 'Customer booked Lake View Room but was assigned a Garden View room on arrival. Hotel acknowledged error. Partial compensation agreed.' },
  { id: 'TKT-3210', subject: 'Reward points not credited after Chatrium stay', category: 'Rewards', status: 'resolved', created: '2024-11-11', updated: '2024-11-12', assignee: 'Agent Sarah', priority: 'low', messages: 3, bookingId: 'BKG-9344', description: 'Reward points for completed booking BKG-9344 were not automatically credited within 24 hours. Agent manually credited 380 points after investigation.' },
]

const USER_TICKETS_DB: Record<string, SupportTicket[]> = {
  'USR-042': ZN_TICKETS_INIT,
}

function getUserTickets(userId: string): SupportTicket[] {
  return USER_TICKETS_DB[userId] ?? [
    { id: 'TKT-0001', subject: 'General inquiry', category: 'General', status: 'resolved', created: '2024-10-01', updated: '2024-10-02', assignee: 'Agent Lin', priority: 'low', messages: 2 },
  ]
}

const SUPPORT_CATEGORIES = ['Booking', 'Payment', 'Refund', 'Rewards', 'Account', 'Complaint', 'Technical', 'General']
const AGENTS = ['Agent Sarah', 'Agent Lin', 'Agent Phyo', 'Agent Kyaw', 'Agent Thida', 'Unassigned']
const priorityColor = { high: '#DC2626', normal: '#D97706', low: '#059669' }
const priorityBg    = { high: '#FEF2F2', normal: '#FFFBEB', low: '#F0FDF4' }

interface TicketForm {
  subject: string; category: string; priority: 'high' | 'normal' | 'low'
  description: string; bookingId: string; transactionId: string; rewardRef: string
  assignee: string; internalNote: string
}
const BLANK_FORM: TicketForm = { subject: '', category: 'Booking', priority: 'normal', description: '', bookingId: '', transactionId: '', rewardRef: '', assignee: 'Unassigned', internalNote: '' }

function CreateTicketDrawer({ open, user, onClose, onCreate, showToast }: {
  open: boolean; user: EndUser; onClose: () => void
  onCreate: (t: SupportTicket) => void
  showToast: Props['showToast']
}) {
  const [form, setForm]   = useState<TicketForm>(BLANK_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof TicketForm, string>>>({})
  const [saving, setSaving] = useState(false)

  function setF<K extends keyof TicketForm>(k: K, v: TicketForm[K]) {
    setForm(p => ({ ...p, [k]: v }))
    if (errors[k]) setErrors(p => ({ ...p, [k]: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.subject.trim()) e.subject = 'Subject is required'
    if (!form.description.trim()) e.description = 'Description is required'
    return e
  }

  function handleCreate() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    setTimeout(() => {
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const id = `TKT-${Math.floor(4500 + Math.random() * 500)}`
      onCreate({
        id, subject: form.subject.trim(), category: form.category, status: 'open',
        created: dateStr, updated: dateStr, assignee: form.assignee,
        priority: form.priority, messages: 0,
        description: form.description.trim(),
        bookingId: form.bookingId.trim() || undefined,
        transactionId: form.transactionId.trim() || undefined,
        internalNote: form.internalNote.trim() || undefined,
      })
      setForm(BLANK_FORM); setErrors({}); setSaving(false)
    }, 400)
  }

  function handleDraft() {
    setForm(BLANK_FORM); setErrors({}); onClose()
  }

  const avBg   = AVATAR_COLORS[parseInt(user.id.replace('USR-', ''), 10) % AVATAR_COLORS.length]
  const tierS  = TIER_STYLE[user.tier]

  const Field = ({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{error}</div>}
    </div>
  )

  const inputStyle = (hasError?: string): React.CSSProperties => ({
    width: '100%', height: 38, border: `1.5px solid ${hasError ? '#FCA5A5' : '#E3E8F0'}`, borderRadius: 8, padding: '0 12px',
    fontSize: 13, color: '#1A2332', outline: 'none', background: hasError ? '#FFF5F5' : '#fff', boxSizing: 'border-box',
  })

  return (
    <Drawer open={open} onClose={onClose} title="Create Support Ticket" subtitle={`Opening ticket on behalf of ${user.name}`} width={540}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #E3E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleDraft} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #E3E8F0', background: '#F8FAFC', fontSize: 13, color: '#475569', cursor: 'pointer' }}>Save Draft</button>
          <button onClick={handleCreate} disabled={saving}
            style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: saving ? '#93C5FD' : '#1664FF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      }>
      <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
        {/* Pre-filled customer card */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E3E8F0', borderRadius: 10, padding: '12px 14px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {user.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>{user.name}</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', background: '#fff', padding: '1px 6px', borderRadius: 4, border: '1px solid #E3E8F0' }}>{user.id}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: tierS.bg, color: tierS.color, padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                <Star size={8} fill={tierS.color} /> {user.tier}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} color="#94A3B8" />{user.email}</span>
              <span style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} color="#94A3B8" />{user.phone}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', flexShrink: 0 }}>Pre-filled</div>
        </div>

        {/* Form */}
        <Field label="Subject" required error={errors.subject}>
          <input value={form.subject} onChange={e => setF('subject', e.target.value)}
            placeholder="Brief description of the issue" style={inputStyle(errors.subject)} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Category <span style={{ color: '#DC2626' }}>*</span></label>
            <select value={form.category} onChange={e => setF('category', e.target.value)}
              style={{ width: '100%', height: 38, border: '1.5px solid #E3E8F0', borderRadius: 8, padding: '0 12px', fontSize: 13, color: '#1A2332', outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
              {SUPPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Priority <span style={{ color: '#DC2626' }}>*</span></label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['high', 'normal', 'low'] as const).map(p => (
                <button key={p} onClick={() => setF('priority', p)}
                  style={{ flex: 1, height: 38, borderRadius: 8, border: `1.5px solid ${form.priority === p ? priorityColor[p] : '#E3E8F0'}`, background: form.priority === p ? priorityBg[p] : '#fff', color: form.priority === p ? priorityColor[p] : '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Field label="Description" required error={errors.description}>
          <textarea value={form.description} onChange={e => setF('description', e.target.value)}
            placeholder="Describe the issue in detail. Include what the customer reported, steps to reproduce, and any relevant context."
            rows={4}
            style={{ width: '100%', border: `1.5px solid ${errors.description ? '#FCA5A5' : '#E3E8F0'}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1A2332', outline: 'none', background: errors.description ? '#FFF5F5' : '#fff', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <Field label="Related Booking ID">
            <input value={form.bookingId} onChange={e => setF('bookingId', e.target.value)}
              placeholder="e.g. BKG-9912" style={inputStyle()} />
          </Field>
          <Field label="Related Transaction ID">
            <input value={form.transactionId} onChange={e => setF('transactionId', e.target.value)}
              placeholder="e.g. TXN-KBZ-20241210" style={inputStyle()} />
          </Field>
        </div>

        <Field label="Related Reward / Coupon (optional)">
          <input value={form.rewardRef} onChange={e => setF('rewardRef', e.target.value)}
            placeholder="e.g. GOLD50K, VOC-GOLD-Q4-2024" style={inputStyle()} />
        </Field>

        <Field label="Assign To">
          <select value={form.assignee} onChange={e => setF('assignee', e.target.value)}
            style={{ width: '100%', height: 38, border: '1.5px solid #E3E8F0', borderRadius: 8, padding: '0 12px', fontSize: 13, color: '#1A2332', outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
            {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>

        <Field label="Internal Note">
          <textarea value={form.internalNote} onChange={e => setF('internalNote', e.target.value)}
            placeholder="Internal notes — not visible to the customer"
            rows={3}
            style={{ width: '100%', border: '1.5px solid #E3E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1A2332', outline: 'none', background: '#FFFBEB', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }} />
        </Field>

        <div style={{ border: '2px dashed #E3E8F0', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', color: '#94A3B8', fontSize: 12 }}
          onClick={() => showToast('info', 'Attachment', 'File upload would open here.')}>
          <div style={{ marginBottom: 4, fontSize: 20 }}>📎</div>
          Click to attach files (screenshots, documents)
        </div>
      </div>
    </Drawer>
  )
}

function UserSupportPage({ showToast, user, onNotifSent }: { showToast: Props['showToast']; user: EndUser; onNotifSent?: (p: SentNotifPayload) => void }) {
  const [filterStatus, setFilterStatus] = useState('')
  const [createOpen, setCreateOpen]     = useState(false)
  const [notifOpen, setNotifOpen]       = useState(false)
  const [tickets, setTickets]           = useState<SupportTicket[]>(() => getUserTickets(user.id))

  const notifRecipient: NotifRecipient = {
    kind: 'user', id: user.id, name: user.name, email: user.email, phone: user.phone,
    tier: user.tier, avatar: user.avatar, avatarBg: user.tier === 'Platinum' ? '#7C3AED' : user.tier === 'Gold' ? '#D97706' : user.tier === 'Silver' ? '#475569' : '#92400E',
  }

  useEffect(() => { setTickets(getUserTickets(user.id)); setFilterStatus('') }, [user.id])

  const filtered = tickets.filter(t => !filterStatus || t.status === filterStatus)

  const kpis = [
    { label: 'Total Tickets', value: tickets.length,                                                               color: '#1664FF' },
    { label: 'Open',          value: tickets.filter(t => t.status === 'open').length,                              color: '#DC2626' },
    { label: 'In Progress',   value: tickets.filter(t => t.status === 'in-progress').length,                      color: '#1D4ED8' },
    { label: 'Resolved',      value: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length, color: '#059669' },
  ]

  function handleCreate(ticket: SupportTicket) {
    setTickets(prev => [ticket, ...prev])
    setCreateOpen(false)
    showToast('success', 'Ticket Created', `Support ticket ${ticket.id} created successfully for ${user.name}.`)
  }

  return (
    <>
      <CreateTicketDrawer open={createOpen} user={user} onClose={() => setCreateOpen(false)} onCreate={handleCreate} showToast={showToast} />
      <NotificationDrawer open={notifOpen} recipient={notifRecipient} onClose={() => setNotifOpen(false)} showToast={showToast} onSent={onNotifSent} />

      <div className="p-6" style={{ minWidth: 1060 }}>
        {/* Page header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>Support Tickets</h2>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Customer support history and active issues for {user.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => showToast('info', 'Export', `Support history for ${user.name} exported.`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
              <Download size={12} /> Export
            </button>
            <button onClick={() => setNotifOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 12, color: '#6366F1', border: '1px solid #C7D2FE', borderRadius: 8, background: '#EEF2FF', cursor: 'pointer', fontWeight: 500 }}>
              <Bell size={12} /> Send Notification
            </button>
            <button onClick={() => setCreateOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 12, fontWeight: 600, background: '#1664FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              <Plus size={12} /> Create Ticket
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontFamily: 'monospace', marginBottom: 4 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {(['', 'open', 'in-progress', 'resolved', 'closed'] as const).map(s => {
            const labels: Record<string, string> = { '': 'All', 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved', 'closed': 'Closed' }
            const active = filterStatus === s
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px', borderRadius: 20, border: '1px solid transparent', fontSize: 12, fontWeight: active ? 600 : 400, background: active ? '#1A2332' : '#F1F5F9', color: active ? '#fff' : '#475569', cursor: 'pointer' }}>
                {labels[s]}
                <span style={{ marginLeft: 5, fontSize: 10, fontFamily: 'monospace', opacity: 0.7 }}>
                  {s === '' ? tickets.length : tickets.filter(t => t.status === s).length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Ticket table */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Ticket ID', 'Subject', 'Category', 'Priority', 'Created', 'Last Update', 'Assigned Staff', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                    No {filterStatus ? filterStatus : ''} tickets found for {user.name}
                  </td>
                </tr>
              ) : filtered.map((t, i) => {
                const ts = TICKET_STYLE[t.status]
                return (
                  <tr key={t.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 54, fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.id}</td>
                    <td className="px-3" style={{ maxWidth: 280 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{t.messages} messages</span>
                        {t.bookingId && <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#1664FF', background: '#EEF4FF', padding: '1px 5px', borderRadius: 4 }}>{t.bookingId}</span>}
                      </div>
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{t.category}</td>
                    <td className="px-3">
                      <span style={{ fontSize: 11, color: priorityColor[t.priority], background: priorityBg[t.priority], padding: '2px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'capitalize' }}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{t.created}</td>
                    <td className="px-3" style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{t.updated}</td>
                    <td className="px-3" style={{ fontSize: 12, color: '#1A2332', whiteSpace: 'nowrap' }}>{t.assignee}</td>
                    <td className="px-3">
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, background: ts.bg, color: ts.color, whiteSpace: 'nowrap' }}>{ts.label}</span>
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-0.5">
                        <ActionBtn color="#1664FF" onClick={() => showToast('info', 'Ticket Detail', `Opening ${t.id} — ${t.subject}`)} title="View Ticket"><Eye size={12} /></ActionBtn>
                        {(t.status === 'open' || t.status === 'in-progress') && (
                          <ActionBtn color="#059669" onClick={() => {
                            setTickets(prev => prev.map(x => x.id === t.id ? { ...x, status: 'resolved' as TicketStatus, updated: new Date().toISOString().slice(0,10) } : x))
                            showToast('success', 'Ticket Resolved', `${t.id} marked as resolved.`)
                          }} title="Mark Resolved"><CheckCircle size={12} /></ActionBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── 7. Suspended Users ────────────────────────────────────────────────────────

interface SuspendedUser extends EndUser {
  suspendedAt: string; suspensionReason: string; suspensionDuration: string; suspendedBy: string
}

const SUSPENDED_USERS: SuspendedUser[] = USERS.filter(u => u.status === 'suspended').map(u => ({
  ...u,
  suspendedAt: '2024-11-28',
  suspensionReason: u.id === 'USR-005' ? 'Multiple failed payment attempts — potential card fraud' : 'Suspicious account activity detected by fraud system',
  suspensionDuration: '30 days',
  suspendedBy: 'System (Auto)',
}))

function SuspendedUsersPage({ showToast }: { showToast: Props['showToast'] }) {
  const [users, setUsers] = useState(SUSPENDED_USERS)

  function handleReactivate(u: SuspendedUser) {
    setUsers(prev => prev.filter(x => x.id !== u.id))
    showToast('success', 'Account Reactivated', `${u.name} can now log in again.`)
  }

  const kpis = [
    { label: 'Currently Suspended', value: users.length,    color: '#DC2626' },
    { label: 'Auto-suspended',      value: users.filter(u => u.suspendedBy.includes('System')).length, color: '#D97706', sub: 'By fraud detection' },
    { label: 'Avg. Suspension',     value: '30 days',       color: '#64748B' },
    { label: 'Resolved This Month', value: 4,               color: '#059669' },
  ]

  return (
    <PageShell title="Suspended Users" subtitle="Accounts currently under suspension — review reasons and take recovery actions" kpis={kpis}
      actions={
        <button onClick={() => showToast('info', 'Export', 'Suspended users list exported.')}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
          <Download size={13} /> Export
        </button>
      }>

      {users.length === 0 ? (
        <div className="rounded-lg flex flex-col items-center justify-center py-20" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <CheckCircle size={40} color="#A7F3D0" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2332' }}>No suspended users</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>All accounts are in good standing.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => {
            const avIdx = AVATARS.indexOf(u.avatar)
            const avColor = AVATAR_COLORS[avIdx % AVATAR_COLORS.length]
            return (
              <div key={u.id} className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #FECDD3' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ width: 40, height: 40, background: avColor, fontSize: 13 }}>{u.avatar}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{u.name}</span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{u.id}</span>
                        <TierBadge tier={u.tier} />
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{u.email} · {u.phone}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleReactivate(u)}
                      className="flex items-center gap-1.5 rounded-md px-3 font-medium"
                      style={{ height: 32, fontSize: 12, color: '#059669', border: '1px solid #A7F3D0', background: '#ECFDF3' }}>
                      <UserCheck size={12} /> Reactivate
                    </button>
                    <button onClick={() => showToast('info', 'Suspension Extended', `${u.name} extended by 30 days.`)}
                      className="flex items-center gap-1.5 rounded-md px-3 font-medium"
                      style={{ height: 32, fontSize: 12, color: '#D97706', border: '1px solid #FDE68A', background: '#FFFBEB' }}>
                      <Clock size={12} /> Extend
                    </button>
                    <button onClick={() => showToast('warning', 'Moved to Blacklist', `${u.name} has been blacklisted.`)}
                      className="flex items-center gap-1.5 rounded-md px-3 font-medium"
                      style={{ height: 32, fontSize: 12, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
                      <ShieldOff size={12} /> Blacklist
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg p-3" style={{ background: '#FFF1F3', border: '1px solid #FECDD3' }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Suspension Reason</div>
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{u.suspensionReason}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Suspended: <strong style={{ color: '#64748B' }}>{u.suspendedAt}</strong></span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Duration: <strong style={{ color: '#64748B' }}>{u.suspensionDuration}</strong></span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>By: <strong style={{ color: '#64748B' }}>{u.suspendedBy}</strong></span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}

// ── 8. Blacklist ──────────────────────────────────────────────────────────────

interface BlacklistEntry extends EndUser {
  blacklistedAt: string; blacklistReason: string; blacklistedBy: string; evidence: string
}

const BLACKLIST: BlacklistEntry[] = USERS.filter(u => u.status === 'blacklisted').map(u => ({
  ...u,
  blacklistedAt: '2024-06-21',
  blacklistReason: 'Fraudulent booking with stolen credit card — confirmed by payment processor. Multiple accounts detected.',
  blacklistedBy: 'Admin Chen (Manual Review)',
  evidence: 'Chargeback #CB-20240621-441, Device fingerprint match with USR-990 (previously banned)',
}))

function BlacklistPage({ showToast }: { showToast: Props['showToast'] }) {
  const [entries, setEntries] = useState(BLACKLIST)

  function handleRemove(e: BlacklistEntry) {
    setEntries(prev => prev.filter(x => x.id !== e.id))
    showToast('success', 'Removed from Blacklist', `${e.name} has been removed and account set to inactive.`)
  }

  const kpis = [
    { label: 'Blacklisted Users', value: entries.length,   color: '#DC2626' },
    { label: 'Manual Reviews',    value: entries.filter(e => e.blacklistedBy.includes('Admin')).length, color: '#D97706', sub: 'Admin-initiated' },
    { label: 'Total Prevented Loss', value: '8.4M MMK',    color: '#059669', sub: 'Est. fraud prevented' },
    { label: 'Avg. Days on List',  value: 184,             color: '#64748B' },
  ]

  return (
    <PageShell title="Blacklist" subtitle="Permanently blocked users — review evidence and manage blacklist entries" kpis={kpis}
      actions={<>
        <button onClick={() => showToast('info', 'Export', 'Blacklist exported.')}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
          <Download size={13} /> Export
        </button>
        <button onClick={() => showToast('info', 'Add to Blacklist', 'Search for user to blacklist.')}
          className="flex items-center gap-1.5 rounded-md px-3 font-medium"
          style={{ height: 34, fontSize: 13, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
          <ShieldOff size={13} /> Add to Blacklist
        </button>
      </>}>

      {entries.length === 0 ? (
        <div className="rounded-lg flex flex-col items-center justify-center py-20" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Shield size={40} color="#A7F3D0" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2332' }}>Blacklist is empty</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>No users are currently blacklisted.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            return (
              <div key={entry.id} className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #FECDD3' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 relative"
                      style={{ width: 40, height: 40, background: '#94A3B8', fontSize: 13 }}>
                      {entry.avatar}
                      <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, background: '#DC2626', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ShieldOff size={7} color="#fff" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{entry.name}</span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{entry.id}</span>
                        <span style={{ fontSize: 11, background: '#FFF1F3', color: '#C01048', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Blacklisted</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{entry.email} · {entry.phone} · {entry.country}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => showToast('info', 'Evidence Report', `Opening evidence for ${entry.id}.`)}
                      className="flex items-center gap-1.5 rounded-md px-3 font-medium"
                      style={{ height: 32, fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
                      <Eye size={12} /> View Evidence
                    </button>
                    <button onClick={() => handleRemove(entry)}
                      className="flex items-center gap-1.5 rounded-md px-3 font-medium"
                      style={{ height: 32, fontSize: 12, color: '#059669', border: '1px solid #A7F3D0', background: '#ECFDF3' }}>
                      <RotateCcw size={12} /> Remove
                    </button>
                  </div>
                </div>

                <div className="mt-3 rounded-lg p-3" style={{ background: '#FFF1F3', border: '1px solid #FECDD3' }}>
                  <div className="flex items-start gap-2 mb-2">
                    <XCircle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Blacklist Reason</div>
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{entry.blacklistReason}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#D97706' }}>Evidence</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{entry.evidence}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Added: <strong style={{ color: '#64748B' }}>{entry.blacklistedAt}</strong></span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>By: <strong style={{ color: '#64748B' }}>{entry.blacklistedBy}</strong></span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Total Bookings: <strong style={{ color: '#64748B' }}>{entry.totalBookings}</strong></span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Spending on record: <strong style={{ color: '#64748B' }}>{entry.totalSpending.toLocaleString()} MMK</strong></span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}

// ── 8. Notification History ───────────────────────────────────────────────────

type NotifType = 'booking' | 'promotion' | 'wallet' | 'account' | 'rewards' | 'support' | 'system'
type NotifChannel = 'push' | 'email' | 'sms'
type NotifDeliveryStatus = 'delivered' | 'pending' | 'failed'
type NotifReadStatus = 'read' | 'unread' | 'n/a'

interface NotifRecord {
  id: string
  type: NotifType
  title: string
  message: string
  channels: NotifChannel[]
  deliveryStatus: NotifDeliveryStatus
  readStatus: NotifReadStatus
  sentAt: string
  readAt?: string
  sentBy: 'System' | 'Admin'
  relatedBookingId?: string
  deepLink?: string
}

const NOTIF_TYPE_CFG: Record<NotifType, { label: string; color: string; bg: string; icon: React.ReactNode; bigIcon: React.ReactNode }> = {
  booking:   { label: 'Booking',   color: '#1664FF', bg: '#EEF4FF', icon: <CalendarCheck size={11} />, bigIcon: <CalendarCheck size={18} /> },
  promotion: { label: 'Promotion', color: '#D97706', bg: '#FFFBEB', icon: <Tag size={11} />,           bigIcon: <Tag size={18} /> },
  wallet:    { label: 'Wallet',    color: '#7C3AED', bg: '#EDE9FE', icon: <CreditCard size={11} />,    bigIcon: <CreditCard size={18} /> },
  account:   { label: 'Account',   color: '#0E7490', bg: '#ECFEFF', icon: <Shield size={11} />,        bigIcon: <Shield size={18} /> },
  rewards:   { label: 'Rewards',   color: '#F59E0B', bg: '#FEF3C7', icon: <Gift size={11} />,          bigIcon: <Gift size={18} /> },
  support:   { label: 'Support',   color: '#475569', bg: '#F1F5F9', icon: <MessageCircle size={11} />, bigIcon: <MessageCircle size={18} /> },
  system:    { label: 'System',    color: '#DC2626', bg: '#FFF1F3', icon: <Activity size={11} />,      bigIcon: <Activity size={18} /> },
}

const DELIVERY_CFG: Record<NotifDeliveryStatus, { label: string; color: string; bg: string; border: string }> = {
  delivered: { label: 'Delivered', color: '#027A48', bg: '#ECFDF3', border: '#A7F3D0' },
  pending:   { label: 'Pending',   color: '#B54708', bg: '#FFFBEB', border: '#FDE68A' },
  failed:    { label: 'Failed',    color: '#C01048', bg: '#FFF1F3', border: '#FECDD3' },
}

const READ_CFG: Record<NotifReadStatus, { label: string; color: string; bg: string; border: string }> = {
  read:   { label: 'Read',   color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE' },
  unread: { label: 'Unread', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' },
  'n/a':  { label: 'N/A',    color: '#94A3B8', bg: '#F8FAFC', border: '#E3E8F0' },
}

const CHANNEL_ICON: Record<NotifChannel, React.ReactNode> = {
  push:  <Bell size={9} />,
  email: <Mail size={9} />,
  sms:   <Phone size={9} />,
}

const NOTIF_DATA: NotifRecord[] = [
  {
    id: 'NTF-20241213-001', type: 'booking', title: 'Booking Confirmed',
    message: 'Your booking BKG-2024-0891 at Grand Yangon Hotel for 3 nights has been confirmed. Check-in: Dec 15, 2024. Check-out: Dec 18, 2024. Total amount: 450,000 MMK.',
    channels: ['push', 'email'], deliveryStatus: 'delivered', readStatus: 'read',
    sentAt: '2024-12-13 09:14', readAt: '2024-12-13 09:17', sentBy: 'System',
    relatedBookingId: 'BKG-2024-0891', deepLink: '/bookings/BKG-2024-0891',
  },
  {
    id: 'NTF-20241211-002', type: 'booking', title: 'Booking Cancelled',
    message: 'Your booking BKG-2024-0887 at Mandalay Palace Hotel has been cancelled. A refund of 280,000 MMK will be processed within 3–5 business days.',
    channels: ['push', 'email', 'sms'], deliveryStatus: 'delivered', readStatus: 'read',
    sentAt: '2024-12-11 14:30', readAt: '2024-12-11 14:45', sentBy: 'System',
    relatedBookingId: 'BKG-2024-0887', deepLink: '/bookings/BKG-2024-0887',
  },
  {
    id: 'NTF-20241212-003', type: 'wallet', title: 'Refund Completed',
    message: 'Your refund of 280,000 MMK for booking BKG-2024-0887 has been successfully processed and returned to your original payment method.',
    channels: ['push', 'email'], deliveryStatus: 'delivered', readStatus: 'read',
    sentAt: '2024-12-12 10:05', readAt: '2024-12-12 10:22', sentBy: 'System',
    relatedBookingId: 'BKG-2024-0887',
  },
  {
    id: 'NTF-20241210-004', type: 'promotion', title: 'Exclusive Promotion Available',
    message: 'Special offer for Gold members! Get 20% off your next hotel booking. Use code GOLD20 at checkout. Valid until Dec 31, 2024.',
    channels: ['push'], deliveryStatus: 'delivered', readStatus: 'unread',
    sentAt: '2024-12-10 08:00', sentBy: 'Admin', deepLink: '/promotions/GOLD20',
  },
  {
    id: 'NTF-20241208-005', type: 'promotion', title: 'Long Stay Deal – 5+ Nights',
    message: 'Book 5 nights or more at any partner hotel and receive a complimentary room upgrade. Limited time offer. Book now and save up to 15% on your stay.',
    channels: ['email'], deliveryStatus: 'delivered', readStatus: 'read',
    sentAt: '2024-12-08 12:00', readAt: '2024-12-08 18:34', sentBy: 'Admin',
  },
  {
    id: 'NTF-20241205-006', type: 'account', title: 'Password Changed Successfully',
    message: 'Your mTrip account password was changed on Dec 5, 2024 at 14:44 from Bangkok, Thailand. If you did not make this change, contact support immediately.',
    channels: ['email', 'sms'], deliveryStatus: 'delivered', readStatus: 'read',
    sentAt: '2024-12-05 14:44', readAt: '2024-12-05 14:46', sentBy: 'System',
  },
  {
    id: 'NTF-20241205-007', type: 'account', title: 'OTP Verification Code',
    message: 'Your mTrip one-time verification code is 847291. This code expires in 5 minutes. Never share this code with anyone.',
    channels: ['sms'], deliveryStatus: 'delivered', readStatus: 'read',
    sentAt: '2024-12-05 14:43', readAt: '2024-12-05 14:44', sentBy: 'System',
  },
  {
    id: 'NTF-20241213-008', type: 'rewards', title: 'Reward Points Earned',
    message: 'Congratulations! You have earned 4,500 reward points from your completed booking BKG-2024-0891. Your new total is 23,450 points. Keep booking to reach Platinum tier!',
    channels: ['push'], deliveryStatus: 'delivered', readStatus: 'read',
    sentAt: '2024-12-13 10:00', readAt: '2024-12-13 10:05', sentBy: 'System',
    relatedBookingId: 'BKG-2024-0891',
  },
  {
    id: 'NTF-20241209-009', type: 'support', title: 'Support Ticket Update',
    message: 'Your support ticket #SUP-2024-0412 regarding your booking cancellation has been updated. An agent has been assigned and will respond within 24 hours.',
    channels: ['email', 'push'], deliveryStatus: 'pending', readStatus: 'unread',
    sentAt: '2024-12-09 16:00', sentBy: 'System',
  },
  {
    id: 'NTF-20241207-010', type: 'system', title: 'Scheduled Maintenance Notice',
    message: 'mTrip services will be briefly unavailable on Dec 8, 2024 from 02:00 – 04:00 AM (MMT) for scheduled maintenance. We apologize for any inconvenience.',
    channels: ['push', 'email'], deliveryStatus: 'failed', readStatus: 'n/a',
    sentAt: '2024-12-07 20:00', sentBy: 'Admin',
  },
]

function NotifTypeBadge({ type }: { type: NotifType }) {
  const c = NOTIF_TYPE_CFG[type]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color }}>
      {c.icon} {c.label}
    </span>
  )
}

function DeliveryBadge({ status }: { status: NotifDeliveryStatus }) {
  const c = DELIVERY_CFG[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status === 'delivered' && <CheckCircle size={9} style={{ marginRight: 3 }} />}
      {status === 'pending'   && <Clock size={9} style={{ marginRight: 3 }} />}
      {status === 'failed'    && <AlertTriangle size={9} style={{ marginRight: 3 }} />}
      {c.label}
    </span>
  )
}

function ReadBadge({ status }: { status: NotifReadStatus }) {
  const c = READ_CFG[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status === 'read'   && <Eye size={9} style={{ marginRight: 3 }} />}
      {status === 'unread' && <BellOff size={9} style={{ marginRight: 3 }} />}
      {c.label}
    </span>
  )
}

function ChannelPills({ channels }: { channels: NotifChannel[] }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {channels.map(ch => (
        <span key={ch} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 18, padding: '0 6px', borderRadius: 3, fontSize: 10, fontWeight: 500, background: '#F1F5F9', color: '#475569', border: '1px solid #E3E8F0', textTransform: 'capitalize' }}>
          {CHANNEL_ICON[ch]} {ch}
        </span>
      ))}
    </div>
  )
}

function NotifDetailDrawer({ notif, onClose }: { notif: NotifRecord; onClose: () => void }) {
  const tc = NOTIF_TYPE_CFG[notif.type]

  const timelineSteps: { label: string; time?: string; done: boolean; icon: React.ReactNode }[] = [
    { label: 'Created',   time: notif.sentAt,          done: true,  icon: <Plus size={10} /> },
    { label: 'Queued',    time: notif.sentAt,          done: true,  icon: <Clock size={10} /> },
    { label: 'Sent',      time: notif.sentAt,          done: notif.deliveryStatus !== 'failed', icon: <Send size={10} /> },
    { label: 'Delivered', time: notif.deliveryStatus === 'delivered' ? notif.sentAt : undefined, done: notif.deliveryStatus === 'delivered', icon: <CheckCircle size={10} /> },
    { label: 'Read',      time: notif.readAt,          done: notif.readStatus === 'read', icon: <Eye size={10} /> },
  ]

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Notification ID',  value: <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#1664FF' }}>{notif.id}</span> },
    { label: 'Type',             value: <NotifTypeBadge type={notif.type} /> },
    { label: 'Sent By',          value: notif.sentBy },
    { label: 'Sent Time',        value: <span style={{ fontFamily: 'monospace' }}>{notif.sentAt}</span> },
    { label: 'Channel',          value: <ChannelPills channels={notif.channels} /> },
    { label: 'Delivery Status',  value: <DeliveryBadge status={notif.deliveryStatus} /> },
    { label: 'Read Status',      value: <ReadBadge status={notif.readStatus} /> },
    { label: 'Read Time',        value: notif.readAt ? <span style={{ fontFamily: 'monospace' }}>{notif.readAt}</span> : <span style={{ color: '#94A3B8' }}>—</span> },
    { label: 'Related Booking',  value: notif.relatedBookingId ? <span style={{ fontFamily: 'monospace', color: '#1664FF' }}>{notif.relatedBookingId}</span> : <span style={{ color: '#94A3B8' }}>—</span> },
    { label: 'Deep Link',        value: notif.deepLink ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#1664FF', fontSize: 12 }}><ExternalLink size={10} />{notif.deepLink}</span> : <span style={{ color: '#94A3B8' }}>—</span> },
  ]

  return (
    <Drawer open onClose={onClose} title="Notification Detail" subtitle={notif.id} width={520}>
      {/* Type + title header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, background: tc.bg, border: `1px solid ${tc.color}22`, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${tc.color}33` }}>
          <span style={{ color: tc.color }}>{tc.bigIcon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332', marginBottom: 2 }}>{notif.title}</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{notif.sentAt} · <NotifTypeBadge type={notif.type} /></div>
        </div>
      </div>

      {/* Full message */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Message</div>
        <div style={{ fontSize: 13, color: '#1A2332', lineHeight: 1.7, padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E3E8F0' }}>
          {notif.message}
        </div>
      </div>

      {/* Detail fields */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Details</div>
        <div style={{ border: '1px solid #E3E8F0', borderRadius: 8, overflow: 'hidden' }}>
          {fields.map((f, i) => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', borderBottom: i < fields.length - 1 ? '1px solid #F1F5F9' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, width: 130, flexShrink: 0 }}>{f.label}</div>
              <div style={{ fontSize: 12, color: '#1A2332', fontWeight: 500, flex: 1 }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery timeline */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Delivery Timeline</div>
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: 10, top: 10, bottom: 10, width: 2, background: '#E3E8F0', borderRadius: 1 }} />
          {timelineSteps.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < timelineSteps.length - 1 ? 20 : 0, position: 'relative' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: step.done ? (notif.deliveryStatus === 'failed' && step.label === 'Sent' ? '#FFF1F3' : step.done ? '#ECFDF3' : '#F1F5F9') : '#F1F5F9',
                border: `2px solid ${step.done ? (notif.deliveryStatus === 'failed' && step.label === 'Sent' ? '#FECDD3' : '#A7F3D0') : '#E3E8F0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: step.done ? (notif.deliveryStatus === 'failed' && step.label === 'Sent' ? '#C01048' : '#059669') : '#CBD5E1',
                zIndex: 1, position: 'relative',
              }}>
                {step.icon}
              </div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: step.done ? '#1A2332' : '#94A3B8' }}>{step.label}</div>
                {step.time && step.done && (
                  <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 1 }}>{step.time}</div>
                )}
                {!step.done && (
                  <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  )
}

function NotificationHistoryPage({ showToast, user, extraNotifs = [] }: { showToast: Props['showToast']; user: EndUser; extraNotifs?: NotifRecord[] }) {
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterDelivery, setFilterDelivery] = useState('')
  const [filterReadStatus, setFilterReadStatus] = useState('')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [page, setPage]               = useState(1)
  const [activeNotif, setActiveNotif] = useState<NotifRecord | null>(null)
  const perPage = 8

  const avIdx  = AVATARS.indexOf(user.avatar)
  const avColor = AVATAR_COLORS[avIdx % AVATAR_COLORS.length]
  const tierS  = TIER_STYLE[user.tier]
  const statusS = STATUS_STYLE[user.status]

  const hasFilters = !!(search || filterType || filterChannel || filterDelivery || filterReadStatus || dateFrom || dateTo)

  const allNotifs = [...extraNotifs, ...NOTIF_DATA]
  const filtered = allNotifs.filter(n => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.id.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && n.type !== filterType) return false
    if (filterChannel && !n.channels.includes(filterChannel as NotifChannel)) return false
    if (filterDelivery && n.deliveryStatus !== filterDelivery) return false
    if (filterReadStatus && n.readStatus !== filterReadStatus) return false
    return true
  })

  function clearFilters() {
    setSearch(''); setFilterType(''); setFilterChannel(''); setFilterDelivery(''); setFilterReadStatus(''); setDateFrom(''); setDateTo(''); setPage(1)
  }

  const total      = filtered.length
  const start      = (page - 1) * perPage
  const rows       = filtered.slice(start, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const kpis = [
    { label: 'Total',     value: allNotifs.length,                                               color: '#1664FF', bg: '#EEF4FF' },
    { label: 'Delivered', value: allNotifs.filter(n => n.deliveryStatus === 'delivered').length,  color: '#059669', bg: '#ECFDF3' },
    { label: 'Read',      value: allNotifs.filter(n => n.readStatus === 'read').length,           color: '#1664FF', bg: '#EEF4FF' },
    { label: 'Failed',    value: allNotifs.filter(n => n.deliveryStatus === 'failed').length,     color: '#DC2626', bg: '#FFF1F3' },
  ]

  const sel: React.CSSProperties = { fontSize: 12, color: '#1A2332', border: '1px solid #E3E8F0', borderRadius: 6, padding: '0 8px', height: 32, background: '#fff', outline: 'none', cursor: 'pointer' }

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer 360 — End User Management</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332', marginBottom: 2 }}>Notification History</h1>
          <p style={{ fontSize: 13, color: '#94A3B8' }}>View all notifications sent to this user across the platform.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => showToast('info', 'Refreshed', 'Notification history updated.')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #E3E8F0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => showToast('info', 'Export', 'Notification history exported.')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #E3E8F0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* User summary card */}
      <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Avatar */}
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: avColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
          {user.avatar}
        </div>
        {/* Identity */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{user.name}</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', background: '#F8FAFC', padding: '1px 7px', borderRadius: 4, border: '1px solid #E3E8F0' }}>{user.id}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: tierS.bg, color: tierS.color, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
              <Star size={8} fill={tierS.color} /> {user.tier}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusS.color }} />
              <span style={{ fontSize: 11, color: statusS.color, fontWeight: 500 }}>{statusS.label}</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Mail size={10} color="#94A3B8" />{user.email}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Phone size={10} color="#94A3B8" />{user.phone}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Globe size={10} color="#94A3B8" />{user.country}</span>
          </div>
        </div>
        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 8, padding: '8px 14px', textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, fontWeight: 500 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
        <button onClick={() => setFiltersOpen(f => !f)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: filtersOpen ? '1px solid #F1F5F9' : 'none' }}>
          <Filter size={13} color="#64748B" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Filters</span>
          {hasFilters && <span style={{ fontSize: 10, fontWeight: 700, background: '#1664FF', color: '#fff', padding: '1px 7px', borderRadius: 10 }}>Active</span>}
          <ChevronDown size={13} color="#94A3B8" style={{ marginLeft: 'auto', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {filtersOpen && (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
              {/* Search */}
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Search Title</div>
                <div style={{ position: 'relative' }}>
                  <Search size={12} color="#94A3B8" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search…"
                    style={{ ...sel, width: '100%', paddingLeft: 26, boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* Type */}
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Notification Type</div>
                <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }} style={{ ...sel, width: '100%' }}>
                  <option value="">All Types</option>
                  {(Object.entries(NOTIF_TYPE_CFG) as [NotifType, typeof NOTIF_TYPE_CFG[NotifType]][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              {/* Channel */}
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Channel</div>
                <select value={filterChannel} onChange={e => { setFilterChannel(e.target.value); setPage(1) }} style={{ ...sel, width: '100%' }}>
                  <option value="">All Channels</option>
                  <option value="push">Push</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              {/* Delivery Status */}
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Delivery Status</div>
                <select value={filterDelivery} onChange={e => { setFilterDelivery(e.target.value); setPage(1) }} style={{ ...sel, width: '100%' }}>
                  <option value="">All Statuses</option>
                  <option value="delivered">Delivered</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              {/* Read Status */}
              <div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Read Status</div>
                <select value={filterReadStatus} onChange={e => { setFilterReadStatus(e.target.value); setPage(1) }} style={{ ...sel, width: '100%' }}>
                  <option value="">All</option>
                  <option value="read">Read</option>
                  <option value="unread">Unread</option>
                  <option value="n/a">N/A</option>
                </select>
              </div>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={clearFilters} disabled={!hasFilters}
                  style={{ flex: 1, height: 32, borderRadius: 6, border: '1px solid #E3E8F0', background: '#fff', fontSize: 12, color: hasFilters ? '#475569' : '#CBD5E1', cursor: hasFilters ? 'pointer' : 'not-allowed', fontWeight: 500 }}>
                  Reset
                </button>
                <button onClick={() => setPage(1)}
                  style={{ flex: 1, height: 32, borderRadius: 6, border: 'none', background: '#1664FF', fontSize: 12, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
        {/* Table header with count */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1A2332' }}>Notification History</span>
          <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8', background: '#E3E8F0', padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>{total} records</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '52px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={22} color="#CBD5E1" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>No notifications found</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Try adjusting your filters or search query.</div>
            {hasFilters && <button onClick={clearFilters} style={{ fontSize: 12, color: '#1664FF', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear all filters</button>}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Date & Time', 'Notification ID', 'Type', 'Title', 'Channel', 'Delivery Status', 'Read Status', 'Related Booking', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#64748B', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((n, i) => (
                <tr key={n.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>{n.sentAt.split(' ')[0]}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{n.sentAt.split(' ')[1]}</div>
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1664FF', background: '#EEF4FF', padding: '2px 6px', borderRadius: 4 }}>{n.id}</span>
                  </td>
                  <td style={{ padding: '12px 12px' }}><NotifTypeBadge type={n.type} /></td>
                  <td style={{ padding: '12px 12px', maxWidth: 200 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{n.message.slice(0, 60)}…</div>
                  </td>
                  <td style={{ padding: '12px 12px' }}><ChannelPills channels={n.channels} /></td>
                  <td style={{ padding: '12px 12px' }}><DeliveryBadge status={n.deliveryStatus} /></td>
                  <td style={{ padding: '12px 12px' }}><ReadBadge status={n.readStatus} /></td>
                  <td style={{ padding: '12px 12px' }}>
                    {n.relatedBookingId
                      ? <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#7C3AED', background: '#EDE9FE', padding: '2px 6px', borderRadius: 4 }}>{n.relatedBookingId}</span>
                      : <span style={{ fontSize: 11, color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 12px' }}>
                    <button onClick={() => setActiveNotif(n)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', fontSize: 11, fontWeight: 600, color: '#1664FF', border: '1px solid #BFDBFE', borderRadius: 5, background: '#EEF4FF', cursor: 'pointer' }}>
                      <Eye size={10} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            {total === 0 ? 'No results' : `Showing ${Math.min(start + 1, total)}–${Math.min(start + perPage, total)} of ${total}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>{i + 1}</PagBtn>
            ))}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {activeNotif && <NotifDetailDrawer notif={activeNotif} onClose={() => setActiveNotif(null)} />}
    </div>
  )
}

// ── Shared User Summary Banner ──────────────────────────────────────────────
const USER_DETAIL_PAGES: Partial<Record<PageId, string>> = {
  'endusers-profile':        'User Profile',
  'endusers-bookings':       'Booking History',
  'endusers-activities':     'User Activities',
  'endusers-transactions':   'User Transactions',
  'endusers-rewards':        'Rewards & Coupons',
  'endusers-support':        'User Support',
  'endusers-notifications':  'Notification History',
  'endusers-conversations':  'Guest Conversations',
}

function ChangeUserModal({ onSelect, onClose }: { onSelect: (u: EndUser) => void; onClose: () => void }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<EndUser[]>([])
  const inputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function doSearch(q: string) {
    setQuery(q)
    if (q.trim().length >= 2) {
      const lq = q.toLowerCase()
      setResults(USERS.filter(u =>
        u.name.toLowerCase().includes(lq) ||
        u.id.toLowerCase().includes(lq) ||
        u.email.toLowerCase().includes(lq) ||
        u.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      ))
    } else setResults([])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={16} color="#94A3B8" />
          <input ref={inputRef} value={query} onChange={e => doSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && results.length > 0) { onSelect(results[0]); onClose() } }}
            placeholder="Search by name, User ID, email, or phone…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#1A2332' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ maxHeight: 380, overflow: 'auto' }}>
          {query.length < 2 ? (
            <div style={{ padding: '20px 20px 12px' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Recent Users</div>
              {['USR-042', 'USR-001', 'USR-015'].map(id => {
                const u = USERS.find(u => u.id === id)
                if (!u) return null
                const avBg = AVATAR_COLORS[parseInt(u.id.replace('USR-', ''), 10) % AVATAR_COLORS.length]
                const ts = TIER_STYLE[u.tier]
                return (
                  <button key={u.id} onClick={() => { onSelect(u); onClose() }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{u.avatar}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{u.name}</span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', background: '#F1F5F9', padding: '1px 6px', borderRadius: 4 }}>{u.id}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: ts.bg, color: ts.color, padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}><Star size={8} fill={ts.color} />{u.tier}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{u.email}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No users found for "{query}"</div>
          ) : (
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, padding: '4px 8px' }}>{results.length} result{results.length !== 1 ? 's' : ''}</div>
              {results.map(u => {
                const avBg = AVATAR_COLORS[parseInt(u.id.replace('USR-', ''), 10) % AVATAR_COLORS.length]
                const ts = TIER_STYLE[u.tier]; const ss = STATUS_STYLE[u.status]
                return (
                  <button key={u.id} onClick={() => { onSelect(u); onClose() }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{u.avatar}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{u.name}</span>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', background: '#F1F5F9', padding: '1px 6px', borderRadius: 4 }}>{u.id}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: ts.bg, color: ts.color, padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}><Star size={8} fill={ts.color} />{u.tier}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: ss.color }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: ss.color }} />{ss.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{u.email} · {u.phone}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC', fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span><kbd style={{ background: '#E3E8F0', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: '#E3E8F0', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>Enter</kbd> select</span>
          <span><kbd style={{ background: '#E3E8F0', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

function SelectedUserBanner({ user, tab, onChangeUser, onNavigate }: {
  user: EndUser | null
  tab: PageId
  onChangeUser: () => void
  onNavigate?: (page: PageId) => void
}) {
  const pageName = USER_DETAIL_PAGES[tab] ?? ''
  const avBg  = user ? AVATAR_COLORS[parseInt(user.id.replace('USR-', ''), 10) % AVATAR_COLORS.length] : '#E3E8F0'
  const tierS  = user ? TIER_STYLE[user.tier]     : { bg: '#F8FAFC', color: '#94A3B8' }
  const statusS = user ? STATUS_STYLE[user.status] : { bg: '#F8FAFC', color: '#94A3B8', label: 'Unknown' }

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #E3E8F0', padding: '10px 24px', flexShrink: 0 }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, fontSize: 11, color: '#94A3B8' }}>
        {[
          { label: 'Home',                  page: 'dashboard'       as PageId },
          { label: 'End User Management',   page: 'endusers'        as PageId },
          { label: 'User Directory',        page: 'endusers'        as PageId },
          ...(user ? [{ label: user.name, page: null as PageId | null }] : []),
          { label: pageName, page: null as PageId | null },
        ].map((crumb, i, arr) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
            {crumb.page && i < arr.length - 1 ? (
              <button onClick={() => onNavigate?.(crumb.page!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 11, padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#1664FF'}
                onMouseLeave={e => e.currentTarget.style.color = '#64748B'}>
                {crumb.label}
              </button>
            ) : (
              <span style={{ fontWeight: i === arr.length - 1 ? 600 : 400, color: i === arr.length - 1 ? '#1A2332' : '#94A3B8' }}>{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* User card or no-user state */}
      {!user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#E3E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={16} color="#94A3B8" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>No user selected</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Go to User Directory to search and select a user first</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => onNavigate?.('endusers')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 8, background: '#1664FF', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Go to User Directory
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
            {user.avatar}
          </div>
          {/* Identity */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>{user.name}</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', background: '#F8FAFC', padding: '1px 6px', borderRadius: 4, border: '1px solid #E3E8F0' }}>{user.id}</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: tierS.bg, color: tierS.color, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                <Star size={8} fill={tierS.color} /> {user.tier}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusS.color }} />
                <span style={{ fontSize: 11, color: statusS.color, fontWeight: 500 }}>{statusS.label}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Mail size={10} color="#94A3B8" />{user.email}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Phone size={10} color="#94A3B8" />{user.phone}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Globe size={10} color="#94A3B8" />{user.country}</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Registered: <strong style={{ color: '#64748B' }}>{user.registeredAt}</strong></span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Last login: <strong style={{ color: '#64748B' }}>{user.lastLogin}</strong></span>
            </div>
          </div>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
            {[
              { label: 'Bookings',   value: String(user.totalBookings),                        color: '#1664FF', bg: '#EEF4FF' },
              { label: 'Spending',   value: fmtSpend(user.totalSpending) + ' MMK',             color: '#7C3AED', bg: '#EDE9FE' },
              { label: 'Points',     value: user.points.toLocaleString() + ' pts',             color: '#F59E0B', bg: '#FFFBEB' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '6px 12px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Change user */}
          <button onClick={onChangeUser}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid #E3E8F0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
            <Search size={12} /> Change User
          </button>
        </div>
      )}
    </div>
  )
}

// ── Guest Conversations ───────────────────────────────────────────────────────

type ConvBizType = 'hotel' | 'restaurant' | 'airline' | 'car_rental' | 'attraction'
type ConvStatus = 'open' | 'awaiting_merchant' | 'awaiting_guest' | 'resolved'

interface ConvMessage {
  id: string
  sender: 'guest' | 'merchant'
  senderName: string
  content: string
  sentAt: string
}

interface ConvRecord {
  id: string
  guestId: string
  guestName: string
  guestAvatar: string
  guestAvatarBg: string
  merchantId: string
  merchantName: string
  bizType: ConvBizType
  bookingId: string
  bookingStatus: 'confirmed' | 'checked_in' | 'completed' | 'cancelled'
  checkIn?: string
  checkOut?: string
  status: ConvStatus
  reported: boolean
  escalated: boolean
  lastMessage: string
  lastSender: 'guest' | 'merchant'
  lastAt: string
  messages: ConvMessage[]
}

const CONV_BIZ_CFG: Record<ConvBizType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  hotel:      { label: 'Hotel',      color: '#1664FF', bg: '#EEF4FF', icon: <Hotel size={11} /> },
  restaurant: { label: 'Restaurant', color: '#D97706', bg: '#FFFBEB', icon: <UtensilsCrossed size={11} /> },
  airline:    { label: 'Airline',    color: '#7C3AED', bg: '#EDE9FE', icon: <Plane size={11} /> },
  car_rental: { label: 'Car Rental', color: '#059669', bg: '#ECFDF3', icon: <Car size={11} /> },
  attraction: { label: 'Attraction', color: '#EC4899', bg: '#FDF2F8', icon: <Star size={11} /> },
}

const CONV_STATUS_CFG: Record<ConvStatus, { label: string; color: string; bg: string }> = {
  open:              { label: 'Open',                    color: '#1664FF', bg: '#EEF4FF' },
  awaiting_merchant: { label: 'Awaiting Merchant Reply', color: '#D97706', bg: '#FFFBEB' },
  awaiting_guest:    { label: 'Awaiting Guest Reply',    color: '#6366F1', bg: '#EEF2FF' },
  resolved:          { label: 'Resolved',                color: '#059669', bg: '#ECFDF3' },
}

const CONV_DATA: ConvRecord[] = [
  {
    id: 'CONV-001',
    guestId: 'USR-001', guestName: 'Wei Lin', guestAvatar: 'WL', guestAvatarBg: '#1664FF',
    merchantId: 'MCH-101', merchantName: 'Sedona Hotel Yangon', bizType: 'hotel',
    bookingId: 'BK-2025-00142', bookingStatus: 'confirmed', checkIn: '2025-02-14', checkOut: '2025-02-17',
    status: 'awaiting_merchant', reported: false, escalated: false,
    lastMessage: 'Could you please confirm whether the airport transfer is included in my package?',
    lastSender: 'guest', lastAt: '2025-01-20 14:32',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Wei Lin', content: 'Hello, I have a booking for February 14–17. Is airport transfer included in my package?', sentAt: '2025-01-20 14:00' },
      { id: 'm2', sender: 'merchant', senderName: 'Sedona Hotel', content: 'Hello Wei Lin! Thank you for choosing Sedona. Let me check your reservation details now.', sentAt: '2025-01-20 14:15' },
      { id: 'm3', sender: 'guest', senderName: 'Wei Lin', content: 'Could you please confirm whether the airport transfer is included in my package?', sentAt: '2025-01-20 14:32' },
    ],
  },
  {
    id: 'CONV-002',
    guestId: 'USR-001', guestName: 'Wei Lin', guestAvatar: 'WL', guestAvatarBg: '#1664FF',
    merchantId: 'MCH-102', merchantName: 'Inya Lake Hotel', bizType: 'hotel',
    bookingId: 'BK-2025-00289', bookingStatus: 'completed', checkIn: '2025-01-05', checkOut: '2025-01-08',
    status: 'resolved', reported: true, escalated: false,
    lastMessage: 'Thank you for resolving the issue. I appreciate your prompt response.',
    lastSender: 'guest', lastAt: '2025-01-09 10:45',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Wei Lin', content: 'I was charged an extra cleaning fee of 50,000 MMK that was not disclosed at booking. This is unacceptable.', sentAt: '2025-01-08 18:00' },
      { id: 'm2', sender: 'merchant', senderName: 'Inya Lake Hotel', content: 'We sincerely apologize for the confusion. The extra charge was applied in error. We will issue a full refund within 3 business days.', sentAt: '2025-01-08 19:30' },
      { id: 'm3', sender: 'guest', senderName: 'Wei Lin', content: 'When exactly will the refund appear on my account?', sentAt: '2025-01-09 09:10' },
      { id: 'm4', sender: 'merchant', senderName: 'Inya Lake Hotel', content: 'The refund has been processed and should reflect within 3–5 business days. Reference: REF-2025-00291.', sentAt: '2025-01-09 10:20' },
      { id: 'm5', sender: 'guest', senderName: 'Wei Lin', content: 'Thank you for resolving the issue. I appreciate your prompt response.', sentAt: '2025-01-09 10:45' },
    ],
  },
  {
    id: 'CONV-003',
    guestId: 'USR-002', guestName: 'Aung Thu', guestAvatar: 'AT', guestAvatarBg: '#059669',
    merchantId: 'MCH-201', merchantName: 'Padonmar Restaurant', bizType: 'restaurant',
    bookingId: 'BK-2025-00331', bookingStatus: 'confirmed',
    status: 'open', reported: false, escalated: false,
    lastMessage: 'We can accommodate your dietary requirement. Please mention it upon arrival.',
    lastSender: 'merchant', lastAt: '2025-01-22 12:05',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Aung Thu', content: 'Hi, I have a reservation for 4 people tonight at 7 PM. One of my guests is vegetarian — do you have suitable options?', sentAt: '2025-01-22 11:30' },
      { id: 'm2', sender: 'merchant', senderName: 'Padonmar Restaurant', content: 'We can accommodate your dietary requirement. Please mention it upon arrival and our staff will guide you to the vegetarian menu.', sentAt: '2025-01-22 12:05' },
    ],
  },
  {
    id: 'CONV-004',
    guestId: 'USR-004', guestName: 'Su Cho', guestAvatar: 'SC', guestAvatarBg: '#D97706',
    merchantId: 'MCH-202', merchantName: 'The Strand Grill', bizType: 'restaurant',
    bookingId: 'BK-2024-09812', bookingStatus: 'completed',
    status: 'resolved', reported: false, escalated: false,
    lastMessage: 'We have processed a 30% discount voucher for your next visit as compensation.',
    lastSender: 'merchant', lastAt: '2024-12-28 17:00',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Su Cho', content: 'I waited 45 minutes for my food and it arrived cold. This is not acceptable for a premium restaurant.', sentAt: '2024-12-27 21:00' },
      { id: 'm2', sender: 'merchant', senderName: 'The Strand Grill', content: 'We are deeply sorry for your experience. We had an unexpected kitchen issue that evening. Your feedback has been escalated to our manager.', sentAt: '2024-12-28 09:00' },
      { id: 'm3', sender: 'guest', senderName: 'Su Cho', content: 'What will you do to make this right?', sentAt: '2024-12-28 10:30' },
      { id: 'm4', sender: 'merchant', senderName: 'The Strand Grill', content: 'We have processed a 30% discount voucher for your next visit as compensation. Voucher code: STRAND30-DEC24.', sentAt: '2024-12-28 17:00' },
    ],
  },
  {
    id: 'CONV-005',
    guestId: 'USR-007', guestName: 'Yin Win', guestAvatar: 'YW', guestAvatarBg: '#7C3AED',
    merchantId: 'MCH-301', merchantName: 'Myanmar Airways International', bizType: 'airline',
    bookingId: 'BK-2025-00415', bookingStatus: 'confirmed', checkIn: '2025-03-10', checkOut: '2025-03-10',
    status: 'awaiting_guest', reported: false, escalated: false,
    lastMessage: 'Your seat upgrade request has been noted. We will confirm 24 hours before departure.',
    lastSender: 'merchant', lastAt: '2025-01-18 16:00',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Yin Win', content: 'I would like to request a seat upgrade for my RGN-SIN flight on March 10. Can you check availability in business class?', sentAt: '2025-01-18 14:00' },
      { id: 'm2', sender: 'merchant', senderName: 'Myanmar Airways International', content: 'Thank you for your request. Business class on that route is currently subject to availability. We have noted your preference.', sentAt: '2025-01-18 15:10' },
      { id: 'm3', sender: 'guest', senderName: 'Yin Win', content: 'How much would the upgrade cost if available?', sentAt: '2025-01-18 15:30' },
      { id: 'm4', sender: 'merchant', senderName: 'Myanmar Airways International', content: 'Your seat upgrade request has been noted. We will confirm availability and pricing 24 hours before departure.', sentAt: '2025-01-18 16:00' },
    ],
  },
  {
    id: 'CONV-006',
    guestId: 'USR-006', guestName: 'Nyan Phyo', guestAvatar: 'NP', guestAvatarBg: '#0EA5E9',
    merchantId: 'MCH-401', merchantName: 'Ayeyar Car Rental', bizType: 'car_rental',
    bookingId: 'BK-2025-00198', bookingStatus: 'confirmed', checkIn: '2025-02-01', checkOut: '2025-02-05',
    status: 'open', reported: false, escalated: false,
    lastMessage: 'Yes, the vehicle comes with comprehensive insurance. No additional deposit required.',
    lastSender: 'merchant', lastAt: '2025-01-21 11:20',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Nyan Phyo', content: 'Hello, for my rental on Feb 1–5, does the Toyota Innova come with insurance coverage? And is there a security deposit?', sentAt: '2025-01-21 10:00' },
      { id: 'm2', sender: 'merchant', senderName: 'Ayeyar Car Rental', content: 'Yes, the vehicle comes with comprehensive insurance. No additional deposit is required for bookings made through mTrip.', sentAt: '2025-01-21 11:20' },
    ],
  },
  {
    id: 'CONV-007',
    guestId: 'USR-010', guestName: 'Rina Bakar', guestAvatar: 'RB', guestAvatarBg: '#EC4899',
    merchantId: 'MCH-501', merchantName: 'Shwedagon Pagoda Tours', bizType: 'attraction',
    bookingId: 'BK-2025-00077', bookingStatus: 'confirmed', checkIn: '2025-01-25', checkOut: '2025-01-25',
    status: 'awaiting_merchant', reported: false, escalated: false,
    lastMessage: 'Can I bring my camera tripod inside the pagoda premises?',
    lastSender: 'guest', lastAt: '2025-01-23 09:45',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Rina Bakar', content: 'Hi! I am coming for a guided tour on January 25. What time should I arrive and where is the meeting point?', sentAt: '2025-01-22 15:00' },
      { id: 'm2', sender: 'merchant', senderName: 'Shwedagon Pagoda Tours', content: 'Welcome! Please arrive at the South Gate Entrance at 8:30 AM. Our guide will be holding a mTrip sign. Please wear modest clothing covering shoulders and knees.', sentAt: '2025-01-22 16:30' },
      { id: 'm3', sender: 'guest', senderName: 'Rina Bakar', content: 'Can I bring my camera tripod inside the pagoda premises?', sentAt: '2025-01-23 09:45' },
    ],
  },
  {
    id: 'CONV-008',
    guestId: 'USR-003', guestName: 'Khin May', guestAvatar: 'KM', guestAvatarBg: '#14B8A6',
    merchantId: 'MCH-103', merchantName: 'Kandawgyi Palace Hotel', bizType: 'hotel',
    bookingId: 'BK-2025-00512', bookingStatus: 'cancelled',
    status: 'resolved', reported: false, escalated: false,
    lastMessage: 'Your full refund of 180,000 MMK has been processed. You should see it within 5 business days.',
    lastSender: 'merchant', lastAt: '2025-01-15 14:00',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Khin May', content: 'I need to cancel my booking BK-2025-00512. My plans have changed due to a family emergency. Will I get a full refund?', sentAt: '2025-01-14 10:00' },
      { id: 'm2', sender: 'merchant', senderName: 'Kandawgyi Palace Hotel', content: 'We are sorry to hear that. Since you are cancelling more than 48 hours before check-in, you are eligible for a full refund per our cancellation policy.', sentAt: '2025-01-14 11:30' },
      { id: 'm3', sender: 'guest', senderName: 'Khin May', content: 'Thank you. How long will the refund take?', sentAt: '2025-01-14 12:00' },
      { id: 'm4', sender: 'merchant', senderName: 'Kandawgyi Palace Hotel', content: 'Your full refund of 180,000 MMK has been processed. You should see it within 5 business days.', sentAt: '2025-01-15 14:00' },
    ],
  },
  {
    id: 'CONV-009',
    guestId: 'USR-042', guestName: 'Zar Ni', guestAvatar: 'ZN', guestAvatarBg: '#F97316',
    merchantId: 'MCH-402', merchantName: 'Golden Land Car Rental', bizType: 'car_rental',
    bookingId: 'BK-2026-00034', bookingStatus: 'confirmed', checkIn: '2026-02-10', checkOut: '2026-02-12',
    status: 'open', reported: true, escalated: true,
    lastMessage: 'This is the third time I am asking — why was I charged a hidden fee of 25,000 MMK?',
    lastSender: 'guest', lastAt: '2026-01-19 17:10',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Zar Ni', content: 'Why was I charged an extra 25,000 MMK "road tax" fee that was never mentioned in the booking summary?', sentAt: '2026-01-18 09:00' },
      { id: 'm2', sender: 'merchant', senderName: 'Golden Land Car Rental', content: 'The road tax fee is a standard government levy applied to all rentals.', sentAt: '2026-01-18 11:00' },
      { id: 'm3', sender: 'guest', senderName: 'Zar Ni', content: 'It was NOT disclosed during booking. I have a screenshot of the checkout page showing the total without this fee.', sentAt: '2026-01-18 11:45' },
      { id: 'm4', sender: 'merchant', senderName: 'Golden Land Car Rental', content: 'We are reviewing your case.', sentAt: '2026-01-19 10:00' },
      { id: 'm5', sender: 'guest', senderName: 'Zar Ni', content: 'This is the third time I am asking — why was I charged a hidden fee of 25,000 MMK?', sentAt: '2026-01-19 17:10' },
    ],
  },
  {
    id: 'CONV-010',
    guestId: 'USR-012', guestName: 'Ei Yee', guestAvatar: 'EY', guestAvatarBg: '#6366F1',
    merchantId: 'MCH-502', merchantName: 'Inle Lake Adventure Tours', bizType: 'attraction',
    bookingId: 'BK-2025-00678', bookingStatus: 'confirmed', checkIn: '2025-03-05', checkOut: '2025-03-05',
    status: 'awaiting_guest', reported: false, escalated: false,
    lastMessage: 'We have updated your booking to include the kayak experience. No extra charge for Gold members.',
    lastSender: 'merchant', lastAt: '2025-01-24 13:30',
    messages: [
      { id: 'm1', sender: 'guest', senderName: 'Ei Yee', content: 'I would like to add the kayak lake tour to my existing Inle Lake package. Is that possible?', sentAt: '2025-01-24 10:00' },
      { id: 'm2', sender: 'merchant', senderName: 'Inle Lake Adventure Tours', content: 'Absolutely! As a Gold member via mTrip, you are eligible for complimentary add-ons.', sentAt: '2025-01-24 11:00' },
      { id: 'm3', sender: 'guest', senderName: 'Ei Yee', content: 'That is wonderful! Please add it to my booking.', sentAt: '2025-01-24 11:30' },
      { id: 'm4', sender: 'merchant', senderName: 'Inle Lake Adventure Tours', content: 'We have updated your booking to include the kayak experience. No extra charge for Gold members. See you on March 5!', sentAt: '2025-01-24 13:30' },
    ],
  },
]

function relativeTime(dateStr: string): string {
  const then = new Date(dateStr).getTime()
  const now = Date.now()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return dateStr.slice(0, 10)
}

function ConvListItem({ conv, selected, onClick }: { conv: ConvRecord; selected: boolean; onClick: () => void }) {
  const bizCfg = CONV_BIZ_CFG[conv.bizType]
  const statusCfg = CONV_STATUS_CFG[conv.status]
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', cursor: 'pointer',
        background: selected ? '#EEF4FF' : '#fff',
        borderLeft: selected ? '3px solid #1664FF' : '3px solid transparent',
        borderBottom: '1px solid #F1F5F9',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#F8FAFC' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#fff' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Avatar */}
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: conv.guestAvatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
          {conv.guestAvatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{conv.merchantName}</span>
            <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{relativeTime(conv.lastAt)}</span>
          </div>
          {/* Biz badge + indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: bizCfg.bg, color: bizCfg.color }}>
              {bizCfg.icon} {bizCfg.label}
            </span>
            {conv.reported && <Flag size={10} color="#DC2626" />}
            {conv.escalated && <AlertTriangle size={10} color="#D97706" />}
          </div>
          {/* Last message preview */}
          <div style={{ fontSize: 11, color: '#64748B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
            {conv.lastSender === 'merchant' ? <span style={{ fontWeight: 600 }}>Merchant: </span> : null}{conv.lastMessage}
          </div>
          {/* Status */}
          <div style={{ marginTop: 4 }}>
            <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: statusCfg.bg, color: statusCfg.color }}>
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function ConvMessageBubble({ msg }: { msg: ConvMessage }) {
  const isGuest = msg.sender === 'guest'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isGuest ? 'flex-start' : 'flex-end', marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>
        {msg.senderName} · {msg.sentAt}
      </div>
      <div style={{
        maxWidth: '75%', padding: '8px 12px', borderRadius: isGuest ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
        background: isGuest ? '#F8FAFC' : '#EEF4FF',
        border: `1px solid ${isGuest ? '#E3E8F0' : '#BFDBFE'}`,
        fontSize: 13, color: '#1A2332', lineHeight: 1.5,
      }}>
        {msg.content}
      </div>
    </div>
  )
}

// ── Conversation Center (platform-wide) ──────────────────────────────────────

function ConversationCenterPage({ showToast }: { showToast: Props['showToast'] }) {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [search, setSearch]               = useState('')
  const [filterBiz, setFilterBiz]         = useState<ConvBizType | ''>('')
  const [filterStatus, setFilterStatus]   = useState<ConvStatus | ''>('')
  const [filterMerchant, setFilterMerchant] = useState('')
  const [filterReported, setFilterReported]   = useState(false)
  const [filterEscalated, setFilterEscalated] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [flagged, setFlagged] = useState<Set<string>>(new Set())

  const allMerchants = Array.from(new Set(CONV_DATA.map(c => c.merchantName))).sort()

  const convs = CONV_DATA.filter(c => {
    if (filterBiz && c.bizType !== filterBiz) return false
    if (filterStatus && c.status !== filterStatus) return false
    if (filterMerchant && c.merchantName !== filterMerchant) return false
    if (filterReported && !c.reported) return false
    if (filterEscalated && !c.escalated) return false
    if (dateFrom && c.lastAt < dateFrom) return false
    if (dateTo && c.lastAt > dateTo + 'T23:59') return false
    if (search) {
      const q = search.toLowerCase()
      return c.guestName.toLowerCase().includes(q) ||
        c.merchantName.toLowerCase().includes(q) ||
        c.bookingId.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.messages.some(m => m.content.toLowerCase().includes(q))
    }
    return true
  })

  const selectedConv = CONV_DATA.find(c => c.id === selectedConvId) ?? null
  const hasFilters = !!(filterBiz || filterStatus || filterMerchant || filterReported || filterEscalated || dateFrom || dateTo || search)

  function clearFilters() {
    setSearch(''); setFilterBiz(''); setFilterStatus(''); setFilterMerchant('')
    setFilterReported(false); setFilterEscalated(false); setDateFrom(''); setDateTo('')
  }

  const kpiTotal     = CONV_DATA.length
  const kpiActive    = CONV_DATA.filter(c => c.status !== 'resolved').length
  const kpiReported  = CONV_DATA.filter(c => c.reported).length
  const kpiEscalated = CONV_DATA.filter(c => c.escalated).length
  const kpiMerchants = new Set(CONV_DATA.map(c => c.merchantId)).size

  const sel: React.CSSProperties = {
    height: 32, fontSize: 12, border: '1px solid #E3E8F0', borderRadius: 7,
    padding: '0 10px', color: '#475569', background: '#fff', outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ minWidth: 1100, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', boxSizing: 'border-box' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={18} color="#1664FF" />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1A2332', margin: 0 }}>Conversation Center</h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Platform-wide guest ↔ merchant conversation monitoring</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#047857', fontWeight: 600 }}>
            <Users size={11} /> All merchants · All guests
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => showToast('success', 'Export Complete', 'Conversation list exported.')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, flexShrink: 0 }}>
        {[
          { label: 'Total Conversations', value: kpiTotal,    color: '#1664FF', bg: '#EEF4FF' },
          { label: 'Active',              value: kpiActive,   color: '#059669', bg: '#ECFDF3' },
          { label: 'Reported',            value: kpiReported, color: '#DC2626', bg: '#FFF1F3' },
          { label: 'Escalated',           value: kpiEscalated, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Merchants Involved',  value: kpiMerchants, color: '#7C3AED', bg: '#EDE9FE' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
            <div style={{ height: 3, borderRadius: 2, background: k.bg, marginTop: 8 }} />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, flexShrink: 0 }}>
        <button
          onClick={() => setFiltersOpen(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <Filter size={13} color="#94A3B8" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', flex: 1 }}>Filters & Search</span>
          {hasFilters && (
            <span style={{ fontSize: 10, fontWeight: 700, background: '#1664FF', color: '#fff', padding: '2px 7px', borderRadius: 10 }}>Active</span>
          )}
          <ChevronDown size={13} color="#94A3B8" style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        {filtersOpen && (
          <div style={{ padding: '0 16px 14px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Search row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E3E8F0', borderRadius: 8, padding: '0 12px', height: 36, marginTop: 12 }}>
              <Search size={13} color="#94A3B8" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by guest name, merchant, booking ID, or message content…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#1A2332' }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={13} /></button>}
            </div>

            {/* Filter dropdowns row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Type</div>
                <select value={filterBiz} onChange={e => setFilterBiz(e.target.value as ConvBizType | '')} style={sel}>
                  <option value="">All Types</option>
                  {(Object.keys(CONV_BIZ_CFG) as ConvBizType[]).map(k => (
                    <option key={k} value={k}>{CONV_BIZ_CFG[k].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Merchant</div>
                <select value={filterMerchant} onChange={e => setFilterMerchant(e.target.value)} style={sel}>
                  <option value="">All Merchants</option>
                  {allMerchants.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ConvStatus | '')} style={sel}>
                  <option value="">All Statuses</option>
                  {(Object.keys(CONV_STATUS_CFG) as ConvStatus[]).map(k => (
                    <option key={k} value={k}>{CONV_STATUS_CFG[k].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Range</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...sel, flex: 1, padding: '0 6px' }} />
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...sel, flex: 1, padding: '0 6px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setFilterReported(f => !f)}
                  style={{ height: 32, padding: '0 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${filterReported ? '#FECDD3' : '#E3E8F0'}`, background: filterReported ? '#FFF1F3' : '#fff', color: filterReported ? '#DC2626' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Flag size={10} /> Reported
                </button>
                <button onClick={() => setFilterEscalated(f => !f)}
                  style={{ height: 32, padding: '0 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${filterEscalated ? '#FDE68A' : '#E3E8F0'}`, background: filterEscalated ? '#FFFBEB' : '#fff', color: filterEscalated ? '#D97706' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={10} /> Escalated
                </button>
                {hasFilters && (
                  <button onClick={clearFilters}
                    style={{ height: 32, padding: '0 10px', fontSize: 11, borderRadius: 7, border: '1px solid #E3E8F0', background: '#fff', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <X size={10} /> Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Three-panel area */}
      <div style={{ display: 'flex', flex: 1, gap: 12, minHeight: 480, overflow: 'hidden' }}>

        {/* Left panel — conversation list */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
          {/* List header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2332' }}>Conversations</span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{convs.length} of {CONV_DATA.length}</span>
          </div>
          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convs.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <MessageSquare size={28} color="#E3E8F0" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: '#CBD5E1', fontWeight: 600 }}>No conversations found</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Try adjusting your filters</div>
              </div>
            ) : (
              convs.map(c => (
                <ConvListItem key={c.id} conv={c} selected={selectedConvId === c.id} onClick={() => setSelectedConvId(c.id)} />
              ))
            )}
          </div>
        </div>

        {/* Center panel — conversation thread */}
        <div style={{ flex: 1, minWidth: 400, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
          {!selectedConv ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#94A3B8' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={24} color="#CBD5E1" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#CBD5E1', textAlign: 'center' }}>Select a conversation</div>
                <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4 }}>Click any conversation in the left panel to view the full thread.</div>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Guest + merchant identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: selectedConv.guestAvatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {selectedConv.guestAvatar}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>{selectedConv.guestName}</span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#94A3B8', background: '#F1F5F9', padding: '1px 5px', borderRadius: 4 }}>{selectedConv.guestId}</span>
                      </div>
                      <span style={{ color: '#CBD5E1', fontSize: 12 }}>↔</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>{selectedConv.merchantName}</span>
                    </div>
                    {/* Booking info row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Booking</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1664FF', fontFamily: 'monospace' }}>{selectedConv.bookingId}</span>
                      <div style={{ width: 1, height: 14, background: '#E3E8F0' }} />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: CONV_BIZ_CFG[selectedConv.bizType].bg, color: CONV_BIZ_CFG[selectedConv.bizType].color }}>
                        {CONV_BIZ_CFG[selectedConv.bizType].icon} {CONV_BIZ_CFG[selectedConv.bizType].label}
                      </span>
                      <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#475569', textTransform: 'capitalize' }}>
                        {selectedConv.bookingStatus.replace('_', ' ')}
                      </span>
                      {selectedConv.checkIn && (
                        <span style={{ fontSize: 11, color: '#64748B' }}>{selectedConv.checkIn} → {selectedConv.checkOut}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: CONV_STATUS_CFG[selectedConv.status].bg, color: CONV_STATUS_CFG[selectedConv.status].color }}>
                      {CONV_STATUS_CFG[selectedConv.status].label}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(flagged.has(selectedConv.id) || selectedConv.reported) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: '#FFF1F3', color: '#DC2626' }}>
                          <Flag size={8} /> Flagged
                        </span>
                      )}
                      {selectedConv.escalated && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: '#FFFBEB', color: '#D97706' }}>
                          <AlertTriangle size={8} /> Escalated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedConv.messages.map(msg => (
                  <ConvMessageBubble key={msg.id} msg={msg} />
                ))}
              </div>

              {/* Read-only notice */}
              <div style={{ padding: '9px 18px', borderTop: '1px solid #F1F5F9', background: '#FFFBEB', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#D97706' }}>
                  <AlertTriangle size={11} />
                  Read-only monitoring view — Super Admins cannot send messages directly in guest conversations
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right panel — admin actions */}
        <div style={{ width: 248, flexShrink: 0, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedConv ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
              <ShieldAlert size={24} color="#E3E8F0" />
              <span style={{ fontSize: 12, color: '#CBD5E1', textAlign: 'center', lineHeight: 1.6 }}>Select a conversation to access admin actions.</span>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>Admin Actions</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedConv.id}</div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>

                {/* Section: Navigation */}
                <div style={{ fontSize: 9, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '6px 8px 2px' }}>Navigation</div>

                {([
                  { icon: <Eye size={13} />,            label: 'View User Profile',      onClick: () => showToast('info', 'Navigate', `Opening profile for ${selectedConv.guestName}`) },
                  { icon: <Store size={13} />,           label: 'View Merchant Profile',  onClick: () => showToast('info', 'Navigate', `Opening profile for ${selectedConv.merchantName}`) },
                  { icon: <ExternalLink size={13} />,    label: 'View Booking Details',   onClick: () => showToast('info', 'Navigate', `Opening booking ${selectedConv.bookingId}`) },
                ] as { icon: React.ReactNode; label: string; onClick: () => void }[]).map(a => (
                  <button key={a.label} onClick={a.onClick}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#475569', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: '#94A3B8', flexShrink: 0 }}>{a.icon}</span>{a.label}
                  </button>
                ))}

                {/* Section: Communication */}
                <div style={{ fontSize: 9, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '8px 8px 2px', borderTop: '1px solid #F1F5F9', marginTop: 4 }}>Communication</div>

                {([
                  { icon: <Bell size={13} />,            label: 'Send Notification to Guest', onClick: () => showToast('success', 'Notification Sent', `Notification queued for ${selectedConv.guestName}`) },
                  { icon: <MessageSquare size={13} />,   label: 'Open Support Ticket',        onClick: () => showToast('info', 'Ticket Created', `Support ticket created for booking ${selectedConv.bookingId}`) },
                ] as { icon: React.ReactNode; label: string; onClick: () => void }[]).map(a => (
                  <button key={a.label} onClick={a.onClick}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#475569', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: '#94A3B8', flexShrink: 0 }}>{a.icon}</span>{a.label}
                  </button>
                ))}

                {/* Section: Moderation */}
                <div style={{ fontSize: 9, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '8px 8px 2px', borderTop: '1px solid #F1F5F9', marginTop: 4 }}>Moderation</div>

                <button
                  onClick={() => {
                    setFlagged(prev => { const s = new Set(prev); s.has(selectedConv.id) ? s.delete(selectedConv.id) : s.add(selectedConv.id); return s })
                    showToast(flagged.has(selectedConv.id) ? 'info' : 'warning', flagged.has(selectedConv.id) ? 'Flag Removed' : 'Conversation Flagged', `Conversation ${selectedConv.id} has been ${flagged.has(selectedConv.id) ? 'unflagged' : 'flagged'}.`)
                  }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: flagged.has(selectedConv.id) || selectedConv.reported ? '#DC2626' : '#475569', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF1F3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Flag size={13} style={{ flexShrink: 0 }} />
                  {flagged.has(selectedConv.id) || selectedConv.reported ? 'Unflag Conversation' : 'Flag Conversation'}
                </button>

                <button onClick={() => showToast('warning', 'Escalated to Compliance', `Conversation ${selectedConv.id} has been escalated to the compliance team.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#D97706', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFFBEB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <ShieldAlert size={13} style={{ flexShrink: 0 }} />
                  Escalate to Compliance
                </button>

                {/* Section: Enforcement */}
                <div style={{ fontSize: 9, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '8px 8px 2px', borderTop: '1px solid #F1F5F9', marginTop: 4 }}>Enforcement</div>

                <button onClick={() => showToast('warning', 'User Suspended', `${selectedConv.guestName} has been suspended pending review.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#DC2626', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF1F3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <UserX size={13} style={{ flexShrink: 0 }} />
                  Suspend User
                </button>

                <button onClick={() => showToast('warning', 'Merchant Suspended', `${selectedConv.merchantName} has been suspended pending review.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#DC2626', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF1F3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <ShieldOff size={13} style={{ flexShrink: 0 }} />
                  Suspend Merchant
                </button>

                {/* Section: Export */}
                <div style={{ fontSize: 9, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '8px 8px 2px', borderTop: '1px solid #F1F5F9', marginTop: 4 }}>Export</div>

                <button onClick={() => showToast('success', 'Export Complete', `Conversation ${selectedConv.id} exported as PDF.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#475569', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <FileDown size={13} color="#94A3B8" style={{ flexShrink: 0 }} />
                  Export Conversation
                </button>

              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

function GuestConversationsPage({ showToast, user }: { showToast: Props['showToast']; user: EndUser }) {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterBiz, setFilterBiz] = useState<ConvBizType | ''>('')
  const [filterStatus, setFilterStatus] = useState<ConvStatus | ''>('')
  const [filterReported, setFilterReported] = useState(false)
  const [filterEscalated, setFilterEscalated] = useState(false)

  const convs = CONV_DATA.filter(c => {
    if (filterBiz && c.bizType !== filterBiz) return false
    if (filterStatus && c.status !== filterStatus) return false
    if (filterReported && !c.reported) return false
    if (filterEscalated && !c.escalated) return false
    if (search) {
      const q = search.toLowerCase()
      return c.merchantName.toLowerCase().includes(q) ||
        c.bookingId.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
    }
    return true
  })

  const selectedConv = CONV_DATA.find(c => c.id === selectedConvId) ?? null

  const kpiActive = CONV_DATA.filter(c => c.status === 'open' || c.status === 'awaiting_merchant' || c.status === 'awaiting_guest').length
  const kpiAwaitingMerchant = CONV_DATA.filter(c => c.status === 'awaiting_merchant').length
  const kpiReported = CONV_DATA.filter(c => c.reported).length
  const kpiEscalated = CONV_DATA.filter(c => c.escalated).length

  const avBg = AVATAR_COLORS[parseInt(user.id.replace('USR-', ''), 10) % AVATAR_COLORS.length]
  const tierS = TIER_STYLE[user.tier]
  const statusS = STATUS_STYLE[user.status]

  return (
    <div style={{ minWidth: 1100, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', boxSizing: 'border-box' }}>

      {/* User summary banner */}
      <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: avBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
          {user.avatar}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>{user.name}</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', background: '#F8FAFC', padding: '1px 6px', borderRadius: 4, border: '1px solid #E3E8F0' }}>{user.id}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: tierS.bg, color: tierS.color, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
              <Star size={8} fill={tierS.color} /> {user.tier}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusS.color }} />
              <span style={{ fontSize: 11, color: statusS.color, fontWeight: 500 }}>{statusS.label}</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Mail size={10} color="#94A3B8" />{user.email}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B' }}><Globe size={10} color="#94A3B8" />{user.country}</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{ background: '#EEF4FF', borderRadius: 8, padding: '6px 14px', textAlign: 'center', minWidth: 72 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1664FF', fontFamily: 'monospace' }}>{CONV_DATA.length}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Total Convs</div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Active Conversations', value: kpiActive, color: '#1664FF' },
          { label: 'Awaiting Merchant Reply', value: kpiAwaitingMerchant, color: '#D97706' },
          { label: 'Reported', value: kpiReported, color: '#DC2626' },
          { label: 'Escalated', value: kpiEscalated, color: '#D97706' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Three-panel area */}
      <div style={{ display: 'flex', flex: 1, gap: 12, minHeight: 500, height: 'calc(100vh - 360px)' }}>

        {/* Left panel */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E3E8F0', borderRadius: 7, padding: '0 10px', height: 32 }}>
              <Search size={12} color="#94A3B8" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#1A2332' }}
              />
            </div>
          </div>
          {/* Filters */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select value={filterBiz} onChange={e => setFilterBiz(e.target.value as ConvBizType | '')}
              style={{ height: 28, fontSize: 11, border: '1px solid #E3E8F0', borderRadius: 6, padding: '0 8px', color: '#475569', background: '#fff', outline: 'none' }}>
              <option value="">All Business Types</option>
              {(Object.keys(CONV_BIZ_CFG) as ConvBizType[]).map(k => (
                <option key={k} value={k}>{CONV_BIZ_CFG[k].label}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ConvStatus | '')}
              style={{ height: 28, fontSize: 11, border: '1px solid #E3E8F0', borderRadius: 6, padding: '0 8px', color: '#475569', background: '#fff', outline: 'none' }}>
              <option value="">All Statuses</option>
              {(Object.keys(CONV_STATUS_CFG) as ConvStatus[]).map(k => (
                <option key={k} value={k}>{CONV_STATUS_CFG[k].label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setFilterReported(f => !f)}
                style={{ flex: 1, height: 26, fontSize: 10, fontWeight: 600, borderRadius: 6, border: `1px solid ${filterReported ? '#FECDD3' : '#E3E8F0'}`, background: filterReported ? '#FFF1F3' : '#fff', color: filterReported ? '#DC2626' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Flag size={9} /> Reported
              </button>
              <button
                onClick={() => setFilterEscalated(f => !f)}
                style={{ flex: 1, height: 26, fontSize: 10, fontWeight: 600, borderRadius: 6, border: `1px solid ${filterEscalated ? '#FDE68A' : '#E3E8F0'}`, background: filterEscalated ? '#FFFBEB' : '#fff', color: filterEscalated ? '#D97706' : '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <AlertTriangle size={9} /> Escalated
              </button>
            </div>
          </div>
          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>No conversations match your filters.</div>
            ) : (
              convs.map(c => (
                <ConvListItem key={c.id} conv={c} selected={selectedConvId === c.id} onClick={() => setSelectedConvId(c.id)} />
              ))
            )}
          </div>
          {/* Count footer */}
          <div style={{ padding: '6px 12px', borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#94A3B8' }}>
            {convs.length} of {CONV_DATA.length} conversations
          </div>
        </div>

        {/* Center panel */}
        <div style={{ flex: 1, minWidth: 400, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
          {!selectedConv ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94A3B8' }}>
              <MessageSquare size={40} color="#E3E8F0" />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#CBD5E1' }}>Select a conversation</div>
              <div style={{ fontSize: 12 }}>Choose a conversation from the list to view messages.</div>
            </div>
          ) : (
            <>
              {/* Booking summary */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>Booking </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{selectedConv.bookingId}</span>
                  </div>
                  <div style={{ width: 1, height: 16, background: '#E3E8F0' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A2332' }}>{selectedConv.merchantName}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: CONV_BIZ_CFG[selectedConv.bizType].bg, color: CONV_BIZ_CFG[selectedConv.bizType].color }}>
                    {CONV_BIZ_CFG[selectedConv.bizType].icon} {CONV_BIZ_CFG[selectedConv.bizType].label}
                  </span>
                  <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#475569' }}>
                    {selectedConv.bookingStatus.replace('_', ' ')}
                  </span>
                  {selectedConv.checkIn && (
                    <span style={{ fontSize: 11, color: '#64748B' }}>
                      {selectedConv.checkIn} → {selectedConv.checkOut}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: CONV_STATUS_CFG[selectedConv.status].bg, color: CONV_STATUS_CFG[selectedConv.status].color }}>
                    {CONV_STATUS_CFG[selectedConv.status].label}
                  </span>
                </div>
              </div>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {selectedConv.messages.map(msg => (
                  <ConvMessageBubble key={msg.id} msg={msg} />
                ))}
              </div>
              {/* Read-only notice */}
              <div style={{ padding: '8px 16px', borderTop: '1px solid #F1F5F9', background: '#FFFBEB', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#D97706' }}>
                  <AlertTriangle size={11} /> Read-only monitoring view — admins cannot send messages
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <div style={{ width: 240, flexShrink: 0, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <span style={{ fontSize: 12, color: '#CBD5E1', textAlign: 'center' }}>Select a conversation to see admin actions.</span>
            </div>
          ) : (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>Admin Actions</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>

                {([
                  { icon: <Eye size={13} />, label: 'View User Profile', onClick: () => showToast('info', 'Navigate', `Opening profile for ${selectedConv.guestName}`) },
                  { icon: <Store size={13} />, label: 'View Merchant Profile', onClick: () => showToast('info', 'Navigate', `Opening profile for ${selectedConv.merchantName}`) },
                  { icon: <ExternalLink size={13} />, label: 'View Booking Details', onClick: () => showToast('info', 'Navigate', `Opening booking ${selectedConv.bookingId}`) },
                  { icon: <Bell size={13} />, label: 'Send Notification to Guest', onClick: () => showToast('success', 'Notification Sent', `Notification queued for ${selectedConv.guestName}`) },
                  { icon: <MessageSquare size={13} />, label: 'Open Support Ticket', onClick: () => showToast('info', 'Ticket Created', `Support ticket created for booking ${selectedConv.bookingId}`) },
                ] as { icon: React.ReactNode; label: string; onClick: () => void }[]).map(action => (
                  <button key={action.label} onClick={action.onClick}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#475569', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: '#94A3B8', flexShrink: 0 }}>{action.icon}</span>
                    {action.label}
                  </button>
                ))}

                <div style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />

                <button onClick={() => showToast(selectedConv.reported ? 'info' : 'warning', selectedConv.reported ? 'Flag Removed' : 'Conversation Flagged', `Conversation ${selectedConv.id} has been ${selectedConv.reported ? 'unflagged' : 'flagged'}.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#DC2626', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF1F3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Flag size={13} />
                  {selectedConv.reported ? 'Unflag Conversation' : 'Flag Conversation'}
                </button>

                <button onClick={() => showToast('warning', 'Escalated to Compliance', `Conversation ${selectedConv.id} has been escalated.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#D97706', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFFBEB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <ShieldAlert size={13} />
                  Escalate to Compliance
                </button>

                <div style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />

                <button onClick={() => showToast('warning', 'User Suspended', `${selectedConv.guestName} has been suspended.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#DC2626', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF1F3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <UserX size={13} />
                  Suspend User
                </button>

                <button onClick={() => showToast('warning', 'Merchant Suspended', `${selectedConv.merchantName} has been suspended.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#DC2626', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF1F3'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <ShieldOff size={13} />
                  Suspend Merchant
                </button>

                <div style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />

                <button onClick={() => showToast('success', 'Export Complete', `Conversation ${selectedConv.id} exported.`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#475569', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <FileDown size={13} color="#94A3B8" />
                  Export Conversation
                </button>

              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function EndUserPage({ tab, showToast, onEndUserChange, onNavigate }: Props) {
  const [selectedUser, setSelectedUser] = useState<EndUser | null>(null)
  const [showChangeUser, setShowChangeUser] = useState(false)
  const [sentNotifs, setSentNotifs] = useState<NotifRecord[]>([])

  function handleNotifSent(payload: SentNotifPayload) {
    const CAT_TO_TYPE: Record<string, NotifType> = {
      booking: 'booking', promotion: 'promotion', rewards: 'rewards',
      wallet: 'wallet', refund: 'wallet', account: 'account',
      security: 'account', support: 'support', system: 'system',
    }
    const rec: NotifRecord = {
      id: payload.id,
      type: (CAT_TO_TYPE[payload.category] ?? 'system') as NotifType,
      title: payload.title,
      message: payload.message,
      channels: payload.channels.filter(ch => ch !== 'in-app') as NotifChannel[],
      deliveryStatus: payload.scheduledAt ? 'pending' : 'delivered',
      readStatus: 'unread',
      sentAt: payload.sentAt,
      sentBy: 'Admin',
      deepLink: payload.deepLinkDest !== 'none'
        ? (payload.deepLinkDest === 'external_url' ? payload.externalUrl : `/${payload.deepLinkDest}`)
        : undefined,
    }
    setSentNotifs(prev => [rec, ...prev])
  }

  const isUserDetailPage = tab in USER_DETAIL_PAGES

  function handleSelectUser(u: EndUser) {
    setSelectedUser(u)
    setShowChangeUser(false)
    onEndUserChange?.({ name: u.name, avatar: u.avatar, tier: u.tier })
    if (tab === 'endusers') onNavigate?.('endusers-profile')
  }

  function renderPage() {
    if (tab === 'endusers-profile')      return <UserProfilePage    showToast={showToast} user={selectedUser ?? USERS[0]} />
    if (tab === 'endusers-bookings')     return <BookingHistoryPage showToast={showToast} user={selectedUser ?? USERS[0]} />
    if (tab === 'endusers-activities')   return <UserActivitiesPage showToast={showToast} user={selectedUser ?? USERS[0]} />
    if (tab === 'endusers-transactions') return <UserTransactionsPage showToast={showToast} user={selectedUser ?? undefined} />
    if (tab === 'endusers-rewards')      return <RewardsCouponsPage showToast={showToast} user={selectedUser ?? USERS[0]} />
    if (tab === 'endusers-support')        return <UserSupportPage         showToast={showToast} user={selectedUser ?? USERS[0]} onNotifSent={handleNotifSent} />
    if (tab === 'endusers-notifications') return <NotificationHistoryPage showToast={showToast} user={selectedUser ?? USERS[0]} extraNotifs={sentNotifs} />
    if (tab === 'endusers-conversations') return <GuestConversationsPage showToast={showToast} user={selectedUser ?? USERS[0]} />
    if (tab === 'conversations-center')  return <ConversationCenterPage showToast={showToast} />
    if (tab === 'endusers-suspended')    return <SuspendedUsersPage showToast={showToast} />
    if (tab === 'endusers-blacklist')    return <BlacklistPage      showToast={showToast} />
    return <UserDirectoryPage showToast={showToast} onViewProfile={handleSelectUser} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {showChangeUser && <ChangeUserModal onSelect={handleSelectUser} onClose={() => setShowChangeUser(false)} />}
      {isUserDetailPage && (
        <SelectedUserBanner
          user={selectedUser}
          tab={tab}
          onChangeUser={() => setShowChangeUser(true)}
          onNavigate={onNavigate}
        />
      )}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderPage()}
      </div>
    </div>
  )
}

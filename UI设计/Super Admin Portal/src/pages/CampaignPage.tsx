import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Plus, Download, Eye, Pause, Play, Search, ChevronLeft, ChevronRight,
  ArrowLeftRight, Tag, Ticket, Code2, Copy,
  Link2, CheckCircle, XCircle, MoreHorizontal, ChevronUp, ChevronDown,
  TrendingUp, Users, X, SlidersHorizontal, ChevronsUpDown, Pencil,
  Hotel, Trash2, MoonStar, Gift,
} from 'lucide-react'
import { campaigns, vouchers, promoCodes, merchants, promotions, welcomeRewards } from '../data/platformData'
import type { Campaign, Voucher, PromoCode, Promotion, WelcomeReward } from '../data/platformData'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'
import Drawer from '../components/Drawer'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

// ── Status badges ─────────────────────────────────────────────────────────────

type AnyStatus = Campaign['status'] | Voucher['status'] | PromoCode['status']

function StatusBadge({ status }: { status: AnyStatus }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:    { bg: '#ECFDF3', color: '#027A48' },
    paused:    { bg: '#FFFAEB', color: '#B54708' },
    ended:     { bg: '#F1F5F9', color: '#475569' },
    expired:   { bg: '#F1F5F9', color: '#475569' },
    scheduled: { bg: '#EFF6FF', color: '#1D4ED8' },
    draft:     { bg: '#F8FAFC', color: '#94A3B8' },
  }
  const c = cfg[status] ?? { bg: '#F1F5F9', color: '#475569' }
  return <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{status}</span>
}

function CampaignTypeBadge({ type }: { type: Campaign['type'] }) {
  const cfg: Record<Campaign['type'], { bg: string; color: string; label: string }> = {
    flash_sale:     { bg: '#FFF1F3', color: '#BE123C', label: 'Flash Sale' },
    loyalty:        { bg: '#FEF3C7', color: '#92400E', label: 'Loyalty' },
    seasonal:       { bg: '#EFF6FF', color: '#1D4ED8', label: 'Seasonal' },
    partnership:    { bg: '#F3E8FF', color: '#6D28D9', label: 'Partnership' },
    referral:       { bg: '#ECFDF3', color: '#065F46', label: 'Referral' },
    long_stay_deal: { bg: '#ECFEFF', color: '#0E7490', label: 'Long Stay Deal' },
  }
  const c = cfg[type]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{c.label}</span>
}

function VoucherTypeBadge({ type }: { type: Voucher['voucherType'] }) {
  const cfg: Record<Voucher['voucherType'], { bg: string; color: string; label: string }> = {
    fixed:      { bg: '#F0FDF4', color: '#166534', label: 'Fixed Amount' },
    percentage: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Percentage' },
    free_night: { bg: '#FFF7ED', color: '#9A3412', label: 'Free Night' },
    upgrade:    { bg: '#FAF5FF', color: '#5B21B6', label: 'Upgrade' },
  }
  const c = cfg[type]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{c.label}</span>
}

function DiscountTypeBadge({ type }: { type: PromoCode['discountType'] }) {
  const cfg: Record<PromoCode['discountType'], { bg: string; color: string; label: string }> = {
    percentage: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Percentage' },
    fixed:      { bg: '#F0FDF4', color: '#166534', label: 'Fixed Amount' },
    free_night: { bg: '#FFF7ED', color: '#9A3412', label: 'Free Night' },
    cashback:   { bg: '#FFF1F3', color: '#BE123C', label: 'Cashback' },
  }
  const c = cfg[type]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{c.label}</span>
}


function CampaignOwnerBadge({ owner, merchantOwner }: { owner: 'platform' | 'merchant'; merchantOwner?: string }) {
  if (owner === 'platform') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 font-medium" style={{ fontSize: 11, background: '#EEF4FF', color: '#1664FF', height: 20 }}>
        mTrip Platform
      </span>
    )
  }
  return (
    <div>
      <span className="inline-flex items-center gap-1 rounded px-1.5 font-medium" style={{ fontSize: 11, background: '#FFF7ED', color: '#C2410C', height: 20 }}>
        Merchant
      </span>
      {merchantOwner && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{merchantOwner}</div>}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function ActionBtn({ children, onClick, color, title }: { children: React.ReactNode; onClick: () => void; color: string; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: 28, height: 28, color: '#94A3B8' }}
      onMouseEnter={e => { e.currentTarget.style.background = color + '15'; e.currentTarget.style.color = color }}
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

interface MenuItem { label: string; icon?: React.ReactNode; color?: string; divider?: boolean; onClick: () => void }

function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <ActionBtn color="#64748B" onClick={() => setOpen(o => !o)} title="More actions">
        <MoreHorizontal size={14} />
      </ActionBtn>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 100, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 180, padding: '4px 0' }}>
          {items.map((item, i) => (
            <div key={i}>
              {item.divider && i > 0 && <div style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />}
              <button
                onClick={() => { item.onClick(); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 text-left"
                style={{ height: 34, fontSize: 13, color: item.color ?? '#1A2332', background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {item.icon && <span style={{ color: item.color ?? '#64748B' }}>{item.icon}</span>}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Form helpers ──────────────────────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#DC2626', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', borderRadius: 6, padding: '8px 10px', outline: 'none', background: '#fff' }
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const merchantOptions = merchants.slice(0, 12).map(m => m.merchantName)

// ── Applicable Services ───────────────────────────────────────────────────────

interface ServiceOption { value: string; label: string; icon: string; color: string }

const SERVICE_OPTIONS: ServiceOption[] = [
  { value: 'hotel',      label: 'Hotel',      icon: '🏨', color: '#1664FF' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍽️', color: '#D97706' },
  { value: 'flight',     label: 'Flight',     icon: '✈️', color: '#0E7490' },
  { value: 'activity',   label: 'Activity',   icon: '🎯', color: '#7C3AED' },
  { value: 'transport',  label: 'Transport',  icon: '🚗', color: '#059669' },
  { value: 'spa',        label: 'Spa',        icon: '💆', color: '#BE123C' },
]

// Merchant categories per service (for filtering)
const SERVICE_MERCHANT_CATEGORIES: Record<string, string[]> = {
  hotel:      ['hotel', 'boutique', 'resort', 'guesthouse'],
  restaurant: ['restaurant', 'mixed'],
  flight:     [],
  activity:   [],
  transport:  [],
  spa:        ['spa'],
}

function ApplicableServicesSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (s: string) => onChange(value.includes(s) ? value.filter(x => x !== s) : [...value, s])
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {SERVICE_OPTIONS.map(opt => {
        const active = value.includes(opt.value)
        return (
          <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', border: `1.5px solid ${active ? opt.color : '#E3E8F0'}`, background: active ? opt.color + '12' : '#fff', color: active ? opt.color : '#64748B', transition: 'all 0.12s' }}>
            <span style={{ fontSize: 13 }}>{opt.icon}</span> {opt.label}
            {active && <span style={{ marginLeft: 2, fontSize: 11, opacity: 0.7 }}>✓</span>}
          </button>
        )
      })}
    </div>
  )
}

function MerchantMultiSelect({ value, onChange, services }: { value: string[]; onChange: (v: string[]) => void; services?: string[] }) {
  // Filter merchant options by selected services (show all if no service restriction)
  const allowedCategories = services && services.length > 0
    ? Array.from(new Set(services.flatMap(s => SERVICE_MERCHANT_CATEGORIES[s] ?? [])))
    : null
  const filtered = allowedCategories && allowedCategories.length > 0
    ? merchants.slice(0, 20).filter(m => allowedCategories.includes(m.category)).map(m => m.merchantName)
    : merchantOptions
  const toggle = (m: string) => onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m])
  return (
    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #E3E8F0', maxHeight: 132, overflowY: 'auto' }}>
      {filtered.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>No merchants match selected services</div>
      )}
      {filtered.map(m => (
        <label key={m} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer" style={{ fontSize: 12, color: '#1A2332', borderBottom: '1px solid #F8FAFC' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <input type="checkbox" checked={value.includes(m)} onChange={() => toggle(m)} style={{ accentColor: '#1664FF' }} />
          {m}
        </label>
      ))}
    </div>
  )
}

// ── Edit Budget Modal ─────────────────────────────────────────────────────────

function EditBudgetModal({ open, currentTotal, onClose, onSave }: {
  open: boolean; currentTotal: number; onClose: () => void; onSave: (v: number) => void
}) {
  const [raw, setRaw] = useState('')
  const parsed = parseFloat(raw.replace(/,/g, '')) || 0
  const valid  = parsed > 0

  // Reset when opened
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) setRaw(String(currentTotal))
    prevOpen.current = open
  }, [open, currentTotal])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(10,22,40,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 510, background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        width: 420, padding: 0, overflow: 'hidden',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>Update Platform Campaign Fund</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Set the total budget available for platform-funded campaigns</div>
          </div>
          <button onClick={onClose}
            className="flex items-center justify-center rounded-md"
            style={{ width: 28, height: 28, border: '1px solid #E3E8F0', background: '#fff', cursor: 'pointer', color: '#64748B', fontSize: 16 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            ×
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {/* Current value display */}
          <div className="rounded-lg px-3 py-2.5 flex items-center justify-between" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>Current Total Budget</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{fmtMMK(currentTotal)}</span>
          </div>
          {/* Input */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Total Budget (MMK) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8', pointerEvents: 'none' }}>MMK</span>
              <input
                type="number"
                value={raw}
                onChange={e => setRaw(e.target.value)}
                placeholder="e.g. 1000000000"
                min={0}
                style={{ ...inputStyle, paddingLeft: 46, borderColor: raw && !valid ? '#EF4444' : '#E3E8F0' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#1664FF')}
                onBlur={e => (e.currentTarget.style.borderColor = raw && !valid ? '#EF4444' : '#E3E8F0')}
              />
            </div>
            {parsed > 0 && (
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                = <strong style={{ fontFamily: 'monospace', color: '#1A2332' }}>{fmtMMK(parsed)}</strong>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <button onClick={onClose}
            className="rounded-md px-4 font-medium"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => { if (valid) { onSave(parsed); onClose() } }}
            className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: valid ? '#1664FF' : '#93C5FD', cursor: valid ? 'pointer' : 'not-allowed' }}
            onMouseEnter={e => { if (valid) e.currentTarget.style.background = '#0E4FCC' }}
            onMouseLeave={e => { if (valid) e.currentTarget.style.background = '#1664FF' }}>
            Save
          </button>
        </div>
      </div>
    </>
  )
}

// ── Long Stay Deal types & sub-components ─────────────────────────────────────

interface LsDiscountTier { id: string; minNights: number; discount: number }
interface LsForm {
  minNights: string
  maxNights: string
  tiers: LsDiscountTier[]
  hotelScope: 'all' | 'selected'
  hotelSearch: string
  selectedHotels: string[]
  funding: 'platform' | 'merchant' | 'shared'
  couponCompat: 'stacking' | 'only' | 'best'
  enabled: boolean
  priority: string
  displayBadge: boolean
  displayBanner: boolean
  budget: string
}

const BLANK_LS_FORM: LsForm = {
  minNights: '7', maxNights: '', tiers: [{ id: 'tier-1', minNights: 7, discount: 30 }],
  hotelScope: 'all', hotelSearch: '', selectedHotels: [],
  funding: 'platform', couponCompat: 'best',
  enabled: true, priority: '1', displayBadge: true, displayBanner: false, budget: '',
}

const SAMPLE_HOTELS = [
  'Sedona Hotel Yangon', 'Melia Yangon Hotel', 'Chatrium Hotel Royal Lake',
  'Novotel Yangon Max', 'Pullman Yangon Centrepoint', 'Pan Pacific Yangon',
  'Summit Parkview Hotel', 'Inya Lake Hotel', 'Traders Hotel Yangon',
  'Hilton Nay Pyi Taw', 'Amazing Bagan Resort', 'Aureum Palace Hotel',
]

function LongStayRulesSection({ ls, setLs }: { ls: LsForm; setLs: React.Dispatch<React.SetStateAction<LsForm>> }) {
  function setF<K extends keyof LsForm>(k: K, v: LsForm[K]) { setLs(p => ({ ...p, [k]: v })) }

  function addTier() {
    const maxMin = ls.tiers.reduce((m, t) => Math.max(m, t.minNights), 0)
    const newMin = maxMin + 7
    setLs(p => ({ ...p, tiers: [...p.tiers, { id: `tier-${Date.now()}`, minNights: newMin, discount: Math.min(70, p.tiers.at(-1)!.discount + 5) }] }))
  }

  function updateTier(id: string, field: 'minNights' | 'discount', val: string) {
    setLs(p => ({ ...p, tiers: p.tiers.map(t => t.id === id ? { ...t, [field]: parseInt(val) || 0 } : t) }))
  }

  function removeTier(id: string) {
    setLs(p => ({ ...p, tiers: p.tiers.filter(t => t.id !== id) }))
  }

  function toggleHotel(h: string) {
    setLs(p => ({ ...p, selectedHotels: p.selectedHotels.includes(h) ? p.selectedHotels.filter(x => x !== h) : [...p.selectedHotels, h] }))
  }

  const filteredHotels = SAMPLE_HOTELS.filter(h =>
    !ls.hotelSearch || h.toLowerCase().includes(ls.hotelSearch.toLowerCase())
  )

  const sectionHead = { fontSize: 12 as const, fontWeight: 700 as const, color: '#0E7490', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }
  const rowStyle: React.CSSProperties = { display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }
  const toggleBtn = (active: boolean, onClick: () => void, label: string) => (
    <button type="button" onClick={onClick}
      style={{ flex: 1, height: 34, borderRadius: 6, border: `1.5px solid ${active ? '#0E7490' : '#E3E8F0'}`, background: active ? '#ECFEFF' : '#fff', color: active ? '#0E7490' : '#64748B', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer' }}>
      {label}
    </button>
  )

  return (
    <div style={{ borderRadius: 8, border: '1.5px solid #A5F3FC', background: '#F0FDFF', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MoonStar size={14} color="#0E7490" />
        <span style={sectionHead}>Long Stay Rules</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94A3B8' }}>Configure minimum stay and discount tiers</span>
      </div>

      {/* Stay Qualification */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Stay Qualification</div>
        <div style={rowStyle}>
          <div>
            <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Min. Stay Nights <span style={{ color: '#DC2626' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input type="number" min={1} value={ls.minNights} onChange={e => setF('minNights', e.target.value)}
                style={{ ...inputStyle, paddingRight: 40 }} placeholder="e.g. 7" />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#94A3B8', pointerEvents: 'none' }}>nights</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Max. Stay Nights <span style={{ fontSize: 10, color: '#94A3B8' }}>(optional)</span></label>
            <div style={{ position: 'relative' }}>
              <input type="number" min={1} value={ls.maxNights} onChange={e => setF('maxNights', e.target.value)}
                style={{ ...inputStyle, paddingRight: 40 }} placeholder="e.g. 90" />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#94A3B8', pointerEvents: 'none' }}>nights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Discount Tiers */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Discount Tiers</div>
        <div style={{ border: '1px solid #E3E8F0', borderRadius: 6, overflow: 'hidden', background: '#fff', marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
            <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#64748B' }}>Min Nights</div>
            <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#64748B' }}>Discount %</div>
            <div />
          </div>
          {ls.tiers.map((tier, i) => (
            <div key={tier.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', borderBottom: i < ls.tiers.length - 1 ? '1px solid #F1F5F9' : 'none', alignItems: 'center' }}>
              <div style={{ padding: '6px 8px' }}>
                <input type="number" min={1} value={tier.minNights} onChange={e => updateTier(tier.id, 'minNights', e.target.value)}
                  style={{ width: '100%', fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', borderRadius: 4, padding: '5px 8px', outline: 'none', background: '#fff' }} />
              </div>
              <div style={{ padding: '6px 8px' }}>
                <div style={{ position: 'relative' }}>
                  <input type="number" min={1} max={100} value={tier.discount} onChange={e => updateTier(tier.id, 'discount', e.target.value)}
                    style={{ width: '100%', fontSize: 13, color: '#0E7490', fontWeight: 700, border: '1px solid #E3E8F0', borderRadius: 4, padding: '5px 28px 5px 8px', outline: 'none', background: '#fff' }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#0E7490', pointerEvents: 'none' }}>%</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button type="button" onClick={() => removeTier(tier.id)} disabled={ls.tiers.length === 1}
                  style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'none', cursor: ls.tiers.length === 1 ? 'not-allowed' : 'pointer', color: '#94A3B8', opacity: ls.tiers.length === 1 ? 0.4 : 1 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addTier}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', fontSize: 12, color: '#0E7490', border: '1px dashed #A5F3FC', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
          <Plus size={11} /> Add Tier
        </button>
        {/* Preview */}
        {ls.tiers.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[...ls.tiers].sort((a, b) => a.minNights - b.minNights).map(t => (
              <span key={t.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#ECFEFF', color: '#0E7490', fontWeight: 600, border: '1px solid #A5F3FC' }}>
                {t.minNights}+ nights → {t.discount}% off
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Participating Hotels */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Participating Hotels</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {toggleBtn(ls.hotelScope === 'all',      () => setF('hotelScope', 'all'),      'All Hotels')}
          {toggleBtn(ls.hotelScope === 'selected', () => setF('hotelScope', 'selected'), 'Selected Hotels')}
        </div>
        {ls.hotelScope === 'selected' && (
          <div>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <Hotel size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input value={ls.hotelSearch} onChange={e => setF('hotelSearch', e.target.value)}
                placeholder="Search hotels…" style={{ ...inputStyle, paddingLeft: 28, background: '#fff' }} />
            </div>
            <div style={{ border: '1px solid #E3E8F0', borderRadius: 6, maxHeight: 132, overflowY: 'auto', background: '#fff' }}>
              {filteredHotels.map(h => (
                <label key={h} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', fontSize: 12, color: '#1A2332', borderBottom: '1px solid #F8FAFC', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <input type="checkbox" checked={ls.selectedHotels.includes(h)} onChange={() => toggleHotel(h)} style={{ accentColor: '#0E7490' }} />
                  {h}
                </label>
              ))}
              {filteredHotels.length === 0 && <div style={{ padding: '12px 10px', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>No hotels found</div>}
            </div>
            {ls.selectedHotels.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#0E7490', fontWeight: 500 }}>
                {ls.selectedHotels.length} hotel{ls.selectedHotels.length > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
        )}
      </div>

      {/* Merchant Participation (Funding) */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Merchant Participation</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['platform', 'merchant', 'shared'] as const).map(f => toggleBtn(ls.funding === f, () => setF('funding', f), f === 'platform' ? 'Platform Funded' : f === 'merchant' ? 'Merchant Funded' : 'Shared Funding'))}
        </div>
      </div>

      {/* Coupon Compatibility */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Coupon Compatibility</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {toggleBtn(ls.couponCompat === 'stacking', () => setF('couponCompat', 'stacking'), 'Allow Stacking')}
          {toggleBtn(ls.couponCompat === 'only',     () => setF('couponCompat', 'only'),     'Long Stay Only')}
          {toggleBtn(ls.couponCompat === 'best',     () => setF('couponCompat', 'best'),     'Best Wins')}
        </div>
      </div>

      {/* Campaign Settings */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Campaign Settings</div>
        <div style={rowStyle}>
          <div>
            <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Priority</label>
            <input type="number" min={1} max={99} value={ls.priority} onChange={e => setF('priority', e.target.value)}
              placeholder="1 = highest" style={{ ...inputStyle }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 4 }}>Campaign Budget (optional)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94A3B8', pointerEvents: 'none' }}>MMK</span>
              <input type="number" min={0} value={ls.budget} onChange={e => setF('budget', e.target.value)}
                placeholder="No cap" style={{ ...inputStyle, paddingLeft: 38 }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          {[
            { key: 'enabled',       label: 'Enable Campaign' },
            { key: 'displayBadge',  label: 'Display Badge' },
            { key: 'displayBanner', label: 'Display Banner' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={ls[key as 'enabled' | 'displayBadge' | 'displayBanner']}
                onChange={e => setF(key as 'enabled' | 'displayBadge' | 'displayBanner', e.target.checked)}
                style={{ accentColor: '#0E7490', width: 14, height: 14 }} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Create Campaign Drawer ────────────────────────────────────────────────────

const CAMP_BUDGET_TOTAL_INIT     = 1_000_000_000
const CAMP_BUDGET_ALLOCATED_INIT = 650_000_000

function fmtMMK(n: number) {
  if (n >= 1_000_000_000) return `MMK ${(n / 1_000_000_000).toFixed(3).replace(/\.?0+$/, '')}B`
  if (n >= 1_000_000)     return `MMK ${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000)         return `MMK ${(n / 1_000).toFixed(0)}K`
  return `MMK ${n.toLocaleString()}`
}

function MerchantSingleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #E3E8F0', maxHeight: 132, overflowY: 'auto' }}>
      {merchantOptions.map(m => (
        <label key={m} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer" style={{ fontSize: 12, color: '#1A2332', borderBottom: '1px solid #F8FAFC' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <input type="radio" name="camp-merchant-single" checked={value === m} onChange={() => onChange(m)} style={{ accentColor: '#1664FF' }} />
          {m}
        </label>
      ))}
    </div>
  )
}

function CreateCampaignDrawer({ open, onClose, onSave, platformTotal, platformAllocated }: { open: boolean; onClose: () => void; onSave: (amount: number, type: string) => void; platformTotal: number; platformAllocated: number }) {
  const [form, setForm] = useState({
    name: '',
    owner: 'platform' as 'platform' | 'merchant',
    type: 'flash_sale',
    rewardType: 'voucher',
    goal: '',
    allocatedBudget: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '23:59',
    merchants: [] as string[],
    merchantSingle: '',
  })
  const [touched, setTouch] = useState({ budget: false, dates: false, merchant: false })
  const [lsForm, setLsForm] = useState<LsForm>({ ...BLANK_LS_FORM })
  const [services, setServices] = useState<string[]>(['hotel'])
  const isLongStay = form.type === 'long_stay_deal'

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.value
    setForm(f => ({
      ...f,
      [k]: val,
      // if switching owner, reset merchant selections
      ...(k === 'owner' ? { merchants: [], merchantSingle: '' } : {}),
    }))
  }

  // Budget calculations
  const platformAvailable = platformTotal - platformAllocated
  const budgetNum = parseFloat(form.allocatedBudget.replace(/,/g, '')) || 0
  const isMerchantOwner = form.owner === 'merchant'
  const budgetExceeds = !isMerchantOwner && budgetNum > 0 && budgetNum > platformAvailable
  const balanceAfter = platformAvailable - budgetNum
  const budgetUsedPct = Math.min(100, Math.round(platformAllocated / platformTotal * 100))
  const budgetAfterPct = Math.min(100, Math.round((platformAllocated + budgetNum) / platformTotal * 100))

  // Date/time validation
  function parseDateTime(date: string, time: string) {
    if (!date || !time) return null
    return new Date(`${date}T${time}`)
  }
  const startDT = parseDateTime(form.startDate, form.startTime)
  const endDT   = parseDateTime(form.endDate,   form.endTime)
  const dateInvalid = !!(startDT && endDT && endDT <= startDT)

  // Merchant validation
  const merchantError = touched.merchant &&
    form.owner === 'merchant' && !form.merchantSingle

  // Can save
  const lsValid = !isLongStay || (lsForm.minNights && lsForm.tiers.length > 0 &&
    (lsForm.hotelScope === 'all' || lsForm.selectedHotels.length > 0))
  const canSave = form.name.trim() && !budgetExceeds && !dateInvalid && !merchantError && lsValid

  return (
    <Drawer open={open} onClose={onClose} title="Create Campaign" subtitle="Configure a new promotional campaign" width={520}>
      <div className="space-y-4">

        {/* Campaign Name */}
        <FormField label="Campaign Name" required>
          <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="e.g. Christmas Campaign 2026" />
        </FormField>

        {/* Campaign Owner */}
        <FormField label="Campaign Owner" required>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {([
              { value: 'platform', label: 'mTrip Platform', sub: 'Platform budget funded' },
              { value: 'merchant', label: 'Merchant',       sub: 'Merchant self-funded' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, owner: opt.value, merchants: [], merchantSingle: '' }))}
                style={{
                  border: `1.5px solid ${form.owner === opt.value ? '#1664FF' : '#E3E8F0'}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  background: form.owner === opt.value ? '#EEF4FF' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: form.owner === opt.value ? '#1664FF' : '#1A2332' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: form.owner === opt.value ? '#3B82F6' : '#94A3B8', marginTop: 1 }}>{opt.sub}</div>
              </button>
            ))}
          </div>
        </FormField>

        {/* Campaign Type + Reward Type */}
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Campaign Type" required>
            <select style={selectStyle} value={form.type} onChange={set('type')}>
              <option value="flash_sale">Flash Sale</option>
              <option value="seasonal">Seasonal</option>
              <option value="loyalty">Loyalty</option>
              <option value="partnership">Partnership</option>
              <option value="referral">Referral</option>
              <option value="long_stay_deal">Long Stay Deal</option>
            </select>
          </FormField>
          <FormField label="Reward Type" required>
            <select style={selectStyle} value={form.rewardType} onChange={set('rewardType')}>
              <option value="promotion">Promotion</option>
              <option value="voucher">Voucher</option>
              <option value="coupon">Coupon</option>
              <option value="promo_code">Promotion Code</option>
              <option value="welcome_reward">Welcome Reward</option>
            </select>
          </FormField>
        </div>

        {/* Applicable Services */}
        <FormField label="Applicable Services" required>
          <ApplicableServicesSelect value={services} onChange={setServices} />
          {services.length > 0 && (
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 5 }}>
              Eligible merchants will be filtered to those offering: <strong>{services.map(s => SERVICE_OPTIONS.find(o => o.value === s)?.label).join(', ')}</strong>
            </div>
          )}
        </FormField>

        {/* Campaign Goal */}
        <FormField label="Campaign Goal">
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }} value={form.goal} onChange={set('goal')} placeholder="Describe the objective of this campaign..." />
        </FormField>

        {/* Campaign Budget Account — only for platform campaigns */}
        {!isMerchantOwner && (
          <>
            {/* Budget account summary card */}
            <div className="rounded-lg p-3" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Campaign Budget Account</div>
              <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                {[
                  { label: 'Total Budget',              value: fmtMMK(platformTotal),   color: '#1A2332' },
                  { label: 'Current Allocated Budget', value: fmtMMK(platformAllocated), color: '#D97706' },
                  { label: 'Current Available Budget', value: fmtMMK(platformAvailable), color: '#059669' },
                ].map(s => (
                  <div key={s.label} className="rounded px-2.5 py-2" style={{ background: '#fff', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {/* Utilization bar */}
              <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${budgetUsedPct}%`, background: '#1664FF', borderRadius: 3, transition: 'width 0.3s' }} />
                {budgetNum > 0 && !budgetExceeds && (
                  <div style={{ position: 'absolute', left: `${budgetUsedPct}%`, top: 0, height: '100%', width: `${Math.min(budgetAfterPct - budgetUsedPct, 100 - budgetUsedPct)}%`, background: '#93C5FD', transition: 'width 0.3s' }} />
                )}
                {budgetNum > 0 && budgetExceeds && (
                  <div style={{ position: 'absolute', left: `${budgetUsedPct}%`, top: 0, height: '100%', right: 0, background: '#FCA5A5', transition: 'width 0.3s' }} />
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5" style={{ fontSize: 10, color: '#94A3B8' }}>
                <span>{budgetUsedPct}% allocated</span>
                <span>{100 - budgetUsedPct}% available</span>
              </div>
            </div>

            {/* Allocated Budget input */}
            <FormField label="Allocated Budget (MMK)" required>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8', pointerEvents: 'none' }}>MMK</span>
                <input
                  style={{ ...inputStyle, paddingLeft: 46, borderColor: budgetExceeds && touched.budget ? '#EF4444' : inputStyle.borderColor }}
                  type="number"
                  value={form.allocatedBudget}
                  onChange={set('allocatedBudget')}
                  onBlur={() => setTouch(t => ({ ...t, budget: true }))}
                  placeholder="e.g. 50000000"
                  min={0}
                />
              </div>
              {budgetNum > 0 && !budgetExceeds && (
                <div className="space-y-1" style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: '#1664FF' }}>
                    New Campaign Allocation: <strong style={{ fontFamily: 'monospace' }}>{fmtMMK(budgetNum)}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: '#059669' }}>
                    Remaining Budget After Save: <strong style={{ fontFamily: 'monospace' }}>{fmtMMK(balanceAfter)}</strong>
                  </div>
                </div>
              )}
              {budgetExceeds && touched.budget && (
                <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                  Allocated budget exceeds the available platform campaign budget.
                </div>
              )}
            </FormField>
          </>
        )}

        {/* Campaign Schedule */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Campaign Schedule <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>
          </div>
          <div className="rounded-lg p-3" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <FormField label="Start Date">
                <input style={{ ...inputStyle, borderColor: dateInvalid && touched.dates ? '#EF4444' : (inputStyle.borderColor as string) }} type="date" value={form.startDate}
                  onChange={set('startDate')} onBlur={() => setTouch(t => ({ ...t, dates: true }))} />
              </FormField>
              <FormField label="Start Time">
                <input style={inputStyle} type="time" value={form.startTime}
                  onChange={set('startTime')} onBlur={() => setTouch(t => ({ ...t, dates: true }))} />
              </FormField>
              <FormField label="End Date">
                <input style={{ ...inputStyle, borderColor: dateInvalid && touched.dates ? '#EF4444' : (inputStyle.borderColor as string) }} type="date" value={form.endDate}
                  onChange={set('endDate')} onBlur={() => setTouch(t => ({ ...t, dates: true }))} />
              </FormField>
              <FormField label="End Time">
                <input style={inputStyle} type="time" value={form.endTime}
                  onChange={set('endTime')} onBlur={() => setTouch(t => ({ ...t, dates: true }))} />
              </FormField>
            </div>
            {dateInvalid && touched.dates && (
              <div style={{ fontSize: 11, color: '#DC2626', marginTop: 8 }}>
                End date & time must be after the start date & time.
              </div>
            )}
          </div>
        </div>

        {/* Long Stay Rules — only when Long Stay Deal is selected */}
        {isLongStay && <LongStayRulesSection ls={lsForm} setLs={setLsForm} />}

        {/* Participating Merchants */}
        <FormField label={isLongStay ? 'Participating Merchants (Override)' : 'Participating Merchants'}>
          {isMerchantOwner ? (
            <>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>
                {form.merchantSingle ? (
                  <span style={{ color: '#1664FF', fontWeight: 500 }}>{form.merchantSingle} selected</span>
                ) : (
                  <span style={{ color: '#EF4444' }}>Select one merchant (required for Merchant campaigns)</span>
                )}
              </div>
              <MerchantSingleSelect
                value={form.merchantSingle}
                onChange={v => { setForm(f => ({ ...f, merchantSingle: v })); setTouch(t => ({ ...t, merchant: true })) }}
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>
                {form.merchants.length === 0 ? 'All merchants (default)' : `${form.merchants.length} selected`}
              </div>
              <MerchantMultiSelect value={form.merchants} onChange={v => setForm(f => ({ ...f, merchants: v }))} services={services} />
            </>
          )}
          {merchantError && (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Please select a merchant for Merchant campaigns.</div>
          )}
        </FormField>

        {/* Footer buttons */}
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button
            onClick={() => { if (canSave) onSave(!isMerchantOwner ? budgetNum : 0, form.type) }}
            className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: canSave ? (isLongStay ? '#0E7490' : '#1664FF') : '#93C5FD', cursor: canSave ? 'pointer' : 'not-allowed' }}>
            <Plus size={13} /> {isLongStay ? 'Create Long Stay Deal' : 'Create Campaign'}
          </button>
          <button onClick={onClose} className="rounded-md px-4 font-medium" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Cancel</button>
          <button className="ml-auto rounded-md px-3" style={{ height: 34, fontSize: 12, color: '#64748B', border: '1px solid #E3E8F0' }}>Save as Draft</button>
        </div>
      </div>
    </Drawer>
  )
}


// ── Create Voucher Drawer ─────────────────────────────────────────────────────

function CreateVoucherDrawer({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', campaignId: '', voucherType: 'fixed', value: '', quantity: '', validFrom: '', validTo: '', minSpend: '', perUserLimit: '', totalRedemptionLimit: '', merchants: [] as string[] })
  const [services, setServices] = useState<string[]>(['hotel'])
  const [crossServiceUsage, setCrossServiceUsage] = useState('once_all')
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <Drawer open={open} onClose={onClose} title="Create Voucher" subtitle="Issue a new voucher for platform promotions" width={520}>
      <div className="space-y-4">
        <FormField label="Voucher Name" required>
          <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="e.g. Christmas VIP Voucher" />
        </FormField>
        <FormField label="Link to Campaign">
          <select style={selectStyle} value={form.campaignId} onChange={set('campaignId')}>
            <option value="">— Standalone (no campaign) —</option>
            {campaigns.filter(c => c.status !== 'ended').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Applicable Services" required>
          <ApplicableServicesSelect value={services} onChange={setServices} />
        </FormField>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Voucher Type" required>
            <select style={selectStyle} value={form.voucherType} onChange={set('voucherType')}>
              <option value="fixed">Fixed Amount (¥)</option>
              <option value="percentage">Percentage (%)</option>
              <option value="free_night">Free Night</option>
              <option value="upgrade">Room Upgrade</option>
            </select>
          </FormField>
          <FormField label="Voucher Value" required>
            <input style={inputStyle} value={form.value} onChange={set('value')} placeholder={form.voucherType === 'percentage' ? 'e.g. 15' : 'e.g. 200'} />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Quantity to Issue" required>
            <input style={inputStyle} type="number" value={form.quantity} onChange={set('quantity')} placeholder="e.g. 1000" />
          </FormField>
          <FormField label="Min. Spend (¥)">
            <input style={inputStyle} type="number" value={form.minSpend} onChange={set('minSpend')} placeholder="e.g. 500" />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Valid From" required>
            <input style={inputStyle} type="date" value={form.validFrom} onChange={set('validFrom')} />
          </FormField>
          <FormField label="Valid To" required>
            <input style={inputStyle} type="date" value={form.validTo} onChange={set('validTo')} />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Per-User Limit">
            <input style={inputStyle} type="number" value={form.perUserLimit} onChange={set('perUserLimit')} placeholder="e.g. 1" />
          </FormField>
          <FormField label="Total Redemption Cap">
            <input style={inputStyle} type="number" value={form.totalRedemptionLimit} onChange={set('totalRedemptionLimit')} placeholder="e.g. 5000" />
          </FormField>
        </div>
        <FormField label="Eligible Merchants">
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>
            {form.merchants.length === 0 ? 'All merchants (default)' : `${form.merchants.length} selected`}
          </div>
          <MerchantMultiSelect value={form.merchants} onChange={v => setForm(f => ({ ...f, merchants: v }))} services={services} />
        </FormField>
        {services.length > 1 && (
          <FormField label="Cross-Service Usage Rule">
            <select style={selectStyle} value={crossServiceUsage} onChange={e => setCrossServiceUsage(e.target.value)}>
              <option value="once_all">Once across all services (shared redemption)</option>
              <option value="once_per">Once per service (independent redemption)</option>
              <option value="any_one">Any one service only (first use locks service)</option>
            </select>
          </FormField>
        )}
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button onClick={onSave} className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium" style={{ height: 34, fontSize: 13, background: '#059669' }}>
            <Ticket size={13} /> Create Voucher
          </button>
          <button onClick={onClose} className="rounded-md px-4 font-medium" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Cancel</button>
        </div>
      </div>
    </Drawer>
  )
}

// ── Create Promo Code Drawer ──────────────────────────────────────────────────

function CreatePromoCodeDrawer({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', campaignId: '', discountType: 'percentage', discountValue: '', usageLimit: '', perUserLimit: '', validFrom: '', validTo: '', minSpend: '', stackable: 'no', merchants: [] as string[] })
  const [services, setServices] = useState<string[]>(['hotel'])
  const [crossServiceUsage, setCrossServiceUsage] = useState('once_all')
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    setForm(f => ({ ...f, code: Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') }))
  }
  return (
    <Drawer open={open} onClose={onClose} title="Create Promo Code" subtitle="Generate a new promotion code for campaigns" width={520}>
      <div className="space-y-4">
        <FormField label="Promo Code" required>
          <div className="flex gap-2">
            <input style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase' }}
              value={form.code} onChange={set('code')} placeholder="e.g. SUMMER25" maxLength={16} />
            <button onClick={generateCode} className="rounded-md px-3 flex-shrink-0 font-medium"
              style={{ height: 38, fontSize: 12, color: '#1664FF', border: '1px solid #BFDBFE', background: '#EEF4FF', whiteSpace: 'nowrap' }}>
              Auto-generate
            </button>
          </div>
        </FormField>
        <FormField label="Code Name / Description">
          <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="e.g. Business Travel Discount" />
        </FormField>
        <FormField label="Link to Campaign">
          <select style={selectStyle} value={form.campaignId} onChange={set('campaignId')}>
            <option value="">— Standalone (no campaign) —</option>
            {campaigns.filter(c => c.status !== 'ended').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Applicable Services" required>
          <ApplicableServicesSelect value={services} onChange={setServices} />
        </FormField>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Discount Type" required>
            <select style={selectStyle} value={form.discountType} onChange={set('discountType')}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (¥)</option>
              <option value="free_night">Free Night</option>
              <option value="cashback">Cashback</option>
            </select>
          </FormField>
          <FormField label="Discount Value" required>
            <input style={inputStyle} value={form.discountValue} onChange={set('discountValue')}
              placeholder={form.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 150'} />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Total Usage Limit">
            <input style={inputStyle} type="number" value={form.usageLimit} onChange={set('usageLimit')} placeholder="e.g. 500" />
          </FormField>
          <FormField label="Per-User Limit">
            <input style={inputStyle} type="number" value={form.perUserLimit} onChange={set('perUserLimit')} placeholder="e.g. 1" />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Valid From" required>
            <input style={inputStyle} type="date" value={form.validFrom} onChange={set('validFrom')} />
          </FormField>
          <FormField label="Valid To" required>
            <input style={inputStyle} type="date" value={form.validTo} onChange={set('validTo')} />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Min. Spend (¥)">
            <input style={inputStyle} type="number" value={form.minSpend} onChange={set('minSpend')} placeholder="e.g. 300" />
          </FormField>
          <FormField label="Stackable with Other Codes">
            <select style={selectStyle} value={form.stackable} onChange={set('stackable')}>
              <option value="no">No — exclusive</option>
              <option value="yes">Yes — can stack</option>
            </select>
          </FormField>
        </div>
        <FormField label="Merchant Eligibility">
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>
            {form.merchants.length === 0 ? 'All merchants (default)' : `${form.merchants.length} selected`}
          </div>
          <MerchantMultiSelect value={form.merchants} onChange={v => setForm(f => ({ ...f, merchants: v }))} services={services} />
        </FormField>
        {services.length > 1 && (
          <FormField label="Cross-Service Usage Rule">
            <select style={selectStyle} value={crossServiceUsage} onChange={e => setCrossServiceUsage(e.target.value)}>
              <option value="once_all">Once across all services (shared redemption)</option>
              <option value="once_per">Once per service (independent redemption)</option>
              <option value="any_one">Any one service only (first use locks service)</option>
            </select>
          </FormField>
        )}
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button onClick={onSave} className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium" style={{ height: 34, fontSize: 13, background: '#7C3AED' }}>
            <Code2 size={13} /> Create Promo Code
          </button>
          <button onClick={onClose} className="rounded-md px-4 font-medium" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Cancel</button>
        </div>
      </div>
    </Drawer>
  )
}

// ── Campaign Detail Drawer ────────────────────────────────────────────────────

function CampaignDetailDrawer({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  if (!campaign) return null
  const linkedV = vouchers.filter(v => v.campaignId === campaign.id)
  const linkedP = promoCodes.filter(p => p.campaignId === campaign.id)
  const spentPct = campaign.budget > 0 ? Math.round(campaign.spent / campaign.budget * 100) : 0

  return (
    <Drawer open={!!campaign} onClose={onClose} title={campaign.name} subtitle={`${campaign.id} · Campaign`} width={580}>
      <div className="space-y-5">
        {/* Overview */}
        <div className="rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
          <div className="flex items-center justify-between mb-3">
            <CampaignTypeBadge type={campaign.type} />
            <StatusBadge status={campaign.status} />
          </div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 12, lineHeight: 1.6 }}>{campaign.goal || 'No goal description provided.'}</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {[
              { label: 'Start Date',      value: campaign.startDate || 'TBD' },
              { label: 'End Date',        value: campaign.endDate || 'TBD' },
              { label: 'Merchants',       value: campaign.merchantCount > 0 ? `${campaign.merchantCount} merchants` : 'All merchants' },
              { label: 'Created By',      value: campaign.createdBy },
            ].map(f => (
              <div key={f.label} className="rounded px-3 py-2" style={{ background: '#fff', border: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>
          {/* Budget bar */}
          <div className="mt-3 rounded px-3 py-2" style={{ background: '#fff', border: '1px solid #F1F5F9' }}>
            <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 12 }}>
              <span style={{ color: '#94A3B8' }}>Budget Utilization</span>
              <span style={{ color: '#1A2332', fontWeight: 600 }}>¥{(campaign.spent / 1000).toFixed(0)}K / ¥{(campaign.budget / 1000).toFixed(0)}K ({spentPct}%)</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#F1F5F9' }}>
              <div className="h-full rounded-full" style={{ width: `${spentPct}%`, background: spentPct > 90 ? '#DC2626' : spentPct > 70 ? '#D97706' : '#1664FF' }} />
            </div>
          </div>
        </div>

        {/* Performance */}
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Performance</h4>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            {[
              { label: 'Total Claims',     value: campaign.totalClaims.toLocaleString(), color: '#1664FF' },
              { label: 'Conversions',      value: campaign.conversions.toLocaleString(), color: '#059669' },
              { label: 'Revenue',          value: campaign.revenue > 0 ? `¥${(campaign.revenue / 1000000).toFixed(2)}M` : '—', color: '#D97706' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-3 text-center" style={{ border: '1px solid #E3E8F0' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Linked Vouchers */}
        {linkedV.length > 0 && (
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Linked Vouchers ({linkedV.length})
            </h4>
            <div className="space-y-1.5">
              {linkedV.map(v => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
                  <Ticket size={14} color="#059669" />
                  <div className="flex-1">
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{v.id} · {v.valueDisplay} · {v.claimed.toLocaleString()} claimed</div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Promo Codes */}
        {linkedP.length > 0 && (
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Linked Promo Codes ({linkedP.length})
            </h4>
            <div className="space-y-1.5">
              {linkedP.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
                  <Tag size={14} color="#7C3AED" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{p.code}</span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>{p.discountDisplay}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.usageCount.toLocaleString()} / {p.usageLimit.toLocaleString()} uses</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

const CAMPAIGN_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  flash_sale:     { label: 'Flash Sale',     color: '#BE123C', bg: '#FFF1F3' },
  seasonal:       { label: 'Seasonal',       color: '#1D4ED8', bg: '#EFF6FF' },
  loyalty:        { label: 'Loyalty',        color: '#92400E', bg: '#FEF3C7' },
  partnership:    { label: 'Partnership',    color: '#6D28D9', bg: '#F3E8FF' },
  referral:       { label: 'Referral',       color: '#065F46', bg: '#ECFDF3' },
  long_stay_deal: { label: 'Long Stay Deal', color: '#0E7490', bg: '#ECFEFF' },
}

function SortIcon({ field, sort }: { field: string; sort: { key: string; dir: 'asc' | 'desc' } }) {
  if (sort.key !== field) return <ChevronsUpDown size={11} color="#CBD5E1" />
  return sort.dir === 'asc' ? <ChevronUp size={11} color="#1664FF" /> : <ChevronDown size={11} color="#1664FF" />
}


// SVG sparkline for trend line
function Sparkline({ data, color, width = 120, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// Funnel step
function FunnelStep({ label, value, subValue, color, bg, pct, isFirst }: {
  label: string; value: string; subValue: string; color: string; bg: string; pct: number; isFirst: boolean
}) {
  return (
    <div style={{ position: 'relative' }}>
      {!isFirst && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
          <div style={{ width: 1, height: 14, background: '#E3E8F0' }} />
        </div>
      )}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ background: bg, border: `1px solid ${color}22` }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{subValue}</div>
        </div>
        <div className="text-right">
          <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
          {!isFirst && <div style={{ fontSize: 10, color: '#94A3B8' }}>{pct}% of prev</div>}
        </div>
      </div>
    </div>
  )
}

// Compare Period modal
function ComparePeriodModal({ open, onClose, showToast: _toast }: { open: boolean; onClose: () => void; showToast: (t: 'error' | 'success' | 'warning' | 'info', m: string, s?: string) => void }) {
  const [mode, setMode] = useState<'campaign' | 'period'>('campaign')
  const [campA, setCampA] = useState(campaigns[0]?.id ?? '')
  const [campB, setCampB] = useState(campaigns[1]?.id ?? '')
  const [p1Start, setP1Start] = useState('2024-11-01')
  const [p1End, setP1End] = useState('2024-11-30')
  const [p2Start, setP2Start] = useState('2024-12-01')
  const [p2End, setP2End] = useState('2024-12-31')

  if (!open) return null

  const a = campaigns.find(c => c.id === campA)
  const b = campaigns.find(c => c.id === campB)

  const roiA = a && a.budget > 0 ? ((a.revenue - a.budget) / a.budget * 100).toFixed(1) : '—'
  const roiB = b && b.budget > 0 ? ((b.revenue - b.budget) / b.budget * 100).toFixed(1) : '—'
  const convA = a && a.totalClaims > 0 ? (a.conversions / a.totalClaims * 100).toFixed(1) : '0.0'
  const convB = b && b.totalClaims > 0 ? (b.conversions / b.totalClaims * 100).toFixed(1) : '0.0'

  const pRows = [
    { label: 'Campaign Type',     vA: a ? CAMPAIGN_TYPE_META[a.type]?.label : '—',  vB: b ? CAMPAIGN_TYPE_META[b.type]?.label : '—', highlight: false },
    { label: 'Status',            vA: a?.status ?? '—',          vB: b?.status ?? '—',          highlight: false },
    { label: 'Budget',            vA: a ? `¥${(a.budget/1000).toFixed(0)}K` : '—', vB: b ? `¥${(b.budget/1000).toFixed(0)}K` : '—', highlight: false },
    { label: 'Spent',             vA: a ? `¥${(a.spent/1000).toFixed(0)}K` : '—',  vB: b ? `¥${(b.spent/1000).toFixed(0)}K` : '—',  highlight: false },
    { label: 'Revenue',           vA: a && a.revenue > 0 ? `¥${(a.revenue/1000000).toFixed(2)}M` : '¥0', vB: b && b.revenue > 0 ? `¥${(b.revenue/1000000).toFixed(2)}M` : '¥0', highlight: true },
    { label: 'ROI',               vA: roiA !== '—' ? `${roiA}%` : '—', vB: roiB !== '—' ? `${roiB}%` : '—', highlight: true },
    { label: 'Total Claims',      vA: a ? a.totalClaims.toLocaleString() : '—', vB: b ? b.totalClaims.toLocaleString() : '—', highlight: false },
    { label: 'Conversions',       vA: a ? a.conversions.toLocaleString() : '—',  vB: b ? b.conversions.toLocaleString() : '—',  highlight: false },
    { label: 'Conversion Rate',   vA: `${convA}%`, vB: `${convB}%`, highlight: true },
    { label: 'Merchants',         vA: a ? (a.merchantCount > 0 ? String(a.merchantCount) : 'All') : '—', vB: b ? (b.merchantCount > 0 ? String(b.merchantCount) : 'All') : '—', highlight: false },
  ]

  // Period comparison synthetic data
  const periodRows = [
    { label: 'Total Impressions', p1: '1,840,000', p2: '2,400,000', delta: '+30.4%', up: true },
    { label: 'Clicks',            p1: '78,200',    p2: '112,800',   delta: '+44.2%', up: true },
    { label: 'Total Claims',      p1: '98,400',    p2: '128,240',   delta: '+30.3%', up: true },
    { label: 'Conversions',       p1: '72,100',    p2: '99,750',    delta: '+38.3%', up: true },
    { label: 'Conversion Rate',   p1: '9.8%',      p2: '11.2%',     delta: '+1.4pp', up: true },
    { label: 'Revenue',           p1: '¥58.4M',    p2: '¥74.2M',    delta: '+27.1%', up: true },
    { label: 'Campaign ROI',      p1: '842%',      p2: '1,140%',    delta: '+298pp', up: true },
    { label: 'Active Campaigns',  p1: '4',         p2: '6',         delta: '+2',     up: true },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>Compare Performance</h2>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Analyse differences across campaigns or time periods</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, border: '1px solid #E3E8F0' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X size={14} color="#64748B" />
          </button>
        </div>
        {/* Mode tabs */}
        <div className="flex items-center gap-1 px-5 pt-4 pb-3">
          {(['campaign', 'period'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="rounded-md px-4 capitalize font-medium"
              style={{ height: 32, fontSize: 13, background: mode === m ? '#1664FF' : 'transparent', color: mode === m ? '#fff' : '#64748B', border: mode === m ? 'none' : '1px solid #E3E8F0' }}>
              {m === 'campaign' ? 'Campaign vs Campaign' : 'Period vs Period'}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', padding: '0 20px 20px' }}>
          {mode === 'campaign' ? (
            <>
              {/* Campaign selectors */}
              <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {([{ label: 'Campaign A', val: campA, set: setCampA, color: '#1664FF' }, { label: 'Campaign B', val: campB, set: setCampB, color: '#7C3AED' }] as const).map(col => (
                  <div key={col.label}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{col.label}</div>
                    <select value={col.val} onChange={e => (col.set as (v: string) => void)(e.target.value)}
                      style={{ width: '100%', fontSize: 13, color: '#1A2332', border: `1px solid ${col.color}44`, borderRadius: 6, padding: '7px 10px', outline: 'none', background: `${col.color}08` }}>
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {/* Comparison table */}
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#64748B', width: '30%' }}>Metric</th>
                      <th className="text-right px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#1664FF' }}>{a?.name ?? 'Campaign A'}</th>
                      <th className="text-right px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED' }}>{b?.name ?? 'Campaign B'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pRows.map((row, i) => (
                      <tr key={row.label} style={{ background: row.highlight ? '#FAFBFF' : i % 2 === 0 ? '#fff' : '#FAFAFA', borderTop: '1px solid #F1F5F9' }}>
                        <td className="px-4 py-2.5" style={{ fontSize: 12, color: '#64748B', fontWeight: row.highlight ? 600 : 400 }}>{row.label}</td>
                        <td className="px-4 py-2.5 text-right" style={{ fontSize: 13, color: row.highlight ? '#1664FF' : '#1A2332', fontWeight: row.highlight ? 700 : 500, fontFamily: 'monospace' }}>{row.vA}</td>
                        <td className="px-4 py-2.5 text-right" style={{ fontSize: 13, color: row.highlight ? '#7C3AED' : '#1A2332', fontWeight: row.highlight ? 700 : 500, fontFamily: 'monospace' }}>{row.vB}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              {/* Period selectors */}
              <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {([
                  { label: 'Period 1', color: '#64748B', s: p1Start, e: p1End, setS: setP1Start, setE: setP1End },
                  { label: 'Period 2', color: '#1664FF', s: p2Start, e: p2End, setS: setP2Start, setE: setP2End },
                ] as const).map(col => (
                  <div key={col.label}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{col.label}</div>
                    <div className="flex items-center gap-2">
                      <input type="date" value={col.s} onChange={e => (col.setS as (v: string) => void)(e.target.value)}
                        style={{ flex: 1, fontSize: 12, color: '#1A2332', border: `1px solid ${col.color}44`, borderRadius: 6, padding: '7px 8px', outline: 'none', background: `${col.color}08` }} />
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>to</span>
                      <input type="date" value={col.e} onChange={e => (col.setE as (v: string) => void)(e.target.value)}
                        style={{ flex: 1, fontSize: 12, color: '#1A2332', border: `1px solid ${col.color}44`, borderRadius: 6, padding: '7px 8px', outline: 'none', background: `${col.color}08` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E3E8F0' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#64748B', width: '30%' }}>Metric</th>
                      <th className="text-right px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{p1Start} → {p1End}</th>
                      <th className="text-right px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#1664FF' }}>{p2Start} → {p2End}</th>
                      <th className="text-right px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodRows.map((row, i) => (
                      <tr key={row.label} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderTop: '1px solid #F1F5F9' }}>
                        <td className="px-4 py-2.5" style={{ fontSize: 12, color: '#64748B' }}>{row.label}</td>
                        <td className="px-4 py-2.5 text-right" style={{ fontSize: 13, color: '#64748B', fontFamily: 'monospace' }}>{row.p1}</td>
                        <td className="px-4 py-2.5 text-right" style={{ fontSize: 13, color: '#1664FF', fontWeight: 600, fontFamily: 'monospace' }}>{row.p2}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span style={{ fontSize: 12, fontWeight: 600, color: row.up ? '#059669' : '#DC2626', background: row.up ? '#ECFDF3' : '#FFF1F3', padding: '2px 7px', borderRadius: 4 }}>{row.delta}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button onClick={onClose} className="rounded-md px-4" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Close</button>
          <button className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium" style={{ height: 34, fontSize: 13, background: '#1664FF' }}>
            <Download size={13} /> Export Comparison
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Campaign Analytics Page ───────────────────────────────────────────────────

function CampaignAnalyticsPage({ showToast }: { showToast: (type: 'error' | 'success' | 'warning' | 'info', title: string, message?: string) => void }) {
  const [filterCampaign, setFilterCampaign] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterService, setFilterService] = useState('')
  const [filterMerchant, setFilterMerchant] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('last_30')
  const [filterSource, setFilterSource] = useState('')
  const [compareOpen, setCompareOpen] = useState(false)
  const [sortKey, setSortKey] = useState('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // Filtered campaign set
  const filteredCampaigns = useMemo(() => campaigns.filter(c => {
    if (filterCampaign && c.id !== filterCampaign) return false
    if (filterType && c.type !== filterType) return false
    if (filterStatus && c.status !== filterStatus) return false
    return true
  }), [filterCampaign, filterType, filterStatus])

  const hasFilters = !!(filterCampaign || filterType || filterService || filterMerchant || filterStatus || filterSource)

  // KPI aggregates
  const totalRevenue = filteredCampaigns.reduce((s, c) => s + c.revenue, 0)
  const totalBudget  = filteredCampaigns.reduce((s, c) => s + c.budget, 0)
  const totalClaims  = filteredCampaigns.reduce((s, c) => s + c.totalClaims, 0)
  const totalConv    = filteredCampaigns.reduce((s, c) => s + c.conversions, 0)
  const roi          = totalBudget > 0 ? ((totalRevenue - totalBudget) / totalBudget * 100) : 0
  const ctr          = 4.7
  const convRate     = totalClaims > 0 ? (totalConv / totalClaims * 100) : 0
  const impressions  = 2_400_000

  const kpis = [
    { label: 'Total Impressions',  value: impressions >= 1_000_000 ? `${(impressions/1_000_000).toFixed(1)}M` : impressions.toLocaleString(), color: '#1664FF', sub: '+18% vs prev period', trend: [14,18,22,19,24,21,27,24,28,30,26,32] },
    { label: 'Click-through Rate', value: `${ctr}%`,                                                                                          color: '#7C3AED', sub: '+0.3pp vs prev period', trend: [4.1,4.3,4.5,4.4,4.6,4.5,4.7,4.6,4.8,4.7,4.9,4.7] },
    { label: 'Conversion Rate',    value: `${convRate.toFixed(1)}%`,                                                                           color: '#059669', sub: '+1.1pp vs prev period', trend: [9,9.4,10,10.2,10.8,11,10.6,11.2,11.4,11,11.6,11.2] },
    { label: 'Revenue Attributed', value: totalRevenue > 0 ? `¥${(totalRevenue/1_000_000).toFixed(1)}M` : '¥0',                               color: '#D97706', sub: '+24% vs prev period', trend: [42,45,50,48,55,52,58,62,60,68,70,74] },
    { label: 'Campaign ROI',       value: `${roi.toFixed(0)}%`,                                                                                color: '#BE123C', sub: 'Revenue ÷ Budget ratio', trend: [680,720,780,810,900,940,1020,1080,1100,1120,1200,roi] },
  ]

  // Budget utilization by campaign type
  interface TypeBudgetRow { type: string; allocated: number; used: number; revenue: number }
  const typeBudgetMap = filteredCampaigns.reduce<Record<string, TypeBudgetRow>>((acc, c) => {
    if (!acc[c.type]) acc[c.type] = { type: c.type, allocated: 0, used: 0, revenue: 0 }
    acc[c.type].allocated += c.budget
    acc[c.type].used      += c.spent
    acc[c.type].revenue   += c.revenue
    return acc
  }, {})
  const typeBudgetRows: TypeBudgetRow[] = Object.values(typeBudgetMap)
    .sort((a, b) => b.allocated - a.allocated)

  function fmtMMK(n: number): string {
    if (n >= 1_000_000_000) return `MMK ${(n / 1_000_000_000).toFixed(1)}B`
    if (n >= 1_000_000)     return `MMK ${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)         return `MMK ${(n / 1_000).toFixed(1)}K`
    return `MMK ${n.toLocaleString()}`
  }

  // Sorted ranking table
  const sortedCampaigns = useMemo(() => {
    const copy = [...filteredCampaigns]
    copy.sort((a, b) => {
      let va: number, vb: number
      switch (sortKey) {
        case 'budget':       va = a.budget;     vb = b.budget;     break
        case 'revenue':      va = a.revenue;    vb = b.revenue;    break
        case 'roi':          va = a.budget > 0 ? (a.revenue - a.budget) / a.budget : -1; vb = b.budget > 0 ? (b.revenue - b.budget) / b.budget : -1; break
        case 'claims':       va = a.totalClaims; vb = b.totalClaims; break
        case 'convRate':     va = a.totalClaims > 0 ? a.conversions / a.totalClaims : 0; vb = b.totalClaims > 0 ? b.conversions / b.totalClaims : 0; break
        default:             va = 0; vb = 0
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return copy
  }, [filteredCampaigns, sortKey, sortDir])

  // Merchant participation
  const totalMerchants = merchants.length
  const activeCampaignMerchants = new Set(
    filteredCampaigns.filter(c => c.status === 'active' && c.merchantCount > 0).flatMap(c =>
      merchants.slice(0, c.merchantCount).map(m => m.id)
    )
  ).size
  const participatingMerchants = Math.min(activeCampaignMerchants + 8, totalMerchants)
  const eligibleMerchants = Math.round(totalMerchants * 0.93)
  const participationRate = Math.round(participatingMerchants / eligibleMerchants * 100)

  // Funnel
  const funnelSteps = [
    { label: 'Impressions',          value: '2.40M',  raw: 2_400_000, subValue: 'Total ad & organic reach',          color: '#1664FF', bg: '#EEF4FF' },
    { label: 'Clicks',               value: '112.8K', raw: 112_800,   subValue: `CTR ${ctr}%`,                       color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Voucher / Code Claims', value: totalClaims > 0 ? `${(totalClaims/1000).toFixed(1)}K` : '0', raw: totalClaims, subValue: 'Unique redemption events',   color: '#0891B2', bg: '#ECFEFF' },
    { label: 'Bookings Created',      value: '42.8K',  raw: 42_800,   subValue: 'Bookings from campaign traffic',    color: '#059669', bg: '#ECFDF3' },
    { label: 'Completed Bookings',    value: '38.5K',  raw: 38_500,   subValue: 'Check-out confirmed',               color: '#65A30D', bg: '#F7FEE7' },
    { label: 'Revenue Attributed',    value: totalRevenue > 0 ? `¥${(totalRevenue/1_000_000).toFixed(1)}M` : '¥0', raw: totalRevenue, subValue: 'GMV from campaign bookings', color: '#D97706', bg: '#FFFBEB' },
  ]

  const sort = { key: sortKey, dir: sortDir }

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign & Promotion</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Campaign Analytics</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Performance reporting and analysis across all campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCompareOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-3 font-medium"
            style={{ height: 34, fontSize: 13, color: '#1664FF', border: '1px solid #BFDBFE', background: '#EEF4FF' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#DBEAFE'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EEF4FF'; }}>
            <ArrowLeftRight size={13} /> Compare Period
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-3 font-medium"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            onClick={() => showToast('info', 'Export Report', 'Analytics report is being prepared for download.')}>
            <Download size={13} /> Export Report
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap" style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, padding: '10px 14px' }}>
        <SlidersHorizontal size={13} color="#94A3B8" />
        <span style={{ fontSize: 12, color: '#94A3B8', marginRight: 4, fontWeight: 500 }}>Filter:</span>

        <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
          style={{ fontSize: 12, color: filterCampaign ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterCampaign ? '#F0F6FF' : '#fff' }}>
          <option value="">All Campaigns</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ fontSize: 12, color: filterType ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterType ? '#F0F6FF' : '#fff' }}>
          <option value="">All Types</option>
          <option value="flash_sale">Flash Sale</option>
          <option value="seasonal">Seasonal</option>
          <option value="loyalty">Loyalty</option>
          <option value="partnership">Partnership</option>
          <option value="referral">Referral</option>
          <option value="long_stay_deal">Long Stay Deal</option>
        </select>

        <select value={filterService} onChange={e => setFilterService(e.target.value)}
          style={{ fontSize: 12, color: filterService ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterService ? '#F0F6FF' : '#fff' }}>
          <option value="">All Services</option>
          {SERVICE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
        </select>

        <select value={filterMerchant} onChange={e => setFilterMerchant(e.target.value)}
          style={{ fontSize: 12, color: filterMerchant ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterMerchant ? '#F0F6FF' : '#fff' }}>
          <option value="">All Merchants</option>
          {merchants.slice(0, 10).map(m => <option key={m.id} value={m.id}>{m.merchantName}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ fontSize: 12, color: filterStatus ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterStatus ? '#F0F6FF' : '#fff' }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="scheduled">Scheduled</option>
          <option value="ended">Ended</option>
          <option value="draft">Draft</option>
        </select>

        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          style={{ fontSize: 12, color: filterSource ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterSource ? '#F0F6FF' : '#fff' }}>
          <option value="">All Sources</option>
          <option value="platform">Platform Campaigns</option>
          <option value="merchant">Merchant Campaigns</option>
          <option value="promotions">Promotions</option>
          <option value="vouchers">Vouchers</option>
          <option value="codes">Promotion Codes</option>
          <option value="welcome">Welcome Rewards</option>
        </select>

        <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
          style={{ fontSize: 12, color: '#1A2332', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: '#fff' }}>
          <option value="last_7">Last 7 days</option>
          <option value="last_30">Last 30 days</option>
          <option value="last_90">Last 90 days</option>
          <option value="last_year">Last 12 months</option>
          <option value="custom">Custom range</option>
        </select>

        {hasFilters && (
          <button onClick={() => { setFilterCampaign(''); setFilterType(''); setFilterService(''); setFilterMerchant(''); setFilterStatus(''); setFilterSource('') }}
            className="flex items-center gap-1 rounded-md px-2" style={{ height: 28, fontSize: 12, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
            <X size={11} /> Clear
          </button>
        )}
        <div className="ml-auto" style={{ fontSize: 12, color: '#94A3B8' }}>{filteredCampaigns.length} campaigns</div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, fontFamily: 'monospace', marginBottom: 4 }}>{k.value}</div>
            <div className="flex items-center justify-between">
              <div style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.4 }}>{k.sub}</div>
              <Sparkline data={k.trend} color={k.color} width={56} height={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Row 1: Revenue by Type + Conversion Funnel */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Campaign Budget Utilization & Performance */}
        <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Campaign Budget Utilization & Performance</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Monitor budget allocation, actual spending, revenue generation, and ROI by campaign type.</div>

          {typeBudgetRows.length > 0 ? typeBudgetRows.map(row => {
            const meta = CAMPAIGN_TYPE_META[row.type] ?? { label: row.type, color: '#64748B', bg: '#F1F5F9' }
            const usedPct  = row.allocated > 0 ? Math.min(100, Math.round(row.used / row.allocated * 100)) : 0
            const roi      = row.allocated > 0 ? Math.round((row.revenue - row.allocated) / row.allocated * 100) : 0
            const roiColor = roi > 100 ? '#059669' : roi > 0 ? '#D97706' : '#DC2626'
            const barFill  = usedPct > 90 ? '#DC2626' : usedPct > 70 ? '#D97706' : meta.color
            return (
              <div key={row.type} className="mb-4 pb-4" style={{ borderBottom: '1px solid #F8FAFC' }}>
                {/* Row header: type label + revenue + ROI chips */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Revenue</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>{fmtMMK(row.revenue)}</div>
                    </div>
                    <div className="text-right" style={{ minWidth: 52 }}>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ROI</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: roiColor, fontFamily: 'monospace' }}>
                        {row.revenue > 0 ? `${roi > 0 ? '+' : ''}${roi}%` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Budget utilization bar */}
                <div>
                  <div className="flex items-center justify-between mb-1" style={{ fontSize: 11, color: '#94A3B8' }}>
                    <span>Budget Utilization</span>
                    <span style={{ fontWeight: 600, color: usedPct > 90 ? '#DC2626' : '#475569' }}>{usedPct}%</span>
                  </div>
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${usedPct}%`, height: '100%', background: barFill, borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>
                      {fmtMMK(row.used)} <span style={{ color: '#CBD5E1' }}>/ {fmtMMK(row.allocated)}</span>
                    </span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{fmtMMK(row.allocated - row.used)} remaining</span>
                  </div>
                </div>
              </div>
            )
          }) : (
            <div className="flex items-center justify-center" style={{ height: 120, color: '#CBD5E1', fontSize: 12 }}>No data for selected filters</div>
          )}

          {/* Summary footer */}
          {typeBudgetRows.length > 0 && (
            <div className="grid gap-2 mt-1 pt-3" style={{ borderTop: '1px solid #F1F5F9', gridTemplateColumns: '1fr 1fr 1fr' }}>
              {[
                { label: 'Total Allocated', value: fmtMMK(typeBudgetRows.reduce((s, r) => s + r.allocated, 0)), color: '#1664FF' },
                { label: 'Total Spent',     value: fmtMMK(typeBudgetRows.reduce((s, r) => s + r.used, 0)),      color: '#D97706' },
                { label: 'Total Revenue',   value: fmtMMK(typeBudgetRows.reduce((s, r) => s + r.revenue, 0)),   color: '#059669' },
              ].map(s => (
                <div key={s.label} className="rounded px-2.5 py-2" style={{ background: '#F8FAFC' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Marketing Conversion Funnel */}
        <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Marketing Conversion Funnel</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>Drop-off at each stage from impression to revenue</div>
          <div>
            {funnelSteps.map((step, i) => (
              <FunnelStep key={step.label} label={step.label} value={step.value} subValue={step.subValue}
                color={step.color} bg={step.bg} isFirst={i === 0}
                pct={i > 0 && funnelSteps[i-1].raw > 0 ? Math.round(step.raw / funnelSteps[i-1].raw * 100) : 100} />
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Campaign Performance Ranking */}
      <div className="rounded-lg mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Campaign Performance Ranking</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Sortable by any metric — click column headers</div>
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#94A3B8' }}>
            <TrendingUp size={13} />
            Sorted by {sortKey} ({sortDir})
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              <th className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>#</th>
              <th className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#64748B', minWidth: 200 }}>Campaign</th>
              <th className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Type</th>
              {[
                { key: 'budget',   label: 'Budget' },
                { key: 'revenue',  label: 'Revenue' },
                { key: 'roi',      label: 'ROI' },
                { key: 'claims',   label: 'Claims' },
                { key: 'convRate', label: 'Conv. Rate' },
              ].map(col => (
                <th key={col.key} className="px-4 py-2.5 cursor-pointer select-none" style={{ fontSize: 11, fontWeight: 600, color: sortKey === col.key ? '#1664FF' : '#64748B', textAlign: 'right' }}
                  onClick={() => toggleSort(col.key)}>
                  <div className="flex items-center justify-end gap-1">
                    {col.label} <SortIcon field={col.key} sort={sort} />
                  </div>
                </th>
              ))}
              <th className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedCampaigns.map((c, i) => {
              const roi = c.budget > 0 ? ((c.revenue - c.budget) / c.budget * 100) : 0
              const convRate = c.totalClaims > 0 ? (c.conversions / c.totalClaims * 100) : 0
              const meta = CAMPAIGN_TYPE_META[c.type]
              const roiColor = roi > 500 ? '#059669' : roi > 100 ? '#D97706' : roi > 0 ? '#64748B' : '#DC2626'
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #F8FAFC' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4 py-3" style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, width: 40 }}>
                    {medal ?? <span style={{ fontFamily: 'monospace' }}>{i + 1}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{c.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: meta?.bg ?? '#F1F5F9', color: meta?.color ?? '#475569', height: 20 }}>
                      {meta?.label ?? c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>
                    ¥{(c.budget/1000).toFixed(0)}K
                  </td>
                  <td className="px-4 py-3 text-right" style={{ fontSize: 12, fontWeight: 600, color: c.revenue > 0 ? '#059669' : '#94A3B8', fontFamily: 'monospace' }}>
                    {c.revenue > 0 ? `¥${(c.revenue/1_000_000).toFixed(2)}M` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span style={{ fontSize: 12, fontWeight: 700, color: roiColor, fontFamily: 'monospace' }}>
                      {c.revenue > 0 ? `${roi.toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>
                    {c.totalClaims.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div style={{ fontSize: 12, fontWeight: 600, color: convRate > 70 ? '#059669' : convRate > 50 ? '#D97706' : '#64748B', fontFamily: 'monospace' }}>
                      {c.totalClaims > 0 ? `${convRate.toFixed(1)}%` : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, height: 20,
                      background: c.status==='active'?'#ECFDF3':c.status==='scheduled'?'#EFF6FF':c.status==='paused'?'#FFFAEB':c.status==='ended'?'#F1F5F9':'#F8FAFC',
                      color: c.status==='active'?'#027A48':c.status==='scheduled'?'#1D4ED8':c.status==='paused'?'#B54708':c.status==='ended'?'#475569':'#94A3B8' }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Row 3: Merchant Participation */}
      <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Merchant Participation</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Campaign adoption across registered merchants</div>
          </div>
          <Users size={16} color="#1664FF" />
        </div>
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            { label: 'Participating Merchants', value: participatingMerchants, total: totalMerchants, color: '#1664FF', sub: 'In at least one active campaign' },
            { label: 'Eligible Merchants',      value: eligibleMerchants,      total: totalMerchants, color: '#7C3AED', sub: 'Qualify for campaign participation' },
            { label: 'Participation Rate',      value: null, rate: participationRate,                 color: '#059669', sub: `${participatingMerchants} of ${eligibleMerchants} eligible` },
          ].map(stat => (
            <div key={stat.label} className="rounded-lg p-3" style={{ border: '1px solid #E3E8F0', background: '#FAFBFC' }}>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginBottom: 6 }}>{stat.label}</div>
              {stat.value !== null ? (
                <>
                  <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, fontFamily: 'monospace', marginBottom: 4 }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>{stat.sub}</div>
                  <div style={{ background: '#F1F5F9', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(stat.value / stat.total * 100)}%`, height: '100%', background: stat.color, borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{Math.round(stat.value / stat.total * 100)}% of {stat.total} total</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, fontWeight: 700, color: stat.color, fontFamily: 'monospace', marginBottom: 4 }}>{stat.rate}%</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>{stat.sub}</div>
                  <div style={{ background: '#F1F5F9', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${stat.rate}%`, height: '100%', background: stat.color, borderRadius: 6 }} />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Per-type merchant breakdown */}
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Merchant Reach by Campaign Type</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {Object.entries(CAMPAIGN_TYPE_META).map(([type, meta]) => {
              const typeCampaigns = filteredCampaigns.filter(c => c.type === type && c.status === 'active')
              const reach = typeCampaigns.reduce((s, c) => s + (c.merchantCount || totalMerchants), 0)
              const effectiveReach = Math.min(reach, totalMerchants)
              return (
                <div key={type} className="rounded-lg p-3 text-center" style={{ border: `1px solid ${meta.color}22`, background: meta.bg }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: meta.color, fontFamily: 'monospace', marginBottom: 2 }}>{effectiveReach}</div>
                  <div style={{ fontSize: 11, color: meta.color, fontWeight: 500 }}>{meta.label}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{typeCampaigns.length} active</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>


      {/* Source Channel Breakdown */}
      <div className="rounded-lg p-4 mt-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Source Channel Breakdown</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Revenue and conversion attribution by channel type</div>
          </div>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { label: 'Platform Campaigns', count: campaigns.filter(c => c.owner === 'platform' && c.status === 'active').length + ' active', revenue: 'MMK 58.4M', claims: '72,400', conv: '52,100', convRate: '72.0%', color: '#1664FF', bg: '#EEF4FF' },
            { label: 'Merchant Campaigns', count: campaigns.filter(c => c.owner === 'merchant' && c.status === 'active').length + ' active', revenue: 'MMK 15.8M', claims: '28,200', conv: '19,600', convRate: '69.5%', color: '#C2410C', bg: '#FFF7ED' },
            { label: 'Promotions',         count: promotions.filter((p: Promotion) => p.status === 'active').length + ' active',            revenue: 'MMK 22.1M', claims: '31,500', conv: '24,100', convRate: '76.5%', color: '#D97706', bg: '#FFFBEB' },
            { label: 'Vouchers',           count: vouchers.filter(v => v.status === 'active').length + ' active',                           revenue: 'MMK 9.6M',  claims: '18,900', conv: '14,200', convRate: '75.1%', color: '#059669', bg: '#ECFDF3' },
            { label: 'Promotion Codes',    count: promoCodes.filter(p => p.status === 'active').length + ' active',                         revenue: 'MMK 6.3M',  claims: '12,400', conv: '8,940',  convRate: '72.1%', color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Welcome Rewards',    count: welcomeRewards.filter((w: WelcomeReward) => w.status === 'active').length + ' active',    revenue: 'MMK 4.9M',  claims: '9,800',  conv: '8,140',  convRate: '83.1%', color: '#BE123C', bg: '#FFF1F3' },
          ].map(ch => (
            <div key={ch.label} className="rounded-lg p-3" style={{ border: `1px solid ${ch.color}22`, background: ch.bg }}>
              <div className="flex items-center justify-between mb-2">
                <div style={{ fontSize: 12, fontWeight: 600, color: ch.color }}>{ch.label}</div>
                <span style={{ fontSize: 10, color: ch.color, opacity: 0.7 }}>{ch.count}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: ch.color, fontFamily: 'monospace', marginBottom: 4 }}>{ch.revenue}</div>
              <div className="flex items-center justify-between" style={{ fontSize: 11, color: '#64748B' }}>
                <span>{ch.claims} claims</span>
                <span style={{ fontWeight: 600, color: ch.color }}>{ch.convRate} conv.</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ComparePeriodModal open={compareOpen} onClose={() => setCompareOpen(false)} showToast={showToast} />
    </div>
  )
}

// ── Create Promotion Drawer ───────────────────────────────────────────────────

function CreatePromotionDrawer({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (p: Promotion) => void }) {
  const [form, setForm] = useState({ name: '', merchantId: '', promotionType: 'percentage' as Promotion['promotionType'], discountValue: '', minNights: '', validFrom: '', validTo: '', usageLimit: '', status: 'draft' as Promotion['status'] })
  const [services, setServices] = useState<string[]>(['hotel'])
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const canSave = form.name.trim() && form.discountValue && form.validFrom && form.validTo
  function handleSave(saveStatus: Promotion['status']) {
    const disc = parseFloat(form.discountValue) || 0
    const discDisplay = form.promotionType === 'percentage' ? `${disc}% OFF` : form.promotionType === 'fixed' ? `MMK ${disc} OFF` : form.promotionType === 'free_night' ? 'Free Night' : form.promotionType === 'early_bird' ? `${disc}% Early Bird` : 'Package Deal'
    const merchant = merchants.find(m => m.id === form.merchantId)
    onSave({
      id: `PR-${String(Date.now()).slice(-4)}`,
      name: form.name.trim(),
      merchantId: form.merchantId || 'MCH-0001',
      merchantName: merchant?.merchantName ?? 'Platform',
      promotionType: form.promotionType,
      discountValue: disc,
      discountDisplay: discDisplay,
      status: saveStatus,
      startDate: form.validFrom,
      endDate: form.validTo,
      minNights: parseInt(form.minNights) || 0,
      bookings: 0,
      revenue: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    })
    setForm({ name: '', merchantId: '', promotionType: 'percentage', discountValue: '', minNights: '', validFrom: '', validTo: '', usageLimit: '', status: 'draft' })
    setServices(['hotel'])
  }
  return (
    <Drawer open={open} onClose={onClose} title="Create Promotion" subtitle="Add a new merchant promotion or deal" width={520}>
      <div className="space-y-4">
        <FormField label="Promotion Name" required>
          <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="e.g. Summer Escape Deal" />
        </FormField>
        <FormField label="Applicable Services" required>
          <ApplicableServicesSelect value={services} onChange={setServices} />
        </FormField>
        <FormField label="Eligible Merchants / Providers">
          <select style={selectStyle} value={form.merchantId} onChange={set('merchantId')}>
            <option value="">— All merchants —</option>
            {merchants.filter(m => {
              const cats = Array.from(new Set(services.flatMap(s => SERVICE_MERCHANT_CATEGORIES[s] ?? [])))
              return cats.length === 0 || cats.some(c => m.category.toLowerCase().includes(c))
            }).slice(0, 20).map(m => <option key={m.id} value={m.id}>{m.merchantName}</option>)}
          </select>
        </FormField>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Promotion Type" required>
            <select style={selectStyle} value={form.promotionType} onChange={set('promotionType')}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (MMK)</option>
              <option value="package">Package Deal</option>
              <option value="free_night">Free Night</option>
              <option value="early_bird">Early Bird</option>
            </select>
          </FormField>
          <FormField label="Discount Value" required>
            <input style={inputStyle} value={form.discountValue} onChange={set('discountValue')}
              placeholder={form.promotionType === 'percentage' || form.promotionType === 'early_bird' ? 'e.g. 20' : form.promotionType === 'package' ? 'N/A' : 'e.g. 5000'} />
          </FormField>
        </div>
        <FormField label="Minimum Spend (MMK) / Minimum Nights">
          <input style={inputStyle} value={form.minNights} onChange={set('minNights')} placeholder="e.g. 2 (nights) or 50000 (MMK)" />
        </FormField>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Valid From" required>
            <input style={inputStyle} type="date" value={form.validFrom} onChange={set('validFrom')} />
          </FormField>
          <FormField label="Valid To" required>
            <input style={inputStyle} type="date" value={form.validTo} onChange={set('validTo')} />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Usage Limit">
            <input style={inputStyle} type="number" value={form.usageLimit} onChange={set('usageLimit')} placeholder="e.g. 500" />
          </FormField>
          <FormField label="Status">
            <select style={selectStyle} value={form.status} onChange={set('status')}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </FormField>
        </div>
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button onClick={() => canSave && handleSave(form.status)} disabled={!canSave}
            className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: canSave ? '#D97706' : '#94A3B8', cursor: canSave ? 'pointer' : 'not-allowed' }}>
            <Tag size={13} /> Create Promotion
          </button>
          <button onClick={() => canSave && handleSave('draft')} disabled={!canSave}
            className="rounded-md px-4 font-medium"
            style={{ height: 34, fontSize: 13, color: canSave ? '#D97706' : '#94A3B8', border: `1px solid ${canSave ? '#FDE68A' : '#E3E8F0'}`, background: '#FFFBEB' }}>
            Save Draft
          </button>
          <button onClick={onClose} className="rounded-md px-4 font-medium" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Cancel</button>
        </div>
      </div>
    </Drawer>
  )
}

// ── Create Welcome Reward Drawer ──────────────────────────────────────────────

function CreateWelcomeRewardDrawer({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (r: WelcomeReward) => void }) {
  const [form, setForm] = useState({ name: '', trigger: 'new_user' as WelcomeReward['rewardType'], discountType: 'percentage' as WelcomeReward['discountType'], discountValue: '', validityDays: '30', usageLimit: '', perUserLimit: '1', status: 'draft' as WelcomeReward['status'] })
  const [services, setServices] = useState<string[]>(['hotel'])
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const canSave = form.name.trim() && form.discountValue
  function handleSave(saveStatus: WelcomeReward['status']) {
    const disc = parseFloat(form.discountValue) || 0
    const discDisplay = form.discountType === 'percentage' ? `${disc}% OFF` : form.discountType === 'fixed' ? `MMK ${disc} OFF` : form.discountType === 'cashback' ? `MMK ${disc} Cashback` : 'Free Night'
    onSave({
      id: `WR-${String(Date.now()).slice(-4)}`,
      name: form.name.trim(),
      rewardType: form.trigger,
      discountType: form.discountType,
      discountValue: disc,
      discountDisplay: discDisplay,
      status: saveStatus,
      validityDays: parseInt(form.validityDays) || 30,
      usageLimit: parseInt(form.usageLimit) || 0,
      usageCount: 0,
      minSpend: 0,
      newUsersConverted: 0,
      revenue: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    })
    setForm({ name: '', trigger: 'new_user', discountType: 'percentage', discountValue: '', validityDays: '30', usageLimit: '', perUserLimit: '1', status: 'draft' })
    setServices(['hotel'])
  }
  return (
    <Drawer open={open} onClose={onClose} title="Create Welcome Reward" subtitle="Set up a new incentive for new or first-time users" width={520}>
      <div className="space-y-4">
        <FormField label="Reward Name" required>
          <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="e.g. First Booking Bonus" />
        </FormField>
        <FormField label="Reward Trigger" required>
          <select style={selectStyle} value={form.trigger} onChange={set('trigger')}>
            <option value="new_user">New Registration</option>
            <option value="first_booking">First Booking</option>
            <option value="registration">First Completed Stay</option>
          </select>
        </FormField>
        <FormField label="Applicable Services" required>
          <ApplicableServicesSelect value={services} onChange={setServices} />
        </FormField>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Reward Type" required>
            <select style={selectStyle} value={form.discountType} onChange={set('discountType')}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (MMK)</option>
              <option value="free_night">Free Night</option>
              <option value="cashback">Cashback (MMK)</option>
            </select>
          </FormField>
          <FormField label="Reward Value" required>
            <input style={inputStyle} value={form.discountValue} onChange={set('discountValue')}
              placeholder={form.discountType === 'percentage' ? 'e.g. 15' : 'e.g. 10000'} />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Validity Period (days)" required>
            <input style={inputStyle} type="number" value={form.validityDays} onChange={set('validityDays')} placeholder="e.g. 30" />
          </FormField>
          <FormField label="Total Usage Limit">
            <input style={inputStyle} type="number" value={form.usageLimit} onChange={set('usageLimit')} placeholder="e.g. 1000" />
          </FormField>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Per-User Limit">
            <input style={inputStyle} type="number" value={form.perUserLimit} onChange={set('perUserLimit')} placeholder="e.g. 1" />
          </FormField>
          <FormField label="Status">
            <select style={selectStyle} value={form.status} onChange={set('status')}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </FormField>
        </div>
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button onClick={() => canSave && handleSave(form.status)} disabled={!canSave}
            className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: canSave ? '#7C3AED' : '#94A3B8', cursor: canSave ? 'pointer' : 'not-allowed' }}>
            <Gift size={13} /> Create Reward
          </button>
          <button onClick={() => canSave && handleSave('draft')} disabled={!canSave}
            className="rounded-md px-4 font-medium"
            style={{ height: 34, fontSize: 13, color: canSave ? '#7C3AED' : '#94A3B8', border: `1px solid ${canSave ? '#DDD6FE' : '#E3E8F0'}`, background: '#F5F3FF' }}>
            Save Draft
          </button>
          <button onClick={onClose} className="rounded-md px-4 font-medium" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>Cancel</button>
        </div>
      </div>
    </Drawer>
  )
}

// ── Tab config ────────────────────────────────────────────────────────────────

const tabConfig: Record<string, { title: string; subtitle: string }> = {
  campaigns:                { title: 'Campaigns',          subtitle: 'Manage platform and merchant-managed promotional campaigns' },
  'campaigns-promotions':   { title: 'Promotions',          subtitle: 'Merchant self-managed hotel deals and direct promotions' },
  'campaigns-vouchers':     { title: 'Vouchers',           subtitle: 'Issue and manage guest vouchers across the platform' },
  'campaigns-codes':        { title: 'Promotion Codes',    subtitle: 'Generate and track promotional codes for distribution' },
  'campaigns-welcome':      { title: 'Welcome Rewards',    subtitle: 'New user incentives and first-booking rewards management' },
  'campaigns-analytics':    { title: 'Campaign Analytics', subtitle: 'Performance reporting across all campaign channels' },
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CampaignPage({ tab, showToast }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [drawerCampaign, setDrawerCampaign] = useState<Campaign | null>(null)
  const [drawerVoucher, setDrawerVoucher] = useState<Voucher | null>(null)
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false)
  const [createVoucherOpen, setCreateVoucherOpen] = useState(false)
  const [createCodeOpen, setCreateCodeOpen] = useState(false)
  const [createPromoOpen, setCreatePromoOpen] = useState(false)
  const [createRewardOpen, setCreateRewardOpen] = useState(false)
  const [extraPromos, setExtraPromos] = useState<Promotion[]>([])
  const [extraRewards, setExtraRewards] = useState<WelcomeReward[]>([])
  const [filterOwner, setFilterOwner] = useState('')
  const [platformTotal, setPlatformTotal]         = useState(CAMP_BUDGET_TOTAL_INIT)
  const [platformAllocated, setPlatformAllocated] = useState(CAMP_BUDGET_ALLOCATED_INIT)
  const [editBudgetOpen, setEditBudgetOpen]       = useState(false)
  const perPage = 8

  const pageCtx = tabConfig[tab] ?? tabConfig['campaigns']


  // -- Promotions tab --
  if (tab === 'campaigns-promotions') {
    const allPromos = [...extraPromos, ...(promotions as Promotion[])]
    const filteredPromos = allPromos.filter((p: Promotion) =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.merchantName.toLowerCase().includes(search.toLowerCase())
    )
    const totalP = filteredPromos.length
    const rowsP = filteredPromos.slice((page - 1) * perPage, page * perPage)
    const totalPagesP = Math.max(1, Math.ceil(totalP / perPage))
    const promoTypeLabels: Record<string, string> = {
      percentage: 'Percentage', fixed: 'Fixed Amount', package: 'Package Deal',
      free_night: 'Free Night', early_bird: 'Early Bird',
    }
    const promoTypeColors: Record<string, { bg: string; color: string }> = {
      percentage: { bg: '#EFF6FF', color: '#1D4ED8' },
      fixed:      { bg: '#F0FDF4', color: '#166534' },
      package:    { bg: '#FAF5FF', color: '#5B21B6' },
      free_night: { bg: '#FFF7ED', color: '#9A3412' },
      early_bird: { bg: '#ECFDF3', color: '#065F46' },
    }
    const promoStats = [
      { label: 'Active Promotions',   value: allPromos.filter((p: Promotion) => p.status === 'active').length,                             color: '#059669' },
      { label: 'Participating Merchants', value: new Set(allPromos.filter((p: Promotion) => p.status === 'active').map((p: Promotion) => p.merchantId)).size, color: '#1664FF' },
      { label: 'Total Bookings',      value: allPromos.reduce((s: number, p: Promotion) => s + p.bookings, 0).toLocaleString(),             color: '#7C3AED' },
      { label: 'Promo Revenue',       value: 'MMK ' + (allPromos.reduce((s: number, p: Promotion) => s + p.revenue, 0) / 1_000_000).toFixed(1) + 'M', color: '#D97706' },
    ]
    return (
      <div className="p-6" style={{ minWidth: 1000 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign & Promotion</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{pageCtx.title}</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{pageCtx.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              onClick={() => showToast('info', 'Export', 'Promotions list exported.')}>
              <Download size={13} /> Export
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
              style={{ height: 34, fontSize: 13, background: '#D97706' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#B45309')}
              onMouseLeave={e => (e.currentTarget.style.background = '#D97706')}
              onClick={() => setCreatePromoOpen(true)}>
              <Plus size={13} /> Create Promotion
            </button>
          </div>
        </div>
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {promoStats.map(s => (
            <div key={s.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg p-3 mb-4 flex items-start gap-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
            <strong>Merchant-managed promotions</strong> are created and funded by individual hotel merchants for their own properties. They are approved by the platform before going live.
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search promotions or merchants…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
          <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option>All Types</option><option>Percentage</option><option>Fixed Amount</option><option>Package Deal</option><option>Free Night</option><option>Early Bird</option>
          </select>
          <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option>All Status</option><option>Active</option><option>Paused</option><option>Scheduled</option><option>Expired</option><option>Draft</option>
          </select>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{totalP} results</span>
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Promotion', 'Merchant', 'Type', 'Discount', 'Period', 'Min. Nights', 'Bookings', 'Revenue', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsP.map((p: Promotion, i: number) => {
                const tc = promoTypeColors[p.promotionType] ?? { bg: '#F1F5F9', color: '#475569' }
                return (
                  <tr key={p.id} style={{ borderBottom: i < rowsP.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 50 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{p.id}</div>
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#475569', maxWidth: 140 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.merchantName}</div>
                    </td>
                    <td className="px-3">
                      <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: tc.bg, color: tc.color, height: 20 }}>
                        {promoTypeLabels[p.promotionType] ?? p.promotionType}
                      </span>
                    </td>
                    <td className="px-3" style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{p.discountDisplay}</td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                      {p.startDate} → {p.endDate}
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#64748B', textAlign: 'center' }}>
                      {p.minNights > 0 ? `${p.minNights}N` : <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{p.bookings.toLocaleString()}</td>
                    <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#059669', fontFamily: 'monospace' }}>
                      {p.revenue > 0 ? `MMK ${(p.revenue / 1_000_000).toFixed(1)}M` : <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td className="px-3"><StatusBadge status={p.status} /></td>
                    <td className="px-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn title="View" onClick={() => showToast('info', p.name, `${p.merchantName} · ${p.discountDisplay}`)} color="#D97706"><Eye size={12} /></ActionBtn>
                        <MoreMenu items={[
                          { label: 'View Details', icon: <Eye size={13} />, onClick: () => showToast('info', p.name, `${p.merchantName} · ${p.discountDisplay}`) },
                          ...(p.status === 'active' ? [{ label: 'Pause Promotion', icon: <Pause size={13} />, onClick: () => showToast('info', 'Promotion Paused', p.name) }] : []),
                          ...(p.status === 'paused' ? [{ label: 'Resume Promotion', icon: <Play size={13} />, onClick: () => showToast('success', 'Promotion Resumed', p.name) }] : []),
                          { label: 'Expire Promotion', icon: <XCircle size={13} />, color: '#DC2626', divider: true, onClick: () => showToast('warning', 'Promotion Expired', p.name) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min((page-1)*perPage+1,totalP)}-{Math.min(page*perPage,totalP)} of {totalP}</span>
            <div className="flex items-center gap-1">
              <PagBtn onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></PagBtn>
              {Array.from({ length: totalPagesP }).map((_,i) => <PagBtn key={i} onClick={() => setPage(i+1)} active={page===i+1}>{i+1}</PagBtn>)}
              <PagBtn onClick={() => setPage(p => Math.min(totalPagesP,p+1))} disabled={page===totalPagesP}><ChevronRight size={13} /></PagBtn>
            </div>
          </div>
        </div>
      <CreatePromotionDrawer open={createPromoOpen} onClose={() => setCreatePromoOpen(false)} onSave={p => { setExtraPromos(prev => [p, ...prev]); setCreatePromoOpen(false); showToast('success', 'Promotion Created', `"${p.name}" has been created successfully.`) }} />
      </div>
    )
  }

  // -- Welcome Rewards tab --
  if (tab === 'campaigns-welcome') {
    const allRewards = [...extraRewards, ...(welcomeRewards as WelcomeReward[])]
    const filteredWR = allRewards.filter((w: WelcomeReward) =>
      !search || w.name.toLowerCase().includes(search.toLowerCase())
    )
    const totalWR = filteredWR.length
    const rowsWR = filteredWR.slice((page - 1) * perPage, page * perPage)
    const totalPagesWR = Math.max(1, Math.ceil(totalWR / perPage))
    const wrStats = [
      { label: 'Active Rewards',       value: allRewards.filter((w: WelcomeReward) => w.status === 'active').length,                                          color: '#059669' },
      { label: 'New Users Converted',  value: allRewards.reduce((s: number, w: WelcomeReward) => s + w.newUsersConverted, 0).toLocaleString(),                 color: '#1664FF' },
      { label: 'Total Usage',          value: allRewards.reduce((s: number, w: WelcomeReward) => s + w.usageCount, 0).toLocaleString(),                        color: '#7C3AED' },
      { label: 'Welcome Revenue',      value: 'MMK ' + (allRewards.reduce((s: number, w: WelcomeReward) => s + w.revenue, 0) / 1_000_000).toFixed(1) + 'M',  color: '#D97706' },
    ]
    const rewardTypeLabels: Record<string, string> = {
      new_user: 'New User', first_booking: 'First Booking', registration: 'Registration',
    }
    const discountTypeColors: Record<string, { bg: string; color: string }> = {
      percentage: { bg: '#EFF6FF', color: '#1D4ED8' },
      fixed:      { bg: '#F0FDF4', color: '#166534' },
      free_night: { bg: '#FFF7ED', color: '#9A3412' },
      cashback:   { bg: '#FFF1F3', color: '#BE123C' },
    }
    return (
      <div className="p-6" style={{ minWidth: 1000 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign & Promotion</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{pageCtx.title}</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{pageCtx.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              onClick={() => showToast('info', 'Export', 'Welcome rewards exported.')}>
              <Download size={13} /> Export
            </button>
            <button className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
              style={{ height: 34, fontSize: 13, background: '#7C3AED' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#6D28D9')}
              onMouseLeave={e => (e.currentTarget.style.background = '#7C3AED')}
              onClick={() => setCreateRewardOpen(true)}>
              <Plus size={13} /> Create Reward
            </button>
          </div>
        </div>
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {wrStats.map(s => (
            <div key={s.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search welcome rewards…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
          <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option>All Types</option><option>New User</option><option>First Booking</option><option>Registration</option>
          </select>
          <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option>All Status</option><option>Active</option><option>Paused</option><option>Draft</option>
          </select>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{totalWR} results</span>
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Reward Name', 'Reward Type', 'Discount', 'Validity', 'Usage / Limit', 'New Users', 'Revenue', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsWR.map((w: WelcomeReward, i: number) => {
                const dc = discountTypeColors[w.discountType] ?? { bg: '#F1F5F9', color: '#475569' }
                const usagePct = w.usageLimit > 0 ? Math.round(w.usageCount / w.usageLimit * 100) : 0
                return (
                  <tr key={w.id} style={{ borderBottom: i < rowsWR.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 50 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{w.id}</div>
                    </td>
                    <td className="px-3">
                      <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', height: 20 }}>
                        {rewardTypeLabels[w.rewardType] ?? w.rewardType}
                      </span>
                    </td>
                    <td className="px-3">
                      <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: dc.bg, color: dc.color, height: 20 }}>
                        {w.discountDisplay}
                      </span>
                    </td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B' }}>{w.validityDays}d</td>
                    <td className="px-3" style={{ minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>{w.usageCount.toLocaleString()} / {w.usageLimit.toLocaleString()}</div>
                      <div className="rounded-full overflow-hidden" style={{ height: 4, background: '#F1F5F9' }}>
                        <div style={{ width: `${usagePct}%`, height: '100%', background: usagePct > 90 ? '#DC2626' : '#7C3AED', borderRadius: 9999 }} />
                      </div>
                    </td>
                    <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#1664FF', fontFamily: 'monospace' }}>{w.newUsersConverted.toLocaleString()}</td>
                    <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#059669', fontFamily: 'monospace' }}>
                      {w.revenue > 0 ? `MMK ${(w.revenue / 1_000_000).toFixed(1)}M` : <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td className="px-3"><StatusBadge status={w.status} /></td>
                    <td className="px-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn title="View" onClick={() => showToast('info', w.name, `${w.discountDisplay} · ${w.usageCount} uses`)} color="#7C3AED"><Eye size={12} /></ActionBtn>
                        <MoreMenu items={[
                          { label: 'View Details', icon: <Eye size={13} />, onClick: () => showToast('info', w.name, w.discountDisplay) },
                          ...(w.status === 'active' ? [{ label: 'Pause Reward', icon: <Pause size={13} />, onClick: () => showToast('info', 'Reward Paused', w.name) }] : []),
                          ...(w.status === 'paused' ? [{ label: 'Resume Reward', icon: <Play size={13} />, onClick: () => showToast('success', 'Reward Resumed', w.name) }] : []),
                          { label: 'Deactivate', icon: <XCircle size={13} />, color: '#DC2626', divider: true, onClick: () => showToast('warning', 'Reward Deactivated', w.name) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min((page-1)*perPage+1,totalWR)}-{Math.min(page*perPage,totalWR)} of {totalWR}</span>
            <div className="flex items-center gap-1">
              <PagBtn onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></PagBtn>
              {Array.from({ length: totalPagesWR }).map((_,i) => <PagBtn key={i} onClick={() => setPage(i+1)} active={page===i+1}>{i+1}</PagBtn>)}
              <PagBtn onClick={() => setPage(p => Math.min(totalPagesWR,p+1))} disabled={page===totalPagesWR}><ChevronRight size={13} /></PagBtn>
            </div>
          </div>
        </div>
      <CreateWelcomeRewardDrawer open={createRewardOpen} onClose={() => setCreateRewardOpen(false)} onSave={r => { setExtraRewards(prev => [r, ...prev]); setCreateRewardOpen(false); showToast('success', 'Reward Created', `"${r.name}" has been created successfully.`) }} />
      </div>
    )
  }

  // ── Analytics tab ────────────────────────────────────────────────────────
  if (tab === 'campaigns-analytics') {
    return <CampaignAnalyticsPage showToast={showToast} />
  }

  // ── Vouchers tab ──────────────────────────────────────────────────────────
  if (tab === 'campaigns-vouchers') {
    const filtered = vouchers.filter(v =>
      !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.id.includes(search)
    )
    const total = filtered.length
    const rows = filtered.slice((page - 1) * perPage, page * perPage)
    const totalPages = Math.max(1, Math.ceil(total / perPage))
    const stats = [
      { label: 'Active Vouchers',    value: vouchers.filter(v => v.status === 'active').length,                   color: '#059669' },
      { label: 'Total Claimed',      value: vouchers.reduce((s, v) => s + v.claimed, 0).toLocaleString(),         color: '#1664FF' },
      { label: 'Total Redeemed',     value: vouchers.reduce((s, v) => s + v.redeemed, 0).toLocaleString(),        color: '#7C3AED' },
      { label: 'Redemption Rate',    value: (() => { const c = vouchers.reduce((s,v)=>s+v.claimed,0); const r = vouchers.reduce((s,v)=>s+v.redeemed,0); return c > 0 ? Math.round(r/c*100)+'%' : '—' })(), color: '#D97706' },
    ]
    return (
      <div className="p-6" style={{ minWidth: 1000 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign & Promotion</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{pageCtx.title}</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{pageCtx.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              onClick={() => showToast('info', 'Export', 'Voucher list exported.')}>
              <Download size={13} /> Export
            </button>
            <button onClick={() => setCreateVoucherOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
              style={{ height: 34, fontSize: 13, background: '#059669' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
              onMouseLeave={e => (e.currentTarget.style.background = '#059669')}>
              <Ticket size={13} /> Create Voucher
            </button>
          </div>
        </div>

        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {stats.map(s => (
            <div key={s.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search vouchers…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
          <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option>All Types</option><option>Fixed Amount</option><option>Percentage</option><option>Free Night</option><option>Upgrade</option>
          </select>
          <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option>All Status</option><option>Active</option><option>Paused</option><option>Expired</option><option>Draft</option>
          </select>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} results</span>
        </div>

        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Voucher', 'Type', 'Value', 'Validity', 'Claimed / Qty', 'Redeemed', 'Min. Spend', 'Linked Campaign', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => {
                const linkedCampaign = campaigns.find(c => c.id === v.campaignId)
                const claimPct = v.quantity > 0 && v.quantity < 99999 ? Math.round(v.claimed / v.quantity * 100) : null
                return (
                  <tr key={v.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 48 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{v.id}</div>
                    </td>
                    <td className="px-3"><VoucherTypeBadge type={v.voucherType} /></td>
                    <td className="px-3" style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{v.valueDisplay}</td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                      {v.startDate ? `${v.startDate} → ${v.endDate}` : <span style={{ color: '#CBD5E1' }}>Not set</span>}
                    </td>
                    <td className="px-3" style={{ minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>{v.claimed.toLocaleString()} / {v.quantity >= 99999 ? '∞' : v.quantity.toLocaleString()}</div>
                      {claimPct !== null && (
                        <div className="rounded-full overflow-hidden" style={{ height: 4, background: '#F1F5F9' }}>
                          <div style={{ width: `${claimPct}%`, height: '100%', background: '#059669', borderRadius: 9999 }} />
                        </div>
                      )}
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{v.redeemed.toLocaleString()}</td>
                    <td className="px-3" style={{ fontSize: 12, color: '#64748B' }}>{v.minSpend > 0 ? `¥${v.minSpend}` : 'None'}</td>
                    <td className="px-3">
                      {linkedCampaign ? (
                        <div className="flex items-center gap-1">
                          <Link2 size={11} color="#1664FF" />
                          <span style={{ fontSize: 11, color: '#1664FF', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{linkedCampaign.name}</span>
                        </div>
                      ) : <span style={{ fontSize: 11, color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td className="px-3"><StatusBadge status={v.status} /></td>
                    <td className="px-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn title="View voucher" onClick={() => setDrawerVoucher(v)} color="#1664FF"><Eye size={12} /></ActionBtn>
                        <MoreMenu items={[
                          { label: 'View Details', icon: <Eye size={13} />, onClick: () => setDrawerVoucher(v) },
                          { label: 'Duplicate Voucher', icon: <Copy size={13} />, onClick: () => showToast('success', 'Voucher Duplicated', v.name) },
                          ...(v.status === 'active' ? [{ label: 'Pause Voucher', icon: <Pause size={13} />, onClick: () => showToast('info', 'Voucher Paused', v.name) }] : []),
                          ...(v.status === 'paused' ? [{ label: 'Resume Voucher', icon: <Play size={13} />, onClick: () => showToast('success', 'Voucher Resumed', v.name) }] : []),
                          { label: 'Expire Voucher', icon: <XCircle size={13} />, color: '#DC2626', divider: true, onClick: () => showToast('warning', 'Voucher Expired', v.name) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min((page-1)*perPage+1,total)}–{Math.min(page*perPage,total)} of {total}</span>
            <div className="flex items-center gap-1">
              <PagBtn onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></PagBtn>
              {Array.from({ length: totalPages }).map((_,i) => <PagBtn key={i} onClick={() => setPage(i+1)} active={page===i+1}>{i+1}</PagBtn>)}
              <PagBtn onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}><ChevronRight size={13} /></PagBtn>
            </div>
          </div>
        </div>

        {/* Voucher Detail Drawer */}
        <Drawer open={!!drawerVoucher} onClose={() => setDrawerVoucher(null)} title={drawerVoucher?.name ?? ''} subtitle={`${drawerVoucher?.id} · Voucher`} width={480}>
          {drawerVoucher && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <VoucherTypeBadge type={drawerVoucher.voucherType} />
                <StatusBadge status={drawerVoucher.status} />
                <span style={{ fontSize: 20, fontWeight: 700, color: '#059669', marginLeft: 'auto' }}>{drawerVoucher.valueDisplay}</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[
                  { label: 'Validity',            value: drawerVoucher.startDate ? `${drawerVoucher.startDate} → ${drawerVoucher.endDate}` : 'Not set' },
                  { label: 'Min. Spend',           value: drawerVoucher.minSpend > 0 ? `¥${drawerVoucher.minSpend}` : 'No minimum' },
                  { label: 'Quantity Issued',      value: drawerVoucher.quantity >= 99999 ? 'Unlimited' : drawerVoucher.quantity.toLocaleString() },
                  { label: 'Per-User Limit',       value: String(drawerVoucher.perUserLimit) },
                  { label: 'Claimed',              value: drawerVoucher.claimed.toLocaleString() },
                  { label: 'Redeemed',             value: drawerVoucher.redeemed.toLocaleString() },
                  { label: 'Merchant Scope',       value: drawerVoucher.merchantScope === 'all' ? 'All merchants' : `${drawerVoucher.merchantCount} selected` },
                  { label: 'Created By',           value: drawerVoucher.createdBy },
                  { label: 'Linked Campaign',      value: campaigns.find(c=>c.id===drawerVoucher.campaignId)?.name ?? 'Standalone' },
                ].map(f => (
                  <div key={f.label} className="rounded px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500 }}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Drawer>

        <CreateVoucherDrawer open={createVoucherOpen} onClose={() => setCreateVoucherOpen(false)}
          onSave={() => { setCreateVoucherOpen(false); showToast('success', 'Voucher Created', 'New voucher is ready to distribute.') }} />
      </div>
    )
  }

  // ── Promo Codes tab ───────────────────────────────────────────────────────
  if (tab === 'campaigns-codes') {
    const filtered = promoCodes.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
    )
    const total = filtered.length
    const rows = filtered.slice((page - 1) * perPage, page * perPage)
    const totalPages = Math.max(1, Math.ceil(total / perPage))
    const stats = [
      { label: 'Active Codes',    value: promoCodes.filter(p => p.status === 'active').length,                    color: '#7C3AED' },
      { label: 'Total Uses',      value: promoCodes.reduce((s, p) => s + p.usageCount, 0).toLocaleString(),       color: '#1664FF' },
      { label: 'Usage Remaining', value: promoCodes.filter(p=>p.status==='active').reduce((s,p)=>s+(p.usageLimit-p.usageCount),0).toLocaleString(), color: '#059669' },
      { label: 'Avg. Usage Rate', value: (() => { const tot = promoCodes.reduce((s,p)=>s+p.usageLimit,0); const used = promoCodes.reduce((s,p)=>s+p.usageCount,0); return tot > 0 ? Math.round(used/tot*100)+'%' : '—' })(), color: '#D97706' },
    ]
    return (
      <div className="p-6" style={{ minWidth: 1000 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign & Promotion</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{pageCtx.title}</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{pageCtx.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              onClick={() => showToast('info', 'Export', 'Promo codes exported.')}>
              <Download size={13} /> Export
            </button>
            <button onClick={() => setCreateCodeOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
              style={{ height: 34, fontSize: 13, background: '#7C3AED' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#6D28D9')}
              onMouseLeave={e => (e.currentTarget.style.background = '#7C3AED')}>
              <Code2 size={13} /> Create Promo Code
            </button>
          </div>
        </div>

        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {stats.map(s => (
            <div key={s.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search promo codes…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
          <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option>All Types</option><option>Percentage</option><option>Fixed Amount</option><option>Free Night</option><option>Cashback</option>
          </select>
          <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option>All Status</option><option>Active</option><option>Paused</option><option>Expired</option><option>Draft</option>
          </select>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} results</span>
        </div>

        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Code', 'Discount Type', 'Value', 'Validity', 'Uses', 'Min. Spend', 'Stackable', 'Linked Campaign', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const linkedCampaign = campaigns.find(c => c.id === p.campaignId)
                const usagePct = p.usageLimit > 0 ? Math.round(p.usageCount / p.usageLimit * 100) : 0
                return (
                  <tr key={p.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 48 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace', letterSpacing: '0.08em' }}>{p.code}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.name}</div>
                    </td>
                    <td className="px-3"><DiscountTypeBadge type={p.discountType} /></td>
                    <td className="px-3" style={{ fontSize: 13, fontWeight: 600, color: '#7C3AED' }}>{p.discountDisplay}</td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                      {p.startDate ? `${p.startDate} → ${p.endDate}` : <span style={{ color: '#CBD5E1' }}>Not set</span>}
                    </td>
                    <td className="px-3" style={{ minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>{p.usageCount.toLocaleString()} / {p.usageLimit.toLocaleString()}</div>
                      <div className="rounded-full overflow-hidden" style={{ height: 4, background: '#F1F5F9' }}>
                        <div style={{ width: `${usagePct}%`, height: '100%', background: usagePct > 90 ? '#DC2626' : '#7C3AED', borderRadius: 9999 }} />
                      </div>
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#64748B' }}>{p.minSpend > 0 ? `¥${p.minSpend}` : 'None'}</td>
                    <td className="px-3">
                      {p.stackable
                        ? <span className="flex items-center gap-1" style={{ fontSize: 11, color: '#059669' }}><CheckCircle size={11} /> Yes</span>
                        : <span className="flex items-center gap-1" style={{ fontSize: 11, color: '#94A3B8' }}><XCircle size={11} /> No</span>}
                    </td>
                    <td className="px-3">
                      {linkedCampaign ? (
                        <div className="flex items-center gap-1">
                          <Link2 size={11} color="#1664FF" />
                          <span style={{ fontSize: 11, color: '#1664FF', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{linkedCampaign.name}</span>
                        </div>
                      ) : <span style={{ fontSize: 11, color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td className="px-3"><StatusBadge status={p.status} /></td>
                    <td className="px-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn title="View code" onClick={() => showToast('info', p.code, `${p.discountDisplay} · ${p.usageCount}/${p.usageLimit} uses`)} color="#7C3AED"><Eye size={12} /></ActionBtn>
                        <MoreMenu items={[
                          { label: 'Copy Code', icon: <Copy size={13} />, onClick: () => showToast('success', 'Code Copied', p.code) },
                          ...(p.status === 'active' ? [{ label: 'Pause Code', icon: <Pause size={13} />, onClick: () => showToast('info', 'Code Paused', p.code) }] : []),
                          ...(p.status === 'paused' ? [{ label: 'Resume Code', icon: <Play size={13} />, onClick: () => showToast('success', 'Code Resumed', p.code) }] : []),
                          { label: 'Expire Code', icon: <XCircle size={13} />, color: '#DC2626', divider: true, onClick: () => showToast('warning', 'Code Expired', p.code) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min((page-1)*perPage+1,total)}–{Math.min(page*perPage,total)} of {total}</span>
            <div className="flex items-center gap-1">
              <PagBtn onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></PagBtn>
              {Array.from({ length: totalPages }).map((_,i) => <PagBtn key={i} onClick={() => setPage(i+1)} active={page===i+1}>{i+1}</PagBtn>)}
              <PagBtn onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}><ChevronRight size={13} /></PagBtn>
            </div>
          </div>
        </div>

        <CreatePromoCodeDrawer open={createCodeOpen} onClose={() => setCreateCodeOpen(false)}
          onSave={() => { setCreateCodeOpen(false); showToast('success', 'Promo Code Created', 'New code is active and ready to use.') }} />
      </div>
    )
  }

  // ── Campaigns tab (default) ───────────────────────────────────────────────
  const filtered = campaigns.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search)) &&
    (!filterOwner || c.owner === filterOwner)
  )
  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const stats = [
    { label: 'Active Campaigns',  value: campaigns.filter(c => c.status === 'active').length,                   color: '#059669' },
    { label: 'Total Claims',      value: campaigns.reduce((s, c) => s + c.totalClaims, 0).toLocaleString(),     color: '#1664FF' },
    { label: 'Conversions',       value: campaigns.reduce((s, c) => s + c.conversions, 0).toLocaleString(),     color: '#7C3AED' },
    { label: 'Campaign Revenue',  value: '¥' + (campaigns.reduce((s, c) => s + c.revenue, 0) / 1000000).toFixed(1) + 'M', color: '#D97706' },
  ]

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaign & Promotion</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{pageCtx.title}</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{pageCtx.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md px-3"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            onClick={() => showToast('info', 'Export', 'Campaign list exported.')}>
            <Download size={13} /> Export
          </button>
          <button onClick={() => setCreateCampaignOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: '#1664FF' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#0E4FCC')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1664FF')}>
            <Plus size={13} /> Create Campaign
          </button>
        </div>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {/* Platform Campaign Fund — single-value + edit */}
        <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Platform Campaign Fund</div>
            <button
              onClick={() => setEditBudgetOpen(true)}
              className="flex items-center gap-1 rounded"
              style={{ height: 22, padding: '0 6px', fontSize: 11, color: '#1664FF', background: '#EEF4FF', border: '1px solid #BFDBFE', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#DBEAFE')}
              onMouseLeave={e => (e.currentTarget.style.background = '#EEF4FF')}>
              <Pencil size={10} /> Edit
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Total Budget</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{fmtMMK(platformTotal)}</div>
        </div>
        {stats.map(s => (
          <div key={s.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search campaigns…"
          className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
        <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option>All Types</option><option>Flash Sale</option><option>Seasonal</option><option>Loyalty</option><option>Partnership</option><option>Referral</option>
        </select>
        <select value={filterOwner} onChange={e => { setFilterOwner(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: filterOwner ? '#1664FF' : '#64748B', fontWeight: filterOwner ? 600 : 400 }}>
          <option value="">All Campaigns</option><option value="platform">Platform Campaigns</option><option value="merchant">Merchant Campaigns</option>
        </select>
        <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
          <option>All Status</option><option>Active</option><option>Paused</option><option>Scheduled</option><option>Ended</option><option>Draft</option>
        </select>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} results</span>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Campaign', 'Type', 'Owner', 'Period', 'Budget / Spent', 'Merchants', 'Claims', 'Conversions', 'Revenue', 'Linked', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const spentPct = c.budget > 0 ? Math.round(c.spent / c.budget * 100) : 0
              return (
                <tr key={c.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-3" style={{ height: 52 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{c.id}</div>
                  </td>
                  <td className="px-3"><CampaignTypeBadge type={c.type} /></td>
                  <td className="px-3" style={{ minWidth: 140 }}><CampaignOwnerBadge owner={c.owner} merchantOwner={c.merchantOwner} /></td>
                  <td className="px-3" style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                    {c.startDate ? `${c.startDate} → ${c.endDate}` : <span style={{ color: '#CBD5E1' }}>Not set</span>}
                  </td>
                  <td className="px-3" style={{ minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>¥{(c.spent/1000).toFixed(0)}K / ¥{(c.budget/1000).toFixed(0)}K ({spentPct}%)</div>
                    <div className="rounded-full overflow-hidden" style={{ height: 4, background: '#F1F5F9' }}>
                      <div style={{ width: `${spentPct}%`, height: '100%', background: spentPct > 80 ? '#DC2626' : '#1664FF', borderRadius: 9999 }} />
                    </div>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#64748B' }}>
                    {c.merchantCount > 0 ? `${c.merchantCount}` : <span style={{ color: '#94A3B8' }}>All</span>}
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{c.totalClaims.toLocaleString()}</td>
                  <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{c.conversions.toLocaleString()}</td>
                  <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#059669', fontFamily: 'monospace' }}>
                    {c.revenue > 0 ? `¥${(c.revenue/1000000).toFixed(1)}M` : <span style={{ color: '#CBD5E1' }}>—</span>}
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
                      {c.linkedVouchers > 0 && (
                        <span className="flex items-center gap-0.5" style={{ color: '#059669' }}>
                          <Ticket size={11} />{c.linkedVouchers}
                        </span>
                      )}
                      {c.linkedCodes > 0 && (
                        <span className="flex items-center gap-0.5" style={{ color: '#7C3AED' }}>
                          <Tag size={11} />{c.linkedCodes}
                        </span>
                      )}
                      {c.linkedVouchers === 0 && c.linkedCodes === 0 && <span style={{ color: '#CBD5E1' }}>—</span>}
                    </div>
                  </td>
                  <td className="px-3"><StatusBadge status={c.status} /></td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn title="View campaign details" onClick={() => setDrawerCampaign(c)} color="#1664FF"><Eye size={12} /></ActionBtn>
                      <MoreMenu items={[
                        { label: 'View Details', icon: <Eye size={13} />, onClick: () => setDrawerCampaign(c) },
                        ...(c.status === 'active' ? [{ label: 'Pause Campaign', icon: <Pause size={13} />, onClick: () => showToast('info', 'Campaign Paused', c.name) }] : []),
                        ...(c.status === 'paused' ? [{ label: 'Resume Campaign', icon: <Play size={13} />, onClick: () => showToast('success', 'Campaign Resumed', c.name) }] : []),
                        { label: 'View Linked Vouchers', icon: <Ticket size={13} />, onClick: () => setDrawerCampaign(c) },
                        { label: 'View Linked Codes', icon: <Tag size={13} />, onClick: () => setDrawerCampaign(c) },
                        { label: 'End Campaign', icon: <XCircle size={13} />, color: '#DC2626', divider: true, onClick: () => showToast('warning', 'Campaign Ended', c.name) },
                      ]} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Showing {Math.min(start+1,total)}–{Math.min(start+perPage,total)} of {total}</span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></PagBtn>
            {Array.from({ length: totalPages }).map((_,i) => <PagBtn key={i} onClick={() => setPage(i+1)} active={page===i+1}>{i+1}</PagBtn>)}
            <PagBtn onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}><ChevronRight size={13} /></PagBtn>
          </div>
        </div>
      </div>

      <EditBudgetModal open={editBudgetOpen} currentTotal={platformTotal} onClose={() => setEditBudgetOpen(false)}
        onSave={(v) => { setPlatformTotal(v); showToast('success', 'Budget Updated', `Platform Campaign Fund set to ${fmtMMK(v)}.`) }} />
      <CampaignDetailDrawer campaign={drawerCampaign} onClose={() => setDrawerCampaign(null)} />
      <CreateCampaignDrawer open={createCampaignOpen} onClose={() => setCreateCampaignOpen(false)}
        onSave={(amount, type) => { setPlatformAllocated(prev => prev + amount); setCreateCampaignOpen(false); showToast('success', type === 'long_stay_deal' ? 'Long Stay Deal Created' : 'Campaign Created', type === 'long_stay_deal' ? 'Long Stay Deal campaign created successfully.' : 'New campaign has been saved as draft.') }}
      platformTotal={platformTotal}
      platformAllocated={platformAllocated} />
    </div>
  )
}

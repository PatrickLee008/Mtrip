import { useState } from 'react'
import {
  Search, Filter, Eye, CheckCircle, XCircle, RefreshCw, Download,
  ChevronLeft, ChevronRight, FileText, User, Clock,
  ChevronDown, Plus, Send, Edit2, AlertCircle, Paperclip,
  Bell, UserCheck, Layers, ShieldCheck,
} from 'lucide-react'
import { allApplications } from '../data/platformData'
import type { VerifApplication, VerifStatus } from '../data/platformData'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'
import Drawer from '../components/Drawer'
import Dialog from '../components/Dialog'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

// ── Onboarding status ─────────────────────────────────────────────────────────

type OnboardingStatus =
  | 'new_lead' | 'contacted' | 'kyc_requested'
  | 'waiting_docs' | 'under_review' | 'approved' | 'rejected'

const ONBOARDING_STEPS: { key: OnboardingStatus; label: string }[] = [
  { key: 'new_lead',      label: 'New Lead' },
  { key: 'contacted',     label: 'Contacted' },
  { key: 'kyc_requested', label: 'KYC Sent' },
  { key: 'waiting_docs',  label: 'Waiting Docs' },
  { key: 'under_review',  label: 'Under Review' },
  { key: 'approved',      label: 'Approved' },
]

const ONBOARDING_STATUS_CFG: Record<OnboardingStatus, { label: string; color: string; bg: string; border: string }> = {
  new_lead:      { label: 'New Lead',              color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  contacted:     { label: 'Contacted',             color: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
  kyc_requested: { label: 'KYC Requested',         color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE' },
  waiting_docs:  { label: 'Waiting for Documents', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  under_review:  { label: 'Under Review',          color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  approved:      { label: 'Approved',              color: '#027A48', bg: '#ECFDF3', border: '#A7F3D0' },
  rejected:      { label: 'Rejected',              color: '#C01048', bg: '#FFF1F3', border: '#FECDD3' },
}

// Map existing VerifStatus → OnboardingStatus for demo
function deriveOnboarding(app: VerifApplication, idx: number): OnboardingStatus {
  if (app.status === 'approved') return 'approved'
  if (app.status === 'rejected') return 'rejected'
  if (app.status === 'resubmission') return 'waiting_docs'
  // Distribute pending apps across stages
  const stages: OnboardingStatus[] = ['new_lead', 'contacted', 'kyc_requested', 'waiting_docs', 'under_review']
  return stages[idx % stages.length]
}

// ── Business Types ────────────────────────────────────────────────────────────

type BusinessType = 'hotel' | 'restaurant' | 'airline' | 'car_rental' | 'attraction'

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  hotel:      'Hotel',
  restaurant: 'Restaurant',
  airline:    'Airline',
  car_rental: 'Car Rental',
  attraction: 'Attraction / Activity',
}

const BUSINESS_TYPE_ICON: Record<BusinessType, string> = {
  hotel:      '🏨',
  restaurant: '🍽️',
  airline:    '✈️',
  car_rental: '🚗',
  attraction: '🎯',
}

// ── KYC Templates ─────────────────────────────────────────────────────────────

interface KycTemplate { id: string; name: string; businessType: BusinessType; docs: string[] }

const KYC_TEMPLATES: KycTemplate[] = [
  // Hotel
  { id: 'hotel-single', businessType: 'hotel', name: 'Hotel – Single Property',
    docs: ['Business Registration Certificate', 'Hotel Operating License', 'Owner NRC / Passport', 'Bank Certificate', 'Tax Registration Certificate', 'Premises Ownership / Lease Agreement'] },
  { id: 'hotel-multi',  businessType: 'hotel', name: 'Hotel – Multi Property',
    docs: ['Business Registration Certificate', 'Hotel Operating License (per property)', 'Company Director List', 'Owner NRC / Passport', 'Bank Certificate', 'Tax Registration Certificate', 'Organogram / Structure Chart'] },
  // Restaurant
  { id: 'restaurant-single', businessType: 'restaurant', name: 'Restaurant – Single Location',
    docs: ['Business Registration Certificate', 'Restaurant Business License', 'Food & Beverage Permit', 'Owner NRC / Passport', 'Bank Certificate', 'Tax Registration Certificate'] },
  { id: 'restaurant-chain',  businessType: 'restaurant', name: 'Restaurant – Chain',
    docs: ['Business Registration Certificate', 'Restaurant License (per location)', 'Company Director List', 'Food & Beverage Permit', 'Owner NRC / Passport', 'Bank Certificate', 'Tax Registration Certificate'] },
  // Airline
  { id: 'airline', businessType: 'airline', name: 'Airline Operator',
    docs: ['Air Operator Certificate', 'Airline Business Registration', 'Civil Aviation Authority License', 'Company Director List', 'Bank Certificate', 'Tax Registration Certificate', 'Aviation Insurance Certificate'] },
  // Car Rental
  { id: 'car-rental-standard', businessType: 'car_rental', name: 'Car Rental – Standard',
    docs: ['Vehicle Fleet Registration Documents', 'Car Rental Business License', 'Owner NRC / Passport', 'Bank Certificate', 'Tax Registration Certificate', 'Fleet Insurance Certificate'] },
  { id: 'car-rental-fleet',    businessType: 'car_rental', name: 'Car Rental – Large Fleet',
    docs: ['Vehicle Fleet Registration Documents', 'Car Rental Business License', 'Company Director List', 'Bank Certificate', 'Tax Registration Certificate', 'Fleet Insurance Certificate', 'Garage / Depot Lease Agreement'] },
  // Attraction
  { id: 'attraction-single', businessType: 'attraction', name: 'Attraction / Activity – Single Venue',
    docs: ['Tourism Business License', 'Business Registration Certificate', 'Owner NRC / Passport', 'Bank Certificate', 'Tax Registration Certificate', 'Safety & Liability Insurance'] },
  { id: 'attraction-multi',  businessType: 'attraction', name: 'Attraction / Activity – Multi Venue',
    docs: ['Tourism Business License (per venue)', 'Business Registration Certificate', 'Company Director List', 'Bank Certificate', 'Tax Registration Certificate', 'Safety & Liability Insurance', 'Venue Lease Agreements'] },
]

// Additional-business docs per business type (for existing verified merchants)
const ADDITIONAL_BUSINESS_DOCS: Record<BusinessType, string[]> = {
  hotel: [
    'Hotel Operating License',
    'Premises Ownership / Lease Agreement',
    'Hotel & Room Photos',
    'Tourism License (if applicable)',
    'Fire Safety Certificate',
  ],
  restaurant: [
    'Restaurant Business License',
    'Food & Beverage Permit',
    'Premises Lease Agreement',
    'Kitchen & Dining Photos',
    'Health Inspection Certificate',
  ],
  airline: [
    'Aircraft Registration Documents',
    'Route Operating Permit',
    'Insurance Certificate (per aircraft)',
    'Maintenance Agreement (if applicable)',
  ],
  car_rental: [
    'Vehicle Registration Documents',
    'Fleet Insurance Certificate',
    'Depot / Garage Lease Agreement (if applicable)',
    'Vehicle Photos',
  ],
  attraction: [
    'Tourism License',
    'Safety Inspection Certificate',
    'Premises Lease Agreement',
    'Activity / Venue Photos (if applicable)',
  ],
}

// ── Tab / list config ─────────────────────────────────────────────────────────

const tabFilters: Record<string, VerifStatus[]> = {
  verification: ['pending'],
  'verification-approved': ['approved'],
  'verification-rejected': ['rejected'],
  'verification-resubmission': ['resubmission'],
}

const tabConfig: Record<string, { title: string; subtitle: string; activeCard: string }> = {
  verification:                { title: 'Pending Review',          subtitle: 'Applications waiting for verification or currently being reviewed.',  activeCard: 'Pending Review' },
  'verification-approved':     { title: 'Approved Applications',   subtitle: 'Merchants successfully verified and approved to list on mTrip.',       activeCard: 'Approved' },
  'verification-rejected':     { title: 'Rejected Applications',   subtitle: 'Applications that did not meet platform requirements.',               activeCard: 'Rejected' },
  'verification-resubmission': { title: 'Resubmitted Applications',subtitle: 'Applications returned to merchants for correction and resubmission.', activeCard: 'Resubmission' },
}

// ── Shared micro-components ───────────────────────────────────────────────────

function OnboardingBadge({ status }: { status: OnboardingStatus }) {
  const cfg = ONBOARDING_STATUS_CFG[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

function DocStatusBadge({ status }: { status: 'verified' | 'pending' | 'rejected' }) {
  const cfg = {
    verified: { bg: '#ECFDF3', color: '#027A48', label: 'Approved', icon: <CheckCircle size={10} /> },
    pending:  { bg: '#FFFBEB', color: '#B54708', label: 'Pending',  icon: <Clock size={10} /> },
    rejected: { bg: '#FFF1F3', color: '#C01048', label: 'Rejected', icon: <XCircle size={10} /> },
  }
  const c = cfg[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 20, padding: '0 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color }}>
      {c.icon}{c.label}
    </span>
  )
}

function ActionBtn({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center rounded transition-colors" style={{ width: 28, height: 28, color: '#94A3B8', border: '1px solid transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = color + '15'; e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color + '40' }}
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


function DrawerField({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="rounded-md px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit', textTransform: capitalize ? 'capitalize' : 'none' }}>{value}</div>
    </div>
  )
}

// ── Section 1 — Onboarding Progress ──────────────────────────────────────────

function OnboardingProgressBar({ status }: { status: OnboardingStatus }) {
  if (status === 'rejected') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FFF1F3', borderRadius: 8, border: '1px solid #FECDD3' }}>
        <XCircle size={14} color="#C01048" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#C01048' }}>Application Rejected — Onboarding closed</span>
      </div>
    )
  }
  const stepKeys = ONBOARDING_STEPS.map(s => s.key)
  const currentIdx = stepKeys.indexOf(status === 'approved' ? 'approved' : status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {ONBOARDING_STEPS.map((step, i) => {
        const done    = i < currentIdx
        const active  = i === currentIdx
        const pending = i > currentIdx
        const color   = done ? '#059669' : active ? '#1664FF' : '#CBD5E1'
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < ONBOARDING_STEPS.length - 1 ? '1 1 0' : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: done ? '#059669' : active ? '#1664FF' : '#F1F5F9', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                {done   ? <CheckCircle size={12} color="#fff" fill="#059669" /> : null}
                {active ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} /> : null}
                {pending? <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#CBD5E1' }} /> : null}
              </div>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: done ? '#059669' : active ? '#1664FF' : '#94A3B8', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>{step.label}</span>
            </div>
            {i < ONBOARDING_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#059669' : '#E3E8F0', margin: '0 2px', marginBottom: 14, transition: 'background 0.3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Registration Status Card ──────────────────────────────────────────────────

const MOCK_AGENTS = ['Mg. Aung Ko', 'Ma. Aye Aye', 'Ko. Zaw Lin', 'Ma. Thin Thin', 'Unassigned']

function RegistrationStatusCard({ app, onboardingStatus, onStatusChange, onAssignAgent, assignedAgent }: {
  app: VerifApplication
  onboardingStatus: OnboardingStatus
  onStatusChange: (s: OnboardingStatus) => void
  onAssignAgent: (a: string) => void
  assignedAgent: string
}) {
  const cfg = ONBOARDING_STATUS_CFG[onboardingStatus]
  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
      {/* Status bar */}
      <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <OnboardingBadge status={onboardingStatus} />
        <span style={{ fontSize: 12, color: cfg.color, fontWeight: 500 }}>Onboarding Stage</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>Change:</span>
          <select value={onboardingStatus} onChange={e => onStatusChange(e.target.value as OnboardingStatus)}
            style={{ fontSize: 11, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '3px 6px', color: cfg.color, background: cfg.bg, outline: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {Object.entries(ONBOARDING_STATUS_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Progress */}
      <div style={{ padding: '14px 16px 10px' }}>
        <OnboardingProgressBar status={onboardingStatus} />
      </div>
      {/* Meta row */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Lead ID',              value: app.applicationId, mono: true },
          { label: 'Registration Date',    value: app.submittedDate,  mono: true },
          { label: 'Assigned Ops',         value: assignedAgent },
          { label: 'Last Updated',         value: '2024-12-10',       mono: true },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{f.label}</div>
            {f.label === 'Assigned Ops' ? (
              <select value={assignedAgent} onChange={e => onAssignAgent(e.target.value)}
                style={{ fontSize: 12, border: '1px solid #E3E8F0', borderRadius: 5, padding: '2px 6px', color: '#1A2332', background: '#fff', outline: 'none', cursor: 'pointer', width: '100%', fontWeight: 500 }}>
                {MOCK_AGENTS.map(a => <option key={a}>{a}</option>)}
              </select>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.value}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section 2 — Registration Info ─────────────────────────────────────────────

function RegistrationInfoSection({ app }: { app: VerifApplication }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <DrawerField label="Business Name"   value={app.businessName} />
      <DrawerField label="Contact Person"  value={app.ownerName} />
      <DrawerField label="Mobile Number"   value={app.phone} mono />
      <DrawerField label="Email"           value={app.email} />
      <DrawerField label="Address"         value={app.city + ' Business District'} />
      <DrawerField label="City"            value={app.city} />
      <DrawerField label="Country"         value="Myanmar" />
      <DrawerField label="Reg. Number"     value={app.businessRegNo} mono />
    </div>
  )
}

// ── Section 3 — Business Assessment ──────────────────────────────────────────

interface AssessmentForm {
  merchantCategory: string
  businessType: string
  numBusinesses: string
  expectedLaunch: string
  internalNotes: string
}

function BusinessAssessmentSection({ form, onChange, readOnly }: {
  form: AssessmentForm
  onChange: (f: AssessmentForm) => void
  readOnly: boolean
}) {
  const inp: React.CSSProperties = { width: '100%', fontSize: 12, color: '#1A2332', border: '1px solid #E3E8F0', borderRadius: 6, padding: '7px 10px', outline: 'none', background: readOnly ? '#F8FAFC' : '#fff', cursor: readOnly ? 'default' : 'text' }
  const set = (k: keyof AssessmentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [k]: e.target.value })

  return (
    <div>
      {readOnly && <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', marginBottom: 10 }}>Completed by Merchant Operations</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 4, fontWeight: 600 }}>Business Category</label>
          <select value={form.merchantCategory} onChange={set('merchantCategory')} disabled={readOnly} style={{ ...inp, cursor: readOnly ? 'default' : 'pointer' }}>
            <option value="">Select category…</option>
            <option value="hotel">Hotel</option>
            <option value="restaurant">Restaurant</option>
            <option value="airline">Airline</option>
            <option value="car_rental">Car Rental</option>
            <option value="attraction">Attraction / Activity</option>
            <option value="mixed">Mixed / Multi-Category</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 4, fontWeight: 600 }}>Operator Type</label>
          <select value={form.businessType} onChange={set('businessType')} disabled={readOnly} style={{ ...inp, cursor: readOnly ? 'default' : 'pointer' }}>
            <option value="">Select type…</option>
            <option value="single_unit">Single Unit</option>
            <option value="chain">Chain / Multi-Location</option>
            <option value="franchise">Franchise</option>
            <option value="independent">Independent Operator</option>
            <option value="mixed">Mixed Business</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 4, fontWeight: 600 }}>Number of Businesses</label>
          <input type="number" min={1} value={form.numBusinesses} onChange={set('numBusinesses')} disabled={readOnly} placeholder="e.g. 3" style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 4, fontWeight: 600 }}>Expected Launch Date</label>
          <input type="date" value={form.expectedLaunch} onChange={set('expectedLaunch')} disabled={readOnly} style={inp} />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 4, fontWeight: 600 }}>Internal Notes</label>
        <textarea value={form.internalNotes} onChange={set('internalNotes')} disabled={readOnly} rows={3}
          placeholder="Add Merchant Operations assessment notes here…"
          style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
      </div>
    </div>
  )
}

// ── Section 4 — KYC Template ──────────────────────────────────────────────────

type VerificationScope = 'new_merchant' | 'additional_business'

function KycTemplateSection({ selectedTemplateId, onSelect, onSend, onPreview, onboardingStatus, businessType, onBusinessTypeChange, initialScope }: {
  selectedTemplateId: string
  onSelect: (id: string) => void
  onSend: () => void
  onPreview: () => void
  onboardingStatus: OnboardingStatus
  businessType: BusinessType
  onBusinessTypeChange: (bt: BusinessType) => void
  initialScope?: VerificationScope
}) {
  const [scope, setScope] = useState<VerificationScope>(initialScope ?? 'new_merchant')

  const sent = onboardingStatus === 'kyc_requested' || onboardingStatus === 'waiting_docs' || onboardingStatus === 'under_review' || onboardingStatus === 'approved'
  const isAdditional = scope === 'additional_business'

  // Templates filtered to the selected business type
  const filteredTemplates = KYC_TEMPLATES.filter(t => t.businessType === businessType)
  const template = KYC_TEMPLATES.find(t => t.id === selectedTemplateId)

  // When business type changes, auto-select first matching template
  function handleBusinessTypeChange(bt: BusinessType) {
    onBusinessTypeChange(bt)
    const first = KYC_TEMPLATES.find(t => t.businessType === bt)
    if (first) onSelect(first.id)
  }

  // Active document list: template docs for new merchant, type-specific additional docs for existing
  const activeDocs: string[] = isAdditional
    ? ADDITIONAL_BUSINESS_DOCS[businessType]
    : (template?.docs ?? [])

  const docListLabel = isAdditional
    ? `Additional ${BUSINESS_TYPE_LABELS[businessType]}`
    : (template?.name ?? 'New Merchant')

  return (
    <div>
      {sent && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: '#027A48', background: '#ECFDF3', padding: '2px 7px', borderRadius: 10, marginBottom: 10 }}>
          <CheckCircle size={9} /> KYC Sent
        </div>
      )}

      {/* Verification Scope selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Scope</div>
        <div style={{ display: 'flex', gap: 0, border: '1px solid #E3E8F0', borderRadius: 6, overflow: 'hidden' }}>
          {([['new_merchant', 'New Merchant'], ['additional_business', 'Additional Business']] as [VerificationScope, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setScope(val)}
              style={{
                flex: 1, height: 32, fontSize: 12, fontWeight: scope === val ? 600 : 400, border: 'none', cursor: 'pointer',
                borderRight: val === 'new_merchant' ? '1px solid #E3E8F0' : 'none',
                color: scope === val ? '#1664FF' : '#64748B',
                background: scope === val ? '#EEF4FF' : '#fff',
                transition: 'background 0.15s, color 0.15s',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Business Type selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Type</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.entries(BUSINESS_TYPE_LABELS) as [BusinessType, string][]).map(([bt, label]) => (
            <button key={bt} onClick={() => handleBusinessTypeChange(bt)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 20, fontSize: 11, fontWeight: businessType === bt ? 600 : 400, cursor: 'pointer', border: `1px solid ${businessType === bt ? '#1664FF' : '#E3E8F0'}`,
                color: businessType === bt ? '#1664FF' : '#64748B',
                background: businessType === bt ? '#EEF4FF' : '#fff',
                transition: 'all 0.15s',
              }}>
              <span>{BUSINESS_TYPE_ICON[bt]}</span> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Additional Business verified banner */}
      {isAdditional && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#ECFDF3', border: '1px solid #A7F3D0', marginBottom: 12 }}>
          <ShieldCheck size={14} color="#059669" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#065F46', marginBottom: 2 }}>
              Merchant KYC Status: <span style={{ color: '#027A48' }}>Verified</span>
            </div>
            <div style={{ fontSize: 11, color: '#047857', lineHeight: 1.5 }}>
              Business verification has already been completed. Only {BUSINESS_TYPE_LABELS[businessType].toLowerCase()}-specific documents are required for this additional business.
            </div>
          </div>
        </div>
      )}

      {/* Template selector — only for new merchant */}
      {!isAdditional && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Template</div>
          <div style={{ position: 'relative' }}>
            <select value={selectedTemplateId} onChange={e => onSelect(e.target.value)}
              style={{ width: '100%', fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', borderRadius: 6, padding: '8px 32px 8px 10px', outline: 'none', background: '#fff', appearance: 'none', cursor: 'pointer', fontWeight: selectedTemplateId ? 600 : 400 }}>
              <option value="">— Select Template —</option>
              {filteredTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown size={13} color="#94A3B8" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>
      )}

      {/* Document checklist — driven by scope + business type */}
      {activeDocs.length > 0 && (
        <div style={{ background: '#F8FAFC', border: '1px solid #E3E8F0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '8px 12px', background: '#F1F5F9', borderBottom: '1px solid #E3E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
              Required Documents — {docListLabel}
            </span>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>{activeDocs.length} documents</span>
          </div>
          {activeDocs.map((doc, i) => {
            const isOptional = doc.includes('(if applicable)')
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: i < activeDocs.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                {isOptional
                  ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px dashed #94A3B8', flexShrink: 0 }} />
                  : <CheckCircle size={13} color="#059669" fill="#059669" />}
                <span style={{ fontSize: 12, color: isOptional ? '#94A3B8' : '#1A2332' }}>{doc}</span>
                {isOptional && <span style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic', marginLeft: 2 }}>Optional</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onPreview}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
          <Eye size={12} /> Preview Requirements
        </button>
        <button onClick={() => {}}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', fontSize: 12, color: '#6D28D9', border: '1px solid #DDD6FE', borderRadius: 6, background: '#F5F3FF', cursor: 'pointer' }}>
          <Edit2 size={12} /> Edit Template
        </button>
        <button onClick={onSend}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 14px', fontSize: 12, fontWeight: 600, color: '#fff', background: '#1664FF', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          <Send size={12} /> Send KYC Request
        </button>
      </div>
    </div>
  )
}

// ── Section 5 — Documents ─────────────────────────────────────────────────────

interface DocumentRow {
  name: string
  type: string
  status: 'verified' | 'pending' | 'rejected'
  uploadDate: string
  rejectionComment?: string
}

function MerchantDocumentsSection({ documents, onApprove, onReject, rejectComments, onCommentChange }: {
  documents: DocumentRow[]
  onApprove: (idx: number) => void
  onReject: (idx: number) => void
  rejectComments: Record<number, string>
  onCommentChange: (idx: number, v: string) => void
}) {
  if (documents.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px', background: '#F8FAFC', borderRadius: 8, border: '1px dashed #E3E8F0', textAlign: 'center' }}>
        <Paperclip size={20} color="#CBD5E1" />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>No documents uploaded yet</span>
      </div>
    )
  }
  return (
    <div style={{ border: '1px solid #E3E8F0', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
            {['Document', 'Status', 'Uploaded', 'Actions'].map(h => (
              <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#64748B', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, i) => (
            <>
              <tr key={`doc-${i}`} style={{ borderBottom: '1px solid #F1F5F9', background: doc.status === 'pending' ? '#FFFEF5' : '#fff' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={13} color="#1664FF" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{doc.name}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'capitalize' }}>{doc.type.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <DocStatusBadge status={doc.status} />
                  {doc.status === 'pending' && (
                    <div style={{ fontSize: 9, color: '#D97706', marginTop: 2, fontWeight: 600 }}>⚠ Awaiting review</div>
                  )}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{doc.uploadDate}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px', fontSize: 11, color: '#1664FF', border: '1px solid #BFDBFE', borderRadius: 4, background: '#EEF4FF', cursor: 'pointer' }}>
                      <Eye size={10} /> View
                    </button>
                    {doc.status !== 'verified' && (
                      <button onClick={() => onApprove(i)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px', fontSize: 11, color: '#059669', border: '1px solid #A7F3D0', borderRadius: 4, background: '#ECFDF3', cursor: 'pointer' }}>
                        <CheckCircle size={10} /> Approve
                      </button>
                    )}
                    {doc.status !== 'rejected' && (
                      <button onClick={() => onReject(i)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px', fontSize: 11, color: '#C01048', border: '1px solid #FECDD3', borderRadius: 4, background: '#FFF1F3', cursor: 'pointer' }}>
                        <XCircle size={10} /> Reject
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {doc.status === 'rejected' && (
                <tr key={`comment-${i}`} style={{ background: '#FFF8F8', borderBottom: '1px solid #F1F5F9' }}>
                  <td colSpan={4} style={{ padding: '6px 12px 10px 52px' }}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: '#C01048', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rejection Comment</label>
                    <input value={rejectComments[i] ?? ''} onChange={e => onCommentChange(i, e.target.value)}
                      placeholder="Enter rejection reason for the merchant…"
                      style={{ width: '100%', fontSize: 12, border: '1px solid #FECDD3', borderRadius: 5, padding: '5px 8px', outline: 'none', background: '#fff', color: '#1A2332' }} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Section 6 — Activity Timeline ────────────────────────────────────────────

interface TimelineEvent { date: string; action: string; by: string; type?: 'system' | 'admin' | 'merchant' }

const STATUS_TIMELINE: Record<OnboardingStatus, TimelineEvent[]> = {
  new_lead:      [{ date: '2024-12-01', action: 'Merchant registered / Lead created', by: 'System', type: 'system' }],
  contacted:     [
    { date: '2024-12-01', action: 'Merchant registered / Lead created', by: 'System', type: 'system' },
    { date: '2024-12-02', action: 'Merchant Operations assigned', by: 'Admin', type: 'admin' },
    { date: '2024-12-03', action: 'Merchant contacted via phone', by: 'Ma. Aye Aye', type: 'admin' },
  ],
  kyc_requested: [
    { date: '2024-12-01', action: 'Merchant registered / Lead created', by: 'System', type: 'system' },
    { date: '2024-12-02', action: 'Merchant Operations assigned', by: 'Admin', type: 'admin' },
    { date: '2024-12-03', action: 'Merchant contacted via phone', by: 'Ma. Aye Aye', type: 'admin' },
    { date: '2024-12-04', action: 'Business assessment completed', by: 'Ma. Aye Aye', type: 'admin' },
    { date: '2024-12-04', action: 'KYC template selected: Hotel – Single Property', by: 'Ma. Aye Aye', type: 'admin' },
    { date: '2024-12-05', action: 'KYC request sent to merchant', by: 'System', type: 'system' },
  ],
  waiting_docs:  [
    { date: '2024-12-01', action: 'Merchant registered / Lead created', by: 'System', type: 'system' },
    { date: '2024-12-02', action: 'Merchant Operations assigned', by: 'Admin', type: 'admin' },
    { date: '2024-12-04', action: 'KYC request sent to merchant', by: 'System', type: 'system' },
    { date: '2024-12-06', action: 'Merchant acknowledged KYC request', by: 'Merchant', type: 'merchant' },
  ],
  under_review:  [
    { date: '2024-12-01', action: 'Merchant registered / Lead created', by: 'System', type: 'system' },
    { date: '2024-12-04', action: 'KYC request sent to merchant', by: 'System', type: 'system' },
    { date: '2024-12-07', action: 'Documents uploaded by merchant', by: 'Merchant', type: 'merchant' },
    { date: '2024-12-08', action: 'Documents submitted for review', by: 'System', type: 'system' },
    { date: '2024-12-08', action: 'Verification team review started', by: 'Admin Chen', type: 'admin' },
  ],
  approved:      [
    { date: '2024-12-01', action: 'Merchant registered / Lead created', by: 'System', type: 'system' },
    { date: '2024-12-04', action: 'KYC request sent to merchant', by: 'System', type: 'system' },
    { date: '2024-12-07', action: 'All documents uploaded', by: 'Merchant', type: 'merchant' },
    { date: '2024-12-09', action: 'All documents approved', by: 'Admin Chen', type: 'admin' },
    { date: '2024-12-10', action: 'Merchant application approved', by: 'Admin Li', type: 'admin' },
    { date: '2024-12-10', action: 'Merchant account activated', by: 'System', type: 'system' },
  ],
  rejected:      [
    { date: '2024-12-01', action: 'Merchant registered / Lead created', by: 'System', type: 'system' },
    { date: '2024-12-04', action: 'KYC request sent to merchant', by: 'System', type: 'system' },
    { date: '2024-12-07', action: 'Documents reviewed — incomplete', by: 'Admin Chen', type: 'admin' },
    { date: '2024-12-10', action: 'Application rejected', by: 'Admin Li', type: 'admin' },
  ],
}

const TIMELINE_TYPE_CFG = {
  system:   { color: '#94A3B8', dot: '#E3E8F0', label: 'System' },
  admin:    { color: '#1664FF', dot: '#1664FF', label: 'Admin' },
  merchant: { color: '#059669', dot: '#059669', label: 'Merchant' },
}

function ActivityTimelineSection({ status, extra }: { status: OnboardingStatus; extra?: TimelineEvent[] }) {
  const events = [...(STATUS_TIMELINE[status] ?? []), ...(extra ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div style={{ position: 'relative', paddingLeft: 20, borderLeft: '2px solid #E3E8F0' }}>
      {events.map((t, i) => {
        const cfg = TIMELINE_TYPE_CFG[t.type ?? 'admin']
        return (
          <div key={i} style={{ marginBottom: 14, position: 'relative' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, border: '2px solid #fff', boxShadow: `0 0 0 2px ${cfg.dot}`, position: 'absolute', left: -25, top: 2 }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#94A3B8', whiteSpace: 'nowrap' }}>{t.date}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, padding: '0 5px', background: `${cfg.dot}15`, borderRadius: 3 }}>{cfg.label}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332', marginTop: 2 }}>{t.action}</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>by {t.by}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Section 7 — Internal Notes ────────────────────────────────────────────────

interface NoteEntry { text: string; by: string; date: string }

function InternalNotesSection({ notes, draft, onDraftChange, onAdd }: {
  notes: NoteEntry[]
  draft: string
  onDraftChange: (v: string) => void
  onAdd: () => void
}) {
  return (
    <div>
      {/* History */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {notes.map((n, i) => (
            <div key={i} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>{n.by.slice(0, 2).toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E' }}>{n.by}</span>
                <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{n.date}</span>
              </div>
              <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>{n.text}</div>
            </div>
          ))}
        </div>
      )}
      {/* New note */}
      <textarea value={draft} onChange={e => onDraftChange(e.target.value)} rows={3}
        placeholder="Add an internal note visible only to Merchant Operations and Super Admin…"
        style={{ width: '100%', fontSize: 12, border: '1px solid #E3E8F0', borderRadius: 6, padding: '8px 10px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, color: '#1A2332', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <button onClick={onAdd} disabled={!draft.trim()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', fontSize: 12, fontWeight: 600, color: '#fff', background: draft.trim() ? '#1664FF' : '#93C5FD', border: 'none', borderRadius: 6, cursor: draft.trim() ? 'pointer' : 'not-allowed' }}>
          <Plus size={12} /> Add Note
        </button>
      </div>
    </div>
  )
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionDivider({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#94A3B8' }}>{icon}</span>
      <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</h4>
      <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
    </div>
  )
}

// ── Bottom Action Bar ─────────────────────────────────────────────────────────

function OnboardingActionBar({ status, onAction }: {
  status: OnboardingStatus
  onAction: (action: string) => void
}) {
  const btns: { label: string; action: string; variant: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' }[] = []

  if (status === 'new_lead') {
    btns.push({ label: 'Assign Merchant Operations', action: 'assign', variant: 'primary' })
    btns.push({ label: 'Reject Lead', action: 'reject', variant: 'danger' })
  } else if (status === 'contacted') {
    btns.push({ label: 'Send KYC Request', action: 'send_kyc', variant: 'primary' })
    btns.push({ label: 'Save Assessment', action: 'save_assessment', variant: 'secondary' })
  } else if (status === 'kyc_requested') {
    btns.push({ label: 'Send Reminder', action: 'send_reminder', variant: 'warning' })
    btns.push({ label: 'Edit KYC Template', action: 'edit_template', variant: 'secondary' })
  } else if (status === 'waiting_docs') {
    btns.push({ label: 'Send Reminder', action: 'send_reminder', variant: 'warning' })
    btns.push({ label: 'Edit KYC Template', action: 'edit_template', variant: 'secondary' })
  } else if (status === 'under_review') {
    btns.push({ label: 'Approve Merchant', action: 'approve', variant: 'success' })
    btns.push({ label: 'Request Resubmission', action: 'resubmit', variant: 'warning' })
    btns.push({ label: 'Reject Merchant', action: 'reject', variant: 'danger' })
  } else if (status === 'approved') {
    btns.push({ label: 'Activate Merchant', action: 'activate', variant: 'success' })
    btns.push({ label: 'Notify Merchant', action: 'notify', variant: 'secondary' })
  }

  const variantStyle = (v: typeof btns[0]['variant']): React.CSSProperties => {
    if (v === 'primary')   return { background: '#1664FF', color: '#fff', border: 'none' }
    if (v === 'secondary') return { background: '#fff', color: '#475569', border: '1px solid #E3E8F0' }
    if (v === 'danger')    return { background: '#FFF1F3', color: '#C01048', border: '1px solid #FECDD3' }
    if (v === 'warning')   return { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }
    if (v === 'success')   return { background: '#ECFDF3', color: '#027A48', border: '1px solid #A7F3D0' }
    return {}
  }

  if (btns.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {btns.map(b => (
        <button key={b.action} onClick={() => onAction(b.action)}
          style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, ...variantStyle(b.variant) }}>
          {b.action === 'approve' || b.action === 'activate' ? <CheckCircle size={12} /> : null}
          {b.action === 'reject' ? <XCircle size={12} /> : null}
          {b.action === 'send_kyc' || b.action === 'send_reminder' ? <Send size={12} /> : null}
          {b.action === 'notify' ? <Bell size={12} /> : null}
          {b.action === 'assign' ? <UserCheck size={12} /> : null}
          {b.label}
        </button>
      ))}
    </div>
  )
}

// ── Per-business verification tracking ───────────────────────────────────────

interface BusinessRecord {
  id: string
  name: string
  businessType: BusinessType
  verificationStatus: 'verified' | 'pending' | 'under_review' | 'rejected'
  addedDate: string
  documents: DocumentRow[]
}

const BIZ_STATUS_CFG: Record<BusinessRecord['verificationStatus'], { label: string; color: string; bg: string; border: string }> = {
  verified:     { label: 'Verified',     color: '#027A48', bg: '#ECFDF3', border: '#A7F3D0' },
  pending:      { label: 'Pending',      color: '#B54708', bg: '#FFFBEB', border: '#FDE68A' },
  under_review: { label: 'Under Review', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  rejected:     { label: 'Rejected',     color: '#C01048', bg: '#FFF1F3', border: '#FECDD3' },
}

function BusinessSelectorPanel({ businesses, selectedId, onSelect }: {
  businesses: BusinessRecord[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Registered Businesses
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {businesses.map(biz => {
          const sc = BIZ_STATUS_CFG[biz.verificationStatus]
          const active = biz.id === selectedId
          return (
            <button key={biz.id} onClick={() => onSelect(biz.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: active ? '#EEF4FF' : '#fff',
                border: `1px solid ${active ? '#1664FF' : '#E3E8F0'}`,
                borderLeft: `3px solid ${active ? '#1664FF' : '#E3E8F0'}`,
                borderRadius: 8, transition: 'all 0.15s',
              }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: active ? '#DBEAFE' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, transition: 'background 0.15s' }}>
                {BUSINESS_TYPE_ICON[biz.businessType]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#1664FF' : '#1A2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{biz.name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{BUSINESS_TYPE_LABELS[biz.businessType]} · Registered {biz.addedDate}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {sc.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Full detail drawer content ────────────────────────────────────────────────

function VerificationDetailContent({ app, showToast }: {
  app: VerifApplication
  showToast: Props['showToast']
}) {
  const idx = allApplications.findIndex(a => a.applicationId === app.applicationId)
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>(() => deriveOnboarding(app, idx))
  const [assignedAgent, setAssignedAgent]         = useState(app.reviewer === 'Unassigned' ? 'Unassigned' : app.reviewer)
  const [assessment, setAssessment]   = useState<AssessmentForm>({ merchantCategory: 'hotel', businessType: 'single_unit', numBusinesses: '1', expectedLaunch: '', internalNotes: '' })
  const [selectedKyc, setSelectedKyc] = useState('hotel-single')

  const primaryDocs: DocumentRow[] = app.documents.map(d => ({ name: d.name, type: d.type, status: d.status, uploadDate: '2024-12-07' }))
  const bizStatus1: BusinessRecord['verificationStatus'] = app.status === 'approved' ? 'verified' : app.status === 'rejected' ? 'rejected' : 'pending'

  const [businesses, setBusinesses] = useState<BusinessRecord[]>([
    { id: 'biz-1', name: app.businessName, businessType: 'hotel', verificationStatus: bizStatus1, addedDate: app.submittedDate, documents: primaryDocs },
    { id: 'biz-2', name: app.businessName + ' Restaurant', businessType: 'restaurant', verificationStatus: 'under_review', addedDate: '2024-12-08', documents: [] },
  ])
  const [selectedBizId, setSelectedBizId] = useState('biz-1')
  const [businessType, setBusinessType]   = useState<BusinessType>('hotel')
  const [rejectComments, setRejectComments] = useState<Record<number, string>>({})
  const [notes, setNotes]                   = useState<NoteEntry[]>(app.notes ? [{ text: app.notes, by: 'Admin', date: app.submittedDate }] : [])
  const [noteDraft, setNoteDraft]           = useState('')

  const selectedBiz = businesses.find(b => b.id === selectedBizId) ?? businesses[0]

  function handleSelectBusiness(id: string) {
    const biz = businesses.find(b => b.id === id)
    if (!biz) return
    setSelectedBizId(id)
    setBusinessType(biz.businessType)
    setRejectComments({})
    const firstTemplate = KYC_TEMPLATES.find(t => t.businessType === biz.businessType)
    if (firstTemplate) setSelectedKyc(firstTemplate.id)
  }

  function handleApproveDoc(i: number) {
    setBusinesses(prev => prev.map(b => b.id === selectedBizId
      ? { ...b, documents: b.documents.map((d, di) => di === i ? { ...d, status: 'verified' } : d) }
      : b))
    showToast('success', 'Document Approved', `${selectedBiz.documents[i]?.name} approved.`)
  }

  function handleRejectDoc(i: number) {
    setBusinesses(prev => prev.map(b => b.id === selectedBizId
      ? { ...b, documents: b.documents.map((d, di) => di === i ? { ...d, status: 'rejected' } : d) }
      : b))
  }

  function handleAddNote() {
    if (!noteDraft.trim()) return
    const today = new Date().toISOString().slice(0, 10)
    setNotes(prev => [...prev, { text: noteDraft, by: 'Super Admin', date: today }])
    setNoteDraft('')
    showToast('success', 'Note Added', 'Internal note saved.')
  }

  function handleKycSend() {
    setOnboardingStatus('kyc_requested')
    showToast('success', 'KYC Request Sent', 'Merchant has been notified to upload required documents.')
  }

  const assessmentReadOnly = onboardingStatus === 'kyc_requested' || onboardingStatus === 'waiting_docs' || onboardingStatus === 'under_review' || onboardingStatus === 'approved' || onboardingStatus === 'rejected'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* §1 Registration Status */}
      <RegistrationStatusCard
        app={app}
        onboardingStatus={onboardingStatus}
        onStatusChange={setOnboardingStatus}
        onAssignAgent={setAssignedAgent}
        assignedAgent={assignedAgent}
      />

      {/* §2 Registration Info */}
      <div>
        <SectionDivider title="Registration Information" icon={<User size={13} />} />
        <div style={{ marginTop: 10 }}>
          <RegistrationInfoSection app={app} />
        </div>
      </div>

      {/* §3 Business Assessment */}
      <div>
        <SectionDivider title="Business Assessment" icon={<Layers size={13} />} />
        <div style={{ marginTop: 10 }}>
          <BusinessAssessmentSection form={assessment} onChange={setAssessment} readOnly={assessmentReadOnly} />
        </div>
      </div>

      {/* §4 KYC Template */}
      <div>
        <SectionDivider title="KYC Management" icon={<FileText size={13} />} />
        <div style={{ marginTop: 10 }}>
          <BusinessSelectorPanel
            businesses={businesses}
            selectedId={selectedBizId}
            onSelect={handleSelectBusiness}
          />
          <KycTemplateSection
            key={selectedBizId}
            selectedTemplateId={selectedKyc}
            onSelect={setSelectedKyc}
            onSend={handleKycSend}
            onPreview={() => showToast('info', 'KYC Preview', 'KYC requirements document opened.')}
            onboardingStatus={onboardingStatus}
            businessType={businessType}
            onBusinessTypeChange={setBusinessType}
            initialScope={selectedBiz.verificationStatus === 'verified' ? 'additional_business' : 'new_merchant'}
          />
        </div>
      </div>

      {/* §5 Documents */}
      <div>
        <SectionDivider title={`Submitted Documents — ${selectedBiz.name}`} icon={<Paperclip size={13} />} />
        <div style={{ marginTop: 10 }}>
          <MerchantDocumentsSection
            documents={selectedBiz.documents}
            onApprove={handleApproveDoc}
            onReject={handleRejectDoc}
            rejectComments={rejectComments}
            onCommentChange={(i, v) => setRejectComments(p => ({ ...p, [i]: v }))}
          />
        </div>
      </div>

      {/* §6 Activity Timeline */}
      <div>
        <SectionDivider title="Activity Timeline" icon={<Clock size={13} />} />
        <div style={{ marginTop: 10 }}>
          <ActivityTimelineSection status={onboardingStatus} />
        </div>
      </div>

      {/* §7 Internal Notes */}
      <div>
        <SectionDivider title="Internal Notes" icon={<AlertCircle size={13} />} />
        <div style={{ marginTop: 10 }}>
          <InternalNotesSection notes={notes} draft={noteDraft} onDraftChange={setNoteDraft} onAdd={handleAddNote} />
        </div>
      </div>

      {/* Spacer for footer */}
      <div style={{ height: 4 }} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VerificationPage({ tab, showToast }: Props) {
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [drawerApp, setDrawerApp]     = useState<VerifApplication | null>(null)
  const [approveApp, setApproveApp]   = useState<VerifApplication | null>(null)
  const [rejectApp, setRejectApp]     = useState<VerifApplication | null>(null)
  const [resubApp, setResubApp]       = useState<VerifApplication | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [resubComment, setResubComment] = useState('')
  const [loading, setLoading]         = useState(false)
  const perPage = 10

  const allowedStatuses = tabFilters[tab] ?? ['pending']
  const filtered = allApplications.filter((a) => {
    const matchStatus = allowedStatuses.includes(a.status)
    const matchSearch = !search || a.merchantName.toLowerCase().includes(search.toLowerCase()) ||
      a.merchantId.includes(search) || a.phone.includes(search) || a.businessRegNo.includes(search)
    return matchStatus && matchSearch
  })
  const total      = filtered.length
  const start      = (page - 1) * perPage
  const rows       = filtered.slice(start, start + perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const ctx        = tabConfig[tab] ?? tabConfig['verification']

  const stats = [
    { label: 'Pending Review', value: allApplications.filter(a => a.status === 'pending').length,      color: '#D97706', bg: '#FFFBEB', activeBorder: '#FDE68A' },
    { label: 'Approved',       value: allApplications.filter(a => a.status === 'approved').length,     color: '#059669', bg: '#ECFDF3', activeBorder: '#A7F3D0' },
    { label: 'Rejected',       value: allApplications.filter(a => a.status === 'rejected').length,     color: '#DC2626', bg: '#FFF1F3', activeBorder: '#FECDD3' },
    { label: 'Resubmission',   value: allApplications.filter(a => a.status === 'resubmission').length, color: '#2563EB', bg: '#EFF6FF', activeBorder: '#BFDBFE' },
  ]

  const handleApprove = () => {
    setLoading(true)
    setTimeout(() => { setLoading(false); setApproveApp(null); showToast('success', 'Merchant Approved', `${approveApp?.merchantName} has been approved.`) }, 1200)
  }
  const handleReject = () => {
    if (!rejectReason.trim()) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setRejectApp(null); setRejectReason(''); showToast('info', 'Application Rejected', `${rejectApp?.merchantName} rejected.`) }, 1000)
  }
  const handleResubmit = () => {
    if (!resubComment.trim()) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setResubApp(null); setResubComment(''); showToast('info', 'Resubmission Requested', `${resubApp?.merchantName} has been notified.`) }, 1000)
  }

  // Derive onboarding status for table display
  function rowOnboarding(app: VerifApplication, i: number): OnboardingStatus {
    return deriveOnboarding(app, i)
  }

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Merchant Verification &amp; Onboarding</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{ctx.title}</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{ctx.subtitle}</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((s) => {
          const isActive = s.label === ctx.activeCard
          return (
            <div key={s.label} className="rounded-lg p-3 transition-all"
              style={{ background: isActive ? s.bg : '#fff', border: `1px solid ${isActive ? s.activeBorder : '#E3E8F0'}`, boxShadow: isActive ? `0 0 0 1px ${s.activeBorder}` : 'none' }}>
              <div className="flex items-center justify-between mb-1">
                <div style={{ fontSize: 11, color: isActive ? s.color : '#94A3B8', fontWeight: isActive ? 600 : 500 }}>{s.label}</div>
                {isActive && <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: s.color }} />}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ width: 32, height: 3, background: '#E3E8F0', borderRadius: 2, marginTop: 6 }}>
                <div style={{ width: `${Math.min(100, s.value * 4)}%`, height: '100%', background: s.color, borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search by merchant name, ID, phone, or registration number…" className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Categories</option><option>Hotel</option><option>Restaurant</option></select>
        <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
        <select className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}><option>All Countries</option><option>Myanmar</option><option>Thailand</option></select>
        <span style={{ fontSize: 12, color: '#94A3B8' }}><Filter size={12} className="inline mr-1" />{total} results</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Lead ID', 'Merchant Name', 'Business Name', 'Reg. Number', 'Submitted', 'Onboarding Status', 'Assigned Ops', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12" style={{ color: '#94A3B8', fontSize: 13 }}>No {ctx.title.toLowerCase()} found</td></tr>
            )}
            {rows.map((app, i) => {
              const os = rowOnboarding(app, start + i)
              const osCfg = ONBOARDING_STATUS_CFG[os]
              return (
                <tr key={app.applicationId} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-3" style={{ height: 50 }}>
                    <span style={{ fontSize: 12, color: '#1664FF', fontFamily: 'monospace', fontWeight: 600 }}>{app.applicationId}</span>
                  </td>
                  <td className="px-3">
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332' }}>{app.merchantName}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{app.city}</div>
                  </td>
                  <td className="px-3"><span style={{ fontSize: 12, color: '#475569' }} className="max-w-[140px] truncate block">{app.businessName}</span></td>
                  <td className="px-3"><span style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{app.businessRegNo.slice(0, 12)}…</span></td>
                  <td className="px-3"><span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{app.submittedDate}</span></td>
                  <td className="px-3">
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: osCfg.bg, color: osCfg.color, border: `1px solid ${osCfg.border}`, whiteSpace: 'nowrap' }}>
                      {osCfg.label}
                    </span>
                  </td>
                  <td className="px-3"><span style={{ fontSize: 12, color: app.reviewer === 'Unassigned' ? '#94A3B8' : '#475569' }}>{app.reviewer}</span></td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn onClick={() => setDrawerApp(app)} color="#1664FF"><Eye size={12} /></ActionBtn>
                      {(app.status === 'pending' || app.status === 'resubmission') && (
                        <>
                          <ActionBtn onClick={() => setApproveApp(app)} color="#059669"><CheckCircle size={12} /></ActionBtn>
                          <ActionBtn onClick={() => setRejectApp(app)} color="#DC2626"><XCircle size={12} /></ActionBtn>
                          <ActionBtn onClick={() => setResubApp(app)} color="#D97706"><RefreshCw size={12} /></ActionBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
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

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        open={!!drawerApp}
        onClose={() => setDrawerApp(null)}
        title="Merchant Verification Details"
        subtitle={drawerApp ? `${drawerApp.applicationId} · ${drawerApp.merchantName}` : ''}
        width={760}
        footer={
          drawerApp ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <OnboardingActionBar
                status={deriveOnboarding(drawerApp, allApplications.findIndex(a => a.applicationId === drawerApp.applicationId))}
                onAction={(action) => {
                  if (action === 'approve') { setDrawerApp(null); setApproveApp(drawerApp) }
                  else if (action === 'reject') { setDrawerApp(null); setRejectApp(drawerApp) }
                  else if (action === 'resubmit') { setDrawerApp(null); setResubApp(drawerApp) }
                  else showToast('info', action, `Action: ${action}`)
                }}
              />
            </div>
          ) : undefined
        }
      >
        {drawerApp && (
          <VerificationDetailContent
            app={drawerApp}
            showToast={showToast}
          />
        )}
      </Drawer>

      {/* Approve dialog */}
      <Dialog open={!!approveApp} onClose={() => setApproveApp(null)} variant="success" title="Approve Merchant Application"
        message={`You are about to approve "${approveApp?.merchantName}". This will grant them full access to list their businesses and receive bookings on the mTrip platform.`}
        confirmLabel="Approve Merchant" onConfirm={handleApprove} loading={loading} />

      {/* Reject dialog */}
      <Dialog open={!!rejectApp} onClose={() => { setRejectApp(null); setRejectReason('') }} variant="danger" title="Reject Application"
        message={`Please provide a rejection reason for "${rejectApp?.merchantName}".`}
        confirmLabel="Reject Application" onConfirm={handleReject} loading={loading}>
        <div className="mt-2">
          <label style={{ fontSize: 12, color: '#64748B', display: 'block', marginBottom: 6 }}>Rejection Reason <span style={{ color: '#DC2626' }}>*</span></label>
          <select className="w-full rounded-md px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E3E8F0', marginBottom: 8 }}
            onChange={(e) => setRejectReason(e.target.value)} value={rejectReason}>
            <option value="">Select reason…</option>
            <option>Expired business registration</option>
            <option>Invalid or missing operating license</option>
            <option>Incomplete documentation</option>
            <option>Identity verification failed</option>
            <option>Business does not meet platform requirements</option>
            <option>Premises / fleet documents invalid</option>
            <option>Insurance or safety certification missing</option>
            <option>Suspected fraudulent application</option>
            <option>Duplicate merchant account</option>
          </select>
          <textarea placeholder="Additional notes (optional)…" className="w-full rounded-md px-3 py-2 outline-none resize-none" style={{ fontSize: 13, border: '1px solid #E3E8F0', height: 72 }} />
        </div>
      </Dialog>

      {/* Resubmit dialog */}
      <Dialog open={!!resubApp} onClose={() => { setResubApp(null); setResubComment('') }} variant="warning" title="Request Resubmission"
        message={`Notify "${resubApp?.merchantName}" to resubmit their application with updated information.`}
        confirmLabel="Send Notification" onConfirm={handleResubmit} loading={loading}>
        <div className="mt-2">
          <label style={{ fontSize: 12, color: '#64748B', display: 'block', marginBottom: 6 }}>Comments for Merchant <span style={{ color: '#DC2626' }}>*</span></label>
          <textarea value={resubComment} onChange={(e) => setResubComment(e.target.value)} placeholder="Explain what needs to be corrected or resubmitted…" className="w-full rounded-md px-3 py-2 outline-none resize-none" style={{ fontSize: 13, border: '1px solid #E3E8F0', height: 90 }} />
        </div>
      </Dialog>
    </div>
  )
}

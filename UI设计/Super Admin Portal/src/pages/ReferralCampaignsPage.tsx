import { useState } from 'react'
import type React from 'react'
import {
  Eye, Edit2, Copy, Play, Pause, StopCircle, Trash2,
  ChevronLeft, ChevronRight, Check, Shield, Smartphone,
  Wifi, Users, BookOpen, Plus
} from 'lucide-react'

// ─── Style constants ───────────────────────────────────────────────────────────
const inp: React.CSSProperties = { fontSize: 13, height: 36, padding: '0 12px', border: '1px solid #E3E8F0', borderRadius: 8, outline: 'none', background: '#fff', color: '#1A2332', width: '100%', boxSizing: 'border-box' as const }
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
const ta:  React.CSSProperties = { ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' as const, lineHeight: 1.5 }

// ─── Types ─────────────────────────────────────────────────────────────────────
type CampaignType = 'Invite Friends' | 'Referral Rewards' | 'First Booking Bonus' | 'Seasonal Referral Campaign'
type CampaignStatus = 'active' | 'scheduled' | 'draft' | 'paused' | 'ended'
type RuleType = 'Invite Count' | 'Successful Registration' | 'First Booking' | 'Completed Stay' | 'Booking Amount'
type RewardType = 'Travel Credits' | 'Reward Points' | 'Voucher' | 'Coupon'

interface RewardRule {
  id: string
  ruleType: RuleType
  threshold: number
  rewardType: RewardType
  rewardValue: number
  maxClaims: number
  description: string
}

// ─── Global defaults (mirrors AffiliateProgramPage settings) ──────────────────
const GLOBAL_REFERRAL_DEFAULTS = {
  minBookingAmount: 200,
  referralAttributionWindow: 14,
  referralLinkExpiry: 30,
  bookingCompletionRequired: true,
  rewardHoldPeriod: 7,
  maxInvitationsPerUser: 10,
  maxRewardsPerUser: 5,
  maxDeviceRegistrations: 3,
  maxIpRegistrations: 5,
  duplicateDeviceDetection: true,
  selfReferralDetection: true,
  fakeBookingDetection: true,
} as const

type OverrideKey = keyof typeof GLOBAL_REFERRAL_DEFAULTS
type Overrides = Record<OverrideKey, boolean>
const ALL_OVERRIDES_OFF: Overrides = Object.fromEntries(
  Object.keys(GLOBAL_REFERRAL_DEFAULTS).map(k => [k, false])
) as Overrides
const ALL_OVERRIDES_ON: Overrides = Object.fromEntries(
  Object.keys(GLOBAL_REFERRAL_DEFAULTS).map(k => [k, true])
) as Overrides

interface ReferralCampaign {
  id: string; name: string; description: string; type: CampaignType
  startDate: string; endDate: string; status: CampaignStatus
  createdBy: string; priority: number; participants: number
  totalRewardsDistributed: number
  totalRewardPool: number; rewardBudget: number
  estimatedParticipants: number; estimatedReferralBookings: number
  rewardRules: RewardRule[]
  minBookingAmount: number; minStayRequirement: number
  bookingCompletionRequired: boolean; referralLinkExpiry: number
  maxInvitationsPerUser: number; maxRewardsPerUser: number
  eligibleHotelCategories: string[]; eligibleCountries: string[]
  referralAttributionWindow: number; rewardHoldPeriod: number
  maxDeviceRegistrations: number; maxIpRegistrations: number
  duplicateDeviceDetection: boolean; selfReferralDetection: boolean
  multipleAccountDetection: boolean; fakeBookingDetection: boolean
  overrides: Overrides
}

interface WizardForm {
  name: string; description: string; type: CampaignType; bannerUrl: string
  startDate: string; startTime: string; endDate: string; endTime: string
  status: CampaignStatus
  totalRewardPool: number; rewardBudget: number
  estimatedParticipants: number; estimatedReferralBookings: number
  rewardRules: RewardRule[]
  minBookingAmount: number; minStayRequirement: number
  bookingCompletionRequired: boolean; referralLinkExpiry: number
  maxInvitationsPerUser: number; maxRewardsPerUser: number
  eligibleHotelCategories: string[]; eligibleCountries: string[]
  referralAttributionWindow: number; rewardHoldPeriod: number
  maxDeviceRegistrations: number; maxIpRegistrations: number
  duplicateDeviceDetection: boolean; selfReferralDetection: boolean
  multipleAccountDetection: boolean; fakeBookingDetection: boolean
  overrides: Overrides
}

interface Props {
  tab: string
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void
}

interface StepProps {
  form: WizardForm
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>
}

interface WizardProps {
  editCampaign?: ReferralCampaign | null
  onClose: () => void
  onSave: (campaign: ReferralCampaign) => void
  showToast: Props['showToast']
}

// ─── Sample data ───────────────────────────────────────────────────────────────
const INIT_CAMPAIGNS: ReferralCampaign[] = [
  {
    id: '1', name: 'mTrip Summer Friends 2024', description: 'Invite friends to join mTrip and earn travel credits for every successful referral during the summer season.', type: 'Invite Friends',
    startDate: '2024-06-01', endDate: '2024-08-31', status: 'active', createdBy: 'Admin — Li Min', priority: 1, participants: 847, totalRewardsDistributed: 12400000,
    totalRewardPool: 20000000, rewardBudget: 15000000, estimatedParticipants: 1000, estimatedReferralBookings: 600,
    rewardRules: [
      { id: 'r1a', ruleType: 'Invite Count', threshold: 3, rewardType: 'Travel Credits', rewardValue: 5000, maxClaims: 5, description: 'Earn 5,000 MMK travel credits for every 3 invites accepted' },
      { id: 'r1b', ruleType: 'First Booking', threshold: 1, rewardType: 'Reward Points', rewardValue: 1000, maxClaims: 1, description: 'Bonus 1,000 points when referred friend completes first booking' },
    ],
    minBookingAmount: 50000, minStayRequirement: 1, bookingCompletionRequired: true, referralLinkExpiry: 30,
    maxInvitationsPerUser: 20, maxRewardsPerUser: 5, eligibleHotelCategories: ['Budget', 'Standard', 'Deluxe', '5-Star', 'Boutique', 'Resort'], eligibleCountries: ['Myanmar', 'Thailand'],
    referralAttributionWindow: 14, rewardHoldPeriod: 7, maxDeviceRegistrations: 3, maxIpRegistrations: 5,
    duplicateDeviceDetection: true, selfReferralDetection: true, multipleAccountDetection: true, fakeBookingDetection: true,
    overrides: ALL_OVERRIDES_ON,
  },
  {
    id: '2', name: 'New Year Booking Bonus 2025', description: 'Special first booking bonus for all new users referred during the New Year promotional period.', type: 'First Booking Bonus',
    startDate: '2025-01-01', endDate: '2025-01-31', status: 'scheduled', createdBy: 'Admin — Kyi Thu', priority: 2, participants: 0, totalRewardsDistributed: 0,
    totalRewardPool: 5000000, rewardBudget: 5000000, estimatedParticipants: 500, estimatedReferralBookings: 300,
    rewardRules: [
      { id: 'r2a', ruleType: 'First Booking', threshold: 1, rewardType: 'Voucher', rewardValue: 10000, maxClaims: 1, description: 'New Year voucher on first booking completion' },
      { id: 'r2b', ruleType: 'Successful Registration', threshold: 1, rewardType: 'Reward Points', rewardValue: 200, maxClaims: 1, description: 'Welcome points on successful registration' },
    ],
    minBookingAmount: 30000, minStayRequirement: 1, bookingCompletionRequired: true, referralLinkExpiry: 14,
    maxInvitationsPerUser: 10, maxRewardsPerUser: 2, eligibleHotelCategories: ['Standard', 'Deluxe', '5-Star', 'Resort'], eligibleCountries: ['Myanmar'],
    referralAttributionWindow: 7, rewardHoldPeriod: 7, maxDeviceRegistrations: 2, maxIpRegistrations: 3,
    duplicateDeviceDetection: true, selfReferralDetection: true, multipleAccountDetection: true, fakeBookingDetection: true,
    overrides: ALL_OVERRIDES_ON,
  },
  {
    id: '3', name: 'Platinum Member Referral', description: 'Exclusive referral program for Platinum tier members with premium reward multipliers.', type: 'Referral Rewards',
    startDate: '2024-07-01', endDate: '2024-12-31', status: 'active', createdBy: 'Admin — Li Min', priority: 3, participants: 234, totalRewardsDistributed: 3200000,
    totalRewardPool: 8000000, rewardBudget: 6000000, estimatedParticipants: 300, estimatedReferralBookings: 200,
    rewardRules: [
      { id: 'r3a', ruleType: 'Completed Stay', threshold: 1, rewardType: 'Reward Points', rewardValue: 2000, maxClaims: 10, description: 'Earn 2x points for each referred friend completing a stay' },
      { id: 'r3b', ruleType: 'Booking Amount', threshold: 200000, rewardType: 'Travel Credits', rewardValue: 15000, maxClaims: 3, description: 'Travel credit bonus for high-value booking referrals' },
    ],
    minBookingAmount: 100000, minStayRequirement: 2, bookingCompletionRequired: true, referralLinkExpiry: 60,
    maxInvitationsPerUser: 30, maxRewardsPerUser: 10, eligibleHotelCategories: ['Deluxe', '5-Star', 'Boutique', 'Resort'], eligibleCountries: ['Myanmar', 'Thailand', 'Singapore'],
    referralAttributionWindow: 21, rewardHoldPeriod: 14, maxDeviceRegistrations: 3, maxIpRegistrations: 5,
    duplicateDeviceDetection: true, selfReferralDetection: true, multipleAccountDetection: true, fakeBookingDetection: true,
    overrides: ALL_OVERRIDES_ON,
  },
  {
    id: '4', name: 'Inle Lake Discovery Campaign', description: 'Promote Inle Lake properties through seasonal referral incentives tied to the harvest festival period.', type: 'Seasonal Referral Campaign',
    startDate: '2024-10-01', endDate: '2024-11-30', status: 'active', createdBy: 'Admin — Kyi Thu', priority: 4, participants: 156, totalRewardsDistributed: 2100000,
    totalRewardPool: 4000000, rewardBudget: 3000000, estimatedParticipants: 200, estimatedReferralBookings: 120,
    rewardRules: [
      { id: 'r4a', ruleType: 'First Booking', threshold: 1, rewardType: 'Coupon', rewardValue: 8000, maxClaims: 1, description: 'Discovery coupon for Inle Lake first-time bookers' },
      { id: 'r4b', ruleType: 'Invite Count', threshold: 5, rewardType: 'Reward Points', rewardValue: 1500, maxClaims: 3, description: 'Bonus points for spreading the Inle Lake experience' },
    ],
    minBookingAmount: 40000, minStayRequirement: 2, bookingCompletionRequired: true, referralLinkExpiry: 30,
    maxInvitationsPerUser: 15, maxRewardsPerUser: 3, eligibleHotelCategories: ['Boutique', 'Resort', 'Deluxe'], eligibleCountries: ['Myanmar'],
    referralAttributionWindow: 14, rewardHoldPeriod: 7, maxDeviceRegistrations: 3, maxIpRegistrations: 4,
    duplicateDeviceDetection: true, selfReferralDetection: true, multipleAccountDetection: false, fakeBookingDetection: true,
    overrides: ALL_OVERRIDES_ON,
  },
  {
    id: '5', name: 'Corporate Traveler Referral', description: 'Target corporate users to refer colleagues for business travel bookings.', type: 'Invite Friends',
    startDate: '2024-04-01', endDate: '2024-09-30', status: 'paused', createdBy: 'Admin — Li Min', priority: 5, participants: 423, totalRewardsDistributed: 6500000,
    totalRewardPool: 12000000, rewardBudget: 10000000, estimatedParticipants: 600, estimatedReferralBookings: 400,
    rewardRules: [
      { id: 'r5a', ruleType: 'Successful Registration', threshold: 1, rewardType: 'Travel Credits', rewardValue: 3000, maxClaims: 20, description: 'Credits for each corporate colleague registered' },
      { id: 'r5b', ruleType: 'Completed Stay', threshold: 1, rewardType: 'Reward Points', rewardValue: 1500, maxClaims: 20, description: 'Points when referred colleague completes a business stay' },
    ],
    minBookingAmount: 80000, minStayRequirement: 1, bookingCompletionRequired: false, referralLinkExpiry: 45,
    maxInvitationsPerUser: 50, maxRewardsPerUser: 20, eligibleHotelCategories: ['Standard', 'Deluxe', '5-Star'], eligibleCountries: ['Myanmar', 'Thailand', 'Singapore', 'Malaysia'],
    referralAttributionWindow: 30, rewardHoldPeriod: 7, maxDeviceRegistrations: 5, maxIpRegistrations: 10,
    duplicateDeviceDetection: false, selfReferralDetection: true, multipleAccountDetection: true, fakeBookingDetection: true,
    overrides: ALL_OVERRIDES_ON,
  },
  {
    id: '6', name: 'Q4 Acquisition Drive', description: 'Year-end acquisition push to grow user base ahead of peak travel season.', type: 'Referral Rewards',
    startDate: '2024-10-15', endDate: '2024-12-31', status: 'draft', createdBy: 'Admin — Kyi Thu', priority: 6, participants: 0, totalRewardsDistributed: 0,
    totalRewardPool: 10000000, rewardBudget: 8000000, estimatedParticipants: 800, estimatedReferralBookings: 500,
    rewardRules: [
      { id: 'r6a', ruleType: 'First Booking', threshold: 1, rewardType: 'Reward Points', rewardValue: 800, maxClaims: 1, description: 'Points on first booking completion' },
      { id: 'r6b', ruleType: 'Invite Count', threshold: 10, rewardType: 'Travel Credits', rewardValue: 12000, maxClaims: 5, description: 'High-volume referrer bonus credits' },
    ],
    minBookingAmount: 25000, minStayRequirement: 1, bookingCompletionRequired: true, referralLinkExpiry: 21,
    maxInvitationsPerUser: 25, maxRewardsPerUser: 5, eligibleHotelCategories: ['Budget', 'Standard', 'Deluxe', '5-Star', 'Boutique', 'Resort'], eligibleCountries: ['Myanmar'],
    referralAttributionWindow: 10, rewardHoldPeriod: 7, maxDeviceRegistrations: 3, maxIpRegistrations: 5,
    duplicateDeviceDetection: true, selfReferralDetection: true, multipleAccountDetection: true, fakeBookingDetection: false,
    overrides: ALL_OVERRIDES_ON,
  },
  {
    id: '7', name: 'Mandalay Festival Special', description: 'Referral campaign tied to Mandalay cultural festivals driving tourism to the historic city.', type: 'Seasonal Referral Campaign',
    startDate: '2024-01-15', endDate: '2024-03-31', status: 'ended', createdBy: 'Admin — Li Min', priority: 7, participants: 1201, totalRewardsDistributed: 18700000,
    totalRewardPool: 25000000, rewardBudget: 20000000, estimatedParticipants: 1000, estimatedReferralBookings: 700,
    rewardRules: [
      { id: 'r7a', ruleType: 'Invite Count', threshold: 2, rewardType: 'Coupon', rewardValue: 6000, maxClaims: 8, description: 'Festival coupon for every 2 successful invites' },
      { id: 'r7b', ruleType: 'Completed Stay', threshold: 1, rewardType: 'Travel Credits', rewardValue: 10000, maxClaims: 5, description: 'Travel credits for stays at Mandalay properties' },
      { id: 'r7c', ruleType: 'Booking Amount', threshold: 150000, rewardType: 'Reward Points', rewardValue: 3000, maxClaims: 3, description: 'Premium stay referral bonus points' },
    ],
    minBookingAmount: 35000, minStayRequirement: 2, bookingCompletionRequired: true, referralLinkExpiry: 30,
    maxInvitationsPerUser: 20, maxRewardsPerUser: 8, eligibleHotelCategories: ['Standard', 'Deluxe', '5-Star', 'Boutique'], eligibleCountries: ['Myanmar', 'Thailand', 'Vietnam'],
    referralAttributionWindow: 14, rewardHoldPeriod: 7, maxDeviceRegistrations: 3, maxIpRegistrations: 5,
    duplicateDeviceDetection: true, selfReferralDetection: true, multipleAccountDetection: true, fakeBookingDetection: true,
    overrides: ALL_OVERRIDES_ON,
  },
  {
    id: '8', name: 'Silver Tier Upgrade Campaign', description: 'Encourage Silver tier members to refer friends and earn bonus points towards Gold tier upgrade.', type: 'Referral Rewards',
    startDate: '2025-02-01', endDate: '2025-04-30', status: 'scheduled', createdBy: 'Admin — Kyi Thu', priority: 8, participants: 0, totalRewardsDistributed: 0,
    totalRewardPool: 6000000, rewardBudget: 4500000, estimatedParticipants: 350, estimatedReferralBookings: 220,
    rewardRules: [
      { id: 'r8a', ruleType: 'Successful Registration', threshold: 1, rewardType: 'Reward Points', rewardValue: 500, maxClaims: 15, description: 'Points for each registered referral' },
      { id: 'r8b', ruleType: 'First Booking', threshold: 1, rewardType: 'Reward Points', rewardValue: 1200, maxClaims: 10, description: 'Upgrade accelerator points on referral first booking' },
    ],
    minBookingAmount: 45000, minStayRequirement: 1, bookingCompletionRequired: true, referralLinkExpiry: 45,
    maxInvitationsPerUser: 15, maxRewardsPerUser: 10, eligibleHotelCategories: ['Standard', 'Deluxe', '5-Star', 'Boutique', 'Resort'], eligibleCountries: ['Myanmar'],
    referralAttributionWindow: 21, rewardHoldPeriod: 7, maxDeviceRegistrations: 3, maxIpRegistrations: 5,
    duplicateDeviceDetection: true, selfReferralDetection: true, multipleAccountDetection: true, fakeBookingDetection: true,
    overrides: ALL_OVERRIDES_ON,
  },
]

const DEFAULT_FORM: WizardForm = {
  name: '', description: '', type: 'Invite Friends', bannerUrl: '',
  startDate: '', startTime: '09:00', endDate: '', endTime: '23:59',
  status: 'draft',
  totalRewardPool: 0, rewardBudget: 0,
  estimatedParticipants: 0, estimatedReferralBookings: 0,
  rewardRules: [
    { id: 'default1', ruleType: 'First Booking', threshold: 1, rewardType: 'Reward Points', rewardValue: 500, maxClaims: 1, description: 'Reward points on first booking completion' },
    { id: 'default2', ruleType: 'Successful Registration', threshold: 1, rewardType: 'Reward Points', rewardValue: 200, maxClaims: 1, description: 'Welcome points on successful registration' },
  ],
  minBookingAmount: GLOBAL_REFERRAL_DEFAULTS.minBookingAmount,
  minStayRequirement: 1,
  bookingCompletionRequired: GLOBAL_REFERRAL_DEFAULTS.bookingCompletionRequired,
  referralLinkExpiry: GLOBAL_REFERRAL_DEFAULTS.referralLinkExpiry,
  maxInvitationsPerUser: GLOBAL_REFERRAL_DEFAULTS.maxInvitationsPerUser,
  maxRewardsPerUser: GLOBAL_REFERRAL_DEFAULTS.maxRewardsPerUser,
  eligibleHotelCategories: ['Budget', 'Standard', 'Deluxe', '5-Star', 'Boutique', 'Resort'],
  eligibleCountries: ['Myanmar'],
  referralAttributionWindow: GLOBAL_REFERRAL_DEFAULTS.referralAttributionWindow,
  rewardHoldPeriod: GLOBAL_REFERRAL_DEFAULTS.rewardHoldPeriod,
  maxDeviceRegistrations: GLOBAL_REFERRAL_DEFAULTS.maxDeviceRegistrations,
  maxIpRegistrations: GLOBAL_REFERRAL_DEFAULTS.maxIpRegistrations,
  duplicateDeviceDetection: GLOBAL_REFERRAL_DEFAULTS.duplicateDeviceDetection,
  selfReferralDetection: GLOBAL_REFERRAL_DEFAULTS.selfReferralDetection,
  multipleAccountDetection: true, fakeBookingDetection: GLOBAL_REFERRAL_DEFAULTS.fakeBookingDetection,
  overrides: ALL_OVERRIDES_OFF,
}

// ─── Helper components ─────────────────────────────────────────────────────────

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const S: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
    active:    { label: 'Active',    color: '#027A48', bg: '#ECFDF3' },
    scheduled: { label: 'Scheduled', color: '#0369A1', bg: '#EFF8FF' },
    draft:     { label: 'Draft',     color: '#64748B', bg: '#F1F5F9' },
    paused:    { label: 'Paused',    color: '#B45309', bg: '#FFFBEB' },
    ended:     { label: 'Ended',     color: '#64748B', bg: '#F8FAFC' },
  }
  const s = S[status]
  return <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 20 }}>{s.label}</span>
}

function CampaignTypeBadge({ type }: { type: CampaignType }) {
  const T: Record<CampaignType, { color: string; bg: string }> = {
    'Invite Friends':            { color: '#1664FF', bg: '#EEF4FF' },
    'Referral Rewards':          { color: '#7C3AED', bg: '#F5F3FF' },
    'First Booking Bonus':       { color: '#059669', bg: '#ECFDF5' },
    'Seasonal Referral Campaign':{ color: '#D97706', bg: '#FFFBEB' },
  }
  const t = T[type]
  return <span style={{ fontSize: 11, fontWeight: 600, color: t.color, background: t.bg, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{type}</span>
}

function FormRow({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#94A3B8' }}>{hint}</div>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 8, borderBottom: '1px solid #E3E8F0', marginBottom: 12 }}>
      {children}
    </div>
  )
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, background: value ? '#1664FF' : '#D1D5DB', position: 'relative', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}>
      <span style={{ position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', left: value ? 21 : 3, boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 28, height: 28, border: '1px solid #E3E8F0', borderRadius: 6, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
      {children}
    </button>
  )
}

function PagBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: 32, height: 32, border: '1px solid #E3E8F0', borderRadius: 6, background: disabled ? '#F8FAFC' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: disabled ? '#CBD5E1' : '#475569' }}>
      {children}
    </button>
  )
}

// ─── Wizard Steps ──────────────────────────────────────────────────────────────

function WizardStep1({ form, setForm }: StepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionLabel>Basic Information</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <FormRow label="Campaign Name" required>
            <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer Friends Referral 2025" />
          </FormRow>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <FormRow label="Campaign Description">
            <textarea style={{ ...ta, height: 80 }} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the campaign goals and target audience..." />
          </FormRow>
        </div>
        <FormRow label="Campaign Type" required>
          <select style={sel} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CampaignType }))}>
            <option>Invite Friends</option>
            <option>Referral Rewards</option>
            <option>First Booking Bonus</option>
            <option>Seasonal Referral Campaign</option>
          </select>
        </FormRow>
        <FormRow label="Campaign Status" required>
          <select style={sel} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CampaignStatus }))}>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
          </select>
        </FormRow>
        <div>
          <FormRow label="Start Date" required>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" style={{ ...inp, flex: 2 }} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              <input type="time" style={{ ...inp, flex: 1 }} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
          </FormRow>
        </div>
        <div>
          <FormRow label="End Date" required>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" style={{ ...inp, flex: 2 }} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              <input type="time" style={{ ...inp, flex: 1 }} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
          </FormRow>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <FormRow label="Campaign Banner">
            <div style={{ border: '2px dashed #CBD5E1', borderRadius: 8, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: '#F8FAFC' }}>
              <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 4 }}>Upload Banner (Optional)</div>
              <div style={{ fontSize: 11, color: '#CBD5E1' }}>Drag & drop or click to upload · Recommended size: 1200×400px · PNG, JPG</div>
              {form.bannerUrl && <div style={{ fontSize: 11, color: '#059669', marginTop: 8 }}>✓ Banner uploaded</div>}
            </div>
          </FormRow>
        </div>
      </div>
    </div>
  )
}

function WizardStep2({ form, setForm }: StepProps) {
  const avgReward = form.rewardBudget / Math.max(form.estimatedParticipants, 1)
  const estCost = form.estimatedReferralBookings * avgReward
  const remaining = form.rewardBudget - estCost
  const overBudget = estCost > form.rewardBudget && form.rewardBudget > 0

  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(2)} M` : n >= 1000 ? `${(n / 1000).toFixed(0)} K` : n.toFixed(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionLabel>Budget & Reward Pool</SectionLabel>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormRow label="Total Reward Pool (MMK)" required hint="Total rewards available for this campaign">
            <input type="number" style={inp} value={form.totalRewardPool || ''} onChange={e => setForm(f => ({ ...f, totalRewardPool: Number(e.target.value) }))} placeholder="0" min={0} />
          </FormRow>
          <FormRow label="Reward Budget (MMK)" required hint="Maximum reward spending cap">
            <input type="number" style={inp} value={form.rewardBudget || ''} onChange={e => setForm(f => ({ ...f, rewardBudget: Number(e.target.value) }))} placeholder="0" min={0} />
          </FormRow>
          <FormRow label="Estimated Participants" hint="Expected number of users who will participate">
            <input type="number" style={inp} value={form.estimatedParticipants || ''} onChange={e => setForm(f => ({ ...f, estimatedParticipants: Number(e.target.value) }))} placeholder="0" min={0} />
          </FormRow>
          <FormRow label="Estimated Referral Bookings" hint="Expected number of bookings resulting from referrals">
            <input type="number" style={inp} value={form.estimatedReferralBookings || ''} onChange={e => setForm(f => ({ ...f, estimatedReferralBookings: Number(e.target.value) }))} placeholder="0" min={0} />
          </FormRow>
        </div>
        <div style={{ width: 280, background: '#F8FAFC', border: '1px solid #E3E8F0', borderRadius: 12, padding: 20, position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A2332', marginBottom: 16 }}>Estimated Cost Breakdown</div>
          {overBudget && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 11, color: '#B45309', lineHeight: 1.5 }}>
              ⚠ Estimated campaign cost exceeds reward budget. Consider increasing the budget or adjusting assumptions.
            </div>
          )}
          {[
            { label: 'Reward Pool', value: `${fmt(form.totalRewardPool)} MMK`, color: '#1A2332' },
            { label: 'Reward Budget', value: `${fmt(form.rewardBudget)} MMK`, color: '#1A2332' },
            { label: 'Est. Avg Reward / Participant', value: `${fmt(avgReward)} MMK`, color: '#1664FF' },
            { label: 'Est. Total Campaign Cost', value: `${fmt(estCost)} MMK`, color: overBudget ? '#DC2626' : '#1A2332' },
            { label: 'Remaining Budget', value: `${fmt(remaining)} MMK`, color: remaining < 0 ? '#DC2626' : '#059669' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #E3E8F0', fontSize: 12 }}>
              <span style={{ color: '#64748B' }}>{row.label}</span>
              <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WizardStep3({ form, setForm }: StepProps) {
  const addRule = () => {
    const newRule: RewardRule = {
      id: Date.now().toString(),
      ruleType: 'First Booking',
      threshold: 1,
      rewardType: 'Reward Points',
      rewardValue: 500,
      maxClaims: 1,
      description: '',
    }
    setForm(f => ({ ...f, rewardRules: [...f.rewardRules, newRule] }))
  }

  const updateRule = (id: string, patch: Partial<RewardRule>) => {
    setForm(f => ({ ...f, rewardRules: f.rewardRules.map(r => r.id === id ? { ...r, ...patch } : r) }))
  }

  const deleteRule = (id: string) => {
    setForm(f => ({ ...f, rewardRules: f.rewardRules.filter(r => r.id !== id) }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionLabel>Reward Rules</SectionLabel>
      {form.rewardRules.map((rule, idx) => (
        <div key={rule.id} style={{ border: '1px solid #E3E8F0', borderRadius: 10, padding: 16, background: '#fff', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1664FF' }}>Rule {idx + 1}</span>
            <button onClick={() => deleteRule(rule.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormRow label="Rule Type">
              <select style={sel} value={rule.ruleType} onChange={e => updateRule(rule.id, { ruleType: e.target.value as RuleType })}>
                <option>Invite Count</option>
                <option>Successful Registration</option>
                <option>First Booking</option>
                <option>Completed Stay</option>
                <option>Booking Amount</option>
              </select>
            </FormRow>
            <FormRow label={rule.ruleType === 'Booking Amount' ? 'Min. Booking Amount (MMK)' : rule.ruleType === 'Invite Count' ? 'Invite Count' : 'Threshold'}>
              <input type="number" style={inp} value={rule.threshold} onChange={e => updateRule(rule.id, { threshold: Number(e.target.value) })} min={1} />
            </FormRow>
            <FormRow label="Reward Type">
              <select style={sel} value={rule.rewardType} onChange={e => updateRule(rule.id, { rewardType: e.target.value as RewardType })}>
                <option>Travel Credits</option>
                <option>Reward Points</option>
                <option>Voucher</option>
                <option>Coupon</option>
              </select>
            </FormRow>
            <FormRow label="Reward Value">
              <input type="number" style={inp} value={rule.rewardValue} onChange={e => updateRule(rule.id, { rewardValue: Number(e.target.value) })} min={0} />
            </FormRow>
            <FormRow label="Max Claims Per User">
              <input type="number" style={inp} value={rule.maxClaims} onChange={e => updateRule(rule.id, { maxClaims: Number(e.target.value) })} min={1} />
            </FormRow>
          </div>
          <FormRow label="Description">
            <input style={inp} value={rule.description} onChange={e => updateRule(rule.id, { description: e.target.value })} placeholder="Describe when and how this reward is earned..." />
          </FormRow>
        </div>
      ))}
      <button onClick={addRule} style={{ border: '2px dashed #1664FF', borderRadius: 10, padding: '12px 20px', background: 'none', cursor: 'pointer', color: '#1664FF', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Plus size={16} /> Add Reward Rule
      </button>
    </div>
  )
}

const HOTEL_CATS = ['Budget', 'Standard', 'Deluxe', '5-Star', 'Boutique', 'Resort']
const COUNTRIES = ['Myanmar', 'Thailand', 'Vietnam', 'Singapore', 'Malaysia', 'All Countries']

// ─── Inheritance UI helpers ────────────────────────────────────────────────────

function GlobalDefaultBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, color: '#0369A1', background: '#EFF8FF', border: '1px solid #BAE0FF', whiteSpace: 'nowrap' }}>
      Using Global Default
    </span>
  )
}

function OverrideBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE', whiteSpace: 'nowrap' }}>
      Campaign Override
    </span>
  )
}

function InheritedField({
  label, required, hint, globalDisplay,
  overrideKey, form, setForm, children,
}: {
  label: string; required?: boolean; hint?: string; globalDisplay: string
  overrideKey: OverrideKey
  form: WizardForm; setForm: React.Dispatch<React.SetStateAction<WizardForm>>
  children: React.ReactNode
}) {
  const isOverriding = form.overrides[overrideKey]
  const toggle = () => setForm(f => ({ ...f, overrides: { ...f.overrides, [overrideKey]: !f.overrides[overrideKey] } }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>
          {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isOverriding ? <OverrideBadge /> : <GlobalDefaultBadge />}
          <span style={{ fontSize: 10, color: '#94A3B8' }}>Override</span>
          <ToggleSwitch value={isOverriding} onChange={toggle} />
        </div>
      </div>
      {!isOverriding
        ? <div style={{ ...inp, background: '#F8FAFC', color: '#6B7280', cursor: 'not-allowed', display: 'flex', alignItems: 'center' }}>{globalDisplay}</div>
        : children}
      {hint && <div style={{ fontSize: 11, color: '#94A3B8' }}>{hint}</div>}
    </div>
  )
}

interface InheritedFraudRowProps {
  icon: React.ReactNode; title: string; description: string
  overrideKey: OverrideKey; form: WizardForm; setForm: React.Dispatch<React.SetStateAction<WizardForm>>
  value: boolean; onChange: (v: boolean) => void
  numValue?: number; onNumChange?: (v: number) => void; numLabel?: string
  globalValue: boolean; globalNum?: number
}

function InheritedFraudRow({ icon, title, description, overrideKey, form, setForm, value, onChange, numValue, onNumChange, numLabel, globalValue, globalNum }: InheritedFraudRowProps) {
  const isOverriding = form.overrides[overrideKey]
  const toggleOverride = () => setForm(f => ({ ...f, overrides: { ...f.overrides, [overrideKey]: !f.overrides[overrideKey] } }))
  const effectiveVal = isOverriding ? value : globalValue
  const effectiveNum = isOverriding ? numValue : globalNum
  return (
    <div style={{ border: `1px solid ${isOverriding ? '#DDD6FE' : '#BAE0FF'}`, borderRadius: 10, padding: '12px 14px', background: isOverriding ? '#FAFAFF' : '#F0F8FF', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1664FF' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>{description}</div>
      </div>
      {onNumChange !== undefined && effectiveNum !== undefined && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center' }}>{numLabel}</div>
          <input type="number"
            style={{ ...inp, width: 70, textAlign: 'center', background: isOverriding ? '#fff' : '#F0F8FF', color: isOverriding ? '#1A2332' : '#6B7280', cursor: isOverriding ? 'text' : 'not-allowed' }}
            value={effectiveNum} onChange={e => isOverriding && onNumChange(Number(e.target.value))}
            readOnly={!isOverriding} min={1} />
        </div>
      )}
      <span style={{ fontSize: 11, fontWeight: 600, color: effectiveVal ? '#027A48' : '#64748B', background: effectiveVal ? '#ECFDF3' : '#F1F5F9', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
        {effectiveVal ? 'Enabled' : 'Disabled'}
      </span>
      <ToggleSwitch value={isOverriding ? value : globalValue} onChange={isOverriding ? onChange : () => {}} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, borderLeft: '1px solid #E3E8F0', paddingLeft: 10, marginLeft: 2 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, ...(isOverriding ? { color: '#7C3AED', background: '#F5F3FF' } : { color: '#0369A1', background: '#EFF8FF' }) }}>
          {isOverriding ? 'OVERRIDE' : 'GLOBAL'}
        </span>
        <ToggleSwitch value={isOverriding} onChange={toggleOverride} />
      </div>
    </div>
  )
}

function WizardStep4({ form, setForm }: StepProps) {
  const toggleCat = (cat: string) => {
    setForm(f => ({
      ...f,
      eligibleHotelCategories: f.eligibleHotelCategories.includes(cat)
        ? f.eligibleHotelCategories.filter(c => c !== cat)
        : [...f.eligibleHotelCategories, cat]
    }))
  }
  const toggleCountry = (c: string) => {
    setForm(f => ({
      ...f,
      eligibleCountries: f.eligibleCountries.includes(c)
        ? f.eligibleCountries.filter(x => x !== c)
        : [...f.eligibleCountries, c]
    }))
  }

  const G = GLOBAL_REFERRAL_DEFAULTS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Inheritance info banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#EFF8FF', border: '1px solid #BAE0FF' }}>
        <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.6 }}>
          <strong>Global Default settings</strong> are inherited from the Affiliate Program configuration. Enable the <strong>Override</strong> toggle on any field to set a campaign-specific value.
        </div>
      </div>

      <SectionLabel>Booking Requirements</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <InheritedField label="Minimum Booking Amount (MMK)" hint="Referred booking must meet this minimum amount"
          globalDisplay={`${G.minBookingAmount.toLocaleString()} MMK`}
          overrideKey="minBookingAmount" form={form} setForm={setForm}>
          <input type="number" style={inp} value={form.minBookingAmount} onChange={e => setForm(f => ({ ...f, minBookingAmount: Number(e.target.value) }))} min={0} />
        </InheritedField>

        <FormRow label="Minimum Stay Requirement (nights)" hint="Minimum number of nights for booking to qualify">
          <input type="number" style={inp} value={form.minStayRequirement} onChange={e => setForm(f => ({ ...f, minStayRequirement: Number(e.target.value) }))} min={1} />
        </FormRow>

        <InheritedField label="Referral Attribution Window (days)" hint="Days after referral link click to attribute booking"
          globalDisplay={`${G.referralAttributionWindow} days`}
          overrideKey="referralAttributionWindow" form={form} setForm={setForm}>
          <input type="number" style={inp} value={form.referralAttributionWindow} onChange={e => setForm(f => ({ ...f, referralAttributionWindow: Number(e.target.value) }))} min={1} />
        </InheritedField>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>Booking Completion Required</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {form.overrides.bookingCompletionRequired ? <OverrideBadge /> : <GlobalDefaultBadge />}
              <span style={{ fontSize: 10, color: '#94A3B8' }}>Override</span>
              <ToggleSwitch value={form.overrides.bookingCompletionRequired} onChange={() => setForm(f => ({ ...f, overrides: { ...f.overrides, bookingCompletionRequired: !f.overrides.bookingCompletionRequired } }))} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ToggleSwitch
              value={form.overrides.bookingCompletionRequired ? form.bookingCompletionRequired : G.bookingCompletionRequired}
              onChange={v => form.overrides.bookingCompletionRequired && setForm(f => ({ ...f, bookingCompletionRequired: v }))} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>
                {(form.overrides.bookingCompletionRequired ? form.bookingCompletionRequired : G.bookingCompletionRequired) ? 'Required' : 'Not required'}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Reward only after booking is fully completed</div>
            </div>
          </div>
        </div>
      </div>

      <SectionLabel>User Limits & Eligibility</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <InheritedField label="Referral Link Expiry (days)" hint="How long the referral link remains valid"
          globalDisplay={`${G.referralLinkExpiry} days`}
          overrideKey="referralLinkExpiry" form={form} setForm={setForm}>
          <input type="number" style={inp} value={form.referralLinkExpiry} onChange={e => setForm(f => ({ ...f, referralLinkExpiry: Number(e.target.value) }))} min={1} />
        </InheritedField>

        <InheritedField label="Maximum Invitations Per User" hint="Max number of friends a user can invite"
          globalDisplay={`${G.maxInvitationsPerUser} invitations`}
          overrideKey="maxInvitationsPerUser" form={form} setForm={setForm}>
          <input type="number" style={inp} value={form.maxInvitationsPerUser} onChange={e => setForm(f => ({ ...f, maxInvitationsPerUser: Number(e.target.value) }))} min={1} />
        </InheritedField>

        <InheritedField label="Maximum Rewards Per User" hint="Max total rewards a single user can earn"
          globalDisplay={`${G.maxRewardsPerUser} rewards`}
          overrideKey="maxRewardsPerUser" form={form} setForm={setForm}>
          <input type="number" style={inp} value={form.maxRewardsPerUser} onChange={e => setForm(f => ({ ...f, maxRewardsPerUser: Number(e.target.value) }))} min={1} />
        </InheritedField>

        <InheritedField label="Reward Hold Period (days)" hint="Days after completion before reward is released for payout"
          globalDisplay={`${G.rewardHoldPeriod} days`}
          overrideKey="rewardHoldPeriod" form={form} setForm={setForm}>
          <input type="number" style={inp} value={form.rewardHoldPeriod} onChange={e => setForm(f => ({ ...f, rewardHoldPeriod: Number(e.target.value) }))} min={0} />
        </InheritedField>
      </div>

      <FormRow label="Eligible Hotel Categories">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {HOTEL_CATS.map(cat => (
            <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '4px 12px', border: `1px solid ${form.eligibleHotelCategories.includes(cat) ? '#1664FF' : '#E3E8F0'}`, borderRadius: 20, background: form.eligibleHotelCategories.includes(cat) ? '#EEF4FF' : '#fff', color: form.eligibleHotelCategories.includes(cat) ? '#1664FF' : '#475569' }}>
              <input type="checkbox" checked={form.eligibleHotelCategories.includes(cat)} onChange={() => toggleCat(cat)} style={{ display: 'none' }} />
              {cat}
            </label>
          ))}
        </div>
      </FormRow>

      <FormRow label="Eligible Countries">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {COUNTRIES.map(c => (
            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '4px 12px', border: `1px solid ${form.eligibleCountries.includes(c) ? '#1664FF' : '#E3E8F0'}`, borderRadius: 20, background: form.eligibleCountries.includes(c) ? '#EEF4FF' : '#fff', color: form.eligibleCountries.includes(c) ? '#1664FF' : '#475569' }}>
              <input type="checkbox" checked={form.eligibleCountries.includes(c)} onChange={() => toggleCountry(c)} style={{ display: 'none' }} />
              {c}
            </label>
          ))}
        </div>
      </FormRow>
    </div>
  )
}

function WizardStep5({ form, setForm }: StepProps) {
  const G = GLOBAL_REFERRAL_DEFAULTS
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionLabel>Anti-Fraud Rules</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#EFF8FF', border: '1px solid #BAE0FF' }}>
        <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.6 }}>
          <strong>Global fraud rules</strong> from Affiliate Program settings apply by default. Use the <strong>Override</strong> toggle to configure campaign-specific thresholds.
        </div>
      </div>
      <InheritedFraudRow
        icon={<Smartphone size={16} />}
        title="Maximum Device Registrations"
        description="Limit how many referral accounts can be registered from the same device."
        overrideKey="maxDeviceRegistrations" form={form} setForm={setForm}
        value={form.maxDeviceRegistrations > 0}
        onChange={v => setForm(f => ({ ...f, maxDeviceRegistrations: v ? G.maxDeviceRegistrations : 0 }))}
        numValue={form.maxDeviceRegistrations > 0 ? form.maxDeviceRegistrations : G.maxDeviceRegistrations}
        onNumChange={v => setForm(f => ({ ...f, maxDeviceRegistrations: v }))}
        numLabel="Max per device"
        globalValue={true} globalNum={G.maxDeviceRegistrations}
      />
      <InheritedFraudRow
        icon={<Wifi size={16} />}
        title="Maximum IP Registrations"
        description="Limit how many referral accounts can be registered from the same IP address."
        overrideKey="maxIpRegistrations" form={form} setForm={setForm}
        value={form.maxIpRegistrations > 0}
        onChange={v => setForm(f => ({ ...f, maxIpRegistrations: v ? G.maxIpRegistrations : 0 }))}
        numValue={form.maxIpRegistrations > 0 ? form.maxIpRegistrations : G.maxIpRegistrations}
        onNumChange={v => setForm(f => ({ ...f, maxIpRegistrations: v }))}
        numLabel="Max per IP"
        globalValue={true} globalNum={G.maxIpRegistrations}
      />
      <InheritedFraudRow
        icon={<Shield size={16} />}
        title="Device Reuse Detection"
        description="Detect and block referral registrations from devices already associated with another referral account."
        overrideKey="duplicateDeviceDetection" form={form} setForm={setForm}
        value={form.duplicateDeviceDetection}
        onChange={v => setForm(f => ({ ...f, duplicateDeviceDetection: v }))}
        globalValue={G.duplicateDeviceDetection}
      />
      <InheritedFraudRow
        icon={<Users size={16} />}
        title="Self-Referral Prevention"
        description="Prevent users from referring themselves using the same identity, verified phone number, email, payment method, or account."
        overrideKey="selfReferralDetection" form={form} setForm={setForm}
        value={form.selfReferralDetection}
        onChange={v => setForm(f => ({ ...f, selfReferralDetection: v }))}
        globalValue={G.selfReferralDetection}
      />
      <InheritedFraudRow
        icon={<BookOpen size={16} />}
        title="Fake Booking Detection"
        description="Detect suspicious bookings created only to earn referral rewards, based on booking patterns and cancellation behavior."
        overrideKey="fakeBookingDetection" form={form} setForm={setForm}
        value={form.fakeBookingDetection}
        onChange={v => setForm(f => ({ ...f, fakeBookingDetection: v }))}
        globalValue={G.fakeBookingDetection}
      />
    </div>
  )
}

function PreviewKV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{value}</div>
    </div>
  )
}

function WizardStep6({ form }: StepProps) {
  const avgReward = form.rewardBudget / Math.max(form.estimatedParticipants, 1)
  const estCost = form.estimatedReferralBookings * avgReward
  const remaining = form.rewardBudget - estCost
  const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(2)} M MMK` : n >= 1000 ? `${(n / 1000).toFixed(0)} K MMK` : `${n} MMK`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionLabel>Preview & Publish</SectionLabel>

      {/* Campaign Information */}
      <div style={{ border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ background: '#F8FAFC', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #E3E8F0' }}>Campaign Information</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <PreviewKV label="Campaign Name" value={form.name || '—'} />
          <PreviewKV label="Type" value={<CampaignTypeBadge type={form.type} />} />
          <PreviewKV label="Status" value={<CampaignStatusBadge status={form.status} />} />
          <PreviewKV label="Start" value={form.startDate ? `${form.startDate} ${form.startTime}` : '—'} />
          <PreviewKV label="End" value={form.endDate ? `${form.endDate} ${form.endTime}` : '—'} />
          <div style={{ gridColumn: '1 / -1' }}>
            <PreviewKV label="Description" value={form.description || '—'} />
          </div>
        </div>
      </div>

      {/* Reward Rules */}
      <div style={{ border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ background: '#F8FAFC', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #E3E8F0' }}>Reward Rules ({form.rewardRules.length})</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {form.rewardRules.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>No reward rules configured.</div>}
          {form.rewardRules.map((rule, i) => (
            <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Rule {i + 1}:</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', background: '#F1F5F9', padding: '2px 8px', borderRadius: 6 }}>{rule.ruleType}</span>
              <span style={{ fontSize: 12, color: '#475569' }}>→</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', background: '#ECFDF3', padding: '2px 8px', borderRadius: 6 }}>{rule.rewardValue.toLocaleString()} {rule.rewardType}</span>
              {rule.description && <span style={{ fontSize: 11, color: '#94A3B8' }}>— {rule.description}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Referral Conditions */}
      <div style={{ border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ background: '#F8FAFC', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #E3E8F0' }}>Referral Conditions</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'Min. Booking Amount', value: `${(form.overrides.minBookingAmount ? form.minBookingAmount : GLOBAL_REFERRAL_DEFAULTS.minBookingAmount).toLocaleString()} MMK`, key: 'minBookingAmount' as OverrideKey },
            { label: 'Min. Stay Requirement', value: `${form.minStayRequirement} night(s)`, key: null },
            { label: 'Attribution Window', value: `${(form.overrides.referralAttributionWindow ? form.referralAttributionWindow : GLOBAL_REFERRAL_DEFAULTS.referralAttributionWindow)} days`, key: 'referralAttributionWindow' as OverrideKey },
            { label: 'Link Expiry', value: `${(form.overrides.referralLinkExpiry ? form.referralLinkExpiry : GLOBAL_REFERRAL_DEFAULTS.referralLinkExpiry)} days`, key: 'referralLinkExpiry' as OverrideKey },
            { label: 'Max Invitations / User', value: form.overrides.maxInvitationsPerUser ? form.maxInvitationsPerUser : GLOBAL_REFERRAL_DEFAULTS.maxInvitationsPerUser, key: 'maxInvitationsPerUser' as OverrideKey },
            { label: 'Max Rewards / User', value: form.overrides.maxRewardsPerUser ? form.maxRewardsPerUser : GLOBAL_REFERRAL_DEFAULTS.maxRewardsPerUser, key: 'maxRewardsPerUser' as OverrideKey },
            { label: 'Booking Completion Required', value: (form.overrides.bookingCompletionRequired ? form.bookingCompletionRequired : GLOBAL_REFERRAL_DEFAULTS.bookingCompletionRequired) ? 'Yes' : 'No', key: 'bookingCompletionRequired' as OverrideKey },
            { label: 'Reward Hold Period', value: `${(form.overrides.rewardHoldPeriod ? form.rewardHoldPeriod : GLOBAL_REFERRAL_DEFAULTS.rewardHoldPeriod)} days`, key: 'rewardHoldPeriod' as OverrideKey },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{item.label}</span>
                {item.key && (form.overrides[item.key] ? <OverrideBadge /> : <GlobalDefaultBadge />)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{item.value}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>Eligible Categories</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{form.eligibleHotelCategories.join(', ') || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 3 }}>Eligible Countries</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{form.eligibleCountries.join(', ') || '—'}</div>
          </div>
        </div>
      </div>

      {/* Budget Summary */}
      <div style={{ border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ background: '#F8FAFC', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #E3E8F0' }}>Budget Summary</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <PreviewKV label="Reward Pool" value={<span style={{ color: '#1664FF' }}>{fmt(form.totalRewardPool)}</span>} />
          <PreviewKV label="Reward Budget" value={<span style={{ color: '#1A2332' }}>{fmt(form.rewardBudget)}</span>} />
          <PreviewKV label="Est. Total Cost" value={<span style={{ color: estCost > form.rewardBudget ? '#DC2626' : '#1A2332' }}>{fmt(estCost)}</span>} />
          <PreviewKV label="Remaining Budget" value={<span style={{ color: remaining < 0 ? '#DC2626' : '#059669' }}>{fmt(remaining)}</span>} />
        </div>
      </div>

      {/* Fraud Protection */}
      <div style={{ border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ background: '#F8FAFC', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #E3E8F0' }}>Fraud Protection</div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Device Reuse Detection', key: 'duplicateDeviceDetection' as OverrideKey, value: form.overrides.duplicateDeviceDetection ? form.duplicateDeviceDetection : GLOBAL_REFERRAL_DEFAULTS.duplicateDeviceDetection },
            { label: 'Self-Referral Prevention', key: 'selfReferralDetection' as OverrideKey, value: form.overrides.selfReferralDetection ? form.selfReferralDetection : GLOBAL_REFERRAL_DEFAULTS.selfReferralDetection },
            { label: 'Fake Booking Detection', key: 'fakeBookingDetection' as OverrideKey, value: form.overrides.fakeBookingDetection ? form.fakeBookingDetection : GLOBAL_REFERRAL_DEFAULTS.fakeBookingDetection },
            { label: 'Max Device Registrations', key: 'maxDeviceRegistrations' as OverrideKey, value: (form.overrides.maxDeviceRegistrations ? form.maxDeviceRegistrations : GLOBAL_REFERRAL_DEFAULTS.maxDeviceRegistrations) > 0 },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#475569' }}>{item.label}</span>
                {form.overrides[item.key] ? <OverrideBadge /> : <GlobalDefaultBadge />}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: item.value ? '#027A48' : '#64748B', background: item.value ? '#ECFDF3' : '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>
                {item.value ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Campaign Wizard ───────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { label: 'Basic Information' },
  { label: 'Budget & Reward Pool' },
  { label: 'Reward Rules' },
  { label: 'Referral Conditions' },
  { label: 'Anti-Fraud Rules' },
  { label: 'Preview & Publish' },
]

function campaignToForm(c: ReferralCampaign): WizardForm {
  return {
    name: c.name, description: c.description, type: c.type, bannerUrl: '',
    startDate: c.startDate, startTime: '09:00', endDate: c.endDate, endTime: '23:59',
    status: c.status,
    totalRewardPool: c.totalRewardPool, rewardBudget: c.rewardBudget,
    estimatedParticipants: c.estimatedParticipants, estimatedReferralBookings: c.estimatedReferralBookings,
    rewardRules: c.rewardRules,
    minBookingAmount: c.minBookingAmount, minStayRequirement: c.minStayRequirement,
    bookingCompletionRequired: c.bookingCompletionRequired, referralLinkExpiry: c.referralLinkExpiry,
    maxInvitationsPerUser: c.maxInvitationsPerUser, maxRewardsPerUser: c.maxRewardsPerUser,
    eligibleHotelCategories: c.eligibleHotelCategories, eligibleCountries: c.eligibleCountries,
    referralAttributionWindow: c.referralAttributionWindow, rewardHoldPeriod: c.rewardHoldPeriod,
    maxDeviceRegistrations: c.maxDeviceRegistrations, maxIpRegistrations: c.maxIpRegistrations,
    duplicateDeviceDetection: c.duplicateDeviceDetection, selfReferralDetection: c.selfReferralDetection,
    multipleAccountDetection: c.multipleAccountDetection, fakeBookingDetection: c.fakeBookingDetection,
    overrides: c.overrides,
  }
}

function CampaignWizard({ editCampaign, onClose, onSave, showToast }: WizardProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<WizardForm>(editCampaign ? campaignToForm(editCampaign) : { ...DEFAULT_FORM })

  const handleSaveDraft = () => {
    showToast('info', 'Draft Saved', `${form.name || 'Campaign'} has been saved as a draft.`)
  }

  const handlePublish = (newStatus?: CampaignStatus) => {
    const now = new Date()
    const campaign: ReferralCampaign = {
      id: editCampaign?.id ?? Date.now().toString(),
      name: form.name,
      description: form.description,
      type: form.type,
      startDate: form.startDate || now.toISOString().split('T')[0],
      endDate: form.endDate || '',
      status: newStatus ?? form.status,
      createdBy: editCampaign?.createdBy ?? 'Admin — Li Min',
      priority: editCampaign?.priority ?? 9,
      participants: editCampaign?.participants ?? 0,
      totalRewardsDistributed: editCampaign?.totalRewardsDistributed ?? 0,
      totalRewardPool: form.totalRewardPool,
      rewardBudget: form.rewardBudget,
      estimatedParticipants: form.estimatedParticipants,
      estimatedReferralBookings: form.estimatedReferralBookings,
      rewardRules: form.rewardRules,
      minBookingAmount: form.overrides.minBookingAmount ? form.minBookingAmount : GLOBAL_REFERRAL_DEFAULTS.minBookingAmount,
      minStayRequirement: form.minStayRequirement,
      bookingCompletionRequired: form.overrides.bookingCompletionRequired ? form.bookingCompletionRequired : GLOBAL_REFERRAL_DEFAULTS.bookingCompletionRequired,
      referralLinkExpiry: form.overrides.referralLinkExpiry ? form.referralLinkExpiry : GLOBAL_REFERRAL_DEFAULTS.referralLinkExpiry,
      maxInvitationsPerUser: form.overrides.maxInvitationsPerUser ? form.maxInvitationsPerUser : GLOBAL_REFERRAL_DEFAULTS.maxInvitationsPerUser,
      maxRewardsPerUser: form.overrides.maxRewardsPerUser ? form.maxRewardsPerUser : GLOBAL_REFERRAL_DEFAULTS.maxRewardsPerUser,
      eligibleHotelCategories: form.eligibleHotelCategories,
      eligibleCountries: form.eligibleCountries,
      referralAttributionWindow: form.overrides.referralAttributionWindow ? form.referralAttributionWindow : GLOBAL_REFERRAL_DEFAULTS.referralAttributionWindow,
      rewardHoldPeriod: form.overrides.rewardHoldPeriod ? form.rewardHoldPeriod : GLOBAL_REFERRAL_DEFAULTS.rewardHoldPeriod,
      maxDeviceRegistrations: form.overrides.maxDeviceRegistrations ? form.maxDeviceRegistrations : GLOBAL_REFERRAL_DEFAULTS.maxDeviceRegistrations,
      maxIpRegistrations: form.overrides.maxIpRegistrations ? form.maxIpRegistrations : GLOBAL_REFERRAL_DEFAULTS.maxIpRegistrations,
      duplicateDeviceDetection: form.overrides.duplicateDeviceDetection ? form.duplicateDeviceDetection : GLOBAL_REFERRAL_DEFAULTS.duplicateDeviceDetection,
      selfReferralDetection: form.overrides.selfReferralDetection ? form.selfReferralDetection : GLOBAL_REFERRAL_DEFAULTS.selfReferralDetection,
      multipleAccountDetection: form.multipleAccountDetection,
      fakeBookingDetection: form.overrides.fakeBookingDetection ? form.fakeBookingDetection : GLOBAL_REFERRAL_DEFAULTS.fakeBookingDetection,
      overrides: form.overrides,
    }
    onSave(campaign)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 12, overflow: 'hidden', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #E3E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 8, padding: '6px 12px', background: '#fff', cursor: 'pointer' }}>
            <ChevronLeft size={14} /> Back
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A2332' }}>
            {editCampaign ? `Edit: ${editCampaign.name}` : 'Create Referral Campaign'}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Step {step} of {WIZARD_STEPS.length}</span>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #E3E8F0', background: '#F8FAFC', padding: '20px 0' }}>
          {WIZARD_STEPS.map((s, i) => {
            const n = i + 1
            const isActive = step === n
            const isDone = step > n
            return (
              <div key={n} onClick={() => setStep(n)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', cursor: 'pointer', background: isActive ? '#EEF4FF' : 'transparent', borderRight: isActive ? '3px solid #1664FF' : '3px solid transparent' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? '#1664FF' : isDone ? '#059669' : '#E3E8F0', color: (isActive || isDone) ? '#fff' : '#94A3B8', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {isDone ? <Check size={12} /> : n}
                </div>
                <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#1664FF' : isDone ? '#059669' : '#475569' }}>{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxHeight: 560 }}>
          {step === 1 && <WizardStep1 form={form} setForm={setForm} />}
          {step === 2 && <WizardStep2 form={form} setForm={setForm} />}
          {step === 3 && <WizardStep3 form={form} setForm={setForm} />}
          {step === 4 && <WizardStep4 form={form} setForm={setForm} />}
          {step === 5 && <WizardStep5 form={form} setForm={setForm} />}
          {step === 6 && <WizardStep6 form={form} setForm={setForm} />}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #E3E8F0', background: '#fff' }}>
        <button onClick={handleSaveDraft} style={{ fontSize: 13, fontWeight: 500, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 8, padding: '8px 16px', background: '#fff', cursor: 'pointer' }}>
          Save Draft
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{ fontSize: 13, fontWeight: 500, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 8, padding: '8px 16px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
          {step < 6 ? (
            <button onClick={() => setStep(s => s + 1)} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#1664FF', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <>
              <button onClick={() => handlePublish('draft')} style={{ fontSize: 13, fontWeight: 500, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 8, padding: '8px 16px', background: '#fff', cursor: 'pointer' }}>
                Preview
              </button>
              <button onClick={() => handlePublish('scheduled')} style={{ fontSize: 13, fontWeight: 500, color: '#0369A1', border: '1px solid #0369A1', borderRadius: 8, padding: '8px 16px', background: '#EFF8FF', cursor: 'pointer' }}>
                Schedule
              </button>
              <button onClick={() => handlePublish('active')} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#059669', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}>
                Publish
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Campaign List Page ────────────────────────────────────────────────────────

const PER_PAGE = 8

function ReferralCampaignListPage({ showToast }: { showToast: Props['showToast'] }) {
  const [campaigns, setCampaigns] = useState<ReferralCampaign[]>(INIT_CAMPAIGNS)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ReferralCampaign | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  if (wizardOpen) {
    return (
      <CampaignWizard
        editCampaign={editTarget}
        onClose={() => { setWizardOpen(false); setEditTarget(null) }}
        onSave={c => {
          setCampaigns(prev => editTarget ? prev.map(p => p.id === c.id ? c : p) : [c, ...prev])
          setWizardOpen(false)
          setEditTarget(null)
          showToast('success', 'Campaign Saved', `${c.name} has been published.`)
        }}
        showToast={showToast}
      />
    )
  }

  // KPIs
  const active = campaigns.filter(c => c.status === 'active')
  const scheduled = campaigns.filter(c => c.status === 'scheduled')
  const draft = campaigns.filter(c => c.status === 'draft')
  const totalRewards = campaigns.reduce((s, c) => s + c.totalRewardsDistributed, 0)
  const activeParticipants = active.reduce((s, c) => s + c.participants, 0)

  // Filter
  const filtered = campaigns.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.createdBy.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || c.type === typeFilter
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const changeStatus = (id: string, status: CampaignStatus) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KpiCard label="Active Campaigns" value={active.length} color="#059669" />
        <KpiCard label="Scheduled" value={scheduled.length} color="#0369A1" />
        <KpiCard label="Draft" value={draft.length} color="#94A3B8" />
        <KpiCard label="Total Rewards Distributed" value={`${(totalRewards / 1000000).toFixed(1)} M MMK`} color="#7C3AED" />
        <KpiCard label="Active Participants" value={activeParticipants.toLocaleString()} color="#1664FF" />
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          style={{ ...inp, width: 240 }}
          placeholder="Search campaigns..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <select style={{ ...sel, width: 180 }} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
          <option value="all">All Types</option>
          <option value="Invite Friends">Invite Friends</option>
          <option value="Referral Rewards">Referral Rewards</option>
          <option value="First Booking Bonus">First Booking Bonus</option>
          <option value="Seasonal Referral Campaign">Seasonal Referral Campaign</option>
        </select>
        <select style={{ ...sel, width: 150 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setEditTarget(null); setWizardOpen(true) }} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#1664FF', border: 'none', borderRadius: 8, padding: '0 20px', height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={15} /> Create Campaign
        </button>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #E3E8F0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['#', 'Campaign Name', 'Type', 'Campaign Period', 'Budget', 'Participants', 'Total Rewards', 'Status', 'Created By', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No campaigns found.</td>
              </tr>
            )}
            {paginated.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#94A3B8' }}>{(page - 1) * PER_PAGE + i + 1}</td>
                <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Priority {c.priority}</div>
                </td>
                <td style={{ padding: '10px 12px' }}><CampaignTypeBadge type={c.type} /></td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                  <div>{c.startDate}</div>
                  <div style={{ color: '#94A3B8' }}>→ {c.endDate}</div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
                  <div>{(c.rewardBudget / 1000000).toFixed(1)} M</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Pool: {(c.totalRewardPool / 1000000).toFixed(1)} M</div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{c.participants.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#7C3AED', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {c.totalRewardsDistributed >= 1000000
                    ? `${(c.totalRewardsDistributed / 1000000).toFixed(1)} M`
                    : `${c.totalRewardsDistributed.toLocaleString()}`} MMK
                </td>
                <td style={{ padding: '10px 12px' }}><CampaignStatusBadge status={c.status} /></td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{c.createdBy}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <ActionBtn onClick={() => showToast('info', 'View Campaign', `Viewing ${c.name}`)} title="View">
                      <Eye size={13} />
                    </ActionBtn>
                    <ActionBtn onClick={() => { setEditTarget(c); setWizardOpen(true) }} title="Edit">
                      <Edit2 size={13} />
                    </ActionBtn>
                    <ActionBtn onClick={() => {
                      const dup: ReferralCampaign = { ...c, id: Date.now().toString(), name: `${c.name} (Copy)`, status: 'draft', participants: 0, totalRewardsDistributed: 0 }
                      setCampaigns(prev => [dup, ...prev])
                      showToast('success', 'Campaign Duplicated', `${c.name} has been duplicated as a draft.`)
                    }} title="Duplicate">
                      <Copy size={13} />
                    </ActionBtn>
                    {(c.status === 'draft' || c.status === 'paused' || c.status === 'scheduled') && (
                      <ActionBtn onClick={() => { changeStatus(c.id, 'active'); showToast('success', 'Campaign Activated', `${c.name} is now active.`) }} title="Activate">
                        <Play size={13} />
                      </ActionBtn>
                    )}
                    {c.status === 'active' && (
                      <ActionBtn onClick={() => { changeStatus(c.id, 'paused'); showToast('warning', 'Campaign Paused', `${c.name} has been paused.`) }} title="Pause">
                        <Pause size={13} />
                      </ActionBtn>
                    )}
                    {(c.status === 'active' || c.status === 'paused') && (
                      <ActionBtn onClick={() => { changeStatus(c.id, 'ended'); showToast('info', 'Campaign Ended', `${c.name} has been ended.`) }} title="End Campaign">
                        <StopCircle size={13} />
                      </ActionBtn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>
          Showing {Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} campaigns
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={14} />
          </PagBtn>
          {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${p === page ? '#1664FF' : '#E3E8F0'}`, background: p === page ? '#1664FF' : '#fff', color: p === page ? '#fff' : '#475569', fontSize: 12, fontWeight: p === page ? 600 : 400, cursor: 'pointer' }}>
              {p}
            </button>
          ))}
          <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight size={14} />
          </PagBtn>
        </div>
      </div>
    </div>
  )
}

// ─── Default export ────────────────────────────────────────────────────────────

export default function ReferralCampaignsPage({ tab, showToast }: Props) {
  void tab
  return <ReferralCampaignListPage showToast={showToast} />
}

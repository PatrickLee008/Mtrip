import { useState, useRef, useEffect } from 'react'
import {
  Search, Plus, Download, Eye, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  AlertTriangle, MoreHorizontal, Ban, RotateCcw, ShieldAlert, ShieldCheck,
  Banknote, Send, Mail, Copy, ExternalLink, Zap, ZapOff,
  RefreshCw, Tag, TrendingUp, DollarSign, ShoppingBag, Edit2, PlusCircle,
} from 'lucide-react'
import { affiliates, affiliateCodes as initialAffiliateCodes } from '../data/platformData'
import type { Affiliate, AffiliateCode } from '../data/platformData'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'
import Drawer from '../components/Drawer'
import Dialog from '../components/Dialog'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

// ── Shared badges & helpers ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:       { bg: '#ECFDF3', color: '#027A48' },
    pending:      { bg: '#FFFAEB', color: '#B54708' },
    suspended:    { bg: '#FFF1F3', color: '#C01048' },
    rejected:     { bg: '#F1F5F9', color: '#475569' },
    approved:     { bg: '#ECFDF3', color: '#027A48' },
    paid:         { bg: '#ECFDF3', color: '#027A48' },
    processing:   { bg: '#EFF6FF', color: '#1D4ED8' },
    under_review: { bg: '#FFFAEB', color: '#B54708' },
    investigating:{ bg: '#FFF7ED', color: '#9A3412' },
    resolved:     { bg: '#F0FDF4', color: '#166534' },
    dismissed:    { bg: '#F1F5F9', color: '#475569' },
    high:         { bg: '#FFF1F3', color: '#BE123C' },
    medium:       { bg: '#FFFAEB', color: '#B54708' },
    low:          { bg: '#ECFDF3', color: '#027A48' },
  }
  const c = cfg[status] ?? { bg: '#F1F5F9', color: '#475569' }
  return (
    <span className="inline-flex items-center rounded px-1.5 font-medium capitalize"
      style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function TypeBadge({ type }: { type: Affiliate['type'] }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    influencer:  { bg: '#FFF1F3', color: '#BE123C', label: 'Influencer' },
    blogger:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Blogger' },
    kol:         { bg: '#EDE9FE', color: '#5B21B6', label: 'KOL' },
    ota_partner: { bg: '#F0FDF4', color: '#166534', label: 'OTA Partner' },
    corporate:   { bg: '#FEF3C7', color: '#92400E', label: 'Corporate' },
  }
  const c = cfg[type] ?? { bg: '#F1F5F9', color: '#475569', label: type }
  return (
    <span className="inline-flex items-center rounded px-1.5 font-medium"
      style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>
      {c.label}
    </span>
  )
}

function FraudBar({ score }: { score: number }) {
  const color = score >= 60 ? '#DC2626' : score >= 25 ? '#D97706' : '#059669'
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 48, height: 5, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 9999 }} />
      </div>
      <span style={{ fontSize: 12, color, fontFamily: 'monospace', fontWeight: 700 }}>{score}</span>
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
        <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 100, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 190, padding: '4px 0' }}>
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

function PageShell({ breadcrumb, title, subtitle, actions, kpis, search, children }: {
  breadcrumb: string; title: string; subtitle: string
  actions?: React.ReactNode; kpis: { label: string; value: string | number; color: string; sub?: string }[]
  search: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{breadcrumb}</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{title}</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{subtitle}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: `repeat(${kpis.length}, 1fr)` }}>
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>
      {search}
      {children}
    </div>
  )
}

// ── Synthetic data: Reward Wallet ───────────────────────────────────────────

type WalletRewardSource =
  | 'Referral Campaign' | 'Referral Bonus' | 'Booking Reward'
  | 'Promotional Campaign' | 'Manual Adjustment' | 'System Reward'

type WalletTxType =
  | 'Reward Earned' | 'Reward Redeemed' | 'Reward Expired'
  | 'Manual Credit' | 'Manual Deduction' | 'Adjustment'

type WalletRewardType = 'Travel Credits' | 'Reward Points' | 'Coupon' | 'Voucher'
type WalletStatus     = 'Pending' | 'Credited' | 'Redeemed' | 'Expired' | 'Cancelled'

interface WalletTransaction {
  id: string; userId: string; userName: string; userHandle: string; referralCode: string
  currentBalance: number; rewardSource: WalletRewardSource; campaign: string
  transactionType: WalletTxType; rewardType: WalletRewardType
  amount: number; unit: 'pts' | 'MMK credits'
  balanceBefore: number; balanceAfter: number
  status: WalletStatus; timestamp: string
  expiryDate?: string; associatedBookingId?: string; associatedReferral?: string
  redemptionNote?: string
  timeline: { label: string; time: string; done: boolean }[]
}

const WALLET_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'WTX-2024-001', userId: 'AFF-001', userName: 'TravelWithLily', userHandle: '@travelwithlily',
    referralCode: 'LILY2024', currentBalance: 24800, rewardSource: 'Referral Campaign',
    campaign: 'mTrip Summer Friends 2024', transactionType: 'Reward Earned', rewardType: 'Reward Points',
    amount: 1500, unit: 'pts', balanceBefore: 23300, balanceAfter: 24800,
    status: 'Credited', timestamp: '2024-12-13 09:14', expiryDate: '2025-12-13',
    associatedReferral: 'Referred — Khin May (USR-003)',
    timeline: [{ label: 'Reward Earned', time: '2024-12-13 09:10', done: true }, { label: 'Reward Credited', time: '2024-12-13 09:14', done: true }, { label: 'Reward Redeemed', time: '—', done: false }],
  },
  {
    id: 'WTX-2024-002', userId: 'AFF-002', userName: 'Jason Hotel Reviews', userHandle: '@jasonhotels',
    referralCode: 'JASON24', currentBalance: 12600, rewardSource: 'Referral Bonus',
    campaign: 'Platinum Member Referral', transactionType: 'Reward Earned', rewardType: 'Travel Credits',
    amount: 5000, unit: 'MMK credits', balanceBefore: 7600, balanceAfter: 12600,
    status: 'Credited', timestamp: '2024-12-12 14:30', expiryDate: '2025-06-12',
    associatedBookingId: 'BKG-8821',
    timeline: [{ label: 'Reward Earned', time: '2024-12-12 14:28', done: true }, { label: 'Reward Credited', time: '2024-12-12 14:30', done: true }, { label: 'Reward Redeemed', time: '—', done: false }],
  },
  {
    id: 'WTX-2024-003', userId: 'AFF-004', userName: 'LuxuryHotelSeeker', userHandle: '@luxhotelseeker',
    referralCode: 'LUXURY04', currentBalance: 44000, rewardSource: 'Booking Reward',
    campaign: 'Inle Lake Discovery Campaign', transactionType: 'Reward Redeemed', rewardType: 'Voucher',
    amount: 8000, unit: 'MMK credits', balanceBefore: 52000, balanceAfter: 44000,
    status: 'Redeemed', timestamp: '2024-12-11 11:00', associatedBookingId: 'BKG-8640',
    redemptionNote: 'Redeemed for hotel discount voucher — Novotel Inle Lake',
    timeline: [{ label: 'Reward Earned', time: '2024-11-28 12:00', done: true }, { label: 'Reward Credited', time: '2024-11-28 12:05', done: true }, { label: 'Reward Redeemed', time: '2024-12-11 11:00', done: true }],
  },
  {
    id: 'WTX-2024-004', userId: 'AFF-007', userName: 'AsiaHotelDeals', userHandle: '@asiahoteldeals',
    referralCode: 'ASIAHD07', currentBalance: 28000, rewardSource: 'Promotional Campaign',
    campaign: 'New Year Booking Bonus 2025', transactionType: 'Reward Earned', rewardType: 'Reward Points',
    amount: 2000, unit: 'pts', balanceBefore: 26000, balanceAfter: 28000,
    status: 'Pending', timestamp: '2024-12-10 16:45', expiryDate: '2025-12-10',
    timeline: [{ label: 'Reward Earned', time: '2024-12-10 16:45', done: true }, { label: 'Reward Credited', time: '—', done: false }],
  },
  {
    id: 'WTX-2024-005', userId: 'AFF-009', userName: 'Corporate Travel Pro', userHandle: '@corptravel_pro',
    referralCode: 'CORP09', currentBalance: 62000, rewardSource: 'Referral Campaign',
    campaign: 'Corporate Traveler Referral', transactionType: 'Reward Earned', rewardType: 'Travel Credits',
    amount: 12000, unit: 'MMK credits', balanceBefore: 50000, balanceAfter: 62000,
    status: 'Credited', timestamp: '2024-12-09 10:20', expiryDate: '2025-12-09',
    associatedReferral: 'Referred — 4 corporate accounts registered',
    timeline: [{ label: 'Reward Earned', time: '2024-12-09 10:18', done: true }, { label: 'Reward Credited', time: '2024-12-09 10:20', done: true }, { label: 'Reward Redeemed', time: '—', done: false }],
  },
  {
    id: 'WTX-2024-006', userId: 'AFF-012', userName: 'ShanghaiLifestyle', userHandle: '@shanghailifestyle',
    referralCode: 'SHLIFE12', currentBalance: 22000, rewardSource: 'System Reward',
    campaign: 'Silver Tier Upgrade Campaign', transactionType: 'Manual Credit', rewardType: 'Reward Points',
    amount: 3000, unit: 'pts', balanceBefore: 19000, balanceAfter: 22000,
    status: 'Credited', timestamp: '2024-12-08 09:00',
    redemptionNote: 'Manual credit by Admin — tier upgrade bonus',
    timeline: [{ label: 'Reward Earned', time: '2024-12-08 09:00', done: true }, { label: 'Reward Credited', time: '2024-12-08 09:00', done: true }],
  },
  {
    id: 'WTX-2024-007', userId: 'AFF-014', userName: 'CityHopperMike', userHandle: '@cityhoppermike',
    referralCode: 'MIKETRV14', currentBalance: 31200, rewardSource: 'Referral Bonus',
    campaign: 'mTrip Summer Friends 2024', transactionType: 'Reward Redeemed', rewardType: 'Coupon',
    amount: 5000, unit: 'MMK credits', balanceBefore: 36200, balanceAfter: 31200,
    status: 'Redeemed', timestamp: '2024-12-07 15:30', associatedBookingId: 'BKG-7210',
    redemptionNote: 'Redeemed for booking coupon — Governor\'s Residence Hotel',
    timeline: [{ label: 'Reward Earned', time: '2024-11-15 10:00', done: true }, { label: 'Reward Credited', time: '2024-11-15 10:05', done: true }, { label: 'Reward Redeemed', time: '2024-12-07 15:30', done: true }],
  },
  {
    id: 'WTX-2024-008', userId: 'AFF-016', userName: 'HotelInsiderCN', userHandle: '@hotelinsidercn',
    referralCode: 'INSIDER16', currentBalance: 6800, rewardSource: 'Referral Campaign',
    campaign: 'Inle Lake Discovery Campaign', transactionType: 'Reward Expired', rewardType: 'Reward Points',
    amount: 1200, unit: 'pts', balanceBefore: 8000, balanceAfter: 6800,
    status: 'Expired', timestamp: '2024-12-06 00:00', expiryDate: '2024-12-06',
    timeline: [{ label: 'Reward Earned', time: '2024-06-06 10:00', done: true }, { label: 'Reward Credited', time: '2024-06-06 10:05', done: true }, { label: 'Reward Expired', time: '2024-12-06 00:00', done: true }],
  },
  {
    id: 'WTX-2024-009', userId: 'AFF-019', userName: 'GlobalNomadTV', userHandle: '@globalnomadtv',
    referralCode: 'GNOMAD19', currentBalance: 9800, rewardSource: 'Booking Reward',
    campaign: 'Q4 Acquisition Drive', transactionType: 'Reward Earned', rewardType: 'Travel Credits',
    amount: 3500, unit: 'MMK credits', balanceBefore: 6300, balanceAfter: 9800,
    status: 'Credited', timestamp: '2024-12-05 13:45', expiryDate: '2025-06-05',
    associatedBookingId: 'BKG-8380',
    timeline: [{ label: 'Reward Earned', time: '2024-12-05 13:43', done: true }, { label: 'Reward Credited', time: '2024-12-05 13:45', done: true }, { label: 'Reward Redeemed', time: '—', done: false }],
  },
  {
    id: 'WTX-2024-010', userId: 'AFF-020', userName: 'TravelNowCorp', userHandle: '@travelnowcorp',
    referralCode: 'TNOW20', currentBalance: 38000, rewardSource: 'Manual Adjustment',
    campaign: '—', transactionType: 'Manual Deduction', rewardType: 'Reward Points',
    amount: 500, unit: 'pts', balanceBefore: 38500, balanceAfter: 38000,
    status: 'Credited', timestamp: '2024-12-04 11:00',
    redemptionNote: 'Manual deduction — system correction by Admin Li',
    timeline: [{ label: 'Adjustment Requested', time: '2024-12-04 11:00', done: true }, { label: 'Adjustment Applied', time: '2024-12-04 11:00', done: true }],
  },
  {
    id: 'WTX-2024-011', userId: 'AFF-001', userName: 'TravelWithLily', userHandle: '@travelwithlily',
    referralCode: 'LILY2024', currentBalance: 23300, rewardSource: 'Promotional Campaign',
    campaign: 'Mandalay Festival Special', transactionType: 'Reward Earned', rewardType: 'Voucher',
    amount: 10000, unit: 'MMK credits', balanceBefore: 13300, balanceAfter: 23300,
    status: 'Credited', timestamp: '2024-11-20 08:30', expiryDate: '2025-03-20',
    associatedBookingId: 'BKG-6880',
    timeline: [{ label: 'Reward Earned', time: '2024-11-20 08:28', done: true }, { label: 'Reward Credited', time: '2024-11-20 08:30', done: true }, { label: 'Reward Redeemed', time: '—', done: false }],
  },
  {
    id: 'WTX-2024-012', userId: 'AFF-004', userName: 'LuxuryHotelSeeker', userHandle: '@luxhotelseeker',
    referralCode: 'LUXURY04', currentBalance: 52000, rewardSource: 'Referral Campaign',
    campaign: 'Platinum Member Referral', transactionType: 'Reward Earned', rewardType: 'Reward Points',
    amount: 4000, unit: 'pts', balanceBefore: 48000, balanceAfter: 52000,
    status: 'Pending', timestamp: '2024-11-15 17:00', expiryDate: '2025-11-15',
    associatedReferral: 'Referred — 2 platinum tier members',
    timeline: [{ label: 'Reward Earned', time: '2024-11-15 17:00', done: true }, { label: 'Reward Credited', time: '—', done: false }],
  },
  {
    id: 'WTX-2024-013', userId: 'AFF-009', userName: 'Corporate Travel Pro', userHandle: '@corptravel_pro',
    referralCode: 'CORP09', currentBalance: 50000, rewardSource: 'System Reward',
    campaign: '—', transactionType: 'Adjustment', rewardType: 'Travel Credits',
    amount: 2000, unit: 'MMK credits', balanceBefore: 48000, balanceAfter: 50000,
    status: 'Credited', timestamp: '2024-11-01 09:00',
    redemptionNote: 'System adjustment — promotional rate correction',
    timeline: [{ label: 'Adjustment Triggered', time: '2024-11-01 09:00', done: true }, { label: 'Credits Applied', time: '2024-11-01 09:00', done: true }],
  },
  {
    id: 'WTX-2024-014', userId: 'AFF-007', userName: 'AsiaHotelDeals', userHandle: '@asiahoteldeals',
    referralCode: 'ASIAHD07', currentBalance: 26000, rewardSource: 'Referral Campaign',
    campaign: 'mTrip Summer Friends 2024', transactionType: 'Reward Expired', rewardType: 'Coupon',
    amount: 3000, unit: 'MMK credits', balanceBefore: 29000, balanceAfter: 26000,
    status: 'Expired', timestamp: '2024-10-01 00:00', expiryDate: '2024-10-01',
    timeline: [{ label: 'Reward Earned', time: '2024-04-01 10:00', done: true }, { label: 'Reward Credited', time: '2024-04-01 10:05', done: true }, { label: 'Reward Expired', time: '2024-10-01 00:00', done: true }],
  },
  {
    id: 'WTX-2024-015', userId: 'AFF-012', userName: 'ShanghaiLifestyle', userHandle: '@shanghailifestyle',
    referralCode: 'SHLIFE12', currentBalance: 19000, rewardSource: 'Booking Reward',
    campaign: 'Corporate Traveler Referral', transactionType: 'Reward Redeemed', rewardType: 'Travel Credits',
    amount: 6000, unit: 'MMK credits', balanceBefore: 25000, balanceAfter: 19000,
    status: 'Redeemed', timestamp: '2024-09-15 14:00', associatedBookingId: 'BKG-5100',
    redemptionNote: 'Redeemed as travel credit for Strand Hotel booking',
    timeline: [{ label: 'Reward Earned', time: '2024-08-10 11:00', done: true }, { label: 'Reward Credited', time: '2024-08-10 11:05', done: true }, { label: 'Reward Redeemed', time: '2024-09-15 14:00', done: true }],
  },
]

// ── Synthetic data: Fraud Cases ──────────────────────────────────────────────

type FraudInvestigationStatus = 'investigating' | 'under_review' | 'resolved' | 'dismissed'
type FraudRiskLevel = 'high' | 'medium' | 'low'

interface FraudCase {
  id: string; affiliateId: string; affiliateName: string; handle: string; type: Affiliate['type']
  fraudScore: number; riskLevel: FraudRiskLevel; suspiciousActivity: string; evidenceSummary: string
  investigationStatus: FraudInvestigationStatus; reviewer: string; detectionDate: string; affiliateStatus: Affiliate['status']
}

const fraudCases: FraudCase[] = [
  { id: 'FR-2024-001', affiliateId: 'AFF-018', affiliateName: 'ClickFarm99',         handle: '@clickfarm99',       type: 'blogger',     fraudScore: 94, riskLevel: 'high',   suspiciousActivity: 'Click Farm Operation',       evidenceSummary: '44K referrals, only 88 conversions (0.2% rate). Bot traffic detected from 3 IP clusters. Pattern matches known click farm infrastructure.',  investigationStatus: 'resolved',      reviewer: 'Admin Chen',   detectionDate: '2024-11-10', affiliateStatus: 'suspended' },
  { id: 'FR-2024-002', affiliateId: 'AFF-011', affiliateName: 'TravelHacking_CN',    handle: '@travelhacking_cn',  type: 'blogger',     fraudScore: 72, riskLevel: 'high',   suspiciousActivity: 'Self-Referral Abuse',         evidenceSummary: 'Multiple bookings traced to accounts created via own referral links. Device fingerprints overlap across 12 "unique" users. Cookie manipulation likely.',          investigationStatus: 'under_review',  reviewer: 'Admin Zhang',  detectionDate: '2024-10-18', affiliateStatus: 'suspended' },
  { id: 'FR-2024-003', affiliateId: 'AFF-005', affiliateName: 'ResortFinder_CN',     handle: '@resortfindercn',    type: 'kol',         fraudScore: 4,  riskLevel: 'low',    suspiciousActivity: 'Unusual Traffic Spike',       evidenceSummary: 'Traffic spike (+340%) on 2024-12-01 following viral post. Verified organic growth from Xiaohongshu trending page. No further anomalies detected.',               investigationStatus: 'dismissed',     reviewer: 'Admin Li',     detectionDate: '2024-12-02', affiliateStatus: 'active' },
  { id: 'FR-2024-004', affiliateId: 'AFF-013', affiliateName: 'BudgetTraveler_Asia', handle: '@budgettraveler_asia',type: 'blogger',    fraudScore: 5,  riskLevel: 'low',    suspiciousActivity: 'High Cancellation Rate',      evidenceSummary: 'Referral-sourced bookings show 38% cancellation rate vs 12% platform average. Pattern consistent with promo-code flipping. Monitoring active.',                   investigationStatus: 'under_review',  reviewer: 'Admin Wang',   detectionDate: '2024-12-05', affiliateStatus: 'active' },
  { id: 'FR-2024-005', affiliateId: 'AFF-017', affiliateName: 'SleepWellGuide',      handle: '@sleepwellguide',    type: 'blogger',     fraudScore: 6,  riskLevel: 'low',    suspiciousActivity: 'Commission Manipulation',     evidenceSummary: 'Referrals include 4 bookings made by accounts matching admin email patterns. Could be test accounts or family use. Low monetary impact — ¥2,100 at risk.',           investigationStatus: 'investigating', reviewer: 'Admin Chen',   detectionDate: '2024-12-08', affiliateStatus: 'active' },
  { id: 'FR-2024-006', affiliateId: 'AFF-003', affiliateName: 'ChinaTravelBlog',     handle: '@chinatravelblog',   type: 'blogger',     fraudScore: 3,  riskLevel: 'low',    suspiciousActivity: 'Duplicate Referral Links',    evidenceSummary: 'Same referral link shared across 3 different WhatsApp groups simultaneously. Coordination detected but referral quality is high (82% conversion). Likely group marketing strategy.',  investigationStatus: 'dismissed',   reviewer: 'Admin Li',     detectionDate: '2024-11-28', affiliateStatus: 'active' },
]

// ── 1. Affiliate Applications ─────────────────────────────────────────────────

function AffiliateApplicationsPage({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [page, setPage] = useState(1)
  const [viewTarget, setViewTarget] = useState<Affiliate | null>(null)
  const [approveTarget, setApproveTarget] = useState<Affiliate | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Affiliate | null>(null)
  const [loading, setLoading] = useState(false)
  const perPage = 10

  const pending = affiliates.filter(a => a.status === 'pending')
  const filtered = pending.filter(a => {
    if (filterType && a.type !== filterType) return false
    if (filterRisk === 'high' && a.fraudScore < 30) return false
    if (filterRisk === 'low' && a.fraudScore >= 30) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.handle.includes(search)) return false
    return true
  })

  const total = filtered.length
  const rows = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const kpis = [
    { label: 'Total Applications', value: pending.length,                                           color: '#1664FF' },
    { label: 'Pending Review',     value: pending.length,                                           color: '#B54708', sub: 'Awaiting admin decision' },
    { label: 'Approved This Month',value: affiliates.filter(a => a.status === 'active').length,     color: '#059669', sub: 'Dec 2024' },
    { label: 'Rejection Rate',     value: `${Math.round(affiliates.filter(a=>a.status==='rejected').length / affiliates.length * 100)}%`, color: '#DC2626', sub: 'Lifetime avg' },
  ]

  const verifLabel = (score: number) => score >= 60 ? 'High Risk' : score >= 20 ? 'Needs Review' : 'Low Risk'
  const verifColor = (score: number) => score >= 60 ? '#DC2626' : score >= 20 ? '#D97706' : '#059669'
  const verifBg = (score: number) => score >= 60 ? '#FFF1F3' : score >= 20 ? '#FFFAEB' : '#ECFDF3'

  function handleApprove() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setApproveTarget(null); showToast('success', 'Application Approved', `${approveTarget?.name} is now an active affiliate.`) }, 800)
  }
  function handleReject() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setRejectTarget(null); showToast('info', 'Application Rejected', `${rejectTarget?.name} has been notified by email.`) }, 800)
  }

  return (
    <PageShell breadcrumb="Affiliate & Influencer"
      title="Affiliate Applications" subtitle="Review and process incoming affiliate partnership applications"
      actions={
        <button className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          onClick={() => showToast('info', 'Export', 'Application list exported.')}>
          <Download size={13} /> Export
        </button>
      }
      kpis={kpis}
      search={
        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search applicant name or handle…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Types</option><option value="influencer">Influencer</option><option value="blogger">Blogger</option>
            <option value="kol">KOL</option><option value="ota_partner">OTA Partner</option><option value="corporate">Corporate</option>
          </select>
          <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Risk Levels</option><option value="high">High Risk</option><option value="low">Low Risk</option>
          </select>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} applications</span>
        </div>
      }>
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Applicant', 'Type', 'Platform', 'Followers', 'Proposed Commission', 'Submitted', 'Verification', 'Risk Score', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-3" style={{ height: 48 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{a.handle}</div>
                </td>
                <td className="px-3"><TypeBadge type={a.type} /></td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569' }}>{a.platform}</td>
                <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>
                  {a.followers > 0 ? (a.followers >= 1_000_000 ? `${(a.followers/1_000_000).toFixed(1)}M` : `${(a.followers/1000).toFixed(0)}K`) : '—'}
                </td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569' }}>{a.commissionRate}%</td>
                <td className="px-3" style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{a.joinDate}</td>
                <td className="px-3">
                  <span className="inline-flex items-center rounded px-1.5 font-medium"
                    style={{ fontSize: 11, background: verifBg(a.fraudScore), color: verifColor(a.fraudScore), height: 20 }}>
                    {verifLabel(a.fraudScore)}
                  </span>
                </td>
                <td className="px-3"><FraudBar score={a.fraudScore} /></td>
                <td className="px-3"><StatusBadge status={a.status} /></td>
                <td className="px-3">
                  <div className="flex items-center gap-1">
                    <ActionBtn color="#1664FF" onClick={() => setViewTarget(a)} title="View application"><Eye size={12} /></ActionBtn>
                    <ActionBtn color="#059669" onClick={() => setApproveTarget(a)} title="Approve application"><CheckCircle size={12} /></ActionBtn>
                    <ActionBtn color="#DC2626" onClick={() => setRejectTarget(a)} title="Reject application"><XCircle size={12} /></ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, fontSize: 13, color: '#94A3B8' }}>No pending applications match your filters.</td></tr>
            )}
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

      {/* Application Detail Drawer */}
      <Drawer open={!!viewTarget} onClose={() => setViewTarget(null)} title={viewTarget?.name ?? ''} subtitle={`${viewTarget?.handle} · ${viewTarget?.platform}`} width={520}>
        {viewTarget && (
          <div className="space-y-4">
            <div className="flex items-start justify-between rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{viewTarget.name}</h3>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{viewTarget.handle} · {viewTarget.platform}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={viewTarget.status} />
                <TypeBadge type={viewTarget.type} />
              </div>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {[
                { label: 'Affiliate ID',        value: viewTarget.id,              mono: true },
                { label: 'Proposed Commission', value: `${viewTarget.commissionRate}%` },
                { label: 'Followers',           value: viewTarget.followers >= 1_000_000 ? `${(viewTarget.followers/1_000_000).toFixed(1)}M` : `${(viewTarget.followers/1000).toFixed(0)}K`, mono: true },
                { label: 'Platform',            value: viewTarget.platform },
                { label: 'Submitted Date',      value: viewTarget.joinDate, mono: true },
                { label: 'Risk Score',          value: `${viewTarget.fraudScore}/100` },
              ].map(f => (
                <div key={f.label} className="rounded px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
              <button onClick={() => { setViewTarget(null); setApproveTarget(viewTarget) }}
                className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
                style={{ height: 34, fontSize: 13, background: '#059669' }}>
                <CheckCircle size={13} /> Approve
              </button>
              <button onClick={() => { setViewTarget(null); setRejectTarget(viewTarget) }}
                className="flex items-center gap-1.5 rounded-md px-4 font-medium"
                style={{ height: 34, fontSize: 13, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
                <XCircle size={13} /> Reject
              </button>
            </div>
          </div>
        )}
      </Drawer>

      <Dialog open={!!approveTarget} onClose={() => setApproveTarget(null)} variant="success"
        title="Approve Affiliate Application"
        message={`Approve "${approveTarget?.name}" as a platform affiliate partner? They will gain access to the affiliate dashboard and start earning commissions.`}
        confirmLabel="Approve Application" onConfirm={handleApprove} loading={loading} />

      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} variant="danger"
        title="Reject Affiliate Application"
        message={`Reject the application from "${rejectTarget?.name}"? They will be notified by email with the option to reapply after 90 days.`}
        confirmLabel="Reject Application" onConfirm={handleReject} loading={loading} />
    </PageShell>
  )
}

// ── 2. Partner Directory ─────────────────────────────────────────────────────

type PartnerType = 'influencer' | 'business_affiliate' | 'user_referral'

interface PartnerRecord {
  id: string
  name: string
  handle: string
  partnerType: PartnerType
  affiliateType: string
  followers: number
  bookings: number
  revenue: number
  commissionRate: number
  status: string
  joinDate: string
  country: string
}

const partnerDirectory: PartnerRecord[] = [
  { id: 'P-001', name: 'TravelWithLily',     handle: '@travelwithlily',   partnerType: 'influencer',        affiliateType: 'influencer',  followers: 285000, bookings: 412, revenue: 2860000, commissionRate: 8,  status: 'active',    joinDate: '2024-01-15', country: 'CN' },
  { id: 'P-002', name: 'Jason Hotel Reviews', handle: '@jasonhotels',      partnerType: 'influencer',        affiliateType: 'kol',         followers: 142000, bookings: 287, revenue: 1950000, commissionRate: 7,  status: 'active',    joinDate: '2024-02-10', country: 'CN' },
  { id: 'P-003', name: 'AsiaHotelDeals',      handle: '@asiahoteldeals',   partnerType: 'business_affiliate', affiliateType: 'ota_partner',followers: 0,      bookings: 892, revenue: 7640000, commissionRate: 5,  status: 'active',    joinDate: '2023-11-01', country: 'SG' },
  { id: 'P-004', name: 'LuxuryHotelSeeker',  handle: '@luxhotelseeker',   partnerType: 'influencer',        affiliateType: 'influencer',  followers: 198000, bookings: 334, revenue: 4120000, commissionRate: 9,  status: 'active',    joinDate: '2024-03-05', country: 'HK' },
  { id: 'P-005', name: 'Corporate Travel Pro',handle: '@corptravel_pro',   partnerType: 'business_affiliate', affiliateType: 'corporate',  followers: 0,      bookings: 654, revenue: 5880000, commissionRate: 4,  status: 'active',    joinDate: '2023-09-20', country: 'CN' },
  { id: 'P-006', name: 'ResortFinder_CN',     handle: '@resortfindercn',   partnerType: 'influencer',        affiliateType: 'kol',         followers: 224000, bookings: 198, revenue: 1680000, commissionRate: 7,  status: 'active',    joinDate: '2024-04-12', country: 'CN' },
  { id: 'P-007', name: 'Wang Fang',           handle: '@wangfang_ref',     partnerType: 'user_referral',     affiliateType: 'blogger',     followers: 0,      bookings: 8,   revenue: 64000,   commissionRate: 3,  status: 'active',    joinDate: '2024-08-01', country: 'CN' },
  { id: 'P-008', name: 'Chen Mingzhi',        handle: '@mingzhi_ref',      partnerType: 'user_referral',     affiliateType: 'blogger',     followers: 0,      bookings: 5,   revenue: 41000,   commissionRate: 3,  status: 'active',    joinDate: '2024-09-14', country: 'CN' },
  { id: 'P-009', name: 'ShanghaiLifestyle',   handle: '@shanghailifestyle', partnerType: 'influencer',       affiliateType: 'kol',         followers: 176000, bookings: 221, revenue: 1920000, commissionRate: 7,  status: 'suspended', joinDate: '2024-01-28', country: 'CN' },
  { id: 'P-010', name: 'TravelNowCorp',        handle: '@travelnowcorp',    partnerType: 'business_affiliate', affiliateType: 'ota_partner',followers: 0,      bookings: 478, revenue: 4210000, commissionRate: 5,  status: 'active',    joinDate: '2023-12-01', country: 'CN' },
  { id: 'P-011', name: 'CityHopperMike',      handle: '@cityhoppermike',   partnerType: 'influencer',        affiliateType: 'influencer',  followers: 93000,  bookings: 145, revenue: 1150000, commissionRate: 6,  status: 'active',    joinDate: '2024-05-20', country: 'AU' },
  { id: 'P-012', name: 'Li Xueying',          handle: '@xueying_ref',      partnerType: 'user_referral',     affiliateType: 'blogger',     followers: 0,      bookings: 3,   revenue: 22000,   commissionRate: 3,  status: 'active',    joinDate: '2024-10-05', country: 'CN' },
]

const PARTNER_TYPE_META: Record<PartnerType, { bg: string; color: string; label: string }> = {
  influencer:        { bg: '#FFF1F3', color: '#BE123C', label: 'Influencer' },
  business_affiliate:{ bg: '#EFF6FF', color: '#1D4ED8', label: 'Business Affiliate' },
  user_referral:     { bg: '#F0FDF4', color: '#166534', label: 'User Referral' },
}

function PartnerDirectoryPage({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<PartnerType | ''>('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [viewTarget, setViewTarget] = useState<PartnerRecord | null>(null)
  const perPage = 10

  const filtered = partnerDirectory.filter(p => {
    if (filterType && p.partnerType !== filterType) return false
    if (filterStatus && p.status !== filterStatus) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.handle.includes(search)) return false
    return true
  })

  const total = filtered.length
  const rows = filtered.slice((page-1)*perPage, page*perPage)
  const totalPages = Math.max(1, Math.ceil(total/perPage))

  const kpis = [
    { label: 'Total Partners',   value: partnerDirectory.length,                                                               color: '#1664FF' },
    { label: 'Influencers',      value: partnerDirectory.filter(p => p.partnerType === 'influencer').length,                  color: '#BE123C', sub: 'Creators & KOLs' },
    { label: 'Business Affiliates', value: partnerDirectory.filter(p => p.partnerType === 'business_affiliate').length,        color: '#1D4ED8', sub: 'OTA & Corporate' },
    { label: 'User Referrals',   value: partnerDirectory.filter(p => p.partnerType === 'user_referral').length,               color: '#166534', sub: 'App referrers' },
    { label: 'Total Revenue',    value: `¥${(partnerDirectory.reduce((s,p) => s+p.revenue, 0) / 1_000_000).toFixed(1)}M`,    color: '#D97706', sub: 'Attributed' },
  ]

  return (
    <PageShell breadcrumb="Affiliate & Influencer"
      title="Partner Directory" subtitle="Unified directory of influencers, business affiliates, and user referrers"
      actions={<>
        <button className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          onClick={() => showToast('info', 'Export', 'Partner directory exported.')}>
          <Download size={13} /> Export
        </button>
      </>}
      kpis={kpis}
      search={
        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search partner name or handle…"
            className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
          <select value={filterType} onChange={e => { setFilterType(e.target.value as PartnerType | ''); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Partner Types</option>
            <option value="influencer">Influencers</option>
            <option value="business_affiliate">Business Affiliates</option>
            <option value="user_referral">User Referrals</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option><option value="suspended">Suspended</option>
          </select>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} partners</span>
        </div>
      }>
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Partner', 'Type', 'Followers', 'Bookings', 'Revenue', 'Commission Rate', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const ptm = PARTNER_TYPE_META[p.partnerType]
              return (
                <tr key={p.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-3" style={{ height: 56 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.handle}</div>
                  </td>
                  <td className="px-3">
                    <span className="inline-flex items-center rounded px-1.5 font-medium"
                      style={{ fontSize: 11, background: ptm.bg, color: ptm.color, height: 20 }}>{ptm.label}</span>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
                    {p.followers > 0 ? p.followers.toLocaleString() : '—'}
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{p.bookings.toLocaleString()}</td>
                  <td className="px-3" style={{ fontSize: 13, fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                    ¥{(p.revenue / 1000).toFixed(0)}K
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{p.commissionRate}%</td>
                  <td className="px-3"><StatusBadge status={p.status} /></td>
                  <td className="px-3" style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{p.joinDate}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn color="#1664FF" onClick={() => setViewTarget(p)} title="View partner"><Eye size={12} /></ActionBtn>
                      <MoreMenu items={[
                        { label: 'View Profile', icon: <Eye size={13} />, onClick: () => setViewTarget(p) },
                        { label: 'Send Message', icon: <Mail size={13} />, onClick: () => showToast('info', 'Message', `Opening message to ${p.name}`) },
                        ...(p.status === 'active'
                          ? [{ label: 'Suspend Partner', icon: <Ban size={13} />, color: '#DC2626', divider: true, onClick: () => showToast('warning', 'Partner Suspended', p.name) }]
                          : [{ label: 'Restore Partner', icon: <RotateCcw size={13} />, color: '#059669', divider: true, onClick: () => showToast('success', 'Partner Restored', p.name) }]
                        ),
                      ]} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, fontSize: 13, color: '#94A3B8' }}>No partners match your filters.</td></tr>
            )}
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

      <Drawer open={!!viewTarget} onClose={() => setViewTarget(null)} title={viewTarget?.name ?? ''} subtitle={`${viewTarget?.handle} · Partner Profile`} width={480}>
        {viewTarget && (() => {
          const ptm = PARTNER_TYPE_META[viewTarget.partnerType]
          return (
            <div className="space-y-4">
              <div className="rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: ptm.bg, color: ptm.color, height: 20 }}>{ptm.label}</span>
                  <StatusBadge status={viewTarget.status} />
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {[
                    { label: 'Partner ID',       value: viewTarget.id,            mono: true },
                    { label: 'Country',          value: viewTarget.country },
                    { label: 'Followers',        value: viewTarget.followers > 0 ? viewTarget.followers.toLocaleString() : 'N/A', mono: true },
                    { label: 'Commission Rate',  value: `${viewTarget.commissionRate}%`, mono: true },
                    { label: 'Join Date',        value: viewTarget.joinDate,      mono: true },
                    { label: 'Affiliate Type',   value: viewTarget.affiliateType },
                  ].map(f => (
                    <div key={f.label} className="rounded px-3 py-2" style={{ background: '#fff', border: '1px solid #F1F5F9' }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                      <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                {[
                  { label: 'Bookings', value: viewTarget.bookings.toLocaleString(), color: '#1664FF' },
                  { label: 'Revenue',  value: `¥${(viewTarget.revenue / 1000).toFixed(0)}K`, color: '#059669' },
                  { label: 'Comm. Rate', value: `${viewTarget.commissionRate}%`, color: '#D97706' },
                ].map(k => (
                  <div key={k.label} className="rounded px-3 py-3 text-center" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                <button onClick={() => showToast('info', 'Message', `Opening message to ${viewTarget.name}`)}
                  className="flex items-center gap-1.5 rounded-md px-4 font-medium"
                  style={{ height: 34, fontSize: 13, color: '#1664FF', border: '1px solid #BFDBFE', background: '#EFF6FF' }}>
                  <Send size={13} /> Send Message
                </button>
              </div>
            </div>
          )
        })()}
      </Drawer>
    </PageShell>
  )
}


// ── 3. Reward Wallet ───────────────────────────────────────────────────────────

function WalletStatusBadge({ status }: { status: WalletStatus }) {
  const S: Record<WalletStatus, { color: string; bg: string; dot: string }> = {
    Pending:   { color: '#B45309', bg: '#FFFBEB', dot: '#D97706' },
    Credited:  { color: '#027A48', bg: '#ECFDF3', dot: '#059669' },
    Redeemed:  { color: '#0369A1', bg: '#EFF8FF', dot: '#0EA5E9' },
    Expired:   { color: '#64748B', bg: '#F1F5F9', dot: '#94A3B8' },
    Cancelled: { color: '#C01048', bg: '#FFF1F3', dot: '#DC2626' },
  }
  const s = S[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5" style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, height: 20 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  )
}

function WalletTxTypeBadge({ type }: { type: WalletTxType }) {
  const S: Record<WalletTxType, { color: string; bg: string }> = {
    'Reward Earned':    { color: '#059669', bg: '#ECFDF3' },
    'Reward Redeemed':  { color: '#7C3AED', bg: '#EDE9FE' },
    'Reward Expired':   { color: '#64748B', bg: '#F1F5F9' },
    'Manual Credit':    { color: '#0369A1', bg: '#EFF8FF' },
    'Manual Deduction': { color: '#C2410C', bg: '#FFF7ED' },
    'Adjustment':       { color: '#475569', bg: '#F8FAFC' },
  }
  const s = S[type]
  return <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 20 }}>{type}</span>
}

function WalletRewardTypeBadge({ type }: { type: WalletRewardType }) {
  const S: Record<WalletRewardType, { color: string; bg: string }> = {
    'Travel Credits': { color: '#0369A1', bg: '#EFF8FF' },
    'Reward Points':  { color: '#F59E0B', bg: '#FFFBEB' },
    'Coupon':         { color: '#EC4899', bg: '#FDF2F8' },
    'Voucher':        { color: '#6366F1', bg: '#EEF2FF' },
  }
  const s = S[type]
  return <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 20 }}>{type}</span>
}

function WalletAmountDisplay({ tx }: { tx: WalletTransaction }) {
  const isDebit = tx.transactionType === 'Reward Redeemed' || tx.transactionType === 'Reward Expired' || tx.transactionType === 'Manual Deduction'
  const color = isDebit ? '#DC2626' : '#059669'
  const prefix = isDebit ? '–' : '+'
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color, fontFamily: 'monospace' }}>
        {prefix}{tx.amount.toLocaleString()} <span style={{ fontSize: 11 }}>{tx.unit}</span>
      </div>
    </div>
  )
}

function WalletTimeline({ timeline }: { timeline: WalletTransaction['timeline'] }) {
  return (
    <div className="flex flex-col gap-0">
      {timeline.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              background: step.done ? '#1664FF' : '#F1F5F9',
              border: `2px solid ${step.done ? '#1664FF' : '#E3E8F0'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {step.done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
            </div>
            {i < timeline.length - 1 && <div style={{ width: 1, height: 24, background: '#E3E8F0', marginTop: 2 }} />}
          </div>
          <div style={{ paddingBottom: i < timeline.length - 1 ? 8 : 0 }}>
            <div style={{ fontSize: 12, fontWeight: step.done ? 600 : 400, color: step.done ? '#1A2332' : '#94A3B8' }}>{step.label}</div>
            <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{step.time}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RewardWalletPage({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch]         = useState('')
  const [sourceFilter, setSource]   = useState('')
  const [txTypeFilter, setTxType]   = useState('')
  const [rwTypeFilter, setRwType]   = useState('')
  const [statusFilter, setStatus]   = useState('')
  const [page, setPage]             = useState(1)
  const [drawerTx, setDrawerTx]     = useState<WalletTransaction | null>(null)
  const [creditModal, setCreditModal] = useState<WalletTransaction | null>(null)
  const [loading, setLoading]       = useState(false)
  const PAGE_SIZE = 8

  const filtered = WALLET_TRANSACTIONS.filter(tx => {
    const q = search.toLowerCase()
    if (q && ![tx.id, tx.userName, tx.userId, tx.referralCode, tx.campaign].some(v => v.toLowerCase().includes(q))) return false
    if (sourceFilter && tx.rewardSource !== sourceFilter) return false
    if (txTypeFilter && tx.transactionType !== txTypeFilter) return false
    if (rwTypeFilter && tx.rewardType !== rwTypeFilter) return false
    if (statusFilter && tx.status !== statusFilter) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // KPI calculations
  const totalBalance  = WALLET_TRANSACTIONS.filter(tx => tx.status === 'Credited').reduce((s, tx) => s + (tx.transactionType === 'Reward Earned' || tx.transactionType === 'Manual Credit' || tx.transactionType === 'Adjustment' ? tx.amount : -tx.amount), 0)
  const pendingPts    = WALLET_TRANSACTIONS.filter(tx => tx.status === 'Pending').reduce((s, tx) => s + tx.amount, 0)
  const totalCredited = WALLET_TRANSACTIONS.filter(tx => tx.transactionType === 'Reward Earned' || tx.transactionType === 'Manual Credit').reduce((s, tx) => s + tx.amount, 0)
  const totalRedeemed = WALLET_TRANSACTIONS.filter(tx => tx.transactionType === 'Reward Redeemed').reduce((s, tx) => s + tx.amount, 0)
  const totalExpired  = WALLET_TRANSACTIONS.filter(tx => tx.status === 'Expired').reduce((s, tx) => s + tx.amount, 0)

  function handleCredit() {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setCreditModal(null)
      showToast('success', 'Rewards Credited', `Reward successfully credited to ${creditModal?.userName}.`)
    }, 700)
  }

  const kpis = [
    { label: 'Total Reward Balance',   value: `${Math.round(totalBalance / 1000)}K pts`,  color: '#1664FF' },
    { label: 'Pending Rewards',        value: `${pendingPts.toLocaleString()} pts`,        color: '#D97706' },
    { label: 'Total Credited',         value: `${Math.round(totalCredited / 1000)}K`,      color: '#059669' },
    { label: 'Total Redeemed',         value: `${(totalRedeemed / 1000).toFixed(1)}K`,     color: '#7C3AED' },
    { label: 'Expired Rewards',        value: totalExpired.toLocaleString(),               color: '#94A3B8' },
  ]

  return (
    <PageShell breadcrumb="Affiliate & Influencer"
      title="Reward Wallet" subtitle="Non-cash reward balances for affiliates and referral campaigns — no cash payouts"
      actions={
        <button onClick={() => showToast('info', 'Export', 'Wallet history exported.')}
          className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export History
        </button>
      }
      kpis={kpis}
      search={
        <div className="flex items-center gap-3 rounded-lg px-4 py-2.5 mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <Search size={13} color="#94A3B8" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name, user ID, wallet Tx ID, referral code, campaign…"
            className="flex-1 bg-transparent outline-none" style={{ fontSize: 13, color: '#1A2332' }} />
          <div style={{ width: 1, height: 18, background: '#E3E8F0' }} />
          <select value={sourceFilter} onChange={e => { setSource(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Sources</option>
            {(['Referral Campaign','Referral Bonus','Booking Reward','Promotional Campaign','Manual Adjustment','System Reward'] as WalletRewardSource[]).map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={txTypeFilter} onChange={e => { setTxType(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Tx Types</option>
            {(['Reward Earned','Reward Redeemed','Reward Expired','Manual Credit','Manual Deduction','Adjustment'] as WalletTxType[]).map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={rwTypeFilter} onChange={e => { setRwType(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Reward Types</option>
            {(['Travel Credits','Reward Points','Coupon','Voucher'] as WalletRewardType[]).map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
            <option value="">All Statuses</option>
            {(['Pending','Credited','Redeemed','Expired','Cancelled'] as WalletStatus[]).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      }>

      {/* Policy notice */}
      <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 mb-5" style={{ background: '#EFF8FF', border: '1px solid #BAE6FD' }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
        <span style={{ fontSize: 12, color: '#0369A1' }}>
          Reward Wallet stores <strong>non-cash rewards only</strong>. Rewards cannot be withdrawn as cash or transferred to bank accounts.
          Users may redeem rewards within the mTrip ecosystem for hotel bookings, vouchers, coupons, or future platform benefits.
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { label: 'Total Reward Balance',   value: `${(totalBalance / 1000).toFixed(0)}K pts`,       color: '#1664FF' },
          { label: 'Pending Rewards',        value: `${pendingPts.toLocaleString()} pts`,              color: '#D97706' },
          { label: 'Total Rewards Credited', value: `${(totalCredited / 1000).toFixed(0)}K`,           color: '#059669' },
          { label: 'Total Rewards Redeemed', value: `${(totalRedeemed / 1000).toFixed(1)}K`,           color: '#7C3AED' },
          { label: 'Expired Rewards',        value: `${totalExpired.toLocaleString()}`,                color: '#94A3B8' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 500 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Wallet Tx ID', 'User', 'Reward Source', 'Campaign', 'Tx Type', 'Reward Type', 'Amount', 'Balance After', 'Status', 'Date', 'Actions'].map(h => (
                <th key={h} style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textAlign: 'left', padding: '10px 14px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((tx, i) => (
              <tr key={tx.id} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1664FF', fontWeight: 600, whiteSpace: 'nowrap' }}>{tx.id}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{tx.userName}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{tx.userId} · {tx.userHandle}</div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>{tx.rewardSource}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748B', maxWidth: 160 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.campaign}>{tx.campaign}</div>
                </td>
                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><WalletTxTypeBadge type={tx.transactionType} /></td>
                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><WalletRewardTypeBadge type={tx.rewardType} /></td>
                <td style={{ padding: '12px 14px' }}><WalletAmountDisplay tx={tx} /></td>
                <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1A2332', textAlign: 'right' }}>{tx.balanceAfter.toLocaleString()}</td>
                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><WalletStatusBadge status={tx.status} /></td>
                <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{tx.timestamp}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setDrawerTx(tx)} title="View Details"
                      className="flex items-center justify-center rounded-md"
                      style={{ width: 28, height: 28, color: '#1664FF', background: '#EEF4FF' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#DBEAFE')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#EEF4FF')}>
                      <Eye size={13} />
                    </button>
                    <button onClick={() => setCreditModal(tx)} title="Credit Rewards"
                      className="flex items-center justify-center rounded-md"
                      style={{ width: 28, height: 28, color: '#059669', background: '#ECFDF3' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#D1FAE5')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#ECFDF3')}>
                      <PlusCircle size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, fontSize: 13, color: '#94A3B8' }}>No transactions match the selected filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between" style={{ fontSize: 12, color: '#94A3B8' }}>
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} transactions</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center justify-center rounded-md"
              style={{ width: 30, height: 30, border: '1px solid #E3E8F0', background: page === 1 ? '#F8FAFC' : '#fff', color: page === 1 ? '#CBD5E1' : '#475569' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ padding: '0 12px', fontWeight: 500, color: '#1A2332' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center justify-center rounded-md"
              style={{ width: 30, height: 30, border: '1px solid #E3E8F0', background: page === totalPages ? '#F8FAFC' : '#fff', color: page === totalPages ? '#CBD5E1' : '#475569' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer open={!!drawerTx} onClose={() => setDrawerTx(null)}
        title={drawerTx?.id ?? ''}
        subtitle={drawerTx ? `${drawerTx.transactionType} · ${drawerTx.timestamp}` : ''}
        width={520}
        footer={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => showToast('info', 'View Profile', `Opening profile for ${drawerTx?.userName}.`)}
              className="flex items-center gap-1.5 rounded-md px-3 text-sm font-medium"
              style={{ height: 32, fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
              View User Profile
            </button>
            {drawerTx?.campaign && drawerTx.campaign !== '—' && (
              <button onClick={() => showToast('info', 'View Campaign', `Opening campaign: ${drawerTx?.campaign}.`)}
                className="flex items-center gap-1.5 rounded-md px-3"
                style={{ height: 32, fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
                View Referral Campaign
              </button>
            )}
            {drawerTx?.associatedBookingId && (
              <button onClick={() => showToast('info', 'View Booking', `Opening booking ${drawerTx?.associatedBookingId}.`)}
                className="flex items-center gap-1.5 rounded-md px-3"
                style={{ height: 32, fontSize: 12, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}>
                View Booking
              </button>
            )}
            <button onClick={() => showToast('info', 'Export', `Wallet history for ${drawerTx?.userName} exported.`)}
              className="flex items-center gap-1.5 rounded-md px-3"
              style={{ height: 32, fontSize: 12, color: '#1664FF', border: '1px solid #BFDBFE', background: '#EEF4FF' }}>
              Export History
            </button>
          </div>
        }>
        {drawerTx && (
          <div className="flex flex-col gap-5 p-4">
            {/* User Info */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '1px solid #F1F5F9', marginBottom: 12 }}>User Information</div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[
                  { label: 'User Name',     value: drawerTx.userName },
                  { label: 'User ID',       value: drawerTx.userId, mono: true },
                  { label: 'Handle',        value: drawerTx.userHandle, mono: true },
                  { label: 'Referral Code', value: drawerTx.referralCode, mono: true },
                  { label: 'Current Balance', value: `${drawerTx.currentBalance.toLocaleString()} pts` },
                ].map(d => (
                  <div key={d.label}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{d.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332', fontFamily: d.mono ? 'monospace' : 'inherit' }}>{d.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction Info */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '1px solid #F1F5F9', marginBottom: 12 }}>Transaction Information</div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Wallet Transaction ID</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1664FF', fontFamily: 'monospace' }}>{drawerTx.id}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Campaign Name</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{drawerTx.campaign}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Reward Source</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{drawerTx.rewardSource}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Transaction Type</div>
                  <WalletTxTypeBadge type={drawerTx.transactionType} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Reward Type</div>
                  <WalletRewardTypeBadge type={drawerTx.rewardType} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Amount</div>
                  <WalletAmountDisplay tx={drawerTx} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Balance Before</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332', fontFamily: 'monospace' }}>{drawerTx.balanceBefore.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Balance After</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332', fontFamily: 'monospace' }}>{drawerTx.balanceAfter.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Status</div>
                  <WalletStatusBadge status={drawerTx.status} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Date & Time</div>
                  <div style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{drawerTx.timestamp}</div>
                </div>
              </div>
            </div>

            {/* Reward Info */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '1px solid #F1F5F9', marginBottom: 12 }}>Reward Information</div>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Expiry Date</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: drawerTx.expiryDate ? '#D97706' : '#94A3B8' }}>{drawerTx.expiryDate ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Associated Booking</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: drawerTx.associatedBookingId ? '#1664FF' : '#94A3B8', fontFamily: 'monospace' }}>{drawerTx.associatedBookingId ?? '—'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Associated Referral</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{drawerTx.associatedReferral ?? '—'}</div>
                </div>
                {drawerTx.redemptionNote && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>Redemption / Adjustment Note</div>
                    <div style={{ fontSize: 12, color: '#475569', background: '#F8FAFC', padding: '8px 10px', borderRadius: 6, border: '1px solid #F1F5F9' }}>{drawerTx.redemptionNote}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 8, borderBottom: '1px solid #F1F5F9', marginBottom: 12 }}>Transaction Timeline</div>
              <WalletTimeline timeline={drawerTx.timeline} />
            </div>
          </div>
        )}
      </Drawer>

      {/* Credit Rewards Dialog */}
      <Dialog open={!!creditModal} onClose={() => setCreditModal(null)} variant="confirm"
        title="Credit Rewards"
        message={`Manually credit rewards to ${creditModal?.userName} (${creditModal?.userId}). This action will be logged in the audit trail.`}
        confirmLabel="Credit Rewards" onConfirm={handleCredit} loading={loading} />

    </PageShell>
  )
}

// ── 5. Fraud & Compliance ────────────────────────────────────────────────────

type FraudRuleAction = 'allow' | 'flag' | 'block'

interface FraudRule {
  id: string
  name: string
  description: string
  action: FraudRuleAction
  enabled: boolean
}

const INITIAL_FRAUD_RULES: FraudRule[] = [
  { id: 'same_ip',       name: 'Same IP Referral',          description: 'Referrer and referred share the same IP address',                action: 'flag',  enabled: true },
  { id: 'same_device',   name: 'Same Device Fingerprint',   description: 'Multiple accounts traced to a single device',                    action: 'block', enabled: true },
  { id: 'self_referral', name: 'Self-Referral',             description: 'Affiliate uses own referral code or link',                       action: 'block', enabled: true },
  { id: 'dup_phone',     name: 'Duplicate Phone/Email',     description: 'New account matches existing account phone or email',             action: 'flag',  enabled: true },
  { id: 'max_accounts',  name: 'Max Accounts per Device',   description: 'More than 3 accounts registered from a single device',           action: 'block', enabled: true },
  { id: 'max_referrals', name: 'Max Referrals per Day',     description: 'Affiliate generates more than 50 referrals in 24 hours',         action: 'flag',  enabled: false },
  { id: 'reward_hold',   name: 'Reward Hold Period',        description: 'Reward is held for 7 days after stay completion before payout',  action: 'allow', enabled: true },
  { id: 'vpn_proxy',     name: 'VPN / Proxy Detection',     description: 'Traffic routed through known VPN or proxy servers',              action: 'flag',  enabled: true },
]

function FraudCompliancePage({ showToast }: { showToast: Props['showToast'] }) {
  const [activeTab, setActiveTab] = useState<'queue' | 'rules'>('queue')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [page, setPage] = useState(1)
  const [viewTarget, setViewTarget] = useState<FraudCase | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<FraudCase | null>(null)
  const [loading, setLoading] = useState(false)
  const [rules, setRules] = useState<FraudRule[]>(INITIAL_FRAUD_RULES)
  const perPage = 10

  const filtered = fraudCases.filter(f => {
    if (filterStatus && f.investigationStatus !== filterStatus) return false
    if (filterRisk && f.riskLevel !== filterRisk) return false
    if (search && !f.affiliateName.toLowerCase().includes(search.toLowerCase()) && !f.handle.includes(search)) return false
    return true
  })

  const total = filtered.length
  const rows = filtered.slice((page-1)*perPage, page*perPage)
  const totalPages = Math.max(1, Math.ceil(total/perPage))

  const kpis = [
    { label: 'Under Investigation', value: fraudCases.filter(f => f.investigationStatus === 'investigating' || f.investigationStatus === 'under_review').length, color: '#DC2626', sub: 'Active cases' },
    { label: 'High Risk',           value: fraudCases.filter(f => f.riskLevel === 'high').length,                                                                color: '#BE123C', sub: 'Score ≥ 60' },
    { label: 'Suspended',           value: fraudCases.filter(f => f.affiliateStatus === 'suspended').length,                                                     color: '#9A3412', sub: 'Accounts locked' },
    { label: 'Cases Resolved',      value: fraudCases.filter(f => f.investigationStatus === 'resolved' || f.investigationStatus === 'dismissed').length,          color: '#059669', sub: 'Closed this period' },
  ]

  const investigationBadge: Record<FraudInvestigationStatus, { bg: string; color: string; label: string }> = {
    investigating: { bg: '#FFF7ED', color: '#9A3412',  label: 'Investigating' },
    under_review:  { bg: '#FFFAEB', color: '#B54708',  label: 'Under Review' },
    resolved:      { bg: '#ECFDF3', color: '#027A48',  label: 'Resolved' },
    dismissed:     { bg: '#F1F5F9', color: '#475569',  label: 'Dismissed' },
  }

  const ruleActionColor: Record<FraudRuleAction, { bg: string; color: string; label: string }> = {
    allow: { bg: '#ECFDF3', color: '#027A48', label: 'Allow' },
    flag:  { bg: '#FFFAEB', color: '#B54708', label: 'Flag' },
    block: { bg: '#FFF1F3', color: '#BE123C', label: 'Block' },
  }

  return (
    <PageShell breadcrumb="Affiliate & Influencer"
      title="Fraud & Compliance" subtitle="Review suspicious affiliate activity and configure platform fraud detection rules"
      actions={
        <button className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          onClick={() => showToast('info', 'Export', 'Fraud & Compliance report exported.')}>
          <Download size={13} /> Export
        </button>
      }
      kpis={kpis}
      search={
        <div className="mb-4">
          {/* Sub-tabs */}
          <div className="flex gap-1 p-1 rounded-lg mb-4" style={{ background: '#F1F5F9', display: 'inline-flex' }}>
            {([['queue', 'Fraud Review Queue'], ['rules', 'Fraud Rules & Settings']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className="rounded-md px-4 font-medium transition-all"
                style={{ height: 32, fontSize: 13, background: activeTab === id ? '#fff' : 'transparent', color: activeTab === id ? '#1A2332' : '#64748B', boxShadow: activeTab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>
          {activeTab === 'queue' && (
            <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
              <Search size={13} color="#94A3B8" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search affiliate name or handle…"
                className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
              <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
                <option value="">All Risk Levels</option>
                <option value="high">High Risk</option><option value="medium">Medium Risk</option><option value="low">Low Risk</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
                <option value="">All Statuses</option>
                <option value="investigating">Investigating</option><option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
              </select>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} cases</span>
            </div>
          )}
        </div>
      }>

      {/* ── Fraud Review Queue ── */}
      {activeTab === 'queue' && (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                {['Affiliate', 'Risk Level', 'Referred User (Sample)', 'Detection Reason', 'Status', 'Reviewer', 'Detected', 'Actions'].map(h => (
                  <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => {
                const ib = investigationBadge[f.investigationStatus]
                return (
                  <tr key={f.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3" style={{ height: 56 }}>
                      <div className="flex items-center gap-1.5">
                        {f.riskLevel === 'high' && <AlertTriangle size={12} color="#DC2626" />}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{f.affiliateName}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{f.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3"><FraudBar score={f.fraudScore} /></td>
                    <td className="px-3">
                      <span className="inline-flex items-center rounded px-1.5 font-medium"
                        style={{ fontSize: 11, height: 20,
                          background: f.riskLevel === 'high' ? '#FFF1F3' : f.riskLevel === 'medium' ? '#FFFAEB' : '#F0FDF4',
                          color: f.riskLevel === 'high' ? '#BE123C' : f.riskLevel === 'medium' ? '#B54708' : '#166534' }}>
                        {f.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3" style={{ maxWidth: 240 }}>
                      <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {f.suspiciousActivity} — {f.evidenceSummary.slice(0, 80)}…
                      </div>
                    </td>
                    <td className="px-3">
                      <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: ib.bg, color: ib.color, height: 20 }}>
                        {ib.label}
                      </span>
                    </td>
                    <td className="px-3" style={{ fontSize: 12, color: '#475569' }}>{f.reviewer}</td>
                    <td className="px-3" style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace' }}>{f.detectionDate}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-1">
                        <ActionBtn color="#1664FF" onClick={() => setViewTarget(f)} title="View investigation"><Eye size={12} /></ActionBtn>
                        <MoreMenu items={[
                          { label: 'View Investigation', icon: <Eye size={13} />, onClick: () => setViewTarget(f) },
                          ...(f.affiliateStatus === 'active'
                            ? [{ label: 'Suspend Affiliate', icon: <Ban size={13} />, color: '#DC2626', onClick: () => setSuspendTarget(f) }]
                            : [{ label: 'Restore Affiliate', icon: <RotateCcw size={13} />, color: '#059669', onClick: () => showToast('success', 'Affiliate Restored', f.affiliateName) }]
                          ),
                          { label: 'Reject Appeal', icon: <XCircle size={13} />, color: '#9A3412', divider: true, onClick: () => showToast('warning', 'Appeal Rejected', `Appeal from ${f.affiliateName} has been denied.`) },
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
      )}

      {/* ── Fraud Rules & Settings ── */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <ShieldCheck size={14} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
              These rules are applied automatically to all new referrals and registration events. Changes take effect within 5 minutes. Flagged events are added to the Review Queue for manual inspection.
            </div>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
                  {['Rule', 'Description', 'Action', 'Enabled'].map(h => (
                    <th key={h} className="text-left px-4" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, i) => {
                  const ac = ruleActionColor[rule.action]
                  return (
                    <tr key={rule.id} style={{ borderBottom: i < rules.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4" style={{ height: 52, fontSize: 13, fontWeight: 600, color: '#1A2332', width: 220 }}>{rule.name}</td>
                      <td className="px-4" style={{ fontSize: 12, color: '#64748B', maxWidth: 320 }}>{rule.description}</td>
                      <td className="px-4">
                        <select value={rule.action}
                          onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, action: e.target.value as FraudRuleAction } : r))}
                          className="rounded px-2 outline-none font-medium"
                          style={{ height: 28, fontSize: 12, background: ac.bg, color: ac.color, border: `1px solid ${ac.color}22` }}>
                          <option value="allow">Allow</option>
                          <option value="flag">Flag</option>
                          <option value="block">Block</option>
                        </select>
                      </td>
                      <td className="px-4">
                        <button onClick={() => { setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r)); showToast('success', rule.enabled ? 'Rule Disabled' : 'Rule Enabled', rule.name) }}
                          style={{ width: 40, height: 22, borderRadius: 11, background: rule.enabled ? '#1664FF' : '#E3E8F0', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: rule.enabled ? 21 : 3, transition: 'left 0.2s' }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={() => showToast('success', 'Rules Saved', 'Fraud detection rules updated successfully.')}
              className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
              style={{ height: 34, fontSize: 13, background: '#1664FF' }}>
              Save Rules
            </button>
            <button onClick={() => { setRules(INITIAL_FRAUD_RULES); showToast('info', 'Rules Reset', 'Fraud rules reset to platform defaults.') }}
              className="rounded-md px-4 font-medium"
              style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* Investigation Detail Drawer */}
      <Drawer open={!!viewTarget} onClose={() => setViewTarget(null)} title={viewTarget?.affiliateName ?? ''} subtitle={`${viewTarget?.id} · Fraud Case`} width={560}>
        {viewTarget && (() => {
          const ib = investigationBadge[viewTarget.investigationStatus]
          return (
            <div className="space-y-4">
              {viewTarget.riskLevel === 'high' && (
                <div className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ background: '#FFF1F3', border: '1px solid #FECDD3' }}>
                  <ShieldAlert size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#BE123C' }}>High Fraud Risk — Immediate Action Required</div>
                    <div style={{ fontSize: 12, color: '#9F1239', marginTop: 2 }}>Fraud score: {viewTarget.fraudScore}/100. Account may require immediate suspension pending investigation.</div>
                  </div>
                </div>
              )}
              <div className="rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: ib.bg, color: ib.color, height: 20 }}>{ib.label}</span>
                  <FraudBar score={viewTarget.fraudScore} />
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {[
                    { label: 'Case ID',           value: viewTarget.id,              mono: true },
                    { label: 'Affiliate Status',  value: viewTarget.affiliateStatus },
                    { label: 'Risk Level',        value: viewTarget.riskLevel },
                    { label: 'Detected',          value: viewTarget.detectionDate,   mono: true },
                    { label: 'Reviewer',          value: viewTarget.reviewer },
                    { label: 'Suspicious Activity', value: viewTarget.suspiciousActivity },
                  ].map(f => (
                    <div key={f.label} className="rounded px-3 py-2" style={{ background: '#fff', border: '1px solid #F1F5F9' }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                      <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Evidence Summary</div>
                <div className="rounded-lg px-4 py-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 13, color: '#78350F', lineHeight: 1.7 }}>
                  {viewTarget.evidenceSummary}
                </div>
              </div>
              {viewTarget.affiliateStatus === 'active' && (
                <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                  <button onClick={() => { setViewTarget(null); setSuspendTarget(viewTarget) }}
                    className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
                    style={{ height: 34, fontSize: 13, background: '#DC2626' }}>
                    <Ban size={13} /> Suspend Affiliate
                  </button>
                  <button onClick={() => { setViewTarget(null); showToast('info', 'Case Dismissed', `Case against ${viewTarget.affiliateName} marked as dismissed.`) }}
                    className="flex items-center gap-1.5 rounded-md px-4 font-medium"
                    style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>
                    <ShieldCheck size={13} /> Dismiss Case
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </Drawer>

      <Dialog open={!!suspendTarget} onClose={() => setSuspendTarget(null)} variant="danger"
        title="Suspend Affiliate for Fraud"
        message={`Suspend "${suspendTarget?.affiliateName}" (fraud score: ${suspendTarget?.fraudScore}/100)? Their account will be locked, referral links disabled, and pending earnings frozen.`}
        confirmLabel="Suspend & Lock Account"
        onConfirm={() => { setLoading(true); setTimeout(() => { setLoading(false); setSuspendTarget(null); showToast('warning', 'Affiliate Suspended', `${suspendTarget?.affiliateName} has been suspended for fraud.`) }, 800) }}
        loading={loading} />
    </PageShell>
  )
}


// ── 4. Affiliate Program ─────────────────────────────────────────────────────

type TriggerType = 'registration' | 'completed_payment' | 'completed_stay'
type RewardTarget = 'referrer' | 'referee' | 'both'

interface CommissionRule {
  id: string; name: string; affiliateType: string; rate: number; minBookingValue: number; enabled: boolean
}
interface RewardRule {
  id: string; trigger: TriggerType; target: RewardTarget; rewardType: string; rewardValue: number; enabled: boolean
}

const INITIAL_COMMISSION_RULES: CommissionRule[] = [
  { id: 'CR-001', name: 'Influencer Standard',   affiliateType: 'influencer',   rate: 8,  minBookingValue: 500,   enabled: true },
  { id: 'CR-002', name: 'KOL Premium',           affiliateType: 'kol',          rate: 10, minBookingValue: 1000,  enabled: true },
  { id: 'CR-003', name: 'OTA Partner',           affiliateType: 'ota_partner',  rate: 5,  minBookingValue: 0,     enabled: true },
  { id: 'CR-004', name: 'Corporate Partner',     affiliateType: 'corporate',    rate: 4,  minBookingValue: 2000,  enabled: true },
  { id: 'CR-005', name: 'Blogger Standard',      affiliateType: 'blogger',      rate: 6,  minBookingValue: 300,   enabled: true },
  { id: 'CR-006', name: 'User Referral',         affiliateType: 'user_referral',rate: 3,  minBookingValue: 200,   enabled: true },
]

const INITIAL_REWARD_RULES: RewardRule[] = [
  { id: 'RR-001', trigger: 'registration',      target: 'referee',  rewardType: 'credits', rewardValue: 50,  enabled: true },
  { id: 'RR-002', trigger: 'completed_payment', target: 'referrer', rewardType: 'credits', rewardValue: 100, enabled: true },
  { id: 'RR-003', trigger: 'completed_stay',    target: 'both',     rewardType: 'cashback',rewardValue: 5,   enabled: false },
]

function AffiliateProgramPage({ showToast }: { showToast: Props['showToast'] }) {
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>(INITIAL_COMMISSION_RULES)
  const [rewardRules, setRewardRules] = useState<RewardRule[]>(INITIAL_REWARD_RULES)
  const [referralExpiry, setReferralExpiry] = useState('30')
  const [minBooking, setMinBooking] = useState('200')
  const [maxReferralsDay, setMaxReferralsDay] = useState('50')
  const [rewardHoldDays, setRewardHoldDays] = useState('7')
  const [attributionWindow, setAttributionWindow] = useState('14')
  const [maxInvitationsPerUser, setMaxInvitationsPerUser] = useState('10')
  const [maxRewardsPerUser, setMaxRewardsPerUser] = useState('5')
  const [bookingCompletionRequired, setBookingCompletionRequired] = useState(true)

  const triggerLabels: Record<TriggerType, string> = {
    registration:      'User Registration',
    completed_payment: 'Completed Payment',
    completed_stay:    'Completed Stay',
  }
  const targetLabels: Record<RewardTarget, string> = {
    referrer: 'Referrer Only', referee: 'Referee Only', both: 'Both Parties',
  }

  const kpis = [
    { label: 'Commission Rules',  value: commissionRules.filter(r => r.enabled).length,  color: '#1664FF', sub: 'Active rules' },
    { label: 'Reward Rules',      value: rewardRules.filter(r => r.enabled).length,       color: '#059669', sub: 'Active rewards' },
    { label: 'Referral Expiry',   value: `${referralExpiry} days`,                        color: '#D97706', sub: 'Attribution window' },
    { label: 'Min. Booking',      value: `¥${minBooking}`,                                color: '#7C3AED', sub: 'For commission eligibility' },
  ]

  return (
    <PageShell breadcrumb="Affiliate & Influencer"
      title="Affiliate Program" subtitle="Configure commission rules, reward triggers, referral conditions, and payout policies"
      actions={
        <button onClick={() => showToast('success', 'Program Saved', 'Affiliate program configuration updated.')}
          className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
          style={{ height: 34, fontSize: 13, background: '#1664FF' }}>
          Save All Changes
        </button>
      }
      kpis={kpis}
      search={<div />}>
      <div className="space-y-5">

        {/* Commission Rules */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>Commission Rules</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Commission rate applied per affiliate type upon booking completion</div>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                {['Rule Name', 'Affiliate Type', 'Commission Rate (%)', 'Min. Booking Value (¥)', 'Enabled'].map(h => (
                  <th key={h} className="text-left px-4" style={{ height: 34, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commissionRules.map((rule, i) => (
                <tr key={rule.id} style={{ borderBottom: i < commissionRules.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td className="px-4" style={{ height: 48, fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{rule.name}</td>
                  <td className="px-4">
                    <TypeBadge type={rule.affiliateType as any} />
                  </td>
                  <td className="px-4">
                    <input type="number" min={0} max={30} value={rule.rate}
                      onChange={e => setCommissionRules(prev => prev.map(r => r.id === rule.id ? { ...r, rate: Number(e.target.value) } : r))}
                      className="rounded px-2" style={{ width: 72, height: 30, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332', textAlign: 'center', fontFamily: 'monospace' }} />
                    <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 4 }}>%</span>
                  </td>
                  <td className="px-4">
                    <input type="number" min={0} value={rule.minBookingValue}
                      onChange={e => setCommissionRules(prev => prev.map(r => r.id === rule.id ? { ...r, minBookingValue: Number(e.target.value) } : r))}
                      className="rounded px-2" style={{ width: 90, height: 30, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332', fontFamily: 'monospace' }} />
                  </td>
                  <td className="px-4">
                    <button onClick={() => setCommissionRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                      style={{ width: 40, height: 22, borderRadius: 11, background: rule.enabled ? '#1664FF' : '#E3E8F0', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: rule.enabled ? 21 : 3, transition: 'left 0.2s' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reward Rules */}
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>Reward Rules</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Rewards issued automatically based on referral event triggers</div>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                {['Reward Trigger', 'Reward Target', 'Reward Type', 'Value', 'Enabled'].map(h => (
                  <th key={h} className="text-left px-4" style={{ height: 34, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rewardRules.map((rule, i) => (
                <tr key={rule.id} style={{ borderBottom: i < rewardRules.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td className="px-4" style={{ height: 48 }}>
                    <select value={rule.trigger} onChange={e => setRewardRules(prev => prev.map(r => r.id === rule.id ? { ...r, trigger: e.target.value as TriggerType } : r))}
                      className="rounded px-2 outline-none" style={{ height: 30, fontSize: 12, border: '1px solid #E3E8F0', color: '#1A2332', background: '#fff' }}>
                      {(Object.keys(triggerLabels) as TriggerType[]).map(t => <option key={t} value={t}>{triggerLabels[t]}</option>)}
                    </select>
                  </td>
                  <td className="px-4">
                    <select value={rule.target} onChange={e => setRewardRules(prev => prev.map(r => r.id === rule.id ? { ...r, target: e.target.value as RewardTarget } : r))}
                      className="rounded px-2 outline-none" style={{ height: 30, fontSize: 12, border: '1px solid #E3E8F0', color: '#1A2332', background: '#fff' }}>
                      {(Object.keys(targetLabels) as RewardTarget[]).map(t => <option key={t} value={t}>{targetLabels[t]}</option>)}
                    </select>
                  </td>
                  <td className="px-4">
                    <select value={rule.rewardType} onChange={e => setRewardRules(prev => prev.map(r => r.id === rule.id ? { ...r, rewardType: e.target.value } : r))}
                      className="rounded px-2 outline-none" style={{ height: 30, fontSize: 12, border: '1px solid #E3E8F0', color: '#1A2332', background: '#fff' }}>
                      <option value="credits">Credits (¥)</option>
                      <option value="cashback">Cashback (%)</option>
                      <option value="voucher">Voucher</option>
                    </select>
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} value={rule.rewardValue}
                        onChange={e => setRewardRules(prev => prev.map(r => r.id === rule.id ? { ...r, rewardValue: Number(e.target.value) } : r))}
                        className="rounded px-2" style={{ width: 72, height: 30, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332', fontFamily: 'monospace' }} />
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>{rule.rewardType === 'cashback' ? '%' : '¥'}</span>
                    </div>
                  </td>
                  <td className="px-4">
                    <button onClick={() => setRewardRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                      style={{ width: 40, height: 22, borderRadius: 11, background: rule.enabled ? '#059669' : '#E3E8F0', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: rule.enabled ? 21 : 3, transition: 'left 0.2s' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Global defaults banner */}
        <div className="flex items-start gap-3 rounded-lg px-4 py-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <ShieldCheck size={14} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.6 }}>
            <strong>Global Referral Campaign Defaults</strong> — The Referral Conditions and Payout Rules below are used as the default values for all new Referral Campaigns. Individual campaigns can override any of these values without affecting the global defaults.
          </div>
        </div>

        {/* Referral Conditions & Payout Rules */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332', marginBottom: 12 }}>Referral Conditions</div>
            <div className="space-y-3">
              {[
                { label: 'Referral Link Expiry (days)', value: referralExpiry, set: setReferralExpiry, hint: 'Days after click before referral attribution expires' },
                { label: 'Referral Attribution Window (days)', value: attributionWindow, set: setAttributionWindow, hint: 'Days after referral click to attribute a completed booking' },
                { label: 'Minimum Booking Amount (MMK)', value: minBooking, set: setMinBooking, hint: 'Minimum booking value required for commission eligibility' },
                { label: 'Maximum Invitations Per User', value: maxInvitationsPerUser, set: setMaxInvitationsPerUser, hint: 'Max number of friends a single user can invite' },
                { label: 'Maximum Rewards Per User', value: maxRewardsPerUser, set: setMaxRewardsPerUser, hint: 'Max total rewards a single user can earn per campaign' },
                { label: 'Max Referrals per Day (per affiliate)', value: maxReferralsDay, set: setMaxReferralsDay, hint: 'Triggers fraud flag if exceeded' },
              ].map(field => (
                <div key={field.label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>{field.label}</label>
                  <input type="number" min={0} value={field.value} onChange={e => field.set(e.target.value)}
                    className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332', fontFamily: 'monospace' }} />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{field.hint}</div>
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 6 }}>Booking Completion Required</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setBookingCompletionRequired(v => !v)}
                    style={{ width: 40, height: 22, borderRadius: 11, background: bookingCompletionRequired ? '#1664FF' : '#E3E8F0', position: 'relative', cursor: 'pointer', border: 'none', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: bookingCompletionRequired ? 21 : 3, transition: 'left 0.2s' }} />
                  </button>
                  <span style={{ fontSize: 13, color: '#1A2332' }}>{bookingCompletionRequired ? 'Required — reward only after booking is fully completed' : 'Not required — reward on booking confirmation'}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>Controls when the referral reward is released to the referrer</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332', marginBottom: 12 }}>Payout & Reward-Release Rules</div>
            <div className="space-y-3">
              {[
                { label: 'Reward Hold Period (days)', value: rewardHoldDays, set: setRewardHoldDays, hint: 'Days after stay completion before reward is released for payout' },
              ].map(field => (
                <div key={field.label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>{field.label}</label>
                  <input type="number" min={0} value={field.value} onChange={e => field.set(e.target.value)}
                    className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332', fontFamily: 'monospace' }} />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{field.hint}</div>
                </div>
              ))}
              <div className="rounded-lg p-3 mt-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
                  <strong>Payout schedule:</strong> Approved withdrawals are processed on the 1st and 15th of each month. Bank transfers take 2–5 business days; Alipay/WeChat Pay are instant.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}


// ── 6. Affiliate Codes Management ────────────────────────────────────────────

type CodeStatus = 'active' | 'paused' | 'expired' | 'draft'
type PromotionType = 'percentage' | 'fixed' | 'free_night' | 'cashback'

const PROMO_TYPE_META: Record<PromotionType, { label: string; color: string; bg: string }> = {
  percentage:  { label: 'Percentage', color: '#1D4ED8', bg: '#EFF6FF' },
  fixed:       { label: 'Fixed Amount', color: '#6D28D9', bg: '#EDE9FE' },
  free_night:  { label: 'Free Night', color: '#065F46', bg: '#ECFDF3' },
  cashback:    { label: 'Cashback', color: '#92400E', bg: '#FEF3C7' },
}

function CodeBadge({ code, onClick }: { code: string; onClick?: () => void }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard?.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-1">
      <button onClick={onClick}
        className="inline-flex items-center gap-1 rounded px-1.5 font-bold transition-colors"
        style={{ fontSize: 11, background: '#EDE9FE', color: '#5B21B6', height: 20, fontFamily: 'monospace', cursor: onClick ? 'pointer' : 'default' }}>
        <Tag size={9} />{code}
      </button>
      <button onClick={handleCopy} title="Copy code"
        className="flex items-center justify-center rounded transition-colors"
        style={{ width: 18, height: 18, color: copied ? '#059669' : '#CBD5E1', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#5B21B6' }}
        onMouseLeave={e => { if (!copied) e.currentTarget.style.color = '#CBD5E1' }}>
        {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
      </button>
    </div>
  )
}

function LinkCopyBtn({ url, short, showToast }: { url: string; short: string; showToast: (type: 'error'|'success'|'warning'|'info', title: string, msg?: string) => void }) {
  const [copied, setCopied] = useState(false)
  function handle() {
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    showToast('success', 'Link Copied', url)
  }
  return (
    <div className="flex items-center gap-1">
      <span style={{ fontSize: 11, color: '#1664FF', fontFamily: 'monospace' }}>{short}</span>
      <button onClick={handle} title="Copy referral link"
        className="flex items-center justify-center rounded"
        style={{ width: 18, height: 18, color: copied ? '#059669' : '#CBD5E1' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#1664FF' }}
        onMouseLeave={e => { if (!copied) e.currentTarget.style.color = '#CBD5E1' }}>
        {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
      </button>
    </div>
  )
}

const ALL_AFFILIATES_FOR_SELECT = [
  { id: 'AFF-001', name: 'TravelWithLily',     handle: '@travelwithlily',    type: 'influencer'  as const },
  { id: 'AFF-002', name: 'Jason Hotel Reviews',handle: '@jasonhotels',       type: 'kol'         as const },
  { id: 'AFF-003', name: 'ChinaTravelBlog',    handle: '@chinatravelblog',   type: 'blogger'     as const },
  { id: 'AFF-004', name: 'LuxuryHotelSeeker',  handle: '@luxhotelseeker',    type: 'influencer'  as const },
  { id: 'AFF-005', name: 'ResortFinder_CN',    handle: '@resortfindercn',    type: 'kol'         as const },
  { id: 'AFF-006', name: 'WanderLust_Asia',    handle: '@wanderlust_asia',   type: 'influencer'  as const },
  { id: 'AFF-007', name: 'AsiaHotelDeals',     handle: '@asiahoteldeals',    type: 'ota_partner' as const },
  { id: 'AFF-008', name: 'UrbanTraveler_SH',   handle: '@urbantraveler_sh',  type: 'blogger'     as const },
  { id: 'AFF-009', name: 'Corporate Travel Pro',handle: '@corptravel_pro',   type: 'corporate'   as const },
  { id: 'AFF-010', name: 'SuiteLife_CN',       handle: '@suitelife_cn',      type: 'influencer'  as const },
  { id: 'AFF-012', name: 'ShanghaiLifestyle',  handle: '@shanghailifestyle', type: 'kol'         as const },
  { id: 'AFF-013', name: 'BudgetTraveler_Asia',handle: '@budgettraveler_asia',type: 'blogger'    as const },
  { id: 'AFF-014', name: 'CityHopperMike',     handle: '@cityhoppermike',    type: 'influencer'  as const },
  { id: 'AFF-015', name: 'TravelWithMom',      handle: '@travelwithmom_cn',  type: 'blogger'     as const },
  { id: 'AFF-016', name: 'HotelInsiderCN',     handle: '@hotelinsidercn',    type: 'kol'         as const },
  { id: 'AFF-017', name: 'SleepWellGuide',     handle: '@sleepwellguide',    type: 'blogger'     as const },
  { id: 'AFF-019', name: 'GlobalNomadTV',      handle: '@globalnomadtv',     type: 'influencer'  as const },
  { id: 'AFF-020', name: 'TravelNowCorp',      handle: '@travelnowcorp',     type: 'ota_partner' as const },
]

interface CodeFormState {
  code: string; affiliateId: string; promotionType: PromotionType
  discountValue: string; startDate: string; endDate: string
  usageLimit: string; perUserLimit: string; eligibleMerchants: 'all' | 'selected'
  merchantCount: string; status: CodeStatus
}

const BLANK_FORM: CodeFormState = {
  code: '', affiliateId: '', promotionType: 'percentage',
  discountValue: '', startDate: '', endDate: '',
  usageLimit: '1000', perUserLimit: '2', eligibleMerchants: 'all',
  merchantCount: '', status: 'active',
}

function generateCode(affiliateId: string, existingCodes: string[]): string {
  const aff = ALL_AFFILIATES_FOR_SELECT.find(a => a.id === affiliateId)
  if (!aff) return ''
  const prefix = aff.name.replace(/[^A-Z]/gi, '').slice(0, 4).toUpperCase()
  const suffix = Math.floor(10 + Math.random() * 89)
  const candidate = `${prefix}${suffix}`
  return existingCodes.includes(candidate) ? `${prefix}${suffix + 1}` : candidate
}

function getCodeSuggestions(base: string, existingCodes: string[]): string[] {
  const b = base.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  if (!b) return []
  const year = new Date().getFullYear().toString()
  const month = new Date().toLocaleString('en', { month: 'short' }).toUpperCase()
  const candidates = [
    b + year,
    b + 'VIP',
    b + 'TRIP',
    b + '001',
    b + month,
    b + '2',
  ]
  return candidates.filter(c => !existingCodes.includes(c) && /^[A-Z0-9]{3,16}$/.test(c)).slice(0, 4)
}

function AffiliateCodesPage({ showToast }: { showToast: Props['showToast'] }) {
  const [codes, setCodes] = useState<AffiliateCode[]>(initialAffiliateCodes)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPromo, setFilterPromo] = useState('')
  const [sortCol, setSortCol] = useState<'code' | 'usage' | 'bookings' | 'revenue' | 'commission'>('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const perPage = 10

  // Drawers
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AffiliateCode | null>(null)
  const [viewTarget, setViewTarget] = useState<AffiliateCode | null>(null)

  // Dialogs
  const [deactivateTarget, setDeactivateTarget] = useState<AffiliateCode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AffiliateCode | null>(null)
  const [loading, setLoading] = useState(false)

  // Form state (shared between create and edit)
  const [form, setForm] = useState<CodeFormState>(BLANK_FORM)
  const [codeError, setCodeError] = useState('')
  const [codeMode, setCodeMode] = useState<'auto' | 'custom'>('auto')
  const [codeSuggestions, setCodeSuggestions] = useState<string[]>([])

  const filtered = codes.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false
    if (filterType && c.affiliateType !== filterType) return false
    if (filterPromo && c.promotionType !== filterPromo) return false
    if (search && !c.code.toLowerCase().includes(search.toLowerCase()) &&
        !c.affiliateName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    const m: Record<string, number> = {
      code: a.code.localeCompare(b.code),
      usage: a.usageCount - b.usageCount,
      bookings: a.bookings - b.bookings,
      revenue: a.revenue - b.revenue,
      commission: a.commission - b.commission,
    }
    const v = m[sortCol] ?? 0
    return sortDir === 'asc' ? v : -v
  })

  const total = filtered.length
  const rows = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const active = codes.filter(c => c.status === 'active')

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function SortTh({ col, label }: { col: typeof sortCol; label: string }) {
    const active = sortCol === col
    return (
      <th className="text-left px-3 cursor-pointer select-none" style={{ height: 36, fontSize: 11, fontWeight: 600, color: active ? '#1664FF' : '#64748B', whiteSpace: 'nowrap' }}
        onClick={() => toggleSort(col)}>
        <div className="flex items-center gap-1">
          {label}
          <span style={{ opacity: active ? 1 : 0.3 }}>{sortDir === 'asc' && active ? '↑' : '↓'}</span>
        </div>
      </th>
    )
  }

  // ── Validation ──────────────────────────────────────────────────────────
  function validateCode(raw: string, editId?: string): string {
    const code = raw.toUpperCase().trim()
    if (!code) return 'Code is required.'
    if (!/^[A-Z0-9]{3,16}$/.test(code)) return 'Code must be 3–16 uppercase letters/numbers, no spaces.'
    const exists = codes.find(c => c.code === code && c.id !== editId)
    if (exists) return `Code "${code}" is already in use by ${exists.affiliateName}. Each code must be unique.`
    return ''
  }

  // ── Create ───────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(BLANK_FORM)
    setCodeError('')
    setCodeMode('auto')
    setCodeSuggestions([])
    setCreateOpen(true)
  }

  function handleCreate() {
    const err = validateCode(form.code)
    if (err) { setCodeError(err); return }
    if (!form.affiliateId) { showToast('error', 'Affiliate Required', 'Please select an affiliate or influencer.'); return }
    if (!form.discountValue || isNaN(Number(form.discountValue))) { showToast('error', 'Discount Required', 'Enter a valid discount value.'); return }
    if (!form.startDate || !form.endDate) { showToast('error', 'Dates Required', 'Start and end dates are required.'); return }

    const aff = ALL_AFFILIATES_FOR_SELECT.find(a => a.id === form.affiliateId)!
    const afData = affiliates.find(a => a.id === form.affiliateId)
    const v = Number(form.discountValue)
    const display = form.promotionType === 'percentage' ? `${v}% OFF`
      : form.promotionType === 'fixed' ? `¥${v} OFF`
      : form.promotionType === 'cashback' ? `${v}% Cashback`
      : 'Free Night'

    const newCode: AffiliateCode = {
      id: `AC-${String(codes.length + 1).padStart(3, '0')}`,
      code: form.code.toUpperCase().trim(),
      affiliateId: form.affiliateId,
      affiliateName: aff.name,
      affiliateHandle: aff.handle,
      affiliateType: aff.type,
      promotionType: form.promotionType,
      discountValue: v,
      discountDisplay: display,
      referralLink: `https://mtrip.com/r/${form.code.toLowerCase().trim()}`,
      status: form.status,
      startDate: form.startDate,
      endDate: form.endDate,
      usageLimit: Number(form.usageLimit) || 1000,
      usageCount: 0,
      perUserLimit: Number(form.perUserLimit) || 2,
      eligibleMerchants: form.eligibleMerchants,
      merchantCount: form.eligibleMerchants === 'all' ? 30 : Number(form.merchantCount) || 0,
      bookings: 0, conversions: 0, revenue: 0, commission: 0,
      commissionRate: afData?.commissionRate ?? 5,
      createdBy: 'Admin (You)', createdAt: new Date().toISOString().split('T')[0],
    }

    setLoading(true)
    setTimeout(() => {
      setCodes(prev => [newCode, ...prev])
      setCreateOpen(false)
      setLoading(false)
      showToast('success', 'Affiliate Code Created', `Code "${newCode.code}" is now ${form.status === 'active' ? 'live' : 'saved as draft'}.`)
    }, 600)
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  function openEdit(code: AffiliateCode) {
    setForm({
      code: code.code,
      affiliateId: code.affiliateId,
      promotionType: code.promotionType,
      discountValue: String(code.discountValue),
      startDate: code.startDate,
      endDate: code.endDate,
      usageLimit: String(code.usageLimit),
      perUserLimit: String(code.perUserLimit),
      eligibleMerchants: code.eligibleMerchants,
      merchantCount: String(code.merchantCount),
      status: code.status,
    })
    setCodeError('')
    setEditTarget(code)
  }

  function handleEdit() {
    if (!editTarget) return
    const err = validateCode(form.code, editTarget.id)
    if (err) { setCodeError(err); return }
    const v = Number(form.discountValue)
    const display = form.promotionType === 'percentage' ? `${v}% OFF`
      : form.promotionType === 'fixed' ? `¥${v} OFF`
      : form.promotionType === 'cashback' ? `${v}% Cashback`
      : 'Free Night'

    setLoading(true)
    setTimeout(() => {
      setCodes(prev => prev.map(c => c.id === editTarget.id ? {
        ...c,
        code: form.code.toUpperCase().trim(),
        promotionType: form.promotionType,
        discountValue: v,
        discountDisplay: display,
        referralLink: `https://mtrip.com/r/${form.code.toLowerCase().trim()}`,
        status: form.status,
        startDate: form.startDate,
        endDate: form.endDate,
        usageLimit: Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit),
        eligibleMerchants: form.eligibleMerchants,
        merchantCount: form.eligibleMerchants === 'all' ? 30 : Number(form.merchantCount),
      } : c))
      setEditTarget(null)
      setLoading(false)
      showToast('success', 'Code Updated', `"${form.code.toUpperCase().trim()}" has been saved.`)
    }, 600)
  }

  function handleToggleStatus(code: AffiliateCode) {
    if (code.status === 'active') {
      setDeactivateTarget(code)
    } else if (code.status === 'paused') {
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, status: 'active' } : c))
      showToast('success', 'Code Activated', `"${code.code}" is now active.`)
    }
  }

  function handleDeactivate() {
    setLoading(true)
    setTimeout(() => {
      setCodes(prev => prev.map(c => c.id === deactivateTarget?.id ? { ...c, status: 'paused' } : c))
      setDeactivateTarget(null)
      setLoading(false)
      showToast('warning', 'Code Paused', `"${deactivateTarget?.code}" is no longer accepting new uses.`)
    }, 600)
  }

  function handleDelete() {
    setLoading(true)
    setTimeout(() => {
      setCodes(prev => prev.filter(c => c.id !== deleteTarget?.id))
      setDeleteTarget(null)
      setLoading(false)
      showToast('info', 'Code Deleted', `"${deleteTarget?.code}" has been removed.`)
    }, 600)
  }

  function copyLink(code: AffiliateCode) {
    navigator.clipboard?.writeText(code.referralLink).catch(() => {})
    showToast('success', 'Referral Link Copied', code.referralLink)
  }

  const kpis = [
    { label: 'Total Codes',       value: codes.length,                                                                  color: '#1664FF' },
    { label: 'Active Codes',      value: active.length,                                                                 color: '#059669', sub: 'Accepting uses now' },
    { label: 'Total Bookings',    value: codes.reduce((s, c) => s + c.bookings, 0).toLocaleString(),                   color: '#D97706', sub: 'Attributed via codes' },
    { label: 'Revenue Attributed',value: `¥${(codes.reduce((s, c) => s + c.revenue, 0) / 1_000_000).toFixed(1)}M`,    color: '#7C3AED', sub: 'Lifetime' },
    { label: 'Commission Paid',   value: `¥${(codes.reduce((s, c) => s + c.commission, 0) / 1_000_000).toFixed(2)}M`, color: '#DC2626', sub: 'To affiliates' },
  ]

  const codeStatusColor: Record<CodeStatus, string> = {
    active: '#059669', paused: '#D97706', expired: '#64748B', draft: '#94A3B8',
  }

  // ── Shared form UI ────────────────────────────────────────────────────────
  function CodeForm({ isEdit }: { isEdit: boolean }) {
    return (
      <div className="space-y-4">
        {/* Attribution rule notice */}
        <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <AlertTriangle size={13} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
            Each booking can only be attributed to one affiliate. Duplicate commission is automatically prevented — if a customer uses multiple codes, only the first valid code is honoured.
          </div>
        </div>

        {/* Code field */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 6 }}>
            Affiliate Code <span style={{ color: '#DC2626' }}>*</span>
          </label>
          {!isEdit && (
            <div className="flex gap-1 p-1 rounded-lg mb-3" style={{ background: '#F1F5F9', display: 'inline-flex' }}>
              {(['auto', 'custom'] as const).map(mode => (
                <button key={mode} onClick={() => { setCodeMode(mode); setCodeError(''); setCodeSuggestions([]); if (mode === 'auto' && form.affiliateId) { const g = generateCode(form.affiliateId, codes.map(c => c.code)); setForm(f => ({ ...f, code: g })) } }}
                  className="rounded-md px-3 font-medium capitalize transition-all"
                  style={{ height: 28, fontSize: 12, background: codeMode === mode ? '#fff' : 'transparent', color: codeMode === mode ? '#1A2332' : '#64748B', boxShadow: codeMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  {mode === 'auto' ? 'Auto Generate' : 'Custom Code'}
                </button>
              ))}
            </div>
          )}
          {codeMode === 'auto' && !isEdit ? (
            <div className="flex gap-2">
              <div className="flex-1 rounded-md px-3 flex items-center font-mono font-bold"
                style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', background: '#F8FAFC', color: '#5B21B6', letterSpacing: '0.05em' }}>
                {form.code || <span style={{ color: '#CBD5E1', fontWeight: 400, fontFamily: 'inherit' }}>Select an affiliate first…</span>}
              </div>
              <button onClick={() => {
                if (!form.affiliateId) { showToast('error', 'Select Affiliate First', ''); return }
                const generated = generateCode(form.affiliateId, codes.map(c => c.code))
                setForm(f => ({ ...f, code: generated }))
                setCodeError('')
              }}
                className="flex items-center gap-1.5 rounded-md px-3 font-medium"
                style={{ height: 36, fontSize: 12, color: '#5B21B6', border: '1px solid #DDD6FE', background: '#F5F3FF', whiteSpace: 'nowrap' }}>
                <RefreshCw size={12} /> Regenerate
              </button>
            </div>
          ) : (
            <div>
              <input
                value={form.code}
                onChange={e => {
                  const val = e.target.value.toUpperCase()
                  setForm(f => ({ ...f, code: val }))
                  const err = val.length >= 3 ? validateCode(val, isEdit ? editTarget?.id : undefined) : ''
                  setCodeError(err)
                  if (err && val.length >= 3) {
                    setCodeSuggestions(getCodeSuggestions(val, codes.map(c => c.code)))
                  } else {
                    setCodeSuggestions([])
                  }
                }}
                placeholder="e.g. LILY20"
                className="w-full rounded-md px-3 font-mono font-bold"
                style={{ height: 36, fontSize: 13, border: `1px solid ${codeError ? '#FECDD3' : '#E3E8F0'}`, outline: 'none', background: codeError ? '#FFF1F3' : '#fff', color: '#5B21B6', letterSpacing: '0.05em' }}
              />
              {codeError && (
                <div>
                  <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{codeError}</div>
                  {codeSuggestions.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Available alternatives:</div>
                      <div className="flex gap-2 flex-wrap">
                        {codeSuggestions.map(s => (
                          <button key={s} onClick={() => { setForm(f => ({ ...f, code: s })); setCodeError(''); setCodeSuggestions([]) }}
                            className="rounded px-2 font-mono font-bold"
                            style={{ height: 26, fontSize: 12, color: '#5B21B6', border: '1px solid #DDD6FE', background: '#F5F3FF', letterSpacing: '0.05em' }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!codeError && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>3–16 uppercase letters/numbers. Must be unique across the platform.</div>}
            </div>
          )}
        </div>

        {/* Affiliate select */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>
            Linked Affiliate / Influencer <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <select
            value={form.affiliateId}
            onChange={e => setForm(f => ({ ...f, affiliateId: e.target.value }))}
            disabled={isEdit}
            className="w-full rounded-md px-3 outline-none"
            style={{ height: 36, fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', background: isEdit ? '#F8FAFC' : '#fff' }}>
            <option value="">Select affiliate…</option>
            {ALL_AFFILIATES_FOR_SELECT.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.handle})</option>
            ))}
          </select>
          {isEdit && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Affiliate cannot be changed after creation. Delete and recreate if needed.</div>}
        </div>

        {/* Promotion type + discount value */}
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Promotion Type</label>
            <select value={form.promotionType} onChange={e => setForm(f => ({ ...f, promotionType: e.target.value as PromotionType }))}
              className="w-full rounded-md px-3 outline-none" style={{ height: 36, fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', background: '#fff' }}>
              <option value="percentage">Percentage Discount</option>
              <option value="fixed">Fixed Amount (¥)</option>
              <option value="cashback">Cashback %</option>
              <option value="free_night">Free Night</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>
              {form.promotionType === 'percentage' ? 'Percentage (%)' : form.promotionType === 'fixed' ? 'Amount (¥)' : form.promotionType === 'cashback' ? 'Cashback (%)' : 'Nights'}
            </label>
            <input
              type="number" min={1} value={form.discountValue}
              onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
              placeholder={form.promotionType === 'fixed' ? '100' : form.promotionType === 'free_night' ? '1' : '15'}
              className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
          </div>
        </div>

        {/* Validity period */}
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Start Date</label>
            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>End Date</label>
            <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
          </div>
        </div>

        {/* Usage limits */}
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Total Usage Limit</label>
            <input type="number" min={1} value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))}
              className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 4 }}>Per-User Limit</label>
            <input type="number" min={1} value={form.perUserLimit} onChange={e => setForm(f => ({ ...f, perUserLimit: e.target.value }))}
              className="w-full rounded-md px-3" style={{ height: 36, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
          </div>
        </div>

        {/* Eligible Merchants */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 8 }}>Eligible Merchants</label>
          <div className="flex gap-3">
            {(['all', 'selected'] as const).map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, eligibleMerchants: opt }))}
                  style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${form.eligibleMerchants === opt ? '#1664FF' : '#CBD5E1'}`, background: form.eligibleMerchants === opt ? '#1664FF' : 'transparent', cursor: 'pointer' }} />
                <span style={{ fontSize: 13, color: '#475569' }}>{opt === 'all' ? 'All merchants' : 'Selected merchants'}</span>
              </label>
            ))}
          </div>
          {form.eligibleMerchants === 'selected' && (
            <div className="mt-2">
              <input type="number" min={1} max={30} value={form.merchantCount}
                onChange={e => setForm(f => ({ ...f, merchantCount: e.target.value }))}
                placeholder="Number of selected merchants"
                className="w-full rounded-md px-3" style={{ height: 34, fontSize: 13, border: '1px solid #E3E8F0', outline: 'none', color: '#1A2332' }} />
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', display: 'block', marginBottom: 8 }}>Status</label>
          <div className="flex gap-3">
            {(['active', 'draft', 'paused'] as CodeStatus[]).map(s => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, status: s }))}
                  style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${form.status === s ? codeStatusColor[s] : '#CBD5E1'}`, background: form.status === s ? codeStatusColor[s] : 'transparent', cursor: 'pointer' }} />
                <span style={{ fontSize: 13, color: '#475569', textTransform: 'capitalize' }}>{s}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button onClick={isEdit ? handleEdit : handleCreate} disabled={loading}
            className="flex items-center gap-1.5 rounded-md px-4 text-white font-medium"
            style={{ height: 34, fontSize: 13, background: '#1664FF', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Code'}
          </button>
          <button onClick={() => { setCreateOpen(false); setEditTarget(null) }}
            className="rounded-md px-4 font-medium"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <PageShell breadcrumb="Affiliate & Influencer"
      title="Affiliate Codes" subtitle="Manage unique affiliate referral codes, track usage, and control attribution"
      actions={<>
        <button className="flex items-center gap-1.5 rounded-md px-3"
          style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          onClick={() => showToast('info', 'Export', 'Affiliate codes exported.')}>
          <Download size={13} /> Export
        </button>
        <button className="flex items-center gap-1.5 rounded-md px-3 text-white font-medium"
          style={{ height: 34, fontSize: 13, background: '#1664FF' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0E4FCC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1664FF')}
          onClick={openCreate}>
          <Plus size={13} /> Create Code
        </button>
      </>}
      kpis={kpis}
      search={
        <div className="space-y-3 mb-4">
          {/* Attribution rule banner */}
          <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <ShieldCheck size={14} color="#059669" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#166534' }}>
              <strong>Attribution rules active:</strong> One booking per affiliate. If a customer uses both a referral link and an affiliate code, the referral link takes precedence. Duplicate commission requests are automatically rejected.
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <Search size={13} color="#94A3B8" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search code or affiliate name…"
              className="flex-1 outline-none bg-transparent" style={{ fontSize: 13, color: '#1A2332' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
              <option value="">All Status</option><option value="active">Active</option>
              <option value="paused">Paused</option><option value="expired">Expired</option><option value="draft">Draft</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
              <option value="">All Types</option><option value="influencer">Influencer</option><option value="blogger">Blogger</option>
              <option value="kol">KOL</option><option value="ota_partner">OTA Partner</option><option value="corporate">Corporate</option>
            </select>
            <select value={filterPromo} onChange={e => setFilterPromo(e.target.value)} className="outline-none bg-transparent" style={{ fontSize: 12, color: '#64748B' }}>
              <option value="">All Promo Types</option><option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option><option value="cashback">Cashback</option><option value="free_night">Free Night</option>
            </select>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{total} codes</span>
          </div>
        </div>
      }>
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              <SortTh col="code" label="Code" />
              <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Affiliate</th>
              <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Promotion</th>
              <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Referral Link</th>
              <SortTh col="usage" label="Usage" />
              <SortTh col="bookings" label="Bookings" />
              <SortTh col="revenue" label="Revenue" />
              <SortTh col="commission" label="Commission" />
              <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Valid Until</th>
              <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Status</th>
              <th className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const pm = PROMO_TYPE_META[c.promotionType]
              const usagePct = c.usageLimit > 0 ? Math.round(c.usageCount / c.usageLimit * 100) : 0
              const shortLink = c.referralLink.replace('https://mtrip.com', '')
              return (
                <tr key={c.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-3" style={{ height: 52 }}>
                    <CodeBadge code={c.code} onClick={() => setViewTarget(c)} />
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>ID: {c.id}</div>
                  </td>
                  <td className="px-3">
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{c.affiliateName}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.affiliateHandle}</div>
                  </td>
                  <td className="px-3">
                    <span className="inline-flex items-center rounded px-1.5 font-medium"
                      style={{ fontSize: 11, background: pm.bg, color: pm.color, height: 20 }}>
                      {pm.label}
                    </span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: pm.color, marginTop: 2 }}>{c.discountDisplay}</div>
                  </td>
                  <td className="px-3">
                    <LinkCopyBtn url={c.referralLink} short={shortLink} showToast={showToast} />
                    <button onClick={() => window.open(c.referralLink, '_blank')}
                      className="flex items-center gap-1 mt-0.5"
                      style={{ fontSize: 10, color: '#94A3B8', background: 'none', cursor: 'pointer' }}>
                      <ExternalLink size={9} /> Preview
                    </button>
                  </td>
                  <td className="px-3">
                    <div style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>{c.usageCount.toLocaleString()} / {c.usageLimit.toLocaleString()}</div>
                    <div style={{ marginTop: 3, width: 56, height: 4, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ width: `${usagePct}%`, height: '100%', background: usagePct > 90 ? '#DC2626' : usagePct > 70 ? '#D97706' : '#059669', borderRadius: 9999 }} />
                    </div>
                  </td>
                  <td className="px-3" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace' }}>
                    {c.bookings.toLocaleString()}
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.conversions.toLocaleString()} conv.</div>
                  </td>
                  <td className="px-3" style={{ fontSize: 13, fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                    {c.revenue > 0 ? `¥${(c.revenue / 1000).toFixed(0)}K` : '—'}
                  </td>
                  <td className="px-3" style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', fontFamily: 'monospace' }}>
                    {c.commission > 0 ? `¥${(c.commission / 1000).toFixed(0)}K` : '—'}
                  </td>
                  <td className="px-3" style={{ fontSize: 11, color: c.endDate < '2025-01-01' ? '#DC2626' : '#64748B', fontFamily: 'monospace' }}>{c.endDate}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-1.5">
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: codeStatusColor[c.status], flexShrink: 0 }} />
                      <StatusBadge status={c.status} />
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn color="#1664FF" onClick={() => setViewTarget(c)} title="View details"><Eye size={12} /></ActionBtn>
                      <ActionBtn color="#5B21B6" onClick={() => openEdit(c)} title="Edit code"><Edit2 size={12} /></ActionBtn>
                      <MoreMenu items={[
                        { label: 'View Details', icon: <Eye size={13} />, onClick: () => setViewTarget(c) },
                        { label: 'Edit Code', icon: <Edit2 size={13} />, onClick: () => openEdit(c) },
                        { label: 'Copy Referral Link', icon: <Copy size={13} />, onClick: () => copyLink(c) },
                        ...(c.status === 'active'
                          ? [{ label: 'Pause Code', icon: <ZapOff size={13} />, color: '#D97706', divider: true, onClick: () => setDeactivateTarget(c) }]
                          : c.status === 'paused'
                          ? [{ label: 'Activate Code', icon: <Zap size={13} />, color: '#059669', divider: true, onClick: () => handleToggleStatus(c) }]
                          : []
                        ),
                        { label: 'Delete Code', icon: <XCircle size={13} />, color: '#DC2626', divider: true, onClick: () => setDeleteTarget(c) },
                      ]} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, fontSize: 13, color: '#94A3B8' }}>No affiliate codes match your filters.</td></tr>
            )}
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

      {/* Detail Drawer */}
      <Drawer open={!!viewTarget} onClose={() => setViewTarget(null)} title={viewTarget?.code ?? ''} subtitle={`${viewTarget?.affiliateName} · ${viewTarget?.discountDisplay}`} width={560}>
        {viewTarget && (() => {
          const pm = PROMO_TYPE_META[viewTarget.promotionType]
          const usagePct = viewTarget.usageLimit > 0 ? Math.round(viewTarget.usageCount / viewTarget.usageLimit * 100) : 0
          const convRate = viewTarget.bookings > 0 ? Math.round(viewTarget.conversions / viewTarget.bookings * 100) : 0
          return (
            <div className="space-y-4">
              {/* Code hero */}
              <div className="rounded-lg p-4" style={{ background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#5B21B6', fontFamily: 'monospace', letterSpacing: '0.08em' }}>{viewTarget.code}</div>
                    <div style={{ fontSize: 13, color: '#6D28D9', marginTop: 2 }}>{viewTarget.discountDisplay} · {viewTarget.affiliateName}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={viewTarget.status} />
                    <span className="inline-flex items-center rounded px-1.5 font-medium"
                      style={{ fontSize: 11, background: pm.bg, color: pm.color, height: 20 }}>{pm.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <code style={{ fontSize: 11, color: '#6D28D9', background: '#EDE9FE', padding: '2px 6px', borderRadius: 4 }}>{viewTarget.referralLink}</code>
                  <button onClick={() => copyLink(viewTarget)}
                    className="flex items-center gap-1 rounded px-2"
                    style={{ height: 22, fontSize: 11, color: '#5B21B6', border: '1px solid #DDD6FE', background: '#fff' }}>
                    <Copy size={10} /> Copy Link
                  </button>
                </div>
              </div>

              {/* Performance KPIs */}
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                {[
                  { label: 'Bookings', value: viewTarget.bookings.toLocaleString(), icon: <ShoppingBag size={12} color="#1664FF" /> },
                  { label: 'Conversions', value: viewTarget.conversions.toLocaleString(), icon: <CheckCircle size={12} color="#059669" /> },
                  { label: 'Conv. Rate', value: `${convRate}%`, icon: <TrendingUp size={12} color="#7C3AED" /> },
                  { label: 'Revenue', value: `¥${(viewTarget.revenue / 1000).toFixed(0)}K`, icon: <DollarSign size={12} color="#D97706" /> },
                  { label: 'Commission', value: `¥${(viewTarget.commission / 1000).toFixed(0)}K`, icon: <Banknote size={12} color="#DC2626" /> },
                  { label: 'Comm. Rate', value: `${viewTarget.commissionRate}%`, icon: <Tag size={12} color="#64748B" /> },
                ].map(k => (
                  <div key={k.label} className="rounded px-3 py-2.5 flex items-center gap-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    {k.icon}
                    <div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{k.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332', fontFamily: 'monospace' }}>{k.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Usage progress */}
              <div className="rounded-lg px-4 py-3" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A2332' }}>Code Usage</span>
                  <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>{viewTarget.usageCount.toLocaleString()} / {viewTarget.usageLimit.toLocaleString()} uses ({usagePct}%)</span>
                </div>
                <div style={{ height: 8, background: '#E3E8F0', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ width: `${usagePct}%`, height: '100%', background: usagePct > 90 ? '#DC2626' : usagePct > 70 ? '#D97706' : '#059669', borderRadius: 9999, transition: 'width 0.3s' }} />
                </div>
                {usagePct > 90 && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Warning: Code is over 90% consumed. Consider increasing the usage limit.</div>}
              </div>

              {/* Config details */}
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[
                  { label: 'Per-User Limit', value: `${viewTarget.perUserLimit} use(s)` },
                  { label: 'Eligible Merchants', value: viewTarget.eligibleMerchants === 'all' ? 'All Merchants' : `${viewTarget.merchantCount} selected` },
                  { label: 'Valid From', value: viewTarget.startDate, mono: true },
                  { label: 'Valid Until', value: viewTarget.endDate, mono: true },
                  { label: 'Last Used', value: viewTarget.lastUsed ?? 'Never', mono: true },
                  { label: 'Created By', value: viewTarget.createdBy },
                ].map(f => (
                  <div key={f.label} className="rounded px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 1 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: '#1A2332', fontWeight: 500, fontFamily: f.mono ? 'monospace' : 'inherit' }}>{f.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                <button onClick={() => { setViewTarget(null); openEdit(viewTarget) }}
                  className="flex items-center gap-1.5 rounded-md px-4 font-medium"
                  style={{ height: 34, fontSize: 13, color: '#5B21B6', border: '1px solid #DDD6FE', background: '#F5F3FF' }}>
                  <Edit2 size={13} /> Edit Code
                </button>
                {viewTarget.status === 'active' && (
                  <button onClick={() => { setViewTarget(null); setDeactivateTarget(viewTarget) }}
                    className="flex items-center gap-1.5 rounded-md px-4 font-medium"
                    style={{ height: 34, fontSize: 13, color: '#D97706', border: '1px solid #FDE68A', background: '#FFFBEB' }}>
                    <ZapOff size={13} /> Pause Code
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </Drawer>

      {/* Create Drawer */}
      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create Affiliate Code" subtitle="Define a unique code and referral link for an affiliate" width={520}>
        <CodeForm isEdit={false} />
      </Drawer>

      {/* Edit Drawer */}
      <Drawer open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit Code: ${editTarget?.code ?? ''}`} subtitle={`${editTarget?.affiliateName} · ${editTarget?.discountDisplay}`} width={520}>
        <CodeForm isEdit={true} />
      </Drawer>

      <Dialog open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} variant="warning"
        title="Pause Affiliate Code"
        message={`Pause code "${deactivateTarget?.code}"? Existing bookings will not be affected but the code will stop accepting new uses immediately.`}
        confirmLabel="Pause Code" onConfirm={handleDeactivate} loading={loading} />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="danger"
        title="Delete Affiliate Code"
        message={`Permanently delete code "${deleteTarget?.code}"? This will remove the code and its referral link. Historical attribution data (${deleteTarget?.bookings.toLocaleString()} bookings) will be retained in reports.`}
        confirmLabel="Delete Code" onConfirm={handleDelete} loading={loading} />
    </PageShell>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function AffiliatePage({ tab, showToast }: Props) {
  if (tab === 'affiliates-partner')    return <PartnerDirectoryPage       showToast={showToast} />
  if (tab === 'affiliates-program')    return <AffiliateProgramPage        showToast={showToast} />
  if (tab === 'affiliates-withdrawals')return <RewardWalletPage showToast={showToast} />
  if (tab === 'affiliates-fraud')      return <FraudCompliancePage          showToast={showToast} />
  if (tab === 'affiliates-codes')      return <AffiliateCodesPage           showToast={showToast} />
  return <AffiliateApplicationsPage showToast={showToast} />
}

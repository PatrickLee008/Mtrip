import { useState, useRef, useEffect } from 'react'
import { Bell, Search, HelpCircle, ChevronDown, RefreshCw, Building2, CalendarCheck, Users2, Megaphone, UserCog } from 'lucide-react'
import type { PageId, Impersonation } from '../App'

const pageTitles: Partial<Record<PageId, { title: string; crumbs: string[] }>> = {
  dashboard: { title: 'Dashboard', crumbs: ['Home', 'Dashboard'] },
  // Merchant Verification
  verification: { title: 'Merchant Verification', crumbs: ['Home', 'Merchant Verification', 'Pending Review'] },
  'verification-approved': { title: 'Merchant Verification', crumbs: ['Home', 'Merchant Verification', 'Approved'] },
  'verification-rejected': { title: 'Merchant Verification', crumbs: ['Home', 'Merchant Verification', 'Rejected'] },
  'verification-resubmission': { title: 'Merchant Verification', crumbs: ['Home', 'Merchant Verification', 'Resubmission'] },
  // Merchant Management
  merchants: { title: 'Merchant Management', crumbs: ['Home', 'Merchant Management', 'All Merchants'] },
  'merchants-documents': { title: 'Merchant Management', crumbs: ['Home', 'Merchant Management', 'Merchant Documents'] },
  'merchants-suspended': { title: 'Merchant Management', crumbs: ['Home', 'Merchant Management', 'Suspended'] },
  'merchants-blacklisted': { title: 'Merchant Management', crumbs: ['Home', 'Merchant Management', 'Blacklisted'] },
  'merchants-activities': { title: 'Merchant Management', crumbs: ['Home', 'Merchant Management', 'Merchant Activities'] },
  // Platform Rules & Compliance
  'platform-rules': { title: 'Platform Rules & Compliance', crumbs: ['Home', 'Platform Rules & Compliance', 'Platform Rules'] },
  'merchant-violations': { title: 'Platform Rules & Compliance', crumbs: ['Home', 'Platform Rules & Compliance', 'Merchant Violations'] },
  'warning-history': { title: 'Platform Rules & Compliance', crumbs: ['Home', 'Platform Rules & Compliance', 'Warning History'] },
  'compliance-history': { title: 'Platform Rules & Compliance', crumbs: ['Home', 'Platform Rules & Compliance', 'Compliance History'] },
  // Booking Administration
  'bookings-admin': { title: 'Booking Administration', crumbs: ['Home', 'Booking Administration', 'All Bookings'] },
  'bookings-refunds': { title: 'Booking Administration', crumbs: ['Home', 'Booking Administration', 'Refund Requests'] },
  'bookings-settlements': { title: 'Booking Administration', crumbs: ['Home', 'Booking Administration', 'Settlement & Reconciliation'] },
  'bookings-history': { title: 'Booking Administration', crumbs: ['Home', 'Booking Administration', 'Booking History'] },
  // Campaign & Promotion
  campaigns: { title: 'Campaign & Promotion', crumbs: ['Home', 'Campaign & Promotion', 'Campaigns'] },
  'campaigns-vouchers': { title: 'Campaign & Promotion', crumbs: ['Home', 'Campaign & Promotion', 'Vouchers'] },
  'campaigns-codes': { title: 'Campaign & Promotion', crumbs: ['Home', 'Campaign & Promotion', 'Promotion Codes'] },
  'campaigns-analytics': { title: 'Campaign & Promotion', crumbs: ['Home', 'Campaign & Promotion', 'Campaign Analytics'] },
  // Affiliate & Influencer
  affiliates: { title: 'Affiliate & Influencer', crumbs: ['Home', 'Affiliate & Influencer', 'Affiliate Applications'] },
  'affiliates-partner': { title: 'Affiliate & Influencer', crumbs: ['Home', 'Affiliate & Influencer', 'Partner Directory'] },
  'affiliates-program': { title: 'Affiliate & Influencer', crumbs: ['Home', 'Affiliate & Influencer', 'Affiliate Program'] },
  'affiliates-withdrawals': { title: 'Affiliate & Influencer', crumbs: ['Home', 'Affiliate & Influencer', 'Reward Wallet'] },
  'affiliates-fraud':     { title: 'Affiliate & Influencer', crumbs: ['Home', 'Affiliate & Influencer', 'Fraud Review'] },
  'affiliates-referral': { title: 'Affiliate & Influencer', crumbs: ['Home', 'Affiliate & Influencer', 'Referral Campaigns'] },
  // User & Role Management
  'users-roles': { title: 'User & Role Management', crumbs: ['Home', 'User & Role Management', 'Users'] },
  'users-roles-list': { title: 'User & Role Management', crumbs: ['Home', 'User & Role Management', 'Roles'] },
  'users-roles-permissions': { title: 'User & Role Management', crumbs: ['Home', 'User & Role Management', 'Permission Matrix'] },
  'users-sessions': { title: 'User & Role Management', crumbs: ['Home', 'User & Role Management', 'Active Sessions'] },
  // Reports & Platform Config
  reports: { title: 'Reports & Analytics', crumbs: ['Home', 'Reports & Analytics', 'Executive Dashboard'] },
  'reports-transactions': { title: 'Reports & Analytics', crumbs: ['Home', 'Reports & Analytics', 'Transaction Reports'] },
  'reports-business': { title: 'Reports & Analytics', crumbs: ['Home', 'Reports & Analytics', 'Business Reports'] },
  'reports-custom': { title: 'Reports & Analytics', crumbs: ['Home', 'Reports & Analytics', 'Custom Reports'] },
  // End User Management
  'endusers':            { title: 'End User Management', crumbs: ['Home', 'End User Management', 'User Directory'] },
  'endusers-profile':    { title: 'End User Management', crumbs: ['Home', 'End User Management', 'User Profile'] },
  'endusers-bookings':   { title: 'End User Management', crumbs: ['Home', 'End User Management', 'Booking History'] },
  'endusers-activities':    { title: 'End User Management', crumbs: ['Home', 'End User Management', 'User Activities'] },
  'endusers-transactions': { title: 'End User Management', crumbs: ['Home', 'End User Management', 'User Transactions'] },
  'endusers-rewards':    { title: 'End User Management', crumbs: ['Home', 'End User Management', 'Rewards & Coupons'] },
  'endusers-support':        { title: 'End User Management', crumbs: ['Home', 'End User Management', 'User Support'] },
  'endusers-notifications':  { title: 'End User Management', crumbs: ['Home', 'End User Management', 'User Directory', 'User Profile', 'Notification History'] },
  'conversations-center':    { title: 'End User Management', crumbs: ['Home', 'End User Management', 'Conversation Center'] },
  'endusers-conversations': { title: 'End User Management', crumbs: ['Home', 'End User Management', 'User Directory', 'User Profile', 'Guest Conversations'] },
  'endusers-suspended':      { title: 'End User Management', crumbs: ['Home', 'End User Management', 'Suspended Users'] },
  'endusers-blacklist':  { title: 'End User Management', crumbs: ['Home', 'End User Management', 'Blacklist'] },
  'helpcenter': { title: 'Help Center Management', crumbs: ['Home', 'Help Center Management', 'FAQ Articles'] },
  'helpcenter-categories': { title: 'Help Center Management', crumbs: ['Home', 'Help Center Management', 'Categories'] },
  'helpcenter-announcements': { title: 'Help Center Management', crumbs: ['Home', 'Help Center Management', 'Announcements'] },
  'helpcenter-analytics': { title: 'Help Center Management', crumbs: ['Home', 'Help Center Management', 'Search Analytics'] },
  'contentmgmt':         { title: 'Content Management', crumbs: ['Home', 'Content Management', 'Banner Management'] },
  'contentmgmt-banners': { title: 'Content Management', crumbs: ['Home', 'Content Management', 'Banner Management'] },
  'contentmgmt-themes':  { title: 'Content Management', crumbs: ['Home', 'Content Management', 'Theme Management'] },
  'platform-config': { title: 'Platform Configuration', crumbs: ['Home', 'Platform Configuration'] },
}

const searchCategories = [
  { label: 'Merchant', icon: <Building2 size={13} />, placeholder: 'Search merchants by name, ID, city…' },
  { label: 'Booking', icon: <CalendarCheck size={13} />, placeholder: 'Search by booking ID, guest name…' },
  { label: 'Affiliate', icon: <Users2 size={13} />, placeholder: 'Search affiliates and influencers…' },
  { label: 'Campaign', icon: <Megaphone size={13} />, placeholder: 'Search campaigns and vouchers…' },
  { label: 'User', icon: <UserCog size={13} />, placeholder: 'Search admin users and roles…' },
]

export default function Header({ activePage, impersonation }: { activePage: PageId; impersonation: Impersonation | null }) {
  const info = pageTitles[activePage] ?? { title: 'mTrip', crumbs: ['Home'] }
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchCat, setSearchCat] = useState(0)
  const [searchVal, setSearchVal] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header
      className="flex items-center flex-shrink-0 px-5 gap-4"
      style={{ height: 56, background: '#fff', borderBottom: '1px solid #E3E8F0', zIndex: 20 }}
    >
      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1" style={{ fontSize: 12, color: '#94A3B8' }}>
          {info.crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span style={{ color: '#CBD5E1' }}>/</span>}
              <span style={{
                color: i === info.crumbs.length - 1 ? '#1A2332' : '#94A3B8',
                fontWeight: i === info.crumbs.length - 1 ? 500 : 400,
              }}>{c}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Global search */}
      <div ref={searchRef} className="relative" style={{ width: 300 }}>
        <div
          className="flex items-center gap-2 rounded-md px-3 transition-all"
          style={{
            height: 32,
            background: searchFocused ? '#fff' : '#F8FAFC',
            border: `1px solid ${searchFocused ? '#1664FF' : '#E3E8F0'}`,
            boxShadow: searchFocused ? '0 0 0 3px rgba(22,100,255,0.08)' : 'none',
          }}
        >
          <Search size={13} color={searchFocused ? '#1664FF' : '#94A3B8'} />
          {/* Category pill */}
          <button
            onClick={() => setSearchCat((searchCat + 1) % searchCategories.length)}
            className="flex items-center gap-1 rounded px-1.5 flex-shrink-0 transition-colors"
            style={{ height: 20, fontSize: 11, background: '#EEF4FF', color: '#1664FF', fontWeight: 500 }}
          >
            {searchCategories[searchCat].icon}
            {searchCategories[searchCat].label}
          </button>
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={searchCategories[searchCat].placeholder}
            className="flex-1 bg-transparent outline-none min-w-0"
            style={{ fontSize: 12, color: '#1A2332' }}
          />
          <kbd className="flex items-center justify-center rounded px-1 flex-shrink-0" style={{ fontSize: 10, color: '#94A3B8', background: '#F1F5F9', border: '1px solid #E2E8F0', height: 18 }}>⌘K</kbd>
        </div>

        {/* Dropdown */}
        {searchFocused && (
          <div className="absolute top-full mt-1 left-0 right-0 rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50 }}>
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>SEARCH BY CATEGORY</div>
            </div>
            {searchCategories.map((cat, i) => (
              <button
                key={cat.label}
                onClick={() => { setSearchCat(i); setSearchFocused(false) }}
                className="flex items-center gap-3 w-full px-3 py-2 transition-colors text-left"
                style={{ fontSize: 12, color: i === searchCat ? '#1664FF' : '#475569', background: i === searchCat ? '#EEF4FF' : 'transparent' }}
                onMouseEnter={e => { if (i !== searchCat) e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { if (i !== searchCat) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ color: i === searchCat ? '#1664FF' : '#94A3B8' }}>{cat.icon}</span>
                <span>Search {cat.label}s</span>
                <span className="ml-auto" style={{ fontSize: 11, color: '#CBD5E1' }}>{cat.placeholder}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <div style={{ width: 1, height: 24, background: '#E3E8F0', margin: '0 2px' }} />
        <IconBtn><RefreshCw size={14} /></IconBtn>
        <IconBtn><HelpCircle size={14} /></IconBtn>
        <div className="relative">
          <IconBtn><Bell size={14} /></IconBtn>
          <span className="absolute flex items-center justify-center rounded-full text-white"
            style={{ width: 14, height: 14, background: '#EF4444', fontSize: 9, fontWeight: 700, top: 4, right: 4 }}>
            5
          </span>
        </div>
        <div style={{ width: 1, height: 24, background: '#E3E8F0', margin: '0 2px' }} />

        <button
          className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors"
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
            style={{ width: 28, height: 28, background: impersonation ? '#D97706' : '#1664FF', fontSize: 11 }}
          >
            {impersonation ? 'IM' : 'SA'}
          </div>
          <div className="text-left hidden lg:block">
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332', lineHeight: 1.2 }}>
              {impersonation ? impersonation.merchantName.slice(0, 18) : 'Super Admin'}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.2 }}>
              {impersonation ? 'Impersonating' : 'Full Access'}
            </div>
          </div>
          <ChevronDown size={13} color="#94A3B8" />
        </button>
      </div>
    </header>
  )
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="flex items-center justify-center rounded-md transition-colors"
      style={{ width: 32, height: 32, color: '#64748B' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#1A2332' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B' }}
    >
      {children}
    </button>
  )
}

import { useState } from 'react'
import {
  LayoutDashboard, ShieldCheck, Building2, CalendarCheck,
  Megaphone, Users2, UserCog, BarChart3, Settings, LogOut,
  Globe, ChevronDown, ChevronRight, Circle, Hotel,
  AlertTriangle, Layers, HelpCircle, Users, LayoutGrid, UserCircle2,
  Briefcase, UtensilsCrossed, Lock,
} from 'lucide-react'
import type { PageId } from '../App'

interface NavChild {
  id: PageId
  label: string
  badge?: number
  badgeColor?: string
}

interface NavSubGroup {
  key: string
  label: string
  icon: React.ReactNode
  children: NavChild[]
  placeholder?: boolean
}

interface NavGroup {
  id: PageId
  label: string
  icon: React.ReactNode
  badge?: number
  badgeColor?: string
  children: NavChild[]
  subGroups?: NavSubGroup[]
  // extra page ids that count as "active" for this group (for subgroup-hosted pages)
  extraActiveIds?: PageId[]
}

const BOOKING_CHILDREN: NavChild[] = [
  { id: 'bookings-admin',       label: 'All Bookings' },
  { id: 'bookings-refunds',     label: 'Refund Requests', badge: 5, badgeColor: '#EF4444' },
  { id: 'bookings-settlements', label: 'Settlement & Reconciliation' },
  { id: 'bookings-history',     label: 'Booking History' },
]

const INVENTORY_CHILDREN: NavChild[] = [
  { id: 'inventory',              label: 'Inventory Overview' },
  { id: 'inventory-availability', label: 'Room Availability' },
  { id: 'inventory-detail',       label: 'Room Inventory Detail' },
  { id: 'inventory-timeline',     label: 'Inventory Timeline' },
  { id: 'inventory-calendar',     label: 'Availability Calendar' },
  { id: 'inventory-alerts',       label: 'Inventory Alerts', badge: 4, badgeColor: '#EF4444' },
  { id: 'inventory-reports',      label: 'Inventory Reports' },
]

const BUSINESS_OPS_ACTIVE_IDS: PageId[] = [
  'bookings-admin', 'bookings-refunds', 'bookings-settlements', 'bookings-history',
  'inventory', 'inventory-availability', 'inventory-detail', 'inventory-timeline',
  'inventory-calendar', 'inventory-alerts', 'inventory-reports',
]

const navGroups: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={15} />,
    children: [],
  },
  {
    id: 'verification',
    label: 'Merchant Verification',
    icon: <ShieldCheck size={15} />,
    badge: 9,
    badgeColor: '#F59E0B',
    children: [
      { id: 'verification',            label: 'Pending Review', badge: 7, badgeColor: '#F59E0B' },
      { id: 'verification-approved',   label: 'Approved' },
      { id: 'verification-rejected',   label: 'Rejected' },
      { id: 'verification-resubmission', label: 'Resubmission', badge: 2, badgeColor: '#EF4444' },
    ],
  },
  {
    id: 'merchants',
    label: 'Merchant Management',
    icon: <Building2 size={15} />,
    children: [
      { id: 'merchants',            label: 'All Merchants' },
      { id: 'merchants-documents', label: 'Merchant Documents' },
      { id: 'merchants-suspended', label: 'Suspended', badge: 3, badgeColor: '#EF4444' },
      { id: 'merchants-blacklisted', label: 'Blacklisted', badge: 1, badgeColor: '#DC2626' },
      { id: 'merchants-activities', label: 'Merchant Activities' },
    ],
  },
  {
    // representative id — first page reached when opening this group
    id: 'bookings-admin',
    label: 'Business Operations',
    icon: <Briefcase size={15} />,
    badge: 9,
    badgeColor: '#EF4444',
    children: [],
    extraActiveIds: BUSINESS_OPS_ACTIVE_IDS,
    subGroups: [
      {
        key: 'hotel-ops',
        label: 'Hotel Operations',
        icon: <Hotel size={12} />,
        children: [...BOOKING_CHILDREN, ...INVENTORY_CHILDREN],
      },
      {
        key: 'restaurant-ops',
        label: 'Restaurant Operations',
        icon: <UtensilsCrossed size={12} />,
        children: [],
        placeholder: true,
      },
    ],
  },
  {
    id: 'campaigns',
    label: 'Campaign & Promotion',
    icon: <Megaphone size={15} />,
    children: [
      { id: 'campaigns',            label: 'Campaigns' },
      { id: 'campaigns-promotions', label: 'Promotions' },
      { id: 'campaigns-vouchers',   label: 'Vouchers' },
      { id: 'campaigns-codes',      label: 'Promotion Codes' },
      { id: 'campaigns-welcome',    label: 'Welcome Rewards' },
      { id: 'campaigns-analytics',  label: 'Campaign Analytics' },
    ],
  },
  {
    id: 'affiliates',
    label: 'Affiliate & Influencer',
    icon: <Users2 size={15} />,
    badge: 3,
    badgeColor: '#F59E0B',
    children: [
      { id: 'affiliates',          label: 'Affiliate Applications', badge: 3, badgeColor: '#F59E0B' },
      { id: 'affiliates-partner',  label: 'Partner Directory' },
      { id: 'affiliates-program',  label: 'Affiliate Program' },
      { id: 'affiliates-withdrawals', label: 'Reward Wallet' },
      { id: 'affiliates-fraud',    label: 'Fraud & Compliance', badge: 2, badgeColor: '#DC2626' },
      { id: 'affiliates-codes',    label: 'Affiliate Codes' },
      { id: 'affiliates-referral', label: 'Referral Campaigns', badge: 3, badgeColor: '#14B8A6' },
    ],
  },
  {
    id: 'platform-rules',
    label: 'Platform Rules & Compliance',
    icon: <AlertTriangle size={15} />,
    badge: 4,
    badgeColor: '#EF4444',
    children: [
      { id: 'platform-rules',       label: 'Platform Rules' },
      { id: 'merchant-violations',  label: 'Merchant Violations', badge: 4, badgeColor: '#EF4444' },
      { id: 'warning-history',      label: 'Warning History' },
      { id: 'compliance-history',   label: 'Compliance History' },
    ],
  },
  {
    id: 'users-roles',
    label: 'User & Role Management',
    icon: <UserCog size={15} />,
    children: [
      { id: 'users-roles',             label: 'Users' },
      { id: 'users-roles-list',        label: 'Roles' },
      { id: 'users-roles-permissions', label: 'Permission Matrix' },
      { id: 'users-sessions',          label: 'Active Sessions' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    icon: <BarChart3 size={15} />,
    children: [
      { id: 'reports',              label: 'Executive Dashboard' },
      { id: 'reports-transactions', label: 'Transaction Reports' },
      { id: 'reports-business',     label: 'Business Reports' },
      { id: 'reports-custom',       label: 'Custom Reports' },
    ],
  },
  {
    id: 'endusers',
    label: 'End User Management',
    icon: <Users size={15} />,
    children: [
      { id: 'endusers',              label: 'User Directory' },
      { id: 'endusers-profile',      label: 'User Profile' },
      { id: 'endusers-bookings',     label: 'Booking History' },
      { id: 'endusers-activities',   label: 'User Activities' },
      { id: 'endusers-transactions', label: 'User Transactions' },
      { id: 'endusers-rewards',      label: 'Rewards & Coupons' },
      { id: 'endusers-support',      label: 'User Support' },
      { id: 'endusers-suspended',    label: 'Suspended Users', badge: 2, badgeColor: '#F59E0B' },
      { id: 'endusers-blacklist',    label: 'Blacklist', badge: 1, badgeColor: '#DC2626' },
    ],
  },
  {
    id: 'helpcenter',
    label: 'Help Center Management',
    icon: <HelpCircle size={15} />,
    children: [
      { id: 'helpcenter',               label: 'FAQ Articles' },
      { id: 'helpcenter-categories',    label: 'Categories' },
      { id: 'helpcenter-announcements', label: 'Announcements' },
      { id: 'helpcenter-analytics',     label: 'Search Analytics' },
    ],
  },
  {
    id: 'contentmgmt',
    label: 'Content Management',
    icon: <LayoutGrid size={15} />,
    children: [
      { id: 'contentmgmt-banners', label: 'Banner Management' },
      { id: 'contentmgmt-themes',  label: 'Theme Management' },
    ],
  },
  {
    id: 'platform-config',
    label: 'Platform Configuration',
    icon: <Settings size={15} />,
    children: [],
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ChildBtn({ child, activePage, onNavigate, dimmed }: {
  child: NavChild; activePage: PageId; onNavigate: (p: PageId) => void; dimmed?: boolean
}) {
  const childActive = activePage === child.id
  return (
    <button
      onClick={() => onNavigate(child.id)}
      className="flex items-center gap-2 w-full rounded transition-all"
      style={{
        height: 29, paddingLeft: 8, paddingRight: 6, fontSize: 12,
        fontWeight: childActive ? 500 : 400,
        color: childActive ? '#fff' : dimmed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.42)',
        background: childActive ? 'rgba(22,100,255,0.2)' : 'transparent',
        borderLeft: childActive ? '2px solid #1664FF' : '2px solid transparent',
        cursor: 'pointer', textAlign: 'left',
        opacity: dimmed ? 0.6 : 1,
      }}
      onMouseEnter={e => { if (!childActive) { e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}}
      onMouseLeave={e => { if (!childActive) { e.currentTarget.style.color = dimmed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.42)'; e.currentTarget.style.background = 'transparent' }}}
    >
      <Circle size={3.5} style={{ flexShrink: 0, opacity: childActive ? 1 : 0.5 }} />
      <span className="flex-1 truncate">{child.label}</span>
      {child.badge != null && (
        <span className="rounded-full flex items-center justify-center font-mono flex-shrink-0"
          style={{ minWidth: 16, height: 16, padding: '0 3px', background: child.badgeColor || '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700 }}>
          {child.badge}
        </span>
      )}
    </button>
  )
}

function SubGroupSection({ sub, activePage, onNavigate, expandedSubs, toggleSub }: {
  sub: NavSubGroup; activePage: PageId; onNavigate: (p: PageId) => void
  expandedSubs: Set<string>; toggleSub: (key: string) => void
}) {
  const isExpanded = expandedSubs.has(sub.key)
  const isSubActive = sub.children.some(c => activePage === c.id)

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Sub-section header */}
      <button
        onClick={() => {
          toggleSub(sub.key)
          if (!isExpanded && !sub.placeholder && sub.children.length > 0) {
            onNavigate(sub.children[0].id)
          }
        }}
        className="flex items-center gap-2 w-full rounded transition-all"
        style={{
          height: 30, paddingLeft: 6, paddingRight: 6,
          fontSize: 11.5, fontWeight: isSubActive ? 600 : 500,
          color: isSubActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
          background: isSubActive ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
        onMouseEnter={e => { if (!isSubActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (!isSubActive) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ color: isSubActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{sub.icon}</span>
        <span className="flex-1 truncate">{sub.label}</span>
        {sub.placeholder && (
          <Lock size={9} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginRight: 4 }} />
        )}
        {!sub.placeholder && (
          <span style={{ flexShrink: 0, opacity: 0.35 }}>
            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
        )}
      </button>

      {/* Sub-section children */}
      {!sub.placeholder && isExpanded && sub.children.length > 0 && (
        <div style={{ marginLeft: 14, borderLeft: '1px solid rgba(255,255,255,0.07)', paddingLeft: 6 }}>
          {sub.children.map(child => (
            <ChildBtn key={child.id} child={child} activePage={activePage} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {/* Placeholder state */}
      {sub.placeholder && (
        <div style={{
          marginLeft: 14, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: 6,
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
          fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic',
          borderRadius: 4, margin: '2px 0 2px 14px',
        }}>
          <Lock size={9} />
          Coming soon
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
  onLogout?: () => void
  endUserCtx?: { name: string; avatar: string; tier: string } | null
}

export default function Sidebar({ activePage, onNavigate, onLogout, endUserCtx }: SidebarProps) {
  const defaultOpen = new Set<PageId>(['dashboard', 'verification', 'merchants'])
  const [expanded, setExpanded] = useState<Set<PageId>>(defaultOpen)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set(['hotel-ops']))

  const toggle = (id: PageId) => {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const toggleSub = (key: string) => {
    setExpandedSubs(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  const isGroupActive = (g: NavGroup) => {
    if (g.children.length === 0 && !g.subGroups) return activePage === g.id
    if (g.children.some(c => activePage === c.id) || activePage === g.id) return true
    if (g.extraActiveIds?.includes(activePage)) return true
    if (g.subGroups?.some(sg => sg.children.some(c => activePage === c.id))) return true
    return false
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ width: 228, background: '#0A1628', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-5 flex-shrink-0"
        style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-center rounded-md flex-shrink-0"
          style={{ width: 28, height: 28, background: '#1664FF' }}>
          <Hotel size={15} color="#fff" />
        </div>
        <div>
          <div className="text-white font-semibold leading-none" style={{ fontSize: 13 }}>mTrip</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>Super Admin Portal</div>
        </div>
      </div>

      {/* Env badge */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-1.5 rounded px-2 py-1" style={{ background: 'rgba(22,100,255,0.14)' }}>
          <div className="rounded-full" style={{ width: 6, height: 6, background: '#4ADE80' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Production · v4.2.1</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {navGroups.map((g) => {
          const isActive    = isGroupActive(g)
          const isExpanded  = expanded.has(g.id)
          const hasChildren = g.children.length > 0 || (g.subGroups != null && g.subGroups.length > 0)
          const firstNavId  = g.subGroups
            ? (g.subGroups[0]?.children[0]?.id ?? g.id)
            : g.children[0]?.id ?? g.id

          // Compute children panel content as a local variable (avoids nested-ternary parse issues)
          let childrenContent: React.ReactNode = null
          if (hasChildren && isExpanded) {
            let inner: React.ReactNode
            if (g.subGroups) {
              inner = (
                <div>
                  {g.subGroups.map(sub => (
                    <SubGroupSection
                      key={sub.key}
                      sub={sub}
                      activePage={activePage}
                      onNavigate={onNavigate}
                      expandedSubs={expandedSubs}
                      toggleSub={toggleSub}
                    />
                  ))}
                </div>
              )
            } else if (g.id === 'endusers') {
              const dirOnly         = g.children.filter(c => c.id === 'endusers')
              const userDetailItems = g.children.filter(c =>
                ['endusers-profile','endusers-bookings','endusers-activities',
                 'endusers-transactions','endusers-rewards','endusers-support'].includes(c.id)
              )
              const adminItems = g.children.filter(c => ['endusers-suspended','endusers-blacklist'].includes(c.id))
              inner = (
                <>
                  {dirOnly.map(child => (
                    <ChildBtn key={child.id} child={child} activePage={activePage} onNavigate={onNavigate} />
                  ))}
                  <div style={{ margin: '6px 0 4px', paddingLeft: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Customer 360°</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    </div>
                    {endUserCtx ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'rgba(22,100,255,0.12)', borderRadius: 6, border: '1px solid rgba(22,100,255,0.25)', marginBottom: 4 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1664FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {endUserCtx.avatar.slice(0, 2)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{endUserCtx.name}</div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{endUserCtx.tier} Member</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.1)', marginBottom: 4 }}>
                        <UserCircle2 size={14} color="rgba(255,255,255,0.2)" />
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>No user selected</span>
                      </div>
                    )}
                  </div>
                  {userDetailItems.map(child => (
                    <ChildBtn key={child.id} child={child} activePage={activePage} onNavigate={onNavigate} dimmed={!endUserCtx} />
                  ))}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 0 4px' }} />
                  {adminItems.map(child => (
                    <ChildBtn key={child.id} child={child} activePage={activePage} onNavigate={onNavigate} />
                  ))}
                </>
              )
            } else {
              inner = (
                <>
                  {g.children.map(child => (
                    <ChildBtn key={child.id} child={child} activePage={activePage} onNavigate={onNavigate} />
                  ))}
                </>
              )
            }
            childrenContent = (
              <div className="mt-0.5 mb-1"
                style={{ marginLeft: 18, borderLeft: '1px solid rgba(255,255,255,0.09)', paddingLeft: 8 }}>
                {inner}
              </div>
            )
          }

          return (
            <div key={g.id} className="mb-0.5">
              <button
                onClick={() => {
                  if (!hasChildren) {
                    onNavigate(g.id)
                  } else {
                    toggle(g.id)
                    if (!isExpanded) onNavigate(firstNavId)
                  }
                }}
                className="flex items-center gap-2 w-full rounded-md transition-all"
                style={{
                  height: 34, paddingLeft: 10, paddingRight: 8,
                  fontSize: 12.5, fontWeight: isActive ? 500 : 400,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                  background: isActive && !hasChildren
                    ? 'rgba(22,100,255,0.22)'
                    : isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  borderLeft: isActive && !hasChildren ? '2px solid #1664FF' : '2px solid transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                  else if (hasChildren) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }}>{g.icon}</span>
                <span className="flex-1 truncate" style={{ fontSize: 12 }}>{g.label}</span>
                {g.badge != null && (
                  <span className="rounded-full flex items-center justify-center flex-shrink-0 font-mono"
                    style={{ minWidth: 18, height: 18, padding: '0 4px', background: g.badgeColor || '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                    {g.badge}
                  </span>
                )}
                {hasChildren && (
                  <span style={{ flexShrink: 0, marginLeft: 2, opacity: 0.45 }}>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                )}
              </button>
              {childrenContent}
            </div>
          )
        })}
      </nav>

      {/* Bottom user strip */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2 mb-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
            style={{ width: 28, height: 28, background: '#1664FF', fontSize: 11 }}>
            SA
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Super Admin</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.33)' }} className="truncate">admin@mtrip.com</div>
          </div>
          <Globe size={12} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 w-full rounded-md px-3 transition-colors"
          style={{ height: 32, fontSize: 12, color: 'rgba(255,255,255,0.4)', background: 'transparent', cursor: 'pointer', border: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#FCA5A5' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
        >
          <LogOut size={13} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

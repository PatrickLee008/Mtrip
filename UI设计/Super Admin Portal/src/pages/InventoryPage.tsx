import { useState } from 'react'
import {
  Search, Download, Eye, RefreshCw, AlertTriangle, CheckCircle,
  XCircle, Clock, ChevronLeft, ChevronRight, MoreHorizontal,
  TrendingUp, TrendingDown, Building2, Users, BarChart3,
  Calendar, FileText, Bell, X, SlidersHorizontal, Activity,
  ChevronDown, ChevronUp, Layers,
} from 'lucide-react'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

// ── Data ──────────────────────────────────────────────────────────────────────

interface RoomInventory {
  id: string
  merchantId: string
  merchantName: string
  hotelId: string
  hotelName: string
  city: string
  roomType: string
  totalRooms: number
  available: number
  occupied: number
  reserved: number
  blocked: number
  maintenance: number
  status: 'available' | 'low_inventory' | 'sold_out' | 'maintenance'
  lastSync: string
  syncSource: 'merchant_portal' | 'pms' | 'channel_manager'
  syncStatus: 'synced' | 'pending' | 'failed'
}

const roomInventory: RoomInventory[] = [
  { id: 'RI-001', merchantId: 'M001', merchantName: 'Peninsula Hotels', hotelId: 'H001', hotelName: 'The Peninsula Beijing', city: 'Yangon', roomType: 'Deluxe Room', totalRooms: 120, available: 34, occupied: 72, reserved: 10, blocked: 2, maintenance: 2, status: 'available', lastSync: '2026-07-22 15:30', syncSource: 'pms', syncStatus: 'synced' },
  { id: 'RI-002', merchantId: 'M001', merchantName: 'Peninsula Hotels', hotelId: 'H001', hotelName: 'The Peninsula Beijing', city: 'Yangon', roomType: 'Suite', totalRooms: 30, available: 4, occupied: 22, reserved: 3, blocked: 1, maintenance: 0, status: 'low_inventory', lastSync: '2026-07-22 15:30', syncSource: 'pms', syncStatus: 'synced' },
  { id: 'RI-003', merchantId: 'M001', merchantName: 'Peninsula Hotels', hotelId: 'H002', hotelName: 'The Peninsula Shanghai', city: 'Mandalay', roomType: 'Superior Room', totalRooms: 80, available: 0, occupied: 76, reserved: 4, blocked: 0, maintenance: 0, status: 'sold_out', lastSync: '2026-07-22 14:45', syncSource: 'channel_manager', syncStatus: 'synced' },
  { id: 'RI-004', merchantId: 'M001', merchantName: 'Peninsula Hotels', hotelId: 'H002', hotelName: 'The Peninsula Shanghai', city: 'Mandalay', roomType: 'Executive Room', totalRooms: 40, available: 12, occupied: 24, reserved: 3, blocked: 1, maintenance: 0, status: 'available', lastSync: '2026-07-22 14:45', syncSource: 'channel_manager', syncStatus: 'synced' },
  { id: 'RI-005', merchantId: 'M002', merchantName: 'Sanya Bay Resort', hotelId: 'H003', hotelName: 'Sanya Bay Beach Hotel', city: 'Naypyidaw', roomType: 'Deluxe Ocean View', totalRooms: 200, available: 62, occupied: 118, reserved: 14, blocked: 4, maintenance: 2, status: 'available', lastSync: '2026-07-22 16:00', syncSource: 'merchant_portal', syncStatus: 'synced' },
  { id: 'RI-006', merchantId: 'M002', merchantName: 'Sanya Bay Resort', hotelId: 'H003', hotelName: 'Sanya Bay Beach Hotel', city: 'Naypyidaw', roomType: 'Beach Villa', totalRooms: 24, available: 2, occupied: 20, reserved: 2, blocked: 0, maintenance: 0, status: 'low_inventory', lastSync: '2026-07-22 16:00', syncSource: 'merchant_portal', syncStatus: 'synced' },
  { id: 'RI-007', merchantId: 'M003', merchantName: 'Grand Hotels Group', hotelId: 'H004', hotelName: 'Grand Hyatt Yangon', city: 'Bagan', roomType: 'Deluxe Room', totalRooms: 150, available: 48, occupied: 87, reserved: 11, blocked: 3, maintenance: 1, status: 'available', lastSync: '2026-07-22 15:15', syncSource: 'pms', syncStatus: 'synced' },
  { id: 'RI-008', merchantId: 'M003', merchantName: 'Grand Hotels Group', hotelId: 'H004', hotelName: 'Grand Hyatt Yangon', city: 'Bagan', roomType: 'Executive Suite', totalRooms: 20, available: 0, occupied: 20, reserved: 0, blocked: 0, maintenance: 0, status: 'sold_out', lastSync: '2026-07-22 15:15', syncSource: 'pms', syncStatus: 'synced' },
  { id: 'RI-009', merchantId: 'M003', merchantName: 'Grand Hotels Group', hotelId: 'H005', hotelName: 'Grand Mandalay Palace', city: 'Mandalay', roomType: 'Heritage Room', totalRooms: 60, available: 18, occupied: 34, reserved: 6, blocked: 2, maintenance: 0, status: 'available', lastSync: '2026-07-22 13:50', syncSource: 'pms', syncStatus: 'failed' },
  { id: 'RI-010', merchantId: 'M004', merchantName: 'Hilton Myanmar', hotelId: 'H006', hotelName: 'Hilton Yangon', city: 'Yangon', roomType: 'King Room', totalRooms: 90, available: 22, occupied: 58, reserved: 7, blocked: 2, maintenance: 1, status: 'available', lastSync: '2026-07-22 15:55', syncSource: 'channel_manager', syncStatus: 'synced' },
  { id: 'RI-011', merchantId: 'M004', merchantName: 'Hilton Myanmar', hotelId: 'H006', hotelName: 'Hilton Yangon', city: 'Yangon', roomType: 'Executive Room', totalRooms: 45, available: 3, occupied: 38, reserved: 3, blocked: 1, maintenance: 0, status: 'low_inventory', lastSync: '2026-07-22 15:55', syncSource: 'channel_manager', syncStatus: 'synced' },
  { id: 'RI-012', merchantId: 'M004', merchantName: 'Hilton Myanmar', hotelId: 'H007', hotelName: 'Hilton Naypyidaw', city: 'Naypyidaw', roomType: 'Deluxe Room', totalRooms: 100, available: 41, occupied: 48, reserved: 8, blocked: 2, maintenance: 1, status: 'available', lastSync: '2026-07-22 14:20', syncSource: 'channel_manager', syncStatus: 'pending' },
  { id: 'RI-013', merchantId: 'M005', merchantName: 'Shan Palace Resorts', hotelId: 'H008', hotelName: 'Inle Lake Resort', city: 'Inle Lake', roomType: 'Lake View Bungalow', totalRooms: 36, available: 0, occupied: 30, reserved: 4, blocked: 0, maintenance: 2, status: 'maintenance', lastSync: '2026-07-22 09:00', syncSource: 'merchant_portal', syncStatus: 'synced' },
  { id: 'RI-014', merchantId: 'M005', merchantName: 'Shan Palace Resorts', hotelId: 'H008', hotelName: 'Inle Lake Resort', city: 'Inle Lake', roomType: 'Garden Room', totalRooms: 48, available: 14, occupied: 28, reserved: 4, blocked: 2, maintenance: 0, status: 'available', lastSync: '2026-07-22 09:00', syncSource: 'merchant_portal', syncStatus: 'synced' },
  { id: 'RI-015', merchantId: 'M005', merchantName: 'Shan Palace Resorts', hotelId: 'H009', hotelName: 'Bagan Heritage Hotel', city: 'Bagan', roomType: 'Temple View Suite', totalRooms: 18, available: 1, occupied: 15, reserved: 2, blocked: 0, maintenance: 0, status: 'low_inventory', lastSync: '2026-07-22 10:30', syncSource: 'merchant_portal', syncStatus: 'synced' },
]

interface TimelineEvent {
  id: string
  time: string
  date: string
  merchantName: string
  hotelName: string
  roomType: string
  eventType: 'inventory_increase' | 'inventory_decrease' | 'booking' | 'checkout' | 'sync' | 'block' | 'unblock' | 'maintenance'
  description: string
  quantityChange: number | null
  source: string
  updatedBy: string
}

const timelineEvents: TimelineEvent[] = [
  { id: 'TE-001', time: '09:00', date: '2026-07-22', merchantName: 'Peninsula Hotels', hotelName: 'The Peninsula Beijing', roomType: 'Deluxe Room', eventType: 'inventory_increase', description: 'Merchant increased Deluxe Room inventory from 30 to 35.', quantityChange: 5, source: 'Merchant Portal', updatedBy: 'Hotel Manager' },
  { id: 'TE-002', time: '09:22', date: '2026-07-22', merchantName: 'Grand Hotels Group', hotelName: 'Grand Hyatt Yangon', roomType: 'Executive Suite', eventType: 'booking', description: 'Customer booked 1 Executive Suite (Booking #B-28401).', quantityChange: -1, source: 'Customer Booking', updatedBy: 'System' },
  { id: 'TE-003', time: '09:30', date: '2026-07-22', merchantName: 'Hilton Myanmar', hotelName: 'Hilton Yangon', roomType: 'King Room', eventType: 'checkout', description: 'Guest checked out. 1 King Room became available.', quantityChange: 1, source: 'Customer Check-out', updatedBy: 'System' },
  { id: 'TE-004', time: '10:05', date: '2026-07-22', merchantName: 'Peninsula Hotels', hotelName: 'The Peninsula Shanghai', roomType: 'Superior Room', eventType: 'booking', description: 'Customer booked 2 Superior Rooms (Booking #B-28402).', quantityChange: -2, source: 'Customer Booking', updatedBy: 'System' },
  { id: 'TE-005', time: '10:45', date: '2026-07-22', merchantName: 'Sanya Bay Resort', hotelName: 'Sanya Bay Beach Hotel', roomType: 'Beach Villa', eventType: 'block', description: 'Merchant blocked 2 Beach Villas for VIP maintenance.', quantityChange: -2, source: 'Merchant Portal', updatedBy: 'Resort Manager' },
  { id: 'TE-006', time: '11:00', date: '2026-07-22', merchantName: 'Grand Hotels Group', hotelName: 'Grand Hyatt Yangon', roomType: 'Deluxe Room', eventType: 'sync', description: 'Inventory synchronized from PMS. 3 records updated.', quantityChange: null, source: 'PMS Integration', updatedBy: 'System' },
  { id: 'TE-007', time: '11:20', date: '2026-07-22', merchantName: 'Hilton Myanmar', hotelName: 'Hilton Naypyidaw', roomType: 'Deluxe Room', eventType: 'checkout', description: 'Guest checked out. 1 Deluxe Room became available.', quantityChange: 1, source: 'Customer Check-out', updatedBy: 'System' },
  { id: 'TE-008', time: '12:00', date: '2026-07-22', merchantName: 'Peninsula Hotels', hotelName: 'The Peninsula Beijing', roomType: 'Suite', eventType: 'booking', description: 'Customer booked 1 Suite (Booking #B-28405).', quantityChange: -1, source: 'Customer Booking', updatedBy: 'System' },
  { id: 'TE-009', time: '12:30', date: '2026-07-22', merchantName: 'Shan Palace Resorts', hotelName: 'Bagan Heritage Hotel', roomType: 'Temple View Suite', eventType: 'inventory_decrease', description: 'Merchant reduced Temple View Suite inventory from 20 to 18 for renovation.', quantityChange: -2, source: 'Merchant Portal', updatedBy: 'Property Manager' },
  { id: 'TE-010', time: '13:00', date: '2026-07-22', merchantName: 'Grand Hotels Group', hotelName: 'Grand Mandalay Palace', roomType: 'Heritage Room', eventType: 'sync', description: 'Sync failed — PMS connection timed out. Retrying in 15 minutes.', quantityChange: null, source: 'PMS Integration', updatedBy: 'System' },
  { id: 'TE-011', time: '13:45', date: '2026-07-22', merchantName: 'Sanya Bay Resort', hotelName: 'Sanya Bay Beach Hotel', roomType: 'Deluxe Ocean View', eventType: 'checkout', description: '3 guests checked out. 3 Deluxe Ocean View rooms became available.', quantityChange: 3, source: 'Customer Check-out', updatedBy: 'System' },
  { id: 'TE-012', time: '14:10', date: '2026-07-22', merchantName: 'Hilton Myanmar', hotelName: 'Hilton Yangon', roomType: 'Executive Room', eventType: 'booking', description: 'Customer booked 1 Executive Room (Booking #B-28410).', quantityChange: -1, source: 'Customer Booking', updatedBy: 'System' },
  { id: 'TE-013', time: '14:30', date: '2026-07-22', merchantName: 'Shan Palace Resorts', hotelName: 'Inle Lake Resort', roomType: 'Lake View Bungalow', eventType: 'maintenance', description: '2 Lake View Bungalows moved to maintenance — plumbing repair scheduled.', quantityChange: -2, source: 'Merchant Portal', updatedBy: 'Maintenance Team' },
  { id: 'TE-014', time: '15:00', date: '2026-07-22', merchantName: 'Peninsula Hotels', hotelName: 'The Peninsula Beijing', roomType: 'Deluxe Room', eventType: 'sync', description: 'Inventory synchronized from PMS. All records up to date.', quantityChange: null, source: 'PMS Integration', updatedBy: 'System' },
  { id: 'TE-015', time: '15:30', date: '2026-07-22', merchantName: 'Grand Hotels Group', hotelName: 'Grand Hyatt Yangon', roomType: 'Executive Suite', eventType: 'booking', description: 'Customer booked 1 Executive Suite (Booking #B-28415). Suite now sold out.', quantityChange: -1, source: 'Customer Booking', updatedBy: 'System' },
  { id: 'TE-016', time: '15:45', date: '2026-07-22', merchantName: 'Sanya Bay Resort', hotelName: 'Sanya Bay Beach Hotel', roomType: 'Beach Villa', eventType: 'unblock', description: '1 Beach Villa returned from maintenance — now available.', quantityChange: 1, source: 'Merchant Portal', updatedBy: 'Resort Manager' },
  { id: 'TE-017', time: '16:00', date: '2026-07-22', merchantName: 'Hilton Myanmar', hotelName: 'Hilton Naypyidaw', roomType: 'Deluxe Room', eventType: 'sync', description: 'Channel Manager sync completed. 8 rooms updated across OTA channels.', quantityChange: null, source: 'Channel Manager', updatedBy: 'System' },
  { id: 'TE-018', time: '16:20', date: '2026-07-22', merchantName: 'Peninsula Hotels', hotelName: 'The Peninsula Shanghai', roomType: 'Superior Room', eventType: 'booking', description: 'Customer booked 1 Superior Room (Booking #B-28420). Room now sold out.', quantityChange: -1, source: 'Customer Booking', updatedBy: 'System' },
]

interface InventoryAlert {
  id: string
  priority: 'high' | 'medium' | 'low'
  merchantName: string
  hotelName: string
  roomType: string
  alertType: 'sold_out' | 'low_inventory' | 'sync_failed' | 'maintenance' | 'restored'
  description: string
  createdAt: string
  status: 'open' | 'acknowledged' | 'resolved'
}

const inventoryAlerts: InventoryAlert[] = [
  { id: 'AL-001', priority: 'high', merchantName: 'Grand Hotels Group', hotelName: 'Grand Hyatt Yangon', roomType: 'Executive Suite', alertType: 'sold_out', description: 'Executive Suite is fully booked. No rooms available.', createdAt: '2026-07-22 15:30', status: 'open' },
  { id: 'AL-002', priority: 'high', merchantName: 'Peninsula Hotels', hotelName: 'The Peninsula Shanghai', roomType: 'Superior Room', alertType: 'sold_out', description: 'Superior Room fully booked for the next 3 days.', createdAt: '2026-07-22 16:18', status: 'open' },
  { id: 'AL-003', priority: 'high', merchantName: 'Grand Hotels Group', hotelName: 'Grand Mandalay Palace', roomType: 'All Room Types', alertType: 'sync_failed', description: 'PMS synchronization failed at 13:00. Inventory data may be stale.', createdAt: '2026-07-22 13:00', status: 'open' },
  { id: 'AL-004', priority: 'high', merchantName: 'Hilton Myanmar', hotelName: 'Hilton Naypyidaw', roomType: 'All Room Types', alertType: 'sync_failed', description: 'Channel Manager sync pending for over 2 hours. Rooms may be oversold.', createdAt: '2026-07-22 14:20', status: 'acknowledged' },
  { id: 'AL-005', priority: 'medium', merchantName: 'Peninsula Hotels', hotelName: 'The Peninsula Beijing', roomType: 'Suite', alertType: 'low_inventory', description: 'Suite inventory below threshold — only 4 rooms remaining.', createdAt: '2026-07-22 12:00', status: 'open' },
  { id: 'AL-006', priority: 'medium', merchantName: 'Sanya Bay Resort', hotelName: 'Sanya Bay Beach Hotel', roomType: 'Beach Villa', alertType: 'low_inventory', description: 'Beach Villa inventory critically low — 2 rooms remaining.', createdAt: '2026-07-22 10:45', status: 'open' },
  { id: 'AL-007', priority: 'medium', merchantName: 'Hilton Myanmar', hotelName: 'Hilton Yangon', roomType: 'Executive Room', alertType: 'low_inventory', description: 'Executive Room inventory below 10% threshold.', createdAt: '2026-07-22 14:10', status: 'acknowledged' },
  { id: 'AL-008', priority: 'medium', merchantName: 'Shan Palace Resorts', hotelName: 'Bagan Heritage Hotel', roomType: 'Temple View Suite', alertType: 'low_inventory', description: 'Only 1 Temple View Suite remaining — near sold out.', createdAt: '2026-07-22 12:30', status: 'open' },
  { id: 'AL-009', priority: 'low', merchantName: 'Shan Palace Resorts', hotelName: 'Inle Lake Resort', roomType: 'Lake View Bungalow', alertType: 'maintenance', description: '2 Lake View Bungalows moved to maintenance status.', createdAt: '2026-07-22 14:30', status: 'open' },
  { id: 'AL-010', priority: 'low', merchantName: 'Shan Palace Resorts', hotelName: 'Bagan Heritage Hotel', roomType: 'Temple View Suite', alertType: 'maintenance', description: 'Inventory reduced from 20 to 18 for scheduled renovation.', createdAt: '2026-07-22 12:30', status: 'acknowledged' },
  { id: 'AL-011', priority: 'low', merchantName: 'Sanya Bay Resort', hotelName: 'Sanya Bay Beach Hotel', roomType: 'Beach Villa', alertType: 'restored', description: '1 Beach Villa restored from maintenance — now available.', createdAt: '2026-07-22 15:45', status: 'resolved' },
  { id: 'AL-012', priority: 'low', merchantName: 'Grand Hotels Group', hotelName: 'Grand Hyatt Yangon', roomType: 'Deluxe Room', alertType: 'restored', description: 'PMS sync restored after connectivity issue. All data current.', createdAt: '2026-07-22 11:00', status: 'resolved' },
]

// ── Shared UI components ───────────────────────────────────────────────────────

function AvailBadge({ status }: { status: RoomInventory['status'] }) {
  const cfg = {
    available:     { bg: '#ECFDF3', color: '#027A48', label: 'Available' },
    low_inventory: { bg: '#FFFAEB', color: '#B54708', label: 'Low Inventory' },
    sold_out:      { bg: '#FFF1F3', color: '#BE123C', label: 'Sold Out' },
    maintenance:   { bg: '#F1F5F9', color: '#475569', label: 'Maintenance' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{c.label}</span>
}

function SyncBadge({ status }: { status: RoomInventory['syncStatus'] }) {
  const cfg = {
    synced:  { bg: '#ECFDF3', color: '#027A48', label: 'Synced' },
    pending: { bg: '#FFFAEB', color: '#B54708', label: 'Pending' },
    failed:  { bg: '#FFF1F3', color: '#BE123C', label: 'Failed' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{c.label}</span>
}

function AlertPriorityBadge({ priority }: { priority: InventoryAlert['priority'] }) {
  const cfg = {
    high:   { bg: '#FFF1F3', color: '#BE123C', label: 'High' },
    medium: { bg: '#FFFAEB', color: '#B54708', label: 'Medium' },
    low:    { bg: '#EFF6FF', color: '#1D4ED8', label: 'Low' },
  }
  const c = cfg[priority]
  return <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{c.label}</span>
}

function AlertStatusBadge({ status }: { status: InventoryAlert['status'] }) {
  const cfg = {
    open:         { bg: '#FFF1F3', color: '#BE123C', label: 'Open' },
    acknowledged: { bg: '#FFFAEB', color: '#B54708', label: 'Acknowledged' },
    resolved:     { bg: '#ECFDF3', color: '#027A48', label: 'Resolved' },
  }
  const c = cfg[status]
  return <span className="inline-flex items-center rounded px-1.5 font-medium capitalize" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>{c.label}</span>
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
  return (
    <div style={{ position: 'relative' }}>
      <ActionBtn color="#64748B" onClick={() => setOpen(o => !o)} title="More">
        <MoreHorizontal size={14} />
      </ActionBtn>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 100, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 180, padding: '4px 0' }}>
          {items.map((item, i) => (
            <div key={i}>
              {item.divider && i > 0 && <div style={{ height: 1, background: '#F1F5F9', margin: '4px 0' }} />}
              <button onClick={() => { item.onClick(); setOpen(false) }}
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

function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory & Availability</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{title}</h1>
        <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>{subtitle}</p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

function KpiCard({ label, value, sub, color, bg, icon: Icon, trend }: { label: string; value: string | number; sub: string; color: string; bg: string; icon: React.ComponentType<{ size?: number; color?: string }>; trend?: 'up' | 'down' | null }) {
  return (
    <div className="rounded-lg p-3.5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
      <div className="flex items-center justify-between mb-2">
        <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{label}</div>
        <div className="flex items-center justify-center rounded-md" style={{ width: 28, height: 28, background: bg }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'monospace', marginBottom: 3 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="flex items-center gap-1">
        {trend === 'up' && <TrendingUp size={11} color="#059669" />}
        {trend === 'down' && <TrendingDown size={11} color="#DC2626" />}
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</span>
      </div>
    </div>
  )
}

// ── 1. Inventory Overview ─────────────────────────────────────────────────────

function InventoryOverviewPage({ showToast }: { showToast: Props['showToast'] }) {
  const totalRooms = roomInventory.reduce((s, r) => s + r.totalRooms, 0)
  const totalAvailable = roomInventory.reduce((s, r) => s + r.available, 0)
  const totalOccupied = roomInventory.reduce((s, r) => s + r.occupied, 0)
  const occupancyRate = totalRooms > 0 ? Math.round(totalOccupied / totalRooms * 100) : 0
  const soldOutTypes = roomInventory.filter(r => r.status === 'sold_out').length
  const lowInventoryHotels = roomInventory.filter(r => r.status === 'low_inventory').length
  const uniqueMerchants = new Set(roomInventory.map(r => r.merchantId)).size
  const uniqueHotels = new Set(roomInventory.map(r => r.hotelId)).size

  const kpis = [
    { label: 'Total Merchants',      value: uniqueMerchants,          sub: 'With active inventory',         color: '#1664FF', bg: '#EEF4FF', icon: Building2,     trend: null as null },
    { label: 'Total Hotels',         value: uniqueHotels,             sub: 'Across all merchants',           color: '#7C3AED', bg: '#F5F3FF', icon: Building2,     trend: 'up' as const },
    { label: 'Total Rooms',          value: totalRooms,               sub: 'Platform-wide inventory',        color: '#0891B2', bg: '#ECFEFF', icon: Layers,        trend: null as null },
    { label: 'Available Rooms',      value: totalAvailable,           sub: 'Ready to book right now',        color: '#059669', bg: '#ECFDF3', icon: CheckCircle,   trend: 'up' as const },
    { label: 'Occupied Rooms',       value: totalOccupied,            sub: 'Currently checked in',           color: '#D97706', bg: '#FFFBEB', icon: Users,         trend: null as null },
    { label: 'Occupancy Rate',       value: `${occupancyRate}%`,      sub: 'Platform-wide average',          color: '#BE123C', bg: '#FFF1F3', icon: BarChart3,     trend: 'up' as const },
    { label: 'Sold Out Room Types',  value: soldOutTypes,             sub: 'Zero availability',              color: '#DC2626', bg: '#FFF1F3', icon: XCircle,       trend: 'down' as const },
    { label: 'Low Inventory Hotels', value: lowInventoryHotels,       sub: 'Below 10% availability',         color: '#F59E0B', bg: '#FFFBEB', icon: AlertTriangle, trend: null as null },
    { label: 'Inventory Updates',    value: timelineEvents.length,    sub: 'Changes recorded today',         color: '#6D28D9', bg: '#F5F3FF', icon: Activity,      trend: 'up' as const },
  ]

  // Hotel summary derived from roomInventory grouped by hotel
  const hotelSummaryMap = new Map<string, { merchantName: string; hotelName: string; available: number; occupied: number; total: number }>()
  for (const r of roomInventory) {
    const existing = hotelSummaryMap.get(r.hotelId)
    if (existing) {
      existing.available += r.available
      existing.occupied += r.occupied
      existing.total += r.totalRooms
    } else {
      hotelSummaryMap.set(r.hotelId, { merchantName: r.merchantName, hotelName: r.hotelName, available: r.available, occupied: r.occupied, total: r.totalRooms })
    }
  }
  const hotelSummary = Array.from(hotelSummaryMap.values())

  // Top 5 by occupancy
  const topByOccupancy = [...hotelSummary]
    .map(h => ({ ...h, rate: h.total > 0 ? Math.round(h.occupied / h.total * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5)

  // Low inventory list
  const lowInventoryList = roomInventory
    .filter(r => r.status === 'low_inventory' || r.status === 'sold_out')
    .sort((a, b) => a.available - b.available)
    .slice(0, 5)

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      <PageHeader title="Inventory Overview" subtitle="Platform-wide room inventory monitoring across all merchants">
        <button onClick={() => showToast('info', 'Refreshing', 'Inventory data refreshing from all sources...')}
          className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <RefreshCw size={13} /> Refresh
        </button>
        <button onClick={() => showToast('info', 'Export', 'Inventory overview exported.')}
          className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export
        </button>
      </PageHeader>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 mb-5" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <Activity size={14} color="#1D4ED8" />
        <span style={{ fontSize: 12, color: '#1D4ED8' }}>
          <strong>Monitoring Only</strong> — Super Admin can monitor inventory but cannot directly modify merchant room inventory. Updates come from Merchant Portal, customer bookings/check-outs, PMS, and Channel Manager integrations.
        </span>
      </div>

      {/* KPI Grid (9 cards) */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Top Hotels by Occupancy */}
        <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Top Hotels by Occupancy Rate</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Highest occupancy hotels across the platform today</div>
          {topByOccupancy.map((h, i) => {
            const barColor = h.rate >= 90 ? '#DC2626' : h.rate >= 75 ? '#D97706' : '#1664FF'
            return (
              <div key={h.hotelName} className="flex items-center gap-3 mb-3">
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: i < 3 ? '#1664FF' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: i < 3 ? '#fff' : '#94A3B8' }}>{i + 1}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332', marginBottom: 3 }}>{h.hotelName}</div>
                  <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${h.rate}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: barColor, fontFamily: 'monospace', minWidth: 40, textAlign: 'right' }}>{h.rate}%</div>
              </div>
            )
          })}
          <div className="flex items-center gap-4 mt-2 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
            {[{ label: '≥90%', color: '#DC2626' }, { label: '75–90%', color: '#D97706' }, { label: '<75%', color: '#1664FF' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                <span style={{ fontSize: 11, color: '#64748B' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Inventory Alerts Summary */}
        <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Low Inventory Hotels</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>Hotels requiring immediate attention — sold out or critically low</div>
          <div className="space-y-2">
            {lowInventoryList.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: r.status === 'sold_out' ? '#FFF1F3' : '#FFFBEB', border: `1px solid ${r.status === 'sold_out' ? '#FECDD3' : '#FDE68A'}` }}>
                {r.status === 'sold_out'
                  ? <XCircle size={14} color="#BE123C" />
                  : <AlertTriangle size={14} color="#B54708" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{r.hotelName}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{r.roomType}</div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 13, fontWeight: 700, color: r.status === 'sold_out' ? '#BE123C' : '#B54708', fontFamily: 'monospace' }}>
                    {r.available}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>available</div>
                </div>
                <AvailBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>Hotel Inventory Summary</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>{hotelSummary.length} hotels monitored</div>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Merchant', 'Hotel', 'Available Rooms', 'Occupied Rooms', 'Occupancy Rate', 'Status'].map(h => (
                <th key={h} className="text-left px-4" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hotelSummary.map((h, i) => {
              const rate = h.total > 0 ? Math.round(h.occupied / h.total * 100) : 0
              const availRate = h.total > 0 ? h.available / h.total : 0
              const status: RoomInventory['status'] = availRate === 0 ? 'sold_out' : availRate < 0.1 ? 'low_inventory' : 'available'
              return (
                <tr key={h.hotelName + i} style={{ borderBottom: '1px solid #F8FAFC' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="px-4 py-3" style={{ fontSize: 12, color: '#64748B' }}>{h.merchantName}</td>
                  <td className="px-4 py-3" style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{h.hotelName}</td>
                  <td className="px-4 py-3" style={{ fontSize: 13, fontWeight: 600, color: '#059669', fontFamily: 'monospace' }}>{h.available}</td>
                  <td className="px-4 py-3" style={{ fontSize: 13, color: '#1A2332', fontFamily: 'monospace' }}>{h.occupied}</td>
                  <td className="px-4 py-3" style={{ minWidth: 140 }}>
                    <div className="flex items-center gap-2">
                      <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${rate}%`, height: '100%', background: rate >= 90 ? '#DC2626' : rate >= 75 ? '#D97706' : '#1664FF', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', minWidth: 36, color: '#1A2332' }}>{rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><AvailBadge status={status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 2. Room Availability ───────────────────────────────────────────────────────

function RoomAvailabilityPage({ showToast }: { showToast: Props['showToast'] }) {
  const [search, setSearch] = useState('')
  const [filterMerchant, setFilterMerchant] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [detailRoom, setDetailRoom] = useState<RoomInventory | null>(null)
  const perPage = 10

  const filtered = roomInventory.filter(r => {
    if (search && !r.hotelName.toLowerCase().includes(search.toLowerCase()) &&
        !r.merchantName.toLowerCase().includes(search.toLowerCase()) &&
        !r.roomType.toLowerCase().includes(search.toLowerCase())) return false
    if (filterMerchant && r.merchantName !== filterMerchant) return false
    if (filterCity && r.city !== filterCity) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  const total = filtered.length
  const rows = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const merchants = [...new Set(roomInventory.map(r => r.merchantName))]
  const cities = [...new Set(roomInventory.map(r => r.city))]

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      <PageHeader title="Room Availability" subtitle="Platform-wide room availability status across all merchants and hotels">
        <button onClick={() => showToast('info', 'Export', 'Room availability data exported.')}
          className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export
        </button>
      </PageHeader>

      {/* Stats bar */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Available', value: roomInventory.filter(r => r.status === 'available').length, color: '#059669', bg: '#ECFDF3' },
          { label: 'Low Inventory', value: roomInventory.filter(r => r.status === 'low_inventory').length, color: '#B54708', bg: '#FFFAEB' },
          { label: 'Sold Out', value: roomInventory.filter(r => r.status === 'sold_out').length, color: '#BE123C', bg: '#FFF1F3' },
          { label: 'Maintenance', value: roomInventory.filter(r => r.status === 'maintenance').length, color: '#475569', bg: '#F1F5F9' },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-3 flex items-center gap-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, background: s.bg }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#64748B' }}>{s.label} Room Types</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap" style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, padding: '10px 14px' }}>
        <SlidersHorizontal size={13} color="#94A3B8" />
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search hotel or room type…"
          className="outline-none" style={{ fontSize: 13, color: '#1A2332', minWidth: 220, background: 'transparent' }} />
        <div style={{ width: 1, height: 20, background: '#E3E8F0' }} />
        <select value={filterMerchant} onChange={e => { setFilterMerchant(e.target.value); setPage(1) }}
          style={{ fontSize: 12, color: filterMerchant ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterMerchant ? '#F0F6FF' : '#fff' }}>
          <option value="">All Merchants</option>
          {merchants.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterCity} onChange={e => { setFilterCity(e.target.value); setPage(1) }}
          style={{ fontSize: 12, color: filterCity ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterCity ? '#F0F6FF' : '#fff' }}>
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          style={{ fontSize: 12, color: filterStatus ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterStatus ? '#F0F6FF' : '#fff' }}>
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="low_inventory">Low Inventory</option>
          <option value="sold_out">Sold Out</option>
          <option value="maintenance">Maintenance</option>
        </select>
        {(search || filterMerchant || filterCity || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterMerchant(''); setFilterCity(''); setFilterStatus(''); setPage(1) }}
            className="flex items-center gap-1 rounded-md px-2" style={{ height: 28, fontSize: 12, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
            <X size={11} /> Clear
          </button>
        )}
        <div className="ml-auto" style={{ fontSize: 12, color: '#94A3B8' }}>{total} room types</div>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Merchant', 'Hotel', 'Room Type', 'Total', 'Available', 'Occupied', 'Reserved', 'Blocked', 'Last Sync', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-3" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                onClick={() => setDetailRoom(r)}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FBFF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-3" style={{ height: 48, fontSize: 12, color: '#64748B' }}>{r.merchantName}</td>
                <td className="px-3" style={{ fontSize: 13, fontWeight: 500, color: '#1A2332', maxWidth: 180 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.hotelName}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>{r.city}</div>
                </td>
                <td className="px-3" style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{r.roomType}</td>
                <td className="px-3" style={{ fontSize: 12, fontFamily: 'monospace', color: '#1A2332' }}>{r.totalRooms}</td>
                <td className="px-3">
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: r.available === 0 ? '#BE123C' : r.available < 5 ? '#B54708' : '#059669' }}>{r.available}</span>
                </td>
                <td className="px-3" style={{ fontSize: 12, fontFamily: 'monospace', color: '#1A2332' }}>{r.occupied}</td>
                <td className="px-3" style={{ fontSize: 12, fontFamily: 'monospace', color: '#7C3AED' }}>{r.reserved}</td>
                <td className="px-3" style={{ fontSize: 12, fontFamily: 'monospace', color: '#94A3B8' }}>{r.blocked}</td>
                <td className="px-3">
                  <div style={{ fontSize: 11, color: '#64748B' }}>{r.lastSync.split(' ')[1]}</div>
                  <SyncBadge status={r.syncStatus} />
                </td>
                <td className="px-3" onClick={e => e.stopPropagation()}><AvailBadge status={r.status} /></td>
                <td className="px-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <ActionBtn title="View details" onClick={() => setDetailRoom(r)} color="#1664FF"><Eye size={12} /></ActionBtn>
                    <MoreMenu items={[
                      { label: 'View Details', icon: <Eye size={13} />, onClick: () => setDetailRoom(r) },
                      { label: 'View Timeline', icon: <Clock size={13} />, onClick: () => showToast('info', r.hotelName, `Timeline for ${r.roomType}`) },
                      { label: 'Sync History', icon: <RefreshCw size={13} />, onClick: () => showToast('info', 'Sync History', `Last sync: ${r.lastSync}`) },
                    ]} />
                  </div>
                </td>
              </tr>
            ))}
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
      {detailRoom && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={() => setDetailRoom(null)}>
          <div style={{ flex: 1, background: 'rgba(15,23,42,0.35)' }} />
          <div style={{ width: 520, background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{detailRoom.roomType}</h2>
                <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{detailRoom.hotelName} · {detailRoom.id}</p>
              </div>
              <button onClick={() => setDetailRoom(null)} className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, border: '1px solid #E3E8F0' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={14} color="#64748B" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <RoomDetailContent room={detailRoom} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared detail content (used by both drawer and detail page)
function RoomDetailContent({ room }: { room: RoomInventory }) {
  const occ = room.totalRooms > 0 ? Math.round(room.occupied / room.totalRooms * 100) : 0

  const syncSourceLabels: Record<string, string> = {
    merchant_portal: 'Merchant Portal',
    pms: 'PMS Integration',
    channel_manager: 'Channel Manager',
  }

  const todayCheckIns = Math.floor(room.occupied * 0.12)
  const todayCheckOuts = Math.floor(room.occupied * 0.09)
  const remaining = room.available

  return (
    <>
      {/* General Info */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>General Information</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {[
            { label: 'Merchant', value: room.merchantName },
            { label: 'Hotel', value: room.hotelName },
            { label: 'Room Type', value: room.roomType },
            { label: 'City', value: room.city },
            { label: 'Total Inventory', value: String(room.totalRooms) + ' rooms' },
            { label: 'Inventory ID', value: room.id },
          ].map(f => (
            <div key={f.label} className="rounded-lg px-3 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Status */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Current Status</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { label: 'Available', value: room.available, color: '#059669' },
            { label: 'Occupied', value: room.occupied, color: '#D97706' },
            { label: 'Reserved', value: room.reserved, color: '#7C3AED' },
            { label: 'Blocked', value: room.blocked, color: '#94A3B8' },
            { label: 'Maintenance', value: room.maintenance, color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3 text-center" style={{ border: '1px solid #E3E8F0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Occupancy bar */}
        <div className="rounded-lg px-3 py-3 mt-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
          <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 12 }}>
            <span style={{ color: '#94A3B8' }}>Occupancy Rate</span>
            <span style={{ color: '#1A2332', fontWeight: 600 }}>{occ}%</span>
          </div>
          <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${occ}%`, height: '100%', background: occ >= 90 ? '#DC2626' : occ >= 75 ? '#D97706' : '#1664FF', borderRadius: 4 }} />
          </div>
          <div className="flex items-center justify-between mt-1" style={{ fontSize: 10, color: '#94A3B8' }}>
            <span>0%</span><span>100%</span>
          </div>
        </div>
      </div>

      {/* Today's Activity */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Today's Activity</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { label: 'Check-ins', value: todayCheckIns, color: '#1664FF', icon: TrendingDown },
            { label: 'Check-outs', value: todayCheckOuts, color: '#059669', icon: TrendingUp },
            { label: 'Remaining', value: remaining, color: '#D97706', icon: Layers },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3 text-center" style={{ border: '1px solid #E3E8F0', background: '#FAFBFC' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Status */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Synchronization Status</div>
        <div className="rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
          {[
            { label: 'Last Sync Time', value: room.lastSync },
            { label: 'Sync Source', value: syncSourceLabels[room.syncSource] },
            { label: 'Sync Status', value: <SyncBadge status={room.syncStatus} /> },
            { label: 'Last Sync Result', value: room.syncStatus === 'synced' ? 'All records updated successfully' : room.syncStatus === 'pending' ? 'Sync in progress...' : 'Connection timeout — retry scheduled' },
          ].map(f => (
            <div key={f.label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 12, color: '#64748B' }}>{f.label}</span>
              {typeof f.value === 'string'
                ? <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{f.value}</span>
                : f.value}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── 3. Room Inventory Detail ───────────────────────────────────────────────────

function RoomInventoryDetailPage({ showToast }: { showToast: Props['showToast'] }) {
  const defaultRoom = roomInventory[0]
  const [selectedId, setSelectedId] = useState(defaultRoom.id)
  const room = roomInventory.find(r => r.id === selectedId) ?? defaultRoom

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      <PageHeader title="Room Inventory Detail" subtitle="Complete inventory information for a specific room type at a hotel">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          style={{ fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', borderRadius: 6, padding: '7px 12px', outline: 'none', background: '#fff', minWidth: 280 }}>
          {roomInventory.map(r => (
            <option key={r.id} value={r.id}>{r.hotelName} — {r.roomType}</option>
          ))}
        </select>
        <button onClick={() => showToast('info', 'Refreshing', `Refreshing ${room.roomType} inventory...`)}
          className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <RefreshCw size={13} /> Refresh
        </button>
      </PageHeader>

      <div className="flex items-center justify-between rounded-lg px-4 py-3 mb-5" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <div className="flex items-center gap-2">
          <Activity size={14} color="#1D4ED8" />
          <span style={{ fontSize: 12, color: '#1D4ED8' }}><strong>Read-only view</strong> — Inventory updates come from Merchant Portal, customer bookings/check-outs, PMS, and Channel Manager only.</span>
        </div>
        <AvailBadge status={room.status} />
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="space-y-5">
          <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <RoomDetailContent room={room} />
          </div>
        </div>
        <div className="space-y-4">
          {/* Recent events for this room */}
          <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>Recent Inventory Events</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>Latest changes recorded for this room type</div>
            <div className="space-y-2">
              {timelineEvents
                .filter(e => e.hotelName === room.hotelName && e.roomType === room.roomType)
                .slice(0, 6)
                .map(e => {
                  const cfg: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
                    booking:            { color: '#1664FF', bg: '#EEF4FF', icon: <TrendingDown size={12} /> },
                    checkout:           { color: '#059669', bg: '#ECFDF3', icon: <TrendingUp size={12} /> },
                    inventory_increase: { color: '#059669', bg: '#ECFDF3', icon: <ChevronUp size={12} /> },
                    inventory_decrease: { color: '#DC2626', bg: '#FFF1F3', icon: <ChevronDown size={12} /> },
                    sync:               { color: '#7C3AED', bg: '#F5F3FF', icon: <RefreshCw size={12} /> },
                    block:              { color: '#94A3B8', bg: '#F1F5F9', icon: <XCircle size={12} /> },
                    unblock:            { color: '#059669', bg: '#ECFDF3', icon: <CheckCircle size={12} /> },
                    maintenance:        { color: '#F59E0B', bg: '#FFFBEB', icon: <AlertTriangle size={12} /> },
                  }
                  const c = cfg[e.eventType] ?? cfg.sync
                  return (
                    <div key={e.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <div className="flex items-center justify-center rounded-md flex-shrink-0" style={{ width: 24, height: 24, background: c.bg, color: c.color, marginTop: 1 }}>{c.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#1A2332', lineHeight: 1.5 }}>{e.description}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{e.time} · {e.source}</div>
                      </div>
                      {e.quantityChange !== null && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: e.quantityChange > 0 ? '#059669' : '#DC2626', fontFamily: 'monospace' }}>
                          {e.quantityChange > 0 ? '+' : ''}{e.quantityChange}
                        </span>
                      )}
                    </div>
                  )
                })}
              {timelineEvents.filter(e => e.hotelName === room.hotelName && e.roomType === room.roomType).length === 0 && (
                <div className="flex items-center justify-center" style={{ height: 80, color: '#94A3B8', fontSize: 12 }}>No events recorded today for this room type</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 4. Inventory Timeline ─────────────────────────────────────────────────────

function InventoryTimelinePage({ showToast }: { showToast: Props['showToast'] }) {
  const [filterMerchant, setFilterMerchant] = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const merchants = [...new Set(timelineEvents.map(e => e.merchantName))]

  const eventTypeLabels: Record<string, string> = {
    booking:            'Customer Booking',
    checkout:           'Customer Check-out',
    inventory_increase: 'Inventory Increase',
    inventory_decrease: 'Inventory Decrease',
    sync:               'Synchronization',
    block:              'Room Blocked',
    unblock:            'Room Unblocked',
    maintenance:        'Maintenance',
  }

  const eventColors: Record<string, { color: string; bg: string }> = {
    booking:            { color: '#1664FF', bg: '#EEF4FF' },
    checkout:           { color: '#059669', bg: '#ECFDF3' },
    inventory_increase: { color: '#059669', bg: '#ECFDF3' },
    inventory_decrease: { color: '#DC2626', bg: '#FFF1F3' },
    sync:               { color: '#7C3AED', bg: '#F5F3FF' },
    block:              { color: '#94A3B8', bg: '#F1F5F9' },
    unblock:            { color: '#059669', bg: '#ECFDF3' },
    maintenance:        { color: '#F59E0B', bg: '#FFFBEB' },
  }

  const filtered = timelineEvents.filter(e => {
    if (filterMerchant && e.merchantName !== filterMerchant) return false
    if (filterType && e.eventType !== filterType) return false
    if (search && !e.description.toLowerCase().includes(search.toLowerCase()) &&
        !e.hotelName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => b.time.localeCompare(a.time))

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      <PageHeader title="Inventory Timeline" subtitle="Complete audit history of all inventory changes across the platform">
        <button onClick={() => showToast('info', 'Export', 'Timeline exported to CSV.')}
          className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export
        </button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5" style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, padding: '10px 14px' }}>
        <SlidersHorizontal size={13} color="#94A3B8" />
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…"
          className="outline-none" style={{ fontSize: 13, color: '#1A2332', minWidth: 200, background: 'transparent' }} />
        <div style={{ width: 1, height: 20, background: '#E3E8F0' }} />
        <select value={filterMerchant} onChange={e => setFilterMerchant(e.target.value)}
          style={{ fontSize: 12, color: filterMerchant ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterMerchant ? '#F0F6FF' : '#fff' }}>
          <option value="">All Merchants</option>
          {merchants.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ fontSize: 12, color: filterType ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterType ? '#F0F6FF' : '#fff' }}>
          <option value="">All Event Types</option>
          {Object.entries(eventTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(search || filterMerchant || filterType) && (
          <button onClick={() => { setSearch(''); setFilterMerchant(''); setFilterType('') }}
            className="flex items-center gap-1 rounded-md px-2" style={{ height: 28, fontSize: 12, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
            <X size={11} /> Clear
          </button>
        )}
        <div className="ml-auto" style={{ fontSize: 12, color: '#94A3B8' }}>{filtered.length} events today</div>
      </div>

      {/* Date header */}
      <div className="flex items-center gap-3 mb-4">
        <div style={{ height: 1, flex: 1, background: '#E3E8F0' }} />
        <div className="flex items-center gap-2 rounded-full px-4 py-1.5" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
          <Calendar size={12} color="#94A3B8" />
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>22 July 2026 · Today</span>
        </div>
        <div style={{ height: 1, flex: 1, background: '#E3E8F0' }} />
      </div>

      {/* Timeline */}
      <div className="relative">
        <div style={{ position: 'absolute', left: 106, top: 0, bottom: 0, width: 2, background: '#E3E8F0' }} />
        <div className="space-y-3">
          {filtered.map((e) => {
            const c = eventColors[e.eventType] ?? { color: '#64748B', bg: '#F1F5F9' }
            const isSync = e.eventType === 'sync'
            const isFailed = isSync && e.description.includes('failed') || isSync && e.description.includes('Failed')
            const effectiveColor = isFailed ? '#DC2626' : c.color
            const effectiveBg = isFailed ? '#FFF1F3' : c.bg
            return (
              <div key={e.id} className="flex items-start gap-4" style={{ position: 'relative' }}>
                {/* Time */}
                <div style={{ width: 96, flexShrink: 0, textAlign: 'right', paddingTop: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>{e.time}</span>
                </div>
                {/* Dot */}
                <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, marginTop: 8 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: effectiveBg, border: `2px solid ${effectiveColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: effectiveColor }} />
                  </div>
                </div>
                {/* Content card */}
                <div className="flex-1 rounded-lg p-3.5 mb-1" style={{ background: '#fff', border: '1px solid #E3E8F0' }}
                  onMouseEnter={e2 => (e2.currentTarget.style.borderColor = effectiveColor + '55')}
                  onMouseLeave={e2 => (e2.currentTarget.style.borderColor = '#E3E8F0')}>
                  <div className="flex items-start justify-between gap-3">
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 10, background: effectiveBg, color: effectiveColor, height: 18 }}>
                          {isFailed ? 'Sync Failed' : eventTypeLabels[e.eventType]}
                        </span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{e.merchantName}</span>
                        <span style={{ fontSize: 11, color: '#CBD5E1' }}>·</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{e.hotelName}</span>
                        <span style={{ fontSize: 11, color: '#CBD5E1' }}>·</span>
                        <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{e.roomType}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#1A2332', lineHeight: 1.6, marginBottom: 8 }}>{e.description}</p>
                      <div className="flex items-center gap-4 flex-wrap">
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>Source: <strong style={{ color: '#475569' }}>{e.source}</strong></span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>Updated by: <strong style={{ color: '#475569' }}>{e.updatedBy}</strong></span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>Event: <strong style={{ color: '#475569', fontFamily: 'monospace' }}>{e.id}</strong></span>
                      </div>
                    </div>
                    {e.quantityChange !== null && (
                      <div className="flex-shrink-0 rounded-lg px-3 py-1.5 text-center" style={{ background: effectiveBg, border: `1px solid ${effectiveColor}22` }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: effectiveColor, fontFamily: 'monospace', lineHeight: 1 }}>
                          {e.quantityChange > 0 ? '+' : ''}{e.quantityChange}
                        </div>
                        <div style={{ fontSize: 10, color: effectiveColor, opacity: 0.7 }}>rooms</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 5. Availability Calendar ───────────────────────────────────────────────────

function AvailabilityCalendarPage({ showToast }: { showToast: Props['showToast'] }) {
  const [filterMerchant, setFilterMerchant] = useState('')
  const [filterHotel, setFilterHotel] = useState('')
  const [filterRoomType, setFilterRoomType] = useState('')
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(7) // July

  const merchants = [...new Set(roomInventory.map(r => r.merchantName))]
  const hotels = roomInventory.filter(r => !filterMerchant || r.merchantName === filterMerchant).map(r => r.hotelName)
  const uniqueHotels = [...new Set(hotels)]
  const roomTypes = roomInventory.filter(r => !filterHotel || r.hotelName === filterHotel).map(r => r.roomType)
  const uniqueRoomTypes = [...new Set(roomTypes)]

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay()

  // Synthetic availability data for the calendar
  // Status: available, low_inventory, sold_out, blocked
  function getDayStatus(day: number): 'available' | 'low_inventory' | 'sold_out' | 'blocked' {
    const seed = (day * 7 + month * 13 + year) % 10
    if (day <= 0) return 'available'
    if ([3, 14, 21, 28].includes(day)) return 'sold_out'
    if ([5, 10, 18, 25, 30].includes(day)) return 'low_inventory'
    if ([7, 23].includes(day)) return 'blocked'
    if (seed < 2) return 'sold_out'
    if (seed < 4) return 'low_inventory'
    return 'available'
  }

  const calendarCells: Array<{ day: number; status: ReturnType<typeof getDayStatus> | null }> = []
  for (let i = 0; i < firstDayOfMonth; i++) calendarCells.push({ day: 0, status: null })
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push({ day: d, status: getDayStatus(d) })

  const statusConfig = {
    available:     { bg: '#ECFDF3', border: '#86EFAC', color: '#166534', label: 'Available' },
    low_inventory: { bg: '#FFFBEB', border: '#FCD34D', color: '#92400E', label: 'Low Inventory' },
    sold_out:      { bg: '#FFF1F3', border: '#FCA5A5', color: '#9F1239', label: 'Sold Out' },
    blocked:       { bg: '#F1F5F9', border: '#CBD5E1', color: '#475569', label: 'Blocked / Maintenance' },
  }

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      <PageHeader title="Availability Calendar" subtitle="Visual monthly calendar showing room availability status across hotels">
        <button onClick={() => showToast('info', 'Export', 'Calendar exported.')}
          className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export
        </button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5" style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, padding: '10px 14px' }}>
        <SlidersHorizontal size={13} color="#94A3B8" />
        <select value={filterMerchant} onChange={e => { setFilterMerchant(e.target.value); setFilterHotel(''); setFilterRoomType('') }}
          style={{ fontSize: 12, color: filterMerchant ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterMerchant ? '#F0F6FF' : '#fff' }}>
          <option value="">All Merchants</option>
          {merchants.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterHotel} onChange={e => { setFilterHotel(e.target.value); setFilterRoomType('') }}
          style={{ fontSize: 12, color: filterHotel ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterHotel ? '#F0F6FF' : '#fff' }}>
          <option value="">All Hotels</option>
          {uniqueHotels.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <select value={filterRoomType} onChange={e => setFilterRoomType(e.target.value)}
          style={{ fontSize: 12, color: filterRoomType ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterRoomType ? '#F0F6FF' : '#fff' }}>
          <option value="">All Room Types</option>
          {uniqueRoomTypes.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={prevMonth} className="flex items-center justify-center rounded-md" style={{ width: 32, height: 32, border: '1px solid #E3E8F0' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ChevronLeft size={14} color="#64748B" />
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2332', minWidth: 130, textAlign: 'center' }}>
            {monthNames[month - 1]} {year}
          </div>
          <button onClick={nextMonth} className="flex items-center justify-center rounded-md" style={{ width: 32, height: 32, border: '1px solid #E3E8F0' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ChevronRight size={14} color="#64748B" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {Object.entries(statusConfig).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div style={{ width: 14, height: 14, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.border}` }} />
            <span style={{ fontSize: 12, color: '#64748B' }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        {/* Day headers */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E3E8F0' }}>
          {dayNames.map(d => (
            <div key={d} className="text-center py-2.5" style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#F8FAFC', borderRight: '1px solid #F1F5F9' }}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {calendarCells.map((cell, idx) => {
            const isToday = cell.day === 22 && month === 7 && year === 2026
            const sc = cell.status ? statusConfig[cell.status] : null
            return (
              <div key={idx} className="flex flex-col"
                style={{ minHeight: 90, borderRight: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9', background: sc ? sc.bg : '#FAFBFC', cursor: cell.day > 0 ? 'pointer' : 'default', padding: 8, position: 'relative' }}
                onMouseEnter={e => { if (cell.day > 0) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                onClick={() => { if (cell.day > 0 && cell.status) showToast('info', `${monthNames[month-1]} ${cell.day}`, `Status: ${statusConfig[cell.status!].label}`) }}>
                {cell.day > 0 && (
                  <>
                    <div style={{
                      fontSize: 13, fontWeight: isToday ? 700 : 400,
                      color: isToday ? '#fff' : sc ? sc.color : '#CBD5E1',
                      background: isToday ? '#1664FF' : 'transparent',
                      width: 24, height: 24, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{cell.day}</div>
                    {sc && (
                      <div className="mt-auto">
                        <div style={{ fontSize: 10, color: sc.color, fontWeight: 500, marginTop: 6 }}>{sc.label}</div>
                        <div style={{ height: 3, background: sc.border, borderRadius: 2, marginTop: 3 }} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 6. Inventory Alerts ───────────────────────────────────────────────────────

function InventoryAlertsPage({ showToast }: { showToast: Props['showToast'] }) {
  const [filterPriority, setFilterPriority] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const alertTypeLabels: Record<string, string> = {
    sold_out:     'Sold Out',
    low_inventory: 'Low Inventory',
    sync_failed:  'Sync Failed',
    maintenance:  'Maintenance',
    restored:     'Restored',
  }

  const alertTypeColors: Record<string, { color: string; bg: string }> = {
    sold_out:     { color: '#BE123C', bg: '#FFF1F3' },
    low_inventory: { color: '#B54708', bg: '#FFFAEB' },
    sync_failed:  { color: '#DC2626', bg: '#FFF1F3' },
    maintenance:  { color: '#475569', bg: '#F1F5F9' },
    restored:     { color: '#059669', bg: '#ECFDF3' },
  }

  const filtered = inventoryAlerts.filter(a => {
    if (filterPriority && a.priority !== filterPriority) return false
    if (filterType && a.alertType !== filterType) return false
    if (filterStatus && a.status !== filterStatus) return false
    if (search && !a.hotelName.toLowerCase().includes(search.toLowerCase()) &&
        !a.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openCount = inventoryAlerts.filter(a => a.status === 'open').length
  const ackCount = inventoryAlerts.filter(a => a.status === 'acknowledged').length
  const highCount = inventoryAlerts.filter(a => a.priority === 'high' && a.status !== 'resolved').length
  const resolvedCount = inventoryAlerts.filter(a => a.status === 'resolved').length

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      <PageHeader title="Inventory Alerts" subtitle="Inventory-related alerts and notifications requiring administrator attention">
        <button onClick={() => showToast('info', 'Export', 'Alerts exported.')}
          className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <Download size={13} /> Export
        </button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Open Alerts',        value: openCount,     color: '#BE123C', bg: '#FFF1F3', icon: Bell },
          { label: 'High Priority',      value: highCount,     color: '#DC2626', bg: '#FFF1F3', icon: AlertTriangle },
          { label: 'Acknowledged',       value: ackCount,      color: '#B54708', bg: '#FFFAEB', icon: Clock },
          { label: 'Resolved Today',     value: resolvedCount, color: '#059669', bg: '#ECFDF3', icon: CheckCircle },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-3.5 flex items-center gap-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="flex items-center justify-center rounded-md flex-shrink-0" style={{ width: 36, height: 36, background: s.bg }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5" style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 8, padding: '10px 14px' }}>
        <SlidersHorizontal size={13} color="#94A3B8" />
        <Search size={13} color="#94A3B8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search alerts…"
          className="outline-none" style={{ fontSize: 13, color: '#1A2332', minWidth: 200, background: 'transparent' }} />
        <div style={{ width: 1, height: 20, background: '#E3E8F0' }} />
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ fontSize: 12, color: filterPriority ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterPriority ? '#F0F6FF' : '#fff' }}>
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ fontSize: 12, color: filterType ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterType ? '#F0F6FF' : '#fff' }}>
          <option value="">All Types</option>
          {Object.entries(alertTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ fontSize: 12, color: filterStatus ? '#1A2332' : '#94A3B8', border: '1px solid #E3E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: filterStatus ? '#F0F6FF' : '#fff' }}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        {(search || filterPriority || filterType || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterPriority(''); setFilterType(''); setFilterStatus('') }}
            className="flex items-center gap-1 rounded-md px-2" style={{ height: 28, fontSize: 12, color: '#DC2626', border: '1px solid #FECDD3', background: '#FFF1F3' }}>
            <X size={11} /> Clear
          </button>
        )}
        <div className="ml-auto" style={{ fontSize: 12, color: '#94A3B8' }}>{filtered.length} alerts</div>
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.map(a => {
          const tc = alertTypeColors[a.alertType] ?? { color: '#64748B', bg: '#F1F5F9' }
          const isResolved = a.status === 'resolved'
          return (
            <div key={a.id} className="rounded-lg px-4 py-3.5" style={{ background: '#fff', border: `1px solid ${isResolved ? '#F1F5F9' : a.priority === 'high' ? '#FECDD3' : '#E3E8F0'}`, opacity: isResolved ? 0.7 : 1 }}>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center rounded-md flex-shrink-0 mt-0.5" style={{ width: 32, height: 32, background: tc.bg }}>
                  {a.alertType === 'restored' ? <CheckCircle size={16} color={tc.color} /> :
                   a.alertType === 'sync_failed' ? <XCircle size={16} color={tc.color} /> :
                   a.alertType === 'maintenance' ? <Clock size={16} color={tc.color} /> :
                   <AlertTriangle size={16} color={tc.color} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <AlertPriorityBadge priority={a.priority} />
                    <span className="inline-flex items-center rounded px-1.5 font-medium" style={{ fontSize: 11, background: tc.bg, color: tc.color, height: 20 }}>{alertTypeLabels[a.alertType]}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1A2332' }}>{a.hotelName}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>·</span>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{a.merchantName}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#1A2332', marginBottom: 6, lineHeight: 1.5 }}>
                    <strong style={{ color: '#64748B' }}>{a.roomType}:</strong> {a.description}
                  </div>
                  <div className="flex items-center gap-4">
                    <span style={{ fontSize: 11, color: '#94A3B8' }}><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />{a.createdAt}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{a.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <AlertStatusBadge status={a.status} />
                  <MoreMenu items={[
                    ...(a.status === 'open' ? [{ label: 'Acknowledge', icon: <CheckCircle size={13} />, onClick: () => showToast('info', 'Alert Acknowledged', a.id) }] : []),
                    ...(a.status !== 'resolved' ? [{ label: 'Mark Resolved', icon: <CheckCircle size={13} />, color: '#059669', onClick: () => showToast('success', 'Alert Resolved', a.id) }] : []),
                    { label: 'View Timeline', icon: <Clock size={13} />, onClick: () => showToast('info', 'Timeline', `${a.hotelName} · ${a.roomType}`) },
                  ]} />
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center rounded-lg" style={{ height: 140, background: '#fff', border: '1px solid #E3E8F0', color: '#94A3B8', fontSize: 13 }}>
            No alerts match the selected filters
          </div>
        )}
      </div>
    </div>
  )
}

// ── 7. Inventory Reports ───────────────────────────────────────────────────────

function InventoryReportsPage({ showToast }: { showToast: Props['showToast'] }) {
  const reports = [
    {
      id: 'RPT-001', title: 'Occupancy Report', description: 'Daily, weekly, and monthly occupancy rates across all hotels and merchants. Includes trend analysis and period-over-period comparison.',
      icon: BarChart3, color: '#1664FF', bg: '#EEF4FF', lastGenerated: '2026-07-22 08:00', records: '9 hotels · 15 room types',
    },
    {
      id: 'RPT-002', title: 'Room Utilization Report', description: 'Detailed breakdown of room usage, including available, occupied, reserved, blocked, and maintenance rooms per hotel and room type.',
      icon: Layers, color: '#7C3AED', bg: '#F5F3FF', lastGenerated: '2026-07-22 08:00', records: '15 room type records',
    },
    {
      id: 'RPT-003', title: 'Merchant Inventory Report', description: 'Per-merchant inventory summary showing total rooms, availability rates, occupancy levels, and sync status across all properties.',
      icon: Building2, color: '#059669', bg: '#ECFDF3', lastGenerated: '2026-07-22 07:30', records: '5 merchants · 9 hotels',
    },
    {
      id: 'RPT-004', title: 'Inventory Change Report', description: 'Complete audit log of all inventory changes including bookings, check-outs, merchant updates, PMS syncs, and maintenance events.',
      icon: Activity, color: '#D97706', bg: '#FFFBEB', lastGenerated: '2026-07-22 16:20', records: `${timelineEvents.length} events today`,
    },
    {
      id: 'RPT-005', title: 'Daily Availability Report', description: 'Snapshot of platform-wide room availability at a specific point in time. Useful for daily operations review and capacity planning.',
      icon: Calendar, color: '#BE123C', bg: '#FFF1F3', lastGenerated: '2026-07-22 06:00', records: 'As of 06:00 today',
    },
  ]

  return (
    <div className="p-6" style={{ minWidth: 1080 }}>
      <PageHeader title="Inventory Reports" subtitle="Generate and export inventory and availability reports for analysis">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0', fontSize: 12, color: '#64748B' }}>
          <Calendar size={13} color="#94A3B8" />
          <span>Reporting period: July 2026</span>
        </div>
      </PageHeader>

      {/* Summary bar */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { label: 'Available Reports', value: reports.length, color: '#1664FF' },
          { label: 'Hotels Covered', value: 9, color: '#059669' },
          { label: 'Events This Month', value: 284, color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-3 flex items-center gap-3" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Report cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {reports.map(r => (
          <div key={r.id} className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            <div className="flex items-start gap-4 mb-4">
              <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 44, height: 44, background: r.bg }}>
                <r.icon size={22} color={r.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>{r.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />Last generated: <strong style={{ color: '#64748B' }}>{r.lastGenerated}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                <span style={{ fontSize: 10, fontFamily: 'monospace', background: '#F1F5F9', padding: '1px 5px', borderRadius: 3, color: '#475569' }}>{r.records}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => showToast('info', r.title, 'Generating PDF report...')}
                className="flex items-center gap-1.5 rounded-md px-3 font-medium" style={{ height: 32, fontSize: 12, background: r.color, color: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                <FileText size={12} /> PDF
              </button>
              <button onClick={() => showToast('info', r.title, 'Generating Excel report...')}
                className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 32, fontSize: 12, color: r.color, border: `1px solid ${r.color}44`, background: r.bg }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                <Download size={12} /> Excel
              </button>
              <button onClick={() => showToast('info', r.title, 'Downloading CSV...')}
                className="flex items-center gap-1.5 rounded-md px-3" style={{ height: 32, fontSize: 12, color: '#64748B', border: '1px solid #E3E8F0' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Download size={12} /> CSV
              </button>
              <div className="ml-auto">
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8' }}>{r.id}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Export options notice */}
      <div className="rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #E3E8F0' }}>
        <div className="flex items-start gap-3">
          <Download size={16} color="#1664FF" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>Export Formats</div>
            <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.7 }}>
              <strong>PDF</strong> — Formatted report for sharing and printing. Includes charts and summary tables.<br />
              <strong>Excel</strong> — Multi-sheet workbook with detailed data, pivot-ready for further analysis.<br />
              <strong>CSV</strong> — Raw data export for import into other systems or custom analysis tools.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main router ────────────────────────────────────────────────────────────────

export default function InventoryPage({ tab, showToast }: Props) {
  if (tab === 'inventory-availability') return <RoomAvailabilityPage showToast={showToast} />
  if (tab === 'inventory-detail')       return <RoomInventoryDetailPage showToast={showToast} />
  if (tab === 'inventory-timeline')     return <InventoryTimelinePage showToast={showToast} />
  if (tab === 'inventory-calendar')     return <AvailabilityCalendarPage showToast={showToast} />
  if (tab === 'inventory-alerts')       return <InventoryAlertsPage showToast={showToast} />
  if (tab === 'inventory-reports')      return <InventoryReportsPage showToast={showToast} />
  return <InventoryOverviewPage showToast={showToast} />
}

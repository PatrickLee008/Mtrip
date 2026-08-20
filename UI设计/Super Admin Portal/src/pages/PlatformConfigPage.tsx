import { useState } from 'react'
import { Settings, Tag, Users, DollarSign, CreditCard, RefreshCw, XCircle, Bell, Mail, MessageSquare, Zap, Link, Globe, Wrench, Megaphone, ChevronRight, X, Save, MapPin, Wifi, WifiOff, AlertCircle, TestTube2, RotateCcw } from 'lucide-react'
import type { PageId } from '../App'
import type { Toast } from '../hooks/useToast'

interface Props {
  tab: PageId
  showToast: (type: Toast['type'], title: string, message?: string) => void
}

interface ConfigCard {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  bg: string
}

const configCards: ConfigCard[] = [
  { id: 'platform', title: 'Platform Settings', description: 'General platform configuration, branding, and localization', icon: <Settings size={18} />, color: '#1664FF', bg: '#EEF4FF' },
  { id: 'categories', title: 'Merchant Categories', description: 'Configure hotel, resort, boutique, and other merchant types', icon: <Tag size={18} />, color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'onboarding', title: 'Merchant Onboarding', description: 'Required documents, verification steps, and approval workflow', icon: <Users size={18} />, color: '#059669', bg: '#ECFDF3' },
  { id: 'commission', title: 'Commission Configuration', description: 'Standard, premium, and VIP commission rate tiers', icon: <DollarSign size={18} />, color: '#D97706', bg: '#FFFBEB' },
  { id: 'settlement', title: 'Settlement Configuration', description: 'Settlement cycles, payout schedules, and bank account rules', icon: <CreditCard size={18} />, color: '#0EA5E9', bg: '#F0F9FF' },
  { id: 'refund', title: 'Refund Policy', description: 'Refund windows, approval thresholds, and automated processing', icon: <RefreshCw size={18} />, color: '#F59E0B', bg: '#FFFAEB' },
  { id: 'cancellation', title: 'Cancellation Policy', description: 'Guest and merchant cancellation rules and penalties', icon: <XCircle size={18} />, color: '#DC2626', bg: '#FFF1F2' },
  { id: 'notifications', title: 'Notification Templates', description: 'Platform-wide notification content and triggers', icon: <Bell size={18} />, color: '#6366F1', bg: '#EEF2FF' },
  { id: 'email', title: 'Email Templates', description: 'Transactional email templates for merchants and guests', icon: <Mail size={18} />, color: '#EC4899', bg: '#FDF2F8' },
  { id: 'sms', title: 'SMS Templates', description: 'SMS notification messages for bookings and alerts', icon: <MessageSquare size={18} />, color: '#14B8A6', bg: '#F0FDFA' },
  { id: 'features', title: 'Feature Toggles', description: 'Enable or disable platform features and beta functionality', icon: <Zap size={18} />, color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'pms', title: 'PMS Integration', description: 'Connect hotel property management systems via API', icon: <Link size={18} />, color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'channel', title: 'Channel Manager', description: 'OTA and distribution channel connectivity and sync settings', icon: <Globe size={18} />, color: '#1664FF', bg: '#EEF4FF' },
  { id: 'api', title: 'API Configuration', description: 'API keys, rate limits, webhook endpoints, and access logs', icon: <Wrench size={18} />, color: '#475569', bg: '#F8FAFC' },
  { id: 'maintenance', title: 'Maintenance Mode', description: 'Enable maintenance windows with custom status pages', icon: <Settings size={18} />, color: '#DC2626', bg: '#FFF1F2' },
  { id: 'announcements', title: 'Announcement Management', description: 'Broadcast platform-wide messages to merchants', icon: <Megaphone size={18} />, color: '#059669', bg: '#ECFDF3' },
  { id: 'lbs', title: 'Location-Based Services', description: 'Map provider, geolocation, geofencing, and coordinate validation', icon: <MapPin size={18} />, color: '#0E7490', bg: '#F0FDFF' },
]

function Toggle({ defaultOn = false, label, onChange }: { defaultOn?: boolean; label?: string; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => { setOn(!on); onChange?.(!on) }} className="rounded-full flex-shrink-0" style={{ width: 40, height: 22, background: on ? '#1664FF' : '#CBD5E1', position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: '#fff', top: 3, left: on ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
      {label && <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>}
    </div>
  )
}

export default function PlatformConfigPage({ showToast }: Props) {
  const [activeConfig, setActiveConfig] = useState<string | null>(null)

  const active = configCards.find(c => c.id === activeConfig)

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      {!activeConfig ? (
        <>
          <div className="mb-5">
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Platform Configuration & System Settings</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Configure all platform modules, integrations, and system behavior</p>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {configCards.map((card) => (
              <button
                key={card.id}
                onClick={() => setActiveConfig(card.id)}
                className="rounded-lg p-4 text-left transition-all"
                style={{ background: '#fff', border: '1px solid #E3E8F0', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = card.color; e.currentTarget.style.boxShadow = `0 2px 12px ${card.color}18` }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E3E8F0'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="rounded-lg flex items-center justify-center" style={{ width: 36, height: 36, background: card.bg, color: card.color }}>
                    {card.icon}
                  </div>
                  <ChevronRight size={14} color="#CBD5E1" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>{card.description}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Config detail panel */
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveConfig(null)} className="rounded-md px-3 transition-colors" style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                ← Back
              </button>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>{active?.title}</h1>
                <p style={{ fontSize: 13, color: '#94A3B8' }}>{active?.description}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {activeConfig === 'lbs' && (
                <button onClick={() => showToast('info', 'Reset to Defaults', 'Location-Based Services settings have been reset.')} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                  <RotateCcw size={13} /> Reset
                </button>
              )}
              <button onClick={() => showToast('success', 'Settings Saved', `${active?.title} configuration updated.`)} className="flex items-center gap-2 rounded-md px-4 text-white font-medium" style={{ height: 36, fontSize: 13, background: '#1664FF', border: 'none', cursor: 'pointer' }}>
                <Save size={13} /> Save Changes
              </button>
            </div>
          </div>

          <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            {activeConfig === 'platform' && <PlatformSettingsForm />}
            {activeConfig === 'commission' && <CommissionConfigForm />}
            {activeConfig === 'features' && <FeatureTogglesForm />}
            {activeConfig === 'maintenance' && <MaintenanceModeForm showToast={showToast} />}
            {activeConfig === 'api' && <ApiConfigForm />}
            {activeConfig === 'lbs' && <LbsConfigForm showToast={showToast} />}
            {!['platform', 'commission', 'features', 'maintenance', 'api', 'lbs'].includes(activeConfig) && (
              <GenericConfigForm title={active?.title ?? ''} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ minWidth: 260 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, maxWidth: 480 }}>{children}</div>
    </div>
  )
}

function TextInput({ defaultValue, placeholder }: { defaultValue?: string; placeholder?: string }) {
  return <input defaultValue={defaultValue} placeholder={placeholder} className="w-full rounded-md px-3 outline-none" style={{ height: 34, fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0' }} onFocus={(e) => (e.currentTarget.style.border = '1px solid #1664FF')} onBlur={(e) => (e.currentTarget.style.border = '1px solid #E3E8F0')} />
}

function SelectInput({ options, defaultValue }: { options: string[]; defaultValue?: string }) {
  return <select defaultValue={defaultValue} className="w-full rounded-md px-3 outline-none" style={{ height: 34, fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0' }}>{options.map(o => <option key={o}>{o}</option>)}</select>
}

function PlatformSettingsForm() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 16 }}>Platform Settings</div>
      <Field label="Platform Name" sub="Displayed across all partner interfaces"><TextInput defaultValue="mTrip Hotel Platform" /></Field>
      <Field label="Default Currency"><SelectInput options={['CNY (¥) — Chinese Yuan', 'USD ($)', 'EUR (€)', 'HKD (HK$)']} defaultValue="CNY (¥) — Chinese Yuan" /></Field>
      <Field label="Default Language"><SelectInput options={['English', '简体中文', '繁體中文', '日本語']} /></Field>
      <Field label="Timezone"><SelectInput options={['UTC+8 (Beijing)', 'UTC+0 (London)', 'UTC-5 (New York)']} /></Field>
      <Field label="Support Email" sub="Displayed to merchant partners"><TextInput defaultValue="partners@mtrip.com" /></Field>
      <Field label="Max Booking Advance" sub="Maximum days in advance a guest can book"><TextInput defaultValue="365" /></Field>
    </div>
  )
}

function CommissionConfigForm() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 16 }}>Commission Tiers</div>
      {[
        { tier: 'Standard', rate: '10.0', desc: 'Default rate for new merchants' },
        { tier: 'Premium', rate: '8.0', desc: 'Merchants with >¥500K/month revenue' },
        { tier: 'VIP', rate: '6.0', desc: 'Top-tier merchants with custom agreements' },
      ].map(t => (
        <Field key={t.tier} label={`${t.tier} Tier`} sub={t.desc}>
          <div className="flex items-center gap-2">
            <TextInput defaultValue={t.rate} />
            <span style={{ fontSize: 13, color: '#94A3B8', flexShrink: 0 }}>%</span>
          </div>
        </Field>
      ))}
      <Field label="Platform Fee on Refunds" sub="Additional fee charged when refunds are processed"><div className="flex items-center gap-2"><TextInput defaultValue="1.5" /><span style={{ fontSize: 13, color: '#94A3B8', flexShrink: 0 }}>%</span></div></Field>
    </div>
  )
}

function FeatureTogglesForm() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 16 }}>Feature Toggles</div>
      {[
        { label: 'Affiliate Program', sub: 'Enable affiliate and influencer partner program', on: true },
        { label: 'Flash Sale Campaigns', sub: 'Allow merchants to create flash sale promotions', on: true },
        { label: 'Dynamic Pricing', sub: 'AI-driven dynamic pricing suggestions', on: false },
        { label: 'Instant Booking', sub: 'Allow instant booking without merchant confirmation', on: true },
        { label: 'Split Payments', sub: 'Enable split payment for group bookings', on: false },
        { label: 'Loyalty Points', sub: 'mTrip Rewards loyalty point accumulation', on: true },
        { label: 'Multi-currency Display', sub: 'Show prices in user-selected currency', on: false },
        { label: 'Merchant Impersonation', sub: 'Allow super admins to impersonate merchants', on: true },
        { label: 'Two-Factor Auth (2FA)', sub: 'Require 2FA for all admin accounts', on: true },
      ].map(f => (
        <Field key={f.label} label={f.label} sub={f.sub}><Toggle defaultOn={f.on} /></Field>
      ))}
    </div>
  )
}

function MaintenanceModeForm({ showToast }: { showToast: (type: Toast['type'], title: string, msg?: string) => void }) {
  return (
    <div>
      <div className="rounded-lg px-4 py-3 mb-5 flex items-center gap-3" style={{ background: '#FFF1F2', border: '1px solid #FECDD3' }}>
        <X size={16} color="#DC2626" />
        <div><div style={{ fontSize: 13, fontWeight: 600, color: '#BE123C' }}>Maintenance Mode is currently OFF</div><div style={{ fontSize: 12, color: '#9F1239' }}>Enabling maintenance will prevent new merchant logins and bookings.</div></div>
      </div>
      <Field label="Enable Maintenance Mode" sub="Take the platform offline for scheduled maintenance"><Toggle defaultOn={false} /></Field>
      <Field label="Maintenance Message" sub="Displayed to users during maintenance"><textarea className="w-full rounded-md px-3 py-2 outline-none resize-none" defaultValue="mTrip is undergoing scheduled maintenance. We'll be back shortly." style={{ fontSize: 13, border: '1px solid #E3E8F0', height: 72 }} /></Field>
      <Field label="Estimated Duration" sub="Shown in the maintenance banner"><TextInput defaultValue="2 hours" /></Field>
      <div className="pt-4">
        <button onClick={() => showToast('warning', 'Maintenance Scheduled', 'System will enter maintenance mode at 02:00 CST')} className="rounded-md px-4 font-medium" style={{ height: 36, fontSize: 13, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>Schedule Maintenance Window</button>
      </div>
    </div>
  )
}

function ApiConfigForm() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 16 }}>API Configuration</div>
      <Field label="API Rate Limit" sub="Requests per minute per API key"><TextInput defaultValue="1000" /></Field>
      <Field label="Webhook Endpoint" sub="Platform-wide event webhook URL"><TextInput defaultValue="https://api.mtrip.com/webhooks/events" /></Field>
      <Field label="JWT Token Expiry" sub="Access token lifetime in minutes"><TextInput defaultValue="60" /></Field>
      <Field label="IP Allowlist" sub="Restrict API access to specific IPs"><textarea className="w-full rounded-md px-3 py-2 outline-none resize-none" placeholder="e.g. 203.119.0.0/16..." style={{ fontSize: 13, border: '1px solid #E3E8F0', height: 72 }} /></Field>
      <Field label="Enable API Logging" sub="Log all API requests for audit trail"><Toggle defaultOn={true} /></Field>
    </div>
  )
}

// ── LBS helpers ──────────────────────────────────────────────────────────────

type LbsConnStatus = 'connected' | 'disconnected' | 'error' | 'testing'

const LBS_CONN_CFG: Record<LbsConnStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  connected:    { label: 'Connected',    color: '#059669', bg: '#ECFDF3', border: '#A7F3D0', dot: '#10B981' },
  disconnected: { label: 'Disconnected', color: '#DC2626', bg: '#FFF1F3', border: '#FECDD3', dot: '#F87171' },
  error:        { label: 'Error',        color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', dot: '#FBBF24' },
  testing:      { label: 'Testing…',    color: '#1664FF', bg: '#EEF4FF', border: '#BFDBFE', dot: '#60A5FA' },
}

interface GeoZone { id: number; name: string; bizType: string; radius: string; status: 'active' | 'inactive' }

const INITIAL_ZONES: GeoZone[] = [
  { id: 1, name: 'Yangon CBD',          bizType: 'Hotel',      radius: '2 km',  status: 'active'   },
  { id: 2, name: 'Mandalay Airport',    bizType: 'Airline',    radius: '5 km',  status: 'active'   },
  { id: 3, name: 'Bagan Heritage Zone', bizType: 'Attraction', radius: '10 km', status: 'inactive' },
  { id: 4, name: 'Naypyidaw City Center', bizType: 'Restaurant', radius: '3 km', status: 'active'  },
]

// Reusable section divider used within LBS form
function LbsSection({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 4px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
    </div>
  )
}

// Inline number+unit row used in Search & Distance
function RadiusInput({ defaultVal, unit }: { defaultVal: string; unit?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        defaultValue={defaultVal}
        style={{ width: 80, height: 34, border: '1px solid #E3E8F0', borderRadius: 6, padding: '0 10px', fontSize: 13, color: '#1A2332', outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
        onFocus={e => e.currentTarget.style.border = '1px solid #1664FF'}
        onBlur={e => e.currentTarget.style.border = '1px solid #E3E8F0'}
      />
      {unit && <span style={{ fontSize: 13, color: '#94A3B8', minWidth: 28 }}>{unit}</span>}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

function LbsConfigForm({ showToast }: { showToast: (type: Toast['type'], title: string, msg?: string) => void }) {
  const [connStatus, setConnStatus] = useState<LbsConnStatus>('connected')
  const [testing, setTesting]       = useState(false)
  const [apiKey, setApiKey]         = useState('AIzaSy••••••••••••••••••••••••••••••')
  const [showKey, setShowKey]       = useState(false)
  const [zones, setZones]           = useState<GeoZone[]>(INITIAL_ZONES)
  const [lastChecked, setLastChecked] = useState('2026-08-05 09:14 MMT')
  const [usageCount, setUsageCount] = useState(18_420)

  const BIZ_TYPE_OPTS = ['All Types', 'Hotel', 'Restaurant', 'Airline', 'Car Rental', 'Attraction']

  function handleTestConnection() {
    setTesting(true)
    setConnStatus('testing')
    setTimeout(() => {
      setTesting(false)
      setConnStatus('connected')
      const now = new Date()
      setLastChecked(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} MMT`)
      setUsageCount(p => p + 1)
      showToast('success', 'Connection Successful', 'Map provider API is reachable and authenticated.')
    }, 1800)
  }

  function toggleZone(id: number) {
    setZones(prev => prev.map(z => z.id === id ? { ...z, status: z.status === 'active' ? 'inactive' : 'active' } : z))
  }

  const st = LBS_CONN_CFG[connStatus]
  const usagePct = Math.round((usageCount / 100_000) * 100)

  return (
    <div>

      {/* ── 1. Core Settings ─────────────────────────────────────── */}
      <LbsSection label="Core Settings" />

      <Field label="Enable Location Services" sub="Master toggle for all LBS features across the platform">
        <Toggle defaultOn={true} />
      </Field>

      <Field label="Map Provider" sub="Select the map tile, geocoding, and routing provider">
        <div style={{ display: 'flex', gap: 10 }}>
          {(['Google Maps', 'Mapbox', 'OpenStreetMap'] as const).map(p => (
            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#475569' }}>
              <input type="radio" name="lbs-provider" defaultChecked={p === 'Google Maps'} style={{ accentColor: '#1664FF' }} />
              {p}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Map API Key" sub="Provider API key used for map tiles, geocoding, directions, and place search">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ width: '100%', height: 34, border: '1px solid #E3E8F0', borderRadius: 6, padding: '0 10px', fontSize: 13, color: '#1A2332', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.border = '1px solid #1664FF'}
              onBlur={e => e.currentTarget.style.border = '1px solid #E3E8F0'}
            />
          </div>
          <button onClick={() => setShowKey(p => !p)}
            style={{ height: 34, padding: '0 12px', borderRadius: 6, border: '1px solid #E3E8F0', background: '#F8FAFC', fontSize: 12, color: '#475569', cursor: 'pointer', flexShrink: 0 }}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </Field>

      {/* API Status card */}
      <Field label="API Connection Status" sub="Live status of the map provider API endpoint">
        <div style={{ border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
          {/* Status header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: st.bg, borderBottom: `1px solid ${st.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, display: 'inline-block', boxShadow: `0 0 0 3px ${st.dot}33` }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{st.label}</span>
            </div>
            <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>
              {connStatus === 'testing' ? 'Sending test request…' : connStatus === 'error' ? 'Authentication failed — verify API key' : ''}
            </span>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 12px', borderRadius: 6, border: `1px solid ${st.border}`, background: '#fff', fontSize: 12, color: st.color, cursor: testing ? 'not-allowed' : 'pointer', fontWeight: 500, flexShrink: 0 }}>
              <TestTube2 size={11} /> {testing ? 'Testing…' : 'Test Connection'}
            </button>
          </div>

          {/* Metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { label: 'API Version',  value: 'Maps JavaScript API v3.57' },
              { label: 'Last Checked', value: lastChecked },
              { label: 'Daily Usage',  value: `${usageCount.toLocaleString()} requests` },
              { label: 'Daily Quota',  value: '100,000 requests / day' },
            ].map((item, i) => (
              <div key={item.label} style={{ padding: '10px 16px', borderBottom: i < 2 ? '1px solid #F1F5F9' : 'none', borderRight: i % 2 === 0 ? '1px solid #F1F5F9' : 'none', background: i % 2 === 0 ? '#FAFBFC' : '#fff' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: item.label.includes('Version') || item.label.includes('Checked') ? 'monospace' : 'inherit' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Usage progress */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Daily API Usage</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: usagePct > 80 ? '#DC2626' : usagePct > 60 ? '#D97706' : '#059669' }}>{usagePct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#E3E8F0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${usagePct}%`, borderRadius: 3, background: usagePct > 80 ? '#EF4444' : usagePct > 60 ? '#F59E0B' : '#10B981', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </Field>

      {/* ── 2. Search & Distance ──────────────────────────────────── */}
      <LbsSection label="Search & Distance" />

      <Field label="Default Search Radius" sub="Initial radius pre-filled when a guest opens the nearby search">
        <RadiusInput defaultVal="10" unit="km" />
      </Field>

      <Field label="Maximum Search Radius" sub="Hard upper limit guests can set when filtering by distance">
        <RadiusInput defaultVal="100" unit="km" />
      </Field>

      <Field label="Distance Unit" sub="System-wide unit for all distance displays across guest and admin surfaces">
        <SelectInput options={['Kilometers (km)', 'Miles (mi)']} defaultValue="Kilometers (km)" />
      </Field>

      <Field label="Maximum Merchant Coverage Radius" sub="Furthest distance at which a merchant listing may appear in search results">
        <RadiusInput defaultVal="50" unit="km" />
      </Field>

      {/* ── 3. Location Features ─────────────────────────────────── */}
      <LbsSection label="Location Features" />

      <Field label="Enable Nearby Search" sub="Allow guests to search for businesses near their current or selected location">
        <Toggle defaultOn={true} />
      </Field>

      <Field label="Enable Geolocation" sub="Request device GPS / IP coordinates for automatic location detection">
        <Toggle defaultOn={true} />
      </Field>

      <Field label="Enable Geofencing" sub="Trigger automated actions (promotions, alerts) when a guest enters or exits a defined zone">
        <Toggle defaultOn={false} />
      </Field>

      <Field label="Enable User Location Data Collection" sub="Store anonymised guest location history for personalisation and analytics (requires GDPR / PDPA consent)">
        <Toggle defaultOn={false} />
      </Field>

      {/* ── 4. Regional Defaults ─────────────────────────────────── */}
      <LbsSection label="Regional Defaults" />

      <Field label="Platform Default Country" sub="Country bias applied when geocoding addresses that lack a complete location context">
        <SelectInput options={['Myanmar (MM)', 'Thailand (TH)', 'Singapore (SG)', 'Malaysia (MY)', 'Vietnam (VN)', 'Indonesia (ID)', 'Philippines (PH)']} defaultValue="Myanmar (MM)" />
      </Field>

      <Field label="Default Map Center" sub="Fallback lat / lng used when no location context is available (e.g. new merchant registration)">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <TextInput defaultValue="16.8661" placeholder="Latitude" />
          </div>
          <div style={{ flex: 1 }}>
            <TextInput defaultValue="96.1951" placeholder="Longitude" />
          </div>
          <a href="https://maps.google.com" target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid #E3E8F0', background: '#F8FAFC', fontSize: 11, color: '#1664FF', textDecoration: 'none', flexShrink: 0 }}>
            <MapPin size={11} /> Preview
          </a>
        </div>
      </Field>

      <Field label="Default Map Zoom Level" sub="Initial zoom applied to the embedded map (1 = world view · 15 = street level · 20 = building)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min={1} max={20} defaultValue={12}
            style={{ flex: 1, accentColor: '#1664FF' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', minWidth: 24, textAlign: 'right' }}>12</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>/ 20</span>
        </div>
      </Field>

      {/* ── 5. Geofencing Areas ──────────────────────────────────── */}
      <LbsSection label="Geofencing Areas" />

      <div style={{ marginTop: 12, border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 100px 64px', padding: '9px 16px', background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
          {['Area Name', 'Business Type', 'Radius', 'Status', ''].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {zones.map((z, i) => (
          <div key={z.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 100px 64px', padding: '11px 16px', alignItems: 'center', borderBottom: i < zones.length - 1 ? '1px solid #F1F5F9' : 'none', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={13} color={z.status === 'active' ? '#0E7490' : '#CBD5E1'} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{z.name}</span>
            </div>
            <span style={{ fontSize: 12, color: '#475569' }}>{z.bizType}</span>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>{z.radius}</span>
            <button onClick={() => toggleZone(z.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px', borderRadius: 6, border: `1px solid ${z.status === 'active' ? '#A7F3D0' : '#E2E8F0'}`, background: z.status === 'active' ? '#ECFDF3' : '#F8FAFC', fontSize: 10, fontWeight: 700, color: z.status === 'active' ? '#059669' : '#94A3B8', cursor: 'pointer', letterSpacing: '0.02em' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: z.status === 'active' ? '#10B981' : '#CBD5E1', display: 'inline-block' }} />
              {z.status === 'active' ? 'Active' : 'Inactive'}
            </button>
            <button onClick={() => showToast('info', 'Edit Zone', `Editing geofencing area: ${z.name}`)}
              style={{ fontSize: 12, fontWeight: 500, color: '#1664FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>Edit</button>
          </div>
        ))}

        {/* Add row */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <button onClick={() => showToast('info', 'Add Zone', 'Open geofencing area creation form.')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 7, border: '1px dashed #CBD5E1', background: '#fff', fontSize: 12, color: '#64748B', cursor: 'pointer', fontWeight: 500 }}>
            + Add Geofencing Area
          </button>
        </div>
      </div>

      {/* ── 6. Policy & Validation ───────────────────────────────── */}
      <LbsSection label="Policy & Validation" />

      <Field label="Merchant Coordinate Validation" sub="Validate that merchant addresses can be geocoded before allowing listing publication">
        <Toggle defaultOn={true} />
      </Field>

      <Field label="Validation Mode" sub="How strictly the platform enforces coordinate validation on merchant addresses">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {([
            { val: 'strict',   label: 'Strict',       sub: 'Block save until coordinates are validated' },
            { val: 'warning',  label: 'Warning Only',  sub: 'Allow save with a visible admin warning'  },
            { val: 'disabled', label: 'Disabled',      sub: 'No validation — not recommended for production' },
          ] as const).map(opt => (
            <label key={opt.val} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid #E3E8F0', cursor: 'pointer', background: '#FAFBFC' }}>
              <input type="radio" name="lbs-validation-mode" defaultChecked={opt.val === 'warning'}
                style={{ accentColor: '#1664FF', marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{opt.sub}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Automatic Address Geocoding" sub="Automatically geocode merchant addresses when they are saved or updated">
        <Toggle defaultOn={true} />
      </Field>

      <Field label="Require Admin Approval for Merchant Location Changes" sub="Flag merchant address edits for admin review before the updated coordinates are published">
        <Toggle defaultOn={false} />
      </Field>

      <Field label="Location Permission Policy" sub="How the platform requests location access from guest devices">
        <SelectInput options={['Ask on First Use', 'Always Ask', 'Never Request (manual entry only)']} defaultValue="Ask on First Use" />
      </Field>

      <Field label="Coordinate Precision" sub="Number of decimal places stored for latitude and longitude values">
        <SelectInput options={['4 decimal places (~11 m)', '6 decimal places (~0.1 m)', '8 decimal places (survey grade)']} defaultValue="6 decimal places (~0.1 m)" />
      </Field>

      <Field label="Geocode Fallback Behavior" sub="Action taken when an address cannot be geocoded automatically">
        <SelectInput options={['Warn admin, allow save', 'Block save until resolved', 'Auto-assign city center coordinates']} defaultValue="Warn admin, allow save" />
      </Field>

    </div>
  )
}

function GenericConfigForm({ title }: { title: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 16 }}>{title}</div>
      {['Configuration Option 1', 'Configuration Option 2', 'Configuration Option 3'].map((o, i) => (
        <Field key={i} label={o} sub="Description of this configuration setting"><TextInput placeholder="Enter value..." /></Field>
      ))}
      <Field label="Enable Feature" sub="Toggle this configuration on or off"><Toggle defaultOn={true} /></Field>
    </div>
  )
}

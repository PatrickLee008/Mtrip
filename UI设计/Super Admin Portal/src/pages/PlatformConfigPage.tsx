import { useState } from 'react'
import { Settings, Tag, Users, DollarSign, CreditCard, RefreshCw, XCircle, Bell, Mail, MessageSquare, Zap, Link, Globe, Wrench, Megaphone, ChevronRight, X, Save } from 'lucide-react'
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
            <button onClick={() => showToast('success', 'Settings Saved', `${active?.title} configuration updated.`)} className="flex items-center gap-2 rounded-md px-4 text-white font-medium" style={{ height: 36, fontSize: 13, background: '#1664FF' }}>
              <Save size={13} /> Save Changes
            </button>
          </div>

          <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
            {activeConfig === 'platform' && <PlatformSettingsForm />}
            {activeConfig === 'commission' && <CommissionConfigForm />}
            {activeConfig === 'features' && <FeatureTogglesForm />}
            {activeConfig === 'maintenance' && <MaintenanceModeForm showToast={showToast} />}
            {activeConfig === 'api' && <ApiConfigForm />}
            {!['platform', 'commission', 'features', 'maintenance', 'api'].includes(activeConfig) && (
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

import { useState } from 'react'
import { Save, Globe, Bell, Shield, Database, RefreshCw, ChevronRight } from 'lucide-react'

const tabs = [
  { id: 'general', label: 'General', icon: <Globe size={14} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
  { id: 'security', label: 'Security', icon: <Shield size={14} /> },
  { id: 'system', label: 'System', icon: <Database size={14} /> },
]

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ minWidth: 280 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, maxWidth: 440 }}>{children}</div>
    </div>
  )
}

function TextInput({ defaultValue, placeholder }: { defaultValue?: string; placeholder?: string }) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-full rounded-md px-3 outline-none transition-all"
      style={{ height: 34, fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', background: '#fff' }}
      onFocus={(e) => (e.currentTarget.style.border = '1px solid #1664FF')}
      onBlur={(e) => (e.currentTarget.style.border = '1px solid #E3E8F0')}
    />
  )
}

function SelectInput({ options, defaultValue }: { options: string[]; defaultValue?: string }) {
  return (
    <select
      defaultValue={defaultValue}
      className="w-full rounded-md px-3 outline-none"
      style={{ height: 34, fontSize: 13, color: '#1A2332', border: '1px solid #E3E8F0', background: '#fff', appearance: 'auto' }}
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
}

function Toggle({ defaultOn = false, label }: { defaultOn?: boolean; label?: string }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setOn(!on)}
        className="rounded-full transition-all flex-shrink-0"
        style={{
          width: 40, height: 22,
          background: on ? '#1664FF' : '#CBD5E1',
          position: 'relative',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 16, height: 16,
            borderRadius: '50%',
            background: '#fff',
            top: 3,
            left: on ? 21 : 3,
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
      {label && <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>}
    </div>
  )
}

function GeneralTab() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>Platform Configuration</div>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Core system settings for the mTrip Super Admin Portal</div>
      <Field label="Platform Name" sub="Displayed across all partner-facing interfaces">
        <TextInput defaultValue="mTrip Hotel Platform" />
      </Field>
      <Field label="Default Currency" sub="Primary currency for display and reporting">
        <SelectInput options={['CNY (¥) — Chinese Yuan', 'USD ($) — US Dollar', 'EUR (€) — Euro', 'HKD (HK$) — Hong Kong Dollar']} defaultValue="CNY (¥) — Chinese Yuan" />
      </Field>
      <Field label="Default Language" sub="System UI language for admin users">
        <SelectInput options={['简体中文 (Simplified Chinese)', 'English', '繁體中文 (Traditional Chinese)', '日本語 (Japanese)']} defaultValue="English" />
      </Field>
      <Field label="Timezone" sub="Server and reporting timezone">
        <SelectInput options={['UTC+8 (Beijing / Shanghai)', 'UTC+0 (London)', 'UTC-5 (New York)', 'UTC+9 (Tokyo)']} defaultValue="UTC+8 (Beijing / Shanghai)" />
      </Field>
      <Field label="Date Format" sub="How dates are displayed in the system">
        <SelectInput options={['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY年MM月DD日']} defaultValue="YYYY-MM-DD" />
      </Field>
      <Field label="Commission Rate (Default)" sub="Applied to new partner agreements unless customized">
        <div className="flex items-center gap-2">
          <TextInput defaultValue="10.0" />
          <span style={{ fontSize: 13, color: '#94A3B8', flexShrink: 0 }}>%</span>
        </div>
      </Field>
      <Field label="Support Email" sub="Contact address shown to hotel partners">
        <TextInput defaultValue="partners@mtrip.com" />
      </Field>
    </div>
  )
}

function NotificationsTab() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>Notification Preferences</div>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Control what events trigger system alerts and emails</div>

      {[
        { label: 'New Booking Alerts', sub: 'Notify when a new booking is created', on: true },
        { label: 'Cancellation Alerts', sub: 'Notify on booking cancellations', on: true },
        { label: 'Payment Received', sub: 'Notify when settlement is received', on: true },
        { label: 'Rate Parity Issues', sub: 'Alert when pricing inconsistencies are detected', on: true },
        { label: 'Hotel Status Changes', sub: 'Notify when a hotel goes offline or is suspended', on: true },
        { label: 'Review Flagged', sub: 'Alert when a review is flagged for moderation', on: false },
        { label: 'API Error Threshold', sub: 'Alert when API error rate exceeds 2%', on: true },
        { label: 'Weekly Revenue Report', sub: 'Receive weekly summary email every Monday', on: true },
        { label: 'Monthly Settlement Summary', sub: 'Receive monthly settlement digest', on: true },
      ].map((item) => (
        <Field key={item.label} label={item.label} sub={item.sub}>
          <Toggle defaultOn={item.on} />
        </Field>
      ))}
    </div>
  )
}

function SecurityTab() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>Security Settings</div>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Authentication, access control, and audit configuration</div>

      <Field label="Two-Factor Authentication" sub="Require 2FA for all admin accounts">
        <Toggle defaultOn={true} label="Enforced for all Super Admins" />
      </Field>
      <Field label="Session Timeout" sub="Auto-logout inactive sessions after">
        <SelectInput options={['30 minutes', '1 hour', '2 hours', '4 hours', '8 hours', 'Never']} defaultValue="2 hours" />
      </Field>
      <Field label="IP Allowlist" sub="Restrict admin access to specific IP ranges">
        <TextInput placeholder="e.g. 203.119.0.0/16, 10.0.0.0/8" />
      </Field>
      <Field label="Password Policy" sub="Minimum requirements for admin passwords">
        <SelectInput options={['Strong (12+ chars, mixed)', 'Very Strong (16+ chars, symbols)', 'Custom Policy']} defaultValue="Strong (12+ chars, mixed)" />
      </Field>
      <Field label="Audit Log Retention" sub="How long to retain admin activity logs">
        <SelectInput options={['90 days', '180 days', '1 year', '2 years', '5 years']} defaultValue="1 year" />
      </Field>
      <Field label="SSO Integration" sub="Single Sign-On via corporate identity provider">
        <Toggle defaultOn={false} label="Enable SSO (SAML 2.0 / OAuth 2.0)" />
      </Field>
    </div>
  )
}

function SystemTab() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2332', marginBottom: 4 }}>System Administration</div>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>Infrastructure, caching, and maintenance settings</div>

      <Field label="Cache TTL" sub="How long API responses are cached">
        <SelectInput options={['5 minutes', '15 minutes', '30 minutes', '1 hour']} defaultValue="15 minutes" />
      </Field>
      <Field label="Booking Sync Interval" sub="How frequently bookings sync from OTA channels">
        <SelectInput options={['Real-time (webhook)', 'Every 5 minutes', 'Every 15 minutes', 'Every hour']} defaultValue="Real-time (webhook)" />
      </Field>
      <Field label="Rate Refresh Interval" sub="How often hotel rates are re-fetched">
        <SelectInput options={['Hourly', 'Every 4 hours', 'Daily']} defaultValue="Hourly" />
      </Field>
      <Field label="Maintenance Mode" sub="Take the platform offline for scheduled maintenance">
        <Toggle defaultOn={false} label="Enable maintenance page for partners" />
      </Field>
      <Field label="Debug Logging" sub="Verbose logging for API and integration debugging">
        <Toggle defaultOn={false} label="Enable verbose logs (impacts performance)" />
      </Field>

      <div className="mt-6 flex gap-3">
        <button
          className="flex items-center gap-2 rounded-md px-4 py-2 font-medium transition-colors"
          style={{ fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          <RefreshCw size={13} /> Flush Cache
        </button>
        <button
          className="flex items-center gap-2 rounded-md px-4 py-2 font-medium transition-colors"
          style={{ fontSize: 13, color: '#C01048', border: '1px solid #FEE2E2', background: '#FFF1F3' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#FFE4E6')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#FFF1F3')}
        >
          Force Resync All Channels
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')

  const tabContent: Record<string, React.ReactNode> = {
    general: <GeneralTab />,
    notifications: <NotificationsTab />,
    security: <SecurityTab />,
    system: <SystemTab />,
  }

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      <div className="mb-5">
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>System Settings</h1>
        <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>Platform configuration and administration</p>
      </div>

      <div className="flex gap-5">
        {/* Tab list */}
        <div
          className="rounded-lg overflow-hidden flex-shrink-0"
          style={{ width: 200, background: '#fff', border: '1px solid #E3E8F0', alignSelf: 'start' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center justify-between w-full px-4 transition-colors"
              style={{
                height: 44,
                fontSize: 13,
                color: activeTab === tab.id ? '#1664FF' : '#475569',
                background: activeTab === tab.id ? '#EEF4FF' : 'transparent',
                fontWeight: activeTab === tab.id ? 500 : 400,
                borderRight: activeTab === tab.id ? '2px solid #1664FF' : '2px solid transparent',
                borderBottom: '1px solid #F1F5F9',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div className="flex items-center gap-2.5">
                <span style={{ opacity: activeTab === tab.id ? 1 : 0.6 }}>{tab.icon}</span>
                {tab.label}
              </div>
              {activeTab === tab.id && <ChevronRight size={13} color="#1664FF" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 rounded-lg p-6" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
          {tabContent[activeTab]}

          {/* Save button */}
          <div className="flex items-center justify-end mt-6 pt-5" style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="flex items-center gap-3">
              <button
                className="rounded-md px-4 transition-colors"
                style={{ height: 36, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                Discard Changes
              </button>
              <button
                className="flex items-center gap-2 rounded-md px-4 text-white transition-colors"
                style={{ height: 36, fontSize: 13, fontWeight: 500, background: '#1664FF' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#0E4FCC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#1664FF')}
              >
                <Save size={13} /> Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

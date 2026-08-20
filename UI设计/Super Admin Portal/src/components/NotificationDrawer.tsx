import { useState } from 'react'
import {
  Bell, Mail, MessageSquare, Smartphone, Monitor, ChevronDown,
  Star, X, FileText, Eye, Link2, ExternalLink, Send,
} from 'lucide-react'
import Drawer from './Drawer'

// ── Shared templates ──────────────────────────────────────────────────────────

export interface NotifTemplate {
  id: string
  name: string
  category: 'booking' | 'payment' | 'promotion' | 'support' | 'account' | 'reward'
  title: string
  body: string
  channels: Channel[]
}

type Channel = 'push' | 'in-app' | 'email' | 'sms'

export const NOTIF_TEMPLATES: NotifTemplate[] = [
  { id: 'TPL-001', name: 'Booking Confirmation',    category: 'booking',   title: 'Booking Confirmed — {{booking_id}}',              body: 'Hi {{user_name}}, your booking at {{hotel_name}} ({{check_in}} → {{check_out}}) has been confirmed. Booking ID: {{booking_id}}.', channels: ['push', 'email'] },
  { id: 'TPL-002', name: 'Booking Cancellation',    category: 'booking',   title: 'Booking Cancelled — {{booking_id}}',              body: 'Your booking {{booking_id}} at {{hotel_name}} has been cancelled. {{refund_note}}', channels: ['push', 'email', 'sms'] },
  { id: 'TPL-003', name: 'Refund Processed',        category: 'payment',   title: 'Refund of MMK {{refund_amount}} Processed',       body: 'Hi {{user_name}}, a refund of MMK {{refund_amount}} for booking {{booking_id}} has been processed and will arrive within 3–5 business days.', channels: ['push', 'email', 'sms'] },
  { id: 'TPL-004', name: 'Payment Failed',           category: 'payment',   title: 'Payment Failed — Please Retry',                   body: 'Your payment for booking {{booking_id}} could not be processed. Please check your payment method and try again.', channels: ['push', 'in-app', 'sms'] },
  { id: 'TPL-005', name: 'Coupon Issued',            category: 'promotion', title: 'You Have a New Coupon: {{coupon_code}}',          body: 'Hi {{user_name}}, you have been issued coupon {{coupon_code}} giving you {{discount}} off your next booking. Valid until {{expiry_date}}.', channels: ['push', 'in-app', 'email'] },
  { id: 'TPL-006', name: 'Voucher Issued',           category: 'promotion', title: 'New Voucher — MMK {{amount}} Waiting for You',    body: 'A voucher worth MMK {{amount}} has been added to your account as part of {{campaign_name}}. Use it before {{expiry_date}}.', channels: ['push', 'in-app'] },
  { id: 'TPL-007', name: 'Reward Points Credited',  category: 'reward',    title: '+{{points}} Reward Points Credited',              body: 'Hi {{user_name}}, {{points}} reward points have been credited to your account for {{reason}}. Your new balance is {{balance}} pts.', channels: ['push', 'in-app'] },
  { id: 'TPL-008', name: 'Tier Upgrade',             category: 'reward',    title: 'Congratulations! You Are Now {{tier}} Member',    body: 'Great news, {{user_name}}! You have been upgraded to {{tier}} membership. Enjoy {{tier_benefits}} starting today.', channels: ['push', 'email'] },
  { id: 'TPL-009', name: 'Support Ticket Update',   category: 'support',   title: 'Support Ticket {{ticket_id}} Updated',            body: 'Your support ticket {{ticket_id}} regarding "{{subject}}" has been updated by our team. Please log in to view the response.', channels: ['push', 'email'] },
  { id: 'TPL-010', name: 'Support Ticket Resolved', category: 'support',   title: 'Support Ticket {{ticket_id}} Resolved',           body: 'Hi {{user_name}}, your support ticket {{ticket_id}} has been marked as resolved. We hope your issue has been addressed.', channels: ['push', 'email', 'sms'] },
  { id: 'TPL-011', name: 'Account Verification',    category: 'account',   title: 'Please Verify Your Account',                     body: 'Hi {{user_name}}, please complete your account verification to unlock all features. Use OTP: {{otp}}.', channels: ['sms', 'email'] },
  { id: 'TPL-012', name: 'Password Reset',           category: 'account',   title: 'Password Reset Request',                         body: 'We received a password reset request for your mTrip account. Use OTP {{otp}} to reset your password. Valid for 10 minutes.', channels: ['sms', 'email'] },
  { id: 'TPL-013', name: 'Promotional Campaign',    category: 'promotion', title: '{{campaign_name}} — Special Offer Just for You', body: 'Hi {{user_name}}, {{campaign_description}} Use code {{promo_code}} to get {{discount}} off your next booking. Offer ends {{expiry_date}}.', channels: ['push', 'email'] },
  { id: 'TPL-014', name: 'Custom Merchant Alert',   category: 'booking',   title: 'Important Update from {{hotel_name}}',           body: '{{hotel_name}} has an important update regarding your booking {{booking_id}}: {{message}}', channels: ['push', 'in-app', 'email'] },
]

const CATEGORY_COLOR: Record<NotifTemplate['category'], { color: string; bg: string }> = {
  booking:   { color: '#1664FF', bg: '#EEF4FF' },
  payment:   { color: '#7C3AED', bg: '#EDE9FE' },
  promotion: { color: '#EC4899', bg: '#FDF2F8' },
  support:   { color: '#D97706', bg: '#FFFBEB' },
  account:   { color: '#475569', bg: '#F1F5F9' },
  reward:    { color: '#F59E0B', bg: '#FFFBEB' },
}

const CHANNEL_CFG: Record<Channel, { label: string; icon: React.ReactNode; color: string }> = {
  push:     { label: 'Push',    icon: <Smartphone size={13} />, color: '#1664FF' },
  'in-app': { label: 'In-App', icon: <Monitor size={13} />,    color: '#6366F1' },
  email:    { label: 'Email',  icon: <Mail size={13} />,        color: '#059669' },
  sms:      { label: 'SMS',    icon: <MessageSquare size={13} />, color: '#D97706' },
}

// ── Notification Category ─────────────────────────────────────────────────────

export type NotifCategory =
  | 'booking' | 'promotion' | 'rewards' | 'wallet' | 'refund'
  | 'account' | 'security' | 'support' | 'system'

const NOTIF_CATEGORY_CFG: Record<NotifCategory, { label: string; color: string; bg: string }> = {
  booking:   { label: 'Booking',   color: '#1664FF', bg: '#EEF4FF' },
  promotion: { label: 'Promotion', color: '#EC4899', bg: '#FDF2F8' },
  rewards:   { label: 'Rewards',   color: '#F59E0B', bg: '#FFFBEB' },
  wallet:    { label: 'Wallet',    color: '#7C3AED', bg: '#EDE9FE' },
  refund:    { label: 'Refund',    color: '#059669', bg: '#ECFDF3' },
  account:   { label: 'Account',   color: '#475569', bg: '#F1F5F9' },
  security:  { label: 'Security',  color: '#DC2626', bg: '#FFF1F3' },
  support:   { label: 'Support',   color: '#D97706', bg: '#FFFBEB' },
  system:    { label: 'System',    color: '#64748B', bg: '#F8FAFC' },
}

const TPL_TO_CATEGORY: Record<NotifTemplate['category'], NotifCategory> = {
  booking: 'booking', payment: 'wallet', promotion: 'promotion',
  support: 'support', account: 'account', reward: 'rewards',
}

// ── Deep Link ─────────────────────────────────────────────────────────────────

export type DeepLinkDest = 'booking_detail' | 'wallet' | 'promotion' | 'coupon' | 'profile' | 'external_url' | 'none'

const DEEP_LINK_LABELS: Record<DeepLinkDest, string> = {
  booking_detail: 'Booking Detail',
  wallet:         'Wallet',
  promotion:      'Promotion',
  coupon:         'Coupon',
  profile:        'User Profile',
  external_url:   'External URL',
  none:           'None (no deep link)',
}

// ── Sent payload (exported for consumer) ─────────────────────────────────────

export interface SentNotifPayload {
  id: string
  category: NotifCategory
  title: string
  message: string
  channels: Channel[]
  deepLinkDest: DeepLinkDest
  externalUrl: string
  scheduledAt: string | null
  sentAt: string
  sentBy: 'Admin'
}

// ── Recipient ─────────────────────────────────────────────────────────────────

export interface NotifRecipient {
  kind: 'user' | 'merchant'
  id: string
  name: string
  email?: string
  phone?: string
  tier?: string
  avatar?: string
  avatarBg?: string
}

// ── Variable resolution ───────────────────────────────────────────────────────

function resolveKnownVars(text: string, recipient: NotifRecipient | null): string {
  if (!recipient) return text
  return text
    .replace(/\{\{user_name\}\}/gi, recipient.name)
    .replace(/\{\{user_id\}\}/gi, recipient.id)
    .replace(/\{\{email\}\}/gi, recipient.email ?? '{{email}}')
    .replace(/\{\{phone\}\}/gi, recipient.phone ?? '{{phone}}')
    .replace(/\{\{tier\}\}/gi, recipient.tier ?? '{{tier}}')
}

// Render text with unresolved {{vars}} highlighted
function renderWithVars(text: string, baseStyle?: React.CSSProperties): React.ReactNode {
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return parts.map((part, i) =>
    part.startsWith('{{') && part.endsWith('}}')
      ? <mark key={i} style={{ background: '#FEF3C7', color: '#92400E', padding: '0 3px', borderRadius: 3, fontSize: 'inherit', ...baseStyle }}>{part}</mark>
      : part
  )
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function NotifPreviewModal({ title, body, channels, category, recipient, onClose }: {
  title: string; body: string; channels: Set<Channel>
  category: NotifCategory; recipient: NotifRecipient | null; onClose: () => void
}) {
  const hasPush  = channels.has('push')
  const hasEmail = channels.has('email')
  const hasSms   = channels.has('sms')
  const hasInApp = channels.has('in-app')
  const catCfg   = NOTIF_CATEGORY_CFG[category]

  const SectionLabel = ({ label }: { label: string }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{label}</div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 500, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2332' }}>Notification Preview</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>How users will see this notification</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: '20px' }}>
          {/* Amber note about unresolved vars */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', marginBottom: 20, fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>
            <strong>Preview mode.</strong> Variables shown in <mark style={{ background: '#FEF3C7', padding: '0 4px', borderRadius: 2, color: '#92400E' }}>amber</mark> will be substituted with live data at delivery time.
          </div>

          {/* Push */}
          {hasPush && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel label="Push Notification" />
              <div style={{ background: '#1A2332', borderRadius: 20, padding: '14px 14px 18px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748B', marginBottom: 14 }}>
                  <span>09:41</span><span>●●●●</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.11)', borderRadius: 12, padding: '10px 12px', backdropFilter: 'blur(8px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: catCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bell size={11} color={catCfg.color} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#E2E8F0' }}>mTrip</span>
                    <span style={{ fontSize: 9, color: '#64748B', marginLeft: 'auto' }}>now</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', marginBottom: 4, lineHeight: 1.3 }}>
                    {renderWithVars(title || 'Notification Title')}
                  </div>
                  <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.5 }}>
                    {renderWithVars((body.slice(0, 100) + (body.length > 100 ? '…' : '')) || 'Message body…')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* In-App */}
          {hasInApp && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel label="In-App Notification" />
              <div style={{ border: '1px solid #E3E8F0', borderRadius: 10, padding: '14px', background: '#FAFBFC' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: catCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bell size={16} color={catCfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginBottom: 4, lineHeight: 1.3 }}>{renderWithVars(title || 'Notification Title')}</div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{renderWithVars(body || 'Message content…')}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>Just now</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email */}
          {hasEmail && (
            <div style={{ marginBottom: 22 }}>
              <SectionLabel label="Email" />
              <div style={{ border: '1px solid #E3E8F0', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#F8FAFC', padding: '10px 16px', borderBottom: '1px solid #E3E8F0' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>From: noreply@mtrip.com · Subject</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2332', marginTop: 2 }}>{renderWithVars(title || 'Notification Title')}</div>
                </div>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1664FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bell size={14} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A2332' }}>mTrip</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>noreply@mtrip.com</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#1A2332', lineHeight: 1.7 }}>{renderWithVars(body || 'Message body…')}</div>
                  {recipient?.email && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 14 }}>To: {recipient.email}</div>}
                </div>
              </div>
            </div>
          )}

          {/* SMS */}
          {hasSms && (
            <div>
              <SectionLabel label="SMS" />
              <div style={{ background: '#F0FFF4', border: '1px solid #A7F3D0', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: '#047857', marginBottom: 6, fontWeight: 700 }}>mTrip → {recipient?.phone ?? 'Phone Number'}</div>
                <div style={{ fontSize: 13, color: '#1A2332', lineHeight: 1.6 }}>
                  {renderWithVars((body.slice(0, 160) + (body.length > 160 ? '…' : '')) || 'Message content…')}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>{Math.min(body.length, 160)}/160 characters</div>
              </div>
            </div>
          )}

          {!hasPush && !hasEmail && !hasSms && !hasInApp && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8', fontSize: 13 }}>
              No channels selected. Select at least one channel to see a preview.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: '#1664FF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  recipient: NotifRecipient | null
  onClose: () => void
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void
  onSent?: (payload: SentNotifPayload) => void
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export default function NotificationDrawer({ open, recipient, onClose, showToast, onSent }: Props) {
  const [category, setCategory]         = useState<NotifCategory | ''>('')
  const [title, setTitle]               = useState('')
  const [body, setBody]                 = useState('')
  const [channels, setChannels]         = useState<Set<Channel>>(new Set(['push', 'in-app']))
  const [deepLink, setDeepLink]         = useState<DeepLinkDest>('none')
  const [externalUrl, setExternalUrl]   = useState('')
  const [schedule, setSchedule]         = useState<'now' | 'later'>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [tplSearch, setTplSearch]       = useState('')
  const [showPreview, setShowPreview]   = useState(false)
  const [sending, setSending]           = useState(false)
  const [errors, setErrors]             = useState<{ category?: string; title?: string; body?: string; channels?: string }>({})

  function reset() {
    setCategory(''); setTitle(''); setBody(''); setChannels(new Set(['push', 'in-app']))
    setDeepLink('none'); setExternalUrl(''); setSchedule('now')
    setScheduleDate(''); setScheduleTime(''); setShowTemplates(false)
    setTplSearch(''); setSending(false); setErrors({})
  }

  function handleClose() { reset(); onClose() }

  function toggleChannel(ch: Channel) {
    setChannels(prev => { const s = new Set(prev); s.has(ch) ? s.delete(ch) : s.add(ch); return s })
    if (errors.channels) setErrors(p => ({ ...p, channels: undefined }))
  }

  function applyTemplate(t: NotifTemplate) {
    setTitle(resolveKnownVars(t.title, recipient))
    setBody(resolveKnownVars(t.body, recipient))
    setChannels(new Set(t.channels))
    setCategory(TPL_TO_CATEGORY[t.category])
    setShowTemplates(false)
    setTplSearch('')
    if (errors.title) setErrors(p => ({ ...p, title: undefined }))
    if (errors.body) setErrors(p => ({ ...p, body: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!category) e.category = 'Please select a notification category'
    if (!title.trim()) e.title = 'Title is required'
    if (!body.trim()) e.body = 'Message body is required'
    if (channels.size === 0) e.channels = 'Select at least one channel'
    return e
  }

  function handleSend() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSending(true)
    const now = new Date()
    const sentAt = now.toISOString().slice(0, 16).replace('T', ' ')
    const scheduledAt = schedule === 'later' && scheduleDate
      ? `${scheduleDate} ${scheduleTime || '00:00'}`
      : null
    setTimeout(() => {
      const payload: SentNotifPayload = {
        id: `NTF-ADM-${now.getTime().toString().slice(-8)}`,
        category: category as NotifCategory,
        title, message: body,
        channels: Array.from(channels),
        deepLinkDest: deepLink,
        externalUrl,
        scheduledAt,
        sentAt,
        sentBy: 'Admin',
      }
      onSent?.(payload)
      showToast('success', 'Notification Sent', `Notification sent to ${recipient?.name}${scheduledAt ? ` · Scheduled for ${scheduledAt}` : ''}.`)
      setSending(false)
      handleClose()
    }, 600)
  }

  const filteredTemplates = NOTIF_TEMPLATES.filter(t =>
    !tplSearch || t.name.toLowerCase().includes(tplSearch.toLowerCase()) ||
    t.category.includes(tplSearch.toLowerCase())
  )

  const inp = (err?: string): React.CSSProperties => ({
    width: '100%', border: `1.5px solid ${err ? '#FCA5A5' : '#E3E8F0'}`,
    borderRadius: 8, padding: '0 12px', fontSize: 13, color: '#1A2332',
    outline: 'none', background: err ? '#FFF5F5' : '#fff', boxSizing: 'border-box',
    height: 38,
  })

  const sel: React.CSSProperties = {
    width: '100%', border: '1.5px solid #E3E8F0', borderRadius: 8, padding: '0 12px',
    fontSize: 13, color: '#1A2332', outline: 'none', background: '#fff',
    boxSizing: 'border-box', height: 38, cursor: 'pointer', appearance: 'none',
  }

  return (
    <>
      {showPreview && (
        <NotifPreviewModal
          title={title} body={body} channels={channels}
          category={(category || 'system') as NotifCategory}
          recipient={recipient}
          onClose={() => setShowPreview(false)}
        />
      )}

      <Drawer
        open={open}
        onClose={handleClose}
        title="Send Notification"
        subtitle={recipient ? `To: ${recipient.name} · ${recipient.id}` : ''}
        width={540}
        footer={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <button onClick={handleClose}
              style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #E3E8F0', background: '#fff', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => setShowPreview(true)}
              style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F8FAFC', fontSize: 13, color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Eye size={13} /> Preview
            </button>
            <button onClick={handleSend} disabled={sending}
              style={{ height: 36, padding: '0 20px', marginLeft: 'auto', borderRadius: 8, border: 'none', background: sending ? '#93C5FD' : '#1664FF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Send size={13} /> {sending ? 'Sending…' : schedule === 'now' ? 'Send Now' : 'Schedule'}
            </button>
          </div>
        }
      >
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Recipient */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Recipient</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E3E8F0', borderRadius: 8 }}>
              {recipient?.avatarBg ? (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: recipient.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {recipient.avatar}
                </div>
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1664FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bell size={16} color="#fff" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2332' }}>{recipient?.name}</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', background: '#fff', padding: '1px 6px', borderRadius: 4, border: '1px solid #E3E8F0' }}>{recipient?.id}</span>
                  {recipient?.tier && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FFFBEB', color: '#B45309', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                      <Star size={8} fill="#B45309" /> {recipient.tier}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                  {recipient?.email && <span style={{ fontSize: 11, color: '#64748B' }}>{recipient.email}</span>}
                  {recipient?.phone && <span style={{ fontSize: 11, color: '#64748B' }}>{recipient.phone}</span>}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic', flexShrink: 0 }}>Read-only</div>
            </div>
          </div>

          {/* Notification Category */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Notification Category <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select value={category} onChange={e => { setCategory(e.target.value as NotifCategory); if (errors.category) setErrors(p => ({ ...p, category: undefined })) }} style={{ ...sel, border: `1.5px solid ${errors.category ? '#FCA5A5' : '#E3E8F0'}`, background: errors.category ? '#FFF5F5' : '#fff', paddingRight: 34 }}>
                <option value="">Select a category…</option>
                {(Object.entries(NOTIF_CATEGORY_CFG) as [NotifCategory, typeof NOTIF_CATEGORY_CFG[NotifCategory]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <ChevronDown size={13} color="#94A3B8" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              {category && (
                <span style={{ position: 'absolute', right: 30, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: NOTIF_CATEGORY_CFG[category as NotifCategory].bg, color: NOTIF_CATEGORY_CFG[category as NotifCategory].color }}>
                  {NOTIF_CATEGORY_CFG[category as NotifCategory].label}
                </span>
              )}
            </div>
            {errors.category && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.category}</div>}
          </div>

          {/* Use Template */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowTemplates(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 36, padding: '0 12px', borderRadius: 8, border: '1.5px solid #E3E8F0', background: '#F8FAFC', fontSize: 12, color: '#475569', cursor: 'pointer', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={13} color="#94A3B8" />
                Use Template
                <span style={{ fontSize: 10, color: '#94A3B8' }}>— auto-fills title, message &amp; category</span>
              </span>
              <ChevronDown size={13} style={{ transform: showTemplates ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
            </button>
            {showTemplates && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 50, overflow: 'hidden', maxHeight: 320 }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC' }}>
                  <input value={tplSearch} onChange={e => setTplSearch(e.target.value)}
                    placeholder="Search templates…"
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, color: '#1A2332', background: 'transparent' }} />
                  {tplSearch && <button onClick={() => setTplSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={12} /></button>}
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 260 }}>
                  {filteredTemplates.map(t => {
                    const cat = CATEGORY_COLOR[t.category]
                    return (
                      <button key={t.id} onClick={() => applyTemplate(t)}
                        style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #F8FAFC' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: cat.color, background: cat.bg, flexShrink: 0, marginTop: 1, textTransform: 'capitalize' }}>{t.category}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', marginBottom: 2 }}>{t.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        </div>
                      </button>
                    )
                  })}
                  {filteredTemplates.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>No templates found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Notification Title <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input value={title} onChange={e => { setTitle(e.target.value); if (errors.title) setErrors(p => ({ ...p, title: undefined })) }}
              placeholder="e.g. Your refund of MMK {{refund_amount}} has been processed"
              style={inp(errors.title)} />
            {errors.title && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>{errors.title}</div>}
          </div>

          {/* Message */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Message <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea value={body} onChange={e => { setBody(e.target.value); if (errors.body) setErrors(p => ({ ...p, body: undefined })) }}
              placeholder={'Type the message here or select a template above.\nSupported variables: {{user_name}}, {{booking_id}}, {{refund_amount}}, {{hotel_name}}, {{otp}}, and more.'}
              rows={5}
              style={{ width: '100%', border: `1.5px solid ${errors.body ? '#FCA5A5' : '#E3E8F0'}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1A2332', outline: 'none', background: errors.body ? '#FFF5F5' : '#fff', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {errors.body ? <span style={{ fontSize: 11, color: '#DC2626' }}>{errors.body}</span> : <span />}
              <span style={{ fontSize: 11, color: body.length > 160 ? '#D97706' : '#CBD5E1' }}>{body.length} chars</span>
            </div>
          </div>

          {/* Deep Link */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              <Link2 size={12} color="#94A3B8" /> Deep Link / Destination
            </label>
            <div style={{ position: 'relative' }}>
              <select value={deepLink} onChange={e => setDeepLink(e.target.value as DeepLinkDest)} style={{ ...sel, paddingRight: 34 }}>
                {(Object.entries(DEEP_LINK_LABELS) as [DeepLinkDest, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <ChevronDown size={13} color="#94A3B8" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            {deepLink === 'external_url' && (
              <div style={{ marginTop: 8, position: 'relative' }}>
                <ExternalLink size={12} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input value={externalUrl} onChange={e => setExternalUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  style={{ ...inp(), paddingLeft: 28 }} />
              </div>
            )}
          </div>

          {/* Channels */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
              Delivery Channel <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['push', 'in-app', 'email', 'sms'] as Channel[]).map(ch => {
                const cfg = CHANNEL_CFG[ch]
                const active = channels.has(ch)
                return (
                  <button key={ch} onClick={() => toggleChannel(ch)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${active ? cfg.color : '#E3E8F0'}`, background: active ? cfg.color + '12' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: active ? cfg.color : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#fff' : '#94A3B8', flexShrink: 0 }}>
                      {cfg.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: active ? cfg.color : '#475569' }}>{cfg.label}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                        {ch === 'push' ? 'Mobile device' : ch === 'in-app' ? 'In mTrip app' : ch === 'email' ? (recipient?.email ?? 'Email') : (recipient?.phone ?? 'Phone')}
                      </div>
                    </div>
                    {active && (
                      <div style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {errors.channels && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 6 }}>{errors.channels}</div>}
          </div>

          {/* Send Timing */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>Send Timing</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: schedule === 'later' ? 12 : 0 }}>
              {(['now', 'later'] as const).map(opt => (
                <button key={opt} onClick={() => setSchedule(opt)}
                  style={{ flex: 1, height: 36, borderRadius: 8, border: `1.5px solid ${schedule === opt ? '#1664FF' : '#E3E8F0'}`, background: schedule === opt ? '#EEF4FF' : '#fff', color: schedule === opt ? '#1664FF' : '#64748B', fontSize: 12, fontWeight: schedule === opt ? 600 : 400, cursor: 'pointer' }}>
                  {opt === 'now' ? '⚡ Send Now' : '📅 Schedule for Later'}
                </button>
              ))}
            </div>
            {schedule === 'later' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Date</div>
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                    style={inp()} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>Time (MMT, UTC+6:30)</div>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    style={inp()} />
                </div>
                {scheduleDate && scheduleTime && (
                  <div style={{ gridColumn: '1 / -1', fontSize: 11, color: '#1664FF', background: '#EEF4FF', padding: '6px 10px', borderRadius: 6 }}>
                    Scheduled for <strong>{scheduleDate} at {scheduleTime} MMT</strong>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </Drawer>
    </>
  )
}

import { useEffect } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  variant?: 'confirm' | 'danger' | 'warning' | 'success'
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  children?: React.ReactNode
  loading?: boolean
}

const variantCfg = {
  confirm: { icon: Info, iconBg: '#EFF6FF', iconColor: '#2563EB', btnBg: '#1664FF', btnHover: '#0E4FCC' },
  danger: { icon: XCircle, iconBg: '#FFF1F3', iconColor: '#E11D48', btnBg: '#DC2626', btnHover: '#B91C1C' },
  warning: { icon: AlertTriangle, iconBg: '#FFFBEB', iconColor: '#D97706', btnBg: '#D97706', btnHover: '#B45309' },
  success: { icon: CheckCircle, iconBg: '#ECFDF3', iconColor: '#059669', btnBg: '#059669', btnHover: '#047857' },
}

export default function Dialog({ open, onClose, variant = 'confirm', title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, children, loading }: DialogProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const { icon: Icon, iconBg, iconColor, btnBg, btnHover } = variantCfg[variant]

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,22,40,0.5)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div
        className="rounded-xl p-6 flex flex-col gap-4"
        style={{ background: '#fff', width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'dialogIn 0.2s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: iconBg }}>
            <Icon size={20} color={iconColor} />
          </div>
          <div className="flex-1">
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{title}</h3>
            {message && <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 1.6 }}>{message}</p>}
          </div>
        </div>

        {children && (
          <div style={{ paddingLeft: 52 }}>{children}</div>
        )}

        <div className="flex items-center justify-end gap-3" style={{ paddingTop: 4 }}>
          <button
            onClick={onClose}
            className="rounded-md px-4 transition-colors"
            style={{ height: 36, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md px-4 text-white font-medium transition-colors disabled:opacity-60"
            style={{ height: 36, fontSize: 13, background: btnBg }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = btnHover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = btnBg }}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`@keyframes dialogIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }`}</style>
    </div>
  )
}

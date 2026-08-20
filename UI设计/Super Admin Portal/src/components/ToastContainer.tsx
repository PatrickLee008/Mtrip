import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import type { Toast } from '../hooks/useToast'

const cfg = {
  success: { icon: CheckCircle, bg: '#ECFDF3', border: '#A7F3D0', title: '#065F46', text: '#047857', iconColor: '#059669' },
  error: { icon: XCircle, bg: '#FFF1F3', border: '#FECDD3', title: '#881337', text: '#BE123C', iconColor: '#E11D48' },
  warning: { icon: AlertCircle, bg: '#FFFBEB', border: '#FDE68A', title: '#78350F', text: '#92400E', iconColor: '#D97706' },
  info: { icon: Info, bg: '#EFF6FF', border: '#BFDBFE', title: '#1E3A8A', text: '#1D4ED8', iconColor: '#2563EB' },
}

export default function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="fixed flex flex-col gap-2 z-50"
      style={{ top: 72, right: 24, maxWidth: 360, pointerEvents: 'none' }}
    >
      {toasts.map((t) => {
        const c = cfg[t.type]
        const Icon = c.icon
        return (
          <div
            key={t.id}
            className="flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg"
            style={{ background: c.bg, border: `1px solid ${c.border}`, pointerEvents: 'all', animation: 'slideInRight 0.2s ease' }}
          >
            <Icon size={16} color={c.iconColor} style={{ flexShrink: 0, marginTop: 1 }} />
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 600, color: c.title }}>{t.title}</div>
              {t.message && <div style={{ fontSize: 12, color: c.text, marginTop: 2 }}>{t.message}</div>}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              style={{ color: c.text, opacity: 0.6, flexShrink: 0, lineHeight: 1 }}
              className="hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
      <style>{`@keyframes slideInRight { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }`}</style>
    </div>
  )
}

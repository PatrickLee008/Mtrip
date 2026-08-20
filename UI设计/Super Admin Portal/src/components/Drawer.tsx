import { X } from 'lucide-react'
import { useEffect } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  width?: number
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function Drawer({ open, onClose, title, subtitle, width = 640, children, footer }: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: 'rgba(10,22,40,0.45)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width,
          background: '#fff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          transform: open ? 'translateX(0)' : `translateX(${width}px)`,
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{ height: 60, borderBottom: '1px solid #E3E8F0' }}
        >
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A2332' }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{ width: 32, height: 32, color: '#64748B' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#1A2332' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid #E3E8F0', background: '#FAFBFC' }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

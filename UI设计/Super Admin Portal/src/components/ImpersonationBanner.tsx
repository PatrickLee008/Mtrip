import { AlertTriangle, X, Eye } from 'lucide-react'

interface ImpersonationBannerProps {
  merchantName: string
  merchantId: string
  reason: string
  onExit: () => void
}

export default function ImpersonationBanner({ merchantName, merchantId, reason, onExit }: ImpersonationBannerProps) {
  return (
    <div
      className="flex items-center justify-between px-6 flex-shrink-0 z-30"
      style={{ height: 44, background: '#B45309', borderBottom: '1px solid rgba(0,0,0,0.15)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded"
          style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.2)' }}
        >
          <Eye size={13} color="#fff" />
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Impersonation Mode</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>—</span>
          <span style={{ fontSize: 13, color: '#FEF3C7', fontWeight: 500 }}>
            You are currently acting as <strong className="text-white">{merchantName}</strong> ({merchantId})
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>Reason: {reason}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded px-2 py-1" style={{ background: 'rgba(255,255,255,0.15)', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
          <AlertTriangle size={11} />
          All actions are logged
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-md px-3 font-semibold transition-colors"
          style={{ height: 28, fontSize: 12, background: '#fff', color: '#B45309' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#FEF3C7')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          <X size={12} /> Exit Impersonation
        </button>
      </div>
    </div>
  )
}

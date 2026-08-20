import { useState } from 'react'
import { Search, Plus, Filter, Download, Eye, Edit2, MoreHorizontal, Star, ChevronLeft, ChevronRight } from 'lucide-react'

interface Hotel {
  id: string
  name: string
  city: string
  address: string
  stars: number
  rooms: number
  occ: number
  revpar: number
  adr: number
  rating: number
  reviews: number
  status: 'active' | 'suspended' | 'pending' | 'offline'
  partner: string
  since: string
  revenue: string
}

const hotels: Hotel[] = [
  { id: 'HT-00124', name: 'The Peninsula Beijing', city: 'Beijing', address: '8 Goldfish Lane, Wangfujing', stars: 5, rooms: 525, occ: 91.2, revpar: 1840, adr: 2018, rating: 4.9, reviews: 12847, status: 'active', partner: 'Direct', since: '2019-03', revenue: '¥2.8M' },
  { id: 'HT-00217', name: 'Grand Hyatt Shanghai', city: 'Shanghai', address: 'Jin Mao Tower, 88 Century Ave', stars: 5, rooms: 631, occ: 88.5, revpar: 1620, adr: 1831, rating: 4.8, reviews: 9204, status: 'active', partner: 'Direct', since: '2018-06', revenue: '¥2.4M' },
  { id: 'HT-00389', name: 'Marriott Shenzhen', city: 'Shenzhen', address: '1088 Fuhua 3 Rd, Futian', stars: 5, rooms: 466, occ: 85.3, revpar: 1240, adr: 1453, rating: 4.7, reviews: 7612, status: 'active', partner: 'Ctrip', since: '2020-01', revenue: '¥1.9M' },
  { id: 'HT-00441', name: 'Hilton Chengdu', city: 'Chengdu', address: '1 Shuncheng Ave, Jinjiang', stars: 4, rooms: 347, occ: 82.7, revpar: 890, adr: 1077, rating: 4.6, reviews: 5398, status: 'active', partner: 'Meituan', since: '2021-04', revenue: '¥1.3M' },
  { id: 'HT-00512', name: 'Sofitel Guangzhou', city: 'Guangzhou', address: '668 Airport Rd, Baiyun', stars: 5, rooms: 420, occ: 79.4, revpar: 980, adr: 1234, rating: 4.6, reviews: 6201, status: 'active', partner: 'Fliggy', since: '2019-11', revenue: '¥1.5M' },
  { id: 'HT-00603', name: 'W Hotel Chengdu', city: 'Chengdu', address: '9 Huan Hua South Rd', stars: 5, rooms: 289, occ: 76.8, revpar: 1120, adr: 1459, rating: 4.7, reviews: 3804, status: 'active', partner: 'Direct', since: '2022-08', revenue: '¥1.1M' },
  { id: 'HT-00718', name: 'Fairmont Hangzhou', city: 'Hangzhou', address: '2258 Binhe Rd, Binjiang', stars: 5, rooms: 378, occ: 74.2, revpar: 860, adr: 1159, rating: 4.5, reviews: 4720, status: 'active', partner: 'Ctrip', since: '2020-09', revenue: '¥980K' },
  { id: 'HT-00824', name: 'InterContinental Xiamen', city: 'Xiamen', address: '180 Jianye Rd, Huli', stars: 5, rooms: 302, occ: 71.5, revpar: 720, adr: 1007, rating: 4.4, reviews: 3102, status: 'active', partner: 'Meituan', since: '2021-12', revenue: '¥840K' },
  { id: 'HT-00931', name: 'Radisson Blu Wuhan', city: 'Wuhan', address: '6 Jiangjun Ave, Hannan', stars: 4, rooms: 418, occ: 68.3, revpar: 560, adr: 820, rating: 4.3, reviews: 2891, status: 'active', partner: 'Ctrip', since: '2022-03', revenue: '¥720K' },
  { id: 'HT-01042', name: 'Novotel Nanjing East', city: 'Nanjing', address: '200 Zhongshan East Rd', stars: 4, rooms: 326, occ: 65.1, revpar: 480, adr: 737, rating: 4.2, reviews: 2140, status: 'pending', partner: 'Fliggy', since: '2023-06', revenue: '¥520K' },
  { id: 'HT-01156', name: 'Wyndham Qingdao', city: 'Qingdao', address: '57 Yan An 3 Rd, Shinan', stars: 4, rooms: 284, occ: 61.4, revpar: 390, adr: 635, rating: 4.1, reviews: 1680, status: 'active', partner: 'Direct', since: '2023-01', revenue: '¥410K' },
  { id: 'HT-01278', name: 'Hampton Inn Tianjin', city: 'Tianjin', address: '218 Binshui West Rd', stars: 3, rooms: 196, occ: 58.7, revpar: 240, adr: 409, rating: 4.0, reviews: 920, status: 'suspended', partner: 'Meituan', since: '2021-07', revenue: '¥190K' },
]

const cities = ['All Cities', 'Beijing', 'Shanghai', 'Shenzhen', 'Guangzhou', 'Chengdu', 'Hangzhou', 'Xiamen', 'Wuhan', 'Nanjing', 'Tianjin', 'Qingdao']
const starOptions = ['All Stars', '5 Stars', '4 Stars', '3 Stars']
const statusOptions = ['All Status', 'Active', 'Pending', 'Suspended', 'Offline']

function StatusBadge({ status }: { status: Hotel['status'] }) {
  const cfg = {
    active: { bg: '#ECFDF3', color: '#027A48' },
    pending: { bg: '#FFFAEB', color: '#B54708' },
    suspended: { bg: '#FFF1F3', color: '#C01048' },
    offline: { bg: '#F8FAFC', color: '#475569' },
  }
  const c = cfg[status]
  return (
    <span className="inline-flex items-center rounded px-1.5 capitalize font-medium" style={{ fontSize: 11, background: c.bg, color: c.color, height: 20 }}>
      {status}
    </span>
  )
}

function StarRating({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={11} fill={i < n ? '#F59E0B' : 'none'} color={i < n ? '#F59E0B' : '#CBD5E1'} />
      ))}
    </div>
  )
}

export default function HotelsPage() {
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('All Cities')
  const [stars, setStars] = useState('All Stars')
  const [status, setStatus] = useState('All Status')
  const [page, setPage] = useState(1)
  const perPage = 10

  const filtered = hotels.filter((h) => {
    const matchSearch = !search || h.name.toLowerCase().includes(search.toLowerCase()) || h.city.toLowerCase().includes(search.toLowerCase())
    const matchCity = city === 'All Cities' || h.city === city
    const matchStars = stars === 'All Stars' || h.stars === parseInt(stars)
    const matchStatus = status === 'All Status' || h.status === status.toLowerCase()
    return matchSearch && matchCity && matchStars && matchStatus
  })

  const total = filtered.length
  const start = (page - 1) * perPage
  const rows = filtered.slice(start, start + perPage)
  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="p-6" style={{ minWidth: 1000 }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A2332' }}>Hotel Management</h1>
          <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
            {total} hotels · 1,847 total active properties
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-md px-3 transition-colors"
            style={{ height: 34, fontSize: 13, color: '#475569', border: '1px solid #E3E8F0', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <Download size={13} /> Export
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md px-3 text-white"
            style={{ height: 34, fontSize: 13, background: '#1664FF', fontWeight: 500 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0E4FCC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1664FF')}
          >
            <Plus size={13} /> Add Hotel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="flex items-center gap-3 rounded-lg px-4 py-3 mb-4"
        style={{ background: '#fff', border: '1px solid #E3E8F0' }}
      >
        <div className="flex items-center gap-2 flex-1" style={{ maxWidth: 280 }}>
          <Search size={13} color="#94A3B8" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search hotel name or city..."
            className="flex-1 outline-none bg-transparent"
            style={{ fontSize: 13, color: '#1A2332' }}
          />
        </div>
        <div style={{ width: 1, height: 20, background: '#E3E8F0' }} />
        {[
          { value: city, options: cities, onChange: (v: string) => { setCity(v); setPage(1) } },
          { value: stars, options: starOptions, onChange: (v: string) => { setStars(v); setPage(1) } },
          { value: status, options: statusOptions, onChange: (v: string) => { setStatus(v); setPage(1) } },
        ].map((sel, i) => (
          <select
            key={i}
            value={sel.value}
            onChange={(e) => sel.onChange(e.target.value)}
            className="outline-none bg-transparent cursor-pointer"
            style={{ fontSize: 12, color: sel.value.startsWith('All') ? '#94A3B8' : '#1A2332', border: 'none' }}
          >
            {sel.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
        <div className="ml-auto flex items-center gap-1.5" style={{ fontSize: 12, color: '#94A3B8' }}>
          <Filter size={12} />
          <span>{total} results</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #E3E8F0' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E3E8F0' }}>
              {['Hotel', 'City', 'Stars', 'Rooms', 'Occupancy', 'RevPAR', 'ADR', 'Rating', 'Status', 'Revenue MTD', ''].map((h) => (
                <th key={h} className="text-left px-4" style={{ height: 36, fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => (
              <tr
                key={h.id}
                style={{ borderBottom: i < rows.length - 1 ? '1px solid #F8FAFC' : 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="px-4" style={{ height: 48 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2332' }}>{h.name}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace', marginTop: 1 }}>{h.id}</div>
                </td>
                <td className="px-4" style={{ fontSize: 12, color: '#475569' }}>{h.city}</td>
                <td className="px-4"><StarRating n={h.stars} /></td>
                <td className="px-4" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{h.rooms}</td>
                <td className="px-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full overflow-hidden" style={{ width: 48, height: 5, background: '#F1F5F9' }}>
                      <div className="h-full rounded-full" style={{ width: `${h.occ}%`, background: h.occ > 80 ? '#10B981' : h.occ > 60 ? '#F59E0B' : '#EF4444' }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{h.occ}%</span>
                  </div>
                </td>
                <td className="px-4" style={{ fontSize: 12, color: '#1A2332', fontFamily: 'monospace', fontWeight: 500 }}>¥{h.revpar}</td>
                <td className="px-4" style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>¥{h.adr}</td>
                <td className="px-4">
                  <div className="flex items-center gap-1">
                    <Star size={11} fill="#F59E0B" color="#F59E0B" />
                    <span style={{ fontSize: 12, color: '#1A2332', fontWeight: 500 }}>{h.rating}</span>
                    <span style={{ fontSize: 11, color: '#CBD5E1' }}>({(h.reviews / 1000).toFixed(1)}k)</span>
                  </div>
                </td>
                <td className="px-4"><StatusBadge status={h.status} /></td>
                <td className="px-4" style={{ fontSize: 12, fontWeight: 600, color: '#1A2332', fontFamily: 'monospace' }}>{h.revenue}</td>
                <td className="px-4">
                  <div className="flex items-center gap-1">
                    <ActionBtn icon={<Eye size={13} />} />
                    <ActionBtn icon={<Edit2 size={13} />} />
                    <ActionBtn icon={<MoreHorizontal size={13} />} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}
        >
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Showing {start + 1}–{Math.min(start + perPage, total)} of {total} hotels
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={13} />
            </PagBtn>
            {Array.from({ length: totalPages }).map((_, i) => (
              <PagBtn key={i} onClick={() => setPage(i + 1)} active={page === i + 1}>
                {i + 1}
              </PagBtn>
            ))}
            <PagBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight size={13} />
            </PagBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ icon }: { icon: React.ReactNode }) {
  return (
    <button
      className="flex items-center justify-center rounded transition-colors"
      style={{ width: 28, height: 28, color: '#94A3B8' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
    >
      {icon}
    </button>
  )
}

function PagBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center rounded transition-colors"
      style={{
        minWidth: 28, height: 28, fontSize: 12,
        background: active ? '#1664FF' : 'transparent',
        color: active ? '#fff' : disabled ? '#CBD5E1' : '#475569',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = '#F1F5F9' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

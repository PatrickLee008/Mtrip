import { useState } from "react";
import {
  Star, Search, Filter, ThumbsUp, MessageSquare, Flag,
  Building2, ChevronDown, X, Check,
} from "lucide-react";
import { cx, btnPrimary, btnSecondary, btnGhost, Badge, PageHeader, type BadgeVariant } from "../shared";

type Review = {
  id: string;
  guest: string;
  avatar: string;
  hotelId: string;
  hotel: string;
  room: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  status: "published" | "pending" | "flagged";
  replied: boolean;
  helpful: number;
};

const HOTELS = [
  { id: "H001", name: "The Horizon Resort",      dot: "bg-blue-500",   accent: "text-blue-700 bg-blue-50" },
  { id: "H002", name: "Blue Lagoon Boutique",    dot: "bg-teal-500",   accent: "text-teal-700 bg-teal-50" },
  { id: "H003", name: "Cityview Business Hotel", dot: "bg-violet-500", accent: "text-violet-700 bg-violet-50" },
];

const HOTEL_MAP = Object.fromEntries(HOTELS.map((h) => [h.id, h]));

const REVIEWS: Review[] = [
  {
    id: "R001", guest: "Sarah M.", avatar: "SM", hotelId: "H001",
    hotel: "The Horizon Resort", room: "Deluxe Ocean View",
    rating: 5, date: "24 Jul 2026",
    title: "Exceptional stay — exceeded all expectations",
    body: "From the moment we arrived, the staff made us feel incredibly welcome. The room was spotless, the view was breathtaking, and the amenities were top-notch. Will definitely be returning!",
    status: "published", replied: true, helpful: 12,
  },
  {
    id: "R002", guest: "James K.", avatar: "JK", hotelId: "H002",
    hotel: "Blue Lagoon Boutique", room: "Standard Room",
    rating: 3, date: "23 Jul 2026",
    title: "Good location, room needs updating",
    body: "The location was perfect and the staff were friendly. However, the room felt a bit dated and the air conditioning was noisy throughout the night. Decent value overall.",
    status: "pending", replied: false, helpful: 4,
  },
  {
    id: "R003", guest: "Priya R.", avatar: "PR", hotelId: "H003",
    hotel: "Cityview Business Hotel", room: "Executive Suite",
    rating: 4, date: "22 Jul 2026",
    title: "Great for business travel",
    body: "Excellent WiFi, comfortable workspace in the room, and the breakfast spread was impressive. The conference facilities were well-equipped. Minor issue with checkout billing was resolved quickly.",
    status: "published", replied: true, helpful: 8,
  },
  {
    id: "R004", guest: "Tom B.", avatar: "TB", hotelId: "H001",
    hotel: "The Horizon Resort", room: "Family Suite",
    rating: 2, date: "21 Jul 2026",
    title: "Disappointed with the pool situation",
    body: "The pool was closed for maintenance during our entire stay without prior notice. Kids were very disappointed. Staff could have communicated this at booking. Room was nice though.",
    status: "flagged", replied: false, helpful: 2,
  },
  {
    id: "R005", guest: "Elena V.", avatar: "EV", hotelId: "H002",
    hotel: "Blue Lagoon Boutique", room: "Superior Room",
    rating: 5, date: "20 Jul 2026",
    title: "Hidden gem — absolutely stunning!",
    body: "We stumbled upon this boutique hotel and couldn't be happier. The intimate atmosphere, personalised service, and beautiful decor made for a truly memorable anniversary trip.",
    status: "published", replied: true, helpful: 19,
  },
  {
    id: "R006", guest: "David L.", avatar: "DL", hotelId: "H003",
    hotel: "Cityview Business Hotel", room: "Standard Room",
    rating: 4, date: "19 Jul 2026",
    title: "Solid business hotel, reliable and comfortable",
    body: "Everything you need for a business stay — fast internet, good restaurant, easy parking. Nothing flashy but everything works well. Would stay again for work trips.",
    status: "published", replied: false, helpful: 6,
  },
  {
    id: "R007", guest: "Min-Ji L.", avatar: "ML", hotelId: "H001",
    hotel: "The Horizon Resort", room: "Superior Suite",
    rating: 5, date: "18 Jul 2026",
    title: "Breathtaking sunsets and impeccable service",
    body: "The sunset view from our suite was simply unreal. Staff remembered our anniversary and surprised us with a complimentary cake. Truly world-class hospitality.",
    status: "published", replied: true, helpful: 23,
  },
  {
    id: "R008", guest: "Carlos M.", avatar: "CM", hotelId: "H002",
    hotel: "Blue Lagoon Boutique", room: "Honeymoon Suite",
    rating: 4, date: "17 Jul 2026",
    title: "Romantic and peaceful — highly recommended",
    body: "Lovely boutique property with amazing personal touch. The honeymoon suite was beautifully arranged. Breakfast by the lagoon was a highlight. Slightly pricey but worth it.",
    status: "pending", replied: false, helpful: 7,
  },
];

const STATUS_BADGE: Record<string, BadgeVariant> = {
  published: "green",
  pending: "yellow",
  flagged: "red",
};

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? "text-amber-400 fill-amber-400" : "text-[#e2e8f0] fill-[#e2e8f0]"}
        />
      ))}
    </div>
  );
}

export function ReviewsScreen() {
  const [propertyFilter, setPropertyFilter] = useState("all");

  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRating, setFilterRating] = useState("all");

  const [moreOpen, setMoreOpen]   = useState(false);
  const [mfHotel, setMfHotel]     = useState("all");
  const [mfRoom, setMfRoom]       = useState("");
  const [mfDateFrom, setMfDateFrom] = useState("");
  const [mfDateTo, setMfDateTo]   = useState("");
  const [mfReplied, setMfReplied] = useState("all");
  const [mfFlagged, setMfFlagged] = useState(false);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText]   = useState("");

  const scopedBase = propertyFilter === "all"
    ? REVIEWS
    : REVIEWS.filter((r) => r.hotelId === propertyFilter);

  const avgRating = scopedBase.length
    ? (scopedBase.reduce((s, r) => s + r.rating, 0) / scopedBase.length).toFixed(1)
    : "—";
  const published = scopedBase.filter((r) => r.status === "published").length;
  const pending   = scopedBase.filter((r) => r.status === "pending").length;
  const flagged   = scopedBase.filter((r) => r.status === "flagged").length;

  const moreActiveCount = [
    mfHotel !== "all",
    !!mfRoom,
    !!mfDateFrom || !!mfDateTo,
    mfReplied !== "all",
    mfFlagged,
  ].filter(Boolean).length;

  const clearMore = () => {
    setMfHotel("all"); setMfRoom(""); setMfDateFrom(""); setMfDateTo("");
    setMfReplied("all"); setMfFlagged(false);
  };

  const filtered = scopedBase.filter((r) => {
    if (search && !r.guest.toLowerCase().includes(search.toLowerCase()) &&
        !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !r.hotel.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterRating !== "all" && String(r.rating) !== filterRating) return false;
    if (mfHotel !== "all" && r.hotelId !== mfHotel) return false;
    if (mfRoom && !r.room.toLowerCase().includes(mfRoom.toLowerCase())) return false;
    if (mfReplied === "replied" && !r.replied) return false;
    if (mfReplied === "not-replied" && r.replied) return false;
    if (mfFlagged && r.status !== "flagged") return false;
    return true;
  });

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Reviews"
        subtitle="Monitor and respond to guest feedback from bookings made through mTrip."
        action={
          <button className={btnSecondary}>
            <Filter size={14} />
            Export
          </button>
        }
      />

      {/* Property selector */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
          <select
            value={propertyFilter}
            onChange={(e) => { setPropertyFilter(e.target.value); setMfHotel("all"); }}
            className="pl-8 pr-8 py-2 text-[13px] font-medium border border-[#e2e8f0] rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
          >
            <option value="all">All Properties</option>
            {HOTELS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
        </div>
        <span className="text-[12px] text-[#94a3b8]">
          {propertyFilter === "all"
            ? `${HOTELS.length} properties · ${scopedBase.length} reviews`
            : `${scopedBase.length} review${scopedBase.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Average Rating",
            value: avgRating,
            sub: `${scopedBase.length} total review${scopedBase.length !== 1 ? "s" : ""}`,
            icon: <Star size={16} className="text-amber-500 fill-amber-500" />,
            accent: "text-[#0f172a]",
          },
          {
            label: "Published",
            value: published,
            sub: "Visible to guests",
            icon: <ThumbsUp size={16} className="text-green-500" />,
            accent: "text-green-600",
          },
          {
            label: "Pending Review",
            value: pending,
            sub: "Awaiting moderation",
            icon: <MessageSquare size={16} className="text-amber-500" />,
            accent: "text-amber-600",
          },
          {
            label: "Flagged",
            value: flagged,
            sub: "Needs attention",
            icon: <Flag size={16} className="text-red-500" />,
            accent: flagged > 0 ? "text-red-600" : "text-[#0f172a]",
          },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] text-[#64748b] font-medium">{c.label}</p>
              {c.icon}
            </div>
            <p className={cx("text-[22px] font-bold", c.accent)}>{c.value}</p>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest, hotel, title…"
              className="pl-8 pr-3 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] w-52 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="w-px h-5 bg-[#e2e8f0]" />

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="pending">Pending</option>
            <option value="flagged">Flagged</option>
          </select>

          {/* Rating */}
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="px-3 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            <option value="all">All Ratings</option>
            <option value="5">★★★★★ 5 Stars</option>
            <option value="4">★★★★☆ 4 Stars</option>
            <option value="3">★★★☆☆ 3 Stars</option>
            <option value="2">★★☆☆☆ 2 Stars</option>
            <option value="1">★☆☆☆☆ 1 Star</option>
          </select>

          {/* More Filters */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen((o) => !o)}
              className={cx(
                "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border rounded-[7px] transition-all",
                moreActiveCount > 0
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-[#f8fafc] border-[#e2e8f0] text-[#475569] hover:border-[#cbd5e1]"
              )}
            >
              <Filter size={12} />
              More Filters
              {moreActiveCount > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {moreActiveCount}
                </span>
              )}
            </button>

            {moreOpen && <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />}

            {moreOpen && (
              <div className="absolute left-0 top-full mt-2 w-[320px] bg-white border border-[#e2e8f0] rounded-[12px] shadow-xl z-30 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-[12px] font-bold text-[#0f172a]">More Filters</p>
                  <button onClick={clearMore} className="text-[11px] text-blue-600 hover:underline font-medium">Clear all</button>
                </div>

                {/* Hotel — hidden when a specific property is already selected */}
                {propertyFilter === "all" && (
                  <div>
                    <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Hotel</p>
                    <select
                      value={mfHotel}
                      onChange={(e) => setMfHotel(e.target.value)}
                      className="w-full px-3 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none"
                    >
                      <option value="all">All Hotels</option>
                      {HOTELS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Room Type */}
                <div>
                  <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Room Type</p>
                  <input
                    value={mfRoom}
                    onChange={(e) => setMfRoom(e.target.value)}
                    placeholder="e.g. Deluxe, Suite…"
                    className="w-full px-3 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Date Range */}
                <div>
                  <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Date Range</p>
                  <div className="flex gap-2">
                    <input type="date" value={mfDateFrom} onChange={(e) => setMfDateFrom(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none" />
                    <span className="text-[#94a3b8] self-center text-[11px]">to</span>
                    <input type="date" value={mfDateTo} onChange={(e) => setMfDateTo(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none" />
                  </div>
                </div>

                {/* Replied */}
                <div>
                  <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-1.5">Reply Status</p>
                  <div className="flex gap-1.5">
                    {[
                      { value: "all",         label: "All" },
                      { value: "replied",     label: "Replied" },
                      { value: "not-replied", label: "Not Replied" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMfReplied(opt.value)}
                        className={cx(
                          "flex-1 py-1.5 text-[11.5px] font-medium rounded-[6px] border transition-all",
                          mfReplied === opt.value
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-[#475569] border-[#e2e8f0] hover:border-blue-200"
                        )}
                      >
                        {mfReplied === opt.value && <Check size={9} className="inline mr-0.5" />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flagged */}
                <div className="flex items-center justify-between px-3 py-2 border border-[#f1f5f9] rounded-[8px] bg-[#fafafa]">
                  <div>
                    <p className="text-[12px] font-medium text-[#0f172a]">Flagged only</p>
                    <p className="text-[10.5px] text-[#94a3b8]">Show reviews needing attention</p>
                  </div>
                  <button
                    onClick={() => setMfFlagged((f) => !f)}
                    className={cx(
                      "w-9 h-5 rounded-full transition-colors relative shrink-0",
                      mfFlagged ? "bg-blue-600" : "bg-[#cbd5e1]"
                    )}
                  >
                    <span className={cx(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                      mfFlagged ? "left-[18px]" : "left-0.5"
                    )} />
                  </button>
                </div>

                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-full py-2 text-[12px] font-semibold bg-[#0f172a] text-white rounded-[8px] hover:bg-[#1e293b] transition-colors mt-0.5"
                >
                  Apply Filters
                </button>
              </div>
            )}
          </div>

          <div className="ml-auto text-[12px] text-[#94a3b8] shrink-0">
            {filtered.length} review{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Review list */}
      <div className="flex flex-col gap-3">
        {filtered.map((r) => {
          const hotelMeta = HOTEL_MAP[r.hotelId];
          return (
            <div key={r.id} className="bg-white rounded-[12px] border border-[#e2e8f0] p-5">

              {/* Property label — prominent when All Properties selected */}
              {propertyFilter === "all" && hotelMeta && (
                <div className="flex items-center gap-1.5 mb-3">
                  <div className={cx("w-2 h-2 rounded-full shrink-0", hotelMeta.dot)} />
                  <span className={cx("text-[11px] font-semibold px-2 py-0.5 rounded-full", hotelMeta.accent)}>
                    {r.hotel}
                  </span>
                  <span className="text-[11px] text-[#94a3b8]">· {r.room}</span>
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[12px] font-bold shrink-0">
                    {r.avatar}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0f172a]">{r.guest}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {propertyFilter !== "all" && (
                        <span className="text-[11px] text-[#94a3b8]">{r.room} ·</span>
                      )}
                      <span className="text-[11px] text-[#94a3b8]">{r.date}</span>
                    </div>
                  </div>
                </div>

                {/* Rating + status */}
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <StarRow rating={r.rating} />
                  <Badge label={r.status} variant={STATUS_BADGE[r.status]} />
                </div>
              </div>

              <h3 className="text-[13px] font-semibold text-[#0f172a] mb-1">{r.title}</h3>
              <p className="text-[13px] text-[#475569] leading-relaxed">{r.body}</p>

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#f1f5f9]">
                <button className={btnGhost}>
                  <ThumbsUp size={13} />
                  Helpful ({r.helpful})
                </button>
                {!r.replied ? (
                  <button
                    className={btnPrimary}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                    onClick={() => setReplyingTo(replyingTo === r.id ? null : r.id)}
                  >
                    <MessageSquare size={13} />
                    Reply
                  </button>
                ) : (
                  <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                    <ThumbsUp size={11} /> Replied
                  </span>
                )}
                <button className={cx(btnGhost, "ml-auto text-red-400 hover:text-red-600 hover:bg-red-50")}>
                  <Flag size={13} />
                  Flag
                </button>
              </div>

              {replyingTo === r.id && (
                <div className="mt-3 pt-3 border-t border-[#f1f5f9]">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    placeholder="Write your response…"
                    className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button className={btnPrimary} style={{ fontSize: "12px", padding: "6px 14px" }}>
                      Submit Reply
                    </button>
                    <button
                      className={btnSecondary}
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                      onClick={() => { setReplyingTo(null); setReplyText(""); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-12 text-center">
            <p className="text-[14px] font-medium text-[#64748b]">No reviews match your filters.</p>
            <p className="text-[12px] text-[#94a3b8] mt-1">Try adjusting your filters or property selection.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  Plus, Search, X, Eye, Edit2, Copy, Archive, RotateCcw, Check,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, DollarSign, Percent,
  Zap, Activity, ExternalLink, ArrowRight, Info, SlidersHorizontal,
  ChevronDown, Building2,
} from "lucide-react";
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  cx, inputCls, selectCls, btnPrimary, btnSecondary, btnGhost,
  Badge, FormField, type BadgeVariant,
} from "../shared";

const HOTEL_OPTIONS = [
  "All Properties",
  "The Horizon Resort",
  "Blue Lagoon Boutique",
  "Cityview Business Hotel",
];

const PROMOTIONS_DATA = [
  {
    id: "PRO-001", name: "Summer Flash Sale 2026",       hotel: "The Horizon Resort",        roomType: "All Room Types",
    type: "Percentage Discount",   discount: "20% off",    code: null,  minNights: null, advanceDays: null,
    start: "01 Jul 2026", end: "31 Aug 2026", status: "active",   funding: "Merchant",
    impressions: 12400, bookings: 87, convRate: 0.70, revenue: 348000, created: "15 Jun 2026",
  },
  {
    id: "PRO-002", name: "Deluxe Early Bird — Q4",       hotel: "The Horizon Resort",        roomType: "Deluxe Ocean View",
    type: "Early Booking",         discount: "15% off",    code: null,  minNights: null, advanceDays: 45,
    start: "01 Oct 2026", end: "31 Dec 2026", status: "upcoming", funding: "Merchant",
    impressions: 0, bookings: 0, convRate: 0, revenue: 0, created: "18 Jul 2026",
  },
  {
    id: "PRO-003", name: "WELCOME150 Promo Code",        hotel: "Blue Lagoon Boutique",      roomType: "Standard Room",
    type: "Promo Code",            discount: "THB 150",    code: "WELCOME150", minNights: null, advanceDays: null,
    start: "01 Jun 2026", end: "30 Jun 2026", status: "expired",  funding: "Merchant",
    impressions: 8200, bookings: 34, convRate: 0.41, revenue: 102000, created: "25 May 2026",
  },
  {
    id: "PRO-004", name: "Stay 7+ Nights — Save More",   hotel: "The Horizon Resort",        roomType: "All Room Types",
    type: "Long Stay Promotion",   discount: "25% off",    code: null,  minNights: 7, advanceDays: null,
    start: "01 Jul 2026", end: "30 Sep 2026", status: "active",   funding: "Co-Fund",
    impressions: 6800, bookings: 21, convRate: 0.31, revenue: 189000, created: "28 Jun 2026",
  },
  {
    id: "PRO-005", name: "Songkran Festive Rate 2026",   hotel: "Blue Lagoon Boutique",      roomType: "Superior Room",
    type: "Seasonal Promotion",    discount: "10% off",    code: null,  minNights: null, advanceDays: null,
    start: "10 Apr 2026", end: "16 Apr 2026", status: "expired",  funding: "Platform",
    impressions: 4500, bookings: 18, convRate: 0.40, revenue: 90000, created: "01 Mar 2026",
  },
  {
    id: "PRO-006", name: "August Flash Deal — Deluxe",   hotel: "Cityview Business Hotel",   roomType: "Deluxe Room",
    type: "Fixed Amount Discount", discount: "THB 300",    code: null,  minNights: null, advanceDays: null,
    start: "01 Aug 2026", end: "15 Aug 2026", status: "upcoming", funding: "Merchant",
    impressions: 0, bookings: 0, convRate: 0, revenue: 0, created: "22 Jul 2026",
  },
  {
    id: "PRO-007", name: "Last-Minute Weekend Escape",   hotel: "Cityview Business Hotel",   roomType: "Standard Room",
    type: "Percentage Discount",   discount: "30% off",    code: null,  minNights: 2, advanceDays: null,
    start: "18 Jul 2026", end: "31 Jul 2026", status: "paused",   funding: "Merchant",
    impressions: 3100, bookings: 9, convRate: 0.29, revenue: 45000, created: "14 Jul 2026",
  },
  {
    id: "PRO-008", name: "Business Traveller Rate",      hotel: "Cityview Business Hotel",   roomType: "Executive Room",
    type: "Early Booking",         discount: "12% off",    code: null,  minNights: null, advanceDays: 14,
    start: "01 Jul 2026", end: "30 Sep 2026", status: "active",   funding: "Merchant",
    impressions: 5200, bookings: 29, convRate: 0.56, revenue: 116000, created: "25 Jun 2026",
  },
  {
    id: "PRO-009", name: "Blue Lagoon Couples Escape",   hotel: "Blue Lagoon Boutique",      roomType: "Honeymoon Suite",
    type: "Percentage Discount",   discount: "18% off",    code: null,  minNights: 2, advanceDays: null,
    start: "01 Aug 2026", end: "31 Aug 2026", status: "upcoming", funding: "Co-Fund",
    impressions: 0, bookings: 0, convRate: 0, revenue: 0, created: "20 Jul 2026",
  },
];

type Promotion = typeof PROMOTIONS_DATA[0];

const PROMO_TREND: Record<string, { day: string; bookings: number; rev: number }[]> = {
  "PRO-001": [
    { day: "16 Jul", bookings: 9,  rev: 36000 }, { day: "17 Jul", bookings: 11, rev: 44000 },
    { day: "18 Jul", bookings: 8,  rev: 32000 }, { day: "19 Jul", bookings: 14, rev: 56000 },
    { day: "20 Jul", bookings: 12, rev: 48000 }, { day: "21 Jul", bookings: 7,  rev: 28000 },
    { day: "22 Jul", bookings: 10, rev: 40000 },
  ],
  "PRO-004": [
    { day: "16 Jul", bookings: 2, rev: 18000 }, { day: "17 Jul", bookings: 4, rev: 36000 },
    { day: "18 Jul", bookings: 3, rev: 27000 }, { day: "19 Jul", bookings: 5, rev: 45000 },
    { day: "20 Jul", bookings: 3, rev: 27000 }, { day: "21 Jul", bookings: 2, rev: 18000 },
    { day: "22 Jul", bookings: 2, rev: 18000 },
  ],
};

const CAMPAIGN_INVITES = [
  {
    id: "CAM-INV-01", name: "mTrip Flash Deal Week",      period: "29 Jul – 04 Aug 2026",
    minDiscount: "25%", funding: "Co-Fund (Platform 50%)", badge: true, deadline: "26 Jul 2026",
    desc: "High-visibility flash campaign featured on the mTrip homepage and app discovery feed. Platform co-funds 50% of the discount, reducing merchant cost.",
    eligibleRooms: "All room types eligible.",
  },
  {
    id: "CAM-INV-02", name: "Loy Krathong Festive Deals", period: "12 Nov – 15 Nov 2026",
    minDiscount: "15%", funding: "Merchant",              badge: true, deadline: "01 Nov 2026",
    desc: "Seasonal campaign featuring curated hotel deals during Loy Krathong. Properties receive a campaign badge and placement in the Festive Deals landing page.",
    eligibleRooms: "Minimum 2 room types required.",
  },
];

const JOINED_CAMPAIGNS = [
  {
    id: "CAM-JOIN-01", name: "mTrip Summer Spotlight",  period: "01 Jul – 31 Aug 2026",
    status: "active", discount: "20%", bookings: 31, revenue: 140000, funding: "Co-Fund",
    badge: "Summer Spotlight", impressions: 18400,
  },
];

const ELIGIBLE_CAMPAIGNS = [
  {
    id: "CAM-ELG-01", name: "Weekend Getaway Programme", period: "Ongoing",
    minDiscount: "10%", funding: "Platform", badge: true,
    desc: "Recurring weekend programme driving leisure bookings. Properties with a 4★+ rating and response rate above 90% are automatically eligible.",
  },
  {
    id: "CAM-ELG-02", name: "mTrip Select Partner Tier", period: "Q3 2026 onwards",
    minDiscount: "12%", funding: "Co-Fund (Platform 30%)", badge: true,
    desc: "Premium placement for high-performing properties. Eligibility is based on cumulative review score, booking volume and SLA compliance in the last 90 days.",
  },
];

function PromoTypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { color: string; bg: string }> = {
    "Percentage Discount":   { color: "#2563eb", bg: "#eff6ff" },
    "Fixed Amount Discount": { color: "#7c3aed", bg: "#f5f3ff" },
    "Promo Code":            { color: "#d97706", bg: "#fffbeb" },
    "Seasonal Promotion":    { color: "#0891b2", bg: "#ecfeff" },
    "Early Booking":         { color: "#059669", bg: "#f0fdf4" },
    "Long Stay Promotion":   { color: "#dc2626", bg: "#fef2f2" },
  };
  const c = cfg[type] ?? { color: "#64748b", bg: "#f1f5f9" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-semibold whitespace-nowrap" style={{ color: c.color, background: c.bg }}>
      {type}
    </span>
  );
}

export function PromotionsScreen() {
  const [pageTab, setPageTab] = useState<"promotions" | "campaigns" | "analytics">("promotions");
  const [propertyFilter, setPropertyFilter] = useState("All Properties");
  const [propertySearch, setPropertySearch] = useState("");
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [fundFilter, setFundFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [camTab, setCamTab] = useState<"invites" | "joined" | "eligible">("invites");
  const [promoType, setPromoType] = useState("Percentage Discount");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const stCfg: Record<string, { label: string; v: BadgeVariant }> = {
    active:   { label: "Active",   v: "green"  },
    upcoming: { label: "Upcoming", v: "blue"   },
    paused:   { label: "Paused",   v: "yellow" },
    expired:  { label: "Expired",  v: "gray"   },
  };
  const fundCfg: Record<string, BadgeVariant> = { "Merchant": "slate", "Co-Fund": "purple", "Platform": "blue" };

  // Promotions scoped to the selected property
  const scopedData = propertyFilter === "All Properties"
    ? PROMOTIONS_DATA
    : PROMOTIONS_DATA.filter((p) => p.hotel === propertyFilter);

  const filtered = scopedData.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (typeFilter !== "all" && p.type !== typeFilter) return false;
    if (fundFilter !== "all" && p.funding !== fundFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const advancedFilterCount = [typeFilter !== "all", fundFilter !== "all", !!dateFrom, !!dateTo].filter(Boolean).length;
  const hasAnyFilter = !!(search || statusFilter !== "all" || advancedFilterCount > 0);
  const filteredPropertyOptions = HOTEL_OPTIONS.filter((h) =>
    !propertySearch || h.toLowerCase().includes(propertySearch.toLowerCase())
  );

  const active   = scopedData.filter((p) => p.status === "active").length;
  const upcoming = scopedData.filter((p) => p.status === "upcoming").length;
  const expired  = scopedData.filter((p) => p.status === "expired").length;
  const campRevenue = JOINED_CAMPAIGNS.reduce((s, c) => s + c.revenue, 0);

  const totalImpressions = scopedData.reduce((s, p) => s + p.impressions, 0);
  const totalBookings    = scopedData.reduce((s, p) => s + p.bookings, 0);
  const totalRevenue     = scopedData.reduce((s, p) => s + p.revenue, 0);
  const avgConv          = scopedData.filter((p) => p.bookings > 0).reduce((s, p, _, a) => s + p.convRate / a.length, 0);

  const analyticsPerType = [
    { name: "Pct Discount",  bookings: 96,  revenue: 393000, conv: 0.59 },
    { name: "Long Stay",     bookings: 21,  revenue: 189000, conv: 0.31 },
    { name: "Promo Code",    bookings: 34,  revenue: 102000, conv: 0.41 },
    { name: "Seasonal",      bookings: 18,  revenue: 90000,  conv: 0.40 },
    { name: "Fixed Amt",     bookings: 9,   revenue: 45000,  conv: 0.29 },
    { name: "Early Book",    bookings: 0,   revenue: 0,      conv: 0    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-bold text-[#0f172a]" style={{ letterSpacing: "-0.025em" }}>
            Promotions &amp; Campaigns
          </h1>
          <p className="text-[13px] text-[#64748b] mt-0.5">
            Create and manage room promotions. Join platform campaigns to boost visibility and revenue.
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Create Promotion
        </button>
      </div>

      {/* Property Selector — searchable dropdown */}
      <div className="flex items-center gap-3 mb-5 relative">
        <span className="text-[12px] font-semibold text-[#64748b] whitespace-nowrap shrink-0">Property:</span>
        <div className="relative">
          <button
            onClick={() => { setPropertyOpen((o) => !o); setPropertySearch(""); }}
            className={cx(
              "inline-flex items-center gap-2 px-3 py-2 rounded-[8px] border text-[13px] font-medium transition-colors min-w-[220px] text-left",
              propertyFilter !== "All Properties"
                ? "border-[#2563eb] bg-[#eff6ff] text-[#2563eb]"
                : "border-[#e2e8f0] bg-white text-[#334155] hover:border-[#2563eb]/40"
            )}
          >
            <Building2 size={13} className={propertyFilter !== "All Properties" ? "text-[#2563eb]" : "text-[#94a3b8]"} />
            <span className="flex-1 truncate">{propertyFilter}</span>
            <ChevronDown size={13} className={cx("shrink-0 transition-transform", propertyOpen ? "rotate-180" : "")} />
          </button>

          {propertyOpen && (
            <div className="absolute top-full left-0 mt-1 w-[280px] bg-white rounded-[10px] border border-[#e2e8f0] shadow-lg z-30 overflow-hidden">
              {/* Search input inside dropdown */}
              <div className="p-2 border-b border-[#f1f5f9]">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    autoFocus
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-[12.5px] border border-[#e2e8f0] rounded-[7px] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    placeholder="Search properties…"
                  />
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto py-1">
                {filteredPropertyOptions.length === 0 ? (
                  <p className="px-3 py-3 text-[12px] text-[#94a3b8] text-center">No properties found.</p>
                ) : filteredPropertyOptions.map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      setPropertyFilter(h);
                      setPropertyOpen(false);
                      setPropertySearch("");
                      setSelectedPromo(null);
                      setStatusFilter("all");
                      setTypeFilter("all");
                      setFundFilter("all");
                      setSearch("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className={cx(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors",
                      propertyFilter === h
                        ? "bg-[#eff6ff] text-[#2563eb] font-semibold"
                        : "text-[#334155] hover:bg-[#f8fafc]"
                    )}
                  >
                    {h === "All Properties"
                      ? <span className="w-3.5 h-3.5 rounded-sm border border-[#cbd5e1] flex items-center justify-center shrink-0">{propertyFilter === h && <Check size={9} className="text-[#2563eb]" />}</span>
                      : <Building2 size={13} className={propertyFilter === h ? "text-[#2563eb]" : "text-[#94a3b8]"} />
                    }
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Click-away overlay */}
        {propertyOpen && (
          <div className="fixed inset-0 z-20" onClick={() => setPropertyOpen(false)} />
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Active Promotions",   value: active,                 icon: CheckCircle2, color: "#059669", bg: "#f0fdf4", onClick: () => { setPageTab("promotions"); setStatusFilter("active"); } },
          { label: "Upcoming Promotions", value: upcoming,               icon: Clock,        color: "#2563eb", bg: "#eff6ff", onClick: () => { setPageTab("promotions"); setStatusFilter("upcoming"); } },
          { label: "Expired Promotions",  value: expired,                icon: Archive,      color: "#94a3b8", bg: "#f1f5f9", onClick: () => { setPageTab("promotions"); setStatusFilter("expired"); } },
          { label: "Promotion Revenue", value: `THB ${(totalRevenue/1000).toFixed(0)}K`, icon: TrendingUp, color: "#7c3aed", bg: "#f5f3ff", onClick: () => setPageTab("analytics") },
        ].map(({ label, value, icon: Icon, color, bg, onClick }) => (
          <button key={label} onClick={onClick}
            className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 text-left hover:border-[#2563eb]/30 transition-colors"
            style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11.5px] font-semibold text-[#64748b] uppercase tracking-wide leading-snug">{label}</p>
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <p className="text-[28px] font-bold leading-none" style={{ color, letterSpacing: "-0.04em" }}>{value}</p>
          </button>
        ))}
      </div>

      {/* Page Tabs */}
      <div className="flex gap-0 border-b border-[#e2e8f0] mb-5">
        {(["promotions", "campaigns", "analytics"] as const).map((t) => {
          const labels: Record<string, string> = { promotions: "My Promotions", campaigns: "Platform Campaigns", analytics: "Performance Analytics" };
          return (
            <button key={t} onClick={() => setPageTab(t)}
              className={cx("px-5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                pageTab === t ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-[#64748b] hover:text-[#0f172a]")}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ─── MY PROMOTIONS TAB ─── */}
      {pageTab === "promotions" && (
        <>
          {/* Toolbar */}
          <div className="mb-4">
            {/* Primary filter row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-[280px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} className={cx(inputCls, "pl-9")} placeholder="Search by name or ID..." />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cx(selectCls, "w-[145px]")}>
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
              </select>

              {/* More Filters toggle */}
              <button
                onClick={() => setMoreFiltersOpen((o) => !o)}
                className={cx(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] border text-[12.5px] font-medium transition-colors",
                  moreFiltersOpen || advancedFilterCount > 0
                    ? "border-[#2563eb] bg-[#eff6ff] text-[#2563eb]"
                    : "border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]"
                )}
              >
                <SlidersHorizontal size={13} />
                More Filters
                {advancedFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2563eb] text-white text-[10px] font-bold">
                    {advancedFilterCount}
                  </span>
                )}
                <ChevronDown size={12} className={cx("transition-transform", moreFiltersOpen ? "rotate-180" : "")} />
              </button>

              {hasAnyFilter && (
                <button
                  className={btnGhost}
                  onClick={() => {
                    setSearch(""); setStatusFilter("all"); setTypeFilter("all");
                    setFundFilter("all"); setDateFrom(""); setDateTo("");
                    setMoreFiltersOpen(false);
                  }}
                >
                  <X size={13} /> Clear all
                </button>
              )}
              <p className="ml-auto text-[12px] text-[#94a3b8]">{filtered.length} promotion{filtered.length !== 1 ? "s" : ""}</p>
            </div>

            {/* More Filters panel */}
            {moreFiltersOpen && (
              <div className="mt-2 p-4 bg-[#f8fafc] rounded-[10px] border border-[#e2e8f0] flex items-end gap-4 flex-wrap">
                <div className="flex flex-col gap-1.5 min-w-[190px]">
                  <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wide">Promotion Type</label>
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={cx(selectCls, "text-[12.5px] py-1.5")}>
                    <option value="all">All Types</option>
                    {["Percentage Discount","Fixed Amount Discount","Promo Code","Seasonal Promotion","Early Booking","Long Stay Promotion"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 min-w-[140px]">
                  <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wide">Funding</label>
                  <select value={fundFilter} onChange={(e) => setFundFilter(e.target.value)} className={cx(selectCls, "text-[12.5px] py-1.5")}>
                    <option value="all">All Funding</option>
                    <option>Merchant</option>
                    <option>Co-Fund</option>
                    <option>Platform</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 min-w-[130px]">
                  <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wide">Date From</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={cx(inputCls, "text-[12.5px] py-1.5")} />
                </div>
                <div className="flex flex-col gap-1.5 min-w-[130px]">
                  <label className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wide">Date To</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={cx(inputCls, "text-[12.5px] py-1.5")} />
                </div>
                {advancedFilterCount > 0 && (
                  <button
                    className={cx(btnGhost, "self-end")}
                    onClick={() => { setTypeFilter("all"); setFundFilter("all"); setDateFrom(""); setDateTo(""); }}
                  >
                    <X size={12} /> Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Split panel */}
          <div className="flex gap-4">
            {/* Table */}
            <div className={cx("min-w-0", selectedPromo ? "w-[54%] shrink-0" : "flex-1")}>
              <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                      {["Promotion Name", ...(propertyFilter === "All Properties" ? ["Hotel"] : []), "Room Type","Promotion Type","Period","Status","Funding","Bookings","Actions"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const isSelected = selectedPromo?.id === p.id;
                      const sc = stCfg[p.status];
                      return (
                        <tr key={p.id}
                          onClick={() => { setSelectedPromo(isSelected ? null : p); }}
                          className={cx("border-b border-[#f1f5f9] cursor-pointer transition-colors", isSelected ? "bg-[#eff6ff]" : "hover:bg-[#f8fafc]")}>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-[#0f172a] leading-snug max-w-[160px] truncate">{p.name}</p>
                            <p className="text-[11px] text-[#94a3b8] mt-0.5">{p.id}</p>
                          </td>
                          {propertyFilter === "All Properties" && (
                            <td className="px-3 py-3 text-[#64748b] max-w-[130px]">
                              <p className="truncate text-[12px]" title={p.hotel}>{p.hotel}</p>
                            </td>
                          )}
                          <td className="px-3 py-3 text-[#64748b] max-w-[110px]"><p className="truncate">{p.roomType}</p></td>
                          <td className="px-3 py-3"><PromoTypeBadge type={p.type} /></td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <p className="text-[12px] text-[#334155]">{p.start}</p>
                            <p className="text-[11px] text-[#94a3b8]">→ {p.end}</p>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap"><Badge label={sc.label} variant={sc.v} /></td>
                          <td className="px-3 py-3"><Badge label={p.funding} variant={fundCfg[p.funding]} /></td>
                          <td className="px-3 py-3">
                            {p.bookings > 0
                              ? <div>
                                  <p className="font-semibold text-[#0f172a]">{p.bookings}</p>
                                  <p className="text-[11px] text-[#94a3b8]">THB {(p.revenue/1000).toFixed(0)}K</p>
                                </div>
                              : <p className="text-[#cbd5e1]">—</p>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <button className={btnGhost} title="View"><Eye size={13} onClick={() => setSelectedPromo(p)} /></button>
                              <button className={btnGhost} title="Edit"><Edit2 size={13} /></button>
                              <button className={btnGhost} title="Duplicate"><Copy size={13} /></button>
                              {p.status === "active" && <button className={btnGhost} title="Pause"><Archive size={13} /></button>}
                              {p.status === "paused" && <button className={cx(btnGhost, "text-emerald-600 hover:bg-emerald-50")} title="Reactivate"><RotateCcw size={13} /></button>}
                              <button className={cx(btnGhost, "hover:text-red-500 hover:bg-red-50")} title="Delete" onClick={() => setDeleteConfirm(p.id)}><X size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={propertyFilter === "All Properties" ? 9 : 8} className="py-12 text-center text-[13px] text-[#94a3b8]">No promotions match your current filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail drawer */}
            {selectedPromo && (() => {
              const p = selectedPromo;
              const trend = PROMO_TREND[p.id];
              const roi = p.revenue > 0 ? ((p.revenue - (p.revenue * 0.12)) / (p.revenue * 0.12) * 100).toFixed(0) : "—";
              return (
                <div className="flex-1 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col overflow-hidden">
                  {/* Drawer header */}
                  <div className="flex items-start justify-between px-5 py-4 border-b border-[#e2e8f0] shrink-0">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-[13.5px] font-bold text-[#0f172a] leading-snug">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge label={stCfg[p.status].label} variant={stCfg[p.status].v} />
                        <Badge label={p.funding} variant={fundCfg[p.funding]} />
                        <PromoTypeBadge type={p.type} />
                      </div>
                    </div>
                    <button onClick={() => setSelectedPromo(null)} className={cx(btnGhost, "p-1.5 shrink-0")}><X size={14} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {/* Promotion details */}
                    <div className="px-5 py-4 border-b border-[#f1f5f9]">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Hotel",        value: p.hotel },
                          { label: "Discount",     value: p.discount },
                          { label: "Room Type",    value: p.roomType },
                          { label: "Start Date",   value: p.start },
                          { label: "End Date",     value: p.end },
                          ...(p.code        ? [{ label: "Promo Code",   value: p.code }] : []),
                          ...(p.minNights   ? [{ label: "Min Stay",     value: `${p.minNights} nights` }] : []),
                          ...(p.advanceDays ? [{ label: "Book Advance", value: `${p.advanceDays} days before` }] : []),
                        ].map((d) => (
                          <div key={d.label} className="p-2.5 rounded-[7px] bg-[#f8fafc] border border-[#f1f5f9]">
                            <p className="text-[10.5px] text-[#94a3b8] font-medium">{d.label}</p>
                            <p className="text-[12.5px] font-semibold text-[#0f172a] mt-0.5">{d.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Performance KPIs */}
                    <div className="px-5 py-4 border-b border-[#f1f5f9]">
                      <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-3">Performance</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Impressions",      value: p.impressions > 0 ? p.impressions.toLocaleString() : "—",    color: "#2563eb" },
                          { label: "Bookings",         value: p.bookings > 0 ? p.bookings.toString() : "—",                color: "#059669" },
                          { label: "Conversion Rate",  value: p.bookings > 0 ? `${(p.convRate * 100).toFixed(1)}%` : "—", color: "#7c3aed" },
                          { label: "Revenue",          value: p.revenue > 0 ? `THB ${(p.revenue/1000).toFixed(0)}K` : "—", color: "#d97706" },
                        ].map((m) => (
                          <div key={m.label} className="p-3 rounded-[8px] border border-[#f1f5f9] bg-[#f8fafc] text-center">
                            <p className="text-[10.5px] text-[#94a3b8] font-medium">{m.label}</p>
                            <p className="text-[18px] font-bold mt-1 leading-none" style={{ color: m.color, letterSpacing: "-0.03em" }}>{m.value}</p>
                          </div>
                        ))}
                      </div>
                      {p.bookings > 0 && (
                        <div className="mt-2 p-3 rounded-[8px] bg-[#f8fafc] border border-[#f1f5f9] flex items-center justify-between">
                          <div>
                            <p className="text-[10.5px] text-[#94a3b8] font-medium">Estimated ROI</p>
                            <p className="text-[16px] font-bold text-[#059669] leading-none mt-0.5" style={{ letterSpacing: "-0.03em" }}>{roi}%</p>
                          </div>
                          <Zap size={18} className="text-[#d97706]" />
                        </div>
                      )}
                    </div>

                    {/* Bookings trend chart */}
                    {trend && (
                      <div className="px-5 py-4 border-b border-[#f1f5f9]">
                        <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-3">Bookings — Last 7 Days</p>
                        <ResponsiveContainer width="100%" height={90}>
                          <BarChart data={trend} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 7, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(15,23,42,0.08)" }} />
                            <Bar dataKey="bookings" fill="#2563eb" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-5 py-4">
                      <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-3">Actions</p>
                      <div className="flex gap-2 flex-wrap">
                        <button className={btnPrimary}><Edit2 size={13} /> Edit Promotion</button>
                        <button className={btnSecondary}><Copy size={13} /> Duplicate</button>
                        {p.status === "active" && <button className={btnSecondary}><Archive size={13} /> Pause</button>}
                        {p.status === "paused" && <button className={cx(btnSecondary, "text-emerald-600 border-emerald-200")}><RotateCcw size={13} /> Reactivate</button>}
                        <button className={cx(btnSecondary, "text-red-500 border-red-200 hover:bg-red-50")} onClick={() => setDeleteConfirm(p.id)}>
                          <X size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* ─── CAMPAIGNS TAB ─── */}
      {pageTab === "campaigns" && (
        <div>
          {/* Sub-tabs */}
          <div className="flex gap-2 mb-5">
            {(["invites", "joined", "eligible"] as const).map((t) => {
              const labels: Record<string, string> = { invites: `Invitations (${CAMPAIGN_INVITES.length})`, joined: `Joined (${JOINED_CAMPAIGNS.length})`, eligible: `Eligible (${ELIGIBLE_CAMPAIGNS.length})` };
              return (
                <button key={t} onClick={() => setCamTab(t)}
                  className={cx("px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors",
                    camTab === t ? "bg-[#2563eb] text-white" : "bg-white border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]")}>
                  {labels[t]}
                </button>
              );
            })}
          </div>

          {/* Invitations */}
          {camTab === "invites" && (
            <div className="space-y-4">
              {CAMPAIGN_INVITES.map((c) => (
                <div key={c.id} className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden"
                  style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                  <div className="flex items-start gap-0">
                    {/* Accent strip */}
                    <div className="w-1 self-stretch bg-[#2563eb] shrink-0 rounded-l-[12px]" />
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-[14px] font-bold text-[#0f172a]">{c.name}</p>
                            {c.badge && <Badge label="Campaign Badge" variant="blue" />}
                          </div>
                          <p className="text-[12.5px] text-[#64748b] leading-relaxed mb-3">{c.desc}</p>
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                              { label: "Campaign Period", value: c.period },
                              { label: "Min Discount Required", value: c.minDiscount },
                              { label: "Funding Model", value: c.funding },
                            ].map((d) => (
                              <div key={d.label} className="p-3 rounded-[8px] bg-[#f8fafc] border border-[#f1f5f9]">
                                <p className="text-[10.5px] text-[#94a3b8] font-medium">{d.label}</p>
                                <p className="text-[12.5px] font-semibold text-[#0f172a] mt-0.5">{d.value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 p-3 rounded-[8px] bg-amber-50 border border-amber-200 mb-4">
                            <Clock size={13} className="text-amber-500 shrink-0" />
                            <p className="text-[12px] text-amber-800 font-medium">Opt-in deadline: <strong>{c.deadline}</strong> · {c.eligibleRooms}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className={btnPrimary}><Check size={13} /> Join Campaign</button>
                            <button className={btnSecondary}><X size={13} /> Decline</button>
                            <button className={btnGhost}><Info size={13} /> View Full Terms</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Joined campaigns */}
          {camTab === "joined" && (
            <div className="space-y-4">
              {JOINED_CAMPAIGNS.map((c) => (
                <div key={c.id} className="bg-white rounded-[12px] border border-[#e2e8f0] p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[14px] font-bold text-[#0f172a]">{c.name}</p>
                        <Badge label={c.status === "active" ? "Active" : "Ended"} variant={c.status === "active" ? "green" : "gray"} />
                        <Badge label={`Badge: ${c.badge}`} variant="blue" />
                      </div>
                      <p className="text-[12.5px] text-[#64748b]">Period: {c.period} · Min Discount: {c.discount} · Funding: {c.funding}</p>
                    </div>
                    <button className={btnSecondary}><ExternalLink size={13} /> View Campaign Page</button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Impressions",  value: c.impressions.toLocaleString(), color: "#2563eb" },
                      { label: "Bookings",     value: c.bookings.toString(),           color: "#059669" },
                      { label: "Revenue",      value: `THB ${(c.revenue/1000).toFixed(0)}K`, color: "#7c3aed" },
                    ].map((m) => (
                      <div key={m.label} className="p-3.5 rounded-[10px] bg-[#f8fafc] border border-[#f1f5f9] text-center">
                        <p className="text-[10.5px] text-[#94a3b8] font-medium">{m.label}</p>
                        <p className="text-[20px] font-bold mt-1 leading-none" style={{ color: m.color, letterSpacing: "-0.03em" }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Eligible campaigns */}
          {camTab === "eligible" && (
            <div className="space-y-4">
              {ELIGIBLE_CAMPAIGNS.map((c) => (
                <div key={c.id} className="bg-white rounded-[12px] border border-[#e2e8f0] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[14px] font-bold text-[#0f172a]">{c.name}</p>
                        {c.badge && <Badge label="Badge Eligible" variant="green" />}
                      </div>
                      <p className="text-[12.5px] text-[#64748b] leading-relaxed mb-3">{c.desc}</p>
                      <div className="flex items-center gap-4 text-[12px] text-[#94a3b8] mb-4">
                        <span><strong className="text-[#334155]">Period:</strong> {c.period}</span>
                        <span><strong className="text-[#334155]">Min Discount:</strong> {c.minDiscount}</span>
                        <span><strong className="text-[#334155]">Funding:</strong> {c.funding}</span>
                      </div>
                      <button className={btnPrimary}><ArrowRight size={13} /> Opt In to Programme</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ANALYTICS TAB ─── */}
      {pageTab === "analytics" && (
        <div>
          {/* Overall KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Impressions",  value: totalImpressions.toLocaleString(), sub: "across all promotions", color: "#2563eb", icon: Activity },
              { label: "Total Bookings",     value: totalBookings.toString(),           sub: "driven by promotions",  color: "#059669", icon: CheckCircle2 },
              { label: "Avg Conversion",     value: `${(avgConv * 100).toFixed(1)}%`,  sub: "impression → booking",  color: "#7c3aed", icon: TrendingUp },
              { label: "Promo Revenue",      value: `THB ${(totalRevenue/1000).toFixed(0)}K`, sub: "total attributed",  color: "#d97706", icon: DollarSign },
            ].map(({ label, value, sub, color, icon: Icon }) => (
              <div key={label} className="bg-white rounded-[12px] border border-[#e2e8f0] p-5"
                style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[11.5px] font-semibold text-[#64748b] uppercase tracking-wide">{label}</p>
                  <Icon size={15} style={{ color }} />
                </div>
                <p className="text-[26px] font-bold leading-none mb-1" style={{ color, letterSpacing: "-0.04em" }}>{value}</p>
                <p className="text-[11.5px] text-[#94a3b8]">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            {/* Revenue by Promotion Type */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-5">
              <p className="text-[13px] font-bold text-[#0f172a] mb-4">Revenue by Promotion Type</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analyticsPerType} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}K`} />
                  <Tooltip formatter={(v: number) => [`THB ${(v/1000).toFixed(0)}K`, "Revenue"]}
                    contentStyle={{ fontSize: 11, borderRadius: 7, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Bookings by Promotion Type */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-5">
              <p className="text-[13px] font-bold text-[#0f172a] mb-4">Bookings by Promotion Type</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analyticsPerType} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 7, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="bookings" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-promotion performance table */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0]">
              <p className="text-[13px] font-bold text-[#0f172a]">Promotion Performance Breakdown</p>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  {["Promotion","Type","Status","Impressions","Bookings","Conv. Rate","Revenue","ROI"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scopedData.filter((p) => p.bookings > 0).map((p) => {
                  const roiVal = ((p.revenue - (p.revenue * 0.12)) / (p.revenue * 0.12) * 100).toFixed(0);
                  return (
                    <tr key={p.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                      <td className="px-4 py-3 font-semibold text-[#0f172a] max-w-[160px]"><p className="truncate">{p.name}</p></td>
                      <td className="px-4 py-3"><PromoTypeBadge type={p.type} /></td>
                      <td className="px-4 py-3"><Badge label={stCfg[p.status].label} variant={stCfg[p.status].v} /></td>
                      <td className="px-4 py-3 text-[#334155]">{p.impressions.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-[#059669]">{p.bookings}</td>
                      <td className="px-4 py-3 text-[#7c3aed] font-semibold">{(p.convRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">THB {(p.revenue/1000).toFixed(0)}K</td>
                      <td className="px-4 py-3 font-semibold text-[#059669]">{roiVal}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Create Promotion Modal ─── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <div className="bg-white rounded-[14px] w-[600px] max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0] shrink-0">
              <div>
                <p className="text-[15px] font-bold text-[#0f172a]">Create New Promotion</p>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">Set up a new discount promotion for your property.</p>
              </div>
              <button onClick={() => setCreateOpen(false)} className={cx(btnGhost, "p-1.5")}><X size={15} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Property *">
                  {propertyFilter !== "All Properties" ? (
                    <div className={cx(inputCls, "flex items-center gap-2 bg-[#f8fafc] cursor-not-allowed text-[#334155]")}>
                      <Building2 size={13} className="text-[#94a3b8] shrink-0" />
                      <span className="flex-1 truncate">{propertyFilter}</span>
                      <span className="text-[10.5px] text-[#94a3b8] font-medium shrink-0">Pre-filled</span>
                    </div>
                  ) : (
                    <select className={selectCls} defaultValue="">
                      <option value="">Select property…</option>
                      {HOTEL_OPTIONS.filter((h) => h !== "All Properties").map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  )}
                </FormField>
                <FormField label="Promotion Name *">
                  <input className={inputCls} placeholder="e.g. Summer Flash Sale 2026" />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Promotion Type">
                  <select value={promoType} onChange={(e) => setPromoType(e.target.value)} className={selectCls}>
                    {["Percentage Discount","Fixed Amount Discount","Promo Code","Seasonal Promotion","Early Booking","Long Stay Promotion"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Room Type">
                  <select className={selectCls}>
                    <option>All Room Types</option>
                    <option>Standard Room</option>
                    <option>Deluxe Room</option>
                    <option>Deluxe River View</option>
                    <option>Junior Suite</option>
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={promoType === "Fixed Amount Discount" ? "Discount Amount (THB)" : "Discount (%)"}>
                  <div className="relative">
                    {promoType === "Fixed Amount Discount"
                      ? <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                      : <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />}
                    <input type="number" className={cx(inputCls, "pl-8")} placeholder={promoType === "Fixed Amount Discount" ? "e.g. 300" : "e.g. 20"} />
                  </div>
                </FormField>
                {promoType === "Promo Code" && (
                  <FormField label="Promo Code" hint="Uppercase letters and numbers only.">
                    <input className={inputCls} placeholder="e.g. SUMMER25" />
                  </FormField>
                )}
                {promoType === "Long Stay Promotion" && (
                  <FormField label="Minimum Stay (Nights)">
                    <input type="number" className={inputCls} placeholder="e.g. 7" />
                  </FormField>
                )}
                {promoType === "Early Booking" && (
                  <FormField label="Book in Advance (Days)">
                    <input type="number" className={inputCls} placeholder="e.g. 30" />
                  </FormField>
                )}
                {!["Promo Code","Long Stay Promotion","Early Booking"].includes(promoType) && (
                  <FormField label="Max Redemptions" hint="Leave blank for unlimited.">
                    <input type="number" className={inputCls} placeholder="e.g. 200" />
                  </FormField>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date">
                  <input type="date" className={inputCls} />
                </FormField>
                <FormField label="End Date">
                  <input type="date" className={inputCls} />
                </FormField>
              </div>
              <FormField label="Funding Type">
                <div className="flex gap-2">
                  {["Merchant","Co-Fund","Platform"].map((f) => (
                    <button key={f} className={cx("flex-1 py-2 rounded-[8px] border text-[12.5px] font-medium transition-colors", "border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]")}>
                      {f}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Terms &amp; Notes" hint="Optional — visible to internal review only.">
                <textarea className={cx(inputCls, "h-[70px] resize-none")} placeholder="Any additional conditions or internal notes..." />
              </FormField>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#e2e8f0] shrink-0">
              <button className={btnSecondary} onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className={btnPrimary} onClick={() => setCreateOpen(false)}>
                <Check size={14} /> Create Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-[14px] w-[400px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-[#0f172a]">Delete Promotion</p>
                <p className="text-[12.5px] text-[#64748b] mt-1">
                  This will permanently delete the promotion <strong>{PROMOTIONS_DATA.find((p) => p.id === deleteConfirm)?.name}</strong>. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className={btnSecondary} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors"
                onClick={() => { setDeleteConfirm(null); setSelectedPromo(null); }}>
                <X size={13} /> Delete Promotion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

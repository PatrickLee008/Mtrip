import React, { useState, useEffect, useRef } from "react";
import {
  cx, inputCls, selectCls, btnPrimary, btnSecondary, btnGhost,
  Badge, SectionLabel, FormField, Toggle, PageHeader, type BadgeVariant,
} from "./shared";
import { ReviewsScreen }        from "./screens/ReviewsScreen";
import { GuestMessagesScreen }  from "./screens/GuestMessagesScreen";
import { StaffScreen }          from "./screens/StaffScreen";
import { SupportScreen }   from "./screens/SupportScreen";
import { PromotionsScreen } from "./screens/PromotionsScreen";
import { SettingsScreen }  from "./screens/SettingsScreen";
import {
  LayoutDashboard, Building2, BedDouble, CalendarRange, ClipboardList,
  BarChart3, Tag, Star, Bell, Users, HelpCircle, Settings, LogOut,
  MapPin, Phone, Mail, Globe, Camera, Video, CheckCircle2, Clock,
  AlertCircle, Plus, Edit2, Copy, Archive, Wifi, Dumbbell, Utensils,
  Car, Waves, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle,
  Link2, Search, X, Download, Eye, Ban, RotateCcw, ArrowRight,
  TrendingUp, DollarSign, Percent, UserPlus, Shield, Activity,
  FileText, Banknote, MoreHorizontal, CheckSquare, Upload, Coffee,
  SlidersHorizontal, RefreshCw, User, Check, PieChart, Info, Zap,
  MessageSquare, Package, ExternalLink, List, Inbox, Flag, Filter,
  Calendar, Home, Trash2, QrCode,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const HOTELS = [
  { id: "H001", name: "The Horizon Resort", location: "Phuket, Thailand", type: "Resort", stars: 5, rooms: 4, status: "published", pms: true, cm: false, updated: "23 Jul 2026" },
  { id: "H002", name: "Blue Lagoon Boutique", location: "Koh Samui, Thailand", type: "Boutique Hotel", stars: 4, rooms: 3, status: "under-review", pms: false, cm: false, updated: "20 Jul 2026" },
  { id: "H003", name: "Cityview Business Hotel", location: "Bangkok, Thailand", type: "Business Hotel", stars: 3, rooms: 2, status: "draft", pms: false, cm: false, updated: "18 Jul 2026" },
];

const ROOM_TYPES = [
  { id: "R01", name: "Standard Room", bed: "1 King Bed", adults: 2, children: 1, size: "28 sqm", total: 8, available: 4, status: "active", facilities: ["WiFi", "AC", "TV", "Safe"], price: 2500 },
  { id: "R02", name: "Deluxe Room", bed: "1 King Bed", adults: 3, children: 1, size: "38 sqm", total: 6, available: 3, status: "active", facilities: ["WiFi", "AC", "TV", "Minibar", "Safe"], price: 3200 },
  { id: "R03", name: "Superior Suite", bed: "1 King Bed + Sofa", adults: 2, children: 2, size: "58 sqm", total: 2, available: 1, status: "active", facilities: ["WiFi", "AC", "TV", "Bathtub", "Minibar"], price: 5800 },
  { id: "R04", name: "Pool Villa", bed: "1 King Bed", adults: 2, children: 0, size: "95 sqm", total: 1, available: 0, status: "active", facilities: ["WiFi", "AC", "TV", "Private Pool", "Kitchenette"], price: 9500 },
];

type Booking = {
  id: string; guest: string; hotel: string; room: string;
  checkin: string; checkout: string; nights: number; amount: string;
  payment: string; status: string; channel: string; time: string; tags: string[];
};

const BOOKINGS: Booking[] = [
  { id: "BK-2407001", guest: "K.T.", hotel: "The Horizon Resort",       room: "Deluxe Room",      checkin: "23 Jul 2026", checkout: "26 Jul 2026", nights: 3, amount: "THB 9,600",  payment: "Paid",     status: "confirmed",   channel: "mTrip",   time: "22 Jul, 14:32", tags: [] },
  { id: "BK-2407002", guest: "S.R.", hotel: "The Horizon Resort",       room: "Superior Suite",   checkin: "24 Jul 2026", checkout: "29 Jul 2026", nights: 5, amount: "THB 29,000", payment: "Pending",  status: "pending",     channel: "mTrip",   time: "23 Jul, 09:15", tags: ["VIP"] },
  { id: "BK-2407003", guest: "A.M.", hotel: "The Horizon Resort",       room: "Standard Room",    checkin: "23 Jul 2026", checkout: "25 Jul 2026", nights: 2, amount: "THB 5,000",  payment: "Paid",     status: "checked-in",  channel: "mTrip",   time: "21 Jul, 17:40", tags: [] },
  { id: "BK-2407004", guest: "P.L.", hotel: "The Horizon Resort",       room: "Pool Villa",       checkin: "22 Jul 2026", checkout: "25 Jul 2026", nights: 3, amount: "THB 28,500", payment: "Paid",     status: "checked-in",  channel: "mTrip",   time: "20 Jul, 11:22", tags: ["Honeymoon"] },
  { id: "BK-2407005", guest: "C.W.", hotel: "The Horizon Resort",       room: "Deluxe Room",      checkin: "20 Jul 2026", checkout: "23 Jul 2026", nights: 3, amount: "THB 9,600",  payment: "Paid",     status: "checked-out", channel: "mTrip",   time: "18 Jul, 08:05", tags: [] },
  { id: "BK-2407006", guest: "N.P.", hotel: "The Horizon Resort",       room: "Standard Room",    checkin: "18 Jul 2026", checkout: "20 Jul 2026", nights: 2, amount: "THB 5,000",  payment: "Refunded", status: "cancelled",   channel: "mTrip",   time: "15 Jul, 13:55", tags: [] },
  { id: "BK-2407007", guest: "T.B.", hotel: "The Horizon Resort",       room: "Standard Room",    checkin: "15 Jul 2026", checkout: "16 Jul 2026", nights: 1, amount: "THB 2,500",  payment: "Charged",  status: "no-show",     channel: "mTrip",   time: "14 Jul, 10:30", tags: [] },
  { id: "BK-2407008", guest: "W.L.", hotel: "Blue Lagoon Boutique",     room: "Honeymoon Suite",  checkin: "24 Jul 2026", checkout: "27 Jul 2026", nights: 3, amount: "THB 18,000", payment: "Paid",     status: "confirmed",   channel: "mTrip",   time: "23 Jul, 10:05", tags: ["Honeymoon"] },
  { id: "BK-2407009", guest: "M.C.", hotel: "Blue Lagoon Boutique",     room: "Superior Room",    checkin: "23 Jul 2026", checkout: "25 Jul 2026", nights: 2, amount: "THB 7,400",  payment: "Paid",     status: "checked-in",  channel: "Expedia", time: "22 Jul, 08:30", tags: [] },
  { id: "BK-2407010", guest: "R.J.", hotel: "Blue Lagoon Boutique",     room: "Standard Room",    checkin: "26 Jul 2026", checkout: "28 Jul 2026", nights: 2, amount: "THB 5,800",  payment: "Pending",  status: "pending",     channel: "mTrip",   time: "23 Jul, 16:20", tags: [] },
  { id: "BK-2407011", guest: "D.K.", hotel: "Cityview Business Hotel",  room: "Executive Room",   checkin: "23 Jul 2026", checkout: "24 Jul 2026", nights: 1, amount: "THB 4,200",  payment: "Paid",     status: "checked-in",  channel: "mTrip",   time: "22 Jul, 19:55", tags: [] },
  { id: "BK-2407012", guest: "E.V.", hotel: "Cityview Business Hotel",  room: "Deluxe Room",      checkin: "25 Jul 2026", checkout: "28 Jul 2026", nights: 3, amount: "THB 11,400", payment: "Pending",  status: "pending",     channel: "Booking", time: "23 Jul, 11:40", tags: [] },
  { id: "BK-2407013", guest: "J.H.", hotel: "Cityview Business Hotel",  room: "Standard Room",    checkin: "22 Jul 2026", checkout: "24 Jul 2026", nights: 2, amount: "THB 6,600",  payment: "Paid",     status: "checked-out", channel: "mTrip",   time: "21 Jul, 14:10", tags: [] },
];

const WEEK_DATA = [
  { day: "Fri", occ: 72, bookings: 8, revenue: 28500, adr: 3562 },
  { day: "Sat", occ: 88, bookings: 14, revenue: 42000, adr: 3000 },
  { day: "Sun", occ: 82, bookings: 11, revenue: 36800, adr: 3345 },
  { day: "Mon", occ: 68, bookings: 7, revenue: 24500, adr: 3500 },
  { day: "Tue", occ: 74, bookings: 9, revenue: 31200, adr: 3467 },
  { day: "Wed", occ: 80, bookings: 12, revenue: 38400, adr: 3200 },
  { day: "Thu", occ: 78, bookings: 10, revenue: 35100, adr: 3510 },
];

const NOTIFICATIONS = [
  { id: "N001", type: "booking", title: "New Booking Received", message: "BK-2407008 — Deluxe Room, 25–28 Jul", hotel: "The Horizon Resort", time: "23 Jul 2026, 15:42", read: false, module: "bookings" },
  { id: "N002", type: "checkin", title: "Check-in Reminder", message: "BK-2407003 — Standard Room arrives today at 14:00", hotel: "The Horizon Resort", time: "23 Jul 2026, 08:00", read: false, module: "bookings" },
  { id: "N003", type: "inventory", title: "Low Inventory Alert", message: "Standard Room — only 2 units left for 5–6 Aug", hotel: "The Horizon Resort", time: "23 Jul 2026, 06:00", read: false, module: "availability" },
  { id: "N004", type: "sync-error", title: "PMS Sync Failed", message: "Connection timeout. Last successful sync: 2h ago.", hotel: "The Horizon Resort", time: "23 Jul 2026, 14:02", read: false, module: "notifications" },
  { id: "N005", type: "settlement", title: "Settlement Processed", message: "Jun 2026 settlement THB 134,640 transferred", hotel: "The Horizon Resort", time: "22 Jul 2026, 14:00", read: true, module: "earnings" },
  { id: "N006", type: "review", title: "New Guest Review", message: "4.5/5 stars — Deluxe Room stay", hotel: "The Horizon Resort", time: "22 Jul 2026, 11:30", read: true, module: "reviews" },
  { id: "N007", type: "cancellation", title: "Booking Cancelled", message: "BK-2407006 cancelled by guest — Standard Room", hotel: "The Horizon Resort", time: "21 Jul 2026, 18:45", read: true, module: "bookings" },
];

const CAL_DATES = ["Jul 23", "Jul 24", "Jul 25", "Jul 26", "Jul 27", "Jul 28", "Jul 29", "Jul 30", "Jul 31", "Aug 1", "Aug 2", "Aug 3", "Aug 4", "Aug 5"];
const CAL_AVAIL: Record<string, number[]> = {
  R01: [4, 4, 2, 2, 0, 0, 4, 4, 6, 6, 6, 6, 6, 6],
  R02: [3, 3, 3, 1, 0, 0, 2, 2, 4, 4, 4, 4, 4, 4],
  R03: [1, 1, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2],
  R04: [0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
};
const CAL_PRICE_BASE: Record<string, number> = { R01: 2500, R02: 3200, R03: 5800, R04: 9500 };
const CAL_PRICE_WKD: Record<string, number> = { R01: 3200, R02: 4000, R03: 7200, R04: 11500 };
const WEEKEND_IDX = [2, 3, 4, 9, 10];

// ─── Navigation Config ────────────────────────────────────────────────────────

type ScreenId = "dashboard" | "properties" | "rooms" | "availability" | "bookings" | "notifications" | "earnings" | "promotions" | "reviews" | "messages" | "staff" | "support" | "settings";

const NAV_GROUPS = [
  {
    label: "",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Property Management",
    items: [
      { id: "properties", label: "Hotel Properties", icon: Building2 },
      { id: "rooms", label: "Room Types", icon: BedDouble },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "availability", label: "Availability & Pricing", icon: CalendarRange },
      { id: "bookings", label: "Booking Management", icon: ClipboardList },
      { id: "notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Business",
    items: [
      { id: "earnings",  label: "Dashboard & Earnings", icon: BarChart3 },
      { id: "promotions",label: "Promotions",           icon: Tag },
      { id: "reviews",   label: "Reviews",              icon: Star },
      { id: "messages",  label: "Guest Messages",       icon: MessageSquare },
    ],
  },
  {
    label: "Team",
    items: [{ id: "staff", label: "Staff Management", icon: Users }],
  },
  {
    label: "System",
    items: [
      { id: "support", label: "Support", icon: HelpCircle },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const SCREEN_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  properties: "Hotel Properties",
  rooms: "Room Types",
  availability: "Availability & Pricing",
  bookings: "Booking Management",
  notifications: "Notifications",
  earnings: "Dashboard & Earnings",
  promotions: "Promotions",
  reviews:  "Reviews",
  messages: "Guest Messages",
  staff:    "Staff Management",
  support: "Support",
  settings: "Settings",
};

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({
  screen,
  navigate,
  children,
}: {
  screen: ScreenId;
  navigate: (dest: ScreenId, opts?: Record<string, string>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      {/* Sidebar */}
      <aside className="w-[220px] min-w-[220px] bg-white border-r border-[#e2e8f0] flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-[#e2e8f0]">
          <span className="text-[15px] font-bold text-[#2563eb]">mTrip</span>
          <span className="ml-1.5 text-[11px] text-[#94a3b8] font-medium">Merchant</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="mb-3">
              {group.label && <SectionLabel>{group.label}</SectionLabel>}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = screen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id as ScreenId)}
                    className={cx(
                      "flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-medium rounded-[8px] mx-1 transition-colors",
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                    )}
                    style={{ width: "calc(100% - 8px)" }}
                  >
                    <Icon size={15} className={active ? "text-blue-600" : "text-[#94a3b8]"} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-[#e2e8f0]">
          <button className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-medium text-[#64748b] hover:bg-red-50 hover:text-red-600 rounded-[8px] transition-colors">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-[#e2e8f0] flex items-center px-5 gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-[13px] text-[#64748b]">
            <span className="text-[#94a3b8]">mTrip</span>
            <ChevronRight size={13} className="text-[#cbd5e1]" />
            <span className="font-semibold text-[#0f172a]">{SCREEN_LABELS[screen] || screen}</span>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              className="pl-8 pr-3 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[8px] bg-[#f8fafc] w-44 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Search..."
            />
          </div>

          <button
            onClick={() => navigate("notifications")}
            className="relative p-2 rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
          >
            <Bell size={16} className="text-[#64748b]" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <div className="flex items-center gap-2 pl-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={13} className="text-blue-600" />
            </div>
            <span className="text-[12px] font-medium text-[#334155]">Hotel Owner</span>
            <ChevronDown size={13} className="text-[#94a3b8]" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-7 py-6">{children}</main>
      </div>
    </div>
  );
}

// ─── QR Login ────────────────────────────────────────────────────────────────

function QRLoginButton() {
  const [open, setOpen]             = useState(false);
  const [seconds, setSeconds]       = useState(120);
  const [refreshKey, setRefreshKey] = useState(0);
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

  const startTimer = () => {
    clearTimer();
    setSeconds(120);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => { if (s <= 1) { clearTimer(); return 0; } return s - 1; });
    }, 1000);
  };

  useEffect(() => { if (open) startTimer(); else clearTimer(); return clearTimer; }, [open, refreshKey]);

  const handleOpen    = () => setOpen(true);
  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const mm      = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss      = String(seconds % 60).padStart(2, "0");
  const expired = seconds === 0;

  // Deterministic QR-like SVG pattern seeded by refreshKey
  const QR_SIZE = 160;
  const MOD = 21;
  const CELL = QR_SIZE / MOD;
  const seed = refreshKey * 7919 + 3571;
  const pseudo = (r: number, c: number) => {
    const v = (seed ^ (r * 31 + c * 17) ^ (r * c * 7)) & 0xfff;
    return v % 3 !== 0;
  };
  // fixed finder patterns (top-left, top-right, bottom-left corners)
  const finder = (r: number, c: number): boolean | null => {
    const inPattern = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    const border = (br: number, bc: number) => (r === br || r === br + 6 || c === bc || c === bc + 6) && inPattern(br, bc);
    const inner = (br: number, bc: number) => r >= br + 2 && r <= br + 4 && c >= bc + 2 && c <= bc + 4 && inPattern(br, bc);
    const tl = border(0, 0) || inner(0, 0);
    const tr = border(0, MOD - 7) || inner(0, MOD - 7);
    const bl = border(MOD - 7, 0) || inner(MOD - 7, 0);
    if (inPattern(0, 0))       return tl;
    if (inPattern(0, MOD - 7)) return tr;
    if (inPattern(MOD - 7, 0)) return bl;
    return null;
  };

  const cells: { r: number; c: number; filled: boolean }[] = [];
  for (let r = 0; r < MOD; r++) {
    for (let c = 0; c < MOD; c++) {
      const f = finder(r, c);
      cells.push({ r, c, filled: f !== null ? f : pseudo(r, c) });
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#334155] border border-[#e2e8f0] rounded-[8px] bg-white hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all"
      >
        <QrCode size={14} className="text-[#64748b]" />
        Scan QR
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-white rounded-[20px] shadow-2xl w-[380px] overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-[8px] bg-blue-600 flex items-center justify-center">
                    <QrCode size={14} className="text-white" />
                  </div>
                  <h2 className="text-[15px] font-bold text-[#0f172a]">QR Login</h2>
                </div>
                <p className="text-[12px] text-[#64748b] leading-relaxed">
                  Scan with the <span className="font-semibold text-[#334155]">mTrip Merchant</span> mobile app to sign in securely.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-[8px] hover:bg-[#f1f5f9] transition-colors ml-3 shrink-0">
                <X size={15} className="text-[#94a3b8]" />
              </button>
            </div>

            {/* Access gate */}
            <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-[8px]">
              <Shield size={12} className="text-green-600 shrink-0" />
              <span className="text-[11.5px] text-green-800 font-medium">Approved merchant · QR Login enabled</span>
            </div>

            {/* QR code area */}
            <div className="flex flex-col items-center px-6 py-6">
              <div className={cx(
                "relative p-4 rounded-[16px] border-2 transition-all",
                expired ? "border-[#e2e8f0] opacity-40 grayscale" : "border-blue-100 shadow-sm shadow-blue-50"
              )}>
                <svg width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} xmlns="http://www.w3.org/2000/svg">
                  <rect width={QR_SIZE} height={QR_SIZE} fill="white" />
                  {cells.map(({ r, c, filled }) =>
                    filled ? (
                      <rect
                        key={`${r}-${c}`}
                        x={c * CELL + 0.5}
                        y={r * CELL + 0.5}
                        width={CELL - 1}
                        height={CELL - 1}
                        rx={0.8}
                        fill="#0f172a"
                      />
                    ) : null
                  )}
                </svg>
                {/* Centred mTrip logo overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-8 h-8 bg-white rounded-[6px] flex items-center justify-center shadow-sm border border-[#e2e8f0]">
                    <span className="text-[9px] font-black text-blue-600 tracking-tight leading-none">mT</span>
                  </div>
                </div>
              </div>

              {/* Timer */}
              <div className={cx("mt-4 flex items-center gap-2", expired ? "text-red-500" : "text-[#64748b]")}>
                {expired ? (
                  <AlertCircle size={13} className="shrink-0" />
                ) : (
                  <Clock size={13} className="shrink-0" />
                )}
                <span className="text-[12px] font-medium">
                  {expired ? "QR code expired" : `Expires in ${mm}:${ss}`}
                </span>
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-[8px] transition-all"
              >
                <RefreshCw size={12} />
                Refresh QR
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              <p className="text-center text-[11px] text-[#94a3b8] leading-relaxed">
                This QR code is single-use and valid for 2 minutes only.
                <br />Keep it private — do not share your screen.
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

// ─── Booking Status / Payment Badges ─────────────────────────────────────────

function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    confirmed: { label: "Confirmed", variant: "blue" },
    pending: { label: "Pending", variant: "yellow" },
    "checked-in": { label: "Checked-in", variant: "green" },
    "checked-out": { label: "Checked-out", variant: "slate" },
    cancelled: { label: "Cancelled", variant: "red" },
    "no-show": { label: "No-show", variant: "orange" },
    "pending-checkin": { label: "Pending Check-in", variant: "purple" },
  };
  const cfg = map[status] || { label: status, variant: "gray" as BadgeVariant };
  return <Badge label={cfg.label} variant={cfg.variant} />;
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    Paid: "green", Pending: "yellow", Refunded: "slate", Charged: "orange",
  };
  return <Badge label={status} variant={map[status] || "gray"} />;
}

// ─── Screen 1: Dashboard ──────────────────────────────────────────────────────

const PROPERTY_OPTIONS = [
  { value: "all", label: "All Properties" },
  { value: "H001", label: "The Horizon Resort" },
  { value: "H002", label: "Blue Lagoon Boutique" },
  { value: "H003", label: "Cityview Business Hotel" },
];

const PROPERTY_DATA: Record<string, {
  todayBookings: number; checkIns: number; checkOuts: number; currentGuests: number;
  occupancy: number; totalRooms: number; revenueToday: number;
  pendingConfirm: number; pendingSettlement: number; alerts: number;
  status: string;
  revTrend: { day: string; revenue: number }[];
  occTrend: { day: string; occ: number }[];
  bkTrend:  { day: string; bookings: number }[];
  ops: { bookingId: string; guest: string; room: string; checkin: string; checkout: string; status: string }[];
}> = {
  H001: {
    todayBookings: 3, checkIns: 4, checkOuts: 3, currentGuests: 12,
    occupancy: 78, totalRooms: 22, revenueToday: 35100,
    pendingConfirm: 2, pendingSettlement: 134640, alerts: 1, status: "published",
    revTrend: [{ day: "Fri", revenue: 28500 }, { day: "Sat", revenue: 42000 }, { day: "Sun", revenue: 36800 }, { day: "Mon", revenue: 24500 }, { day: "Tue", revenue: 31200 }, { day: "Wed", revenue: 38400 }, { day: "Thu", revenue: 35100 }],
    occTrend: [{ day: "Fri", occ: 72 }, { day: "Sat", occ: 88 }, { day: "Sun", occ: 82 }, { day: "Mon", occ: 68 }, { day: "Tue", occ: 74 }, { day: "Wed", occ: 80 }, { day: "Thu", occ: 78 }],
    bkTrend:  [{ day: "Fri", bookings: 8 }, { day: "Sat", bookings: 14 }, { day: "Sun", bookings: 11 }, { day: "Mon", bookings: 7 }, { day: "Tue", bookings: 9 }, { day: "Wed", bookings: 12 }, { day: "Thu", bookings: 3 }],
    ops: [
      { bookingId: "BK-2407003", guest: "A.M.", room: "Standard Room", checkin: "23 Jul 2026", checkout: "25 Jul 2026", status: "checked-in" },
      { bookingId: "BK-2407004", guest: "P.L.", room: "Pool Villa",    checkin: "22 Jul 2026", checkout: "25 Jul 2026", status: "checked-in" },
      { bookingId: "BK-2407001", guest: "K.T.", room: "Deluxe Room",   checkin: "23 Jul 2026", checkout: "26 Jul 2026", status: "confirmed" },
      { bookingId: "BK-2407002", guest: "S.R.", room: "Superior Suite",checkin: "24 Jul 2026", checkout: "29 Jul 2026", status: "pending"   },
      { bookingId: "BK-2407005", guest: "C.W.", room: "Deluxe Room",   checkin: "20 Jul 2026", checkout: "23 Jul 2026", status: "checked-out" },
    ],
  },
  H002: {
    todayBookings: 1, checkIns: 2, checkOuts: 1, currentGuests: 5,
    occupancy: 62, totalRooms: 14, revenueToday: 12400,
    pendingConfirm: 1, pendingSettlement: 48200, alerts: 2, status: "under-review",
    revTrend: [{ day: "Fri", revenue: 9200 }, { day: "Sat", revenue: 14800 }, { day: "Sun", revenue: 11600 }, { day: "Mon", revenue: 7400 }, { day: "Tue", revenue: 10200 }, { day: "Wed", revenue: 13100 }, { day: "Thu", revenue: 12400 }],
    occTrend: [{ day: "Fri", occ: 55 }, { day: "Sat", occ: 71 }, { day: "Sun", occ: 64 }, { day: "Mon", occ: 50 }, { day: "Tue", occ: 57 }, { day: "Wed", occ: 65 }, { day: "Thu", occ: 62 }],
    bkTrend:  [{ day: "Fri", bookings: 3 }, { day: "Sat", bookings: 5 }, { day: "Sun", bookings: 4 }, { day: "Mon", bookings: 2 }, { day: "Tue", bookings: 3 }, { day: "Wed", bookings: 4 }, { day: "Thu", bookings: 1 }],
    ops: [
      { bookingId: "BK-2407011", guest: "N.P.", room: "Garden Room",   checkin: "23 Jul 2026", checkout: "25 Jul 2026", status: "checked-in" },
      { bookingId: "BK-2407012", guest: "R.S.", room: "Superior Room", checkin: "21 Jul 2026", checkout: "24 Jul 2026", status: "checked-in" },
      { bookingId: "BK-2407013", guest: "L.M.", room: "Garden Room",   checkin: "23 Jul 2026", checkout: "26 Jul 2026", status: "confirmed" },
    ],
  },
  H003: {
    todayBookings: 2, checkIns: 1, checkOuts: 2, currentGuests: 8,
    occupancy: 71, totalRooms: 16, revenueToday: 18600,
    pendingConfirm: 0, pendingSettlement: 67800, alerts: 0, status: "draft",
    revTrend: [{ day: "Fri", revenue: 14200 }, { day: "Sat", revenue: 17800 }, { day: "Sun", revenue: 15400 }, { day: "Mon", revenue: 12600 }, { day: "Tue", revenue: 16300 }, { day: "Wed", revenue: 19100 }, { day: "Thu", revenue: 18600 }],
    occTrend: [{ day: "Fri", occ: 65 }, { day: "Sat", occ: 78 }, { day: "Sun", occ: 72 }, { day: "Mon", occ: 60 }, { day: "Tue", occ: 68 }, { day: "Wed", occ: 74 }, { day: "Thu", occ: 71 }],
    bkTrend:  [{ day: "Fri", bookings: 5 }, { day: "Sat", bookings: 7 }, { day: "Sun", bookings: 6 }, { day: "Mon", bookings: 4 }, { day: "Tue", bookings: 5 }, { day: "Wed", bookings: 7 }, { day: "Thu", bookings: 2 }],
    ops: [
      { bookingId: "BK-2407021", guest: "T.K.", room: "Business Room", checkin: "22 Jul 2026", checkout: "24 Jul 2026", status: "checked-in" },
      { bookingId: "BK-2407022", guest: "M.J.", room: "Deluxe City",   checkin: "23 Jul 2026", checkout: "25 Jul 2026", status: "confirmed" },
      { bookingId: "BK-2407023", guest: "W.C.", room: "Business Room", checkin: "19 Jul 2026", checkout: "23 Jul 2026", status: "checked-out" },
      { bookingId: "BK-2407024", guest: "B.S.", room: "Executive Suite",checkin: "21 Jul 2026", checkout: "23 Jul 2026", status: "checked-out" },
    ],
  },
};

const PROPERTY_PERF = [
  { id: "H001", name: "The Horizon Resort",     todayBk: 3, occ: 78, revenue: 35100, status: "published"   },
  { id: "H002", name: "Blue Lagoon Boutique",   todayBk: 1, occ: 62, revenue: 12400, status: "under-review" },
  { id: "H003", name: "Cityview Business Hotel",todayBk: 2, occ: 71, revenue: 18600, status: "draft"        },
];

function DashboardScreen({ navigate }: { navigate: (dest: ScreenId, opts?: Record<string, string>) => void }) {
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [syncDismissed, setSyncDismissed] = useState(false);

  const isAll = selectedProperty === "all";
  const pd = isAll ? null : PROPERTY_DATA[selectedProperty];

  // Aggregate KPIs
  const allVals = Object.values(PROPERTY_DATA);
  const kpi = {
    totalHotels:      3,
    todayBookings:    isAll ? allVals.reduce((s, h) => s + h.todayBookings, 0) : pd!.todayBookings,
    checkIns:         isAll ? allVals.reduce((s, h) => s + h.checkIns, 0)    : pd!.checkIns,
    checkOuts:        isAll ? allVals.reduce((s, h) => s + h.checkOuts, 0)   : pd!.checkOuts,
    currentGuests:    isAll ? allVals.reduce((s, h) => s + h.currentGuests, 0) : pd!.currentGuests,
    occupancy:        isAll ? Math.round(allVals.reduce((s, h) => s + h.occupancy, 0) / allVals.length) : pd!.occupancy,
    revenueToday:     isAll ? allVals.reduce((s, h) => s + h.revenueToday, 0) : pd!.revenueToday,
    pendingConfirm:   isAll ? allVals.reduce((s, h) => s + h.pendingConfirm, 0) : pd!.pendingConfirm,
    pendingSettlement:isAll ? allVals.reduce((s, h) => s + h.pendingSettlement, 0) : pd!.pendingSettlement,
  };

  // Aggregate chart data
  const DAYS = ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];
  const revTrend = isAll ? DAYS.map((day, i) => ({ day, revenue: allVals.reduce((s, h) => s + h.revTrend[i].revenue, 0) })) : pd!.revTrend;
  const occTrend = isAll ? DAYS.map((day, i) => ({ day, occ: Math.round(allVals.reduce((s, h) => s + h.occTrend[i].occ, 0) / allVals.length) })) : pd!.occTrend;
  const bkTrend  = isAll ? DAYS.map((day, i) => ({ day, bookings: allVals.reduce((s, h) => s + h.bkTrend[i].bookings, 0) })) : pd!.bkTrend;

  // Today's operations rows
  const ops = isAll
    ? PROPERTY_PERF.flatMap((p) => PROPERTY_DATA[p.id].ops.map((o) => ({ ...o, hotel: p.name })))
    : pd!.ops.map((o) => ({ ...o, hotel: PROPERTY_OPTIONS.find((x) => x.value === selectedProperty)?.label ?? "" }));

  const perfRows = isAll ? PROPERTY_PERF : PROPERTY_PERF.filter((p) => p.id === selectedProperty);

  const statusVariant = (s: string): BadgeVariant =>
    s === "published" ? "green" : s === "under-review" ? "yellow" : "gray";
  const statusLabel = (s: string) => s === "published" ? "Live" : s === "under-review" ? "Under Review" : "Draft";

  const opStatusVariant = (s: string): BadgeVariant =>
    s === "checked-in" ? "green" : s === "confirmed" ? "blue" : s === "pending" ? "yellow" : s === "checked-out" ? "slate" : "gray";
  const opStatusLabel = (s: string) =>
    s === "checked-in" ? "Checked In" : s === "confirmed" ? "Confirmed" : s === "pending" ? "Pending" : s === "checked-out" ? "Checked Out" : s;

  const KPI_CARDS = [
    { label: "Total Hotels",          value: String(kpi.totalHotels),                                      sub: "Managed properties", icon: Building2,     color: "text-blue-600",   bg: "bg-blue-50",   onClick: () => navigate("properties") },
    { label: "Today's Bookings",      value: String(kpi.todayBookings),                                     sub: "Received today",     icon: ClipboardList, color: "text-green-600",  bg: "bg-green-50",  onClick: () => navigate("bookings") },
    { label: "Today's Check-ins",     value: String(kpi.checkIns),                                          sub: "Arriving today",     icon: ArrowRight,    color: "text-purple-600", bg: "bg-purple-50", onClick: () => navigate("bookings", { bookingTab: "pending-checkin" }) },
    { label: "Today's Check-outs",    value: String(kpi.checkOuts),                                         sub: "Departing today",    icon: LogOut,        color: "text-slate-600",  bg: "bg-slate-50",  onClick: () => navigate("bookings", { bookingTab: "in-house" }) },
    { label: "Current Guests",        value: String(kpi.currentGuests),                                     sub: "In-house now",       icon: Users,         color: "text-indigo-600", bg: "bg-indigo-50", onClick: () => navigate("bookings", { bookingTab: "in-house" }) },
    { label: "Occupancy Rate",        value: `${kpi.occupancy}%`,                                           sub: isAll ? "Avg all hotels" : `${PROPERTY_DATA[selectedProperty]?.totalRooms} total rooms`, icon: PieChart, color: "text-teal-600", bg: "bg-teal-50", onClick: () => navigate("availability") },
    { label: "Revenue Today",         value: `THB ${(kpi.revenueToday / 1000).toFixed(0)}K`,                sub: "Thu 23 Jul 2026",    icon: DollarSign,    color: "text-emerald-600",bg: "bg-emerald-50",onClick: () => navigate("earnings") },
    { label: "Pending Confirmations", value: String(kpi.pendingConfirm),                                    sub: "Awaiting action",    icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",  onClick: () => navigate("bookings", { bookingTab: "pending" }) },
    { label: "Pending Settlement",    value: `THB ${(kpi.pendingSettlement / 1000).toFixed(0)}K`,           sub: "Awaiting payout",    icon: Banknote,      color: "text-violet-600", bg: "bg-violet-50", onClick: () => navigate("earnings") },
    { label: "Active Promotions",    value: "5 Active",                                                      sub: "2 Long Stay · 2 Coupons · 1 Seasonal", icon: Tag, color: "text-rose-600", bg: "bg-rose-50", onClick: () => navigate("promotions"), status: "All Campaigns Running" },
  ];

  return (
    <div>
      {/* Page title + property selector */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#0f172a]" style={{ letterSpacing: "-0.025em" }}>Dashboard</h1>
          <p className="text-[13px] text-[#64748b] mt-0.5">Thu 23 Jul 2026 · Operational overview across your portfolio</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#94a3b8] text-[12px]">Last sync: 2 min ago</span>
          <span className="flex items-center gap-1 text-[12px] text-green-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> PMS: Connected
          </span>
        </div>
      </div>

      {/* Property selector */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-widest">Property</label>
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="pl-9 pr-8 py-2 text-[13px] font-semibold border border-[#e2e8f0] rounded-[8px] bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors cursor-pointer appearance-none min-w-[220px]"
            >
              {PROPERTY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
          </div>
        </div>

        {/* Sync alert inline */}
        {!syncDismissed && (
          <div className="flex items-center gap-2.5 mt-5 px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-[8px] text-[12px]">
            <AlertTriangle size={13} className="text-amber-600 shrink-0" />
            <span className="text-amber-800">PMS sync failed at 14:02 — connection timeout</span>
            <button onClick={() => navigate("notifications")} className="font-semibold text-amber-700 hover:text-amber-900 underline">View Logs</button>
            <button onClick={() => setSyncDismissed(true)} className="text-amber-500 hover:text-amber-700 ml-1"><X size={13} /></button>
          </div>
        )}
      </div>

      {/* KPI Cards — 3 per row × 3 rows */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {KPI_CARDS.map((kpiCard) => {
          const Icon = kpiCard.icon;
          return (
            <button
              key={kpiCard.label}
              onClick={kpiCard.onClick}
              className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 text-left hover:shadow-md hover:border-blue-200 transition-all group"
              style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
            >
              <div className="flex items-start justify-between mb-2.5">
                <div className={cx("w-8 h-8 rounded-[8px] flex items-center justify-center", kpiCard.bg)}>
                  <Icon size={15} className={kpiCard.color} />
                </div>
                <ArrowRight size={13} className="text-[#cbd5e1] group-hover:text-blue-400 transition-colors" />
              </div>
              <div className="text-[22px] font-bold text-[#0f172a] leading-tight" style={{ letterSpacing: "-0.03em" }}>{kpiCard.value}</div>
              <div className="text-[11.5px] font-semibold text-[#334155] mt-0.5">{kpiCard.label}</div>
              <div className="text-[11px] text-[#94a3b8]">{kpiCard.sub}</div>
              {"status" in kpiCard && (
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="text-[10.5px] font-medium text-green-700">{(kpiCard as { status: string }).status}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {/* Revenue Trend */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-bold text-[#0f172a]">Revenue Trend</p>
            <Badge label="7 days" variant="slate" />
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={revTrend} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="dash-rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#059669" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 7, border: "1px solid #e2e8f0" }} formatter={(v: number) => [`THB ${v.toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#059669" fill="url(#dash-rev-grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy Trend */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-bold text-[#0f172a]">Occupancy Trend</p>
            <Badge label="7 days" variant="slate" />
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={occTrend} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[40, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 7, border: "1px solid #e2e8f0" }} formatter={(v: number) => [`${v}%`, "Occupancy"]} />
              <Line type="monotone" dataKey="occ" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Booking Trend */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-bold text-[#0f172a]">Booking Trend</p>
            <Badge label="7 days" variant="slate" />
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={bkTrend} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 7, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="bookings" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Property Performance Table */}
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f1f5f9]">
          <p className="text-[13.5px] font-bold text-[#0f172a]">Property Performance</p>
          <button onClick={() => navigate("properties")} className={btnGhost}><ExternalLink size={12} /> View All Properties</button>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              {["Hotel", "Today's Bookings", "Occupancy", "Revenue Today", "Status"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perfRows.map((p) => (
              <tr key={p.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-[7px] bg-[#eff6ff] flex items-center justify-center shrink-0">
                      <Building2 size={13} className="text-[#2563eb]" />
                    </div>
                    <span className="font-semibold text-[#0f172a]">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-[#0f172a]">{p.todayBk}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${p.occ}%` }} />
                    </div>
                    <span className="font-semibold text-[#334155]">{p.occ}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-[#0f172a]">THB {p.revenue.toLocaleString()}</td>
                <td className="px-4 py-3"><Badge label={statusLabel(p.status)} variant={statusVariant(p.status)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Today's Operations */}
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f1f5f9]">
          <div>
            <p className="text-[13.5px] font-bold text-[#0f172a]">{"Today's Operations"}</p>
            <p className="text-[12px] text-[#94a3b8]">Active bookings across {isAll ? "all properties" : PROPERTY_OPTIONS.find((o) => o.value === selectedProperty)?.label} — Thu 23 Jul 2026</p>
          </div>
          <button onClick={() => navigate("bookings")} className={btnGhost}><ExternalLink size={12} /> View All Bookings</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                {(isAll ? ["Hotel", "Booking ID", "Guest", "Room", "Check-in", "Check-out", "Status"] : ["Booking ID", "Guest", "Room", "Check-in", "Check-out", "Status"]).map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ops.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#94a3b8]">No operations for this property today.</td></tr>
              ) : ops.map((op) => (
                <tr key={op.bookingId} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                  {isAll && <td className="px-4 py-3 text-[#64748b] max-w-[160px]"><p className="truncate">{op.hotel}</p></td>}
                  <td className="px-4 py-3 font-semibold text-[#2563eb] whitespace-nowrap">{op.bookingId}</td>
                  <td className="px-4 py-3 font-medium text-[#0f172a]">{op.guest}</td>
                  <td className="px-4 py-3 text-[#64748b]">{op.room}</td>
                  <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">{op.checkin}</td>
                  <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">{op.checkout}</td>
                  <td className="px-4 py-3"><Badge label={opStatusLabel(op.status)} variant={opStatusVariant(op.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Screen 2: Hotel Properties ───────────────────────────────────────────────

function PropertiesScreen({
  propertyDetailId,
  setPropertyDetailId,
}: {
  propertyDetailId: string | null;
  setPropertyDetailId: (id: string | null) => void;
}) {
  const [subView, setSubView] = useState<"overview" | "edit" | "add">("overview");
  const [overviewTab, setOverviewTab] = useState("Overview");
  const [addStep, setAddStep] = useState(1);
  const [moreOpen, setMoreOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [propTab, setPropTab] = useState("Hotel Information");
  const [amenities, setAmenities] = useState<Record<string, boolean>>({
    WiFi: true, Pool: true, Parking: false, Breakfast: true, Gym: true, Restaurant: true, Spa: false, "Business Center": false,
  });
  const [optServices, setOptServices] = useState({ "Airport Transfer": false, Laundry: true, "Room Service": true });

  const AMENITY_ICONS: Record<string, React.ElementType> = {
    WiFi: Wifi, Pool: Waves, Parking: Car, Breakfast: Coffee, Gym: Dumbbell, Restaurant: Utensils, Spa: Waves, "Business Center": Building2,
  };

  const detail = HOTELS.find((h) => h.id === propertyDetailId);

  const openOverview = (id: string, tab = "Overview") => {
    setPropertyDetailId(id);
    setSubView("overview");
    setOverviewTab(tab);
    setMoreOpen(null);
  };

  const openEdit = (id: string) => {
    setPropertyDetailId(id);
    setSubView("edit");
    setPropTab("Hotel Information");
    setMoreOpen(null);
  };

  const goToList = () => {
    setPropertyDetailId(null);
    setSubView("overview");
    setMoreOpen(null);
    setAddStep(1);
  };

  const statusBadgeVariant = (s: string): BadgeVariant =>
    s === "published" ? "green" : s === "under-review" ? "yellow" : "gray";
  const statusBadgeLabel = (s: string) =>
    s === "published" ? "Published" : s === "under-review" ? "Under Review" : "Draft";

  // ── Add New Hotel Wizard ──────────────────────────────────────────────────────
  if (subView === "add") {
    const STEPS = ["Basic Information", "Hotel Details", "Amenities", "Policies", "Photos & Video", "Review & Submit"];
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={goToList} className={btnGhost}><ChevronLeft size={13} /> Hotel Properties</button>
          <ChevronRight size={13} className="text-[#cbd5e1]" />
          <span className="text-[14px] font-bold text-[#0f172a]">Add New Hotel</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center bg-white rounded-[12px] border border-[#e2e8f0] px-6 py-4 mb-5 overflow-x-auto gap-0">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center">
              <button onClick={() => setAddStep(i + 1)} className="flex flex-col items-center gap-1.5 min-w-[80px]">
                <div className={cx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors",
                  i + 1 < addStep ? "bg-blue-600 text-white" :
                  i + 1 === addStep ? "bg-blue-600 text-white ring-4 ring-blue-100" :
                  "bg-[#f1f5f9] text-[#94a3b8]"
                )}>
                  {i + 1 < addStep ? <Check size={13} /> : i + 1}
                </div>
                <span className={cx("text-[10px] font-medium whitespace-nowrap", i + 1 === addStep ? "text-blue-700" : "text-[#94a3b8]")}>{step}</span>
              </button>
              {i < STEPS.length - 1 && <div className={cx("h-0.5 w-8 mx-1 mb-5", i + 1 < addStep ? "bg-blue-400" : "bg-[#e2e8f0]")} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6 mb-20">
          {addStep === 1 && (
            <div>
              <h2 className="text-[15px] font-bold text-[#0f172a] mb-4">Basic Information</h2>
              <div className="grid grid-cols-2 gap-5">
                <FormField label="Hotel Name"><input className={inputCls} placeholder="e.g. The Grand Palace Hotel" /></FormField>
                <FormField label="Property Type">
                  <select className={selectCls}>
                    <option>Select type…</option><option>Resort</option><option>Boutique Hotel</option><option>Business Hotel</option><option>Hostel</option><option>Villa</option>
                  </select>
                </FormField>
                <div className="col-span-2"><FormField label="Description" hint="Describe your property in up to 500 characters."><textarea className={cx(inputCls, "resize-none h-24")} placeholder="A luxury property offering…" /></FormField></div>
                <FormField label="Star Rating">
                  <div className="flex gap-2 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => <button key={s} className="p-0.5"><Star size={22} className="text-amber-400 fill-amber-400" /></button>)}
                  </div>
                </FormField>
                <FormField label="Phone Number"><input className={inputCls} placeholder="+66 2 000 0000" /></FormField>
                <FormField label="Email Address"><input className={inputCls} placeholder="info@yourhotel.com" /></FormField>
                <FormField label="Website"><input className={inputCls} placeholder="https://yourhotel.com" /></FormField>
              </div>
            </div>
          )}

          {addStep === 2 && (
            <div>
              <h2 className="text-[15px] font-bold text-[#0f172a] mb-4">Hotel Details</h2>
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2"><FormField label="Street Address"><input className={inputCls} placeholder="123 Beach Road" /></FormField></div>
                <FormField label="City / Province"><input className={inputCls} placeholder="Phuket" /></FormField>
                <FormField label="Country">
                  <select className={selectCls}><option>Thailand</option><option>Singapore</option><option>Malaysia</option><option>Vietnam</option></select>
                </FormField>
                <FormField label="Total Rooms"><input className={inputCls} type="number" placeholder="0" /></FormField>
                <FormField label="Year Built / Renovated"><input className={inputCls} placeholder="2018" /></FormField>
                <div className="col-span-2 h-44 bg-[#f1f5f9] rounded-[10px] flex items-center justify-center border border-dashed border-[#cbd5e1] cursor-pointer hover:border-blue-300 transition-colors">
                  <div className="text-center text-[#94a3b8]"><MapPin size={20} className="mx-auto mb-2" /><p className="text-[12px]">Click to pin your hotel location on the map</p></div>
                </div>
              </div>
            </div>
          )}

          {addStep === 3 && (
            <div>
              <h2 className="text-[15px] font-bold text-[#0f172a] mb-1">Amenities</h2>
              <p className="text-[13px] text-[#64748b] mb-4">Enable the amenities available at this property.</p>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(amenities).map(([name, on]) => {
                  const Icon = AMENITY_ICONS[name] || CheckCircle2;
                  return (
                    <div
                      key={name}
                      className={cx("flex flex-col items-center gap-2 p-4 rounded-[10px] border cursor-pointer transition-all", on ? "border-blue-300 bg-blue-50" : "border-[#e2e8f0] bg-white")}
                      onClick={() => setAmenities((a) => ({ ...a, [name]: !a[name] }))}
                    >
                      <Icon size={20} className={on ? "text-blue-600" : "text-[#94a3b8]"} />
                      <span className="text-[12px] font-medium text-[#334155]">{name}</span>
                      <Toggle on={on} onChange={() => setAmenities((a) => ({ ...a, [name]: !a[name] }))} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {addStep === 4 && (
            <div>
              <h2 className="text-[15px] font-bold text-[#0f172a] mb-4">Policies</h2>
              <div className="grid grid-cols-2 gap-5">
                <FormField label="Check-in Time"><input className={inputCls} defaultValue="14:00" /></FormField>
                <FormField label="Check-out Time"><input className={inputCls} defaultValue="12:00" /></FormField>
                <FormField label="Children Policy"><select className={selectCls}><option>Children allowed</option><option>No children under 12</option><option>No children</option></select></FormField>
                <FormField label="Pet Policy"><select className={selectCls}><option>No pets allowed</option><option>Pets allowed (fee applies)</option><option>Pets allowed (free)</option></select></FormField>
                <FormField label="Extra Bed Policy"><select className={selectCls}><option>Available on request</option><option>Not available</option></select></FormField>
                <FormField label="Breakfast Policy"><select className={selectCls}><option>Breakfast included</option><option>Not included</option><option>Optional</option></select></FormField>
                <div className="col-span-2"><FormField label="Cancellation Policy"><textarea className={cx(inputCls, "resize-none h-20")} placeholder="Free cancellation up to 48 hours before check-in…" /></FormField></div>
              </div>
            </div>
          )}

          {addStep === 5 && (
            <div>
              <h2 className="text-[15px] font-bold text-[#0f172a] mb-1">Photos & Promotional Video</h2>
              <p className="text-[13px] text-[#64748b] mb-4">Upload high-quality images and a promotional video.</p>
              <p className="text-[12px] font-semibold text-[#334155] mb-2">Property Photos <span className="text-[#94a3b8] font-normal">(minimum 5 required)</span></p>
              <div className="grid grid-cols-5 gap-3 mb-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-[#f1f5f9] rounded-[10px] border border-dashed border-[#cbd5e1] flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors">
                    <Camera size={20} className="text-[#cbd5e1]" />
                  </div>
                ))}
              </div>
              <button className={cx(btnSecondary, "mb-6")}><Upload size={13} /> Upload Photos</button>
              <p className="text-[12px] font-semibold text-[#334155] mb-2">Promotional Video <span className="text-[#94a3b8] font-normal">(optional)</span></p>
              <div className="h-32 bg-[#f1f5f9] rounded-[10px] border border-dashed border-[#cbd5e1] flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors">
                <div className="text-center text-[#94a3b8]"><Video size={20} className="mx-auto mb-1" /><p className="text-[12px]">Upload video or paste a YouTube / Vimeo link</p></div>
              </div>
            </div>
          )}

          {addStep === 6 && (
            <div>
              <h2 className="text-[15px] font-bold text-[#0f172a] mb-4">Review & Submit</h2>
              <div className="flex flex-col gap-3 mb-6">
                {[
                  { label: "Basic Information", done: true },
                  { label: "Hotel Details", done: true },
                  { label: "Amenities", done: true },
                  { label: "Policies", done: true },
                  { label: "Photos & Video", done: false, note: "Only 2 photos uploaded — minimum 5 required" },
                ].map((item) => (
                  <div key={item.label} className={cx("flex items-center gap-3 p-3 rounded-[10px] border", item.done ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50")}>
                    {item.done
                      ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                      : <AlertTriangle size={16} className="text-amber-600 shrink-0" />}
                    <div>
                      <p className={cx("text-[13px] font-semibold", item.done ? "text-green-800" : "text-amber-800")}>{item.label}</p>
                      {item.note && <p className="text-[11px] text-amber-700 mt-0.5">{item.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-[10px]">
                <p className="text-[12px] font-semibold text-blue-800 mb-1">Ready to submit?</p>
                <p className="text-[11px] text-blue-700">Once submitted, the mTrip team will review your property within 1–2 business days. You can still edit your listing during review.</p>
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-[220px] right-0 bg-white border-t border-[#e2e8f0] px-7 py-3 flex items-center justify-between z-20">
          <div className="text-[12px] text-[#94a3b8]">Step {addStep} of {STEPS.length}</div>
          <div className="flex gap-2">
            {addStep > 1 && <button onClick={() => setAddStep((s) => s - 1)} className={btnSecondary}><ChevronLeft size={13} /> Previous</button>}
            {addStep < STEPS.length
              ? <button onClick={() => setAddStep((s) => s + 1)} className={btnPrimary}>Next <ArrowRight size={13} /></button>
              : <button className={btnPrimary}><CheckCircle2 size={13} /> Submit for Review</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── Hotel Configuration (Detail) ─────────────────────────────────────────────
  if (propertyDetailId && detail && subView === "overview") {
    const CONFIG_TABS = ["Hotel Information", "Amenities", "Policies", "Media", "Optional Services", "Status & Workflow"];

    return (
      <div>
        {/* Breadcrumb + header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={goToList} className={btnGhost}><ChevronLeft size={13} /> Hotel Properties</button>
          <ChevronRight size={13} className="text-[#cbd5e1]" />
          <span className="text-[14px] font-bold text-[#0f172a]">{detail.name}</span>
          <Badge label={statusBadgeLabel(detail.status)} variant={statusBadgeVariant(detail.status)} />
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-[#e2e8f0] mb-5 bg-white rounded-t-[10px]">
          {CONFIG_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setOverviewTab(tab)}
              className={cx(
                "px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap",
                overviewTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-[#64748b] hover:text-[#0f172a]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Hotel Information ── */}
        {overviewTab === "Hotel Information" && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6 mb-20">
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Hotel Name">
                <input className={inputCls} defaultValue={detail.name} />
              </FormField>
              <FormField label="Property Type">
                <select className={selectCls}>
                  <option>{detail.type}</option>
                  <option>Resort</option><option>Boutique Hotel</option><option>Business Hotel</option><option>Villa</option><option>Hostel</option>
                </select>
              </FormField>
              <div className="col-span-2">
                <FormField label="Description" hint="Max 500 characters. Displayed on your hotel listing page.">
                  <textarea className={cx(inputCls, "resize-none h-24")} defaultValue="A luxury beachfront resort offering panoramic ocean views, world-class dining, and personalised hospitality in the heart of Phuket." />
                </FormField>
              </div>
              <FormField label="Star Rating">
                <div className="flex gap-1.5 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button">
                      <Star size={22} className={s <= detail.stars ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-100"} />
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="Phone Number">
                <input className={inputCls} defaultValue="+66 76 000 111" />
              </FormField>
              <FormField label="Address">
                <input className={inputCls} defaultValue="123 Sunset Road, Patong Beach" />
              </FormField>
              <FormField label="Location / City">
                <input className={inputCls} defaultValue={detail.location} />
              </FormField>
              <FormField label="Email Address">
                <input className={inputCls} defaultValue="info@horizonresort.com" />
              </FormField>
              <FormField label="Website">
                <input className={inputCls} defaultValue="https://horizonresort.com" />
              </FormField>
              <div className="col-span-2">
                <FormField label="Google Map Location" hint="Enter coordinates or search for your property location.">
                  <div className="flex gap-2 mb-2">
                    <input className={inputCls} placeholder="e.g. 7.9519° N, 98.3381° E" />
                    <button className={btnSecondary}><MapPin size={13} /> Pin on Map</button>
                  </div>
                  <div className="h-44 bg-[#f1f5f9] rounded-[10px] border border-dashed border-[#cbd5e1] flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors">
                    <div className="text-center text-[#94a3b8]">
                      <MapPin size={20} className="mx-auto mb-2 text-blue-400" />
                      <p className="text-[12px] font-medium text-[#64748b]">Map preview — {detail.location}</p>
                      <p className="text-[11px] text-[#94a3b8] mt-0.5">Click to reposition the pin</p>
                    </div>
                  </div>
                </FormField>
              </div>
            </div>
          </div>
        )}

        {/* ── Amenities ── */}
        {overviewTab === "Amenities" && (
          <div className="flex flex-col gap-5 mb-20">
            {/* Hotel Facilities */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
              <p className="text-[13px] font-bold text-[#0f172a] mb-1">Hotel Facilities</p>
              <p className="text-[12px] text-[#64748b] mb-4">Facilities available at the property level.</p>
              <div className="grid grid-cols-4 gap-3">
                {([ ["Swimming Pool", Waves, true], ["Fitness Center", Dumbbell, true], ["Restaurant", Utensils, true], ["Parking", Car, false], ["Business Center", Building2, false], ["Spa & Wellness", Waves, true], ["Conference Room", Users, false], ["Concierge", Bell, true] ] as [string, React.ElementType, boolean][]).map(([name, Icon, on]) => (
                  <div key={name} className={cx("flex flex-col items-center gap-2 p-4 rounded-[10px] border cursor-pointer transition-all select-none", on ? "border-blue-300 bg-blue-50" : "border-[#e2e8f0] bg-white")}>
                    <Icon size={20} className={on ? "text-blue-600" : "text-[#94a3b8]"} />
                    <span className="text-[11.5px] font-medium text-[#334155] text-center leading-tight">{name}</span>
                    <Toggle on={on} onChange={() => {}} />
                  </div>
                ))}
              </div>
            </div>

            {/* Property Amenities */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
              <p className="text-[13px] font-bold text-[#0f172a] mb-1">Property Amenities</p>
              <p className="text-[12px] text-[#64748b] mb-4">Shared amenities accessible to all guests.</p>
              <div className="grid grid-cols-4 gap-3">
                {([ ["Free WiFi", Wifi, true], ["Breakfast Included", Coffee, true], ["Airport Shuttle", Car, false], ["24-hr Front Desk", Clock, true], ["Luggage Storage", Package, true], ["Safety Deposit Box", Shield, false], ["Laundry Service", RefreshCw, true], ["Garden / Terrace", Waves, false] ] as [string, React.ElementType, boolean][]).map(([name, Icon, on]) => (
                  <div key={name} className={cx("flex flex-col items-center gap-2 p-4 rounded-[10px] border cursor-pointer transition-all select-none", on ? "border-blue-300 bg-blue-50" : "border-[#e2e8f0] bg-white")}>
                    <Icon size={20} className={on ? "text-blue-600" : "text-[#94a3b8]"} />
                    <span className="text-[11.5px] font-medium text-[#334155] text-center leading-tight">{name}</span>
                    <Toggle on={on} onChange={() => {}} />
                  </div>
                ))}
              </div>
            </div>

            {/* Room Amenities */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
              <p className="text-[13px] font-bold text-[#0f172a] mb-1">Room Amenities</p>
              <p className="text-[12px] text-[#64748b] mb-4">In-room amenities provided as standard across all room types.</p>
              <div className="grid grid-cols-4 gap-3">
                {([ ["Air Conditioning", Zap, true], ["Flat-screen TV", Activity, true], ["In-room Safe", Shield, true], ["Minibar", Coffee, true], ["Bathrobe & Slippers", Star, false], ["Hair Dryer", Zap, true], ["Tea & Coffee Maker", Coffee, true], ["Blackout Curtains", Home, false] ] as [string, React.ElementType, boolean][]).map(([name, Icon, on]) => (
                  <div key={name} className={cx("flex flex-col items-center gap-2 p-4 rounded-[10px] border cursor-pointer transition-all select-none", on ? "border-blue-300 bg-blue-50" : "border-[#e2e8f0] bg-white")}>
                    <Icon size={20} className={on ? "text-blue-600" : "text-[#94a3b8]"} />
                    <span className="text-[11.5px] font-medium text-[#334155] text-center leading-tight">{name}</span>
                    <Toggle on={on} onChange={() => {}} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Policies ── */}
        {overviewTab === "Policies" && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6 mb-20">
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Check-in Time" hint="Earliest time guests may check in.">
                <input className={inputCls} defaultValue="14:00" type="time" />
              </FormField>
              <FormField label="Check-out Time" hint="Latest time guests must check out.">
                <input className={inputCls} defaultValue="12:00" type="time" />
              </FormField>
              <FormField label="Child Policy">
                <select className={selectCls}>
                  <option>Children of all ages are welcome</option>
                  <option>Children aged 12 and above only</option>
                  <option>No children allowed</option>
                </select>
              </FormField>
              <FormField label="Pet Policy">
                <select className={selectCls}>
                  <option>No pets allowed</option>
                  <option>Pets allowed (surcharge applies)</option>
                  <option>Pets allowed (no charge)</option>
                </select>
              </FormField>
              <FormField label="Smoking Policy">
                <select className={selectCls}>
                  <option>No smoking throughout the property</option>
                  <option>Smoking permitted in designated areas</option>
                  <option>Smoking rooms available on request</option>
                </select>
              </FormField>
              <FormField label="Extra Bed Policy">
                <select className={selectCls}>
                  <option>Available on request (surcharge applies)</option>
                  <option>Available on request (no charge)</option>
                  <option>Not available</option>
                </select>
              </FormField>
              <div className="col-span-2">
                <FormField label="Cancellation Policy" hint="Displayed to guests at checkout and in booking confirmation emails.">
                  <textarea className={cx(inputCls, "resize-none h-24")} defaultValue="Free cancellation up to 48 hours before check-in date. Cancellations made within 48 hours will be charged 1 night's accommodation. No-shows will be charged the full booking amount." />
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label="Additional House Rules" hint="Any other rules guests must follow during their stay.">
                  <textarea className={cx(inputCls, "resize-none h-20")} placeholder="e.g. Quiet hours from 22:00–08:00. No parties or events permitted." />
                </FormField>
              </div>
            </div>
          </div>
        )}

        {/* ── Media ── */}
        {overviewTab === "Media" && (
          <div className="flex flex-col gap-5 mb-20">
            {/* Hotel Photos */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[13px] font-bold text-[#0f172a]">Hotel Photos</p>
                  <p className="text-[12px] text-[#64748b] mt-0.5">Minimum 5 photos required. Drag to reorder. First photo is used as the cover image.</p>
                </div>
                <button className={btnPrimary}><Upload size={13} /> Upload Photos</button>
              </div>
              <div className="grid grid-cols-5 gap-3 mb-3">
                {/* 2 "uploaded" mock photos + 8 empty slots */}
                {[
                  { filled: true, label: "Cover Photo", badge: "Cover" },
                  { filled: true, label: "Pool Area", badge: null },
                  ...Array.from({ length: 8 }).map(() => ({ filled: false, label: "", badge: null })),
                ].map((slot, i) => (
                  <div
                    key={i}
                    className={cx(
                      "aspect-square rounded-[10px] border relative flex items-center justify-center cursor-pointer transition-colors group",
                      slot.filled ? "border-[#e2e8f0] bg-gradient-to-br from-blue-100 to-indigo-100" : "border-dashed border-[#cbd5e1] bg-[#f8fafc] hover:border-blue-300"
                    )}
                  >
                    {slot.filled ? (
                      <>
                        {slot.badge && (
                          <span className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{slot.badge}</span>
                        )}
                        <Building2 size={22} className="text-blue-400" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-[10px] transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <button className="bg-white rounded-full p-1 shadow"><Edit2 size={10} className="text-[#334155]" /></button>
                          <button className="bg-white rounded-full p-1 shadow"><Archive size={10} className="text-red-500" /></button>
                        </div>
                      </>
                    ) : (
                      <Camera size={18} className="text-[#cbd5e1]" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#94a3b8]">Accepted formats: JPG, PNG, WEBP · Max 10 MB per file · Recommended size: 1920×1080px</p>
            </div>

            {/* Promotional Video */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
              <p className="text-[13px] font-bold text-[#0f172a] mb-1">Promotional Video</p>
              <p className="text-[12px] text-[#64748b] mb-4">Add a short video (up to 3 minutes) to showcase your property.</p>
              <div className="h-40 bg-[#f1f5f9] rounded-[10px] border border-dashed border-[#cbd5e1] flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors mb-3">
                <div className="text-center text-[#94a3b8]">
                  <Video size={24} className="mx-auto mb-2" />
                  <p className="text-[12px] font-medium">Upload a video or paste a YouTube / Vimeo link</p>
                  <p className="text-[11px] mt-0.5">MP4, MOV · Max 500 MB</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className={btnSecondary}><Upload size={13} /> Upload Video</button>
                <div className="flex-1">
                  <input className={inputCls} placeholder="Or paste YouTube / Vimeo URL…" />
                </div>
              </div>
            </div>

            {/* Image Gallery Order */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
              <p className="text-[13px] font-bold text-[#0f172a] mb-1">Image Gallery Order</p>
              <p className="text-[12px] text-[#64748b] mb-4">Drag and drop photos to reorder how they appear on your listing.</p>
              <div className="flex flex-col gap-2">
                {["Cover Photo — Lobby Entrance", "Pool & Outdoor Area", "Deluxe Room Interior"].map((label, i) => (
                  <div key={label} className="flex items-center gap-3 px-3 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-[8px] cursor-grab">
                    <List size={13} className="text-[#94a3b8] shrink-0" />
                    <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shrink-0">
                      <Building2 size={12} className="text-blue-400" />
                    </div>
                    <span className="text-[12.5px] text-[#334155] flex-1">{label}</span>
                    <span className="text-[10px] text-[#94a3b8] font-medium">#{i + 1}</span>
                    <button className="text-[#94a3b8] hover:text-red-500 transition-colors"><X size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Optional Services ── */}
        {overviewTab === "Optional Services" && (
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6 mb-20">
            <p className="text-[12px] text-[#64748b] mb-5">Enable paid or complimentary add-on services for guests to book alongside their stay.</p>
            <div className="flex flex-col gap-3">
              {[
                { name: "Airport Transfer",  sub: "Pick-up and drop-off between airport and hotel",           on: false, price: "THB 800/trip"   },
                { name: "Breakfast",         sub: "Daily breakfast included or available as add-on",           on: true,  price: "THB 350/person" },
                { name: "Parking",           sub: "On-site vehicle parking for hotel guests",                  on: false, price: "THB 200/night"  },
                { name: "Spa & Wellness",    sub: "In-house spa treatments and wellness packages",              on: true,  price: "From THB 1,200" },
                { name: "Laundry Service",   sub: "Same-day laundry and dry-cleaning service",                 on: true,  price: "THB 180/kg"     },
                { name: "Extra Bed",         sub: "Rollaway bed for additional guest in existing room",        on: false, price: "THB 500/night"  },
                { name: "Room Service",      sub: "24-hour in-room dining available to guests",                on: true,  price: "Menu pricing"   },
                { name: "Late Check-out",    sub: "Allow guests to check out after the standard time",         on: false, price: "THB 500/hour"   },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-[10px] hover:bg-[#f8fafc] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cx("w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0", s.on ? "bg-blue-50" : "bg-[#f1f5f9]")}>
                      <Package size={15} className={s.on ? "text-blue-600" : "text-[#94a3b8]"} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0f172a]">{s.name}</p>
                      <p className="text-[11px] text-[#94a3b8] mt-0.5">{s.sub}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[12px] font-medium text-[#64748b]">{s.price}</span>
                    <Toggle on={s.on} onChange={() => {}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Room Types ── */}
        {/* ── Status & Workflow ── */}
        {overviewTab === "Status & Workflow" && (
          <div className="flex flex-col gap-5 mb-20">

            {/* ─ Section 1: Property Status ─ */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Section 1 — Property Status</p>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[15px] font-bold text-[#0f172a]">Published & Live</p>
                    <Badge label="Published" variant="green" />
                  </div>
                  <p className="text-[12.5px] text-[#64748b]">
                    This hotel is currently published and visible to customers on the mTrip platform.
                    The property status will not change when individual sections are submitted for update review.
                  </p>
                </div>
              </div>
            </div>

            {/* ─ Section 2: Latest Update Status ─ */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-4">Section 2 — Latest Update Status</p>

              {/* Update timeline */}
              <div className="flex items-start gap-3 mb-5">
                {(["Draft Changes", "Submitted", "Pending Approval", "Approved"] as const).map((step, i, arr) => (
                  <div key={step} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      <div className={cx(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mb-1",
                        i < 2 ? "bg-blue-600 text-white" :
                        i === 2 ? "bg-amber-500 text-white ring-4 ring-amber-100" :
                        "bg-[#f1f5f9] text-[#94a3b8]"
                      )}>
                        {i < 2 ? <Check size={12} /> : i + 1}
                      </div>
                      <span className={cx(
                        "text-[10px] font-medium text-center leading-tight whitespace-nowrap",
                        i < 2 ? "text-blue-700" : i === 2 ? "text-amber-700" : "text-[#94a3b8]"
                      )}>{step}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className={cx("h-0.5 w-full mx-1 mt-[-18px]", i < 2 ? "bg-blue-400" : "bg-[#e2e8f0]")} />
                    )}
                  </div>
                ))}
              </div>

              {/* Pending state card */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-[10px]">
                <div className="flex items-start gap-3">
                  <Clock size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[12.5px] font-semibold text-amber-900">Pending Super Admin Approval</p>
                      <Badge label="Pending Approval" variant="yellow" />
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] mb-2">
                      <div><span className="text-amber-700 font-medium">Submitted on:</span> <span className="text-amber-800">23 Jul 2026, 14:30</span></div>
                      <div><span className="text-amber-700 font-medium">Submitted by:</span> <span className="text-amber-800">Hotel Owner</span></div>
                      <div><span className="text-amber-700 font-medium">Sections updated:</span> <span className="text-amber-800">Hotel Information, Media</span></div>
                      <div><span className="text-amber-700 font-medium">Est. review time:</span> <span className="text-amber-800">1–2 business days</span></div>
                    </div>
                    <p className="text-[11.5px] text-amber-700">
                      Your recent changes have been submitted for review. Your current published hotel information
                      remains visible to customers until the new changes are approved.
                    </p>
                  </div>
                </div>
              </div>

              {/* What happens next */}
              <div className="mt-4 border-t border-[#f1f5f9] pt-4">
                <p className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-2">What happens next?</p>
                <div className="flex flex-col gap-2">
                  {[
                    { icon: CheckCircle2, color: "text-blue-500", text: "Super Admin reviews your submitted changes within 1–2 business days." },
                    { icon: CheckCircle2, color: "text-blue-500", text: "If approved, changes go live immediately. Your hotel listing is updated automatically." },
                    { icon: AlertTriangle, color: "text-amber-500", text: "If rejected, you will receive feedback with the rejection reason and can resubmit after corrections." },
                    { icon: Info, color: "text-slate-400",  text: "Your published hotel remains fully live and bookable throughout the entire review process." },
                  ].map(({ icon: Icon, color, text }, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-[#475569]">
                      <Icon size={13} className={cx(color, "shrink-0 mt-0.5")} />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─ Update History ─ */}
            <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
                <div>
                  <p className="text-[13.5px] font-bold text-[#0f172a]">Update History</p>
                  <p className="text-[12px] text-[#94a3b8] mt-0.5">All change submissions and their approval outcomes for this property.</p>
                </div>
                <button className={btnSecondary}><Download size={13} /> Export</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                      {["Date", "Updated Module", "Submitted By", "Review Status", "Reviewed By", "Review Date", "Remarks"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        date: "23 Jul 2026",
                        module: "Hotel Information, Media",
                        by: "Hotel Owner",
                        reviewStatus: "pending",
                        reviewedBy: "—",
                        reviewDate: "—",
                        remarks: "Awaiting Super Admin review",
                      },
                      {
                        date: "18 Jul 2026",
                        module: "Amenities",
                        by: "Hotel Owner",
                        reviewStatus: "approved",
                        reviewedBy: "Admin Sarah",
                        reviewDate: "19 Jul 2026",
                        remarks: "All changes approved",
                      },
                      {
                        date: "10 Jul 2026",
                        module: "Policies",
                        by: "Hotel Owner",
                        reviewStatus: "rejected",
                        reviewedBy: "Admin James",
                        reviewDate: "11 Jul 2026",
                        remarks: "Cancellation policy wording must comply with platform standards",
                      },
                      {
                        date: "02 Jul 2026",
                        module: "Room Types",
                        by: "Hotel Owner",
                        reviewStatus: "approved",
                        reviewedBy: "Admin Sarah",
                        reviewDate: "03 Jul 2026",
                        remarks: "New room type added successfully",
                      },
                      {
                        date: "15 Jun 2026",
                        module: "Hotel Information",
                        by: "Hotel Owner",
                        reviewStatus: "approved",
                        reviewedBy: "Admin James",
                        reviewDate: "16 Jun 2026",
                        remarks: "Initial hotel approval — property published",
                      },
                    ].map((row, i) => {
                      const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
                        pending:  { label: "Pending Approval", variant: "yellow" },
                        approved: { label: "Approved",         variant: "green"  },
                        rejected: { label: "Rejected",         variant: "red"    },
                      };
                      const s = statusMap[row.reviewStatus];
                      return (
                        <tr key={i} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#f8fafc] transition-colors">
                          <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap">{row.date}</td>
                          <td className="px-4 py-3 text-[#334155] font-medium">{row.module}</td>
                          <td className="px-4 py-3 text-[#64748b]">{row.by}</td>
                          <td className="px-4 py-3"><Badge label={s.label} variant={s.variant} /></td>
                          <td className="px-4 py-3 text-[#64748b]">{row.reviewedBy}</td>
                          <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap">{row.reviewDate}</td>
                          <td className="px-4 py-3 text-[#64748b] max-w-[220px]">
                            {row.reviewStatus === "rejected"
                              ? <span className="text-red-600">{row.remarks}</span>
                              : row.remarks}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-[220px] right-0 bg-white border-t border-[#e2e8f0] px-7 py-3 flex items-center justify-between z-20">
          <span className="text-[12px] text-[#94a3b8]">Last saved: 23 Jul 2026, 14:30</span>
          <div className="flex gap-2">
            <button className={btnSecondary}>Save Draft</button>
            <button className={btnSecondary}><Eye size={13} /> Preview</button>
            <button className={btnPrimary}><ArrowRight size={13} /> Submit Changes for Review</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Hotel Edit ────────────────────────────────────────────────────────────────
  if (propertyDetailId && detail && subView === "edit") {
    const EDIT_TABS = ["Hotel Information", "Amenities", "Policies", "Media", "Optional Services", "Status & Workflow"];
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setSubView("overview")} className={btnGhost}><ChevronLeft size={13} /> {detail.name}</button>
          <ChevronRight size={13} className="text-[#cbd5e1]" />
          <span className="text-[14px] font-bold text-[#0f172a]">Edit Hotel</span>
          <Badge label={statusBadgeLabel(detail.status)} variant={statusBadgeVariant(detail.status)} />
        </div>

        <div className="flex gap-0 border-b border-[#e2e8f0] mb-5 bg-white rounded-t-[10px]">
          {EDIT_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setPropTab(tab)}
              className={cx(
                "px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors",
                propTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-[#64748b] hover:text-[#0f172a]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6 mb-20">
          {propTab === "Hotel Information" && (
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Hotel Name"><input className={inputCls} defaultValue={detail.name} /></FormField>
              <FormField label="Property Type"><select className={selectCls}><option>{detail.type}</option></select></FormField>
              <FormField label="Description" hint="Max 500 characters">
                <textarea className={cx(inputCls, "resize-none h-20")} defaultValue="Luxury beachfront resort with panoramic ocean views." />
              </FormField>
              <FormField label="Star Rating">
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={20} className={s <= detail.stars ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-100"} />
                  ))}
                </div>
              </FormField>
              <FormField label="Address"><input className={inputCls} defaultValue="123 Sunset Road, Patong Beach" /></FormField>
              <FormField label="Location"><input className={inputCls} defaultValue={detail.location} /></FormField>
              <FormField label="Phone"><input className={inputCls} defaultValue="+66 76 000 111" /></FormField>
              <FormField label="Email"><input className={inputCls} defaultValue="info@horizonresort.com" /></FormField>
              <FormField label="Website"><input className={inputCls} defaultValue="https://horizonresort.com" /></FormField>
              <div className="col-span-2 h-40 bg-[#f1f5f9] rounded-[10px] flex items-center justify-center border border-dashed border-[#cbd5e1]">
                <div className="text-center text-[#94a3b8]"><MapPin size={20} className="mx-auto mb-1" /><p className="text-[12px]">Map placeholder — location pin at {detail.location}</p></div>
              </div>
            </div>
          )}

          {propTab === "Amenities" && (
            <div>
              <p className="text-[13px] text-[#64748b] mb-4">Enable the amenities available at this property.</p>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(amenities).map(([name, on]) => {
                  const Icon = AMENITY_ICONS[name] || CheckCircle2;
                  return (
                    <div
                      key={name}
                      className={cx("flex flex-col items-center gap-2 p-4 rounded-[10px] border cursor-pointer transition-all", on ? "border-blue-300 bg-blue-50" : "border-[#e2e8f0] bg-white")}
                      onClick={() => setAmenities((a) => ({ ...a, [name]: !a[name] }))}
                    >
                      <Icon size={20} className={on ? "text-blue-600" : "text-[#94a3b8]"} />
                      <span className="text-[12px] font-medium text-[#334155]">{name}</span>
                      <Toggle on={on} onChange={() => setAmenities((a) => ({ ...a, [name]: !a[name] }))} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {propTab === "Policies" && (
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Check-in Time"><input className={inputCls} defaultValue="14:00" /></FormField>
              <FormField label="Check-out Time"><input className={inputCls} defaultValue="12:00" /></FormField>
              <FormField label="Children Policy"><select className={selectCls}><option>Children allowed</option></select></FormField>
              <FormField label="Pet Policy"><select className={selectCls}><option>No pets allowed</option></select></FormField>
              <FormField label="Extra Bed Policy"><select className={selectCls}><option>Available on request</option></select></FormField>
              <FormField label="Breakfast Policy"><select className={selectCls}><option>Breakfast included</option></select></FormField>
              <div className="col-span-2">
                <FormField label="Cancellation Policy">
                  <textarea className={cx(inputCls, "resize-none h-20")} defaultValue="Free cancellation up to 48 hours before check-in. 1-night charge for late cancellations." />
                </FormField>
              </div>
            </div>
          )}

          {propTab === "Media" && (
            <div>
              <p className="text-[13px] text-[#64748b] mb-4">Upload photos and videos for this property.</p>
              <div className="grid grid-cols-5 gap-3 mb-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-[#f1f5f9] rounded-[10px] border border-dashed border-[#cbd5e1] flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors">
                    <Camera size={20} className="text-[#cbd5e1]" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button className={btnSecondary}><Upload size={13} /> Upload Photos</button>
                <button className={btnSecondary}><Video size={13} /> Upload Video</button>
              </div>
            </div>
          )}

          {propTab === "Optional Services" && (
            <div className="flex flex-col gap-4">
              {Object.entries(optServices).map(([name, on]) => (
                <div key={name} className="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-[10px]">
                  <div>
                    <p className="text-[13px] font-semibold text-[#0f172a]">{name}</p>
                    <p className="text-[11px] text-[#94a3b8] mt-0.5">Enable to offer this service to guests</p>
                  </div>
                  <Toggle on={on} onChange={() => setOptServices((s) => ({ ...s, [name]: !s[name] }))} />
                </div>
              ))}
            </div>
          )}

          {propTab === "Status & Workflow" && (
            <div>
              <div className="flex gap-0 mb-6 items-center">
                {["Draft", "Submitted", "Under Review", "Published"].map((step, i, arr) => (
                  <div key={step} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={cx("w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold",
                        step === "Under Review" ? "bg-amber-500 text-white" : i < 2 ? "bg-blue-600 text-white" : "bg-[#e2e8f0] text-[#94a3b8]")}>
                        {i < 2 ? <Check size={14} /> : i + 1}
                      </div>
                      <span className="text-[10px] text-[#64748b] mt-1 whitespace-nowrap">{step}</span>
                    </div>
                    {i < arr.length - 1 && <div className={cx("h-0.5 w-12 mx-1 mb-4", i < 2 ? "bg-blue-400" : "bg-[#e2e8f0]")} />}
                  </div>
                ))}
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-[10px] mb-4">
                <p className="text-[12px] font-semibold text-amber-800 mb-1">Currently Under Review</p>
                <p className="text-[11px] text-amber-700">Your property is being reviewed by the mTrip team. Expected completion: 1–2 business days.</p>
              </div>
              <p className="text-[12px] font-semibold text-[#334155] mb-2">Review History</p>
              <div className="flex flex-col gap-2">
                {[{ d: "23 Jul 2026", e: "Submitted for review by Hotel Owner" }, { d: "20 Jul 2026", e: "Draft saved" }].map((ev) => (
                  <div key={ev.d} className="flex gap-3 text-[12px]">
                    <span className="text-[#94a3b8] w-24 shrink-0">{ev.d}</span>
                    <span className="text-[#334155]">{ev.e}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-[220px] right-0 bg-white border-t border-[#e2e8f0] px-7 py-3 flex items-center justify-between z-20">
          <span className="text-[12px] text-[#94a3b8]">Last saved: 23 Jul 2026, 14:30</span>
          <div className="flex gap-2">
            <button className={btnSecondary}>Save Draft</button>
            <button className={btnSecondary}><Eye size={13} /> Preview</button>
            <button className={btnPrimary}><ArrowRight size={13} /> Submit for Review</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Property List ─────────────────────────────────────────────────────────────
  const filtered = HOTELS.filter((h) => h.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div onClick={() => setMoreOpen(null)}>
      <PageHeader
        title="Hotel Properties"
        subtitle="Manage your hotel portfolio on mTrip"
        action={
          <button onClick={() => { setSubView("add"); setAddStep(1); }} className={btnPrimary}>
            <Plus size={14} /> Add New Hotel
          </button>
        }
      />
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input className={cx(inputCls, "pl-8")} placeholder="Search hotels..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-white cursor-pointer">
          <option>All Status</option><option>Published</option><option>Under Review</option><option>Draft</option>
        </select>
        <select className="px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-white cursor-pointer">
          <option>All Locations</option><option>Phuket</option><option>Koh Samui</option><option>Bangkok</option>
        </select>
      </div>

      <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#f8fafc] text-[#64748b] font-semibold uppercase text-[10px] tracking-wide">
              {["", "Hotel Name", "Location", "Type", "Rooms", "Status", "PMS", "CM", "Last Updated", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr
                key={h.id}
                className="border-t border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer transition-colors"
                onClick={() => openOverview(h.id)}
              >
                <td className="px-4 py-3">
                  <div className="w-10 h-10 rounded-[8px] bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <Building2 size={14} className="text-blue-600" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-[#0f172a]">{h.name}</div>
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: h.stars }).map((_, i) => <Star key={i} size={10} className="text-amber-400 fill-amber-400" />)}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#64748b]"><div className="flex items-center gap-1"><MapPin size={11} />{h.location}</div></td>
                <td className="px-4 py-3 text-[#64748b]">{h.type}</td>
                <td className="px-4 py-3 text-[#334155] font-medium">{h.rooms} types</td>
                <td className="px-4 py-3">
                  <Badge label={statusBadgeLabel(h.status)} variant={statusBadgeVariant(h.status)} />
                </td>
                <td className="px-4 py-3">
                  {h.pms
                    ? <span className="flex items-center gap-1 text-green-700 text-[11px]"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Connected</span>
                    : <span className="text-[#94a3b8]">—</span>}
                </td>
                <td className="px-4 py-3">
                  {h.cm
                    ? <span className="flex items-center gap-1 text-green-700 text-[11px]"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Connected</span>
                    : <span className="text-[#94a3b8]">—</span>}
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">{h.updated}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 items-center">
                    <button className={btnGhost} title="View" onClick={() => openOverview(h.id)}><Eye size={11} /></button>
                    <button className={btnGhost} title="Edit" onClick={() => openEdit(h.id)}><Edit2 size={11} /></button>
                    <div className="relative">
                      <button className={btnGhost} title="More" onClick={(e) => { e.stopPropagation(); setMoreOpen(moreOpen === h.id ? null : h.id); }}>
                        <MoreHorizontal size={11} />
                      </button>
                      {moreOpen === h.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg py-1 z-30 min-w-[190px]">
                          {[
                            { label: "Manage Rooms",          tab: "Room Types" },
                            { label: "Availability & Pricing", tab: "Availability & Pricing" },
                            { label: "Booking Management",    tab: "Booking Management" },
                            { label: "Reviews",               tab: "Reviews" },
                            { label: "Promotions",            tab: "Promotions" },
                          ].map(({ label, tab }) => (
                            <button
                              key={label}
                              className="w-full text-left px-4 py-2 text-[12.5px] text-[#334155] hover:bg-[#f8fafc] transition-colors"
                              onClick={() => openOverview(h.id, tab)}
                            >
                              {label}
                            </button>
                          ))}
                          <div className="border-t border-[#f1f5f9] my-1" />
                          <button className="w-full text-left px-4 py-2 text-[12.5px] text-red-600 hover:bg-red-50 transition-colors">
                            Archive Hotel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Screen 3: Room Types ─────────────────────────────────────────────────────

function RoomsScreen() {
  const [view, setView] = useState<"list" | "create">("list");
  const [editRoom, setEditRoom] = useState<typeof ROOM_TYPES[0] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedHotel, setSelectedHotel] = useState("The Horizon Resort");

  // Create form state
  const [facilities, setFacilities] = useState<string[]>(["WiFi", "Air Conditioning", "TV"]);
  const [smoking, setSmoking] = useState(false);
  const [photos, setPhotos] = useState<number[]>([]);
  const [hasVideo, setHasVideo] = useState(false);

  const HOTEL_OPTIONS = ["The Horizon Resort", "Blue Lagoon Boutique", "Cityview Business Hotel"];
  const ALL_FACILITIES = ["WiFi", "Air Conditioning", "TV", "Mini Bar", "Safe", "Balcony", "Bathtub", "Kitchenette", "Pool Access", "Coffee Machine", "Hair Dryer", "Blackout Curtains"];
  const BED_TYPES = ["1 King Bed", "1 Queen Bed", "2 Single Beds", "1 King + Sofa Bed", "2 Double Beds", "Bunk Beds"];
  const MEAL_PLANS = ["Room Only", "Breakfast Included", "Half Board", "Full Board", "All Inclusive"];
  const CANCELLATION_POLICIES = ["Free cancellation up to 48 hours before check-in", "Non-refundable", "Free cancellation up to 7 days before check-in", "Flexible — cancel anytime"];

  const FAC_ICONS: Record<string, React.ElementType> = {
    WiFi: Wifi, AC: Zap, TV: Activity, Safe: Shield, Minibar: Coffee, Bathtub: Waves, "Private Pool": Waves, Kitchenette: Utensils,
  };

  const toggleFacility = (f: string) =>
    setFacilities((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  // ── Create Room Type page ──────────────────────────────────────────────────
  if (view === "create") {
    const WORKFLOW_STEPS = [
      { key: "draft", label: "Draft", desc: "Room type is being configured. Not visible to customers." },
      { key: "review", label: "Pending Super Admin Review", desc: "Submitted for approval. Awaiting Super Admin sign-off." },
      { key: "published", label: "Published", desc: "Approved and visible to customers on the platform." },
    ];

    return (
      <div>
        {/* Hotel context banner */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f1f5f9] rounded-[8px] border border-[#e2e8f0]">
            <Building2 size={13} className="text-[#64748b]" />
            <span className="text-[12px] text-[#64748b]">Hotel:</span>
            <span className="text-[12px] font-semibold text-[#0f172a]">{selectedHotel}</span>
          </div>
        </div>

        {/* Breadcrumb + title */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView("list")} className={btnGhost}><ChevronLeft size={13} /> Room Types</button>
          <ChevronRight size={13} className="text-[#cbd5e1]" />
          <span className="text-[14px] font-bold text-[#0f172a]">Create Room Type</span>
        </div>
        <div className="mb-5">
          <h1 className="text-[20px] font-bold text-[#0f172a]" style={{ letterSpacing: "-0.025em" }}>Create Room Type</h1>
          <p className="text-[13px] text-[#64748b] mt-0.5">Configure a new room type for <span className="font-semibold text-[#334155]">{selectedHotel}</span>. Changes require Super Admin approval before becoming visible to customers.</p>
        </div>

        <div className="flex flex-col gap-5 mb-24">

          {/* Room Information */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
            <p className="text-[13px] font-bold text-[#0f172a] mb-4">Room Information</p>
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Room Type Name *">
                <input className={inputCls} placeholder="e.g. Deluxe Ocean View Room" />
              </FormField>
              <FormField label="Room Code" hint="Internal reference code (optional)">
                <input className={inputCls} placeholder="e.g. DLX-OV-01" />
              </FormField>
              <div className="col-span-2">
                <FormField label="Room Description" hint="Displayed on the hotel listing. Max 400 characters.">
                  <textarea className={cx(inputCls, "resize-none h-24")} placeholder="A spacious room featuring panoramic ocean views, modern furnishings, and premium amenities…" />
                </FormField>
              </div>
            </div>
          </div>

          {/* Capacity */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
            <p className="text-[13px] font-bold text-[#0f172a] mb-4">Capacity</p>
            <div className="grid grid-cols-3 gap-5">
              <FormField label="Maximum Adults *">
                <input className={inputCls} type="number" min="1" defaultValue="2" />
              </FormField>
              <FormField label="Maximum Children">
                <input className={inputCls} type="number" min="0" defaultValue="1" />
              </FormField>
              <FormField label="Maximum Guests" hint="Adults + children combined">
                <input className={inputCls} type="number" min="1" defaultValue="3" />
              </FormField>
            </div>
          </div>

          {/* Room Configuration */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
            <p className="text-[13px] font-bold text-[#0f172a] mb-4">Room Configuration</p>
            <div className="grid grid-cols-3 gap-5">
              <FormField label="Bed Type *">
                <select className={selectCls}>
                  <option value="">Select bed type…</option>
                  {BED_TYPES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </FormField>
              <FormField label="Number of Beds">
                <input className={inputCls} type="number" min="1" defaultValue="1" />
              </FormField>
              <FormField label="Room Size (sqm) *">
                <input className={inputCls} type="number" placeholder="e.g. 38" />
              </FormField>
              <FormField label="Floor" hint="Optional — which floor this room type is on">
                <input className={inputCls} placeholder="e.g. 4–8" />
              </FormField>
              <FormField label="Room View">
                <select className={selectCls}>
                  <option value="">Select view…</option>
                  <option>Ocean View</option>
                  <option>City View</option>
                  <option>Garden View</option>
                  <option>Pool View</option>
                  <option>Mountain View</option>
                  <option>No Specific View</option>
                </select>
              </FormField>
              <FormField label="Smoking">
                <div className="flex items-center gap-4 mt-1.5">
                  {[{ val: false, label: "No Smoking" }, { val: true, label: "Smoking Allowed" }].map(({ val, label }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer">
                      <div
                        className={cx("w-4 h-4 rounded-full border-2 flex items-center justify-center", smoking === val ? "border-blue-600" : "border-[#cbd5e1]")}
                        onClick={() => setSmoking(val)}
                      >
                        {smoking === val && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <span className="text-[12.5px] text-[#334155]">{label}</span>
                    </label>
                  ))}
                </div>
              </FormField>
            </div>
          </div>

          {/* Facilities */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
            <p className="text-[13px] font-bold text-[#0f172a] mb-1">Facilities</p>
            <p className="text-[12px] text-[#64748b] mb-4">Select all facilities available in this room type.</p>
            <div className="flex flex-wrap gap-2">
              {ALL_FACILITIES.map((f) => {
                const selected = facilities.includes(f);
                return (
                  <button
                    key={f}
                    onClick={() => toggleFacility(f)}
                    className={cx(
                      "px-3 py-1.5 text-[12.5px] font-medium rounded-full border transition-all",
                      selected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-blue-300 hover:text-blue-600"
                    )}
                  >
                    {selected && <Check size={11} className="inline mr-1" />}{f}
                  </button>
                );
              })}
            </div>
            {facilities.length > 0 && (
              <p className="text-[11px] text-[#94a3b8] mt-3">{facilities.length} facilit{facilities.length === 1 ? "y" : "ies"} selected</p>
            )}
          </div>

          {/* Media */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
            <p className="text-[13px] font-bold text-[#0f172a] mb-1">Media</p>
            <p className="text-[12px] text-[#64748b] mb-5">Upload photos and an optional room video. The first photo is automatically set as the Cover Photo. Click any slot to toggle it; hover to remove.</p>

            {/* Photos subsection */}
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Room Photos</p>
            <div className="grid grid-cols-5 gap-3 mb-3">
              {Array.from({ length: 10 }).map((_, i) => {
                const isAdded = photos.includes(i);
                const isCover = isAdded && photos[0] === i;
                return (
                  <div
                    key={i}
                    onClick={() => setPhotos((p) => p.includes(i) ? p.filter((x) => x !== i) : [...p, i])}
                    className={cx(
                      "aspect-square rounded-[10px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group relative",
                      isAdded ? "border-blue-400 bg-blue-50" : "border-[#cbd5e1] bg-[#f8fafc] hover:border-blue-300"
                    )}
                  >
                    {isAdded ? (
                      <>
                        {isCover && (
                          <span className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-tight">Cover Photo</span>
                        )}
                        <BedDouble size={18} className="text-blue-400 mb-1" />
                        <span className="text-[9px] text-blue-500 font-medium">Photo {photos.indexOf(i) + 1}</span>
                        <button
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setPhotos((p) => p.filter((x) => x !== i)); }}
                        >
                          <X size={9} className="text-white" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Camera size={16} className="text-[#cbd5e1] mb-1" />
                        <span className="text-[9px] text-[#94a3b8]">Click to add</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mb-6">
              <button className={btnSecondary}><Upload size={13} /> Upload Photos</button>
              <span className="text-[11px] text-[#94a3b8]">JPG, PNG, WEBP · Max 10 MB per file · Min 800×600 px recommended</span>
            </div>

            {/* Room Video subsection */}
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Room Video <span className="normal-case font-normal text-[#cbd5e1]">(optional)</span></p>
            <div
              onClick={() => setHasVideo((v) => !v)}
              className={cx(
                "rounded-[10px] border-2 border-dashed flex flex-col items-center justify-center gap-2 h-28 cursor-pointer transition-all group",
                hasVideo ? "border-blue-400 bg-blue-50" : "border-[#cbd5e1] bg-[#f8fafc] hover:border-blue-300"
              )}
            >
              {hasVideo ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <Video size={14} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-[#0f172a]">room_tour.mp4</p>
                      <p className="text-[11px] text-[#64748b]">142 MB · 2:34</p>
                    </div>
                  </div>
                  <button
                    className="text-[11px] text-red-500 hover:text-red-700 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setHasVideo(false); }}
                  >
                    Remove video
                  </button>
                </div>
              ) : (
                <>
                  <Video size={20} className="text-[#cbd5e1]" />
                  <p className="text-[12px] text-[#94a3b8]">Click to upload a room tour video</p>
                  <p className="text-[11px] text-[#cbd5e1]">MP4, MOV · Max 500 MB · Max 5 minutes</p>
                </>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
            <p className="text-[13px] font-bold text-[#0f172a] mb-4">Pricing</p>
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Currency">
                <select className={selectCls}>
                  <option>THB — Thai Baht</option>
                  <option>USD — US Dollar</option>
                  <option>SGD — Singapore Dollar</option>
                  <option>EUR — Euro</option>
                </select>
              </FormField>
              <div />
              <FormField label="Base Price per Night *" hint="Standard weekday rate">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94a3b8] font-medium">THB</span>
                  <input className={cx(inputCls, "pl-12")} type="number" placeholder="0.00" />
                </div>
              </FormField>
              <FormField label="Weekend Price" hint="Friday and Saturday nights">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94a3b8] font-medium">THB</span>
                  <input className={cx(inputCls, "pl-12")} type="number" placeholder="0.00" />
                </div>
              </FormField>
              <FormField label="Extra Bed Price" hint="Per extra bed per night">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94a3b8] font-medium">THB</span>
                  <input className={cx(inputCls, "pl-12")} type="number" placeholder="0.00" />
                </div>
              </FormField>
            </div>
          </div>

          {/* Inventory */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
            <p className="text-[13px] font-bold text-[#0f172a] mb-4">Inventory</p>
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Total Physical Rooms *" hint="Actual number of rooms of this type in the property">
                <input className={inputCls} type="number" min="1" placeholder="0" />
              </FormField>
              <FormField label="Available Rooms at Launch" hint="Rooms available for booking from the publish date">
                <input className={inputCls} type="number" min="0" placeholder="0" />
              </FormField>
            </div>

            {/* Workflow status display */}
            <div className="mt-5 pt-5 border-t border-[#f1f5f9]">
              <p className="text-[12px] font-semibold text-[#334155] mb-3">Publication Workflow</p>
              <div className="flex items-start gap-0">
                {WORKFLOW_STEPS.map((step, idx) => (
                  <div key={step.key} className="flex items-start flex-1">
                    <div className="flex flex-col items-center">
                      <div className={cx(
                        "w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0",
                        idx === 0 ? "border-blue-600 bg-blue-600 text-white" : "border-[#e2e8f0] bg-white text-[#94a3b8]"
                      )}>
                        {idx === 0 ? <Check size={11} /> : idx + 1}
                      </div>
                      <div className={cx("text-center mt-1.5 px-1", "max-w-[90px]")}>
                        <p className={cx("text-[10.5px] font-semibold leading-tight", idx === 0 ? "text-blue-600" : "text-[#94a3b8]")}>{step.label}</p>
                        <p className="text-[9.5px] text-[#94a3b8] mt-0.5 leading-tight">{step.desc}</p>
                      </div>
                    </div>
                    {idx < WORKFLOW_STEPS.length - 1 && (
                      <div className="flex-1 h-[2px] mt-3.5 mx-1 bg-[#e2e8f0] rounded-full" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 px-3 py-2.5 bg-[#eff6ff] rounded-[8px] border border-blue-100">
                <Info size={13} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[11.5px] text-blue-700 leading-relaxed">This room type will start as a <strong>Draft</strong>. Once submitted, a Super Admin must approve it before it becomes visible to customers. Saved drafts are not visible to anyone outside the portal.</p>
              </div>
            </div>
          </div>

          {/* Policies */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6">
            <p className="text-[13px] font-bold text-[#0f172a] mb-4">Policies</p>
            <div className="grid grid-cols-2 gap-5">
              <FormField label="Cancellation Policy">
                <select className={selectCls}>
                  <option value="">Select policy…</option>
                  {CANCELLATION_POLICIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </FormField>
              <FormField label="Meal Plan">
                <select className={selectCls}>
                  <option value="">Select meal plan…</option>
                  {MEAL_PLANS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </FormField>
              <div className="col-span-2">
                <FormField label="Check-in Notes" hint="Special instructions shown to guests at check-in (optional)">
                  <textarea className={cx(inputCls, "resize-none h-20")} placeholder="e.g. Please present a valid ID and credit card at check-in. Early check-in subject to availability." />
                </FormField>
              </div>
            </div>
          </div>

        </div>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-[220px] right-0 bg-white border-t border-[#e2e8f0] px-7 py-3 flex items-center justify-between z-20">
          <button onClick={() => setView("list")} className={btnSecondary}>Cancel</button>
          <div className="flex gap-2">
            <button className={btnSecondary}><FileText size={13} /> Save Draft</button>
            <button onClick={() => setView("list")} className={btnPrimary}><ArrowRight size={13} /> Submit for Review</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Room Types list ───────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={selectedHotel}
          onChange={(e) => setSelectedHotel(e.target.value)}
          className="px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-white cursor-pointer font-medium"
        >
          {HOTEL_OPTIONS.map((h) => <option key={h}>{h}</option>)}
        </select>
      </div>
      <PageHeader
        title="Room Types"
        subtitle="Configure room inventory, facilities, and pricing"
        action={
          <div className="flex gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input className={cx(inputCls, "pl-8 w-48")} placeholder="Search rooms..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-white cursor-pointer"><option>All Status</option><option>Active</option><option>Inactive</option></select>
            <button onClick={() => setView("create")} className={btnPrimary}><Plus size={14} /> Add Room Type</button>
          </div>
        }
      />

      <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#f8fafc] text-[#64748b] font-semibold uppercase text-[10px] tracking-wide">
              {["", "Room Type", "Bed Type", "Capacity", "Size", "Facilities", "Total", "Avail.", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROOM_TYPES.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())).map((room) => (
              <tr key={room.id} className="border-t border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                <td className="px-4 py-3">
                  <div className="w-12 h-10 rounded-[8px] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <BedDouble size={14} className="text-slate-500" />
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-[#0f172a]">{room.name}</td>
                <td className="px-4 py-3 text-[#64748b]">{room.bed}</td>
                <td className="px-4 py-3 text-[#64748b]">{room.adults}A {room.children}C</td>
                <td className="px-4 py-3 text-[#64748b]">{room.size}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap max-w-[160px]">
                    {room.facilities.slice(0, 3).map((f) => {
                      const Icon = FAC_ICONS[f] || CheckCircle2;
                      return (
                        <span key={f} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#f1f5f9] rounded-[4px] text-[10px] text-[#64748b]">
                          <Icon size={9} />{f}
                        </span>
                      );
                    })}
                    {room.facilities.length > 3 && <span className="text-[10px] text-[#94a3b8]">+{room.facilities.length - 3}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#334155] font-medium">{room.total}</td>
                <td className="px-4 py-3">
                  <span className={cx("font-semibold", room.available === 0 ? "text-red-600" : room.available <= 2 ? "text-amber-600" : "text-green-600")}>
                    {room.available}
                  </span>
                </td>
                <td className="px-4 py-3"><Badge label="Active" variant="green" /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => setEditRoom(room)} className={btnGhost}><Edit2 size={11} /></button>
                    <button className={btnGhost}><Copy size={11} /></button>
                    <button className={cx(btnGhost, "text-red-500 hover:text-red-700 hover:bg-red-50")}><Trash2 size={11} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Room modal (unchanged) */}
      {editRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[16px] shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <h2 className="text-[15px] font-bold text-[#0f172a]">Edit Room Type</h2>
              <button onClick={() => setEditRoom(null)}><X size={16} className="text-[#64748b]" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2"><FormField label="Room Type Name"><input className={inputCls} defaultValue={editRoom.name} /></FormField></div>
              <div className="col-span-2"><FormField label="Description"><textarea className={cx(inputCls, "resize-none h-16")} defaultValue="Comfortable room with modern amenities." /></FormField></div>
              <FormField label="Bed Type"><input className={inputCls} defaultValue={editRoom.bed} /></FormField>
              <FormField label="Room Size"><input className={inputCls} defaultValue={editRoom.size} /></FormField>
              <FormField label="Adult Capacity"><input className={inputCls} type="number" defaultValue={editRoom.adults} /></FormField>
              <FormField label="Child Capacity"><input className={inputCls} type="number" defaultValue={editRoom.children} /></FormField>
              <div className="col-span-2">
                <FormField label="Facilities">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {["WiFi", "AC", "TV", "Safe", "Minibar", "Bathtub", "Private Pool", "Kitchenette"].map((f) => (
                      <label key={f} className="flex items-center gap-1.5 text-[12px] text-[#334155] cursor-pointer">
                        <input type="checkbox" defaultChecked={editRoom.facilities.includes(f)} className="rounded" />
                        {f}
                      </label>
                    ))}
                  </div>
                </FormField>
              </div>
              <FormField label="Status">
                <select className={selectCls}><option>Active</option><option>Inactive</option></select>
              </FormField>
              <FormField label="Base Price (THB)"><input className={inputCls} type="number" defaultValue={editRoom.price} /></FormField>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#e2e8f0]">
              <button onClick={() => setEditRoom(null)} className={btnSecondary}>Cancel</button>
              <button onClick={() => setEditRoom(null)} className={btnPrimary}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Screen 4: Availability & Pricing ────────────────────────────────────────

const AVAIL_PRICING_RULES = [
  { id: "PR1", label: "Weekend Rate Multiplier",   value: "1.28×",   category: "Rate",        active: true,  rooms: "All Room Types",            desc: "Applies to Friday and Saturday nights automatically." },
  { id: "PR2", label: "Early Bird Discount (30d+)", value: "−10%",   category: "Promotion",   active: true,  rooms: "All Room Types",            desc: "Bookings made 30 or more days in advance receive a 10% discount." },
  { id: "PR3", label: "Last Minute Rate (3d−)",    value: "+15%",    category: "Rate",        active: true,  rooms: "Standard Room, Deluxe Room", desc: "Bookings within 3 days of arrival incur a 15% surcharge." },
  { id: "PR4", label: "Long Stay Discount (7n+)",  value: "−8%",    category: "Promotion",   active: false, rooms: "All Room Types",            desc: "Stays of 7 or more nights receive an 8% discount." },
  { id: "PR5", label: "Min. Stay Restriction",     value: "2 nights",category: "Restriction", active: true,  rooms: "All Room Types",            desc: "Guests must book a minimum of 2 nights for this property." },
  { id: "PR6", label: "Stop Sell Threshold",       value: "0 rooms", category: "Inventory",   active: true,  rooms: "All Room Types",            desc: "Auto-trigger Stop Sell when available inventory reaches 0." },
];

// Multi-property room data for Availability screen
type AvailRoom = { id: string; name: string; bed: string; total: number; available: number; price: number };
const AVAIL_HOTEL_LIST: { id: string; name: string; accent: string; dot: string }[] = [
  { id: "H001", name: "The Horizon Resort",     accent: "bg-blue-50 border-blue-200 text-blue-700",   dot: "bg-blue-500"   },
  { id: "H002", name: "Blue Lagoon Boutique",   accent: "bg-teal-50 border-teal-200 text-teal-700",   dot: "bg-teal-500"   },
  { id: "H003", name: "Cityview Business Hotel",accent: "bg-violet-50 border-violet-200 text-violet-700", dot: "bg-violet-500" },
];
const AVAIL_HOTEL_ROOMS: Record<string, AvailRoom[]> = {
  H001: ROOM_TYPES.map((r) => ({ id: r.id, name: r.name, bed: r.bed, total: r.total, available: r.available, price: r.price })),
  H002: [
    { id: "H2R01", name: "Standard Room",   bed: "1 King Bed",        total: 6, available: 3, price: 2200 },
    { id: "H2R02", name: "Superior Room",   bed: "1 King Bed",        total: 4, available: 2, price: 2900 },
    { id: "H2R03", name: "Honeymoon Suite", bed: "1 King Bed + Sofa", total: 2, available: 1, price: 6500 },
  ],
  H003: [
    { id: "H3R01", name: "Business Room",   bed: "1 Queen Bed",       total: 8, available: 4, price: 1800 },
    { id: "H3R02", name: "Deluxe Room",     bed: "1 King Bed",        total: 6, available: 3, price: 2600 },
    { id: "H3R03", name: "Executive Suite", bed: "1 King Bed + Sofa", total: 2, available: 1, price: 4800 },
  ],
};
const AVAIL_CAL: Record<string, number[]> = {
  ...CAL_AVAIL,
  H2R01: [3,3,2,1,0,0,3,3,5,5,5,5,5,5],
  H2R02: [2,2,1,1,0,0,2,2,3,3,3,3,3,3],
  H2R03: [1,0,0,0,0,0,0,1,2,2,2,2,2,2],
  H3R01: [4,4,3,2,1,0,4,4,6,6,6,6,6,6],
  H3R02: [3,3,2,1,0,0,3,3,5,5,5,5,5,5],
  H3R03: [1,1,0,0,0,0,0,1,2,2,2,2,2,2],
};
const AVAIL_PRICE_BASE: Record<string, number> = { ...CAL_PRICE_BASE, H2R01:2200,H2R02:2900,H2R03:6500,H3R01:1800,H3R02:2600,H3R03:4800 };
const AVAIL_PRICE_WKD:  Record<string, number> = { ...CAL_PRICE_WKD,  H2R01:2800,H2R02:3600,H2R03:8000,H3R01:2200,H3R02:3200,H3R03:6000 };

function AvailabilityScreen() {
  // Hotel filter
  const [hotelFilter, setHotelFilter]   = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");

  // Cell drawer
  const [cellDrawer, setCellDrawer]     = useState<{ roomId: string; hotelId: string; dateIdx: number } | null>(null);
  const [drawerAvail, setDrawerAvail]   = useState(0);
  const [drawerPrice, setDrawerPrice]   = useState(0);
  const [drawerMinStay, setDrawerMinStay] = useState(2);
  const [drawerMaxStay, setDrawerMaxStay] = useState(30);
  const [drawerStopSell, setDrawerStopSell] = useState(false);
  const [drawerCTA, setDrawerCTA]       = useState(false);
  const [drawerCTD, setDrawerCTD]       = useState(false);
  const [drawerSaved, setDrawerSaved]   = useState(false);

  // Stop-sell overrides per cell (roomId → boolean[dateIdx])
  const [stopSellMap, setStopSellMap]   = useState<Record<string, boolean[]>>(() => {
    const m: Record<string, boolean[]> = {};
    Object.values(AVAIL_HOTEL_ROOMS).flat().forEach((r) => {
      m[r.id] = CAL_DATES.map((_, i) => (r.id === "R01" || r.id === "R02") && (i === 4 || i === 5));
    });
    return m;
  });

  // Bulk Update
  const [bulkOpen, setBulkOpen]         = useState(false);
  const [bulkTab, setBulkTab]           = useState<"prices" | "inventory" | "restrictions">("prices");
  const [bulkRooms, setBulkRooms]       = useState<string[]>([]);
  const [bulkHotels, setBulkHotels]     = useState<string[]>([]);
  const [bulkDateFrom, setBulkDateFrom] = useState("");
  const [bulkDateTo, setBulkDateTo]     = useState("");
  const [bulkApplied, setBulkApplied]   = useState(false);

  // Pricing rule modal
  const [selectedRule, setSelectedRule] = useState<string | null>(null);

  // Alerts
  const [resolvedAlerts, setResolvedAlerts] = useState<string[]>([]);

  // Sync
  const [syncingNow, setSyncingNow]     = useState(false);
  const [lastSync, setLastSync]         = useState("23 Jul, 14:02");

  const doSync = () => {
    setSyncingNow(true);
    setTimeout(() => { setSyncingNow(false); setLastSync("just now"); }, 1800);
  };

  // Derived scoped rooms
  const isAll = hotelFilter === "all";
  const scopedHotels = isAll ? AVAIL_HOTEL_LIST : AVAIL_HOTEL_LIST.filter((h) => h.id === hotelFilter);
  const scopedRooms: AvailRoom[] = scopedHotels.flatMap((h) => AVAIL_HOTEL_ROOMS[h.id] ?? []);
  const roomsForDropdown: AvailRoom[] = isAll ? [] : (AVAIL_HOTEL_ROOMS[hotelFilter] ?? []);
  const filteredRooms = (hotelId: string) => {
    const base = AVAIL_HOTEL_ROOMS[hotelId] ?? [];
    if (roomTypeFilter === "all" || isAll) return base;
    return base.filter((r) => r.name === roomTypeFilter);
  };

  const openDrawer = (roomId: string, hotelId: string, dateIdx: number) => {
    const avail = AVAIL_CAL[roomId]?.[dateIdx] ?? 0;
    const price = WEEKEND_IDX.includes(dateIdx) ? AVAIL_PRICE_WKD[roomId] : AVAIL_PRICE_BASE[roomId];
    setDrawerAvail(avail);
    setDrawerPrice(price);
    setDrawerMinStay(2);
    setDrawerMaxStay(30);
    setDrawerStopSell(stopSellMap[roomId]?.[dateIdx] ?? false);
    setDrawerCTA(false);
    setDrawerCTD(false);
    setDrawerSaved(false);
    setCellDrawer({ roomId, hotelId, dateIdx });
  };

  const toggleStopSell = (roomId: string, dateIdx: number, val: boolean) => {
    setStopSellMap((prev) => {
      const next = { ...prev };
      next[roomId] = [...(prev[roomId] || [])];
      next[roomId][dateIdx] = val;
      return next;
    });
  };

  const cellCls = (avail: number, roomId: string, dateIdx: number) => {
    if (stopSellMap[roomId]?.[dateIdx]) return "bg-slate-100 text-slate-400 border-slate-200";
    if (avail === 0)  return "bg-red-50 text-red-700 border-red-100";
    if (avail <= 2)   return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-green-50 text-green-700 border-green-100";
  };

  const activeAlerts = NOTIFICATIONS.filter((n) => n.type === "inventory" || n.type === "sync-error");
  const activeAlertCount = activeAlerts.filter((n) => !resolvedAlerts.includes(n.id)).length;

  const CHANGE_LOG = [
    { user: "Hotel Manager",  action: "Price updated THB 3,200 → 3,500",   time: "21 Jul, 11:20" },
    { user: "PMS Sync",       action: "Availability synced: 3 rooms",       time: "23 Jul, 08:00" },
    { user: "Hotel Owner",    action: "Stop Sell lifted for Jul 19",         time: "19 Jul, 09:45" },
  ];

  // Shared date-column header row
  const CalHead = () => (
    <thead>
      <tr>
        <th className="sticky left-0 bg-white px-4 py-3 text-left text-[12px] font-semibold text-[#0f172a] border-b border-[#e2e8f0] min-w-[170px] z-10">
          {isAll ? "Hotel / Room Type" : "Room Type"}
        </th>
        {CAL_DATES.map((d, i) => (
          <th key={d} className={cx("px-2 py-3 border-b border-[#e2e8f0] text-center min-w-[68px] font-semibold", WEEKEND_IDX.includes(i) ? "bg-blue-50 text-blue-700" : "text-[#64748b]")}>
            <div>{d.split(" ")[1]}</div>
            <div className="text-[10px] font-normal">{d.split(" ")[0]}</div>
          </th>
        ))}
      </tr>
    </thead>
  );

  return (
    <div className="flex gap-4 items-start">

      {/* ── Main Column ── */}
      <div className="flex-1 min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">

          {/* Hotel selector + property count badge */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
              <select
                value={hotelFilter}
                onChange={(e) => {
                  setHotelFilter(e.target.value);
                  setRoomTypeFilter("all");
                  setCellDrawer(null);
                }}
                className="pl-8 pr-8 py-2 text-[13px] font-medium border border-[#e2e8f0] rounded-[8px] bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
              >
                <option value="all">All Hotels</option>
                {AVAIL_HOTEL_LIST.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#f1f5f9] border border-[#e2e8f0] rounded-full text-[10.5px] font-semibold text-[#64748b] whitespace-nowrap">
              <Building2 size={10} className="text-[#94a3b8]" />
              {AVAIL_HOTEL_LIST.length} Properties
            </span>
          </div>

          {/* Room Type — filtered to selected hotel, hidden when All Hotels */}
          {!isAll && (
            <select
              value={roomTypeFilter}
              onChange={(e) => { setRoomTypeFilter(e.target.value); setCellDrawer(null); }}
              className="px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All Room Types</option>
              {roomsForDropdown.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          )}

          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input className={cx(inputCls, "pl-8 w-48")} placeholder="Jul 23 – Aug 5, 2026" readOnly />
          </div>
          <div className="flex-1" />
          <div className="flex gap-1 p-1 bg-[#f1f5f9] rounded-[8px]">
            <button className="px-3 py-1.5 text-[12px] font-medium bg-white shadow-sm rounded-[6px] text-[#0f172a]">Calendar</button>
            <button className="px-3 py-1.5 text-[12px] font-medium text-[#64748b] rounded-[6px] hover:bg-white transition-colors">List</button>
          </div>
          <button onClick={() => { setBulkOpen(true); setBulkApplied(false); }} className={btnSecondary}>
            <SlidersHorizontal size={13} /> Bulk Update
          </button>
          <button onClick={doSync} disabled={syncingNow} className={cx(btnSecondary, syncingNow && "opacity-60")}>
            <RefreshCw size={13} className={syncingNow ? "animate-spin" : ""} /> Sync Now
          </button>
        </div>

        {/* Sync status */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-[8px] text-[11px]">
            <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", syncingNow ? "bg-blue-400 animate-pulse" : "bg-green-500")} />
            <span className="font-semibold text-green-700">PMS: {syncingNow ? "Syncing…" : "Connected"}</span>
            <span className="text-green-600">· Last sync: {lastSync}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-[8px] text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            <span className="font-semibold text-red-600">CM: Disconnected</span>
            <span className="text-red-500">· Pending: 4 updates</span>
            <button className="ml-1 text-red-700 underline font-medium">Connect</button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 px-1">
          <span className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-wide">Legend:</span>
          {[
            { cls: "bg-green-100 border-green-300 text-green-700",   label: "Available" },
            { cls: "bg-amber-100 border-amber-300 text-amber-700",   label: "Low Inventory" },
            { cls: "bg-red-100 border-red-300 text-red-700",         label: "Sold Out" },
            { cls: "bg-slate-100 border-slate-300 text-slate-500",   label: "Closed by Merchant" },
          ].map(({ cls, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cx("w-4 h-4 rounded-[4px] border", cls)} />
              <span className="text-[11px] text-[#64748b]">{label}</span>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-x-auto mb-4">
          <table className="text-[11px] w-full">
            <CalHead />
            <tbody>
              {scopedHotels.map((hotel, hi) => {
                const rows = filteredRooms(hotel.id);
                return (
                  <React.Fragment key={hotel.id}>
                    {/* Hotel section header — only shown in All Hotels mode */}
                    {isAll && (
                      <tr className={cx("border-t-2", hi === 0 ? "border-t-0" : "border-[#e2e8f0]")}>
                        <td
                          colSpan={CAL_DATES.length + 1}
                          className="sticky left-0 px-4 py-2 bg-[#f8fafc]"
                        >
                          <div className="flex items-center gap-2">
                            <div className={cx("w-2 h-2 rounded-full shrink-0", hotel.dot)} />
                            <span className="text-[11px] font-bold text-[#0f172a]">{hotel.name}</span>
                            <span className="text-[10px] text-[#94a3b8]">· {rows.length} room type{rows.length !== 1 ? "s" : ""}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* Room rows */}
                    {rows.map((room) => (
                      <tr key={room.id} className="border-t border-[#f1f5f9]">
                        <td className={cx("sticky left-0 bg-white px-4 py-2.5 z-10 border-r border-[#f1f5f9]", isAll && "pl-6")}>
                          <div className="font-semibold text-[#0f172a] text-[12px]">{room.name}</div>
                          <div className="text-[10px] text-[#94a3b8] mt-0.5">{room.total} total · {room.available} avail</div>
                        </td>
                        {CAL_DATES.map((_, di) => {
                          const avail   = AVAIL_CAL[room.id]?.[di] ?? 0;
                          const isWkd   = WEEKEND_IDX.includes(di);
                          const price   = isWkd ? AVAIL_PRICE_WKD[room.id] : AVAIL_PRICE_BASE[room.id];
                          const stopped = stopSellMap[room.id]?.[di];
                          const isOpen  = cellDrawer?.roomId === room.id && cellDrawer?.dateIdx === di;
                          return (
                            <td
                              key={di}
                              className={cx("px-1 py-1 text-center cursor-pointer", isWkd ? "bg-blue-50/30" : "")}
                              onClick={() => isOpen ? setCellDrawer(null) : openDrawer(room.id, hotel.id, di)}
                            >
                              <div className={cx(
                                "rounded-[5px] px-1 py-1.5 border transition-all hover:ring-2 hover:ring-blue-300 hover:ring-offset-1",
                                cellCls(avail, room.id, di),
                                isOpen ? "ring-2 ring-blue-500 ring-offset-1" : ""
                              )}>
                                <div className="font-bold text-[11px]">{stopped ? "—" : avail}</div>
                                <div className="text-[9px] opacity-75">{stopped ? "Stop" : `${(price / 1000).toFixed(1)}K`}</div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom panels */}
        <div className="grid grid-cols-2 gap-4">

          {/* Pricing Rules */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-[#0f172a]">Pricing Rules</p>
              <button className={btnGhost}><Plus size={12} /> Add Rule</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {AVAIL_PRICING_RULES.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => setSelectedRule(rule.id)}
                  className="flex items-center justify-between px-3 py-2.5 border border-[#f1f5f9] rounded-[8px] hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left w-full group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cx("w-1.5 h-1.5 rounded-full shrink-0", rule.active ? "bg-green-500" : "bg-[#cbd5e1]")} />
                    <span className="text-[12px] text-[#334155] truncate">{rule.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[12px] font-semibold text-blue-600">{rule.value}</span>
                    <ChevronRight size={12} className="text-[#cbd5e1] group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-[#0f172a]">Active Alerts</p>
              {activeAlertCount > 0
                ? <Badge label={`${activeAlertCount} active`} variant="orange" />
                : <Badge label="All clear" variant="green" />}
            </div>
            <div className="flex flex-col gap-2">
              {activeAlerts.map((n) => {
                const resolved = resolvedAlerts.includes(n.id);
                return (
                  <div key={n.id} className={cx(
                    "flex items-start gap-3 p-3 border rounded-[8px] transition-all",
                    resolved ? "border-green-100 bg-green-50" : "border-amber-100 bg-amber-50"
                  )}>
                    {resolved
                      ? <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5" />
                      : <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className={cx("text-[12px] font-semibold", resolved ? "text-green-800" : "text-amber-900", resolved && "line-through")}>{n.title}</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">{n.message}</p>
                      {!resolved && (
                        <div className="flex gap-1.5 mt-2">
                          <button className={cx(btnGhost, "text-[11px] py-1")}><Eye size={10} /> View</button>
                          {n.type === "sync-error" && (
                            <button onClick={doSync} className={cx(btnGhost, "text-[11px] py-1")}><RefreshCw size={10} /> Sync Now</button>
                          )}
                          <button
                            onClick={() => setResolvedAlerts((p) => [...p, n.id])}
                            className={cx(btnGhost, "text-[11px] py-1 text-green-700")}
                          >
                            <Check size={10} /> Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── Cell Edit Drawer ── */}
      {cellDrawer && (() => {
        const hRooms = AVAIL_HOTEL_ROOMS[cellDrawer.hotelId] ?? [];
        const room = hRooms.find((r) => r.id === cellDrawer.roomId);
        const hotel = AVAIL_HOTEL_LIST.find((h) => h.id === cellDrawer.hotelId);
        const date = CAL_DATES[cellDrawer.dateIdx];
        const isWkd = WEEKEND_IDX.includes(cellDrawer.dateIdx);
        const origAvail = AVAIL_CAL[cellDrawer.roomId]?.[cellDrawer.dateIdx] ?? 0;
        return (
          <div className="w-[340px] shrink-0 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col" style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e2e8f0] sticky top-0 bg-white z-10">
              <div>
                <p className="text-[13px] font-bold text-[#0f172a]">{room?.name}</p>
                <p className="text-[11.5px] text-[#64748b] mt-0.5">{date} · {isWkd ? "Weekend" : "Weekday"}</p>
                {hotel && <p className="text-[10.5px] text-[#94a3b8] mt-0.5">{hotel.name}</p>}
              </div>
              <button onClick={() => setCellDrawer(null)} className="p-1 rounded-[6px] hover:bg-[#f1f5f9] transition-colors">
                <X size={14} className="text-[#64748b]" />
              </button>
            </div>

            <div className="divide-y divide-[#f1f5f9]">

              {/* Availability & Pricing */}
              <div className="px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">Availability & Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Available Rooms">
                    <input className={inputCls} type="number" min="0" value={drawerAvail}
                      onChange={(e) => { setDrawerAvail(+e.target.value); setDrawerSaved(false); }} />
                  </FormField>
                  <FormField label="Price (THB / night)">
                    <input className={inputCls} type="number" value={drawerPrice}
                      onChange={(e) => { setDrawerPrice(+e.target.value); setDrawerSaved(false); }} />
                  </FormField>
                  <FormField label="Min. Stay (nights)">
                    <input className={inputCls} type="number" min="1" value={drawerMinStay}
                      onChange={(e) => { setDrawerMinStay(+e.target.value); setDrawerSaved(false); }} />
                  </FormField>
                  <FormField label="Max. Stay (nights)">
                    <input className={inputCls} type="number" min="1" value={drawerMaxStay}
                      onChange={(e) => { setDrawerMaxStay(+e.target.value); setDrawerSaved(false); }} />
                  </FormField>
                </div>
              </div>

              {/* Restrictions */}
              <div className="px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">Restrictions</p>
                <div className="flex flex-col gap-3.5">
                  {([
                    {
                      label: "Stop Sell",
                      desc: "Block all new bookings for this date",
                      val: drawerStopSell,
                      set: (v: boolean) => {
                        setDrawerStopSell(v);
                        toggleStopSell(cellDrawer.roomId, cellDrawer.dateIdx, v);
                        setDrawerSaved(false);
                      },
                    },
                    {
                      label: "Closed to Arrival (CTA)",
                      desc: "No check-ins allowed on this date",
                      val: drawerCTA,
                      set: (v: boolean) => { setDrawerCTA(v); setDrawerSaved(false); },
                    },
                    {
                      label: "Closed to Departure (CTD)",
                      desc: "No check-outs allowed on this date",
                      val: drawerCTD,
                      set: (v: boolean) => { setDrawerCTD(v); setDrawerSaved(false); },
                    },
                  ] as { label: string; desc: string; val: boolean; set: (v: boolean) => void }[]).map(({ label, desc, val, set }) => (
                    <div key={label} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-medium text-[#0f172a]">{label}</p>
                        <p className="text-[10.5px] text-[#94a3b8] mt-0.5">{desc}</p>
                      </div>
                      <Toggle on={val} onChange={() => set(!val)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Inventory Source */}
              <div className="px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2.5">Inventory Source</p>
                <div className="flex flex-col gap-2">
                  {([
                    { label: "PMS",               status: "Synced",          cls: "text-green-700 bg-green-50 border-green-200" },
                    { label: "Channel Manager",   status: "Not Connected",   cls: "text-gray-500 bg-gray-50 border-gray-200" },
                    { label: "Manual Override",   status: drawerAvail !== origAvail ? "Active" : "Off", cls: drawerAvail !== origAvail ? "text-blue-700 bg-blue-50 border-blue-200" : "text-gray-400 bg-gray-50 border-gray-100" },
                  ] as { label: string; status: string; cls: string }[]).map(({ label, status, cls }) => (
                    <div key={label} className="flex items-center justify-between text-[12px]">
                      <span className="text-[#64748b]">{label}</span>
                      <span className={cx("px-2 py-0.5 rounded-full border text-[10.5px] font-semibold", cls)}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Change History */}
              <div className="px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">Change History</p>
                <div className="relative pl-1">
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#e2e8f0]" />
                  <div className="flex flex-col gap-3">
                    {CHANGE_LOG.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-[18px] h-[18px] rounded-full bg-[#eff6ff] flex items-center justify-center shrink-0 z-10">
                          <Clock size={9} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[11.5px] text-[#334155]"><span className="font-medium">{entry.user}</span> — {entry.action}</p>
                          <p className="text-[10px] text-[#94a3b8] mt-0.5">{entry.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 bg-white border-t border-[#e2e8f0] px-4 py-3 flex items-center justify-between">
              <button onClick={() => setCellDrawer(null)} className={btnSecondary}>Cancel</button>
              <button onClick={() => setDrawerSaved(true)} className={btnPrimary}>
                {drawerSaved ? <><CheckCircle2 size={13} /> Saved</> : <><Check size={13} /> Save Changes</>}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Pricing Rule Modal ── */}
      {selectedRule && (() => {
        const rule = AVAIL_PRICING_RULES.find((r) => r.id === selectedRule)!;
        if (!rule) return null;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && setSelectedRule(null)}>
            <div className="bg-white rounded-[16px] shadow-2xl w-[500px] max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
                <div>
                  <h2 className="text-[14px] font-bold text-[#0f172a]">{rule.label}</h2>
                  <p className="text-[12px] text-[#64748b] mt-0.5">{rule.category} rule · {rule.rooms}</p>
                </div>
                <button onClick={() => setSelectedRule(null)} className="p-1 rounded-[6px] hover:bg-[#f1f5f9]">
                  <X size={15} className="text-[#64748b]" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-[8px]">
                  <span className="text-[12px] font-medium text-[#334155]">Rule Status</span>
                  <div className="flex items-center gap-2.5">
                    <Toggle on={rule.active} onChange={() => {}} />
                    <span className={cx("text-[12px] font-semibold", rule.active ? "text-green-700" : "text-[#94a3b8]")}>{rule.active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
                <FormField label="Rule Name"><input className={inputCls} defaultValue={rule.label} /></FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Value / Amount"><input className={inputCls} defaultValue={rule.value} /></FormField>
                  <FormField label="Category">
                    <select className={selectCls} defaultValue={rule.category}>
                      <option>Rate</option><option>Promotion</option><option>Restriction</option><option>Inventory</option>
                    </select>
                  </FormField>
                </div>
                <FormField label="Applicable Room Types">
                  <select className={selectCls} defaultValue={rule.rooms}>
                    <option>All Room Types</option>
                    {ROOM_TYPES.map((r) => <option key={r.id}>{r.name}</option>)}
                  </select>
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Effective From (optional)"><input type="date" className={inputCls} /></FormField>
                  <FormField label="Effective Until (optional)"><input type="date" className={inputCls} /></FormField>
                </div>
                <FormField label="Description">
                  <textarea className={cx(inputCls, "resize-none h-16")} defaultValue={rule.desc} />
                </FormField>
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#e2e8f0]">
                <button className={cx(btnGhost, "text-red-600")}><Archive size={13} /> Delete Rule</button>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedRule(null)} className={btnSecondary}>Cancel</button>
                  <button onClick={() => setSelectedRule(null)} className={btnPrimary}><Check size={13} /> Save Rule</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bulk Update Modal ── */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && setBulkOpen(false)}>
          <div className="bg-white rounded-[16px] shadow-2xl w-[560px] max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div>
                <h2 className="text-[15px] font-bold text-[#0f172a]">Bulk Update</h2>
                <p className="text-[12px] text-[#64748b] mt-0.5">Apply changes across a date range and multiple room types</p>
              </div>
              <button onClick={() => setBulkOpen(false)} className="p-1 rounded-[6px] hover:bg-[#f1f5f9]"><X size={15} className="text-[#64748b]" /></button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {/* Date range */}
              <div>
                <p className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2">Date Range</p>
                <div className="flex gap-3">
                  <FormField label="From">
                    <input type="date" className={inputCls} value={bulkDateFrom} onChange={(e) => setBulkDateFrom(e.target.value)} />
                  </FormField>
                  <FormField label="To">
                    <input type="date" className={inputCls} value={bulkDateTo} onChange={(e) => setBulkDateTo(e.target.value)} />
                  </FormField>
                </div>
              </div>

              {/* Properties — only shown in All Hotels mode */}
              {isAll && (
                <div>
                  <p className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2">Properties</p>
                  <div className="flex flex-wrap gap-2">
                    {AVAIL_HOTEL_LIST.map((h) => {
                      const sel = bulkHotels.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          onClick={() => setBulkHotels((p) => sel ? p.filter((x) => x !== h.id) : [...p, h.id])}
                          className={cx("px-3 py-1.5 text-[12px] font-medium rounded-full border transition-all",
                            sel ? "bg-blue-600 text-white border-blue-600" : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-blue-300")}
                        >
                          {sel && <Check size={10} className="inline mr-1" />}{h.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Room types */}
              <div>
                <p className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2">Room Types</p>
                <div className="flex flex-wrap gap-2">
                  {["All Room Types", ...scopedRooms.map((r) => r.name).filter((v, i, a) => a.indexOf(v) === i)].map((rt) => {
                    const sel = bulkRooms.includes(rt);
                    return (
                      <button
                        key={rt}
                        onClick={() => setBulkRooms((p) => sel ? p.filter((x) => x !== rt) : [...p, rt])}
                        className={cx("px-3 py-1.5 text-[12px] font-medium rounded-full border transition-all",
                          sel ? "bg-blue-600 text-white border-blue-600" : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-blue-300")}
                      >
                        {sel && <Check size={10} className="inline mr-1" />}{rt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tabs */}
              <div>
                <div className="flex gap-0 border-b border-[#e2e8f0] mb-4">
                  {(["prices", "inventory", "restrictions"] as const).map((t) => (
                    <button key={t} onClick={() => setBulkTab(t)}
                      className={cx("px-4 py-2 text-[12px] font-medium border-b-2 transition-colors capitalize",
                        bulkTab === t ? "border-blue-600 text-blue-700" : "border-transparent text-[#64748b] hover:text-[#0f172a]")}>
                      {t === "prices" ? "Prices" : t === "inventory" ? "Inventory" : "Restrictions"}
                    </button>
                  ))}
                </div>

                {bulkTab === "prices" && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Weekday Rate (THB)"><input className={inputCls} type="number" placeholder="e.g. 3,200" /></FormField>
                    <FormField label="Weekend Rate (THB)"><input className={inputCls} type="number" placeholder="e.g. 4,000" /></FormField>
                    <FormField label="Pricing Strategy">
                      <select className={selectCls}><option>Fixed Rate</option><option>Multiplier (× base)</option><option>% Adjustment</option></select>
                    </FormField>
                    <FormField label="Extra Bed Rate (THB)"><input className={inputCls} type="number" placeholder="e.g. 500" /></FormField>
                  </div>
                )}

                {bulkTab === "inventory" && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Available Rooms"><input className={inputCls} type="number" placeholder="e.g. 4" /></FormField>
                    <FormField label="Inventory Source">
                      <select className={selectCls}><option>Manual Override</option><option>PMS Sync</option><option>Channel Manager</option></select>
                    </FormField>
                    <div className="col-span-2">
                      <FormField label="Inventory Note (optional)">
                        <input className={inputCls} placeholder="e.g. Rooms held for walk-in guests" />
                      </FormField>
                    </div>
                  </div>
                )}

                {bulkTab === "restrictions" && (
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Min. Stay (nights)"><input className={inputCls} type="number" placeholder="e.g. 2" min="1" /></FormField>
                      <FormField label="Max. Stay (nights)"><input className={inputCls} type="number" placeholder="e.g. 30" min="1" /></FormField>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {([
                        { label: "Stop Sell",                  desc: "Block all bookings for selected dates" },
                        { label: "Closed to Arrival (CTA)",    desc: "No check-ins allowed on selected dates" },
                        { label: "Closed to Departure (CTD)",  desc: "No check-outs allowed on selected dates" },
                      ]).map(({ label, desc }) => (
                        <div key={label} className="flex items-start justify-between gap-3 px-3 py-2.5 border border-[#f1f5f9] rounded-[8px]">
                          <div>
                            <p className="text-[12px] font-medium text-[#0f172a]">{label}</p>
                            <p className="text-[10.5px] text-[#94a3b8] mt-0.5">{desc}</p>
                          </div>
                          <Toggle on={false} onChange={() => {}} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {bulkApplied && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-green-50 border border-green-200 rounded-[8px]">
                  <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  <p className="text-[12px] font-medium text-green-800">Bulk update applied successfully across selected dates and room types.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-2 px-6 py-4 border-t border-[#e2e8f0]">
              <button onClick={() => setBulkOpen(false)} className={btnSecondary}>Cancel</button>
              <button onClick={() => setBulkApplied(true)} className={btnPrimary}><Check size={13} /> Apply Bulk Update</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Screen 5: Booking Management ────────────────────────────────────────────

function BookingsScreen({
  initialTab,
  selectedBooking,
  setSelectedBooking,
}: {
  initialTab: string;
  selectedBooking: Booking | null;
  setSelectedBooking: (b: Booking | null) => void;
}) {
  const [activeTab, setActiveTab]         = useState(initialTab || "all");
  const [hotelFilter, setHotelFilter]     = useState("all");
  const [search, setSearch]               = useState("");
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [moreOpen, setMoreOpen]           = useState(false);
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [notes, setNotes]                 = useState("");
  const [notesSaved, setNotesSaved]       = useState(false);

  // Local status overrides: bookingId → "no-show" (extensible)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Booking["status"]>>({});
  // No-show modal
  const [noShowModal, setNoShowModal]     = useState(false);
  const [noShowNote, setNoShowNote]       = useState("");
  const [noShowBookingId, setNoShowBookingId] = useState<string | null>(null);
  // Post-no-show sync state
  const [noShowSynced, setNoShowSynced]   = useState<Record<string, boolean>>({});

  // Merge status overrides into the booking list
  const BOOKINGS_LIVE: Booking[] = BOOKINGS.map((b) =>
    statusOverrides[b.id] ? { ...b, status: statusOverrides[b.id] } : b
  );

  const confirmNoShow = (bookingId: string) => {
    const now = new Date();
    const ts  = `${now.getDate()} Jul ${now.getFullYear()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setStatusOverrides((prev) => ({ ...prev, [bookingId]: "no-show" }));
    setNoShowSynced((prev) => ({ ...prev, [bookingId]: true }));
    // Keep drawer open on updated booking
    const updated = BOOKINGS.find((b) => b.id === bookingId);
    if (updated) setSelectedBooking({ ...updated, status: "no-show" });
    setNoShowModal(false);
    setNoShowNote("");
    setNoShowBookingId(null);
    return ts;
  };

  const HOTEL_LIST = ["The Horizon Resort", "Blue Lagoon Boutique", "Cityview Business Hotel"];
  const showHotelCol = hotelFilter === "all";

  const scopedBookings = hotelFilter === "all" ? BOOKINGS_LIVE : BOOKINGS_LIVE.filter((b) => b.hotel === hotelFilter);
  const moreFilterCount = [roomTypeFilter, statusFilter, paymentFilter, channelFilter].filter(Boolean).length;

  const TABS = [
    { id: "all",             label: "All",             count: scopedBookings.length },
    { id: "pending",         label: "Pending",         count: scopedBookings.filter((b) => b.status === "pending").length },
    { id: "confirmed",       label: "Confirmed",       count: scopedBookings.filter((b) => b.status === "confirmed").length },
    { id: "pending-checkin", label: "Pending Check-in",count: scopedBookings.filter((b) => ["confirmed","pending"].includes(b.status)).length },
    { id: "in-house",        label: "In-house",        count: scopedBookings.filter((b) => b.status === "checked-in").length },
    { id: "checked-out",     label: "Checked-out",     count: scopedBookings.filter((b) => b.status === "checked-out").length },
    { id: "cancelled",       label: "Cancelled",       count: scopedBookings.filter((b) => b.status === "cancelled").length },
    { id: "no-show",         label: "No-show",         count: scopedBookings.filter((b) => b.status === "no-show").length },
  ];

  const filtered = scopedBookings.filter((b) => {
    const matchTab =
      activeTab === "all"             ? true :
      activeTab === "pending"         ? b.status === "pending" :
      activeTab === "confirmed"       ? b.status === "confirmed" :
      activeTab === "pending-checkin" ? ["confirmed","pending"].includes(b.status) :
      activeTab === "in-house"        ? b.status === "checked-in" :
      activeTab === "checked-out"     ? b.status === "checked-out" :
      activeTab === "cancelled"       ? b.status === "cancelled" :
      activeTab === "no-show"         ? b.status === "no-show" : true;
    const matchSearch  = !search        || b.id.toLowerCase().includes(search.toLowerCase()) || b.guest.toLowerCase().includes(search.toLowerCase());
    const matchRoom    = !roomTypeFilter|| b.room.toLowerCase().includes(roomTypeFilter.toLowerCase());
    const matchStatus  = !statusFilter  || b.status === statusFilter;
    const matchPayment = !paymentFilter || b.payment === paymentFilter;
    const matchChannel = !channelFilter || b.channel === channelFilter;
    return matchTab && matchSearch && matchRoom && matchStatus && matchPayment && matchChannel;
  });

  const clearAll = () => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setRoomTypeFilter(""); setStatusFilter(""); setPaymentFilter(""); setChannelFilter("");
    setHotelFilter("all"); setMoreOpen(false);
  };
  const anyFilter = search || dateFrom || dateTo || hotelFilter !== "all" || moreFilterCount > 0;

  // Derived payment breakdown for drawer
  const getPaymentBreakdown = (b: Booking) => {
    const total      = parseInt(b.amount.replace(/[^0-9]/g, ""), 10);
    const roomTotal  = Math.round(total * 0.80);
    const breakfast  = Math.round(total * 0.07);
    const extraBed   = 0;
    const taxes      = Math.round((roomTotal + breakfast) * 0.07);
    const commission = Math.round((roomTotal + breakfast + taxes) * 0.15);
    const netPayout  = roomTotal + breakfast + taxes - commission;
    return { roomTotal, breakfast, extraBed, taxes, commission, netPayout };
  };

  // Timeline events per booking status
  const getTimeline = (b: Booking) => {
    const evs: { label: string; time: string; icon: React.ElementType; color: string }[] = [
      { label: "Booking Received",  time: b.time,                   icon: Plus,         color: "text-blue-600 bg-blue-50"   },
    ];
    if (b.payment === "Paid" || b.payment === "Charged")
      evs.push({ label: "Payment Confirmed", time: b.time,           icon: CheckCircle2, color: "text-green-600 bg-green-50" });
    if (b.status === "confirmed")
      evs.push({ label: "Booking Confirmed", time: b.time,           icon: Check,        color: "text-blue-600 bg-blue-50"   });
    if (b.status === "checked-in" || b.status === "checked-out")
      evs.push({ label: "Checked In",        time: `${b.checkin}, 14:05`, icon: ArrowRight, color: "text-purple-600 bg-purple-50" });
    if (b.status === "checked-out")
      evs.push({ label: "Checked Out",       time: `${b.checkout}, 11:42`, icon: LogOut,  color: "text-slate-600 bg-slate-50" });
    if (b.status === "cancelled")
      evs.push({ label: "Booking Cancelled", time: b.checkin,        icon: X,            color: "text-red-600 bg-red-50"     });
    if (b.status === "no-show") {
      const now = new Date();
      const ts  = noShowSynced[b.id]
        ? `${now.getDate()} Jul ${now.getFullYear()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")} · Hotel Manager`
        : b.checkin;
      evs.push({ label: "No-show Marked", time: ts, icon: Ban, color: "text-orange-600 bg-orange-50" });
    }
    if (b.payment === "Refunded")
      evs.push({ label: "Refund Processed",  time: b.checkout,       icon: RotateCcw,    color: "text-slate-600 bg-slate-50" });
    return evs;
  };

  const sb = selectedBooking;

  return (
    <div>
      <PageHeader
        title="Booking Management"
        action={
          <div className="flex gap-2">
            <button className={btnSecondary}><Download size={13} /> Download</button>
            <button className={btnSecondary}><FileText size={13} /> Export</button>
          </div>
        }
      />

      {/* ── Compact filter bar ── */}
      <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3 mb-3 flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            className={cx(inputCls, "pl-8 w-52")}
            placeholder="Booking ID, guest, or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-px h-6 bg-[#e2e8f0] shrink-0" />

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-[#94a3b8] shrink-0" />
          <input type="date" className={cx(inputCls, "w-36 text-[12px]")} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-[#94a3b8] text-[11px] shrink-0">to</span>
          <input type="date" className={cx(inputCls, "w-36 text-[12px]")} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        <div className="w-px h-6 bg-[#e2e8f0] shrink-0" />

        {/* Hotel */}
        <select
          value={hotelFilter}
          onChange={(e) => { setHotelFilter(e.target.value); setSelectedBooking(null); setActiveTab("all"); }}
          className="px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-white cursor-pointer font-medium focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">All Hotels</option>
          {HOTEL_LIST.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>

        {/* More Filters */}
        <div className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={cx(btnSecondary, moreFilterCount > 0 ? "border-blue-400 text-blue-600 bg-blue-50" : "")}
          >
            <SlidersHorizontal size={13} /> More Filters
            {moreFilterCount > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {moreFilterCount}
              </span>
            )}
          </button>

          {moreOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
              <div className="absolute left-0 top-[calc(100%+6px)] z-30 bg-white border border-[#e2e8f0] rounded-[12px] shadow-lg p-4 w-72 flex flex-col gap-3">
                <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest">More Filters</p>
                <FormField label="Room Type">
                  <select className={selectCls} value={roomTypeFilter} onChange={(e) => setRoomTypeFilter(e.target.value)}>
                    <option value="">All Room Types</option>
                    {["Standard Room","Deluxe Room","Superior Suite","Pool Villa","Honeymoon Suite","Superior Room","Executive Room"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </FormField>
                <FormField label="Booking Status">
                  <select className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="checked-in">Checked-in</option>
                    <option value="checked-out">Checked-out</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no-show">No-show</option>
                  </select>
                </FormField>
                <FormField label="Payment Status">
                  <select className={selectCls} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                    <option value="">All Payment Statuses</option>
                    {["Paid","Pending","Refunded","Charged"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </FormField>
                <FormField label="Channel">
                  <select className={selectCls} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                    <option value="">All Channels</option>
                    {["mTrip","Expedia","Booking"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </FormField>
                <div className="flex justify-between pt-1">
                  <button onClick={() => { setRoomTypeFilter(""); setStatusFilter(""); setPaymentFilter(""); setChannelFilter(""); }} className={btnGhost}>Reset</button>
                  <button onClick={() => setMoreOpen(false)} className={btnPrimary}>Apply</button>
                </div>
              </div>
            </>
          )}
        </div>

        {anyFilter && (
          <button onClick={clearAll} className={cx(btnGhost, "ml-auto text-[#94a3b8]")}>
            <X size={11} /> Clear all
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-0 border-b border-[#e2e8f0] mb-3 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cx("px-4 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors",
              activeTab === tab.id ? "border-blue-600 text-blue-700" : "border-transparent text-[#64748b] hover:text-[#0f172a]")}>
            {tab.label}
            <span className={cx("ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold", activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-[#f1f5f9] text-[#64748b]")}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* ── Bookings Table ── */}
        <div className={cx("bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden flex-1 min-w-0", sb ? "max-w-[calc(100%-440px)]" : "")}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#f8fafc] text-[#64748b] font-semibold uppercase text-[10px] tracking-wide">
                  {["Booking ID", "Guest", ...(showHotelCol ? ["Hotel"] : []), "Room", "Dates", "Status", "Payment", "Channel", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={showHotelCol ? 9 : 8} className="px-4 py-12 text-center text-[13px] text-[#94a3b8]">
                      No bookings match the current filters.
                    </td>
                  </tr>
                ) : filtered.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedBooking(b === sb ? null : b)}
                    className={cx("border-t border-[#f1f5f9] cursor-pointer transition-colors", b === sb ? "bg-blue-50" : "hover:bg-[#f8fafc]")}
                  >
                    <td className="px-3 py-3 font-semibold text-blue-600">{b.id}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#eff6ff] flex items-center justify-center shrink-0">
                          <User size={10} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-[#0f172a]">{b.guest}</p>
                          {b.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">{b.tags.map((t) => <Badge key={t} label={t} variant="purple" />)}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {showHotelCol && (
                      <td className="px-3 py-3 text-[#64748b] max-w-[140px]">
                        <p className="truncate text-[11.5px]" title={b.hotel}>{b.hotel}</p>
                      </td>
                    )}
                    <td className="px-3 py-3 text-[#64748b]">{b.room}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="text-[11px] text-[#334155]">{b.checkin}</div>
                      <div className="text-[10px] text-[#94a3b8]">{b.checkout} · {b.nights}n</div>
                    </td>
                    <td className="px-3 py-3"><BookingStatusBadge status={b.status} /></td>
                    <td className="px-3 py-3"><PaymentBadge status={b.payment} /></td>
                    <td className="px-3 py-3 text-[#64748b]">{b.channel}</td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button className={btnGhost} onClick={() => setSelectedBooking(b)}><Eye size={11} /></button>
                        {b.status === "pending"    && <button className={btnGhost} title="Confirm"><Check size={11} /></button>}
                        {b.status === "confirmed"  && <button className={btnGhost} title="Check-in"><ArrowRight size={11} /></button>}
                        {b.status === "checked-in" && <button className={btnGhost} title="Check-out"><LogOut size={11} /></button>}
                        {["pending","confirmed"].includes(b.status) && <button className={btnGhost} title="Cancel"><X size={11} /></button>}
                        {["pending","confirmed"].includes(b.status) && (
                          <button
                            className={cx(btnGhost, "text-orange-500 hover:text-orange-700 hover:bg-orange-50")}
                            title="Mark as No-show"
                            onClick={(e) => { e.stopPropagation(); setNoShowBookingId(b.id); setNoShowModal(true); setNoShowNote(""); }}
                          ><Ban size={11} /></button>
                        )}
                        {b.status === "no-show"    && <button className={btnGhost} title="Waive"><RotateCcw size={11} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── No-show Confirmation Modal ── */}
        {noShowModal && noShowBookingId && (() => {
          const b = BOOKINGS_LIVE.find((x) => x.id === noShowBookingId);
          return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50"
              onClick={(e) => e.target === e.currentTarget && setNoShowModal(false)}>
              <div className="bg-white rounded-[16px] shadow-2xl w-[480px] overflow-hidden">

                {/* Modal header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[#e2e8f0]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                      <Ban size={16} className="text-orange-600" />
                    </div>
                    <div>
                      <h2 className="text-[14px] font-bold text-[#0f172a]">Mark Booking as No-show</h2>
                      <p className="text-[11.5px] text-[#64748b] mt-0.5">{b?.id} · {b?.guest} · {b?.hotel}</p>
                    </div>
                  </div>
                  <button onClick={() => setNoShowModal(false)} className="p-1.5 rounded-[6px] hover:bg-[#f1f5f9] transition-colors">
                    <X size={14} className="text-[#94a3b8]" />
                  </button>
                </div>

                <div className="px-6 py-5 flex flex-col gap-4">

                  {/* Explanation */}
                  <p className="text-[13px] text-[#475569] leading-relaxed">
                    The guest did not arrive before the hotel&apos;s check-in cut-off time.
                  </p>

                  {/* What this action will do */}
                  <div className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3.5">
                    <p className="text-[10.5px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2.5">This action will</p>
                    <ul className="flex flex-col gap-2">
                      {[
                        { icon: CheckCircle2, color: "text-orange-600", text: "Change booking status to No-show" },
                        { icon: CheckCircle2, color: "text-orange-600", text: "Release inventory according to the hotel's No-show Policy" },
                        { icon: CheckCircle2, color: "text-orange-600", text: "Synchronize booking status with PMS or Channel Manager if connected" },
                        { icon: CheckCircle2, color: "text-orange-600", text: "Apply settlement and commission calculations based on the hotel's configured No-show Policy" },
                      ].map(({ icon: Icon, color, text }) => (
                        <li key={text} className="flex items-start gap-2.5">
                          <Icon size={13} className={cx("shrink-0 mt-0.5", color)} />
                          <span className="text-[12.5px] text-[#334155] leading-snug">{text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Internal note */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#94a3b8] mb-1.5">Internal Note <span className="normal-case font-normal text-[#cbd5e1]">(Optional)</span></p>
                    <textarea
                      value={noShowNote}
                      onChange={(e) => setNoShowNote(e.target.value)}
                      rows={3}
                      placeholder={"Guest did not arrive.\nUnable to contact guest."}
                      className="w-full px-3 py-2 text-[12.5px] border border-[#e2e8f0] rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none placeholder:text-[#cbd5e1]"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[#e2e8f0] bg-[#fafafa]">
                  <button onClick={() => setNoShowModal(false)} className={btnSecondary}>Cancel</button>
                  <button
                    onClick={() => confirmNoShow(noShowBookingId!)}
                    className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-[8px] transition-colors"
                  >
                    <Ban size={13} /> Confirm No-show
                  </button>
                </div>

              </div>
            </div>
          );
        })()}

        {/* ── Booking Detail Drawer ── */}
        {sb && (() => {
          const bp = getPaymentBreakdown(sb);
          const timeline = getTimeline(sb);
          return (
            <div className="w-[430px] shrink-0 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col max-h-[calc(100vh-160px)] overflow-y-auto">

              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e8f0] sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13.5px] font-bold text-[#0f172a]">{sb.id}</span>
                  <BookingStatusBadge status={sb.status} />
                </div>
                <button onClick={() => setSelectedBooking(null)} className="p-1 rounded-[6px] hover:bg-[#f1f5f9] transition-colors">
                  <X size={14} className="text-[#64748b]" />
                </button>
              </div>

              <div className="divide-y divide-[#f1f5f9]">

                {/* ── 1. Booking Summary ── */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">Booking Summary</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {([
                      ["Booking ID",  sb.id],
                      ["Hotel",       sb.hotel],
                      ["Room Type",   sb.room],
                      ["Channel",     sb.channel],
                      ["Check-in",    sb.checkin],
                      ["Check-out",   sb.checkout],
                      ["Duration",    `${sb.nights} night${sb.nights > 1 ? "s" : ""}`],
                      ["Guests",      "2 Adults"],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">{k}</p>
                        <p className="text-[12px] font-medium text-[#0f172a] mt-0.5 leading-snug">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 2. Guest Information ── */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">Guest Information</p>
                  <div className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-[8px]">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <User size={15} className="text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#0f172a]">
                        {sb.guest}{sb.tags.length > 0 ? ` · ${sb.tags.join(", ")}` : ""}
                      </p>
                      <p className="text-[11px] text-[#94a3b8] mt-0.5">Contact details visible at check-in</p>
                    </div>
                  </div>
                  {sb.tags.includes("VIP") && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-[7px]">
                      <Star size={11} className="text-amber-500 shrink-0 fill-amber-400" />
                      <p className="text-[11px] text-amber-800 font-medium">VIP guest — prioritise room assignment and welcome amenities</p>
                    </div>
                  )}
                </div>

                {/* ── 3. Payment Summary ── */}
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">Payment Summary</p>
                    <PaymentBadge status={sb.payment} />
                  </div>
                  <div className="rounded-[8px] border border-[#e2e8f0] overflow-hidden text-[12px]">
                    {([
                      { label: "Room Total",      value: `THB ${bp.roomTotal.toLocaleString()}`,   red: false },
                      { label: "Breakfast",        value: `THB ${bp.breakfast.toLocaleString()}`,   red: false },
                      { label: "Extra Bed",        value: bp.extraBed > 0 ? `THB ${bp.extraBed.toLocaleString()}` : "—", red: false },
                      { label: "VAT (7%)",         value: `THB ${bp.taxes.toLocaleString()}`,       red: false },
                      { label: "Commission (15%)", value: `−THB ${bp.commission.toLocaleString()}`, red: true  },
                    ]).map(({ label, value, red }) => (
                      <div key={label} className="flex justify-between items-center px-3 py-2 border-b border-[#f1f5f9]">
                        <span className="text-[#64748b]">{label}</span>
                        <span className={cx("font-medium", red ? "text-red-600" : "text-[#334155]")}>{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-3 py-2.5 bg-[#f8fafc]">
                      <span className="font-bold text-[#0f172a]">Net Payout</span>
                      <span className="font-bold text-green-700">THB {bp.netPayout.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* ── 4. Stay Details ── */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">Stay Details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3">
                    <div>
                      <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">Meal Plan</p>
                      <p className="text-[12px] font-medium text-[#0f172a] mt-0.5">Breakfast Included</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">Extra Bed</p>
                      <p className="text-[12px] font-medium text-[#0f172a] mt-0.5">Not Requested</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide mb-1.5">Special Requests</p>
                    <p className="text-[12px] text-[#64748b] italic leading-relaxed">
                      {sb.tags.includes("Honeymoon")
                        ? "Honeymoon setup — rose petals, champagne on arrival, and late checkout requested."
                        : sb.tags.includes("VIP")
                        ? "High floor preferred. Executive lounge access and early check-in requested."
                        : "No special requests noted."}
                    </p>
                  </div>
                </div>

                {/* ── 5. Internal Notes ── */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2.5">Internal Notes</p>
                  <textarea
                    className={cx(inputCls, "resize-none h-16 text-[12px] w-full")}
                    placeholder="Add an internal note visible only to staff..."
                    value={notes}
                    onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-[#94a3b8]">Staff-only · Not visible to guests</span>
                    <button onClick={() => setNotesSaved(true)} className={cx(btnGhost, "text-[11px]")}>
                      {notesSaved
                        ? <><CheckCircle2 size={11} className="text-green-500" /> Saved</>
                        : "Save Note"}
                    </button>
                  </div>
                </div>

                {/* ── 6. Booking Timeline ── */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">Booking Timeline</p>
                  <div className="relative pl-1">
                    <div className="absolute left-[10px] top-3 bottom-3 w-px bg-[#e2e8f0]" />
                    <div className="flex flex-col gap-3.5">
                      {timeline.map((ev, i) => {
                        const Icon = ev.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 relative">
                            <div className={cx("w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 z-10", ev.color)}>
                              <Icon size={10} />
                            </div>
                            <div>
                              <p className="text-[12px] font-medium text-[#0f172a] leading-tight">{ev.label}</p>
                              <p className="text-[10.5px] text-[#94a3b8] mt-0.5">{ev.time}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── 7. Sync Status ── */}
                {(() => {
                  const synced = noShowSynced[sb.id];
                  const now    = new Date();
                  const ts     = `${now.getDate()} Jul ${now.getFullYear()}, ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
                  return (
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2.5">Sync Status</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-[6px] text-[11px] text-green-700 font-medium">
                          <CheckCircle2 size={10} />
                          PMS: Synced{synced ? ` · ${ts}` : ""}
                        </span>
                        {synced ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-[6px] text-[11px] text-green-700 font-medium">
                            <CheckCircle2 size={10} />
                            Channel Manager: Synced · {ts}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-[6px] text-[11px] text-gray-500 font-medium">
                            <AlertCircle size={10} />CM: Not Connected
                          </span>
                        )}
                        <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-[6px] text-[11px] text-blue-700 font-medium hover:bg-blue-100 transition-colors">
                          <RefreshCw size={10} />Force Sync
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── 8. Actions (status-contextual) ── */}
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2.5">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {sb.status === "pending" && (
                      <button className={btnPrimary}><Check size={13} /> Confirm Booking</button>
                    )}
                    {sb.status === "confirmed" && (
                      <button className={btnPrimary}><ArrowRight size={13} /> Check-in</button>
                    )}
                    {sb.status === "checked-in" && (
                      <button className={btnPrimary}><LogOut size={13} /> Check-out</button>
                    )}
                    {["pending","confirmed"].includes(sb.status) && (
                      <button className={cx(btnSecondary, "text-red-600 border-red-200 hover:bg-red-50")}>
                        <X size={13} /> Cancel Booking
                      </button>
                    )}
                    {["pending","confirmed"].includes(sb.status) && (
                      <button
                        className={cx(btnSecondary, "text-orange-600 border-orange-200 hover:bg-orange-50")}
                        onClick={() => { setNoShowBookingId(sb.id); setNoShowModal(true); setNoShowNote(""); }}
                      >
                        <Ban size={13} /> Mark as No-show
                      </button>
                    )}
                    {sb.payment === "Paid" && (sb.status === "cancelled" || sb.status === "checked-out") && (
                      <button className={btnSecondary}><RotateCcw size={13} /> Refund</button>
                    )}
                    {sb.status === "no-show" && (
                      <button className={btnSecondary}><RotateCcw size={13} /> Waive Fee</button>
                    )}
                    <button className={btnGhost}><Download size={12} /> Voucher</button>
                    <button className={btnGhost}><MessageSquare size={12} /> Message Guest</button>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Screen 6: Notifications ──────────────────────────────────────────────────

function NotificationsScreen({
  initialTab,
  navigate,
}: {
  initialTab: string;
  navigate: (dest: ScreenId, opts?: Record<string, string>) => void;
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "all");
  const [notifs, setNotifs] = useState(NOTIFICATIONS);
  const [search, setSearch] = useState("");

  const TABS = [
    { id: "all", label: "All" },
    { id: "booking-notifications", label: "Booking Notifications" },
    { id: "sync-alerts", label: "Sync Alerts" },
    { id: "system-logs", label: "System Logs" },
    { id: "platform-announcements", label: "Platform Announcements" },
  ];

  const markAllRead = () => setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));

  const notifTypeIcon = (type: string) => {
    const map: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
      booking: { icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50" },
      checkin: { icon: ArrowRight, color: "text-purple-600", bg: "bg-purple-50" },
      inventory: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
      "sync-error": { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
      settlement: { icon: Banknote, color: "text-green-600", bg: "bg-green-50" },
      review: { icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
      cancellation: { icon: X, color: "text-red-600", bg: "bg-red-50" },
    };
    return map[type] || { icon: Bell, color: "text-gray-600", bg: "bg-gray-50" };
  };

  const filtered = notifs.filter((n) => {
    const matchTab =
      activeTab === "all" ? true :
      activeTab === "booking-notifications" ? ["booking", "checkin", "cancellation"].includes(n.type) :
      activeTab === "sync-alerts" ? ["sync-error", "inventory"].includes(n.type) :
      activeTab === "system-logs" ? ["settlement"].includes(n.type) : true;
    return matchTab && (!search || n.title.toLowerCase().includes(search.toLowerCase()) || n.message.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay on top of operational events and alerts"
        action={<button onClick={markAllRead} className={btnSecondary}><CheckSquare size={13} /> Mark All Read</button>}
      />

      <div className="flex gap-0 border-b border-[#e2e8f0] mb-4">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cx("px-4 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors",
              activeTab === tab.id ? "border-blue-600 text-blue-700" : "border-transparent text-[#64748b] hover:text-[#0f172a]")}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input className={cx(inputCls, "pl-8 w-56")} placeholder="Search notifications..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-white cursor-pointer"><option>All Types</option></select>
        <button className={btnGhost}><Filter size={11} /> Unread Only</button>
      </div>

      {activeTab === "sync-alerts" && (
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#f1f5f9]">
            <p className="text-[13px] font-bold text-[#0f172a]">Sync Error Log</p>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#f8fafc] text-[#64748b] font-semibold uppercase text-[10px] tracking-wide">
                {["Alert Type", "Description", "Hotel", "Time", "Status", "Action"].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { type: "PMS Sync Failed", desc: "Connection timeout after 30s", hotel: "The Horizon Resort", time: "23 Jul, 14:02", status: "Active" },
                { type: "Inventory Sync Warning", desc: "Rate parity discrepancy detected", hotel: "The Horizon Resort", time: "23 Jul, 06:00", status: "Resolved" },
              ].map((row) => (
                <tr key={row.type} className="border-t border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3 font-semibold text-red-600">{row.type}</td>
                  <td className="px-4 py-3 text-[#334155]">{row.desc}</td>
                  <td className="px-4 py-3 text-[#64748b]">{row.hotel}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{row.time}</td>
                  <td className="px-4 py-3"><Badge label={row.status} variant={row.status === "Active" ? "red" : "green"} /></td>
                  <td className="px-4 py-3"><button className={btnGhost}><RefreshCw size={11} /> Retry</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((n) => {
          const { icon: Icon, color, bg } = notifTypeIcon(n.type);
          return (
            <div key={n.id} className={cx("flex items-start gap-4 p-4 bg-white rounded-[12px] border transition-all", n.read ? "border-[#e2e8f0]" : "border-blue-100 bg-blue-50/30")}>
              <div className={cx("w-9 h-9 rounded-full flex items-center justify-center shrink-0", bg)}>
                <Icon size={15} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cx("text-[13px] font-semibold", n.read ? "text-[#334155]" : "text-[#0f172a]")}>{n.title}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge label={n.read ? "Read" : "Unread"} variant={n.read ? "gray" : "blue"} />
                    <Badge label={n.module} variant="slate" />
                  </div>
                </div>
                <p className="text-[12px] text-[#64748b] mt-0.5">{n.message}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-[#94a3b8]">{n.hotel}</span>
                  <span className="text-[#cbd5e1]">·</span>
                  <span className="text-[11px] text-[#94a3b8]">{n.time}</span>
                  <button onClick={() => navigate(n.module as ScreenId)} className={cx(btnGhost, "ml-auto")}><ExternalLink size={11} /> View</button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#94a3b8]">
            <Inbox size={24} className="mx-auto mb-2" />
            <p className="text-[13px]">No notifications found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screen 7: Earnings ───────────────────────────────────────────────────────

// ─── Earnings modal panels ────────────────────────────────────────────────────

type EarningsPanel =
  | "revenue-details" | "revenue-analytics" | "booking-revenue" | "commission-details"
  | "settlement-details" | "settlement-pending" | "occupancy-report" | "booking-analytics"
  | "room-performance" | "appeal" | null;

const EARNINGS_PANEL_META: Record<Exclude<EarningsPanel, null>, { title: string; subtitle: string; icon: React.ElementType; color: string; bg: string }> = {
  "revenue-details":     { title: "Revenue Details",                  subtitle: "Gross revenue breakdown for the selected period",     icon: DollarSign,    color: "text-green-600",  bg: "bg-green-50"  },
  "revenue-analytics":   { title: "Revenue Analytics",                subtitle: "ADR trends, RevPAR, and rate performance insights",   icon: TrendingUp,    color: "text-teal-600",   bg: "bg-teal-50"   },
  "booking-revenue":     { title: "Booking Revenue Report",           subtitle: "Gross bookings before commissions and deductions",    icon: Banknote,      color: "text-cyan-600",   bg: "bg-cyan-50"   },
  "commission-details":  { title: "Commission Details",               subtitle: "Platform fees and commission breakdown by channel",   icon: Percent,       color: "text-orange-600", bg: "bg-orange-50" },
  "settlement-details":  { title: "Settlement Details",               subtitle: "Full settlement statement for the selected period",   icon: FileText,      color: "text-blue-600",   bg: "bg-blue-50"   },
  "settlement-pending":  { title: "Settlement & Payout Records",      subtitle: "Filtered by: Pending status",                        icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50"  },
  "occupancy-report":    { title: "Occupancy Report",                 subtitle: "Daily and period occupancy rates across properties",  icon: PieChart,      color: "text-indigo-600", bg: "bg-indigo-50" },
  "booking-analytics":   { title: "Booking Analytics",                subtitle: "Booking volume trends, lead time, and channels",     icon: ClipboardList, color: "text-violet-600", bg: "bg-violet-50" },
  "room-performance":    { title: "Room Performance Report",          subtitle: "Revenue, ADR, and occupancy by room type",           icon: BedDouble,     color: "text-amber-600",  bg: "bg-amber-50"  },
  "appeal":              { title: "Report Settlement Issue / Appeal", subtitle: "Submit a dispute or correction request for this settlement", icon: Flag,   color: "text-red-600",    bg: "bg-red-50"    },
};

const SETTLEMENT_ROWS: Record<string, { label: string; value: string; sign?: "neg" | "pos" | "neutral" }[]> = {
  "STL-2406": [
    { label: "Gross Revenue",        value: "THB 192,340", sign: "pos" },
    { label: "Promotional Discount", value: "−THB 5,200",  sign: "neg" },
    { label: "mTrip Subsidy",     value: "+THB 1,500",  sign: "pos" },
    { label: "Commission (15%)",     value: "−THB 28,851", sign: "neg" },
    { label: "Other Deductions",     value: "−THB 2,100",  sign: "neg" },
    { label: "VAT (7%)",             value: "−THB 13,464", sign: "neg" },
    { label: "Net Payable",          value: "THB 134,640", sign: "pos" },
  ],
  "STL-2405": [
    { label: "Gross Revenue",        value: "THB 178,200", sign: "pos" },
    { label: "Promotional Discount", value: "−THB 3,800",  sign: "neg" },
    { label: "mTrip Subsidy",     value: "+THB 2,000",  sign: "pos" },
    { label: "Commission (15%)",     value: "−THB 26,730", sign: "neg" },
    { label: "Other Deductions",     value: "−THB 1,500",  sign: "neg" },
    { label: "VAT (7%)",             value: "−THB 12,474", sign: "neg" },
    { label: "Net Payable",          value: "THB 122,696", sign: "pos" },
  ],
  "STL-2407": [
    { label: "Gross Revenue",        value: "THB 160,500", sign: "pos" },
    { label: "Promotional Discount", value: "−THB 4,100",  sign: "neg" },
    { label: "mTrip Subsidy",     value: "+THB 900",    sign: "pos" },
    { label: "Commission (15%)",     value: "−THB 24,075", sign: "neg" },
    { label: "Other Deductions",     value: "−THB 800",    sign: "neg" },
    { label: "VAT (7%)",             value: "−THB 11,235", sign: "neg" },
    { label: "Net Payable",          value: "THB 54,700",  sign: "pos" },
  ],
};

function EarningsPanel({ panel, settlementId, onClose, navigate }: {
  panel: Exclude<EarningsPanel, null>;
  settlementId?: string;
  onClose: () => void;
  navigate: (dest: ScreenId, opts?: Record<string, string>) => void;
}) {
  const meta = EARNINGS_PANEL_META[panel];
  const Icon = meta.icon;
  const rows = settlementId ? SETTLEMENT_ROWS[settlementId] : null;

  const isSettlement = panel === "settlement-details" && settlementId;
  const isAppeal     = panel === "appeal";
  const isPending    = panel === "settlement-pending";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-[16px] shadow-2xl w-[520px] max-h-[88vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-3">
            <div className={cx("w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0", meta.bg)}>
              <Icon size={16} className={meta.color} />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-[#0f172a]">{meta.title}{isSettlement ? ` · ${settlementId}` : ""}</h2>
              <p className="text-[11.5px] text-[#64748b] mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[7px] hover:bg-[#f1f5f9] transition-colors ml-3 shrink-0">
            <X size={14} className="text-[#94a3b8]" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Settlement detail rows */}
          {isSettlement && rows && (
            <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden text-[12px]">
              {rows.map(({ label, value, sign }, i) => {
                const isLast = i === rows.length - 1;
                return (
                  <div key={label} className={cx("flex justify-between items-center px-4 py-2.5", isLast ? "bg-[#f8fafc] border-t border-[#e2e8f0]" : "border-b border-[#f8fafc]")}>
                    <span className={isLast ? "font-bold text-[#0f172a]" : "text-[#64748b]"}>{label}</span>
                    <span className={cx("font-semibold", sign === "neg" ? "text-red-600" : sign === "pos" && !isLast ? "text-green-600" : isLast ? "text-green-700 font-bold" : "text-[#334155]")}>{value}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending payout filter view */}
          {isPending && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-[8px]">
                <Clock size={12} className="text-amber-600 shrink-0" />
                <span className="text-[12px] text-amber-800 font-medium">1 settlement pending · THB 54,700 awaiting transfer</span>
              </div>
              <div className="rounded-[10px] border border-[#e2e8f0] overflow-hidden text-[12px]">
                <div className="flex justify-between items-center px-4 py-3 bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <span className="font-semibold text-[#0f172a]">STL-2407 · Jul 2026</span>
                  <Badge label="Pending" variant="yellow" />
                </div>
                {SETTLEMENT_ROWS["STL-2407"].map(({ label, value, sign }, i) => (
                  <div key={label} className="flex justify-between items-center px-4 py-2.5 border-b border-[#f8fafc]">
                    <span className="text-[#64748b]">{label}</span>
                    <span className={cx("font-medium", sign === "neg" ? "text-red-600" : sign === "pos" ? "text-green-600" : "text-[#334155]")}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Appeal form */}
          {isAppeal && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-[8px]">
                <AlertCircle size={13} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-800">Please describe the discrepancy or issue with this settlement. Our finance team will review within 3–5 business days.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#334155]">Settlement ID</label>
                <input className="px-3 py-2 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc]" defaultValue={settlementId || ""} readOnly />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#334155]">Issue Type</label>
                <select className="px-3 py-2 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-white focus:outline-none cursor-pointer">
                  <option>Incorrect commission amount</option>
                  <option>Missing booking revenue</option>
                  <option>Incorrect deduction applied</option>
                  <option>Payout not received</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-[#334155]">Description</label>
                <textarea rows={3} className="px-3 py-2 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="Describe the issue in detail…" />
              </div>
            </div>
          )}

          {/* Generic detail view for analytics/report panels */}
          {!isSettlement && !isPending && !isAppeal && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-[8px]">
                <Info size={13} className="text-blue-600 shrink-0" />
                <p className="text-[12px] text-blue-800">This report is available in the full analytics module. Below is a summary for the current period.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {panel === "revenue-details" && ([
                  ["Room Revenue",      "THB 128,400"],["F&B Revenue",     "THB 18,200"],
                  ["Ancillary Revenue", "THB 13,900"], ["Total Gross",     "THB 160,500"],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="px-3 py-3 border border-[#e2e8f0] rounded-[8px]">
                    <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">{k}</p>
                    <p className="text-[14px] font-bold text-[#0f172a] mt-1">{v}</p>
                  </div>
                ))}
                {panel === "revenue-analytics" && ([
                  ["ADR",    "THB 3,420"],["RevPAR",     "THB 2,668"],
                  ["TRevPAR","THB 3,100"],["MoM Change",    "+8.4%"],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="px-3 py-3 border border-[#e2e8f0] rounded-[8px]">
                    <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">{k}</p>
                    <p className="text-[14px] font-bold text-[#0f172a] mt-1">{v}</p>
                  </div>
                ))}
                {panel === "booking-revenue" && ([
                  ["Gross Bookings",   "THB 192,600"],["Cancellations",     "−THB 12,200"],
                  ["No-show Revenue",  "THB 8,400"],  ["Net Bookings",      "THB 188,800"],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="px-3 py-3 border border-[#e2e8f0] rounded-[8px]">
                    <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">{k}</p>
                    <p className="text-[14px] font-bold text-[#0f172a] mt-1">{v}</p>
                  </div>
                ))}
                {panel === "commission-details" && ([
                  ["mTrip Commission",   "THB 19,200"],["Booking.com Fee",    "THB 8,400"],
                  ["Expedia Fee",        "THB 4,500"],  ["Total Commission",  "THB 32,100"],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="px-3 py-3 border border-[#e2e8f0] rounded-[8px]">
                    <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">{k}</p>
                    <p className="text-[14px] font-bold text-[#0f172a] mt-1">{v}</p>
                  </div>
                ))}
                {panel === "occupancy-report" && ([
                  ["Avg Occupancy",  "78%"],  ["Peak Day",        "Fri 19 Jul · 96%"],
                  ["Total Room Nights","98"], ["Rooms Available", "126"],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="px-3 py-3 border border-[#e2e8f0] rounded-[8px]">
                    <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">{k}</p>
                    <p className="text-[14px] font-bold text-[#0f172a] mt-1">{v}</p>
                  </div>
                ))}
                {panel === "booking-analytics" && ([
                  ["Total Bookings", "41"],  ["Cancellations",  "3"],
                  ["Lead Time Avg",  "8 days"],["Top Channel",  "Booking.com"],
                ] as [string,string][]).map(([k,v]) => (
                  <div key={k} className="px-3 py-3 border border-[#e2e8f0] rounded-[8px]">
                    <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">{k}</p>
                    <p className="text-[14px] font-bold text-[#0f172a] mt-1">{v}</p>
                  </div>
                ))}
                {panel === "room-performance" && ROOM_TYPES.map((r) => (
                  <div key={r.id} className="px-3 py-3 border border-[#e2e8f0] rounded-[8px]">
                    <p className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wide">{r.name}</p>
                    <p className="text-[14px] font-bold text-[#0f172a] mt-1">THB {(r.price * r.total * 0.7 / 1000).toFixed(0)}K</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 px-6 py-4 border-t border-[#e2e8f0]">
          {isAppeal ? (
            <>
              <button onClick={onClose} className={btnSecondary}>Cancel</button>
              <button onClick={onClose} className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-[8px] transition-colors">
                <Flag size={13} /> Submit Appeal
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className={btnSecondary}>Close</button>
              <button
                onClick={() => { onClose(); navigate("bookings"); }}
                className={btnGhost}
              >
                <ExternalLink size={12} /> View in Bookings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EarningsScreen({ navigate }: { navigate: (dest: ScreenId, opts?: Record<string, string>) => void }) {
  const [period, setPeriod]             = useState("7d");
  const [panel, setPanel]               = useState<EarningsPanel>(null);
  const [settlementId, setSettlementId] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [toast, setToast]               = useState(false);
  // Role simulation — cycle with click for prototype purposes
  const [role, setRole]                 = useState<"owner" | "manager" | "officer">("owner");

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  const openPanel = (p: Exclude<EarningsPanel, null>, stl?: string) => {
    setSettlementId(stl);
    setPanel(p);
  };

  const ROLE_LABELS: Record<typeof role, string> = {
    owner:   "Hotel Owner",
    manager: "Hotel Manager",
    officer: "Reservation Officer",
  };

  const KPI_ROWS: { label: string; value: string; sub: string; icon: React.ElementType; color: string; bg: string; onClick: () => void }[][] = [
    [
      { label: "Booking Volume", value: "41",          sub: "bookings",          icon: ClipboardList, color: "text-blue-600",   bg: "bg-blue-50",   onClick: () => navigate("bookings") },
      { label: "Room Nights",    value: "98",          sub: "nights sold",       icon: BedDouble,     color: "text-purple-600", bg: "bg-purple-50", onClick: () => navigate("bookings", { bookingTab: "checked-out" }) },
      { label: "Occupancy Rate", value: "78%",         sub: "avg this period",   icon: PieChart,      color: "text-indigo-600", bg: "bg-indigo-50", onClick: () => openPanel("occupancy-report") },
    ],
    [
      { label: "Revenue",        value: "THB 160.5K",  sub: "gross revenue",     icon: DollarSign,    color: "text-green-600",  bg: "bg-green-50",  onClick: () => openPanel("revenue-details") },
      { label: "ADR",            value: "THB 3,420",   sub: "avg daily rate",    icon: TrendingUp,    color: "text-teal-600",   bg: "bg-teal-50",   onClick: () => openPanel("revenue-analytics") },
      { label: "Gross Bookings", value: "THB 192.6K",  sub: "before deductions", icon: Banknote,      color: "text-cyan-600",   bg: "bg-cyan-50",   onClick: () => openPanel("booking-revenue") },
    ],
    [
      { label: "Commission",     value: "THB 32.1K",   sub: "platform fee",      icon: Percent,       color: "text-orange-600", bg: "bg-orange-50", onClick: () => openPanel("commission-details") },
      { label: "Net Settlement", value: "THB 128.4K",  sub: "after deductions",  icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50",  onClick: () => openPanel("settlement-details", "STL-2406") },
      { label: "Pending Payout", value: "THB 54.7K",   sub: "awaiting transfer", icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",  onClick: () => openPanel("settlement-pending") },
    ],
  ];

  const SETTLEMENTS = [
    { id: "STL-2406", period: "Jun 2026", gross: "THB 192,340", discount: "THB 5,200", subsidy: "THB 1,500", commission: "THB 28,851", deduction: "THB 2,100", tax: "THB 13,464", net: "THB 134,640", payout: "22 Jul 2026", status: "Paid" },
    { id: "STL-2405", period: "May 2026", gross: "THB 178,200", discount: "THB 3,800", subsidy: "THB 2,000", commission: "THB 26,730", deduction: "THB 1,500", tax: "THB 12,474", net: "THB 122,696", payout: "20 Jun 2026", status: "Paid" },
    { id: "STL-2407", period: "Jul 2026", gross: "THB 160,500", discount: "THB 4,100", subsidy: "THB 900",   commission: "THB 24,075", deduction: "THB 800",   tax: "THB 11,235", net: "THB 54,700",  payout: "Pending",     status: "Pending" },
  ];

  const visibleSettlements = statusFilter
    ? SETTLEMENTS.filter((s) => s.status === statusFilter)
    : SETTLEMENTS;

  const TOP_ROOMS = ROOM_TYPES.map((r) => ({ name: r.name.replace(" Room", "").replace(" Suite", " Ste"), revenue: r.price * r.total * 0.7 }));

  // ── Access Denied guard ──
  if (role === "officer") {
    return (
      <div>
        <PageHeader title="Business Dashboard & Earnings" subtitle="Financial overview and settlement records" />
        <div className="mt-8 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-[16px] bg-red-50 border border-red-200 flex items-center justify-center mb-4">
            <Shield size={28} className="text-red-500" />
          </div>
          <h2 className="text-[18px] font-bold text-[#0f172a] mb-2">Access Denied</h2>
          <p className="text-[13px] text-[#64748b] max-w-xs leading-relaxed mb-5">
            This module is restricted to <strong>Hotel Owner</strong> and <strong>Hotel Manager</strong> roles only.
            Please contact your administrator if you require access.
          </p>
          <div className="flex gap-2">
            <button onClick={() => navigate("dashboard")} className={btnSecondary}>← Back to Dashboard</button>
            {/* Role switcher — prototype only */}
            <button onClick={() => setRole("owner")} className={btnGhost}>
              <UserPlus size={12} /> Switch Role (Prototype)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 px-4 py-3 bg-[#0f172a] text-white rounded-[10px] shadow-xl text-[12.5px] font-medium">
          <CheckCircle2 size={14} className="text-green-400 shrink-0" />
          Settlement report exported successfully.
        </div>
      )}

      {/* Panel modal */}
      {panel && (
        <EarningsPanel
          panel={panel}
          settlementId={settlementId}
          onClose={() => setPanel(null)}
          navigate={navigate}
        />
      )}

      <PageHeader
        title="Business Dashboard & Earnings"
        subtitle="Financial overview and settlement records"
        action={
          <div className="flex gap-2 items-center">
            {/* Role switcher — prototype only */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#e2e8f0] rounded-[7px] text-[11px] text-[#64748b] bg-white">
              <UserPlus size={11} />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="bg-transparent text-[11px] font-medium text-[#334155] focus:outline-none cursor-pointer"
              >
                <option value="owner">Hotel Owner</option>
                <option value="manager">Hotel Manager</option>
                <option value="officer">Reservation Officer</option>
              </select>
            </div>
            <div className="flex gap-1 p-1 bg-[#f1f5f9] rounded-[8px]">
              {["7d", "30d", "MTD", "YTD"].map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={cx("px-3 py-1 text-[12px] font-semibold rounded-[6px] transition-colors",
                    period === p ? "bg-white shadow-sm text-[#0f172a]" : "text-[#64748b] hover:bg-white")}>
                  {p}
                </button>
              ))}
            </div>
            <button className={btnSecondary} onClick={showToast}><Download size={13} /> Export</button>
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-[10px]">
        <Shield size={14} className="text-blue-600 shrink-0" />
        <span className="text-[12px] text-blue-700">
          Financial data visible to: <strong>Hotel Owner</strong>, <strong>Hotel Manager</strong> only
          &nbsp;·&nbsp; Current role: <strong>{ROLE_LABELS[role]}</strong>
        </span>
      </div>

      {/* KPI cards — clickable */}
      {KPI_ROWS.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-3 mb-3">
          {row.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <button
                key={kpi.label}
                onClick={kpi.onClick}
                className="bg-white rounded-[12px] border border-[#e2e8f0] p-5 text-left hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={cx("w-9 h-9 rounded-[8px] flex items-center justify-center", kpi.bg)}>
                    <Icon size={16} className={kpi.color} />
                  </div>
                  <ArrowRight size={12} className="text-[#cbd5e1] group-hover:text-blue-400 transition-colors" />
                </div>
                <div className="text-[22px] font-bold text-[#0f172a] leading-tight">{kpi.value}</div>
                <div className="text-[11px] font-semibold text-[#64748b] mt-0.5">{kpi.label}</div>
                <div className="text-[10px] text-[#94a3b8]">{kpi.sub}</div>
              </button>
            );
          })}
        </div>
      ))}

      {/* Charts — clickable headers */}
      <div className="grid grid-cols-2 gap-4 mb-5 mt-2">
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <button onClick={() => openPanel("revenue-analytics")} className="flex items-center justify-between w-full mb-2 group">
            <p className="text-[12px] font-semibold text-[#64748b] group-hover:text-blue-600 transition-colors">Revenue Trend (THB)</p>
            <ExternalLink size={11} className="text-[#cbd5e1] group-hover:text-blue-400 transition-colors" />
          </button>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={WEEK_DATA} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="revenue" stroke="#059669" fill="#d1fae5" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <button onClick={() => openPanel("occupancy-report")} className="flex items-center justify-between w-full mb-2 group">
            <p className="text-[12px] font-semibold text-[#64748b] group-hover:text-blue-600 transition-colors">Occupancy Rate (%)</p>
            <ExternalLink size={11} className="text-[#cbd5e1] group-hover:text-blue-400 transition-colors" />
          </button>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={WEEK_DATA} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="occ" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <button onClick={() => openPanel("booking-analytics")} className="flex items-center justify-between w-full mb-2 group">
            <p className="text-[12px] font-semibold text-[#64748b] group-hover:text-blue-600 transition-colors">Booking Volume</p>
            <ExternalLink size={11} className="text-[#cbd5e1] group-hover:text-blue-400 transition-colors" />
          </button>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={WEEK_DATA} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Line type="monotone" dataKey="bookings" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
          <button onClick={() => openPanel("room-performance")} className="flex items-center justify-between w-full mb-2 group">
            <p className="text-[12px] font-semibold text-[#64748b] group-hover:text-blue-600 transition-colors">Top Room Types by Revenue</p>
            <ExternalLink size={11} className="text-[#cbd5e1] group-hover:text-blue-400 transition-colors" />
          </button>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart layout="vertical" data={TOP_ROOMS} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="revenue" fill="#d97706" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Settlement & Payout Records */}
      <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-3">
            <p className="text-[14px] font-bold text-[#0f172a]">Settlement & Payout Records</p>
            {/* Status filter chips */}
            <div className="flex gap-1">
              {[null, "Paid", "Pending"].map((s) => (
                <button
                  key={String(s)}
                  onClick={() => setStatusFilter(s)}
                  className={cx(
                    "px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all",
                    statusFilter === s
                      ? s === "Paid"    ? "bg-green-100 border-green-400 text-green-700"
                      : s === "Pending" ? "bg-amber-100 border-amber-400 text-amber-700"
                      :                  "bg-[#0f172a] border-[#0f172a] text-white"
                      : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]"
                  )}
                >
                  {s === null ? "All" : s}
                </button>
              ))}
            </div>
          </div>
          <button onClick={showToast} className={btnSecondary}><Download size={13} /> Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#f8fafc] text-[#64748b] font-semibold uppercase text-[10px] tracking-wide">
                {["Settlement ID", "Period", "Gross", "Discount", "mTrip Subsidy", "Commission", "Deduction", "Tax", "Net Payable", "Payout Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleSettlements.map((s) => (
                <tr key={s.id} className="border-t border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                  <td className="px-3 py-3">
                    <button onClick={() => openPanel("settlement-details", s.id)} className="font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                      {s.id}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[#334155]">{s.period}</td>
                  <td className="px-3 py-3 text-[#334155]">{s.gross}</td>
                  <td className="px-3 py-3 text-red-600">{s.discount}</td>
                  <td className="px-3 py-3 text-green-600">{s.subsidy}</td>
                  <td className="px-3 py-3 text-red-600">{s.commission}</td>
                  <td className="px-3 py-3 text-red-600">{s.deduction}</td>
                  <td className="px-3 py-3 text-[#64748b]">{s.tax}</td>
                  <td className="px-3 py-3 font-bold text-[#0f172a]">{s.net}</td>
                  <td className="px-3 py-3 text-[#64748b]">{s.payout}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => setStatusFilter(statusFilter === s.status ? null : s.status)}
                      className="transition-opacity hover:opacity-80"
                      title={`Filter by ${s.status}`}
                    >
                      <Badge label={s.status} variant={s.status === "Paid" ? "green" : s.status === "Processing" ? "blue" : "yellow"} />
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button title="View Settlement Details" onClick={() => openPanel("settlement-details", s.id)} className={btnGhost}><Eye size={10} /></button>
                      <button title="Download Statement"      onClick={showToast} className={btnGhost}><Download size={10} /></button>
                      <button title="Report Issue / Appeal"   onClick={() => openPanel("appeal", s.id)} className={cx(btnGhost, "hover:text-red-600 hover:bg-red-50")}><Flag size={10} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleSettlements.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-[12px] text-[#94a3b8]">No settlements match the selected filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Coming Soon ──────────────────────────────────────────────────────────────

function ComingSoonScreen({ title, icon: Icon, phase = "2" }: { title: string; icon: React.ElementType; phase?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-[16px] bg-[#f1f5f9] flex items-center justify-center mb-4">
        <Icon size={28} className="text-[#94a3b8]" />
      </div>
      <h2 className="text-[18px] font-bold text-[#0f172a] mb-2">{title}</h2>
      <p className="text-[13px] text-[#64748b] mb-4 text-center max-w-xs">
        This module is not yet available in the current phase. It will be launched in a future release.
      </p>
      <span className="inline-flex items-center px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[12px] font-semibold text-amber-700">
        Coming in Phase {phase}
      </span>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("dashboard");
  const [bookingTab, setBookingTab] = useState("all");
  const [notifTab, setNotifTab] = useState("all");
  const [propertyDetailId, setPropertyDetailId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  function navigate(dest: ScreenId, opts: Record<string, string> = {}) {
    if (opts.bookingTab) setBookingTab(opts.bookingTab);
    if (opts.notifTab) setNotifTab(opts.notifTab);
    setPropertyDetailId(null);
    setSelectedBooking(null);
    setScreen(dest);
  }

  const renderScreen = () => {
    switch (screen) {
      case "dashboard": return <DashboardScreen navigate={navigate} />;
      case "properties": return <PropertiesScreen propertyDetailId={propertyDetailId} setPropertyDetailId={setPropertyDetailId} />;
      case "rooms": return <RoomsScreen />;
      case "availability": return <AvailabilityScreen />;
      case "bookings": return <BookingsScreen initialTab={bookingTab} selectedBooking={selectedBooking} setSelectedBooking={setSelectedBooking} />;
      case "notifications": return <NotificationsScreen initialTab={notifTab} navigate={navigate} />;
      case "earnings": return <EarningsScreen navigate={navigate} />;
      case "promotions": return <PromotionsScreen />;
      case "reviews":   return <ReviewsScreen />;
      case "messages":  return <GuestMessagesScreen />;
      case "staff":     return <StaffScreen />;
      case "support": return <SupportScreen />;
      case "settings": return <SettingsScreen />;
      default: return <DashboardScreen navigate={navigate} />;
    }
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans','Inter',system-ui,sans-serif" }}>
      <Shell screen={screen} navigate={navigate}>
        {renderScreen()}
      </Shell>
    </div>
  );
}

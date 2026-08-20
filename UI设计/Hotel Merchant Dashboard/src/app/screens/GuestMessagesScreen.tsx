import { useState } from "react";
import {
  Search, MessageSquare, Send, Paperclip, Smile, Check, CheckCheck,
  Building2, ChevronDown, Filter, Eye, FileText, UserPlus,
  CheckCircle2, Clock, ImageIcon, MoreHorizontal, Inbox,
  Maximize2, Minimize2,
} from "lucide-react";
import { cx, btnPrimary, btnSecondary, btnGhost, Badge, PageHeader, type BadgeVariant } from "../shared";

// ─── Types ───────────────────────────────────────────────────────────────────

type MessageStatus = "sent" | "delivered" | "read";
type ConvStatus    = "open" | "unread" | "resolved";

type Message = {
  id: string;
  from: "guest" | "merchant";
  text: string;
  time: string;
  status?: MessageStatus;
  attachment?: { type: "image" | "file"; name: string; url?: string };
};

type Conversation = {
  id: string;
  guest: string;
  avatar: string;
  avatarColor: string;
  hotelId: string;
  hotel: string;
  bookingId: string;
  room: string;
  checkin: string;
  checkout: string;
  bookingStatus: string;
  status: ConvStatus;
  unread: number;
  lastMessage: string;
  lastTime: string;
  messages: Message[];
};

// ─── Data ────────────────────────────────────────────────────────────────────

const HOTELS = [
  { id: "H001", name: "The Horizon Resort" },
  { id: "H002", name: "Blue Lagoon Boutique" },
  { id: "H003", name: "Cityview Business Hotel" },
];

const CONVERSATIONS: Conversation[] = [
  {
    id: "C001",
    guest: "Sarah Mitchell", avatar: "SM", avatarColor: "from-blue-500 to-indigo-600",
    hotelId: "H001", hotel: "The Horizon Resort",
    bookingId: "BK-2407001", room: "Deluxe Ocean View",
    checkin: "26 Jul 2026", checkout: "30 Jul 2026", bookingStatus: "confirmed",
    status: "unread", unread: 2,
    lastMessage: "Could we request an early check-in at around 11am?",
    lastTime: "10:42",
    messages: [
      { id: "m1", from: "guest",    text: "Hello! We're really excited about our upcoming stay.", time: "Yesterday 14:20", status: "read" },
      { id: "m2", from: "merchant", text: "Welcome! We look forward to hosting you at The Horizon Resort. Please let us know if you have any preferences.", time: "Yesterday 15:05", status: "read" },
      { id: "m3", from: "guest",    text: "Thank you! One quick question — is the pool heated?", time: "Yesterday 18:32", status: "read" },
      { id: "m4", from: "merchant", text: "Yes, our infinity pool is heated to 28°C year-round and is open from 7am to 9pm daily.", time: "Yesterday 18:55", status: "read" },
      { id: "m5", from: "guest",    text: "Perfect, that's great to know!", time: "Yesterday 19:10", status: "read" },
      { id: "m6", from: "guest",    text: "Could we request an early check-in at around 11am?", time: "10:42", status: "delivered" },
    ],
  },
  {
    id: "C002",
    guest: "James Kowalski", avatar: "JK", avatarColor: "from-teal-500 to-cyan-600",
    hotelId: "H002", hotel: "Blue Lagoon Boutique",
    bookingId: "BK-2407004", room: "Honeymoon Suite",
    checkin: "24 Jul 2026", checkout: "27 Jul 2026", bookingStatus: "checked-in",
    status: "unread", unread: 1,
    lastMessage: "The room is wonderful but the AC seems a bit loud at night.",
    lastTime: "09:15",
    messages: [
      { id: "m1", from: "guest",    text: "We arrived safely, the room is absolutely stunning!", time: "Yesterday 16:00", status: "read" },
      { id: "m2", from: "merchant", text: "So glad to hear that! Please don't hesitate to reach out if you need anything during your stay.", time: "Yesterday 16:20", status: "read" },
      { id: "m3", from: "guest",    text: "The room is wonderful but the AC seems a bit loud at night.", time: "09:15", status: "delivered" },
    ],
  },
  {
    id: "C003",
    guest: "Priya Rajan", avatar: "PR", avatarColor: "from-violet-500 to-purple-600",
    hotelId: "H003", hotel: "Cityview Business Hotel",
    bookingId: "BK-2407007", room: "Executive Suite",
    checkin: "25 Jul 2026", checkout: "28 Jul 2026", bookingStatus: "confirmed",
    status: "open", unread: 0,
    lastMessage: "Great, I'll need a late checkout if possible.",
    lastTime: "Yesterday",
    messages: [
      { id: "m1", from: "guest",    text: "Hi, I have a business dinner on the 27th. Is the hotel restaurant open until midnight?", time: "Yesterday 11:00", status: "read" },
      { id: "m2", from: "merchant", text: "Our restaurant serves until 10:30pm. However, we have a 24-hour room service menu available for late-night dining.", time: "Yesterday 11:45", status: "read" },
      { id: "m3", from: "guest",    text: "Perfect, that works. Also, I'll need a late checkout if possible.", time: "Yesterday 12:10", status: "read" },
      { id: "m4", from: "merchant", text: "Late checkout until 1pm is complimentary. We can extend to 2pm subject to availability — I'll note it on your reservation.", time: "Yesterday 12:30", status: "read" },
    ],
  },
  {
    id: "C004",
    guest: "Tom Bergstrom", avatar: "TB", avatarColor: "from-rose-500 to-pink-600",
    hotelId: "H001", hotel: "The Horizon Resort",
    bookingId: "BK-2407009", room: "Family Suite",
    checkin: "28 Jul 2026", checkout: "02 Aug 2026", bookingStatus: "confirmed",
    status: "open", unread: 0,
    lastMessage: "Thanks for the quick response! See you on the 28th.",
    lastTime: "22 Jul",
    messages: [
      { id: "m1", from: "guest",    text: "We're bringing two children (ages 5 and 8). Are there child-friendly amenities?", time: "22 Jul 14:00", status: "read" },
      { id: "m2", from: "merchant", text: "Absolutely! We have a dedicated kids' pool, a children's activity centre open 9am–5pm, and babysitting services available on request.", time: "22 Jul 14:30", status: "read" },
      { id: "m3", from: "merchant", text: "Here's our activity brochure for families.", time: "22 Jul 14:31", status: "read", attachment: { type: "file", name: "Family_Activities_Jul2026.pdf" } },
      { id: "m4", from: "guest",    text: "Thanks for the quick response! See you on the 28th.", time: "22 Jul 15:10", status: "read" },
    ],
  },
  {
    id: "C005",
    guest: "Elena Vasquez", avatar: "EV", avatarColor: "from-amber-500 to-orange-500",
    hotelId: "H002", hotel: "Blue Lagoon Boutique",
    bookingId: "BK-2407005", room: "Superior Room",
    checkin: "20 Jul 2026", checkout: "24 Jul 2026", bookingStatus: "checked-out",
    status: "resolved", unread: 0,
    lastMessage: "Wonderful stay, we will definitely be back!",
    lastTime: "24 Jul",
    messages: [
      { id: "m1", from: "guest",    text: "Just checked out — what a magnificent stay. The staff were beyond helpful.", time: "24 Jul 11:05", status: "read" },
      { id: "m2", from: "merchant", text: "Thank you so much for your kind words, Elena! It was a pleasure hosting you. We look forward to welcoming you back soon.", time: "24 Jul 11:20", status: "read" },
      { id: "m3", from: "guest",    text: "Wonderful stay, we will definitely be back!", time: "24 Jul 11:35", status: "read" },
    ],
  },
  {
    id: "C006",
    guest: "David Lim", avatar: "DL", avatarColor: "from-slate-500 to-gray-600",
    hotelId: "H003", hotel: "Cityview Business Hotel",
    bookingId: "BK-2407011", room: "Executive Room",
    checkin: "23 Jul 2026", checkout: "24 Jul 2026", bookingStatus: "checked-in",
    status: "open", unread: 0,
    lastMessage: "Could you send someone to fix the TV remote? It's not working.",
    lastTime: "08:50",
    messages: [
      { id: "m1", from: "guest", text: "Could you send someone to fix the TV remote? It's not working.", time: "08:50", status: "delivered" },
    ],
  },
];

const BOOKING_STATUS_BADGE: Record<string, BadgeVariant> = {
  confirmed:    "blue",
  "checked-in": "green",
  "checked-out":"slate",
  pending:      "yellow",
  cancelled:    "red",
  "no-show":    "orange",
};

const CONV_STATUS_BADGE: Record<ConvStatus, { label: string; variant: BadgeVariant }> = {
  open:     { label: "Open",     variant: "blue" },
  unread:   { label: "Unread",   variant: "yellow" },
  resolved: { label: "Resolved", variant: "green" },
};

const REPLY_TEMPLATES = [
  "Thank you for your message. We'll get back to you shortly.",
  "Your request has been noted and we will do our best to accommodate.",
  "Welcome! We look forward to hosting you. Please let us know if you need anything.",
  "Thank you for your stay. We hope to welcome you back soon!",
  "We're sorry for the inconvenience. Our team is looking into this immediately.",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ initials, gradient, size = "md" }: { initials: string; gradient: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-10 h-10 text-[13px]" : "w-8 h-8 text-[11px]";
  return (
    <div className={cx(`bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white font-bold shrink-0`, sz)}>
      {initials}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isMe = msg.from === "merchant";
  return (
    <div className={cx("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
      <div className={cx(
        "max-w-[78%] px-3.5 py-2.5 rounded-[14px] text-[13px] leading-relaxed",
        isMe
          ? "bg-[#2563eb] text-white rounded-br-[4px]"
          : "bg-[#f1f5f9] text-[#0f172a] rounded-bl-[4px]"
      )}>
        {msg.attachment ? (
          <div className="flex flex-col gap-2">
            {msg.text && <p>{msg.text}</p>}
            {msg.attachment.type === "image" ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-[8px]">
                <ImageIcon size={14} className={isMe ? "text-blue-200" : "text-[#94a3b8]"} />
                <span className="text-[12px] truncate max-w-[160px]">{msg.attachment.name}</span>
              </div>
            ) : (
              <div className={cx("flex items-center gap-2 px-3 py-2 rounded-[8px]", isMe ? "bg-white/20" : "bg-white border border-[#e2e8f0]")}>
                <FileText size={14} className={isMe ? "text-blue-200" : "text-blue-600"} />
                <span className={cx("text-[12px] truncate max-w-[160px]", isMe ? "" : "text-[#334155]")}>{msg.attachment.name}</span>
              </div>
            )}
          </div>
        ) : (
          <p>{msg.text}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[10px] text-[#94a3b8]">{msg.time}</span>
        {isMe && msg.status && (
          msg.status === "read"      ? <CheckCheck size={11} className="text-blue-500" /> :
          msg.status === "delivered" ? <CheckCheck size={11} className="text-[#94a3b8]" /> :
                                       <Check size={11} className="text-[#94a3b8]" />
        )}
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function GuestMessagesScreen() {
  const [search, setSearch]               = useState("");
  const [hotelFilter, setHotelFilter]     = useState("all");
  const [statusFilter, setStatusFilter]   = useState<"all" | ConvStatus>("all");
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [dateOpen, setDateOpen]           = useState(false);
  const [selected, setSelected]           = useState<Conversation | null>(CONVERSATIONS[0]);
  const [draft, setDraft]                 = useState("");
  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS);
  const [templateOpen, setTemplateOpen]   = useState(false);
  const [resolvedIds, setResolvedIds]     = useState<string[]>([]);
  const [expanded, setExpanded]           = useState(false);

  // KPIs
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const active      = conversations.filter((c) => c.status !== "resolved").length;
  const awaiting    = conversations.filter((c) => {
    const last = c.messages[c.messages.length - 1];
    return last?.from === "guest" && c.status !== "resolved";
  }).length;
  const resolved    = conversations.filter((c) => c.status === "resolved").length;

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase();
    if (q && !c.guest.toLowerCase().includes(q) && !c.bookingId.toLowerCase().includes(q) && !c.hotel.toLowerCase().includes(q)) return false;
    if (hotelFilter !== "all" && c.hotelId !== hotelFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const sendMessage = () => {
    if (!draft.trim() || !selected) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      from: "merchant",
      text: draft.trim(),
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
    };
    setConversations((prev) => prev.map((c) =>
      c.id === selected.id
        ? { ...c, messages: [...c.messages, newMsg], lastMessage: draft.trim(), lastTime: newMsg.time, status: c.status === "unread" ? "open" : c.status, unread: 0 }
        : c
    ));
    setSelected((prev) => prev ? { ...prev, messages: [...prev.messages, newMsg], status: prev.status === "unread" ? "open" : prev.status, unread: 0 } : prev);
    setDraft("");
  };

  const markResolved = () => {
    if (!selected) return;
    setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, status: "resolved", unread: 0 } : c));
    setSelected((prev) => prev ? { ...prev, status: "resolved", unread: 0 } : prev);
    setResolvedIds((p) => [...p, selected.id]);
  };

  const useTemplate = (t: string) => {
    setDraft(t);
    setTemplateOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Guest Messages"
        subtitle="Communicate with guests before, during, and after their stay."
        action={
          <button className={btnPrimary}>
            <MessageSquare size={14} /> New Message
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Active Conversations", value: active,      sub: "Open & unread",               icon: <MessageSquare size={16} className="text-blue-500" /> },
          { label: "Unread Messages",      value: totalUnread, sub: "Require attention",            icon: <Clock size={16} className="text-amber-500" /> },
          { label: "Awaiting Reply",       value: awaiting,    sub: "Guest replied, needs response",icon: <Inbox size={16} className="text-red-500" /> },
          { label: "Resolved",             value: resolved,    sub: "Conversations closed",         icon: <CheckCircle2 size={16} className="text-green-500" /> },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] text-[#64748b] font-medium">{c.label}</p>
              {c.icon}
            </div>
            <p className="text-[22px] font-bold text-[#0f172a]">{c.value}</p>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ height: "calc(100vh - 310px)" }}>

        {/* ── Left panel: Conversation list — hidden when expanded ── */}
        {!expanded && (
          <div className="w-[320px] shrink-0 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col min-h-0">

            {/* List filters */}
            <div className="px-3 pt-3 pb-2 border-b border-[#f1f5f9] flex flex-col gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Guest, Booking ID, Hotel…"
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Building2 size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
                  <select
                    value={hotelFilter}
                    onChange={(e) => setHotelFilter(e.target.value)}
                    className="w-full pl-6 pr-5 py-1.5 text-[11.5px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="all">All Hotels</option>
                    {HOTELS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="flex-1 px-2 py-1.5 text-[11.5px] border border-[#e2e8f0] rounded-[7px] bg-[#f8fafc] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="unread">Unread</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="relative">
                <button
                  onClick={() => setDateOpen((o) => !o)}
                  className={cx(
                    "w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] border rounded-[7px] transition-all",
                    (dateFrom || dateTo) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:border-[#cbd5e1]"
                  )}
                >
                  <Filter size={11} className="shrink-0" />
                  {dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}` : "Date range filter"}
                </button>
                {dateOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setDateOpen(false)} />
                    <div className="absolute left-0 top-full mt-1.5 z-30 bg-white border border-[#e2e8f0] rounded-[10px] shadow-lg p-3 w-full flex flex-col gap-2">
                      <div className="flex gap-1.5 items-center">
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                          className="flex-1 px-2 py-1.5 text-[11.5px] border border-[#e2e8f0] rounded-[6px] focus:outline-none" />
                        <span className="text-[#94a3b8] text-[10px]">to</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                          className="flex-1 px-2 py-1.5 text-[11.5px] border border-[#e2e8f0] rounded-[6px] focus:outline-none" />
                      </div>
                      <div className="flex justify-between">
                        <button onClick={() => { setDateFrom(""); setDateTo(""); }} className={cx(btnGhost, "text-[11px] py-1")}>Clear</button>
                        <button onClick={() => setDateOpen(false)} className="px-3 py-1 text-[11px] font-semibold bg-[#0f172a] text-white rounded-[6px]">Apply</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Conversation items */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <MessageSquare size={28} className="text-[#cbd5e1] mb-3" />
                  <p className="text-[13px] font-medium text-[#64748b]">No conversations found.</p>
                  <p className="text-[11px] text-[#94a3b8] mt-1">Try adjusting your filters.</p>
                </div>
              ) : filtered.map((c) => {
                const isActive = selected?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelected(c);
                      if (c.unread > 0) {
                        setConversations((prev) => prev.map((x) =>
                          x.id === c.id ? { ...x, unread: 0, status: x.status === "unread" ? "open" : x.status } : x
                        ));
                      }
                    }}
                    className={cx(
                      "w-full text-left px-3 py-3 border-b border-[#f8fafc] transition-colors flex gap-2.5 items-start",
                      isActive ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-[#f8fafc] border-l-2 border-l-transparent"
                    )}
                  >
                    <Avatar initials={c.avatar} gradient={c.avatarColor} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cx("text-[12.5px] truncate", c.unread > 0 ? "font-bold text-[#0f172a]" : "font-semibold text-[#0f172a]")}>
                          {c.guest}
                        </p>
                        <span className="text-[10.5px] text-[#94a3b8] shrink-0">{c.lastTime}</span>
                      </div>
                      <p className="text-[10.5px] text-[#94a3b8] truncate mt-0.5">{c.hotel} · {c.bookingId}</p>
                      <p className="text-[10.5px] text-[#94a3b8] truncate">{c.room}</p>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <p className={cx("text-[11.5px] truncate flex-1", c.unread > 0 ? "font-semibold text-[#334155]" : "text-[#64748b]")}>
                          {c.lastMessage}
                        </p>
                        {c.unread > 0 && (
                          <span className="w-4 h-4 rounded-full bg-[#2563eb] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                            {c.unread}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <Badge label={CONV_STATUS_BADGE[c.status].label} variant={CONV_STATUS_BADGE[c.status].variant} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Right panel: Conversation detail ── */}
        {selected ? (
          <div className="flex-1 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col min-h-0 min-w-0">

            {/* Detail header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e8f0] shrink-0">
              <div className="flex items-center gap-3">
                <Avatar initials={selected.avatar} gradient={selected.avatarColor} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-bold text-[#0f172a]">{selected.guest}</p>
                    <Badge label={CONV_STATUS_BADGE[selected.status].label} variant={CONV_STATUS_BADGE[selected.status].variant} />
                  </div>
                  <p className="text-[11.5px] text-[#64748b] mt-0.5">{selected.hotel} · {selected.bookingId} · {selected.room}</p>
                </div>
              </div>

              {/* Header actions: Expand / Collapse + More */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded((e) => !e)}
                  title={expanded ? "Collapse to split view" : "Expand to full width"}
                  className={cx(
                    btnGhost,
                    "transition-colors",
                    expanded ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : ""
                  )}
                >
                  {expanded
                    ? <Minimize2 size={14} />
                    : <Maximize2 size={14} />
                  }
                </button>
                <button className={btnGhost}><MoreHorizontal size={14} /></button>
              </div>
            </div>

            {/* Guest info card — compact (~30% shorter via reduced padding + single-row layout) */}
            <div className="mx-5 mt-3 mb-0 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2 shrink-0">
              <div className="flex items-center gap-6">
                {([
                  ["Check-in",   selected.checkin],
                  ["Check-out",  selected.checkout],
                  ["Booking ID", selected.bookingId],
                ] as [string,string][]).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 min-w-0">
                    <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#94a3b8] shrink-0">{k}</p>
                    <p className="text-[12px] font-semibold text-[#0f172a] truncate">{v}</p>
                  </div>
                ))}
                <div className="flex items-center gap-2 min-w-0 ml-auto">
                  <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#94a3b8] shrink-0">Status</p>
                  <Badge label={selected.bookingStatus.replace("-", " ")} variant={BOOKING_STATUS_BADGE[selected.bookingStatus] ?? "gray"} />
                </div>
              </div>
            </div>

            {/* Chat window */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 min-h-0">
              {selected.messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>

            {/* Quick actions */}
            <div className="px-5 py-2 border-t border-[#f1f5f9] flex items-center gap-2 flex-wrap shrink-0">
              <button className={btnGhost}>
                <Eye size={12} /> View Booking
              </button>

              <div className="relative">
                <button onClick={() => setTemplateOpen((o) => !o)} className={btnGhost}>
                  <FileText size={12} /> Reply with Template
                </button>
                {templateOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setTemplateOpen(false)} />
                    <div className="absolute bottom-full mb-1.5 left-0 z-30 bg-white border border-[#e2e8f0] rounded-[10px] shadow-xl w-72 py-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] px-3 py-1.5">Quick Replies</p>
                      {REPLY_TEMPLATES.map((t, i) => (
                        <button key={i} onClick={() => useTemplate(t)}
                          className="w-full text-left px-3 py-2 text-[12.5px] text-[#334155] hover:bg-[#f8fafc] transition-colors leading-snug border-t border-[#f8fafc]">
                          {t}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {selected.status !== "resolved" && (
                <button onClick={markResolved} className={btnGhost}>
                  <CheckCircle2 size={12} /> Mark as Resolved
                </button>
              )}

              <button className={btnGhost}>
                <UserPlus size={12} /> Assign Staff
              </button>

              {/* In expanded mode, show a back-to-list shortcut */}
              {expanded && (
                <button
                  onClick={() => setExpanded(false)}
                  className={cx(btnGhost, "ml-auto text-blue-600")}
                >
                  <Minimize2 size={12} /> Collapse View
                </button>
              )}
            </div>

            {/* Message composer */}
            <div className="px-4 pb-4 pt-2 shrink-0">
              <div className="flex items-end gap-2 border border-[#e2e8f0] rounded-[10px] bg-[#f8fafc] px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  rows={expanded ? 3 : 2}
                  placeholder={selected.status === "resolved" ? "Conversation resolved. Start a new message to reopen." : "Type a message… (Enter to send, Shift+Enter for new line)"}
                  disabled={selected.status === "resolved"}
                  className="flex-1 resize-none bg-transparent text-[13px] text-[#0f172a] placeholder:text-[#cbd5e1] focus:outline-none leading-relaxed disabled:opacity-60"
                />
                <div className="flex items-center gap-1 pb-0.5">
                  <button className={cx(btnGhost, "p-1.5")} title="Emoji"><Smile size={15} className="text-[#94a3b8]" /></button>
                  <button className={cx(btnGhost, "p-1.5")} title="Attach file"><Paperclip size={15} className="text-[#94a3b8]" /></button>
                  <button
                    onClick={sendMessage}
                    disabled={!draft.trim() || selected.status === "resolved"}
                    className={cx(
                      "flex items-center justify-center w-8 h-8 rounded-[7px] transition-all",
                      draft.trim() && selected.status !== "resolved"
                        ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                        : "bg-[#f1f5f9] text-[#cbd5e1] cursor-not-allowed"
                    )}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col items-center justify-center text-center">
            <MessageSquare size={40} className="text-[#cbd5e1] mb-4" />
            <p className="text-[14px] font-semibold text-[#64748b]">No conversation selected</p>
            <p className="text-[12px] text-[#94a3b8] mt-1">Choose a conversation from the list to start messaging.</p>
          </div>
        )}

      </div>
    </div>
  );
}

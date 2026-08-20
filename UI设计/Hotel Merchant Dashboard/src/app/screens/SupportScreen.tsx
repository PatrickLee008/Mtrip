import { useState } from "react";
import {
  Plus, Search, X, Eye, HelpCircle, FileText, Download, Shield,
  Inbox, AlertCircle, Clock, CheckCircle2, ChevronRight, ChevronDown,
  Upload, RotateCcw, Check, AlertTriangle, ArrowRight, Info,
  TrendingDown, Award, Gavel, MessageSquare, Calendar,
} from "lucide-react";
import {
  cx, inputCls, selectCls, btnPrimary, btnSecondary, btnGhost,
  Badge, type BadgeVariant,
} from "../shared";

const TICKETS = [
  { id: "TK-2407001", category: "Settlement & Payout",    subject: "June 2026 settlement amount discrepancy",            priority: "High",   status: "in-progress",      agent: "Pattaraporn S.", updated: "23 Jul 2026, 11:42", created: "21 Jul 2026" },
  { id: "TK-2407002", category: "Booking Issues",         subject: "BK-2407003 not syncing to PMS after confirmation",   priority: "High",   status: "waiting-merchant", agent: "Nattawut K.",    updated: "22 Jul 2026, 14:20", created: "22 Jul 2026" },
  { id: "TK-2407003", category: "Technical Issue",        subject: "Availability calendar stuck after PMS v3.4 update",  priority: "Medium", status: "open",             agent: "—",              updated: "23 Jul 2026, 09:05", created: "23 Jul 2026" },
  { id: "TK-2407004", category: "Availability & Pricing", subject: "Bulk price update not reflecting on platform",        priority: "Medium", status: "resolved",         agent: "Pattaraporn S.", updated: "20 Jul 2026, 16:30", created: "18 Jul 2026" },
  { id: "TK-2407005", category: "Reviews",                subject: "Request to remove inappropriate guest review",        priority: "Low",    status: "closed",           agent: "Sunisa T.",      updated: "15 Jul 2026, 10:00", created: "12 Jul 2026" },
  { id: "TK-2407006", category: "Room Management",        subject: "Unable to duplicate room type — portal error",        priority: "Low",    status: "waiting-support",  agent: "Nattawut K.",    updated: "21 Jul 2026, 08:55", created: "20 Jul 2026" },
];

type Ticket = typeof TICKETS[0];

type ConvMsg = { from: "merchant" | "support"; agent?: string; time: string; text: string; attachment?: string };

const TICKET_CONV: Record<string, ConvMsg[]> = {
  "TK-2407001": [
    { from: "merchant", time: "21 Jul, 09:14", text: "Hello, the June 2026 settlement shows THB 134,640 but our internal calculation shows THB 138,200. Could you please review the commission deduction breakdown for this period?" },
    { from: "support", agent: "Pattaraporn S.", time: "21 Jul, 14:30", text: "Thank you for reaching out. I have escalated this to our Finance team. Could you please share your internal calculation as an attachment so we can cross-reference?" },
    { from: "merchant", time: "22 Jul, 10:05", text: "Please find our breakdown attached. The discrepancy appears to relate to the commission applied on BK-2406018.", attachment: "Settlement_Calc_Jun2026.xlsx" },
    { from: "support", agent: "Pattaraporn S.", time: "23 Jul, 11:42", text: "Thank you for the file. We have identified the issue — BK-2406018 had a promotional subsidy that was incorrectly double-deducted. A correction will be processed within 2 business days. We apologise for the inconvenience." },
  ],
  "TK-2407002": [
    { from: "merchant", time: "22 Jul, 09:30", text: "BK-2407003 was confirmed on the mTrip portal but is not appearing in our PMS. Guests arrive today. Please investigate urgently." },
    { from: "support", agent: "Nattawut K.", time: "22 Jul, 14:20", text: "Hi, I understand the urgency. Can you confirm your PMS version and the timestamp of your last successful sync? This will help us pinpoint the integration gap." },
  ],
  "TK-2407003": [
    { from: "merchant", time: "23 Jul, 09:05", text: "After updating our PMS to version 3.4 yesterday, our availability calendar is no longer syncing. The portal still shows inventory data from 3 days ago." },
  ],
  "TK-2407004": [
    { from: "merchant", time: "18 Jul, 11:22", text: "I applied a bulk price update for all room types for August but the new prices are not showing on the booking platform after 2 hours." },
    { from: "support", agent: "Pattaraporn S.", time: "18 Jul, 15:10", text: "Thank you for reporting. We identified a caching delay on our end affecting bulk updates submitted between 10:00–14:00 on 18 Jul. This has been cleared and prices should now reflect correctly. Please verify." },
    { from: "merchant", time: "19 Jul, 09:00", text: "Confirmed — prices are now showing correctly. Thank you for the quick resolution." },
    { from: "support", agent: "Pattaraporn S.", time: "20 Jul, 16:30", text: "Excellent. I am marking this ticket as resolved. Please do not hesitate to reopen if you encounter further issues." },
  ],
  "TK-2407005": [
    { from: "merchant", time: "12 Jul, 10:00", text: "A guest review contains offensive language and false claims about our property. We request removal under the platform content policy." },
    { from: "support", agent: "Sunisa T.", time: "13 Jul, 09:30", text: "Thank you for flagging this. Our content moderation team will review the review within 3 business days under our Community Standards policy." },
    { from: "support", agent: "Sunisa T.", time: "15 Jul, 10:00", text: "After review, the relevant section has been removed for violating our content policy. The overall rating remains as it reflects the guest's experience. This ticket is now closed." },
  ],
  "TK-2407006": [
    { from: "merchant", time: "20 Jul, 14:22", text: "When I try to duplicate the Deluxe Room type in Room Management, the portal returns a blank page and the duplication does not complete." },
    { from: "support", agent: "Nattawut K.", time: "21 Jul, 08:55", text: "Thank you for the report. I have reproduced the issue in our staging environment and escalated to our engineering team. We will update you as soon as a fix is deployed." },
  ],
};

const TICKET_HISTORY: Record<string, { status: string; time: string; note: string }[]> = {
  "TK-2407001": [
    { status: "Open",                 time: "21 Jul, 09:14", note: "Ticket created" },
    { status: "In Progress",          time: "21 Jul, 14:30", note: "Assigned to Pattaraporn S." },
    { status: "Waiting for Merchant", time: "21 Jul, 14:31", note: "Document requested" },
    { status: "In Progress",          time: "22 Jul, 10:05", note: "Merchant submitted attachment" },
  ],
  "TK-2407004": [
    { status: "Open",       time: "18 Jul, 11:22", note: "Ticket created" },
    { status: "In Progress",time: "18 Jul, 15:10", note: "Assigned to Pattaraporn S." },
    { status: "Resolved",   time: "20 Jul, 16:30", note: "Issue confirmed resolved by merchant" },
  ],
};

const FAQS: { cat: string; q: string; a: string }[] = [
  { cat: "Bookings",              q: "How do I confirm a pending booking?",                          a: "Navigate to Booking Management, locate the booking with Pending status, and click Confirm. The guest will be notified automatically via email and the mTrip app." },
  { cat: "Bookings",              q: "Can I modify a confirmed booking on behalf of the guest?",     a: "Yes. Open the booking detail drawer and click Modify. Any changes must be agreed upon with the guest prior to modification. All changes are recorded in the booking audit history." },
  { cat: "Bookings",              q: "How do I process a refund for a cancelled booking?",           a: "In Booking Management, open the cancelled booking and click Refund. Refunds are processed within 5–10 business days depending on the guest's payment method." },
  { cat: "Availability & Pricing",q: "Why is my price update not showing on the platform?",         a: "Price updates typically take up to 15 minutes to reflect. If the issue persists after 1 hour, check your PMS and Channel Manager sync status in the Availability & Pricing screen or raise a support ticket." },
  { cat: "Availability & Pricing",q: "How do I block dates for a specific room type?",              a: "In Availability & Pricing, select the room type, click on the date range you wish to block, and select Block Dates from the action panel on the right. Blocked dates will appear in gray on the calendar." },
  { cat: "Settlement & Payout",   q: "When will my payout be processed?",                           a: "Payouts are processed on the 1st and 16th of each month for the preceding settlement period. Settlement reports are available in Business Dashboard & Earnings." },
  { cat: "Settlement & Payout",   q: "How is the commission rate calculated?",                      a: "Commission is calculated as an agreed percentage of the net booking amount after applicable promotional discounts. The rate is defined in your Merchant Agreement signed during onboarding." },
  { cat: "Technical Support",     q: "My PMS is showing as disconnected. What should I do?",       a: "Go to Availability & Pricing and check the Integration Status section at the bottom of the screen. Click Reconnect and follow the on-screen steps. If the connection fails after 3 attempts, raise a Technical Issue support ticket." },
  { cat: "Account & Staff",       q: "How do I add a new staff member to the portal?",             a: "Go to Team > Staff Management and click Invite Staff. Enter their full name, work email, assign a role (Hotel Manager or Reservation Officer), select the hotel, and send the invitation. The link expires after 7 days." },
];

const GUIDES = [
  { title: "Merchant Getting Started Guide",    desc: "Complete walkthrough for new hotel merchants — account setup, property listing and first booking.", size: "2.4 MB", updated: "15 Jun 2026" },
  { title: "Room & Availability Setup Manual",  desc: "Step-by-step guide to configure room types, inventory, pricing rules and blocking dates.",           size: "1.8 MB", updated: "01 Jul 2026" },
  { title: "Booking Management Manual",         desc: "Full booking lifecycle — confirm, modify, check-in, check-out, cancel and refund operations.",        size: "1.2 MB", updated: "10 Jul 2026" },
  { title: "PMS & Channel Manager Integration", desc: "Technical guide for connecting your PMS and Channel Manager to the mTrip platform.",                  size: "3.1 MB", updated: "20 Jun 2026" },
  { title: "Settlement & Payout Guide",         desc: "Understanding commission structures, deduction types, settlement cycles and payout reporting.",        size: "0.9 MB", updated: "01 Jul 2026" },
  { title: "Reviews Management Guide",          desc: "How to respond to reviews, flag inappropriate content and monitor your property reputation score.",    size: "0.7 MB", updated: "05 Jul 2026" },
  { title: "Staff Management & RBAC Guide",     desc: "Inviting staff, assigning roles and understanding the permission matrix for your team.",              size: "0.8 MB", updated: "15 Jul 2026" },
  { title: "mTrip Merchant API Reference",      desc: "Full technical API documentation for custom integrations. For development teams only.",               size: "5.6 MB", updated: "05 Jul 2026" },
];

const VIOLATIONS = [
  { id: "VL-001", date: "10 Jul 2026", property: "The Horizon Resort",       violation: "Overbooking Incident",            rule: "PR-05", points: 10, status: "active",   appealed: false },
  { id: "VL-002", date: "22 Jun 2026", property: "Blue Lagoon Boutique",     violation: "Rate Parity Breach",              rule: "PR-06", points: 5,  status: "active",   appealed: true  },
  { id: "VL-003", date: "03 May 2026", property: "Cityview Business Hotel",  violation: "Misleading Photo Content",         rule: "PR-02", points: 8,  status: "resolved", appealed: false },
  { id: "VL-004", date: "14 Apr 2026", property: "The Horizon Resort",       violation: "Late Settlement Dispute Filing",   rule: "PR-04", points: 3,  status: "resolved", appealed: false },
];

const WARNINGS = [
  { id: "WN-001", date: "18 Jul 2026", property: "The Horizon Resort",      warning: "Photo quality below minimum resolution on 3 room listings. Please update within 14 days.",   rule: "PR-02", expires: "01 Aug 2026", status: "active"   },
  { id: "WN-002", date: "05 Jul 2026", property: "Blue Lagoon Boutique",    warning: "Cancellation policy description was unclear and did not meet standard wording requirements.", rule: "PR-01", expires: "19 Jul 2026", status: "resolved" },
  { id: "WN-003", date: "20 Jun 2026", property: "Cityview Business Hotel", warning: "Review reply contained guest contact details in violation of Community Standards.",          rule: "PR-03", expires: "04 Jul 2026", status: "resolved" },
];

const PENALTY_HISTORY = [
  { date: "10 Jul 2026", type: "Violation Issued",   property: "The Horizon Resort",      desc: "Overbooking Incident (2nd in 90-day window)",   points: +10, balance: 26, id: "VL-001" },
  { date: "22 Jun 2026", type: "Violation Issued",   property: "Blue Lagoon Boutique",    desc: "Rate Parity Breach detected by audit",          points: +5,  balance: 16, id: "VL-002" },
  { date: "15 Jun 2026", type: "Points Expired",     property: "—",                       desc: "Penalty points from VL-2025-019 expired (180d)", points: -5,  balance: 11, id: "" },
  { date: "03 May 2026", type: "Violation Resolved", property: "Cityview Business Hotel", desc: "Misleading Photo Content — corrected & verified", points: 0,   balance: 16, id: "VL-003" },
  { date: "14 Apr 2026", type: "Violation Issued",   property: "The Horizon Resort",      desc: "Late Settlement Dispute Filing",                points: +3,  balance: 16, id: "VL-004" },
  { date: "01 Mar 2026", type: "Points Expired",     property: "—",                       desc: "Penalty points from VL-2025-011 expired (180d)", points: -8,  balance: 13, id: "" },
  { date: "10 Jan 2026", type: "Warning Issued",     property: "Blue Lagoon Boutique",    desc: "Photo quality warning — resolved within 14 days", points: 0,   balance: 21, id: "" },
];

const APPEALS = [
  { id: "AP-001", violationId: "VL-002", violation: "Rate Parity Breach",    property: "Blue Lagoon Boutique",   submitted: "25 Jun 2026", status: "pending",  outcome: "",           reviewedBy: "",               reviewDate: "" },
];

const RULES = [
  { id: "PR-01", section: "Booking",     effective: "01 Jan 2026", title: "Cancellation Policy Standards",          desc: "All properties must offer at least one standard cancellation policy: Flexible (free cancellation 24h before check-in), Moderate (5 days before), or Strict (50% refund up to 7 days before). Custom policies require prior approval." },
  { id: "PR-02", section: "Content",     effective: "01 Mar 2026", title: "Photo & Media Quality Requirements",     desc: "Property and room photos must be minimum 1080×720px in JPG or PNG format. Photos must accurately represent the listed space. AI-generated, edited, or misleading photos are prohibited and may result in listing suspension." },
  { id: "PR-03", section: "Reviews",     effective: "15 Apr 2026", title: "Review Response Guidelines",             desc: "Merchant replies must be professional, factual, and not contain personal guest data, pricing disputes, or language that violates our Community Standards. Inappropriate replies will be removed without notice." },
  { id: "PR-04", section: "Settlement",  effective: "01 Jan 2026", title: "Payout Dispute Submission Window",       desc: "Settlement disputes must be submitted within 30 calendar days of the payout date. Disputes received after this window are not eligible for review under current policy." },
  { id: "PR-05", section: "Booking",     effective: "01 Jun 2026", title: "Overbooking Incident Policy",            desc: "Properties with more than 2 confirmed overbooking incidents within a 90-day rolling window may be temporarily suspended from accepting new bookings pending a merchant review process." },
  { id: "PR-06", section: "Content",     effective: "01 Jan 2026", title: "Pricing Accuracy & Parity Requirement",  desc: "Room rates published on mTrip must not be higher than rates offered on your own direct booking channels. Rate parity violations may result in listing demotion or account review." },
];

export function SupportScreen() {
  const [tab, setTab] = useState<"tickets" | "faq" | "guides" | "rules">("tickets");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [priFilter, setPriFilter] = useState("all");
  const [stFilter, setStFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [faqSearch, setFaqSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [openFaqCat, setOpenFaqCat] = useState<string>("Bookings");

  // Compliance state
  const [vlFilter, setVlFilter] = useState("all");
  const [selectedViolation, setSelectedViolation] = useState<typeof VIOLATIONS[0] | null>(null);
  const [selectedAppeal, setSelectedAppeal] = useState<typeof APPEALS[0] | null>(null);
  const [appealFormFor, setAppealFormFor] = useState<typeof VIOLATIONS[0] | null>(null);
  const [appealText, setAppealText] = useState("");
  const [appealSubmitted, setAppealSubmitted] = useState<string[]>([]);

  const filtered = TICKETS.filter((t) => {
    if (catFilter !== "all" && t.category !== catFilter) return false;
    if (priFilter !== "all" && t.priority !== priFilter) return false;
    if (stFilter !== "all" && t.status !== stFilter) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const open      = TICKETS.filter((t) => t.status === "open").length;
  const waitMe    = TICKETS.filter((t) => t.status === "waiting-merchant").length;
  const waitSup   = TICKETS.filter((t) => t.status === "waiting-support").length;
  const resolved  = TICKETS.filter((t) => t.status === "resolved" || t.status === "closed").length;

  const stCfg: Record<string, { label: string; v: BadgeVariant }> = {
    "open":             { label: "Open",                  v: "blue"   },
    "in-progress":      { label: "In Progress",           v: "purple" },
    "waiting-merchant": { label: "Waiting — Merchant",    v: "yellow" },
    "waiting-support":  { label: "Waiting — Support",     v: "orange" },
    "resolved":         { label: "Resolved",              v: "green"  },
    "closed":           { label: "Closed",                v: "gray"   },
  };
  const priCfg: Record<string, BadgeVariant> = { High: "red", Medium: "yellow", Low: "slate" };

  const faqCategories = [...new Set(FAQS.map((f) => f.cat))];
  const faqFiltered = FAQS.filter((f) =>
    !faqSearch || f.q.toLowerCase().includes(faqSearch.toLowerCase()) || f.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#0f172a]" style={{ letterSpacing: "-0.025em" }}>
            Support &amp; Help Center
          </h1>
          <p className="text-[13px] text-[#64748b] mt-0.5">
            Get help, track support tickets, and access documentation.
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Create New Ticket
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Open Tickets",                  value: open,     color: "#2563eb", bg: "#eff6ff", icon: Inbox,        onClick: () => { setTab("tickets"); setStFilter("open"); } },
          { label: "Waiting — Merchant Response",   value: waitMe,   color: "#d97706", bg: "#fffbeb", icon: AlertCircle,  onClick: () => { setTab("tickets"); setStFilter("waiting-merchant"); } },
          { label: "Waiting — Support Response",    value: waitSup,  color: "#7c3aed", bg: "#f5f3ff", icon: Clock,        onClick: () => { setTab("tickets"); setStFilter("waiting-support"); } },
          { label: "Resolved / Closed",             value: resolved, color: "#059669", bg: "#f0fdf4", icon: CheckCircle2, onClick: () => { setTab("tickets"); setStFilter("resolved"); } },
        ].map(({ label, value, color, bg, icon: Icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="bg-white rounded-[12px] border border-[#e2e8f0] p-4 text-left hover:border-[#2563eb]/30 transition-colors group"
            style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11.5px] font-semibold text-[#64748b] uppercase tracking-wide">{label}</p>
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <p className="text-[28px] font-bold leading-none" style={{ color, letterSpacing: "-0.04em" }}>{value}</p>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Create New Ticket", icon: Plus,        desc: "Report an issue or request",       action: () => setCreateOpen(true),                         accent: "#2563eb" },
          { label: "Browse FAQs",       icon: HelpCircle,  desc: "Find answers instantly",            action: () => setTab("faq"),                               accent: "#7c3aed" },
          { label: "User Guides",       icon: FileText,    desc: "Download guides and manuals",       action: () => setTab("guides"),                            accent: "#059669" },
          { label: "Compliance & Rules", icon: Shield,      desc: "Policies, violations, and appeals",  action: () => setTab("rules"),                             accent: "#d97706" },
        ].map(({ label, icon: Icon, desc, action, accent }) => (
          <button
            key={label}
            onClick={action}
            className="flex items-center gap-3 px-4 py-3 bg-white rounded-[12px] border border-[#e2e8f0] hover:border-[#2563eb]/30 hover:bg-[#f8fafc] transition-all text-left"
          >
            <div className="w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: accent + "15" }}>
              <Icon size={17} style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0f172a] leading-tight">{label}</p>
              <p className="text-[11.5px] text-[#94a3b8] leading-tight mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={14} className="ml-auto text-[#cbd5e1] shrink-0" />
          </button>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex gap-0 border-b border-[#e2e8f0] mb-5">
        {(["tickets", "faq", "guides", "rules"] as const).map((t) => {
          const labels: Record<string, string> = { tickets: "Support Tickets", faq: "FAQ", guides: "User Guides", rules: "Compliance & Platform Rules" };
          return (
            <button key={t} onClick={() => setTab(t)}
              className={cx("px-5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                tab === t ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-[#64748b] hover:text-[#0f172a]")}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ── Support Tickets Tab ── */}
      {tab === "tickets" && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[260px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className={cx(inputCls, "pl-9")} placeholder="Search ticket ID or subject..." />
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={cx(selectCls, "w-[190px]")}>
              <option value="all">All Categories</option>
              {["Booking Issues","Room Management","Availability & Pricing","Settlement & Payout","Reviews","Technical Issue","Other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select value={priFilter} onChange={(e) => setPriFilter(e.target.value)} className={cx(selectCls, "w-[130px]")}>
              <option value="all">All Priorities</option>
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
            <select value={stFilter} onChange={(e) => setStFilter(e.target.value)} className={cx(selectCls, "w-[190px]")}>
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="waiting-merchant">Waiting — Merchant</option>
              <option value="waiting-support">Waiting — Support</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            {(search || catFilter !== "all" || priFilter !== "all" || stFilter !== "all") && (
              <button className={btnGhost} onClick={() => { setSearch(""); setCatFilter("all"); setPriFilter("all"); setStFilter("all"); }}>
                <X size={13} /> Clear
              </button>
            )}
            <p className="ml-auto text-[12px] text-[#94a3b8]">{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</p>
          </div>

          {/* Split panel */}
          <div className="flex gap-4 min-h-0">
            {/* Table */}
            <div className={cx("min-w-0", selectedTicket ? "w-[52%] shrink-0" : "flex-1")}>
              <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                      {["Ticket ID","Category","Subject","Priority","Status","Agent","Updated",""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const isSelected = selectedTicket?.id === t.id;
                      const sc = stCfg[t.status];
                      return (
                        <tr key={t.id} onClick={() => { setSelectedTicket(isSelected ? null : t); setReplyText(""); }}
                          className={cx("border-b border-[#f1f5f9] cursor-pointer transition-colors", isSelected ? "bg-[#eff6ff]" : "hover:bg-[#f8fafc]")}>
                          <td className="px-3 py-3 font-semibold text-[#2563eb] whitespace-nowrap">{t.id}</td>
                          <td className="px-3 py-3 text-[#64748b] whitespace-nowrap max-w-[110px] truncate">{t.category}</td>
                          <td className="px-3 py-3 text-[#0f172a] max-w-[180px]"><p className="truncate">{t.subject}</p></td>
                          <td className="px-3 py-3"><Badge label={t.priority} variant={priCfg[t.priority]} /></td>
                          <td className="px-3 py-3 whitespace-nowrap"><Badge label={sc.label} variant={sc.v} /></td>
                          <td className="px-3 py-3 text-[#64748b] whitespace-nowrap">{t.agent}</td>
                          <td className="px-3 py-3 text-[#94a3b8] whitespace-nowrap">{t.updated}</td>
                          <td className="px-3 py-3"><button className={btnGhost}><Eye size={12} /></button></td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-[13px] text-[#94a3b8]">No tickets match your current filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ticket detail drawer */}
            {selectedTicket && (() => {
              const conv = TICKET_CONV[selectedTicket.id] ?? [];
              const hist = TICKET_HISTORY[selectedTicket.id] ?? [];
              const sc = stCfg[selectedTicket.status];
              const isResolved = selectedTicket.status === "resolved" || selectedTicket.status === "closed";
              return (
                <div className="flex-1 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col overflow-hidden">
                  {/* Drawer header */}
                  <div className="flex items-start justify-between px-5 py-4 border-b border-[#e2e8f0] shrink-0">
                    <div>
                      <p className="text-[13.5px] font-bold text-[#0f172a]">{selectedTicket.id}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge label={sc.label} variant={sc.v} />
                        <Badge label={selectedTicket.priority} variant={priCfg[selectedTicket.priority]} />
                        <span className="text-[11.5px] text-[#94a3b8]">{selectedTicket.category}</span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedTicket(null)} className={cx(btnGhost, "p-1.5 shrink-0")}><X size={14} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {/* Subject + meta */}
                    <div className="px-5 py-4 border-b border-[#f1f5f9]">
                      <p className="text-[13.5px] font-semibold text-[#0f172a] mb-3">{selectedTicket.subject}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Created",  value: selectedTicket.created },
                          { label: "Updated",  value: selectedTicket.updated },
                          { label: "Agent",    value: selectedTicket.agent },
                          { label: "Category", value: selectedTicket.category },
                        ].map((d) => (
                          <div key={d.label} className="p-2.5 rounded-[7px] bg-[#f8fafc] border border-[#f1f5f9]">
                            <p className="text-[10.5px] text-[#94a3b8] font-medium">{d.label}</p>
                            <p className="text-[12px] font-semibold text-[#0f172a] mt-0.5">{d.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Conversation */}
                    <div className="px-5 py-4 space-y-3 border-b border-[#f1f5f9]">
                      <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-3">Conversation</p>
                      {conv.map((msg, i) => {
                        const isMerchant = msg.from === "merchant";
                        return (
                          <div key={i} className={cx("flex gap-2.5", isMerchant ? "flex-row-reverse" : "flex-row")}>
                            {/* Avatar */}
                            <div className={cx("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                              isMerchant ? "bg-[#2563eb] text-white" : "bg-[#f1f5f9] text-[#64748b]")}>
                              {isMerchant ? "M" : (msg.agent ?? "S").charAt(0)}
                            </div>
                            <div className={cx("max-w-[85%]", isMerchant ? "items-end" : "items-start", "flex flex-col")}>
                              {!isMerchant && (
                                <p className="text-[10.5px] font-semibold text-[#64748b] mb-1">
                                  {msg.agent} · mTrip Support
                                </p>
                              )}
                              <div className={cx("px-3.5 py-2.5 rounded-[10px] text-[12.5px] leading-relaxed",
                                isMerchant
                                  ? "bg-[#2563eb] text-white rounded-tr-[3px]"
                                  : "bg-[#f1f5f9] text-[#334155] rounded-tl-[3px]")}>
                                {msg.text}
                              </div>
                              {msg.attachment && (
                                <div className={cx("mt-1.5 flex items-center gap-2 px-3 py-1.5 rounded-[7px] border text-[11.5px] font-medium cursor-pointer hover:bg-[#f8fafc] transition-colors",
                                  isMerchant ? "bg-[#dbeafe] border-blue-200 text-[#1d4ed8]" : "bg-white border-[#e2e8f0] text-[#64748b]")}>
                                  <FileText size={12} />
                                  {msg.attachment}
                                  <Download size={11} className="ml-1" />
                                </div>
                              )}
                              <p className={cx("text-[10.5px] mt-1", isMerchant ? "text-[#94a3b8] text-right" : "text-[#94a3b8]")}>
                                {msg.time}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {conv.length === 0 && (
                        <p className="text-[12.5px] text-[#94a3b8] italic">No messages yet. Our team will respond shortly.</p>
                      )}
                    </div>

                    {/* Status history */}
                    {hist.length > 0 && (
                      <div className="px-5 py-4 border-b border-[#f1f5f9]">
                        <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-3">Status History</p>
                        <div className="space-y-2">
                          {hist.map((h, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb] mt-[5px] shrink-0" />
                              <div>
                                <span className="text-[12px] font-semibold text-[#0f172a]">{h.status}</span>
                                <span className="text-[11.5px] text-[#94a3b8] ml-2">{h.time}</span>
                                <p className="text-[11.5px] text-[#64748b]">{h.note}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reply area */}
                    {!isResolved && (
                      <div className="px-5 py-4">
                        <p className="text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-2">Reply</p>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className={cx(inputCls, "h-[80px] resize-none text-[12.5px]")}
                          placeholder="Type your reply..."
                        />
                        <div className="flex gap-2 mt-2.5 flex-wrap">
                          <button className={btnPrimary} onClick={() => setReplyText("")}>
                            <ArrowRight size={13} /> Send Reply
                          </button>
                          <button className={btnSecondary}>
                            <Upload size={13} /> Attach File
                          </button>
                          {isResolved && (
                            <button className={cx(btnSecondary, "text-amber-600 border-amber-200 hover:bg-amber-50")}>
                              <RotateCcw size={13} /> Reopen Ticket
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resolved / Closed actions */}
                    {isResolved && (
                      <div className="px-5 py-4">
                        <div className="p-3.5 rounded-[10px] bg-emerald-50 border border-emerald-200 flex items-center gap-3 mb-3">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <p className="text-[12.5px] text-emerald-800 font-medium">
                            This ticket has been {selectedTicket.status}. If the issue persists, you can reopen it.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button className={cx(btnSecondary, "text-amber-600 border-amber-200 hover:bg-amber-50")}>
                            <RotateCcw size={13} /> Reopen Ticket
                          </button>
                          {selectedTicket.status === "resolved" && (
                            <button className={cx(btnSecondary, "text-[#94a3b8]")}>
                              <Check size={13} /> Close Ticket
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* ── FAQ Tab ── */}
      {tab === "faq" && (
        <div className="max-w-[820px]">
          <div className="relative mb-5">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input value={faqSearch} onChange={(e) => setFaqSearch(e.target.value)} className={cx(inputCls, "pl-10 text-[13px]")} placeholder="Search frequently asked questions..." />
          </div>
          {faqSearch ? (
            <div className="space-y-2">
              {faqFiltered.length === 0
                ? <p className="text-[13px] text-[#94a3b8] py-8 text-center">No results found for "{faqSearch}".</p>
                : faqFiltered.map((f, i) => (
                  <div key={i} className="bg-white rounded-[10px] border border-[#e2e8f0] overflow-hidden">
                    <button className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left" onClick={() => setOpenFaq(openFaq === `s-${i}` ? null : `s-${i}`)}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0"><Badge label={f.cat} variant="slate" /></span>
                        <p className="text-[13px] font-semibold text-[#0f172a]">{f.q}</p>
                      </div>
                      <ChevronDown size={15} className={cx("shrink-0 text-[#94a3b8] transition-transform mt-0.5", openFaq === `s-${i}` ? "rotate-180" : "")} />
                    </button>
                    {openFaq === `s-${i}` && (
                      <div className="px-5 pb-4 pt-0">
                        <p className="text-[13px] text-[#334155] leading-relaxed border-t border-[#f1f5f9] pt-3">{f.a}</p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-4">
              {faqCategories.map((cat) => {
                const items = FAQS.filter((f) => f.cat === cat);
                const isOpen = openFaqCat === cat;
                return (
                  <div key={cat} className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
                    <button className="w-full flex items-center justify-between px-5 py-3.5 text-left" onClick={() => setOpenFaqCat(isOpen ? "" : cat)}>
                      <div className="flex items-center gap-3">
                        <HelpCircle size={15} className="text-[#2563eb]" />
                        <p className="text-[13.5px] font-bold text-[#0f172a]">{cat}</p>
                        <span className="text-[11.5px] text-[#94a3b8]">{items.length} question{items.length !== 1 ? "s" : ""}</span>
                      </div>
                      <ChevronDown size={15} className={cx("text-[#94a3b8] transition-transform", isOpen ? "rotate-180" : "")} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#f1f5f9]">
                        {items.map((f, i) => (
                          <div key={i} className="border-b border-[#f1f5f9] last:border-0">
                            <button className="w-full flex items-center justify-between px-5 py-3.5 text-left gap-4" onClick={() => setOpenFaq(openFaq === `${cat}-${i}` ? null : `${cat}-${i}`)}>
                              <p className="text-[13px] font-medium text-[#334155]">{f.q}</p>
                              <ChevronDown size={13} className={cx("shrink-0 text-[#94a3b8] transition-transform", openFaq === `${cat}-${i}` ? "rotate-180" : "")} />
                            </button>
                            {openFaq === `${cat}-${i}` && (
                              <div className="px-5 pb-4">
                                <p className="text-[12.5px] text-[#64748b] leading-relaxed">{f.a}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6 p-4 bg-[#eff6ff] rounded-[12px] border border-blue-100 flex items-center gap-4">
            <Info size={18} className="text-[#2563eb] shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-[#1d4ed8]">Still need help?</p>
              <p className="text-[12.5px] text-[#2563eb] mt-0.5">If you could not find the answer you were looking for, raise a support ticket and our team will assist you within 1 business day.</p>
            </div>
            <button className={cx(btnPrimary, "shrink-0 ml-auto")} onClick={() => setCreateOpen(true)}>
              <Plus size={13} /> Create Ticket
            </button>
          </div>
        </div>
      )}

      {/* ── User Guides Tab ── */}
      {tab === "guides" && (
        <div>
          <p className="text-[13px] text-[#64748b] mb-5">Download official guides and documentation for the mTrip Merchant Portal.</p>
          <div className="grid grid-cols-2 gap-4">
            {GUIDES.map((g, i) => (
              <div key={i} className="flex items-start gap-4 bg-white rounded-[12px] border border-[#e2e8f0] p-4 hover:border-[#2563eb]/30 transition-colors">
                <div className="w-10 h-12 rounded-[8px] bg-red-50 border border-red-100 flex flex-col items-center justify-center shrink-0">
                  <FileText size={16} className="text-red-400" />
                  <span className="text-[8px] font-bold text-red-400 mt-0.5">PDF</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0f172a] leading-snug">{g.title}</p>
                  <p className="text-[12px] text-[#64748b] mt-1 leading-snug">{g.desc}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-[#94a3b8]">{g.size}</span>
                    <span className="text-[#e2e8f0]">·</span>
                    <span className="text-[11px] text-[#94a3b8]">Updated {g.updated}</span>
                  </div>
                </div>
                <button className={cx(btnSecondary, "shrink-0 text-[12px] px-3 py-1.5")}>
                  <Download size={12} /> Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Compliance & Platform Rules Tab ── */}
      {tab === "rules" && (() => {
        const sectionColor: Record<string, BadgeVariant> = { Booking: "blue", Content: "purple", Reviews: "green", Settlement: "yellow" };

        const vlStatusCfg: Record<string, { label: string; v: BadgeVariant }> = {
          active:   { label: "Active",        v: "red"    },
          warning:  { label: "Warning",       v: "yellow" },
          review:   { label: "Under Review",  v: "blue"   },
          resolved: { label: "Resolved",      v: "green"  },
          rejected: { label: "Rejected",      v: "red"    },
        };

        const apStatusCfg: Record<string, { label: string; v: BadgeVariant }> = {
          pending:  { label: "Pending Review", v: "yellow" },
          approved: { label: "Approved",       v: "green"  },
          rejected: { label: "Rejected",       v: "red"    },
        };

        const activeWarnings = WARNINGS.filter((w) => w.status === "active").length;
        const activeViolations = VIOLATIONS.filter((v) => v.status === "active").length;
        const penaltyPoints = VIOLATIONS.filter((v) => v.status === "active").reduce((s, v) => s + v.points, 0);
        const pendingAppeals = APPEALS.filter((a) => a.status === "pending").length + appealSubmitted.length;

        const filteredViolations = VIOLATIONS.filter((v) => vlFilter === "all" || v.status === vlFilter);

        return (
          <div>
            {/* ── My Compliance Summary ── */}
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">My Compliance</p>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Compliance Score",  value: "87 / 100", sub: "Good standing",           color: "#059669", bg: "#f0fdf4", icon: Award,         bar: 87  },
                  { label: "Active Warnings",   value: activeWarnings,  sub: "Require attention",        color: "#d97706", bg: "#fffbeb", icon: AlertTriangle, bar: null },
                  { label: "Penalty Points",    value: penaltyPoints,   sub: "Active (180-day window)",  color: "#dc2626", bg: "#fef2f2", icon: TrendingDown,  bar: null },
                  { label: "Pending Appeals",   value: pendingAppeals,  sub: "Awaiting review",          color: "#2563eb", bg: "#eff6ff", icon: MessageSquare, bar: null },
                ].map(({ label, value, sub, color, bg, icon: Icon, bar }) => (
                  <div key={label} className="bg-white rounded-[12px] border border-[#e2e8f0] p-4" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                    <div className="flex items-start justify-between mb-2.5">
                      <p className="text-[11.5px] font-semibold text-[#64748b] uppercase tracking-wide leading-tight pr-2">{label}</p>
                      <div className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: bg }}>
                        <Icon size={14} style={{ color }} />
                      </div>
                    </div>
                    <p className="text-[26px] font-bold leading-none mb-1" style={{ color, letterSpacing: "-0.04em" }}>{value}</p>
                    {bar !== null ? (
                      <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-[#f1f5f9] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${bar}%`, background: color }} />
                        </div>
                        <p className="text-[11px] text-[#94a3b8] mt-1">{sub}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#94a3b8]">{sub}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Active warning banner */}
              {activeWarnings > 0 && (
                <div className="mt-3 flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-[10px] border border-amber-200">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-amber-800">You have {activeWarnings} active warning{activeWarnings > 1 ? "s" : ""} requiring attention.</p>
                    <p className="text-[12px] text-amber-700 mt-0.5">{WARNINGS.filter((w) => w.status === "active").map((w) => w.property).join(", ")} — unresolved warnings may escalate to violations.</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Platform Rules ── */}
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">Platform Rules</p>
              <p className="text-[12.5px] text-[#64748b] mb-3">Mandatory policies and content standards all mTrip hotel merchants must comply with.</p>
              <div className="space-y-2.5">
                {RULES.map((r) => (
                  <div key={r.id} className="bg-white rounded-[12px] border border-[#e2e8f0] p-5 hover:border-[#2563eb]/20 transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] font-semibold text-[#94a3b8]">{r.id}</span>
                        <Badge label={r.section} variant={sectionColor[r.section] ?? "slate"} />
                        <p className="text-[13px] font-bold text-[#0f172a]">{r.title}</p>
                      </div>
                      <span className="text-[11.5px] text-[#94a3b8] shrink-0 whitespace-nowrap">Effective {r.effective}</span>
                    </div>
                    <p className="text-[12.5px] text-[#64748b] leading-relaxed">{r.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-4 bg-amber-50 rounded-[12px] border border-amber-200 flex items-center gap-3">
                <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                <p className="text-[12.5px] text-amber-800">Violations may result in listing demotion, temporary suspension, or permanent account termination. For questions, raise a support ticket.</p>
              </div>
            </div>

            {/* ── My Violations ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">My Violations</p>
                <div className="flex items-center gap-2">
                  <select value={vlFilter} onChange={(e) => { setVlFilter(e.target.value); setSelectedViolation(null); }} className={cx(selectCls, "text-[12px] py-1.5 w-[150px]")}>
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                {/* Violations table */}
                <div className={cx("bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden", selectedViolation ? "flex-1" : "w-full")}>
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                        {["Date", "Property", "Rule Violated", "Rule Ref.", "Penalty Pts", "Status", ""].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredViolations.map((v) => {
                        const sc = vlStatusCfg[v.status] ?? vlStatusCfg.active;
                        const isSelected = selectedViolation?.id === v.id;
                        return (
                          <tr key={v.id} className={cx("border-b border-[#f1f5f9] transition-colors", isSelected ? "bg-[#eff6ff]" : "hover:bg-[#f8fafc]")}>
                            <td className="px-3 py-3 text-[#64748b] whitespace-nowrap">{v.date}</td>
                            <td className="px-3 py-3 text-[#0f172a] font-medium whitespace-nowrap">{v.property}</td>
                            <td className="px-3 py-3 text-[#334155]">{v.violation}</td>
                            <td className="px-3 py-3"><Badge label={v.rule} variant="slate" /></td>
                            <td className="px-3 py-3 font-bold" style={{ color: v.status === "active" ? "#dc2626" : "#94a3b8" }}>+{v.points}</td>
                            <td className="px-3 py-3 whitespace-nowrap"><Badge label={sc.label} variant={sc.v} /></td>
                            <td className="px-3 py-3">
                              <button
                                onClick={() => setSelectedViolation(isSelected ? null : v)}
                                className={cx(btnGhost, "text-[11.5px] px-2.5 py-1")}
                              >
                                <Eye size={12} /> {isSelected ? "Close" : "View"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredViolations.length === 0 && (
                        <tr><td colSpan={7} className="py-10 text-center text-[13px] text-[#94a3b8]">No violations found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Violation detail panel */}
                {selectedViolation && (() => {
                  const v = selectedViolation;
                  const sc = vlStatusCfg[v.status] ?? vlStatusCfg.active;
                  const rule = RULES.find((r) => r.id === v.rule);
                  const alreadyAppealed = v.appealed || appealSubmitted.includes(v.id);
                  const existingAppeal = APPEALS.find((a) => a.violationId === v.id);
                  return (
                    <div className="w-[320px] shrink-0 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e2e8f0]">
                        <p className="text-[12.5px] font-bold text-[#0f172a]">{v.id}</p>
                        <button onClick={() => setSelectedViolation(null)} className={cx(btnGhost, "p-1")}><X size={13} /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Violation Details</p>
                          <div className="space-y-2">
                            {[
                              { label: "Date Issued",  value: v.date },
                              { label: "Property",     value: v.property },
                              { label: "Violation",    value: v.violation },
                              { label: "Rule Ref.",    value: v.rule },
                            ].map((d) => (
                              <div key={d.label} className="flex items-start justify-between gap-2 py-2 border-b border-[#f8fafc]">
                                <span className="text-[11.5px] text-[#94a3b8]">{d.label}</span>
                                <span className="text-[12px] font-semibold text-[#0f172a] text-right">{d.value}</span>
                              </div>
                            ))}
                            <div className="flex items-start justify-between gap-2 py-2 border-b border-[#f8fafc]">
                              <span className="text-[11.5px] text-[#94a3b8]">Status</span>
                              <Badge label={sc.label} variant={sc.v} />
                            </div>
                            <div className="flex items-start justify-between gap-2 py-2">
                              <span className="text-[11.5px] text-[#94a3b8]">Penalty Points</span>
                              <span className="text-[14px] font-bold" style={{ color: v.status === "active" ? "#dc2626" : "#94a3b8" }}>+{v.points} pts</span>
                            </div>
                          </div>
                        </div>

                        {rule && (
                          <div className="p-3 bg-[#f8fafc] rounded-[8px] border border-[#e2e8f0]">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">Applicable Rule</p>
                            <p className="text-[12px] font-semibold text-[#0f172a] mb-1">{rule.title}</p>
                            <p className="text-[11.5px] text-[#64748b] leading-relaxed">{rule.desc}</p>
                          </div>
                        )}

                        {v.status === "active" && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Actions</p>
                            {alreadyAppealed ? (
                              <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 rounded-[8px] border border-blue-100">
                                <Clock size={13} className="text-blue-500 shrink-0" />
                                <p className="text-[12px] text-blue-700 font-medium">Appeal submitted — pending review</p>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAppealFormFor(v)}
                                className={cx(btnPrimary, "w-full justify-center text-[12px] py-2")}
                              >
                                <Gavel size={13} /> Submit an Appeal
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── Appeals ── */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">Appeals</p>
              </div>

              {(APPEALS.length === 0 && appealSubmitted.length === 0) ? (
                <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-8 text-center">
                  <Gavel size={22} className="text-[#cbd5e1] mx-auto mb-2" />
                  <p className="text-[13px] text-[#94a3b8]">No appeals have been submitted.</p>
                  <p className="text-[12px] text-[#94a3b8] mt-1">To submit an appeal, click "View" on an active violation.</p>
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className={cx("bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden", selectedAppeal ? "flex-1" : "w-full")}>
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                          {["Appeal ID", "Violation", "Property", "Submitted", "Status", ""].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {APPEALS.map((a) => {
                          const sc = apStatusCfg[a.status] ?? apStatusCfg.pending;
                          const isSelected = selectedAppeal?.id === a.id;
                          return (
                            <tr key={a.id} className={cx("border-b border-[#f1f5f9] transition-colors", isSelected ? "bg-[#eff6ff]" : "hover:bg-[#f8fafc]")}>
                              <td className="px-3 py-3 font-semibold text-[#2563eb] whitespace-nowrap">{a.id}</td>
                              <td className="px-3 py-3 text-[#0f172a]">{a.violation}</td>
                              <td className="px-3 py-3 text-[#64748b] whitespace-nowrap">{a.property}</td>
                              <td className="px-3 py-3 text-[#64748b] whitespace-nowrap">{a.submitted}</td>
                              <td className="px-3 py-3 whitespace-nowrap"><Badge label={sc.label} variant={sc.v} /></td>
                              <td className="px-3 py-3">
                                <button onClick={() => setSelectedAppeal(isSelected ? null : a)} className={cx(btnGhost, "text-[11.5px] px-2.5 py-1")}>
                                  <Eye size={12} /> {isSelected ? "Close" : "View Appeal"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {appealSubmitted.map((vid) => {
                          const v = VIOLATIONS.find((x) => x.id === vid);
                          return v ? (
                            <tr key={`new-${vid}`} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                              <td className="px-3 py-3 font-semibold text-[#2563eb]">AP-NEW</td>
                              <td className="px-3 py-3 text-[#0f172a]">{v.violation}</td>
                              <td className="px-3 py-3 text-[#64748b]">{v.property}</td>
                              <td className="px-3 py-3 text-[#64748b]">27 Jul 2026</td>
                              <td className="px-3 py-3"><Badge label="Pending Review" variant="yellow" /></td>
                              <td className="px-3 py-3">
                                <span className="text-[11.5px] text-[#94a3b8] italic">Just submitted</span>
                              </td>
                            </tr>
                          ) : null;
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Appeal detail panel */}
                  {selectedAppeal && (() => {
                    const a = selectedAppeal;
                    const sc = apStatusCfg[a.status] ?? apStatusCfg.pending;
                    return (
                      <div className="w-[300px] shrink-0 bg-white rounded-[12px] border border-[#e2e8f0] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e2e8f0]">
                          <p className="text-[12.5px] font-bold text-[#0f172a]">{a.id}</p>
                          <button onClick={() => setSelectedAppeal(null)} className={cx(btnGhost, "p-1")}><X size={13} /></button>
                        </div>
                        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                          <div className="space-y-2">
                            {[
                              { label: "Violation",  value: a.violation },
                              { label: "Property",   value: a.property },
                              { label: "Submitted",  value: a.submitted },
                            ].map((d) => (
                              <div key={d.label} className="flex items-start justify-between gap-2 py-1.5 border-b border-[#f8fafc]">
                                <span className="text-[11.5px] text-[#94a3b8]">{d.label}</span>
                                <span className="text-[12px] font-semibold text-[#0f172a] text-right">{d.value}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-[11.5px] text-[#94a3b8]">Status</span>
                              <Badge label={sc.label} variant={sc.v} />
                            </div>
                          </div>
                          <div className="p-3 bg-[#f8fafc] rounded-[8px] border border-[#e2e8f0]">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1">Timeline</p>
                            <div className="space-y-2 mt-2">
                              {[
                                { label: "Appeal submitted", time: a.submitted, done: true },
                                { label: "Under review by Compliance team", time: a.status !== "pending" ? "26 Jun 2026" : "Pending", done: a.status !== "pending" },
                                { label: "Outcome issued", time: a.outcome || "—", done: !!a.outcome },
                              ].map((step, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <div className={cx("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5", step.done ? "border-blue-500 bg-blue-500" : "border-[#e2e8f0] bg-white")}>
                                    {step.done && <Check size={9} className="text-white" />}
                                  </div>
                                  <div>
                                    <p className="text-[11.5px] font-medium text-[#334155]">{step.label}</p>
                                    <p className="text-[10.5px] text-[#94a3b8]">{step.time}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {a.status === "pending" && (
                            <div className="flex items-start gap-2 px-3 py-2.5 bg-[#eff6ff] rounded-[8px] border border-blue-100">
                              <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
                              <p className="text-[11.5px] text-blue-700">Appeals are typically reviewed within 5–7 business days. You will be notified of the outcome via email.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Appeal submission modal ── */}
      {appealFormFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm" onClick={() => setAppealFormFor(null)}>
          <div className="bg-white rounded-[14px] w-[520px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div>
                <p className="text-[15px] font-bold text-[#0f172a]">Submit an Appeal</p>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">{appealFormFor.violation} · {appealFormFor.property}</p>
              </div>
              <button onClick={() => setAppealFormFor(null)} className={cx(btnGhost, "p-1.5")}><X size={15} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-[8px] border border-amber-200">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800">Appeals are reviewed by the mTrip Compliance team within 5–7 business days. Submitting false or misleading evidence may result in additional penalties.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Grounds for Appeal <span className="text-red-400">*</span></label>
                <select className={selectCls}>
                  <option value="">Select reason…</option>
                  <option>Violation was issued in error — circumstances were outside our control</option>
                  <option>We have since remediated the issue fully</option>
                  <option>The violation notice was not received or improperly communicated</option>
                  <option>We dispute the penalty points assigned</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Appeal Statement <span className="text-red-400">*</span></label>
                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  className={cx(inputCls, "h-[100px] resize-none")}
                  placeholder="Provide a clear and factual explanation of why this violation should be reviewed or overturned. Include any relevant dates, actions taken, and context…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Supporting Evidence <span className="text-[#94a3b8] font-normal">(optional)</span></label>
                <div className="flex items-center justify-center h-[64px] border-2 border-dashed border-[#e2e8f0] rounded-[8px] cursor-pointer hover:border-[#2563eb]/40 hover:bg-[#f8fafc] transition-colors">
                  <div className="flex items-center gap-2 text-[#94a3b8]">
                    <Upload size={14} />
                    <span className="text-[12px]">Attach documents, screenshots, or communication records</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#e2e8f0]">
              <button className={btnSecondary} onClick={() => setAppealFormFor(null)}>Cancel</button>
              <button
                className={btnPrimary}
                onClick={() => {
                  setAppealSubmitted((prev) => [...prev, appealFormFor.id]);
                  setAppealFormFor(null);
                  setAppealText("");
                  setSelectedViolation(null);
                }}
              >
                <ArrowRight size={14} /> Submit Appeal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Ticket Modal ── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm" onClick={() => setCreateOpen(false)}>
          <div className="bg-white rounded-[14px] w-[540px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div>
                <p className="text-[15px] font-bold text-[#0f172a]">Create Support Ticket</p>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">Describe your issue and our team will respond within 1 business day.</p>
              </div>
              <button onClick={() => setCreateOpen(false)} className={cx(btnGhost, "p-1.5")}><X size={15} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-[#334155]">Category <span className="text-red-400">*</span></label>
                  <select className={selectCls}>
                    <option value="">Select category...</option>
                    {["Booking Issues","Room Management","Availability & Pricing","Settlement & Payout","Promotions","Reviews","Technical Issue","Other"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-[#334155]">Priority <span className="text-red-400">*</span></label>
                  <select className={selectCls}>
                    <option value="">Select priority...</option>
                    <option>High — Urgent, operational impact</option>
                    <option>Medium — Needs resolution soon</option>
                    <option>Low — General enquiry</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Subject <span className="text-red-400">*</span></label>
                <input className={inputCls} placeholder="Brief description of the issue..." />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Description <span className="text-red-400">*</span></label>
                <textarea className={cx(inputCls, "h-[110px] resize-none")} placeholder="Provide as much detail as possible — include booking IDs, dates, error messages, and steps to reproduce if applicable..." />
                <p className="text-[11px] text-[#94a3b8]">The more detail you provide, the faster our team can resolve your issue.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Attachments <span className="text-[#94a3b8] font-normal">(optional)</span></label>
                <div className="flex items-center justify-center h-[72px] border-2 border-dashed border-[#e2e8f0] rounded-[8px] cursor-pointer hover:border-[#2563eb]/40 hover:bg-[#f8fafc] transition-colors">
                  <div className="flex items-center gap-2 text-[#94a3b8]">
                    <Upload size={15} />
                    <span className="text-[12.5px]">Click to upload or drag &amp; drop</span>
                    <span className="text-[11px]">· PDF, JPG, PNG, XLSX · Max 10 MB</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#e2e8f0]">
              <button className={btnSecondary} onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className={btnPrimary} onClick={() => setCreateOpen(false)}>
                <ArrowRight size={14} /> Submit Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

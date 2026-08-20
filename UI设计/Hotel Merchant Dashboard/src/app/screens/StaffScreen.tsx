import { useState } from "react";
import {
  Search, X, UserPlus, Shield, RotateCcw, Ban, Edit2, Check,
  CheckCircle2, Clock, Users, Activity, Download, Info, AlertTriangle, ArrowRight,
} from "lucide-react";
import {
  cx, inputCls, selectCls, btnPrimary, btnSecondary, btnGhost,
  Badge, type BadgeVariant,
} from "../shared";

const STAFF_MEMBERS = [
  { id: "SM-001", name: "Nattha Wongchai",  email: "nattha.w@horizonresort.com",    role: "Hotel Owner",         hotel: "The Horizon Resort",   status: "active",   lastLogin: "23 Jul 2026, 09:14", invited: "01 Jan 2025" },
  { id: "SM-002", name: "Chaiwat Srisuk",   email: "chaiwat.s@horizonresort.com",   role: "Hotel Manager",       hotel: "The Horizon Resort",   status: "active",   lastLogin: "23 Jul 2026, 08:47", invited: "15 Feb 2025" },
  { id: "SM-003", name: "Pornpan Keerati",  email: "pornpan.k@horizonresort.com",   role: "Reservation Officer", hotel: "The Horizon Resort",   status: "active",   lastLogin: "22 Jul 2026, 17:32", invited: "15 Feb 2025" },
  { id: "SM-004", name: "Sumalee Thong",    email: "sumalee.t@horizonresort.com",   role: "Reservation Officer", hotel: "The Horizon Resort",   status: "active",   lastLogin: "21 Jul 2026, 14:05", invited: "10 Mar 2025" },
  { id: "SM-005", name: "Apirak Nimman",    email: "apirak.n@bluelagoon.com",       role: "Hotel Manager",       hotel: "Blue Lagoon Boutique", status: "active",   lastLogin: "20 Jul 2026, 11:22", invited: "01 Apr 2025" },
  { id: "SM-006", name: "Wanida Petchra",   email: "wanida.p@bluelagoon.com",       role: "Reservation Officer", hotel: "Blue Lagoon Boutique", status: "pending",  lastLogin: "—",                  invited: "21 Jul 2026" },
  { id: "SM-007", name: "Thanakorn Burin",  email: "thanakorn.b@horizonresort.com", role: "Reservation Officer", hotel: "The Horizon Resort",   status: "disabled", lastLogin: "05 Jun 2026, 10:18", invited: "20 Jan 2025" },
];

type StaffMember = typeof STAFF_MEMBERS[0];

const PERM_MODULES = [
  "Hotel Properties", "Room Types", "Availability & Pricing", "Booking Management",
  "Business Dashboard", "Promotions", "Reviews", "Staff Management", "Settings",
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  "Hotel Owner":         ["Full", "Full", "Full", "Full", "Full", "Full", "Full", "Full", "Full"],
  "Hotel Manager":       ["Full", "Full", "Full", "Full", "View", "Edit", "Full", "None", "Edit"],
  "Reservation Officer": ["View", "View", "Edit", "Full", "None", "None", "View", "None", "None"],
};

const AUDIT_LOG = [
  { id: "AL-001", action: "Role updated",        target: "SM-004", detail: "Reservation Officer → Hotel Manager (reverted)", by: "SM-001", time: "20 Jul 2026, 16:45" },
  { id: "AL-002", action: "Staff invited",        target: "SM-006", detail: "wanida.p@bluelagoon.com — Reservation Officer",  by: "SM-002", time: "21 Jul 2026, 11:30" },
  { id: "AL-003", action: "Account disabled",     target: "SM-007", detail: "thanakorn.b@horizonresort.com — access revoked",  by: "SM-001", time: "15 Jul 2026, 09:00" },
  { id: "AL-004", action: "Password reset sent",  target: "SM-003", detail: "Reset link sent to pornpan.k@horizonresort.com",  by: "SM-002", time: "10 Jul 2026, 14:22" },
  { id: "AL-005", action: "Staff added",          target: "SM-005", detail: "apirak.n@bluelagoon.com — Hotel Manager",         by: "SM-001", time: "01 Apr 2025, 10:00" },
];

function PermCell({ level }: { level: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    Full: { label: "Full", cls: "bg-[#2563eb] text-white" },
    Edit: { label: "Edit", cls: "bg-[#dbeafe] text-[#1d4ed8]" },
    View: { label: "View", cls: "bg-[#f1f5f9] text-[#475569]" },
    None: { label: "—",    cls: "bg-transparent text-[#cbd5e1]" },
  };
  const { label, cls } = cfg[level] ?? cfg["None"];
  return (
    <span className={cx("inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-[5px] min-w-[36px]", cls)}>
      {label}
    </span>
  );
}

export function StaffScreen() {
  const [tab, setTab] = useState<"staff" | "permissions" | "audit">("staff");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [hotelFilter, setHotelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<StaffMember | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; member: StaffMember } | null>(null);
  const [viewPermRole, setViewPermRole] = useState<string | null>(null);

  const filtered = STAFF_MEMBERS.filter((m) => {
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (hotelFilter !== "all" && m.hotel !== hotelFilter) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const total    = STAFF_MEMBERS.length;
  const active   = STAFF_MEMBERS.filter((m) => m.status === "active").length;
  const pending  = STAFF_MEMBERS.filter((m) => m.status === "pending").length;
  const disabled = STAFF_MEMBERS.filter((m) => m.status === "disabled").length;

  const statusVariant = (s: string): BadgeVariant => s === "active" ? "green" : s === "pending" ? "yellow" : "gray";
  const roleBadgeVariant = (r: string): BadgeVariant => r === "Hotel Owner" ? "purple" : r === "Hotel Manager" ? "blue" : "slate";

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#0f172a]" style={{ letterSpacing: "-0.025em" }}>Staff Management</h1>
          <p className="text-[13px] text-[#64748b] mt-0.5">Manage hotel staff, roles and access permissions.</p>
        </div>
        <button className={btnPrimary} onClick={() => setInviteOpen(true)}>
          <UserPlus size={14} /> Invite Staff
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total Staff",         value: total,    icon: Users,        accent: "#2563eb", bg: "#eff6ff" },
          { label: "Active Staff",        value: active,   icon: CheckCircle2, accent: "#059669", bg: "#f0fdf4" },
          { label: "Pending Invitations", value: pending,  icon: Clock,        accent: "#d97706", bg: "#fffbeb" },
          { label: "Disabled Accounts",   value: disabled, icon: Ban,          accent: "#94a3b8", bg: "#f1f5f9" },
        ].map(({ label, value, icon: Icon, accent, bg }) => (
          <div key={label} className="bg-white rounded-[12px] border border-[#e2e8f0] p-4" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11.5px] font-semibold text-[#64748b] uppercase tracking-wide">{label}</p>
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={15} style={{ color: accent }} />
              </div>
            </div>
            <p className="text-[28px] font-bold leading-none" style={{ color: accent, letterSpacing: "-0.04em" }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-0 border-b border-[#e2e8f0] mb-5">
        {(["staff", "permissions", "audit"] as const).map((t) => {
          const labels: Record<string, string> = { staff: "Staff List", permissions: "Permission Matrix", audit: "Audit History" };
          return (
            <button key={t} onClick={() => setTab(t)}
              className={cx("px-5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                tab === t ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-[#64748b] hover:text-[#0f172a]")}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {tab === "staff" && (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[260px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className={cx(inputCls, "pl-9")} placeholder="Search name or email..." />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={cx(selectCls, "w-[180px]")}>
              <option value="all">All Roles</option>
              <option value="Hotel Owner">Hotel Owner</option>
              <option value="Hotel Manager">Hotel Manager</option>
              <option value="Reservation Officer">Reservation Officer</option>
            </select>
            <select value={hotelFilter} onChange={(e) => setHotelFilter(e.target.value)} className={cx(selectCls, "w-[200px]")}>
              <option value="all">All Hotels</option>
              <option value="The Horizon Resort">The Horizon Resort</option>
              <option value="Blue Lagoon Boutique">Blue Lagoon Boutique</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cx(selectCls, "w-[140px]")}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="disabled">Disabled</option>
            </select>
            {(search || roleFilter !== "all" || hotelFilter !== "all" || statusFilter !== "all") && (
              <button className={btnGhost} onClick={() => { setSearch(""); setRoleFilter("all"); setHotelFilter("all"); setStatusFilter("all"); }}>
                <X size={13} /> Clear
              </button>
            )}
            <p className="ml-auto text-[12px] text-[#94a3b8]">{filtered.length} member{filtered.length !== 1 ? "s" : ""}</p>
          </div>

          <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  {["Staff Member", "Role", "Assigned Hotel", "Status", "Last Login", "Invited", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className={cx("border-b border-[#f1f5f9] transition-colors", m.status === "disabled" ? "opacity-60" : "hover:bg-[#f8fafc]")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cx("w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0",
                          m.status === "active" ? "bg-[#2563eb] text-white" : m.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-[#f1f5f9] text-[#94a3b8]")}>
                          {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0f172a] leading-tight">{m.name}</p>
                          <p className="text-[11.5px] text-[#94a3b8] leading-tight">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge label={m.role} variant={roleBadgeVariant(m.role)} /></td>
                    <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">{m.hotel}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={cx("w-1.5 h-1.5 rounded-full shrink-0",
                          m.status === "active" ? "bg-emerald-500" : m.status === "pending" ? "bg-amber-400" : "bg-[#cbd5e1]")} />
                        <Badge label={m.status === "active" ? "Active" : m.status === "pending" ? "Pending" : "Disabled"} variant={statusVariant(m.status)} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">{m.lastLogin}</td>
                    <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap">{m.invited}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className={cx(btnGhost, "text-[#2563eb]")} title="Edit" onClick={() => setEditOpen(m)}><Edit2 size={13} /></button>
                        <button className={btnGhost} title="View Permissions" onClick={() => { setViewPermRole(m.role); setTab("permissions"); }}><Shield size={13} /></button>
                        <button className={btnGhost} title="Reset Password" onClick={() => setConfirmAction({ type: "reset", member: m })}><RotateCcw size={13} /></button>
                        {m.status !== "disabled"
                          ? <button className={cx(btnGhost, "text-red-400")} title="Deactivate" onClick={() => setConfirmAction({ type: "deactivate", member: m })}><Ban size={13} /></button>
                          : <button className={cx(btnGhost, "text-emerald-600")} title="Re-activate" onClick={() => setConfirmAction({ type: "activate", member: m })}><Check size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-[13px] text-[#94a3b8]">No staff members match your current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {pending > 0 && (
            <div className="mt-4 flex items-center gap-3 p-3.5 rounded-[10px] bg-amber-50 border border-amber-200">
              <Clock size={15} className="text-amber-500 shrink-0" />
              <p className="text-[12.5px] text-amber-800 font-medium">
                {pending} invitation{pending > 1 ? "s" : ""} pending acceptance. Invitations expire after 7 days.
              </p>
              <button className={cx(btnGhost, "ml-auto text-amber-700 hover:bg-amber-100 shrink-0")}>Resend All</button>
            </div>
          )}
        </>
      )}

      {tab === "permissions" && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <p className="text-[13px] font-medium text-[#334155]">Highlight role:</p>
            <div className="flex gap-2">
              {["Hotel Owner", "Hotel Manager", "Reservation Officer"].map((r) => (
                <button key={r} onClick={() => setViewPermRole(viewPermRole === r ? null : r)}
                  className={cx("px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium border transition-colors",
                    viewPermRole === r ? "bg-[#2563eb] text-white border-[#2563eb]" : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#2563eb]/40 hover:text-[#2563eb]")}>
                  {r}
                </button>
              ))}
            </div>
            {viewPermRole && <button className={cx(btnGhost, "ml-auto")} onClick={() => setViewPermRole(null)}><X size={13} /> Clear</button>}
          </div>

          <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden mb-5">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="px-5 py-3 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide w-[200px]">Module / Feature</th>
                  {["Hotel Owner", "Hotel Manager", "Reservation Officer"].map((role) => (
                    <th key={role} className={cx("px-4 py-3 text-center text-[10.5px] font-semibold uppercase tracking-wide transition-colors",
                      viewPermRole === role ? "text-[#2563eb] bg-[#eff6ff]" : "text-[#94a3b8]")}>
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERM_MODULES.map((module, i) => (
                  <tr key={module} className={cx("border-b border-[#f1f5f9] transition-colors", i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]")}>
                    <td className="px-5 py-3 font-medium text-[#0f172a]">{module}</td>
                    {["Hotel Owner", "Hotel Manager", "Reservation Officer"].map((role) => (
                      <td key={role} className={cx("px-4 py-3 text-center transition-colors", viewPermRole === role ? "bg-[#eff6ff]/60" : "")}>
                        <PermCell level={ROLE_PERMISSIONS[role][i]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-5 px-5 py-3 bg-white rounded-[10px] border border-[#e2e8f0]">
            <p className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wide mr-2">Legend</p>
            {[
              { level: "Full", desc: "Full Access — create, edit, delete, manage" },
              { level: "Edit", desc: "Limited Edit — view + create + edit only" },
              { level: "View", desc: "View Only — read-only access" },
              { level: "None", desc: "No Access — feature hidden" },
            ].map(({ level, desc }) => (
              <div key={level} className="flex items-center gap-2">
                <PermCell level={level} />
                <span className="text-[11.5px] text-[#64748b]">{desc}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 mt-5">
            {["Hotel Owner", "Hotel Manager", "Reservation Officer"].map((role) => {
              const perms = ROLE_PERMISSIONS[role];
              const full  = perms.filter((p) => p === "Full").length;
              const edit  = perms.filter((p) => p === "Edit").length;
              const view  = perms.filter((p) => p === "View").length;
              const none  = perms.filter((p) => p === "None").length;
              const memberCount = STAFF_MEMBERS.filter((m) => m.role === role && m.status === "active").length;
              return (
                <div key={role} className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[13.5px] font-bold text-[#0f172a]">{role}</p>
                      <p className="text-[11.5px] text-[#94a3b8] mt-0.5">{memberCount} active member{memberCount !== 1 ? "s" : ""}</p>
                    </div>
                    <Badge label={roleBadgeVariant(role) === "purple" ? "Owner" : roleBadgeVariant(role) === "blue" ? "Manager" : "Officer"} variant={roleBadgeVariant(role)} />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "Full Access",  count: full, color: "text-[#2563eb]" },
                      { label: "Limited Edit", count: edit, color: "text-[#7c3aed]" },
                      { label: "View Only",    count: view, color: "text-[#64748b]" },
                      { label: "No Access",    count: none, color: "text-[#cbd5e1]" },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="flex items-center gap-1.5 p-2 rounded-[7px] bg-[#f8fafc]">
                        <span className={cx("text-[14px] font-bold", color)}>{count}</span>
                        <span className="text-[11px] text-[#94a3b8]">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-[#64748b]">Permission and access change history for all staff accounts.</p>
            <button className={btnSecondary}><Download size={14} /> Export Log</button>
          </div>
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  {["Log ID", "Action", "Affected Account", "Details", "Performed By", "Date & Time"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10.5px] font-semibold text-[#94a3b8] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AUDIT_LOG.map((log) => {
                  const actionColor: Record<string, string> = {
                    "Role updated":        "bg-blue-50 text-blue-600",
                    "Staff invited":       "bg-emerald-50 text-emerald-600",
                    "Account disabled":    "bg-red-50 text-red-500",
                    "Password reset sent": "bg-amber-50 text-amber-600",
                    "Staff added":         "bg-emerald-50 text-emerald-600",
                  };
                  const actionIcon: Record<string, React.ElementType> = {
                    "Role updated": Edit2, "Staff invited": UserPlus, "Account disabled": Ban,
                    "Password reset sent": RotateCcw, "Staff added": UserPlus,
                  };
                  const Icon = actionIcon[log.action] ?? Activity;
                  const targetMember = STAFF_MEMBERS.find((m) => m.id === log.target);
                  const byMember     = STAFF_MEMBERS.find((m) => m.id === log.by);
                  return (
                    <tr key={log.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-[#94a3b8]">{log.id}</td>
                      <td className="px-4 py-3.5">
                        <div className={cx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold", actionColor[log.action] ?? "bg-[#f1f5f9] text-[#64748b]")}>
                          <Icon size={11} />{log.action}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {targetMember ? <div><p className="font-medium text-[#0f172a]">{targetMember.name}</p><p className="text-[11px] text-[#94a3b8]">{targetMember.id}</p></div>
                          : <span className="text-[#94a3b8]">{log.target}</span>}
                      </td>
                      <td className="px-4 py-3.5 text-[#64748b] max-w-[240px]"><p className="leading-snug">{log.detail}</p></td>
                      <td className="px-4 py-3.5">
                        {byMember ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#2563eb] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {byMember.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="font-medium text-[#334155]">{byMember.name}</span>
                          </div>
                        ) : <span className="text-[#94a3b8]">System</span>}
                      </td>
                      <td className="px-4 py-3.5 text-[#64748b] whitespace-nowrap">{log.time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm" onClick={() => setInviteOpen(false)}>
          <div className="bg-white rounded-[14px] w-[480px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div>
                <p className="text-[15px] font-bold text-[#0f172a]">Invite Staff Member</p>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">An invitation link will be sent by email.</p>
              </div>
              <button onClick={() => setInviteOpen(false)} className={cx(btnGhost, "p-1.5")}><X size={15} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-[#334155]">First Name</label>
                  <input className={inputCls} placeholder="e.g. Somchai" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-[#334155]">Last Name</label>
                  <input className={inputCls} placeholder="e.g. Srisuk" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Work Email</label>
                <input className={inputCls} type="email" placeholder="colleague@yourhotel.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Role</label>
                <select className={selectCls}>
                  <option value="">Select a role...</option>
                  <option>Hotel Manager</option>
                  <option>Reservation Officer</option>
                </select>
                <p className="text-[11px] text-[#94a3b8]">Hotel Owner can only be assigned by mTrip administrators.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Assign to Hotel</label>
                <select className={selectCls}>
                  <option>The Horizon Resort</option>
                  <option>Blue Lagoon Boutique</option>
                  <option>Cityview Business Hotel</option>
                </select>
              </div>
              <div className="p-3 bg-[#eff6ff] rounded-[8px] border border-blue-100 flex gap-2">
                <Info size={14} className="text-[#2563eb] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#1d4ed8] leading-relaxed">
                  The invited staff member will receive an email with a secure link to set up their password. The link expires in 7 days.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#e2e8f0]">
              <button className={btnSecondary} onClick={() => setInviteOpen(false)}>Cancel</button>
              <button className={btnPrimary} onClick={() => setInviteOpen(false)}><ArrowRight size={14} /> Send Invitation</button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm" onClick={() => setEditOpen(null)}>
          <div className="bg-white rounded-[14px] w-[420px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <p className="text-[15px] font-bold text-[#0f172a]">Edit Staff Member</p>
              <button onClick={() => setEditOpen(null)} className={cx(btnGhost, "p-1.5")}><X size={15} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-[10px] border border-[#f1f5f9]">
                <div className="w-10 h-10 rounded-full bg-[#2563eb] flex items-center justify-center text-white font-bold text-[13px]">
                  {editOpen.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-[#0f172a]">{editOpen.name}</p>
                  <p className="text-[12px] text-[#94a3b8]">{editOpen.email}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Role</label>
                <select className={selectCls} defaultValue={editOpen.role}>
                  <option>Hotel Manager</option>
                  <option>Reservation Officer</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[#334155]">Assigned Hotel</label>
                <select className={selectCls} defaultValue={editOpen.hotel}>
                  <option>The Horizon Resort</option>
                  <option>Blue Lagoon Boutique</option>
                  <option>Cityview Business Hotel</option>
                </select>
              </div>
              <div className="p-3 bg-amber-50 rounded-[8px] border border-amber-100 flex gap-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800">Role changes take effect immediately and are recorded in the audit log.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#e2e8f0]">
              <button className={btnSecondary} onClick={() => setEditOpen(null)}>Cancel</button>
              <button className={btnPrimary} onClick={() => setEditOpen(null)}><Check size={14} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-[14px] w-[400px] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className={cx("w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4",
              confirmAction.type === "deactivate" ? "bg-red-50" : confirmAction.type === "reset" ? "bg-amber-50" : "bg-emerald-50")}>
              {confirmAction.type === "deactivate" && <Ban size={22} className="text-red-500" />}
              {confirmAction.type === "reset"      && <RotateCcw size={22} className="text-amber-500" />}
              {confirmAction.type === "activate"   && <CheckCircle2 size={22} className="text-emerald-500" />}
            </div>
            <p className="text-[15px] font-bold text-[#0f172a] text-center mb-1">
              {confirmAction.type === "deactivate" ? "Deactivate Account" : confirmAction.type === "reset" ? "Send Password Reset" : "Reactivate Account"}
            </p>
            <p className="text-[13px] text-[#64748b] text-center mb-5">
              {confirmAction.type === "deactivate" ? `${confirmAction.member.name} will immediately lose access to the portal.`
                : confirmAction.type === "reset" ? `A password reset link will be sent to ${confirmAction.member.email}.`
                : `${confirmAction.member.name} will regain portal access with their existing role.`}
            </p>
            <div className="flex gap-3">
              <button className={cx(btnSecondary, "flex-1 justify-center")} onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className={cx("flex-1 justify-center inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-colors",
                confirmAction.type === "deactivate" ? "bg-red-600 hover:bg-red-700 text-white"
                  : confirmAction.type === "reset" ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white")}
                onClick={() => setConfirmAction(null)}>
                <Check size={14} /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

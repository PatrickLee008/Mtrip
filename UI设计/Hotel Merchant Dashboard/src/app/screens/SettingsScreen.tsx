import { useState } from "react";
import React from "react";
import {
  User, Bell, Shield, SlidersHorizontal, LogOut, Upload, Eye,
  CheckCircle2, AlertTriangle, Activity, Globe, Mail, Phone, Check, X, Ban,
} from "lucide-react";
import {
  cx, inputCls, selectCls, btnPrimary, btnSecondary, btnGhost,
  Toggle, type BadgeVariant,
} from "../shared";
import { Badge } from "../shared";

type SettingsTab = "profile" | "notifications" | "security" | "preferences";

const TRUSTED_DEVICES = [
  { id: "d1", name: "MacBook Pro — Chrome",        location: "Bangkok, Thailand",  last: "Today, 11:22",         current: true  },
  { id: "d2", name: "iPhone 15 Pro — Safari",      location: "Bangkok, Thailand",  last: "Yesterday, 18:40",     current: false },
  { id: "d3", name: "iPad Air — Chrome",            location: "Chiang Mai, Thailand",last: "12 Jul 2026, 09:05",  current: false },
];

const ACTIVE_SESSIONS = [
  { id: "s1", device: "MacBook Pro — Chrome 126",   ip: "203.144.12.88",  location: "Bangkok, Thailand",    started: "Today, 09:14",      current: true  },
  { id: "s2", device: "mTrip iOS App v4.2",          ip: "203.144.12.89",  location: "Bangkok, Thailand",    started: "Yesterday, 18:40",  current: false },
];

function SettingsSectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-5">
      <p className="text-[14px] font-bold text-[#0f172a]">{title}</p>
      {desc && <p className="text-[12.5px] text-[#64748b] mt-0.5">{desc}</p>}
    </div>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-6 mb-5" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
      {children}
    </div>
  );
}

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6 py-4 border-b border-[#f1f5f9] last:border-0">
      <div className="w-[200px] shrink-0 pt-0.5">
        <p className="text-[13px] font-semibold text-[#334155]">{label}</p>
        {hint && <p className="text-[11.5px] text-[#94a3b8] mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SettingsToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[#f1f5f9] last:border-0">
      <div>
        <p className="text-[13px] font-medium text-[#334155]">{label}</p>
        {hint && <p className="text-[11.5px] text-[#94a3b8] mt-0.5">{hint}</p>}
      </div>
      <Toggle on={on} onChange={() => onChange(!on)} />
    </div>
  );
}

export function SettingsScreen() {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [saved, setSaved] = useState(false);

  // Profile state
  const [bizName, setBizName] = useState("The Riverside Boutique Hotel");
  const [bizType, setBizType] = useState("Boutique Hotel");
  const [regNo, setRegNo] = useState("0105562012345");
  const [vatNo, setVatNo] = useState("0105562012345");
  const [website, setWebsite] = useState("https://www.riverside-bkk.com");
  const [contactName, setContactName] = useState("Khun Somchai Jaidee");
  const [contactEmail, setContactEmail] = useState("somchai@riverside-bkk.com");
  const [contactPhone, setContactPhone] = useState("+66 81 234 5678");
  const [supportEmail, setSupportEmail] = useState("reservations@riverside-bkk.com");
  const [address, setAddress] = useState("123 Charoen Krung Road, Bang Rak");
  const [city, setCity] = useState("Bangkok");
  const [country, setCountry] = useState("Thailand");

  // Notification state
  const [emailNewBooking, setEmailNewBooking] = useState(true);
  const [emailCancellation, setEmailCancellation] = useState(true);
  const [emailModification, setEmailModification] = useState(true);
  const [emailSettlement, setEmailSettlement] = useState(true);
  const [emailPromotion, setEmailPromotion] = useState(false);
  const [emailReview, setEmailReview] = useState(true);
  const [emailSupport, setEmailSupport] = useState(true);
  const [smsNewBooking, setSmsNewBooking] = useState(true);
  const [smsCancellation, setSmsCancellation] = useState(false);
  const [pushAll, setPushAll] = useState(true);
  const [pushBooking, setPushBooking] = useState(true);
  const [pushReview, setPushReview] = useState(false);

  // Security state
  const [twoFAEnabled, setTwoFAEnabled] = useState(true);
  const [twoFAMethod, setTwoFAMethod] = useState<"app" | "sms">("app");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Preferences state
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Asia/Bangkok");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [currency, setCurrency] = useState("THB");

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "profile",       label: "Merchant Profile",  icon: User     },
    { id: "notifications", label: "Notifications",     icon: Bell     },
    { id: "security",      label: "Security",          icon: Shield   },
    { id: "preferences",   label: "Preferences",       icon: SlidersHorizontal },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-[#0f172a]" style={{ letterSpacing: "-0.025em" }}>
          Account Settings
        </h1>
        <p className="text-[13px] text-[#64748b] mt-0.5">
          Manage your business profile, notifications, security and preferences.
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left nav */}
        <nav className="w-[200px] shrink-0 bg-white rounded-[12px] border border-[#e2e8f0] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
          <div className="p-3">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cx(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-colors text-left",
                  tab === id
                    ? "bg-[#eff6ff] text-[#2563eb] font-semibold"
                    : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a]"
                )}
              >
                <Icon size={15} className={tab === id ? "text-[#2563eb]" : "text-[#94a3b8]"} />
                {label}
              </button>
            ))}
          </div>
          <div className="border-t border-[#f1f5f9] p-3">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors text-left">
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">

          {/* ── Merchant Profile ── */}
          {tab === "profile" && (
            <div>
              {/* Business Information */}
              <SettingsCard>
                <SettingsSectionHeader title="Business Information" desc="Legal details of your registered hotel business." />
                <SettingsRow label="Business Name" hint="As registered with the Department of Business Development.">
                  <input value={bizName} onChange={(e) => setBizName(e.target.value)} className={inputCls} />
                </SettingsRow>
                <SettingsRow label="Property Type">
                  <select value={bizType} onChange={(e) => setBizType(e.target.value)} className={selectCls}>
                    {["Boutique Hotel","Resort","Serviced Apartment","Hostel","Guesthouse","Villa","Other"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </SettingsRow>
                <SettingsRow label="Registration Number" hint="Thai DBD company registration number.">
                  <input value={regNo} onChange={(e) => setRegNo(e.target.value)} className={inputCls} placeholder="e.g. 0105562012345" />
                </SettingsRow>
                <SettingsRow label="VAT / Tax ID" hint="For settlement tax document issuance.">
                  <input value={vatNo} onChange={(e) => setVatNo(e.target.value)} className={inputCls} placeholder="e.g. 0105562012345" />
                </SettingsRow>
                <SettingsRow label="Website">
                  <div className="relative">
                    <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                    <input value={website} onChange={(e) => setWebsite(e.target.value)} className={cx(inputCls, "pl-8")} placeholder="https://www.yourhotel.com" />
                  </div>
                </SettingsRow>
              </SettingsCard>

              {/* Contact Information */}
              <SettingsCard>
                <SettingsSectionHeader title="Contact Information" desc="Primary contacts for your merchant account and guest communications." />
                <SettingsRow label="Account Owner Name" hint="Full name of the primary account holder.">
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
                </SettingsRow>
                <SettingsRow label="Account Email" hint="Used for login and official correspondence.">
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                    <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={cx(inputCls, "pl-8")} type="email" />
                  </div>
                </SettingsRow>
                <SettingsRow label="Mobile Number" hint="For SMS alerts and 2FA verification.">
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                    <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={cx(inputCls, "pl-8")} />
                  </div>
                </SettingsRow>
                <SettingsRow label="Reservations Email" hint="Guests and mTrip will contact this address for booking queries.">
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                    <input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className={cx(inputCls, "pl-8")} type="email" />
                  </div>
                </SettingsRow>
                <SettingsRow label="Property Address">
                  <div className="space-y-2">
                    <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Street address" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="City" />
                      <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="Country" />
                    </div>
                  </div>
                </SettingsRow>
              </SettingsCard>

              {/* Logo */}
              <SettingsCard>
                <SettingsSectionHeader title="Property Logo" desc="Displayed on your listing page and booking confirmation emails. Min 200×200px, PNG or JPG." />
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-[12px] bg-gradient-to-br from-[#2563eb] to-[#7c3aed] flex items-center justify-center text-white text-[22px] font-bold shrink-0">
                    RB
                  </div>
                  <div>
                    <div className="flex gap-2 mb-2">
                      <button className={btnSecondary}><Upload size={13} /> Upload New Logo</button>
                      <button className={cx(btnGhost, "text-red-400 hover:bg-red-50")}>Remove</button>
                    </div>
                    <p className="text-[11.5px] text-[#94a3b8]">PNG, JPG up to 5 MB · Recommended 400×400px or larger</p>
                  </div>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === "notifications" && (
            <div>
              <SettingsCard>
                <SettingsSectionHeader title="Email Notifications" desc="Receive booking and operational alerts to your account email address." />
                <SettingsToggleRow label="New Booking Received"      hint="Immediate alert when a new booking is confirmed."           on={emailNewBooking}   onChange={setEmailNewBooking} />
                <SettingsToggleRow label="Booking Cancellation"      hint="Alert when a guest or mTrip cancels a reservation."         on={emailCancellation} onChange={setEmailCancellation} />
                <SettingsToggleRow label="Booking Modification"      hint="Alert when a confirmed booking is modified."                on={emailModification} onChange={setEmailModification} />
                <SettingsToggleRow label="Settlement & Payout Report" hint="Monthly settlement summary and payout notifications."       on={emailSettlement}   onChange={setEmailSettlement} />
                <SettingsToggleRow label="New Guest Review"          hint="Alert when a guest submits a review for your property."     on={emailReview}       onChange={setEmailReview} />
                <SettingsToggleRow label="Support Ticket Updates"    hint="Email updates when your support ticket status changes."     on={emailSupport}      onChange={setEmailSupport} />
                <SettingsToggleRow label="Promotions & Platform News" hint="Optional: mTrip promotions, programme updates and tips."   on={emailPromotion}    onChange={setEmailPromotion} />
              </SettingsCard>

              <SettingsCard>
                <SettingsSectionHeader title="SMS Notifications" desc={`Sent to ${contactPhone}. SMS charges may apply depending on your mobile plan.`} />
                <SettingsToggleRow label="New Booking (SMS)"    hint="SMS alert for each new confirmed booking."             on={smsNewBooking}   onChange={setSmsNewBooking} />
                <SettingsToggleRow label="Cancellation (SMS)"   hint="SMS alert when a booking is cancelled."               on={smsCancellation} onChange={setSmsCancellation} />
                {/* Mandatory system notification — not merchant-controlled */}
                <div className="flex items-start justify-between py-3.5 border-b border-[#f1f5f9] last:border-0 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0f172a]">Critical Operational Alerts</p>
                    <p className="text-[12px] text-[#64748b] mt-0.5 leading-relaxed">
                      Always enabled to notify merchants of critical operational events, including same-day arrivals, overbookings, payment failures, PMS synchronization issues, security alerts, and system outages.
                    </p>
                    <p className="text-[11px] text-[#94a3b8] mt-1.5 italic">
                      These notifications are mandatory and cannot be disabled to ensure reliable hotel operations.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border border-[#cbd5e1] rounded-[7px] bg-[#f8fafc] text-[#475569] select-none" title="System-enforced — cannot be disabled">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span className="text-[11.5px] font-semibold whitespace-nowrap">Always Enabled</span>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard>
                <SettingsSectionHeader title="Push Notifications" desc="In-app and browser push notifications via the mTrip Merchant app." />
                <SettingsToggleRow label="Enable All Push Notifications"  hint="Master toggle — disabling this turns off all push alerts." on={pushAll}     onChange={setPushAll} />
                <SettingsToggleRow label="Booking Updates"                hint="New bookings, modifications and cancellations."           on={pushBooking} onChange={() => { if (pushAll) setPushBooking(!pushBooking); }} />
                <SettingsToggleRow label="New Guest Reviews"              hint="When a guest posts a review."                            on={pushReview}  onChange={() => { if (pushAll) setPushReview(!pushReview); }} />
              </SettingsCard>
            </div>
          )}

          {/* ── Security ── */}
          {tab === "security" && (
            <div>
              {/* 2FA */}
              <SettingsCard>
                <SettingsSectionHeader title="Two-Factor Authentication" desc="Add a second layer of security to your account login." />
                <div className={cx("flex items-start justify-between gap-4 p-4 rounded-[10px] mb-4", twoFAEnabled ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200")}>
                  <div className="flex items-center gap-3">
                    {twoFAEnabled
                      ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      : <AlertTriangle size={18} className="text-amber-500 shrink-0" />}
                    <div>
                      <p className={cx("text-[13px] font-semibold", twoFAEnabled ? "text-emerald-800" : "text-amber-800")}>
                        {twoFAEnabled ? "Two-factor authentication is enabled" : "Two-factor authentication is disabled"}
                      </p>
                      <p className={cx("text-[12px] mt-0.5", twoFAEnabled ? "text-emerald-700" : "text-amber-700")}>
                        {twoFAEnabled ? "Your account is protected with 2FA." : "We strongly recommend enabling 2FA to protect your account."}
                      </p>
                    </div>
                  </div>
                  <Toggle on={twoFAEnabled} onChange={() => setTwoFAEnabled(!twoFAEnabled)} />
                </div>
                {twoFAEnabled && (
                  <div>
                    <p className="text-[12.5px] font-semibold text-[#334155] mb-2.5">Verification Method</p>
                    <div className="flex gap-3">
                      {([
                        { value: "app",  label: "Authenticator App", desc: "Google Authenticator, Authy, etc." },
                        { value: "sms",  label: "SMS to Mobile",     desc: `Code sent to ${contactPhone}` },
                      ] as const).map((m) => (
                        <button key={m.value} onClick={() => setTwoFAMethod(m.value)}
                          className={cx("flex-1 text-left p-3.5 rounded-[10px] border transition-colors",
                            twoFAMethod === m.value ? "border-[#2563eb] bg-[#eff6ff]" : "border-[#e2e8f0] hover:bg-[#f8fafc]")}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={cx("w-4 h-4 rounded-full border-2 flex items-center justify-center",
                              twoFAMethod === m.value ? "border-[#2563eb]" : "border-[#cbd5e1]")}>
                              {twoFAMethod === m.value && <div className="w-2 h-2 rounded-full bg-[#2563eb]" />}
                            </div>
                            <p className="text-[13px] font-semibold text-[#0f172a]">{m.label}</p>
                          </div>
                          <p className="text-[11.5px] text-[#64748b] pl-6">{m.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </SettingsCard>

              {/* Trusted Devices */}
              <SettingsCard>
                <SettingsSectionHeader title="Trusted Devices" desc="Devices that have been verified and are allowed to skip 2FA." />
                <div className="space-y-2">
                  {TRUSTED_DEVICES.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-3 border-b border-[#f1f5f9] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[8px] bg-[#f1f5f9] flex items-center justify-center">
                          <User size={15} className="text-[#64748b]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold text-[#0f172a]">{d.name}</p>
                            {d.current && <Badge label="Current" variant="green" />}
                          </div>
                          <p className="text-[11.5px] text-[#94a3b8]">{d.location} · Last active {d.last}</p>
                        </div>
                      </div>
                      {!d.current && (
                        <button className={cx(btnGhost, "text-red-400 hover:text-red-600 hover:bg-red-50 text-[12px]")}>
                          <X size={12} /> Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </SettingsCard>

              {/* Active Sessions */}
              <SettingsCard>
                <SettingsSectionHeader title="Active Sessions" desc="All currently signed-in sessions on your account. Revoke any you don't recognise." />
                <div className="space-y-2">
                  {ACTIVE_SESSIONS.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-3 border-b border-[#f1f5f9] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[8px] bg-[#f1f5f9] flex items-center justify-center">
                          <Activity size={15} className="text-[#64748b]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold text-[#0f172a]">{s.device}</p>
                            {s.current && <Badge label="This session" variant="blue" />}
                          </div>
                          <p className="text-[11.5px] text-[#94a3b8]">{s.ip} · {s.location} · Started {s.started}</p>
                        </div>
                      </div>
                      {!s.current && (
                        <button className={cx(btnGhost, "text-red-400 hover:text-red-600 hover:bg-red-50 text-[12px]")}>
                          <Ban size={12} /> Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                  <button className={cx(btnSecondary, "text-red-500 border-red-200 hover:bg-red-50")}>
                    <LogOut size={13} /> Sign Out All Other Sessions
                  </button>
                </div>
              </SettingsCard>

              {/* Change Password */}
              <SettingsCard>
                <SettingsSectionHeader title="Change Password" desc="Use a strong password of at least 12 characters with a mix of letters, numbers and symbols." />
                <div className="max-w-[420px] space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-[#334155]">Current Password</label>
                    <div className="relative">
                      <input type={showCurrentPw ? "text" : "password"} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={cx(inputCls, "pr-10")} placeholder="Enter current password" />
                      <button onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-[#334155]">New Password</label>
                    <div className="relative">
                      <input type={showNewPw ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} className={cx(inputCls, "pr-10")} placeholder="Minimum 12 characters" />
                      <button onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                        <Eye size={14} />
                      </button>
                    </div>
                    {newPw && (
                      <div className="flex gap-1 mt-1">
                        {[newPw.length >= 12, /[A-Z]/.test(newPw), /[0-9]/.test(newPw), /[^A-Za-z0-9]/.test(newPw)].map((ok, i) => (
                          <div key={i} className={cx("h-1 flex-1 rounded-full", ok ? "bg-emerald-400" : "bg-[#e2e8f0]")} />
                        ))}
                      </div>
                    )}
                    {newPw && <p className="text-[11px] text-[#94a3b8]">Password strength: {newPw.length < 8 ? "Weak" : newPw.length < 12 ? "Fair" : /[^A-Za-z0-9]/.test(newPw) ? "Strong" : "Good"}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-[#334155]">Confirm New Password</label>
                    <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={cx(inputCls, confirmPw && confirmPw !== newPw ? "border-red-300 focus:ring-red-200" : "")} placeholder="Re-enter new password" />
                    {confirmPw && confirmPw !== newPw && <p className="text-[11.5px] text-red-500">Passwords do not match.</p>}
                  </div>
                  <div className="pt-1">
                    <button className={btnPrimary} disabled={!currentPw || !newPw || newPw !== confirmPw}>
                      <Shield size={13} /> Update Password
                    </button>
                  </div>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* ── Preferences ── */}
          {tab === "preferences" && (
            <div>
              <SettingsCard>
                <SettingsSectionHeader title="Language & Region" desc="These settings apply to dates, numbers and text displayed throughout the portal." />
                <SettingsRow label="Interface Language" hint="Language used across all portal menus and labels.">
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectCls}>
                    <option value="en">English (UK)</option>
                    <option value="en-us">English (US)</option>
                    <option value="th">ภาษาไทย (Thai)</option>
                    <option value="zh">中文 (Chinese Simplified)</option>
                    <option value="ja">日本語 (Japanese)</option>
                    <option value="ko">한국어 (Korean)</option>
                  </select>
                </SettingsRow>
                <SettingsRow label="Time Zone" hint="All dates and times in the portal will display in this zone.">
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectCls}>
                    <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                    <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                    <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                    <option value="Europe/London">Europe/London (UTC+1)</option>
                    <option value="America/New_York">America/New_York (UTC-4)</option>
                  </select>
                </SettingsRow>
                <SettingsRow label="Date Format">
                  <div className="flex gap-2 flex-wrap">
                    {["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((f) => (
                      <button key={f} onClick={() => setDateFormat(f)}
                        className={cx("px-3.5 py-2 rounded-[8px] border text-[12.5px] font-medium transition-colors",
                          dateFormat === f ? "border-[#2563eb] bg-[#eff6ff] text-[#2563eb]" : "border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]")}>
                        {f}
                      </button>
                    ))}
                  </div>
                </SettingsRow>
                <SettingsRow label="Currency Display" hint="Currency shown for all pricing and settlement figures.">
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={cx(selectCls, "max-w-[200px]")}>
                    <option value="THB">THB — Thai Baht</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="SGD">SGD — Singapore Dollar</option>
                    <option value="JPY">JPY — Japanese Yen</option>
                  </select>
                </SettingsRow>
              </SettingsCard>

              <SettingsCard>
                <SettingsSectionHeader title="Portal Preferences" desc="Customise how the portal behaves for your workflow." />
                <SettingsRow label="Default Landing Screen" hint="The screen shown after you log in.">
                  <select className={cx(selectCls, "max-w-[220px]")}>
                    <option>Operational Dashboard</option>
                    <option>Booking Management</option>
                    <option>Availability &amp; Pricing</option>
                  </select>
                </SettingsRow>
                <SettingsRow label="Dashboard Refresh Rate" hint="How often the dashboard auto-refreshes live data.">
                  <select className={cx(selectCls, "max-w-[180px]")}>
                    <option>Every 5 minutes</option>
                    <option>Every 15 minutes</option>
                    <option>Every 30 minutes</option>
                    <option>Manual only</option>
                  </select>
                </SettingsRow>
              </SettingsCard>
            </div>
          )}

          {/* Save / Cancel actions */}
          <div className="flex items-center justify-between mt-2 pt-5 border-t border-[#e2e8f0]">
            <div className="flex items-center gap-2">
              {saved && (
                <div className="flex items-center gap-2 text-emerald-600 text-[13px] font-medium animate-pulse">
                  <CheckCircle2 size={15} />
                  Changes saved successfully.
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button className={btnSecondary}>Cancel</button>
              <button className={btnPrimary} onClick={handleSave}>
                <Check size={14} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

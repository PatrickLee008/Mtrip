import React from "react";

export const cx = (...cls: (string | false | null | undefined)[]) =>
  cls.filter(Boolean).join(" ");

export const inputCls =
  "w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors";
export const selectCls = cx(inputCls, "cursor-pointer appearance-none");
export const btnPrimary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#2563eb] text-white text-[13px] font-semibold hover:bg-[#1d4ed8] transition-colors";
export const btnSecondary =
  "inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] border border-[#e2e8f0] bg-white text-[#334155] text-[13px] font-medium hover:bg-[#f8fafc] transition-colors";
export const btnGhost =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors";

export type BadgeVariant = "green" | "blue" | "yellow" | "red" | "gray" | "slate" | "purple" | "orange";

export function Badge({ label, variant = "gray" }: { label: string; variant?: BadgeVariant }) {
  const map: Record<BadgeVariant, string> = {
    green:  "bg-green-50 text-green-700 border border-green-200",
    blue:   "bg-blue-50 text-blue-700 border border-blue-200",
    yellow: "bg-amber-50 text-amber-700 border border-amber-200",
    red:    "bg-red-50 text-red-700 border border-red-200",
    gray:   "bg-gray-100 text-gray-600 border border-gray-200",
    slate:  "bg-slate-100 text-slate-600 border border-slate-200",
    purple: "bg-purple-50 text-purple-700 border border-purple-200",
    orange: "bg-orange-50 text-orange-700 border border-orange-200",
  };
  return (
    <span className={cx("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", map[variant])}>
      {label}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] px-3 mb-1">
      {children}
    </p>
  );
}

export function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-[#334155]">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[#94a3b8]">{hint}</p>}
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cx(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
        on ? "bg-blue-600" : "bg-gray-200"
      )}
    >
      <span
        className={cx(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-[20px] font-bold text-[#0f172a]">{title}</h1>
        {subtitle && <p className="text-[13px] text-[#64748b] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

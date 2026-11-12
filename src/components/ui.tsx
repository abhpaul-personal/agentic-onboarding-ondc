import type { ReactNode } from "react";

export type ChipKind = "sim" | "real" | "gate" | "bad" | "warn" | "ok" | "neutral";

const CHIP_CLASSES: Record<ChipKind, string> = {
  sim: "bg-[var(--sim-soft)] text-[var(--sim)]",
  real: "bg-[var(--real-soft)] text-[var(--real)]",
  gate: "bg-[var(--gate-soft)] text-[var(--gate)]",
  bad: "bg-[var(--bad-soft)] text-[var(--bad)]",
  warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
  ok: "bg-[var(--real-soft)] text-[var(--real)]",
  neutral: "bg-[var(--line2)] text-[var(--ink2)]",
};

export function Chip({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${CHIP_CLASSES[kind]}`}
    >
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--panel)] p-4 ${className}`}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "gate" | "ghost" | "default";

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-[var(--accent)] border-[var(--accent)] text-white",
  gate: "bg-[var(--gate)] border-[var(--gate)] text-white",
  ghost: "bg-transparent border-transparent",
  default: "bg-white border-[var(--line)] text-[var(--ink)] hover:border-[var(--ink3)]",
};

export function Button({
  children,
  variant = "default",
  small,
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  small?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-block rounded-lg border font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
        small ? "px-2.5 py-1 text-[12.5px]" : "px-3.5 py-2"
      } ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Confidence({ value }: { value: number }) {
  const barColor = value < 0.6 ? "bg-[var(--bad)]" : value < 0.9 ? "bg-[var(--warn)]" : "bg-[var(--accent)]";
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="relative inline-block h-1.5 w-11 overflow-hidden rounded-sm bg-[var(--line2)]">
        <b
          className={`absolute inset-y-0 left-0 ${barColor}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </i>
      <span className="font-mono text-xs">{value.toFixed(2)}</span>
    </span>
  );
}

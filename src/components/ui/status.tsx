import { STATUS_LABELS, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";

/*
 * Severity atoms. None of these take a color — they take a Status, which a
 * resolver in lib/status.ts decided. That is rule 01 made structural: there
 * is no prop through which a raw hex could arrive.
 */

const DOT_SIZE = { sm: "size-2", md: "size-[9px]", lg: "size-3" } as const;

export function StatusDot({
  status,
  size = "md",
  label,
  className,
}: {
  status: Status;
  size?: keyof typeof DOT_SIZE;
  /** Overrides the default "Status: Healthy" announcement. */
  label?: string;
  className?: string;
}) {
  const text = label ?? `Status: ${STATUS_LABELS[status]}`;
  return (
    <span
      role="img"
      aria-label={text}
      title={text}
      className={cn("status-dot", status, DOT_SIZE[size], className)}
    />
  );
}

/** Solid fill, white text — the fill alone carries the signal. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("status-badge", status, className)}>
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}

/** Pill badge — a tint with its on-tint foreground. */
export function Badge({
  status,
  children,
  className,
}: {
  status: Status;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("badge", status, className)}>{children}</span>;
}

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import type { Status } from "@/lib/status";
import { cn } from "@/lib/utils";

const ICONS = {
  critical: XCircle,
  warning: AlertTriangle,
  healthy: CheckCircle2,
  info: Info,
  neutral: Info,
} as const;

/**
 * Left-border-accented notice (source: IncidentBanner). Surfaces what is
 * wrong — or what to know — as a first-class element rather than a tooltip.
 */
export function Notice({
  status = "info",
  title,
  children,
  className,
  role,
}: {
  status?: Status;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const Icon = ICONS[status];
  return (
    <div className={cn("notice", status === "neutral" ? "info" : status, className)} role={role}>
      <Icon aria-hidden />
      <div className="min-w-0">
        <div className="notice-title">{title}</div>
        {children ? <div className="notice-body">{children}</div> : null}
      </div>
    </div>
  );
}

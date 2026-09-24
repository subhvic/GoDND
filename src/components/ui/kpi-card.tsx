import { Sparkline } from "@/components/ui/sparkline";
import { STATUS_LABELS, statusColor, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * KPI card (source: KpiCard) — label, status chip, headline value, sparkline
 * and a comparison caption.
 *
 * Rule 06: a number never stands alone. `comparison` is required, so a card
 * cannot ship as a bare "213" — it has to say against what.
 *
 * The value takes its status color only when there is something to act on
 * (warning, critical). A healthy value stays in primary ink: green on every
 * calm number would teach the eye to ignore green.
 */
export function KpiCard({
  label,
  value,
  unit,
  status,
  comparison,
  trend,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  status: Status;
  comparison: string;
  trend?: number[];
  className?: string;
}) {
  const needsAttention = status === "critical" || status === "warning";

  return (
    <div className={cn("kpi-card", status, className)}>
      <div className="kpi-card-head">
        <span className="lbl truncate">{label}</span>
        {needsAttention ? (
          <span className={cn("kpi-chip", status)}>{STATUS_LABELS[status]}</span>
        ) : null}
      </div>
      <div className="val">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {trend ? (
        <div className="kpi-spark">
          <Sparkline data={trend} color={statusColor(status)} />
        </div>
      ) : null}
      <div className="delta">{comparison}</div>
    </div>
  );
}

import { cn } from "@/lib/utils";

/** The universal "card with a header row" (source: Panel / .panel). */
export function Panel({
  title,
  hint,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("panel", className)}>
      {title || actions ? (
        <div className="panel-head">
          <div className="panel-head-left">
            {title ? <h2 className="truncate text-[13px] font-semibold">{title}</h2> : null}
            {hint ? <span className="hint truncate">{hint}</span> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-[7px]">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

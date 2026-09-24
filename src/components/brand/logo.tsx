import { cn } from "@/lib/utils";

/**
 * GoDND brand assets, drawn to the reference's proportions: a 34px mark in
 * the nav and a 20px-tall wordmark beside it.
 *
 * NOTE — the glyph is a placeholder. The real mark is a vector in the Admin
 * Portal handoff file, which this environment could not download. Swap the
 * <path>s in LogoIcon and nothing else changes.
 */
export function LogoIcon({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect width="34" height="34" rx="8" fill="var(--brand)" />
      <path d="M9 13.5c5.2-1.9 10.6-1.9 16 0" stroke="var(--on-brand)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M25 20.5c-5.2 1.9-10.6 1.9-16 0" stroke="var(--on-brand)" strokeOpacity=".65" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <rect x="15.8" y="7.5" width="2.4" height="19" rx="1.2" fill="var(--on-brand)" />
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-[20px] font-semibold leading-none tracking-[-0.3px] text-text-primary",
        className,
      )}
    >
      GoDND
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[10px]", className)}>
      <LogoIcon size={26} />
      <LogoWordmark className="text-[17px]" />
    </span>
  );
}

import { cn } from "@/lib/utils";

/**
 * GoDND Portal wordmark.
 *
 * NOTE — the glyph inside the green disc is a placeholder. The real mark is a
 * vector in the handoff file, and this environment's network policy blocks
 * figma.com, so the asset could not be downloaded. Everything else here matches
 * the file: Outfit Bold at 20.875px, "Go" in --color-ink and "DND" in
 * --color-brand, a 1px #DBDBDB divider, then "Portal" in Roboto Medium Italic
 * 18px carrying a green gradient.
 *
 * Replace `<BrandGlyph />` with the exported SVG and nothing else changes.
 */
export function Logo({
  className,
  /** The "Portal" suffix belongs to the operator app, not the marketplace. */
  suffix = "Portal",
}: {
  className?: string;
  suffix?: "Portal" | null;
}) {
  return (
    <span className={cn("flex items-center gap-[7px]", className)}>
      <BrandGlyph />
      <span className="font-display text-[20.875px] font-bold leading-none">
        <span className="text-ink">Go</span>
        <span className="tracking-[-0.4175px] text-brand">DND</span>
      </span>
      {suffix ? (
        <span className="flex items-center border-l border-neutral-4 pl-[10px]">
          <span
            className="inline-block bg-clip-text pr-[2px] text-[18px] font-medium italic leading-[1.3] tracking-[-0.18px] text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(105.59deg, rgba(0,127,106,0.6) 22.8%, rgba(66,198,177,0.6) 65.8%, rgba(1,73,61,0.6) 110.49%)",
            }}
          >
            {suffix}
          </span>
        </span>
      ) : null}
      <span className="sr-only-focusable">{suffix ? `GoDND ${suffix}` : "GoDND"}</span>
    </span>
  );
}

function BrandGlyph() {
  return (
    <span
      aria-hidden
      className="flex size-[23.425px] shrink-0 items-center justify-center rounded-full bg-brand"
    >
      <svg viewBox="0 0 24 24" className="size-[16px]" fill="none">
        <path
          d="M4 9.2c3.4-1.1 6.9-1.1 10.3 0"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M19.4 14.8c-3.4 1.1-6.9 1.1-10.3 0"
          stroke="var(--color-brand-soft)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <rect x="11.2" y="4.6" width="1.6" height="14.8" rx="0.8" fill="#071D18" />
      </svg>
    </span>
  );
}

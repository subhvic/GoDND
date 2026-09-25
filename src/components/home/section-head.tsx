import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * A Home block's header row: title and its control on the left, the
 * "See all …" link on the right, as every block in the handoff file has it.
 *
 * A link into a module that isn't built yet (Insights) renders as quiet
 * text rather than a link that 404s — the same rule the nav follows for
 * its disabled items.
 */
export function SectionHead({
  id,
  title,
  control,
  link,
}: {
  id: string;
  title: string;
  control?: React.ReactNode;
  link?: { label: string; href?: string; unavailable?: string };
}) {
  return (
    <div className="section-head">
      <div className="section-head-left">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {control}
      </div>
      {link ? (
        link.href ? (
          <Link href={link.href} className="see-all">
            {link.label}
            <ChevronRight aria-hidden />
          </Link>
        ) : (
          <span className="see-all disabled" title={link.unavailable}>
            {link.label}
            {link.unavailable ? <span className="sr-only"> — {link.unavailable}</span> : null}
            <ChevronRight aria-hidden />
          </span>
        )
      ) : null}
    </div>
  );
}

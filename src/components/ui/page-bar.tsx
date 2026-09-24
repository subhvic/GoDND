import Link from "next/link";
import { Fragment } from "react";

/**
 * The page bar at the top of the surface card: a breadcrumb trail left, the
 * page's controls right (source: PageBar / .card-crumbs). The last crumb is
 * the page's heading.
 */
export type Crumb = { label: string; href?: string };

export function PageBar({
  crumbs,
  actions,
}: {
  crumbs: Crumb[];
  actions?: React.ReactNode;
}) {
  const current = crumbs[crumbs.length - 1];
  const trail = crumbs.slice(0, -1);

  return (
    <div className="card-crumbs">
      <nav aria-label="Breadcrumb" className="card-crumbs-left">
        {trail.map((crumb) => (
          <Fragment key={crumb.label}>
            {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
            <span className="sep" aria-hidden>
              /
            </span>
          </Fragment>
        ))}
        <h1 className="current truncate">{current.label}</h1>
      </nav>
      {actions ? <div className="card-crumbs-right">{actions}</div> : null}
    </div>
  );
}

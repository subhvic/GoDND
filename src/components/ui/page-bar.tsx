import Link from "next/link";
import { Fragment } from "react";

import { PageBarBackButton } from "@/components/ui/page-bar-back";

/**
 * The page bar at the top of the surface card: an optional back arrow and
 * breadcrumb trail on the left, the page's controls on the right (source:
 * PageBar / .card-crumbs). The last crumb is the page's heading.
 *
 * The back arrow steps up one level in the trail — the previous crumb when
 * it has an href, otherwise browser history. It hides on a page that has no
 * parent (a single crumb), so Home never renders a back button that would
 * bounce a first visit off the app.
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
  // The nearest parent with a real destination — the back button prefers
  // that over history, so a deep-linked visitor still lands somewhere
  // inside the app rather than being pushed off it.
  const parentHref = [...trail].reverse().find((crumb) => crumb.href)?.href;
  const showBack = crumbs.length > 1;

  return (
    <div className="card-crumbs">
      <nav aria-label="Breadcrumb" className="card-crumbs-left">
        {showBack ? <PageBarBackButton parentHref={parentHref} /> : null}
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

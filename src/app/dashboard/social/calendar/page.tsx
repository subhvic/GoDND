import Link from "next/link";
import { Plus } from "lucide-react";

import { CalendarView } from "@/components/social/calendar-view";
import { buttonClass } from "@/components/ui/button";
import { PageBar } from "@/components/ui/page-bar";
import { listPosts } from "@/lib/data/social";

export const metadata = { title: "Calendar" };

/**
 * Per-operator data behind a session: rendered per request, never cached
 * across them.
 */
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { posts } = await listPosts();

  return (
    <>
      <PageBar
        crumbs={[{ label: "Growth" }, { label: "Calendar" }]}
        actions={
          <Link
            href="/dashboard/social/studio"
            className={buttonClass({ variant: "primary" })}
          >
            <Plus aria-hidden />
            <span className="hidden sm:inline">New post</span>
            <span className="sm:hidden">New</span>
          </Link>
        }
      />

      <div className="surface-card">
        <div className="card-scroll">
          <CalendarView posts={posts} />
        </div>
      </div>
    </>
  );
}

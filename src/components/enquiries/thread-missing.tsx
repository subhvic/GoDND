"use client";

import Link from "next/link";
import { ChevronLeft, MessageSquareOff } from "lucide-react";

import { buttonClass } from "@/components/ui/button";

/** An enquiry id that is not in this inbox — mistyped, deleted, or another workspace's. */
export function ThreadMissing() {
  return (
    <div className="thread thread-missing">
      <div className="inbox-overview">
        <span className="inbox-empty-icon">
          <MessageSquareOff aria-hidden />
        </span>
        <h2 className="inbox-overview-title">This enquiry isn&rsquo;t in your inbox</h2>
        <p className="inbox-overview-desc">
          It may have been deleted, or the link belongs to another workspace.
          Enquiries logged in a sample workspace also disappear when the tab
          is closed.
        </p>
        <Link href="/dashboard/enquiries" className={buttonClass({ className: "mt-[16px]" })}>
          <ChevronLeft aria-hidden />
          Back to enquiries
        </Link>
      </div>
    </div>
  );
}

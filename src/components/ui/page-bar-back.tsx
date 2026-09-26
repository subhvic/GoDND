"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Back arrow beside the breadcrumb trail. The parent crumb's route is the
 * source of truth: pushing there beats history.back() because it keeps the
 * URL stable when a visitor deep-linked in (history has no earlier entry to
 * pop). History is the fallback for the rare case a trail has no earlier
 * routed crumb.
 */
export function PageBarBackButton({ parentHref }: { parentHref?: string }) {
  const router = useRouter();

  const handleClick = () => {
    if (parentHref) {
      router.push(parentHref);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    }
  };

  return (
    <button
      type="button"
      className="card-crumbs-back"
      aria-label="Go back"
      onClick={handleClick}
    >
      <ArrowLeft aria-hidden />
    </button>
  );
}

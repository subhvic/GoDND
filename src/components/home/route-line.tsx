import { ArrowRight, Repeat } from "lucide-react";

import type { Route } from "@/lib/types";

/**
 * "Guwahati → Itanagar", the handoff file's route line under a location.
 * A trip that ends where it began says so instead of "Shillong → Shillong".
 * The arrow is drawn, so the words carry the meaning for a screen reader.
 */
export function RouteLine({ route }: { route: Route }) {
  if (route.from === route.to) {
    return (
      <span className="cell-sub">
        <Repeat aria-hidden />
        Round trip from {route.from}
      </span>
    );
  }
  return (
    <span className="cell-sub">
      {route.from}
      <ArrowRight aria-hidden />
      <span className="sr-only"> to </span>
      {route.to}
    </span>
  );
}

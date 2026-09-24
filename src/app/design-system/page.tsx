import type { Metadata } from "next";

import { DesignSystemView } from "@/components/design-system/design-system-view";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "GoDND's tokens, foundations and component library, rendered live.",
};

export default function DesignSystemPage() {
  return <DesignSystemView />;
}

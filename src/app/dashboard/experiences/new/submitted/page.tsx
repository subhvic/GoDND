import type { Metadata } from "next";

import { SubmittedScreen } from "@/components/experiences/wizard/submitted-screen";

export const metadata: Metadata = {
  title: "Sent for approval",
  description: "Your experience is now under review.",
};

/**
 * The screen that closes the seven-step flow.
 *
 * Used to happen silently: on submit, we called router.push straight into
 * the Under Review tab. Seven steps of work deserved a proper acknowledgment
 * (what you sent, what happens next, when you'll hear back) — that is what
 * lives here. The screen itself is a client component because the flash
 * payload it reads is written to sessionStorage by step-media just before
 * navigation.
 */
export default function SubmittedPage() {
  return <SubmittedScreen />;
}

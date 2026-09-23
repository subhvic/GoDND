import { notFound } from "next/navigation";

import { WizardStepScreen } from "@/components/experiences/wizard/wizard-step-screen";
import { getStep, WIZARD_SLUGS } from "@/lib/experience-wizard/steps";

export const metadata = { title: "Add New Experience" };

/**
 * Each step is a real route, so the browser's back button steps backwards
 * through the wizard and any step can be linked to directly.
 */
export function generateStaticParams() {
  return WIZARD_SLUGS.map((step) => ({ step }));
}

export default async function WizardStepPage(
  props: PageProps<"/dashboard/experiences/new/[step]">,
) {
  const { step } = await props.params;
  // getStep narrows the route param to a known slug; an unknown one 404s
  // rather than rendering an empty wizard.
  const match = getStep(step);
  if (!match) notFound();

  return <WizardStepScreen slug={match.slug} />;
}

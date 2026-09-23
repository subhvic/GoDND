import type { ExperienceDraft } from "@/lib/experience-wizard/schema";

/**
 * The seven steps, in the order the handoff file's left rail shows them.
 * Slugs are URL segments, so each step is a real, linkable page — an operator
 * can bookmark "the pricing step" and come back to it.
 */
export const WIZARD_STEPS = [
  { slug: "basic-info", label: "Basic Info", title: "Basic Info", key: "basicInfo" },
  { slug: "itinerary", label: "Itinerary Builder", title: "Itinerary Builder", key: "itinerary" },
  { slug: "crew", label: "Crew & Trip Capacity", title: "Crew & Trip Capacity", key: "crew" },
  { slug: "pricing", label: "Pricing Strategy", title: "Pricing Strategy", key: "pricing" },
  { slug: "availability", label: "Availability Calendar", title: "Availability Calendar", key: "availability" },
  { slug: "policies", label: "Support & Policies", title: "Support & Policies", key: "policies" },
  { slug: "media", label: "Media & Overview", title: "Media & Overview", key: "media" },
] as const satisfies readonly {
  slug: string;
  label: string;
  title: string;
  key: keyof ExperienceDraft;
}[];

export type WizardStep = (typeof WIZARD_STEPS)[number];
export type WizardStepSlug = WizardStep["slug"];

export const WIZARD_SLUGS = WIZARD_STEPS.map((step) => step.slug);

export function getStep(slug: string): WizardStep | undefined {
  return WIZARD_STEPS.find((step) => step.slug === slug);
}

export function stepIndex(slug: string): number {
  return WIZARD_STEPS.findIndex((step) => step.slug === slug);
}

export function adjacentSteps(slug: string) {
  const index = stepIndex(slug);
  return {
    previous: index > 0 ? WIZARD_STEPS[index - 1] : null,
    next: index < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[index + 1] : null,
  };
}

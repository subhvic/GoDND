import { NewExperienceIntro } from "@/components/experiences/wizard/new-experience-intro";

export const metadata = {
  title: "New experience",
  description:
    "Set up an experience in seven steps. Each step answers one guest question.",
};

/**
 * The screen an operator lands on at /dashboard/experiences/new.
 *
 * Used to redirect directly to Basic Info, which dropped operators into a
 * form with no context. Now it frames the seven-step flow (what each step
 * is for, how long it takes) and leads with the operator's existing draft
 * when there is one — that decision needs sessionStorage, so the actual
 * screen is a client component.
 */
export default function NewExperienceIndex() {
  return <NewExperienceIntro />;
}

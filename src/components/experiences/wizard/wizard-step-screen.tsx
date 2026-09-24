"use client";

import { StepAvailability } from "@/components/experiences/wizard/step-availability";
import { StepBasicInfo } from "@/components/experiences/wizard/step-basic-info";
import { StepCrew } from "@/components/experiences/wizard/step-crew";
import { StepItinerary } from "@/components/experiences/wizard/step-itinerary";
import { StepMedia } from "@/components/experiences/wizard/step-media";
import { StepPolicies } from "@/components/experiences/wizard/step-policies";
import { StepPricing } from "@/components/experiences/wizard/step-pricing";
import { WizardPageBar, WizardRail } from "@/components/experiences/wizard/wizard-chrome";
import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import type { WizardStepSlug } from "@/lib/experience-wizard/steps";

const STEP_COMPONENTS: Record<WizardStepSlug, () => React.ReactElement> = {
  "basic-info": StepBasicInfo,
  itinerary: StepItinerary,
  crew: StepCrew,
  pricing: StepPricing,
  availability: StepAvailability,
  policies: StepPolicies,
  media: StepMedia,
};

/**
 * The wizard inside the one surface card: the step rail on the left, the
 * step on the right — the reference's "sidebar inside the card" layout.
 */
export function WizardStepScreen({ slug }: { slug: WizardStepSlug }) {
  const { hydrated } = useWizard();
  const Step = STEP_COMPONENTS[slug];

  return (
    <div className="surface-card has-rail">
      <WizardRail current={slug} />
      <div className="card-col">
        <WizardPageBar current={slug} />
        <div className="card-scroll pb-0">
          {/* Held until the saved draft has been read back, so each form's
              defaultValues are right on first render. Mounting early and
              resetting afterwards would flash every field empty. */}
          {hydrated ? <Step /> : <StepSkeleton />}
        </div>
      </div>
    </div>
  );
}

function StepSkeleton() {
  return (
    <div aria-live="polite">
      <span className="sr-only">Loading your saved draft</span>
      <div className="skeleton mb-[16px] h-[34px] w-[200px]" />
      <div className="panel grid gap-[16px] p-[18px] lg:grid-cols-2" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="skeleton h-[52px]" />
        ))}
      </div>
    </div>
  );
}

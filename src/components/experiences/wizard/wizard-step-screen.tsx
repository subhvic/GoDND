"use client";

import { StepAvailability } from "@/components/experiences/wizard/step-availability";
import { StepBasicInfo } from "@/components/experiences/wizard/step-basic-info";
import { StepCrew } from "@/components/experiences/wizard/step-crew";
import { StepItinerary } from "@/components/experiences/wizard/step-itinerary";
import { StepMedia } from "@/components/experiences/wizard/step-media";
import { StepPolicies } from "@/components/experiences/wizard/step-policies";
import { StepPricing } from "@/components/experiences/wizard/step-pricing";
import {
  WizardHeader,
  WizardProgress,
  WizardRail,
} from "@/components/experiences/wizard/wizard-chrome";
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

export function WizardStepScreen({ slug }: { slug: WizardStepSlug }) {
  const { hydrated } = useWizard();
  const Step = STEP_COMPONENTS[slug];

  return (
    <div className="flex min-h-full flex-col">
      <WizardHeader current={slug} />
      <WizardProgress current={slug} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <WizardRail current={slug} />
        {/*
          Rendering is held until the saved draft has been read back, so each
          form's defaultValues are correct on its first render. Mounting early
          and resetting afterwards would make every field flash empty and lose
          anything typed in that moment.
        */}
        {hydrated ? <Step /> : <StepSkeleton />}
      </div>
    </div>
  );
}

function StepSkeleton() {
  return (
    <div className="flex-1 px-[16px] py-[20px] lg:px-[32px]" aria-live="polite">
      <span className="sr-only-focusable">Loading your saved draft</span>
      <div className="h-[20px] w-[160px] animate-pulse bg-surface-sunken" />
      <div className="mt-[24px] grid gap-[20px] lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[64px] animate-pulse bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}

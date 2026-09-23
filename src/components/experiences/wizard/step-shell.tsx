"use client";

import { WizardFooter } from "@/components/experiences/wizard/wizard-chrome";
import { getStep, stepIndex, WIZARD_STEPS, type WizardStepSlug } from "@/lib/experience-wizard/steps";
import { cn } from "@/lib/utils";

/**
 * Common frame for every step: the "Basic Info / Step 1 of 7" heading, the
 * form, an error summary, and the footer buttons.
 *
 * `aside` renders the right-hand preview panel that steps 4, 5 and 7 have. It
 * sits after the form in source order so keyboard and screen reader users
 * reach the inputs first, and is repositioned with CSS on wide viewports.
 */
export function StepShell({
  slug,
  formId,
  onSubmit,
  errorSummary,
  children,
  aside,
  submitting,
}: {
  slug: WizardStepSlug;
  formId: string;
  onSubmit: (event: React.FormEvent) => void;
  errorSummary?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  submitting?: boolean;
}) {
  const step = getStep(slug);
  const index = stepIndex(slug);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          aside && "lg:flex-row lg:items-stretch",
        )}
      >
        <div className="flex-1 px-[16px] py-[20px] lg:px-[32px]">
          <h2 className="text-body font-medium text-neutral-1">{step?.title}</h2>
          <p className="mt-[2px] text-small font-medium text-brand">
            Step {index + 1} of {WIZARD_STEPS.length}
          </p>

          {/*
            A single live region for the whole step. Without it a failed submit
            is silent for screen reader users, because the errors appear far
            down the form and focus has not moved.
          */}
          <p
            aria-live="assertive"
            className={cn(
              "mt-[12px] text-small text-[#d92d20]",
              !errorSummary && "sr-only-focusable",
            )}
          >
            {errorSummary}
          </p>

          <form
            id={formId}
            onSubmit={onSubmit}
            noValidate
            className="mt-[20px] flex flex-col gap-[20px] pb-[96px]"
          >
            {children}
          </form>
        </div>

        {aside ? (
          <aside className="border-t border-neutral-5 bg-brand-surface px-[16px] pb-[96px] pt-[20px] lg:w-[320px] lg:shrink-0 lg:border-l lg:border-t-0 lg:px-[24px] lg:pb-[40px]">
            {aside}
          </aside>
        ) : null}
      </div>

      <WizardFooter current={slug} formId={formId} submitting={submitting} />
    </div>
  );
}

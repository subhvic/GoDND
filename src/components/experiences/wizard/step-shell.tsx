"use client";

import { WizardFooter } from "@/components/experiences/wizard/wizard-chrome";
import { getStep, stepIndex, WIZARD_STEPS, type WizardStepSlug } from "@/lib/experience-wizard/steps";

/**
 * Common frame for every step: its heading, the form, a live error summary,
 * an optional preview panel, and the pinned footer.
 *
 * The preview panel (`aside`) follows the form in source order so keyboard
 * and screen-reader users reach the inputs first; it moves beside the form on
 * wide screens.
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
    <>
      <div className="mb-[16px] flex flex-col gap-[2px]">
        <p className="m-0 text-[10.5px] font-bold uppercase tracking-[1px] text-brand">
          Step {index + 1} of {WIZARD_STEPS.length}
        </p>
        <h2 className="m-0 text-[15px] font-semibold tracking-[-0.2px] text-text-primary">
          {step?.title}
        </h2>
      </div>

      {/* One live region for the whole step: a failed submit is otherwise
          silent for screen-reader users, since errors land far down the form
          and focus has not moved. */}
      <p aria-live="assertive" className={errorSummary ? "field-error mb-[12px]" : "sr-only"}>
        {errorSummary}
      </p>

      <div className={aside ? "grid items-start gap-[16px] xl:grid-cols-[minmax(0,1fr)_320px]" : ""}>
        <form
          id={formId}
          onSubmit={onSubmit}
          noValidate
          className="panel flex min-w-0 flex-col gap-[20px] p-[18px]"
        >
          {children}
        </form>

        {aside ? (
          <aside className="panel p-[16px] xl:sticky xl:top-0">{aside}</aside>
        ) : null}
      </div>

      <div className="h-[20px] shrink-0" aria-hidden />
      <WizardFooter current={slug} formId={formId} submitting={submitting} />
    </>
  );
}

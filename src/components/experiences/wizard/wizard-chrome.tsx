"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  IndianRupee,
  Info,
  MapPin,
  Save,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { Button } from "@/components/ui/button";
import {
  adjacentSteps,
  stepIndex,
  WIZARD_STEPS,
  type WizardStepSlug,
} from "@/lib/experience-wizard/steps";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<WizardStepSlug, LucideIcon> = {
  "basic-info": Info,
  itinerary: MapPin,
  crew: Users,
  pricing: IndianRupee,
  availability: Calendar,
  policies: ShieldCheck,
  media: ImageIcon,
};

/**
 * The wizard's left rail.
 *
 * Steps ahead of the furthest one reached are disabled. The file shows no such
 * rule, but the later steps depend on earlier answers — pricing tiers are keyed
 * off max group size, the itinerary is keyed off duration — so jumping to step
 * 5 from a blank step 1 would render a form with nothing to hang on.
 * Completed steps stay freely navigable.
 */
export function WizardRail({ current }: { current: WizardStepSlug }) {
  const { completed } = useWizard();
  const currentIndex = stepIndex(current);
  const furthestComplete = WIZARD_STEPS.reduce(
    (max, step, index) => (completed[step.slug] ? index : max),
    -1,
  );
  const reachable = Math.max(currentIndex, furthestComplete + 1);

  return (
    <nav
      aria-label="Experience setup steps"
      className="shrink-0 border-b border-neutral-5 lg:w-[240px] lg:border-b-0 lg:border-r"
    >
      <ol className="flex gap-[4px] overflow-x-auto p-[12px] lg:flex-col lg:gap-[2px] lg:p-[16px]">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step.slug];
          const isCurrent = step.slug === current;
          const isDone = Boolean(completed[step.slug]);
          const isReachable = index <= reachable;

          const content = (
            <>
              <Icon aria-hidden className="size-[16px] shrink-0" />
              <span className="flex-1 truncate text-left">{step.label}</span>
              {isDone ? (
                <CheckCircle2
                  aria-hidden
                  className={cn(
                    "size-[16px] shrink-0",
                    isCurrent ? "text-accent" : "text-brand",
                  )}
                />
              ) : isCurrent ? (
                <ArrowRight aria-hidden className="size-[16px] shrink-0" />
              ) : null}
            </>
          );

          const shared =
            "flex w-full items-center gap-[10px] whitespace-nowrap px-[14px] py-[12px] text-small transition-colors lg:whitespace-normal";

          return (
            <li key={step.slug} className="shrink-0 lg:shrink">
              {isReachable ? (
                <Link
                  href={`/dashboard/experiences/new/${step.slug}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    shared,
                    isCurrent
                      ? "bg-ink font-medium text-white"
                      : "text-ink-muted hover:bg-surface-sunken",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-disabled
                  title="Finish the earlier steps first"
                  className={cn(shared, "cursor-not-allowed text-neutral-3")}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The seven progress bars above the form, filled up to the current step. */
export function WizardProgress({ current }: { current: WizardStepSlug }) {
  const currentIndex = stepIndex(current);
  const { completed } = useWizard();

  return (
    <div
      className="flex gap-[4px] px-[16px] pt-[16px] lg:px-[24px]"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={WIZARD_STEPS.length}
      aria-valuenow={currentIndex + 1}
      aria-valuetext={`Step ${currentIndex + 1} of ${WIZARD_STEPS.length}`}
    >
      {WIZARD_STEPS.map((step, index) => (
        <span
          key={step.slug}
          className={cn(
            "h-[3px] flex-1",
            index < currentIndex || completed[step.slug]
              ? "bg-brand"
              : index === currentIndex
                ? "bg-accent"
                : "bg-neutral-5",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Header bar. "Save as Draft" is present on every step, per the file; the
 * "Preview" action appears only on the final step, as drawn.
 */
export function WizardHeader({ current }: { current: WizardStepSlug }) {
  const { saving, lastSavedAt, saveError } = useWizard();
  const isFinalStep = current === "media";

  return (
    <div className="flex items-center justify-between gap-[16px] border-b border-neutral-5 px-[16px] py-[12px] lg:px-[32px]">
      <h1 className="flex items-center gap-[7px] text-h3 font-semibold text-neutral-1">
        <FileText aria-hidden className="size-[24px]" />
        Add New Experience
      </h1>

      <div className="flex items-center gap-[16px]">
        <p
          aria-live="polite"
          className={cn(
            "hidden text-small sm:block",
            saveError ? "text-[#d92d20]" : "text-neutral-2",
          )}
        >
          {saveError
            ? saveError
            : saving
              ? "Saving…"
              : lastSavedAt
                ? `Saved ${lastSavedAt.toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : ""}
        </p>
        <SaveDraftButton />
        {isFinalStep ? (
          <button
            type="button"
            className="flex items-center gap-[6px] text-small font-medium text-neutral-1 hover:text-brand"
          >
            Preview
            <ExternalLink aria-hidden className="size-[16px]" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SaveDraftButton() {
  const {
    draft,
    experienceId,
    setSaving,
    markSaved,
    markSaveFailed,
    saving,
  } = useWizard();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={saving || pending}
      onClick={() => {
        setSaving(true);
        startTransition(async () => {
          const { saveExperienceDraft } = await import(
            "@/app/dashboard/experiences/new/actions"
          );
          const result = await saveExperienceDraft(draft, experienceId);
          // A failed save must never read as a success: an operator who
          // believes their work is stored will close the tab.
          if (result.ok) markSaved(result.experienceId);
          else markSaveFailed(result.message);
        });
      }}
      className="flex items-center gap-[6px] text-small font-medium text-neutral-1 hover:text-brand disabled:opacity-60"
    >
      Save as Draft
      <Save aria-hidden className="size-[16px]" />
    </button>
  );
}

/**
 * Footer navigation. "Next Step" submits the current step's form by id, so
 * validation runs before navigation and the button can live outside the form.
 */
export function WizardFooter({
  current,
  formId,
  submitting,
}: {
  current: WizardStepSlug;
  formId: string;
  submitting?: boolean;
}) {
  const { previous, next } = adjacentSteps(current);
  const router = useRouter();

  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-[12px] border-t border-neutral-5 bg-white px-[16px] py-[14px] lg:px-[32px]">
      {previous ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(`/dashboard/experiences/new/${previous.slug}`)
          }
        >
          ← Previous Step
        </Button>
      ) : null}

      <Button type="submit" form={formId} disabled={submitting}>
        {next ? "Next Step →" : "Send for Approval →"}
      </Button>
    </div>
  );
}

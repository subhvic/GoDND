"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  IndianRupee,
  Image as ImageIcon,
  Info,
  MapPin,
  Save,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { Button, buttonClass } from "@/components/ui/button";
import { PageBar } from "@/components/ui/page-bar";
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
 * The step list, as the reference's secondary rail inside the surface card
 * (source: .svc-sidebar).
 *
 * Steps beyond the furthest one reached are disabled: later steps depend on
 * earlier answers — pricing tiers key off group size, the itinerary off the
 * duration — so jumping ahead to a blank step would render a form with
 * nothing to hang on. Completed steps stay freely navigable.
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
    <nav aria-label="Experience setup steps" className="rail hidden md:block">
      <div className="rail-label">New experience</div>
      <ol className="m-0 list-none p-0">
        {WIZARD_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step.slug];
          const isCurrent = step.slug === current;
          const isDone = Boolean(completed[step.slug]);
          const content = (
            <>
              <Icon aria-hidden />
              <span className="rail-name">{step.label}</span>
              {isDone ? (
                <CheckCircle2 aria-label="Complete" className="rail-check" />
              ) : (
                <span className="rail-count" aria-hidden>{index + 1}</span>
              )}
            </>
          );

          return (
            <li key={step.slug}>
              {index <= reachable ? (
                <Link
                  href={`/dashboard/experiences/new/${step.slug}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn("rail-item", isCurrent && "active")}
                >
                  {content}
                </Link>
              ) : (
                <span className="rail-item disabled" aria-disabled="true" title="Finish the earlier steps first">
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

/**
 * Page bar for the wizard. Save as draft is present on every step, as in the
 * handoff file, with the save state beside it so a failure is never silent.
 */
export function WizardPageBar({ current }: { current: WizardStepSlug }) {
  const { saving, lastSavedAt, saveError } = useWizard();

  return (
    <PageBar
      crumbs={[
        { label: "GoDND", href: "/dashboard" },
        { label: "Experiences", href: "/dashboard/experiences" },
        { label: "New experience" },
      ]}
      actions={
        <>
          <p
            aria-live="polite"
            className={cn(
              "m-0 hidden text-[11.5px] sm:block",
              saveError ? "text-critical-fg" : "text-text-muted",
            )}
          >
            {saveError
              ? saveError
              : saving
                ? "Saving…"
                : lastSavedAt
                  ? `Saved ${lastSavedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
                  : "Autosaved on this device"}
          </p>
          <SaveDraftButton />
          <span className="sr-only">
            Step {stepIndex(current) + 1} of {WIZARD_STEPS.length}
          </span>
        </>
      }
    />
  );
}

function SaveDraftButton() {
  const { draft, experienceId, setSaving, markSaved, markSaveFailed, saving } = useWizard();
  const [pending, startTransition] = useTransition();

  return (
    <Button
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
    >
      <Save aria-hidden />
      Save as draft
    </Button>
  );
}

/**
 * Footer navigation, pinned to the bottom of the card. "Next" submits the
 * current step's form by id, so validation runs before navigation.
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
  const index = stepIndex(current);

  return (
    <div className="sticky bottom-0 z-10 mx-[-16px] mt-auto flex items-center justify-between gap-[12px] border-t border-border-subtle bg-card px-[16px] py-[12px]">
      <span className="text-[11.5px] text-text-muted">
        Step {index + 1} of {WIZARD_STEPS.length}
      </span>
      <div className="flex items-center gap-[8px]">
        {previous ? (
          <Button onClick={() => router.push(`/dashboard/experiences/new/${previous.slug}`)}>
            <ArrowLeft aria-hidden />
            Previous
          </Button>
        ) : (
          <Link href="/dashboard/experiences" className={buttonClass()}>
            Cancel
          </Link>
        )}
        <Button type="submit" form={formId} variant="primary" disabled={submitting}>
          {next ? "Next step" : "Send for approval"}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

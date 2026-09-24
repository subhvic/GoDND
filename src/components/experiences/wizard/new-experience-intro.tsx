"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  IndianRupee,
  Image as ImageIcon,
  MapPin,
  Save,
  Shield,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { Button, buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import { WIZARD_STEPS, type WizardStepSlug } from "@/lib/experience-wizard/steps";
import { cn } from "@/lib/utils";

/*
 * The intro screen an operator lands on at /dashboard/experiences/new.
 *
 * The wizard used to open directly on Basic Info, so an operator hit the
 * first form with no framing at all. This page does two jobs before they
 * type a word:
 *
 *   1. Names what each of the seven steps is FOR — every step answers a
 *      question a guest will otherwise ask by email.
 *   2. Sets time expectations (~15 minutes end-to-end, save at any point).
 *
 * And if there's a draft in progress, it leads with that instead — so an
 * operator returning after a network drop lands in front of their own work,
 * not the empty starting screen.
 */

const STEP_META: Record<
  WizardStepSlug,
  { icon: LucideIcon; question: string; objective: string; minutes: number }
> = {
  "basic-info": {
    icon: Compass,
    question: "“What kind of trip is this?”",
    objective:
      "The one-line pitch: what, where, how many days, who it's for, what they'll eat.",
    minutes: 3,
  },
  itinerary: {
    icon: MapPin,
    question: "“What will I do each day?”",
    objective:
      "Day-by-day plan — pick-up, stops, meals. Reused verbatim in the daily guest itinerary.",
    minutes: 5,
  },
  crew: {
    icon: Users,
    question: "“Who's running it, and how many of us?”",
    objective:
      "The captain and coordinator, group size, and how open the trip is — public, invite, or request.",
    minutes: 1,
  },
  pricing: {
    icon: IndianRupee,
    question: "“What does it cost?”",
    objective:
      "One flat rate per guest, or a group total that scales with head count.",
    minutes: 2,
  },
  availability: {
    icon: Calendar,
    question: "“When can I book?”",
    objective:
      "The date windows the trip is bookable, plus any holidays that block days inside them.",
    minutes: 1,
  },
  policies: {
    icon: Shield,
    question: "“What happens if plans change?”",
    objective:
      "Inclusions, exclusions and the cancellation terms the guest agrees to at checkout.",
    minutes: 2,
  },
  media: {
    icon: ImageIcon,
    question: "“What will this look like when I browse?”",
    objective:
      "The thumbnail and 600-character summary the guest sees on the marketplace card.",
    minutes: 1,
  },
};

const TOTAL_MINUTES = Object.values(STEP_META).reduce(
  (sum, step) => sum + step.minutes,
  0,
);

export function NewExperienceIntro() {
  const wizard = useWizard();
  const router = useRouter();

  // Only trust the draft state once the store has hydrated from sessionStorage.
  // Before that, `completed` is empty and `title` is "", so we would flash a
  // "start fresh" state to an operator who actually has a draft in progress.
  const hasDraft =
    wizard.hydrated &&
    (Boolean(wizard.draft.basicInfo.title) ||
      Object.values(wizard.completed).some(Boolean));

  const firstIncomplete =
    WIZARD_STEPS.find((step) => !wizard.completed[step.slug])?.slug ??
    "basic-info";
  const doneCount = WIZARD_STEPS.filter(
    (step) => wizard.completed[step.slug],
  ).length;

  const startFresh = useCallback(() => {
    if (hasDraft) {
      // The draft belongs to the operator — destroying it silently would
      // repeat the failure the wizard's autosave was written to avoid.
      const ok = window.confirm(
        "Discard your current draft and start a new experience? Nothing will be recovered.",
      );
      if (!ok) return;
      wizard.reset();
    }
    router.push("/dashboard/experiences/new/basic-info");
  }, [hasDraft, router, wizard]);

  return (
    <main className="surface-card">
      <PageBar
        crumbs={[
          { label: "GoDND", href: "/dashboard" },
          { label: "Experiences", href: "/dashboard/experiences" },
          { label: "New experience" },
        ]}
      />
      <div className="card-scroll">
        <div className="mx-auto max-w-[820px] pb-[40px]">
          {/* Hero */}
          <p className="m-0 text-[10.5px] font-bold uppercase tracking-[1px] text-brand">
            Add a new experience
          </p>
          <h2 className="m-0 mt-[8px] max-w-[24ch] text-[22px] font-semibold leading-[1.2] tracking-[-0.3px] text-text-primary">
            Set it up in seven steps. Save at any point.
          </h2>
          <p className="m-0 mt-[10px] max-w-[64ch] text-[13px] leading-[1.6] text-text-secondary">
            Each step answers one question a guest will otherwise ask by
            email. Everything auto-saves as you type &mdash; closing the tab
            never costs work.
          </p>

          <ul className="mt-[14px] flex list-none flex-wrap items-center gap-x-[18px] gap-y-[6px] p-0 text-[11.5px] text-text-muted">
            <li className="inline-flex items-center gap-[6px]">
              <Clock aria-hidden className="size-[13px]" />
              About {TOTAL_MINUTES} minutes end to end
            </li>
            <li className="inline-flex items-center gap-[6px]">
              <Save aria-hidden className="size-[13px]" />
              Autosaved on this device
            </li>
            <li className="inline-flex items-center gap-[6px]">
              <BadgeCheck aria-hidden className="size-[13px]" />
              Reviewed before it goes on the marketplace
            </li>
          </ul>

          {/* Draft-in-progress banner: takes over the primary CTA if there
              is unfinished work, so the operator never sees a "Start" button
              that would blow away their own draft. */}
          {hasDraft ? (
            <Notice
              status="info"
              title={`Continue your draft — ${wizard.draft.basicInfo.title || "Untitled experience"}`}
              className="mt-[26px]"
            >
              You&rsquo;ve completed {doneCount} of {WIZARD_STEPS.length}{" "}
              steps. Everything stays exactly as you left it.
              <div className="mt-[10px] flex flex-wrap items-center gap-[8px]">
                <Link
                  href={`/dashboard/experiences/new/${firstIncomplete}`}
                  className={buttonClass({ variant: "primary", size: "small" })}
                >
                  Continue on{" "}
                  {
                    WIZARD_STEPS.find((step) => step.slug === firstIncomplete)
                      ?.label
                  }
                  <ArrowRight aria-hidden />
                </Link>
                <Button size="small" onClick={startFresh}>
                  Start over
                </Button>
              </div>
            </Notice>
          ) : (
            <div className="mt-[26px]">
              <Link
                href="/dashboard/experiences/new/basic-info"
                className={buttonClass({ variant: "primary" })}
              >
                <Sparkles aria-hidden />
                Start with Basic Info
                <ArrowRight aria-hidden />
              </Link>
            </div>
          )}

          {/* The seven steps, framed as questions the guest is asking. This
              is the whole point of the page — an operator who understands why
              a step exists fills it better than one who is told to fill it. */}
          <section
            aria-labelledby="what-we-cover"
            className="mt-[40px] border-t border-border-subtle pt-[28px]"
          >
            <h3
              id="what-we-cover"
              className="m-0 text-[10.5px] font-semibold uppercase tracking-[.9px] text-text-muted"
            >
              What we&rsquo;ll cover
            </h3>
            <p className="m-0 mt-[6px] text-[11.5px] text-text-muted">
              Each row is one step. The heading is the guest&rsquo;s question;
              the line beneath is what you&rsquo;ll type.
            </p>

            <ol className="m-0 mt-[16px] list-none space-y-[10px] p-0">
              {WIZARD_STEPS.map((step, index) => {
                const meta = STEP_META[step.slug];
                const Icon = meta.icon;
                const isDone = wizard.hydrated && wizard.completed[step.slug];
                return (
                  <li
                    key={step.slug}
                    className={cn(
                      "panel flex items-start gap-[14px] p-[16px]",
                      isDone && "border-brand-muted bg-brand-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-[36px] shrink-0 items-center justify-center rounded-md",
                        isDone
                          ? "bg-brand text-on-brand"
                          : "bg-panel-2 text-brand",
                      )}
                      aria-hidden
                    >
                      {isDone ? (
                        <CheckCircle2 className="size-[18px]" />
                      ) : (
                        <Icon className="size-[18px]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
                        <span className="text-[10.5px] font-semibold uppercase tracking-[.4px] text-text-muted">
                          Step {index + 1} of {WIZARD_STEPS.length}
                        </span>
                        <span className="text-[10.5px] text-text-muted">
                          &sim; {meta.minutes} min
                        </span>
                        {isDone ? (
                          <span className="badge healthy">Complete</span>
                        ) : null}
                      </div>
                      <h4 className="m-0 mt-[4px] text-[13.5px] font-semibold leading-[1.35] text-text-primary">
                        {step.label}
                      </h4>
                      <p className="m-0 mt-[6px] text-[12px] italic text-text-secondary">
                        {meta.question}
                      </p>
                      <p className="m-0 mt-[4px] text-[12.5px] leading-[1.55] text-text-secondary">
                        {meta.objective}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}

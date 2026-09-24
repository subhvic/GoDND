"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Compass,
  IndianRupee,
  Image as ImageIcon,
  MapPin,
  Pencil,
  Send,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { EditStateBanner } from "@/components/experiences/wizard/edit-state-banner";
import { SUBMISSION_FLASH_KEY } from "@/components/experiences/wizard/submitted-screen";
import { Button, buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import {
  ACCESSIBILITY_OPTIONS,
  ACTIVITY_KIND_OPTIONS,
  ACTIVITY_OPTIONS,
  ADDITIONAL_INFO_OPTIONS,
  CATEGORY_OPTIONS,
  CREW_OPTIONS,
  EXCLUSION_OPTIONS,
  INCLUSION_OPTIONS,
  LANGUAGE_OPTIONS,
  REGION_OPTIONS,
} from "@/lib/experience-wizard/options";
import {
  basicInfoSchema,
  availabilitySchema,
  crewSchema,
  itinerarySchema,
  mediaSchema,
  policiesSchema,
  pricingSchema,
} from "@/lib/experience-wizard/schema";
import { WIZARD_STEPS, type WizardStepSlug } from "@/lib/experience-wizard/steps";
import { formatDuration, formatMoney } from "@/lib/utils";

/*
 * The pre-flight review, at /dashboard/experiences/new/review.
 *
 * Landing here after step 7 (Media) is a deliberate pause: seven steps of
 * data collection is a lot to review inline, and one wrong price or missing
 * cancellation policy is worth catching here rather than after a reviewer
 * has already looked at it.
 *
 * Every section is summarised into a card, each with an "Edit" link back to
 * the step that owns it. The actual submission (the one that used to happen
 * on step 7's button) lives here — and is guarded by re-validating every
 * step against its own schema, so the submit button cannot be clicked while
 * anything is missing.
 */

const ICONS: Record<WizardStepSlug, LucideIcon> = {
  "basic-info": Compass,
  itinerary: MapPin,
  crew: Users,
  pricing: IndianRupee,
  availability: Calendar,
  policies: Shield,
  media: ImageIcon,
};

const FOOD_INCLUDED: Record<string, string> = {
  none: "No meals included",
  breakfast_dinner: "Breakfast & Dinner",
  breakfast_lunch_dinner: "Breakfast, Lunch & Dinner",
};

const FOOD_PREFERENCE: Record<string, string> = {
  veg_only: "Vegetarian only",
  non_veg_only: "Non-vegetarian only",
  both: "Both vegetarian and non-vegetarian",
};

const KIND: Record<string, string> = {
  general: "General",
  quick: "Quick",
  super: "Super",
};

const ONBOARDING: Record<string, string> = {
  open: "Open to all",
  invite_only: "Invite only",
  request_to_join: "Request to join",
};

const AVAILABILITY_MODE: Record<string, string> = {
  selective: "Selective availability",
  always: "Always available",
  on_request: "On request only",
};

/** Look up an option's label by value; falls back to the raw value. */
const labelOf = (
  list: readonly { value: string; label: string }[],
  value: string,
) => list.find((option) => option.value === value)?.label ?? value;

/** Join a set of values into a human sentence, or "—" if empty. */
const labels = (
  list: readonly { value: string; label: string }[],
  values: string[],
) => (values.length ? values.map((value) => labelOf(list, value)).join(", ") : "—");

const SCHEMAS = {
  "basic-info": basicInfoSchema,
  itinerary: itinerarySchema,
  crew: crewSchema,
  pricing: pricingSchema,
  availability: availabilitySchema,
  policies: policiesSchema,
  media: mediaSchema,
} as const;

export function ReviewScreen() {
  const wizard = useWizard();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The draft is empty on the server render and briefly on first client
  // paint. Rather than flashing "nothing to review", hold the render until
  // the store has hydrated from sessionStorage.
  if (!wizard.hydrated) {
    return (
      <>
        <PageBar
          crumbs={[
            { label: "GoDND", href: "/dashboard" },
            { label: "Experiences", href: "/dashboard/experiences" },
            { label: "New experience", href: "/dashboard/experiences/new" },
            { label: "Review" },
          ]}
        />
        <main className="surface-card">
          <div className="card-scroll">
            <div className="mx-auto max-w-[860px] pb-[40px]">
              <div className="skeleton h-[24px] w-[60%]" />
              <div className="skeleton mt-[10px] h-[14px] w-[80%]" />
              <div className="mt-[24px] space-y-[10px]">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="skeleton h-[100px]" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Re-validate each step against its schema. This catches drafts that
  // reached /review through a stale URL or a mid-flow refresh where the
  // section-key completed flag was set but the values no longer parse.
  const problems: { slug: WizardStepSlug; message: string }[] = [];
  for (const step of WIZARD_STEPS) {
    const key = step.key as keyof typeof wizard.draft;
    const result = SCHEMAS[step.slug].safeParse(wizard.draft[key]);
    if (!result.success) {
      const first = result.error.issues[0];
      problems.push({ slug: step.slug, message: first?.message ?? "Missing information" });
    }
  }

  const canSubmit = problems.length === 0 && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const { submitExperienceForApproval } = await import(
      "@/app/dashboard/experiences/new/actions"
    );
    const result = await submitExperienceForApproval(wizard.draft, wizard.experienceId);

    if (!result.ok) {
      // Keep the draft — a network hiccup here shouldn't force the operator
      // through seven steps of typing again.
      setSubmitting(false);
      setError(result.message);
      wizard.markSaveFailed(result.message);
      return;
    }

    // Flash the submitted title so the confirmation screen can name it.
    // Written BEFORE reset() clears the draft, and read-and-forgotten on the
    // next screen so a refresh does not resurface it.
    try {
      window.sessionStorage.setItem(
        SUBMISSION_FLASH_KEY,
        JSON.stringify({
          title: wizard.draft.basicInfo.title,
          ref: result.experienceId,
          submittedAt: Date.now(),
          isUpdate: wizard.isEditing,
        }),
      );
    } catch {
      // Storage failure just means the confirmation screen falls back to
      // neutral copy — never a reason to lose the submission.
    }

    wizard.reset();
    router.push("/dashboard/experiences/new/submitted");
  };

  return (
    <>
      <PageBar
        crumbs={[
          { label: "GoDND", href: "/dashboard" },
          { label: "Experiences", href: "/dashboard/experiences" },
          { label: "New experience", href: "/dashboard/experiences/new" },
          { label: "Review" },
        ]}
      />
      <main className="surface-card">
      <div className="card-scroll">
        <div className="mx-auto max-w-[860px] pb-[100px]">
          <EditStateBanner />

          <p className="m-0 text-[10.5px] font-bold uppercase tracking-[1px] text-brand">
            {wizard.isEditing ? "Review changes" : "Final look"}
          </p>
          <h2 className="m-0 mt-[8px] max-w-[24ch] text-[22px] font-semibold leading-[1.2] tracking-[-0.3px] text-text-primary">
            {wizard.isEditing
              ? "Confirm the changes before they queue for review."
              : "One last look before it goes to review."}
          </h2>
          <p className="m-0 mt-[10px] max-w-[64ch] text-[13px] leading-[1.6] text-text-secondary">
            {wizard.isEditing
              ? "The version currently on the marketplace doesn’t change until a reviewer approves these. Every section below can still be edited — the wizard will bring you back here when you’re done."
              : "This is exactly what a reviewer will see. Anything below can be edited — the wizard will bring you back here when you’re done."}
          </p>

          {problems.length > 0 ? (
            <Notice
              status="warning"
              title={`${problems.length} ${problems.length === 1 ? "section needs" : "sections need"} attention before you can send`}
              className="mt-[24px]"
            >
              <ul className="m-0 list-none p-0">
                {problems.map((problem) => {
                  const step = WIZARD_STEPS.find((s) => s.slug === problem.slug);
                  return (
                    <li key={problem.slug} className="mt-[4px]">
                      <Link
                        href={`/dashboard/experiences/new/${problem.slug}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        {step?.label}
                      </Link>
                      <span className="text-text-secondary">
                        {" "}— {problem.message}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Notice>
          ) : null}

          {error ? (
            <Notice status="critical" title="Couldn't send this experience" className="mt-[24px]">
              {error}
            </Notice>
          ) : null}

          <div className="mt-[28px] space-y-[10px]">
            <SectionCard slug="basic-info">
              <BasicInfoSummary draft={wizard.draft.basicInfo} />
            </SectionCard>
            <SectionCard slug="itinerary">
              <ItinerarySummary draft={wizard.draft.itinerary} />
            </SectionCard>
            <SectionCard slug="crew">
              <CrewSummary draft={wizard.draft.crew} />
            </SectionCard>
            <SectionCard slug="pricing">
              <PricingSummary
                draft={wizard.draft.pricing}
                currency="INR"
              />
            </SectionCard>
            <SectionCard slug="availability">
              <AvailabilitySummary draft={wizard.draft.availability} />
            </SectionCard>
            <SectionCard slug="policies">
              <PoliciesSummary draft={wizard.draft.policies} />
            </SectionCard>
            <SectionCard slug="media">
              <MediaSummary draft={wizard.draft.media} />
            </SectionCard>
          </div>
        </div>

        {/* Pinned footer, matching the wizard's own footer shape so the flow
            feels continuous. The primary action is the terminal action of the
            whole seven-step flow. */}
        <div className="sticky bottom-0 z-10 ml-[-12px] mr-[-16px] flex items-center justify-between gap-[12px] border-t border-border-subtle bg-card py-[12px] pl-[12px] pr-[16px]">
          <span className="text-[11.5px] text-text-muted">
            {wizard.isEditing
              ? `Reviewing your changes to this experience`
              : `Final check · step 7 of ${WIZARD_STEPS.length} completed`}
          </span>
          <div className="flex items-center gap-[8px]">
            <Link
              href="/dashboard/experiences/new/media"
              className={buttonClass()}
            >
              <ArrowLeft aria-hidden />
              Back to Media
            </Link>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              title={
                problems.length
                  ? "Fix the sections flagged above before sending"
                  : undefined
              }
            >
              <Send aria-hidden />
              {submitting ? "Sending…" : wizard.isEditing ? "Send changes for review" : "Send for approval"}
            </Button>
          </div>
        </div>
      </div>
      </main>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function SectionCard({
  slug,
  children,
}: {
  slug: WizardStepSlug;
  children: React.ReactNode;
}) {
  const step = WIZARD_STEPS.find((s) => s.slug === slug);
  const Icon = ICONS[slug];
  const index = WIZARD_STEPS.findIndex((s) => s.slug === slug) + 1;

  return (
    <section
      aria-labelledby={`review-${slug}`}
      className="panel p-[18px]"
    >
      <header className="flex items-start justify-between gap-[10px] border-b border-border-subtle pb-[12px]">
        <div className="flex items-center gap-[10px]">
          <span
            aria-hidden
            className="flex size-[30px] shrink-0 items-center justify-center rounded-md bg-brand-muted text-brand"
          >
            <Icon className="size-[15px]" />
          </span>
          <div>
            <p className="m-0 text-[10.5px] font-semibold uppercase tracking-[.4px] text-text-muted">
              Step {index} of 7
            </p>
            <h3
              id={`review-${slug}`}
              className="m-0 mt-[2px] text-[13.5px] font-semibold text-text-primary"
            >
              {step?.label}
            </h3>
          </div>
        </div>
        <Link
          href={`/dashboard/experiences/new/${slug}`}
          className={buttonClass({ size: "small" })}
        >
          <Pencil aria-hidden />
          Edit
        </Link>
      </header>
      <div className="mt-[12px]">{children}</div>
    </section>
  );
}

/**
 * A grid of key/value rows shared across every summary section.
 */
function DetailGrid({
  rows,
}: {
  rows: (readonly [string, React.ReactNode] | null | false)[];
}) {
  const visible = rows.filter(
    (row): row is readonly [string, React.ReactNode] => Boolean(row),
  );
  if (visible.length === 0) {
    return (
      <p className="m-0 text-[12px] italic text-text-muted">
        Nothing filled in for this section yet.
      </p>
    );
  }
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-x-[16px] gap-y-[8px] text-[12.5px]">
      {visible.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-text-muted">{key}</dt>
          <dd className="m-0 min-w-0 text-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Empty() {
  return <span className="text-text-muted">—</span>;
}

/* --- Per-section summaries ------------------------------------------------ */

type Draft = ReturnType<typeof useWizard>["draft"];

function BasicInfoSummary({ draft }: { draft: Draft["basicInfo"] }) {
  return (
    <>
      <p className="m-0 mb-[10px] text-[13px] font-semibold text-text-primary">
        {draft.title || "Untitled experience"}
      </p>
      <DetailGrid
        rows={[
          ["Type", KIND[draft.kind] ?? draft.kind] as const,
          ["Regions", labels(REGION_OPTIONS, draft.regions)] as const,
          [
            "Duration",
            formatDuration(draft.durationDays, draft.durationNights),
          ] as const,
          ["Categories", labels(CATEGORY_OPTIONS, draft.categories)] as const,
          ["Languages", labels(LANGUAGE_OPTIONS, draft.languages)] as const,
          [
            "Guest ages",
            `${draft.minAge}–${draft.maxAge} yrs`,
          ] as const,
          ["Activity tags", labels(ACTIVITY_OPTIONS, draft.activityTags)] as const,
          ["Food included", FOOD_INCLUDED[draft.foodIncluded] ?? "—"] as const,
          [
            "Food preference",
            FOOD_PREFERENCE[draft.foodPreference] ?? "—",
          ] as const,
        ]}
      />
    </>
  );
}

function ItinerarySummary({ draft }: { draft: Draft["itinerary"] }) {
  const total = draft.days.reduce((sum, day) => sum + day.activities.length, 0);
  if (total === 0 && draft.days.every((day) => !day.pickupLocation)) {
    return (
      <p className="m-0 text-[12px] italic text-text-muted">
        No days planned yet.
      </p>
    );
  }
  return (
    <ol className="m-0 list-none space-y-[10px] p-0 text-[12.5px]">
      {draft.days.map((day) => (
        <li
          key={day.dayNumber}
          className="rounded-md border border-border-subtle bg-canvas p-[12px]"
        >
          <p className="m-0 mb-[4px] text-[11px] font-semibold uppercase tracking-[.4px] text-text-muted">
            Day {day.dayNumber}
          </p>
          {day.pickupIncluded && day.pickupLocation ? (
            <p className="m-0 mb-[6px] text-[12px] text-text-secondary">
              Pick-up: {day.pickupLocation}
              {day.pickupTime ? ` · ${day.pickupTime}` : ""}
            </p>
          ) : null}
          {day.activities.length === 0 ? (
            <p className="m-0 text-[11.5px] italic text-text-muted">
              No activities yet.
            </p>
          ) : (
            <ul className="m-0 list-none space-y-[4px] p-0">
              {day.activities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-baseline gap-[8px] text-[12px] text-text-primary"
                >
                  <span className="font-medium">{activity.title || "Untitled activity"}</span>
                  <span className="text-[11px] text-text-muted">
                    {labelOf(ACTIVITY_KIND_OPTIONS, activity.kind)}
                    {activity.locationName ? ` · ${activity.locationName}` : ""}
                    {activity.stoppageMin ? ` · ${activity.stoppageMin} min` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

function CrewSummary({ draft }: { draft: Draft["crew"] }) {
  return (
    <DetailGrid
      rows={[
        [
          "Trip captain",
          draft.tripCaptain ? labelOf(CREW_OPTIONS, draft.tripCaptain) : <Empty />,
        ] as const,
        [
          "Coordinator",
          draft.coordinator ? labelOf(CREW_OPTIONS, draft.coordinator) : <Empty />,
        ] as const,
        draft.hasGroundCrew && ([
          "Ground crew",
          draft.crewMembers.length
            ? labels(CREW_OPTIONS, draft.crewMembers)
            : "None added",
        ] as const),
        ["Group size", `Up to ${draft.maxGroupSize} guests`] as const,
        [
          "Onboarding",
          ONBOARDING[draft.onboardingStrategy] ?? draft.onboardingStrategy,
        ] as const,
      ]}
    />
  );
}

function PricingSummary({
  draft,
  currency,
}: {
  draft: Draft["pricing"];
  currency: string;
}) {
  const rows: (readonly [string, React.ReactNode] | null | false)[] = [
    [
      "Pricing mode",
      draft.pricingMode === "variable"
        ? "Variable — by group size"
        : "Flat rate per guest",
    ] as const,
    [
      "Base price",
      draft.basePrice > 0 ? (
        <>
          {formatMoney(draft.basePrice * 100, currency)}
          <span className="text-text-muted">
            {" "}
            {draft.pricingMode === "variable" ? "as a starting point" : "per guest"}
          </span>
        </>
      ) : (
        <Empty />
      ),
    ] as const,
    [
      "Max guests per booking",
      `${draft.maxGuestsPerBooking}`,
    ] as const,
    draft.couponCode
      ? ([
          "Coupon",
          <span key="c" className="font-mono">{draft.couponCode}</span>,
        ] as const)
      : null,
  ];

  if (draft.pricingMode === "variable") {
    const tierValues = Object.entries(draft.tiers)
      .map(([size, total]) => [Number(size), Number(total)] as const)
      .filter(([, total]) => total > 0)
      .sort((a, b) => a[0] - b[0]);
    if (tierValues.length > 0) {
      rows.push([
        "Group totals",
        <ul key="tiers" className="m-0 flex list-none flex-wrap gap-[8px] p-0">
          {tierValues.map(([size, total]) => (
            <li
              key={size}
              className="rounded-sm bg-panel-2 px-[8px] py-[3px] text-[11.5px]"
            >
              <span className="text-text-muted">{size} guests</span>
              <span className="ml-[8px] font-medium text-text-primary">
                {formatMoney(total * 100, currency)}
              </span>
            </li>
          ))}
        </ul>,
      ] as const);
    }
  }

  return <DetailGrid rows={rows} />;
}

function AvailabilitySummary({ draft }: { draft: Draft["availability"] }) {
  const windowsRow: readonly [string, React.ReactNode] = [
    "Bookable windows",
    draft.logs.length > 0 && draft.logs.some((log) => log.from && log.to) ? (
      <ul className="m-0 list-none space-y-[2px] p-0">
        {draft.logs
          .filter((log) => log.from && log.to)
          .map((log) => (
            <li key={log.id}>
              {formatDate(log.from)} — {formatDate(log.to)}
            </li>
          ))}
      </ul>
    ) : (
      <Empty />
    ),
  ] as const;

  const holidaysRow = draft.holidays.some((h) => h.from && h.to)
    ? ([
        "Holidays",
        <ul key="h" className="m-0 list-none space-y-[2px] p-0">
          {draft.holidays
            .filter((h) => h.from && h.to)
            .map((h) => (
              <li key={h.id}>
                {formatDate(h.from)} — {formatDate(h.to)}
              </li>
            ))}
        </ul>,
      ] as const)
    : null;

  const blockRow = draft.blockAfterFullCapacity
    ? ([
        "Block after full",
        `${draft.blockForDays} days blocked once a booking is confirmed at full capacity`,
      ] as const)
    : null;

  return (
    <DetailGrid
      rows={[
        [
          "Mode",
          AVAILABILITY_MODE[draft.availabilityMode] ?? draft.availabilityMode,
        ] as const,
        windowsRow,
        holidaysRow,
        blockRow,
      ]}
    />
  );
}

function PoliciesSummary({ draft }: { draft: Draft["policies"] }) {
  return (
    <DetailGrid
      rows={[
        ["Includes", labels(INCLUSION_OPTIONS, draft.inclusions)] as const,
        ["Excludes", labels(EXCLUSION_OPTIONS, draft.exclusions)] as const,
        [
          "Accessibility",
          draft.accessibility.length
            ? labels(ACCESSIBILITY_OPTIONS, draft.accessibility)
            : "None marked",
        ] as const,
        draft.additionalInfo.length > 0 &&
          ([
            "Additional info",
            labels(ADDITIONAL_INFO_OPTIONS, draft.additionalInfo),
          ] as const),
        [
          "First point of contact",
          draft.departureNote ? (
            <span className="whitespace-pre-wrap">{draft.departureNote}</span>
          ) : (
            <Empty />
          ),
        ] as const,
        [
          "Consents",
          draft.acceptCancellationPolicy && draft.acceptSupportStandards
            ? "Cancellation policy · Support standards"
            : "Not yet accepted",
        ] as const,
      ]}
    />
  );
}

function MediaSummary({ draft }: { draft: Draft["media"] }) {
  return (
    <DetailGrid
      rows={[
        [
          "Thumbnail",
          draft.thumbnailId ? (
            <span className="font-mono text-[11.5px]">{draft.thumbnailId}</span>
          ) : (
            <Empty />
          ),
        ] as const,
        [
          "Summary",
          draft.summary ? (
            <span className="line-clamp-3 whitespace-pre-wrap">
              {draft.summary}
            </span>
          ) : (
            <Empty />
          ),
        ] as const,
        [
          "Length",
          `${draft.summary.length}/600 characters`,
        ] as const,
      ]}
    />
  );
}

/** Format an ISO date as "12 May 2026"; returns the input if it doesn't parse. */
function formatDate(iso: string) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

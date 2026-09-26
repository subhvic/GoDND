"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import { useWizard } from "@/components/experiences/wizard/wizard-provider";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageBar } from "@/components/ui/page-bar";
import type { ExperienceDraft } from "@/lib/experience-wizard/schema";
import type { ExperienceStatus } from "@/lib/types";

/*
 * Client-side seeder for the edit flow.
 *
 * Server route hands us the row, converted into an ExperienceDraft the schema
 * accepts. We push that into the wizard store together with the row's
 * experienceId and its status-at-load, then send the operator on to the
 * first step. Every subsequent screen reads those two flags to render the
 * right banner, the right footer copy, and the right terminal action.
 *
 * Archived is the one status that never enters the wizard. It gets a
 * dedicated screen: an archived row must be restored first, from the
 * (unbuilt) list-row action, before it can carry edits.
 */
export function EditEntry({
  experienceId,
  title,
  status,
  publicRef,
  draft,
}: {
  experienceId: string;
  title: string;
  status: ExperienceStatus;
  publicRef: string;
  draft: ExperienceDraft;
}) {
  const wizard = useWizard();
  const router = useRouter();

  useEffect(() => {
    if (status === "archived") return;
    wizard.loadForEdit({
      draft,
      experienceId,
      originalStatus: status,
    });
    router.replace("/dashboard/experiences/new/basic-info");
    // Depending on wizard.loadForEdit would re-fire on every render (it's a
    // stable module-level function). Depending on the payload alone keeps the
    // effect firing when a different experience is opened without churning
    // during hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceId, status, draft, router]);

  if (status === "archived") {
    return <ArchivedBlock experienceId={experienceId} title={title} publicRef={publicRef} />;
  }

  // Everything else lands here for a beat while the seed effect writes to
  // sessionStorage and then swaps the URL. Rather than a spinner (which flashes
  // in and out) the page reads as a purposeful hand-off: title, "opening
  // editor", nothing to interact with.
  return (
    <>
      <PageBar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Experiences", href: "/dashboard/experiences" },
          { label: title.length > 40 ? `${title.slice(0, 40)}…` : title },
          { label: "Edit" },
        ]}
      />
      <main className="surface-card">
        <div className="card-scroll">
          <div className="mx-auto max-w-[560px] pb-[40px] pt-[40px] text-center">
            <p className="m-0 text-[10.5px] font-bold uppercase tracking-[1px] text-brand">
              Opening editor
            </p>
            <h2 className="m-0 mt-[8px] text-[20px] font-semibold text-text-primary">
              {title}
            </h2>
            <p className="m-0 mt-[8px] text-[12px] text-text-muted">
              Loading your existing data into the seven-step editor…
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The archived state is the one place edit is genuinely not the right verb.
 * A restored row is the same row unrestored plus a new available window; the
 * wizard is not the tool for that flip.
 */
function ArchivedBlock({
  experienceId,
  title,
  publicRef,
}: {
  experienceId: string;
  title: string;
  publicRef: string;
}) {
  return (
    <>
      <PageBar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Experiences", href: "/dashboard/experiences" },
          { label: title.length > 40 ? `${title.slice(0, 40)}…` : title },
          { label: "Edit" },
        ]}
      />
      <main className="surface-card">
      <div className="card-scroll">
        <div className="mx-auto max-w-[640px] pb-[40px]">
          <span
            aria-hidden
            className="inline-flex size-[52px] items-center justify-center rounded-full bg-panel-2 text-text-secondary"
          >
            <ShieldCheck className="size-[26px]" />
          </span>
          <p className="m-0 mt-[16px] text-[10.5px] font-bold uppercase tracking-[1px] text-brand">
            Archived experience
          </p>
          <h2 className="m-0 mt-[8px] max-w-[26ch] text-[22px] font-semibold leading-[1.2] tracking-[-0.3px] text-text-primary">
            &ldquo;{title}&rdquo; is archived and can&rsquo;t be edited in place.
          </h2>
          <p className="m-0 mt-[10px] max-w-[64ch] text-[13px] leading-[1.6] text-text-secondary">
            Archived experiences are read-only on purpose — they hold the
            history of past bookings and reviews. Restore this experience to
            edit it; restoring also puts it back in Drafts for approval before
            it can appear on the marketplace again.
          </p>

          <Notice
            status="info"
            title="Reference"
            className="mt-[20px]"
          >
            <p className="m-0 flex flex-wrap items-center gap-x-[10px] gap-y-[4px]">
              <span>EXP-{publicRef}</span>
              <span aria-hidden className="text-text-muted">·</span>
              <span className="font-mono text-[11px] text-text-muted">{experienceId}</span>
            </p>
            <p className="m-0 mt-[6px] text-[11.5px]">
              Keep this reference if you need to write to support about this
              experience.
            </p>
          </Notice>

          <div className="mt-[24px] flex flex-wrap items-center gap-[10px]">
            <button
              type="button"
              disabled
              title="Restore isn't wired in this demo build."
              className={buttonClass({ variant: "primary" })}
            >
              <ArchiveRestore aria-hidden />
              Restore to edit
            </button>
            <Link
              href="/dashboard/experiences?tab=archived"
              className={buttonClass()}
            >
              <ArrowLeft aria-hidden />
              Back to Archived
            </Link>
            <Link
              href="/dashboard/experiences/new"
              className={buttonClass()}
            >
              Start a new experience
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </div>
      </main>
    </>
  );
}

import { notFound } from "next/navigation";

import { EditEntry } from "@/components/experiences/wizard/edit-entry";
import { getExperience } from "@/lib/data/experiences";
import { detailToDraft } from "@/lib/experience-wizard/detail-to-draft";

export const metadata = {
  title: "Edit experience",
  description: "Change what a guest sees, then send updates for approval.",
};

/**
 * The one entry point for editing an existing experience.
 *
 * The wizard's draft store carries `experienceId` and `originalStatus`, and
 * setting those two turns the same seven-step flow into an edit session
 * without a second copy of the wizard's URLs. This server route:
 *
 *   1. Loads the row (a 404 if it doesn't exist).
 *   2. Converts the detail into an ExperienceDraft the wizard schemas can
 *      read.
 *   3. Hands the payload to a client seeder that writes both fields into
 *      the store and pushes the browser into /new/basic-info — the same
 *      URL a fresh flow uses, now hydrated with real data and stamped as an
 *      edit session.
 *
 * Archived is the one state that never enters the wizard. The seeder shows
 * a "restore first" screen instead, so archived rows can't quietly become
 * editable via a bookmarked URL.
 */
export default async function EditEntryPage(
  props: PageProps<"/dashboard/experiences/[id]/edit">,
) {
  const { id } = await props.params;

  const detail = await getExperience(id);
  if (!detail) notFound();

  const draft = detailToDraft(detail);

  return (
    <EditEntry
      experienceId={detail.id}
      title={detail.title}
      status={detail.status}
      publicRef={detail.publicRef}
      draft={draft}
    />
  );
}

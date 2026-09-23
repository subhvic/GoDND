import { redirect } from "next/navigation";

/** /new has no form of its own; it opens at step 1. */
export default function NewExperienceIndex() {
  redirect("/dashboard/experiences/new/basic-info");
}

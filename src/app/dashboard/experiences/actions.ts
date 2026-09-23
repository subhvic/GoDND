"use server";

import { getExperience } from "@/lib/data/experiences";
import type { ExperienceDetail } from "@/lib/types";

/**
 * The drawer loads on demand rather than shipping detail for every row with
 * the table — most rows are never opened, and the detail payload is several
 * times the size of a row.
 */
export async function fetchExperienceDetail(
  id: string,
): Promise<ExperienceDetail | null> {
  return getExperience(id);
}

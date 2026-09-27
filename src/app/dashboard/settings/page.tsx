import { redirect } from "next/navigation";

import { getSettings } from "@/lib/data/settings";
import { settingsProgress } from "@/lib/settings/rules";

export const metadata = { title: "Settings" };

/**
 * Settings opens where the operator is needed: the first section that
 * needs them, or Basic Info once nothing does.
 */
export default async function SettingsIndexPage() {
  const load = await getSettings();
  if (!load) redirect("/login");
  const { firstNeedingAttention } = settingsProgress(load.state);
  redirect(`/dashboard/settings/${firstNeedingAttention ?? "basic-info"}`);
}

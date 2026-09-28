import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SettingsScreen } from "@/components/settings/settings-screen";
import { SETTINGS_SECTIONS, getSection } from "@/lib/settings/model";

/**
 * Each section is a real route, so a section can be linked to — a reminder
 * email can point at Certifications — and the back button steps between them.
 */
export function generateStaticParams() {
  return SETTINGS_SECTIONS.map((section) => ({ section: section.slug }));
}

export async function generateMetadata(
  props: PageProps<"/dashboard/settings/[section]">,
): Promise<Metadata> {
  const { section } = await props.params;
  const match = getSection(section);
  return { title: match ? `${match.label} · Settings` : "Settings" };
}

export default async function SettingsSectionPage(props: PageProps<"/dashboard/settings/[section]">) {
  const { section } = await props.params;
  const match = getSection(section);
  if (!match) notFound();

  return <SettingsScreen slug={match.slug} />;
}

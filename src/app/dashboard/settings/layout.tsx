import { redirect } from "next/navigation";

import { SettingsProvider } from "@/components/settings/settings-provider";
import { PageBar } from "@/components/ui/page-bar";
import { getSettings } from "@/lib/data/settings";

/**
 * Settings (handoff: "Vendor Admin" frames). A layout rather than a page, so
 * the store survives moving between sections and the rail's state updates
 * the moment one is sent.
 *
 * The trail stops at Settings: its parent is the Dashboard, and the back
 * arrow goes there rather than into /dashboard/settings, which only
 * forwards to a section.
 */
export default async function SettingsLayout({ children }: LayoutProps<"/dashboard/settings">) {
  const load = await getSettings();
  if (!load) redirect("/login");

  return (
    <SettingsProvider initialState={load.state} isDemo={load.isDemoData} now={load.now}>
      <PageBar crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]} />
      {children}
    </SettingsProvider>
  );
}

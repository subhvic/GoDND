import { redirect } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import type { SidebarUser } from "@/components/dashboard/sidebar";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Operator portal shell. Reached as portal.godnd.co/dashboard/*.
 */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const user = await currentUser();
  return <AppShell user={user}>{children}</AppShell>;
}

/**
 * Falls back to a demo identity when Supabase is not configured, so the shell
 * renders on a fresh clone. With auth configured, the proxy already sends a
 * signed-out visitor to /login; redirecting here too keeps that true if a
 * request ever reaches the shell without passing through it.
 */
async function currentUser(): Promise<SidebarUser> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { name: "Dipendu", role: "Admin", email: "Wander Beyond · sample workspace", plan: "Growth" };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("agency_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  return {
    name: profile?.full_name ?? user.email ?? "Account",
    role: titleCase(membership?.role ?? "member"),
    email: user.email,
  };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

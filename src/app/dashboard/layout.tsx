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
 * renders on a fresh clone. Once auth is wired, an unauthenticated request
 * redirects rather than showing a placeholder.
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

  if (!user) return { name: "Guest", role: "Signed out" };

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

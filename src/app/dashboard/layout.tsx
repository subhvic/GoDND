import { Sidebar, type SidebarUser } from "@/components/dashboard/sidebar";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Operator portal shell. Reached as portal.godnd.co/dashboard/* — the proxy
 * strips the visible /dashboard prefix before this tree sees the request.
 */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const user = await currentUser();

  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <Sidebar user={user} />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

/**
 * Falls back to the handoff file's demo identity when Supabase is not
 * configured, so the shell renders on a fresh clone. Once auth is wired, an
 * unauthenticated request redirects rather than showing a placeholder.
 */
async function currentUser(): Promise<SidebarUser> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { name: "Dipendu", role: "Admin", avatarUrl: null };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { name: "Guest", role: "Signed out", avatarUrl: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
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
    avatarUrl: profile?.avatar_url ?? null,
  };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

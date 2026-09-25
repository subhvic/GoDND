import { redirect } from "next/navigation";

import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginFlow } from "@/components/auth/login-flow";
import { isAuthConfigured, safeNextPath } from "@/lib/auth/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = {
  title: "Log in",
  description: "Sign in to the GoDND operator portal with a one-time code.",
};

/**
 * portal.godnd.co/login — the operator portal's front door.
 *
 * The proxy already turns a signed-in visitor around; checking again here
 * keeps that true if the proxy's matcher ever stops covering this path.
 */
export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const next = safeNextPath(params.next);

  if (isAuthConfigured()) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect(next);
  }

  return (
    <AuthLayout>
      <LoginFlow
        next={next}
        previewAudience={
          isAuthConfigured()
            ? null
            : process.env.NODE_ENV === "development"
              ? "dev"
              : "preview"
        }
      />
    </AuthLayout>
  );
}

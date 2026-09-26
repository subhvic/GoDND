import { AuthHero } from "@/components/auth/auth-hero";
import { LogoLockup } from "@/components/brand/logo";

/**
 * The sign-in frame from the handoff file: the image half, and the panel
 * with the "GoDND | Portal" lockup above whatever step is showing. Kept
 * separate from the login form so the other account screens the file
 * sketches (forgot password, change password) can reuse it unchanged.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth">
      <AuthHero />
      <div className="auth-panel">
        <div className="auth-panel-inner">
          <PortalLockup />
          <div className="auth-content">{children}</div>
        </div>
      </div>
    </main>
  );
}

/**
 * The full "GoDND | Portal" lockup. It says which GoDND this is — the
 * operator portal, not the traveller marketplace — before the form asks
 * for anything.
 */
function PortalLockup() {
  return <LogoLockup height={36} label="GoDND Portal" className="auth-lockup" />;
}

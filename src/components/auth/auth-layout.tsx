import { AuthHero } from "@/components/auth/auth-hero";
import { LogoIcon } from "@/components/brand/logo";

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
 * The mark, the wordmark, and the product name set lighter behind a
 * hairline. It says which GoDND this is — the operator portal, not the
 * traveller marketplace — before the form asks for anything.
 */
function PortalLockup() {
  return (
    <p className="auth-lockup m-0">
      <LogoIcon size={52} className="auth-lockup-mark" />
      <span className="auth-lockup-wordmark">GoDND</span>
      <span className="auth-lockup-product">Portal</span>
    </p>
  );
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, Menu, X } from "lucide-react";

import { LogoLockup } from "@/components/brand/logo";
import { Sidebar, type SidebarUser } from "@/components/dashboard/sidebar";
import { cn } from "@/lib/utils";

const PHONE_QUERY = "(max-width: 767px)";

function subscribePhone(callback: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/**
 * App shell (source: App.jsx): a flex row of the navigation rail and the main
 * column. Pages render their own .surface-card inside .main, because the card
 * is where layouts differ — a list, or a rail plus a form.
 *
 * The rail is always expanded: labels stay visible, so no item needs a tooltip
 * to be found. On phones a 178px rail beside the page would leave the page
 * about half the screen, so below 768px the same expanded rail slides in over
 * the page from a menu button instead of sitting beside it.
 */
export function AppShell({
  user,
  children,
}: {
  user: SidebarUser;
  children: React.ReactNode;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const pathname = usePathname();
  const isPhone = useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
  // Open is tied to the page it was opened on, so following a link in the
  // panel closes it without an effect watching the route.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const navOpen = isPhone && openedOn === pathname;
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Focus moves in when the panel opens, and back to the menu button when it
  // is dismissed. It has to wait for the commit: while open, the bar holding
  // the menu button is inert and cannot take focus.
  const returnFocus = useRef(false);
  useEffect(() => {
    if (navOpen) {
      document.querySelector<HTMLElement>("#main-nav .nav-close")?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      menuRef.current?.focus();
    }
  }, [navOpen]);

  const closeNav = () => {
    returnFocus.current = true;
    setOpenedOn(null);
  };

  return (
    <div
      className={cn("app", navOpen && "nav-open")}
      onKeyDown={(event) => {
        if (event.key === "Escape" && navOpen) closeNav();
      }}
    >
      <header className="mobile-bar" inert={navOpen || undefined}>
        <button
          ref={menuRef}
          type="button"
          className="hbtn icon"
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="main-nav"
          onClick={() => setOpenedOn(pathname)}
        >
          <Menu aria-hidden />
        </button>
        <Link href="/dashboard/experiences" aria-label="GoDND Portal home" className="flex items-center">
          <LogoLockup height={22} />
        </Link>
      </header>

      <Sidebar
        user={user}
        onClose={isPhone ? closeNav : undefined}
        onOpenHelp={() =>
          setToast("The help centre isn't built yet — this was a preview of where it will live.")
        }
      />
      {navOpen ? <div className="nav-scrim" aria-hidden onClick={closeNav} /> : null}

      <div className="main" inert={navOpen || undefined}>
        {children}
      </div>

      {toast ? (
        <div className="toast-bar floating" role="status">
          <HelpCircle aria-hidden />
          <span className="toast-msg">{toast}</span>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
            <X aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

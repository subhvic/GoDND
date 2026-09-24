"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

import { Sidebar, type SidebarUser } from "@/components/dashboard/sidebar";
import { cn } from "@/lib/utils";

/**
 * App shell (source: App.jsx): a flex row of the navigation rail and the main
 * column. Pages render their own .surface-card inside .main, because the card
 * is where layouts differ — a list, or a rail plus a form.
 *
 * The rail starts collapsed to 66px, as in the reference, and expands over
 * the canvas on hover or keyboard focus.
 */
export function AppShell({
  user,
  children,
}: {
  user: SidebarUser;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className={cn("app", collapsed && "nav-collapsed")}>
      <Sidebar
        user={user}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onOpenHelp={() =>
          setToast("The help centre isn't built yet — this was a preview of where it will live.")
        }
      />
      <div className="main">{children}</div>

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

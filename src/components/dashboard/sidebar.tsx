"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  Compass,
  Globe,
  HelpCircle,
  Home,
  LogOut,
  MessagesSquare,
  Receipt,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";

import { signOut } from "@/app/login/actions";
import { LogoIcon, LogoWordmark } from "@/components/brand/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSection,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Primary navigation (source: Sidebar / .nav).
 *
 * Modules that are not built yet are shown disabled rather than hidden, as
 * the reference does for Service Graph and SLOs: an operator sees the whole
 * shape of the product, and nothing pretends to work when it does not.
 */
type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Active only on its own path — Home's /dashboard prefixes every page. */
  exact?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { id: "home", label: "Home", icon: Home, href: "/dashboard", exact: true },
      { id: "experiences", label: "Experiences", icon: Compass, href: "/dashboard/experiences" },
      { id: "bookings", label: "Bookings", icon: CalendarCheck, href: "/dashboard/bookings" },
      { id: "enquiries", label: "Enquiries", icon: MessagesSquare, href: "/dashboard/enquiries" },
    ],
  },
  {
    label: "Analyze",
    items: [
      { id: "insights", label: "Insights", icon: BarChart3 },
      { id: "transactions", label: "Transactions", icon: Receipt },
    ],
  },
  {
    label: "Manage",
    items: [
      { id: "website", label: "Website", icon: Globe },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export type SidebarUser = {
  name: string;
  role: string;
  email?: string | null;
  plan?: string | null;
};

export function Sidebar({
  user,
  onOpenHelp,
  onClose,
}: {
  user: SidebarUser;
  onOpenHelp: () => void;
  /** Phones only: the rail is a slide-in panel there, and needs a close. */
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav id="main-nav" className="nav" aria-label="Main">
      <div className="nav-top">
        <Link href="/dashboard" aria-label="GoDND home" className="flex items-center gap-[12px]">
          <LogoIcon size={27} />
          <span className="nav-wordmark">
            <LogoWordmark className="text-[16px]" />
          </span>
        </Link>
        {onClose ? (
          <button type="button" className="nav-close record-drawer-close" aria-label="Close navigation" onClick={onClose}>
            <X aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="nav-scroll">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <div className="nav-group-label" aria-hidden>
              <span>{group.label}</span>
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              if (!item.href) {
                return (
                  <span
                    key={item.id}
                    className="nav-item disabled"
                    aria-disabled="true"
                    title={`${item.label} — coming in a later phase`}
                  >
                    <Icon aria-hidden />
                    <span className="nav-text">{item.label}</span>
                  </span>
                );
              }
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  // The collapsed rail hides .nav-text with display:none,
                  // which also removes it from the accessible name — the
                  // label has to ride on the link itself.
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn("nav-item", active && "active")}
                >
                  <Icon aria-hidden />
                  <span className="nav-text">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="nav-bottom">
        <div className="nav-user-row">
          <button type="button" className="nav-user-btn" onClick={onOpenHelp} aria-label="Help and documentation">
            <HelpCircle aria-hidden />
            <span className="nav-text">Help</span>
          </button>
          <AccountMenu user={user} />
        </div>
      </div>
    </nav>
  );
}

function AccountMenu({ user }: { user: SidebarUser }) {
  const [signingOut, startSignOut] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="nav-user-btn data-[state=open]:bg-panel data-[state=open]:text-text-primary"
          aria-label="Account menu"
        >
          <span className="nav-avatar" aria-hidden>
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="nav-text">{user.name}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" collisionPadding={12} className="w-[250px]">
        <div className="pop-head">
          <div className="pop-name">
            {user.name}
            {user.plan ? <span className="pop-plan">{user.plan}</span> : null}
          </div>
          <div className="pop-email">{user.email ?? user.role}</div>
        </div>

        <DropdownMenuSection label="Reference">
          <DropdownMenuItem asChild>
            <Link href="/design-system">
              Design system
              <BookOpen aria-hidden className="size-[14px] text-text-muted" />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuSection>

        <DropdownMenuSection>
          <DropdownMenuItem
            danger
            disabled={signingOut}
            onSelect={() => startSignOut(() => signOut())}
          >
            {signingOut ? "Logging out…" : "Log out"}
            <LogOut aria-hidden className="size-[14px]" />
          </DropdownMenuItem>
        </DropdownMenuSection>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

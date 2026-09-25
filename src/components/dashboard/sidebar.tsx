"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Compass,
  Globe,
  HelpCircle,
  Home,
  MessagesSquare,
  Receipt,
  Settings,
  type LucideIcon,
} from "lucide-react";

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
type NavItem = { id: string; label: string; icon: LucideIcon; href?: string };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { id: "home", label: "Home", icon: Home },
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
  collapsed,
  onToggleCollapsed,
  onOpenHelp,
}: {
  user: SidebarUser;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenHelp: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-top">
        <Link href="/dashboard/experiences" aria-label="GoDND home" className="flex items-center gap-[12px]">
          <LogoIcon size={27} />
          <span className="nav-wordmark">
            <LogoWordmark className="text-[16px]" />
          </span>
        </Link>
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
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
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
        <button
          type="button"
          className="nav-collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight aria-hidden /> : <ChevronLeft aria-hidden />}
          <span className="nav-text">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
    </nav>
  );
}

function AccountMenu({ user }: { user: SidebarUser }) {
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
          {/* Sign-in is not wired yet; the item is present but inert rather
              than missing, so its place in the menu is settled. */}
          <DropdownMenuItem danger disabled>
            Log out
          </DropdownMenuItem>
        </DropdownMenuSection>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  Home,
  Inbox,
  LayoutGrid,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Sidebar — 273px, matching the handoff frames.
 *
 * NOTE on icons: the file uses Material Symbols (move_to_inbox, view_module,
 * view_list, list_alt, tab). Those assets could not be downloaded because this
 * environment blocks figma.com, so these are the nearest lucide equivalents.
 * Swap in the real set before launch; sizes (24px) and positions are correct.
 *
 * The file draws only a 1440px desktop frame. Below `lg` the rail collapses to
 * icons, because an operator checking a booking on a phone is a real case the
 * design doesn't cover — flagged rather than invented silently.
 */

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The file shows a chevron on every row except Settings. */
  expandable?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home, expandable: true },
  { href: "/dashboard/experiences", label: "Experiences", icon: Inbox, expandable: true },
  { href: "/dashboard/bookings", label: "Bookings", icon: LayoutGrid, expandable: true },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3, expandable: true },
  { href: "/dashboard/transactions", label: "Transactions", icon: ListChecks, expandable: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export type SidebarUser = {
  name: string;
  role: string;
  avatarUrl: string | null;
};

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex h-full w-[72px] shrink-0 flex-col gap-[13px] overflow-hidden border-r border-neutral-5 bg-white lg:w-sidebar"
    >
      <div className="flex flex-col pt-[20px]">
        <div className="hidden items-center pb-[30px] pl-[25px] lg:flex">
          <Link href="/dashboard" aria-label="GoDND Portal home">
            <Logo />
          </Link>
        </div>

        <div className="flex items-start gap-0 pb-[10px] pl-[16px] lg:pl-[25px]">
          <span className="relative size-[40px] shrink-0 overflow-hidden rounded-full bg-neutral-5 lg:size-[56px]">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-body font-medium text-ink-muted">
                {user.name.charAt(0)}
              </span>
            )}
          </span>

          <span className="hidden h-[54px] w-[192px] items-center py-[15px] pl-[14px] pr-[25px] lg:flex">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-medium text-neutral-1">
                {user.name}
              </span>
              <span className="truncate text-small text-ink-muted">{user.role}</span>
            </span>
            <ChevronDown aria-hidden className="size-[24px] shrink-0 text-ink-muted" />
          </span>
        </div>
      </div>

      <ul className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {NAV.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </ul>
    </nav>
  );
}

/**
 * /dashboard must not light up for /dashboard/experiences, but
 * /dashboard/experiences must stay lit on its child routes.
 */
function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <li className="w-full">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex w-full items-stretch transition-colors",
          active ? "bg-brand-surface" : "hover:bg-surface-sunken",
        )}
      >
        {/* 3px accent rail, full row height; transparent when inactive so the
            label never shifts between states. */}
        <span
          aria-hidden
          className={cn(
            "w-[3px] shrink-0 rounded-r-[5px]",
            active ? "bg-brand" : "bg-transparent",
          )}
        />
        <span className="flex h-nav-row flex-1 items-center px-[24px] py-[15px] lg:px-[25px]">
          <Icon
            aria-hidden
            className={cn(
              "size-[24px] shrink-0 lg:mr-[31px]",
              active ? "text-ink" : "text-ink-muted",
            )}
          />
          <span
            className={cn(
              "hidden min-w-0 flex-1 truncate text-left text-body lg:block",
              active ? "font-medium text-ink" : "text-ink-muted",
            )}
          >
            {item.label}
          </span>
          {item.expandable ? (
            <ChevronDown
              aria-hidden
              className="hidden size-[24px] shrink-0 text-ink-muted lg:block"
            />
          ) : null}
        </span>
      </Link>
    </li>
  );
}

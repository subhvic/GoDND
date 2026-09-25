import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, BookOpen, Compass, Globe, LayoutDashboard, LogIn, SquarePlus, Store } from "lucide-react";

import { LogoLockup } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export const metadata = {
  title: "GoDND",
  description:
    "Travel companies build and sell experiences; travellers find them. One platform.",
};

/**
 * The marketplace root.
 *
 * The consumer marketplace is not built yet, so this states plainly what
 * exists and routes to it. The operator portal is only linked on hosts where
 * it is reachable by path (a deployment URL or local dev) — on godnd.co the
 * proxy 404s /dashboard, and a link that 404s is worse than no link.
 */
export default async function HomePage() {
  const host = (await headers()).get("host") ?? "";
  const isDeployment =
    host.endsWith(".vercel.app") ||
    host.includes("localhost") ||
    host.startsWith("127.0.0.1");

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="flex items-center justify-between gap-[16px] border-b border-border-subtle px-[20px] py-[14px] lg:px-[40px]">
        <LogoLockup height={26} label="GoDND Portal" />
        <Link href="/design-system" className={buttonClass()}>
          <BookOpen aria-hidden />
          Design system
        </Link>
      </header>

      <div className="mx-auto max-w-[920px] px-[20px] py-[56px] lg:px-[40px] lg:py-[80px]">
        <p className="m-0 text-[10.5px] font-bold uppercase tracking-[1px] text-brand">
          Northeast India
        </p>
        <h1 className="m-0 mt-[10px] max-w-[20ch] text-[30px] font-bold leading-[1.15] tracking-[-0.5px] text-text-primary lg:text-[36px]">
          Experiences worth the journey, run by the people who live there.
        </h1>
        <p className="m-0 mt-[14px] max-w-[60ch] text-[13.5px] leading-[1.65] text-text-secondary">
          GoDND gives travel companies the tools to build, sell and manage their
          trips — and gives travellers one place to find them.
        </p>

        <section className="mt-[44px]" aria-labelledby="whats-live">
          <h2
            id="whats-live"
            className="m-0 text-[10px] font-bold uppercase tracking-[.9px] text-text-muted"
          >
            What&rsquo;s built so far
          </h2>

          <ul className="m-0 mt-[12px] grid list-none gap-[12px] p-0 sm:grid-cols-2">
            <EntryCard
              href="/login"
              icon={LogIn}
              title="Portal sign-in"
              body="Email, then a one-time code — the operator’s way into the portal."
              available={isDeployment}
              unavailableNote="On portal.godnd.co"
            />
            <EntryCard
              href="/dashboard"
              icon={LayoutDashboard}
              title="Operator portal"
              body="Home — the experience funnel, conversion graph, latest bookings and new experiences."
              available={isDeployment}
              unavailableNote="On portal.godnd.co"
            />
            <EntryCard
              href="/dashboard/experiences"
              icon={Compass}
              title="Experiences"
              body="Experiences list with status tabs, search, and a record drawer."
              available={isDeployment}
              unavailableNote="On portal.godnd.co"
            />
            <EntryCard
              href="/dashboard/experiences/new/basic-info"
              icon={SquarePlus}
              title="Add new experience"
              body="The seven-step builder: itinerary, crew, pricing, availability, policies, media."
              available={isDeployment}
              unavailableNote="On portal.godnd.co"
            />
            <EntryCard
              href="/design-system"
              icon={BookOpen}
              title="Design system"
              body="Tokens, foundations and every component, rendered live."
              available
              unavailableNote=""
            />
            <EntryCard
              icon={Store}
              title="Marketplace"
              body="Browse and book listed experiences across the Northeast."
              available={false}
              unavailableNote="Not built yet"
            />
            <EntryCard
              icon={Globe}
              title="Operator websites"
              body="Each company's own branded site, on its own domain."
              available={false}
              unavailableNote="Editor not built"
            />
          </ul>
        </section>

        {isDeployment ? (
          <Notice status="info" title="You're on a deployment URL" className="mt-[28px]">
            Every surface is reachable by path here. On the real domains they are
            separated by host — the portal on portal.godnd.co, the marketplace on
            godnd.co, and each operator on their own domain.
          </Notice>
        ) : null}
      </div>
    </main>
  );
}

function EntryCard({
  href,
  icon: Icon,
  title,
  body,
  available,
  unavailableNote,
}: {
  href?: string;
  icon: typeof Store;
  title: string;
  body: string;
  available: boolean;
  unavailableNote: string;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-[10px]">
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-md bg-panel text-text-secondary">
          <Icon aria-hidden className="size-[16px]" />
        </span>
        <span className="text-[13.5px] font-semibold text-text-primary">{title}</span>
        {available ? (
          <ArrowRight aria-hidden className="ml-auto size-[15px] text-brand" />
        ) : (
          <span className="badge neutral ml-auto">{unavailableNote}</span>
        )}
      </span>
      <span className="mt-[8px] block text-[12px] leading-[1.55] text-text-secondary">{body}</span>
    </>
  );

  if (!available || !href) {
    return <li className="panel p-[16px] opacity-60">{inner}</li>;
  }

  return (
    <li>
      <Link
        href={href}
        className="panel block h-full p-[16px] no-underline transition-colors hover:border-border-strong hover:bg-panel-2"
      >
        {inner}
      </Link>
    </li>
  );
}

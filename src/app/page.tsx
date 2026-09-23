import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, Compass, LayoutDashboard, Store } from "lucide-react";

import { Logo } from "@/components/brand/logo";

export const metadata = {
  title: "GoDND",
  description:
    "Travel companies build and sell experiences; travellers find them. One platform.",
};

/**
 * The marketplace root.
 *
 * The consumer marketplace is not built yet, so rather than leave the
 * create-next-app placeholder here, this states plainly what exists and
 * routes to it. On a *.vercel.app deployment it also surfaces the operator
 * portal, which is otherwise only reachable on portal.godnd.co — without this
 * there is no way to open the portal from a deployment URL.
 */
export default async function HomePage() {
  const host = (await headers()).get("host") ?? "";
  // A deployment URL or a local dev server — anywhere the surfaces are not
  // yet separated by real hostnames.
  const isDeployment =
    host.endsWith(".vercel.app") ||
    host.includes("localhost") ||
    host.startsWith("127.0.0.1");

  return (
    <main className="min-h-dvh bg-white">
      <header className="border-b border-neutral-5 px-[20px] py-[18px] lg:px-[48px]">
        <Logo suffix={null} />
      </header>

      <div className="mx-auto max-w-[880px] px-[20px] py-[56px] lg:px-[48px] lg:py-[88px]">
        <p className="text-small font-medium text-brand">Northeast India</p>
        <h1 className="mt-[12px] max-w-[18ch] text-display-sm font-semibold leading-[1.15] text-ink lg:text-display">
          Experiences worth the journey, run by the people who live there.
        </h1>
        <p className="mt-[18px] max-w-[60ch] text-body text-ink-muted">
          GoDND gives travel companies the tools to build, sell and manage their
          trips — and gives travellers one place to find them.
        </p>

        <section className="mt-[48px]" aria-labelledby="whats-live">
          <h2
            id="whats-live"
            className="text-small font-semibold uppercase tracking-[0.08em] text-neutral-2"
          >
            What&rsquo;s built so far
          </h2>

          <ul className="mt-[16px] grid gap-[12px] sm:grid-cols-2">
            <EntryCard
              href="/dashboard/experiences"
              icon={<LayoutDashboard aria-hidden className="size-[20px]" />}
              title="Operator portal"
              body="Experiences table with five status tabs, detail drawer, and the seven-step builder."
              available={isDeployment}
              unavailableNote="Live on portal.godnd.co"
            />
            <EntryCard
              href="/dashboard/experiences/new/basic-info"
              icon={<Compass aria-hidden className="size-[20px]" />}
              title="Add New Experience"
              body="The full wizard: itinerary, crew, pricing, availability, policies and media."
              available={isDeployment}
              unavailableNote="Live on portal.godnd.co"
            />
            <EntryCard
              icon={<Store aria-hidden className="size-[20px]" />}
              title="Marketplace"
              body="Browse and book listed experiences across the Northeast."
              available={false}
              unavailableNote="Not built yet"
            />
            <EntryCard
              icon={<Store aria-hidden className="size-[20px]" />}
              title="Operator websites"
              body="Each company's own branded site, on their own domain."
              available={false}
              unavailableNote="Schema and routing ready; editor not built"
            />
          </ul>
        </section>

        {isDeployment ? (
          <p className="mt-[36px] border border-line-soft bg-brand-surface px-[14px] py-[12px] text-small text-ink">
            You&rsquo;re on a deployment URL, so every surface is reachable by
            path here. On the real domains they are separated by host:
            the portal on <strong>portal.godnd.co</strong>, the marketplace on{" "}
            <strong>godnd.co</strong>, and each operator on their own domain.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function EntryCard({
  href,
  icon,
  title,
  body,
  available,
  unavailableNote,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  available: boolean;
  unavailableNote: string;
}) {
  const inner = (
    <>
      <span className="flex items-center gap-[10px] text-ink">
        {icon}
        <span className="text-body font-medium">{title}</span>
        {available ? (
          <ArrowRight aria-hidden className="ml-auto size-[16px] text-brand" />
        ) : (
          <span className="ml-auto text-small text-neutral-2">
            {unavailableNote}
          </span>
        )}
      </span>
      <span className="mt-[8px] block text-small text-ink-muted">{body}</span>
    </>
  );

  if (!available || !href) {
    return (
      <li className="border border-neutral-5 bg-surface-sunken p-[18px] opacity-80">
        {inner}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className="block h-full border border-line-soft bg-white p-[18px] transition-colors hover:border-brand hover:bg-brand-surface"
      >
        {inner}
      </Link>
    </li>
  );
}

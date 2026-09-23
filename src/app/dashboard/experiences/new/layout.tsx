/**
 * The wizard's draft lives in a module-level store (see
 * lib/experience-wizard/draft-store.ts), so no provider is needed here. This
 * layout exists to keep the seven steps under one route segment.
 */
export default function NewExperienceLayout({
  children,
}: LayoutProps<"/dashboard/experiences/new">) {
  return children;
}

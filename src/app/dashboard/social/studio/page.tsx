import { Composer } from "@/components/social/composer";
import { PageBar } from "@/components/ui/page-bar";
import { listChannels } from "@/lib/data/social";
import { listExperiences } from "@/lib/data/experiences";

export const metadata = { title: "Studio" };

/**
 * Per-operator data behind a session: rendered per request, never cached
 * across them.
 */
export const dynamic = "force-dynamic";

/**
 * Where a post gets written.
 *
 * Only active experiences are offered: a draft or archived experience has no
 * booking page for a caption to send anyone to, so promoting one wastes the
 * post. The composer is a client component because every check it runs is a
 * response to a keystroke.
 */
export default async function StudioPage() {
  const [{ rows }, { channels }] = await Promise.all([
    listExperiences({ tab: "active", pageSize: 50 }),
    listChannels(),
  ]);

  const connected = channels
    .filter((channel) => channel.capabilities.publish)
    .map((channel) => channel.platform);

  return (
    <>
      <PageBar
        crumbs={[{ label: "Growth" }, { label: "Studio" }]}
      />

      <div className="surface-card">
        <div className="card-scroll">
          <Composer experiences={rows} connected={connected} />
        </div>
      </div>
    </>
  );
}

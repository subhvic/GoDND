/*
 * The one place the "sample data" notice's copy is decided.
 *
 * The notice appears whenever `listExperiences` (or any other data function)
 * had to fall back to fixtures because Supabase isn't configured. Two
 * audiences see that state and each needs a different sentence:
 *
 *   - A developer running `next dev` locally without env keys should be
 *     told what env var to fill in.
 *   - A stakeholder or design client opening an unconnected preview URL
 *     should be told what they're looking at, without being told about
 *     .env.local (which they aren't going to touch).
 *
 * `NODE_ENV === "development"` is the split. Everything else (preview,
 * production, and the `VERCEL_ENV=production` end-to-end run) gets the
 * stakeholder copy. The helper lives here so both the Experiences list
 * and the design-system doc render exactly the same words.
 */

export type DemoNoticeCopy = {
  title: string;
  body: React.ReactNode;
};

/**
 * @param audience  "dev" to force the developer copy (used in the design-
 *                  system doc so both variants can be shown side by side),
 *                  otherwise the copy is chosen from NODE_ENV.
 */
export function demoNoticeCopy(audience?: "dev" | "preview"): DemoNoticeCopy {
  const isDev = audience
    ? audience === "dev"
    : process.env.NODE_ENV === "development";

  if (isDev) {
    return {
      title: "Showing sample data",
      body: (
        <>
          Add your Supabase keys to <code>.env.local</code> to see your own
          experiences.
        </>
      ),
    };
  }

  return {
    title: "Preview with sample data",
    body: (
      <>
        You&rsquo;re looking at a walkthrough of the operator portal. The
        experiences below are representative &mdash; real ones appear here
        once the workspace is connected to a live database.
      </>
    ),
  };
}

import type { AdPlatform, SocialPlatform } from "@/lib/social/types";
import { cn } from "@/lib/utils";

/**
 * Platform glyphs. Drawn inline rather than pulled from an icon set because
 * these three are the only marks in the product an operator scans for by
 * shape — a channel row is read as "the Instagram one" long before the label
 * is read. Monochrome, so they take the surrounding text colour and never
 * fight the status colour beside them.
 */
export function PlatformIcon({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
      className={cn("size-[16px] shrink-0", className)}
    >
      {platform === "instagram" ? (
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.36 2.67.95 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.8.72 1.47 1.38 2.13.66.66 1.33 1.07 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.31 1.47-.72 2.13-1.38.66-.66 1.07-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.8-.72-1.47-1.38-2.13-.66-.66-1.33-1.07-2.13-1.38-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z" />
      ) : null}
      {platform === "facebook" ? (
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
      ) : null}
      {platform === "x" ? (
        <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.584-6.64 7.584H.47l8.6-9.83L0 1.15h7.6l5.24 6.93ZM17.61 20.64h2.04L6.49 3.24H4.3Z" />
      ) : null}
    </svg>
  );
}

/**
 * Ad platforms. Meta and Google rather than Instagram and Facebook, because an
 * ad account spans both Meta surfaces and the operator manages it as one thing.
 */
export function AdPlatformIcon({
  platform,
  className,
}: {
  platform: AdPlatform;
  className?: string;
}) {
  if (platform === "x") return <PlatformIcon platform="x" className={className} />;

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
      className={cn("size-[16px] shrink-0", className)}
    >
      {platform === "meta" ? (
        <path d="M6.9 4.5c2.1 0 3.7 1.5 5.1 3.7 1.4-2.2 3-3.7 5.1-3.7 3.3 0 5.4 3.2 5.4 7.3 0 4.2-2.1 7.7-5.2 7.7-2.2 0-3.7-1.7-5.6-5-.5-.9-1-1.8-1.5-2.7-.6 1-1.1 1.9-1.6 2.8-1.8 3.2-3.3 4.9-5.4 4.9C2.1 19.5 0 16.1 0 12c0-4.2 2.2-7.5 5.5-7.5h1.4Zm10 2.6c-1.3 0-2.5 1.2-3.7 3.2.4.6.8 1.3 1.2 2 1.8 3 2.6 3.9 3.8 3.9 1.5 0 2.5-1.9 2.5-5 0-2.9-1-4.1-2.5-4.1ZM6.4 7.1c-1.6 0-2.7 1.7-2.7 4.5 0 2.9 1.1 4.6 2.6 4.6 1.2 0 2-.9 3.7-3.8l1.1-1.9C9.7 8.3 8.2 7.1 6.4 7.1Z" />
      ) : (
        <>
          <path d="M8.2 12a3.8 3.8 0 0 1 5.8-3.23l2.77-2.77A7.75 7.75 0 0 0 4.6 8.9l3.2 2.48c.2-.56.25-.9.4-1.38Z" opacity=".85" />
          <path d="M12 8.2c.9 0 1.72.31 2.37.83l2.78-2.78A7.72 7.72 0 0 0 12 4.25c-3.1 0-5.79 1.77-7.1 4.36l3.2 2.48A3.8 3.8 0 0 1 12 8.2Z" />
          <path d="M12 19.75c2.09 0 3.85-.69 5.13-1.87l-2.99-2.32c-.58.39-1.32.62-2.14.62a3.8 3.8 0 0 1-3.6-2.62l-3.09 2.39A7.74 7.74 0 0 0 12 19.75Z" />
          <path d="M19.6 12c0-.53-.05-1.05-.15-1.55H12v3.02h4.28a3.68 3.68 0 0 1-1.59 2.4l2.99 2.32c1.75-1.62 2.92-4 2.92-6.19Z" opacity=".7" />
        </>
      )}
    </svg>
  );
}

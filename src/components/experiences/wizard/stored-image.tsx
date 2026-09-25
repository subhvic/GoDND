"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

import {
  cachedImageUrl,
  imageUrl,
  type ImageVariant,
} from "@/lib/experience-wizard/image-db";
import { cn } from "@/lib/utils";

/**
 * A photo from the wizard's local store. Three states: loading (skeleton),
 * shown, and missing — the draft knows the photo but this browser does not
 * have its pixels (another device, or site data was cleared). Missing says so
 * plainly instead of rendering a broken-image icon.
 */
export function StoredImage({
  id,
  variant = "thumb",
  alt,
  className,
}: {
  id: string;
  variant?: ImageVariant;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null);
  const cacheKey = `${id}:${variant}`;
  const cached = cachedImageUrl(id, variant);

  useEffect(() => {
    if (cachedImageUrl(id, variant)) return;
    let live = true;
    void imageUrl(id, variant).then((url) => {
      if (live) setLoaded({ key: `${id}:${variant}`, url });
    });
    return () => {
      live = false;
    };
  }, [id, variant]);

  const url = cached ?? (loaded?.key === cacheKey ? loaded.url : undefined);

  if (url === undefined) {
    return <span aria-hidden className={cn("block size-full skeleton", className)} />;
  }

  if (url === null) {
    return (
      <span
        role="img"
        aria-label={`${alt || "Photo"} — not available on this device`}
        className={cn(
          "flex size-full flex-col items-center justify-center gap-[4px] bg-panel p-[8px] text-center text-[10.5px] leading-[1.35] text-text-muted",
          className,
        )}
      >
        <ImageOff aria-hidden className="size-[16px]" />
        Not on this device
      </span>
    );
  }

  return (
    // Object URLs from IndexedDB: next/image cannot optimise blob: sources.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className={cn("block size-full object-cover", className)} />
  );
}

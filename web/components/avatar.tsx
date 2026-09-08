"use client";

import Image from "next/image";
import { useState } from "react";
import { Avatar as AvatarTile } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Identicon } from "./identicon";

/** DESIGN.md §7 avatar sizes: 32 table · 40 row · 56 card · 64 card page · 80 profile. */
const SIZE_CLASS: Record<number, string> = {
  32: "size-8",
  40: "size-10",
  56: "size-14",
  64: "size-16",
  80: "size-20",
};

/**
 * Operator-registered image in a fixed box; identicon when there is none or it
 * fails. Third-party images go through the next/image optimizer (a wildcard
 * remote pattern in next.config.ts): /payments was pulling 1.8 MB of originals
 * from 15 hosts to paint 38px tiles, one of them a 1.3 MB PNG. The optimizer
 * re-encodes each once at the size it is drawn and serves it from this origin.
 *
 * Takes three scalars, not a row: this is a client component, so every prop is
 * serialised into the page — a whole ShelfRow must never reach it.
 *
 * The image is rendered directly rather than through Radix's `AvatarImage`:
 * Radix preloads with `new Image()` and keeps the element out of the tree until
 * that resolves, which drops it from the server-rendered HTML and makes lazy
 * loading inert. The stock `ui/avatar` root supplies the tile; the radius is
 * `rounded-lg` rather than the stock circle (DESIGN.md §3).
 */
export function Avatar({
  image,
  owner,
  id,
  size = 40,
  className,
}: {
  image: string | null;
  owner: string;
  id: number;
  /** 32 table, 40 list row, 56 card, 64 card page, 80 profile header. */
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = image && /^https?:\/\//.test(image) ? image : null;
  if (!src || failed) return <Identicon owner={owner} id={id} size={size} className={className} />;
  const sizeClass = SIZE_CLASS[size];
  return (
    <AvatarTile
      className={cn("rounded-lg border bg-secondary", sizeClass, className)}
      style={sizeClass ? undefined : { width: size, height: size }}
    >
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="aspect-square size-full object-cover"
      />
    </AvatarTile>
  );
}

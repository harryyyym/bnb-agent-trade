// Official venue / explorer / protocol marks from /public/logos. Shown only
// beside text, never as decoration. BscScan (dark glyph, transparent ground)
// sits on a white disc of the same size.

import { cn } from "@/lib/utils";

const FILES = {
  bnbchain: "/logos/bnbchain.png",
  bscscan: "/logos/bscscan.png",
  pancakeswap: "/logos/pancakeswap.png",
  aave: "/logos/aave.svg",
  venus: "/logos/venus.png",
  termix: "/logos/termix.svg",
  usdt: "/logos/usdt.png",
  bnb: "/logos/bnb.png",
} as const;

export type LogoName = keyof typeof FILES;

export const LOGO_LABEL: Record<LogoName, string> = {
  bnbchain: "BNB Chain",
  bscscan: "BscScan",
  pancakeswap: "PancakeSwap",
  aave: "Aave",
  venus: "Venus",
  termix: "TermiX",
  usdt: "USDT",
  bnb: "BNB",
};

const LIGHT_DISC: ReadonlySet<LogoName> = new Set<LogoName>(["bscscan"]);

export function Logo({
  name,
  size = 16,
  round = false,
  className,
}: {
  name: LogoName;
  /** 16 inline before a name, 18 before a USDT price, 20–24 in venue cells and rail cards. */
  size?: number;
  round?: boolean;
  className?: string;
}) {
  const src = FILES[name];
  if (LIGHT_DISC.has(name)) {
    const pad = Math.max(2, Math.floor(size / 8));
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-white", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset, exact size */}
        <img src={src} alt="" width={size - 2 * pad} height={size - 2 * pad} referrerPolicy="no-referrer" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static asset, exact size
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      aria-hidden
      referrerPolicy="no-referrer"
      className={cn("shrink-0", round ? "rounded-full" : "rounded-sm", className)}
    />
  );
}

/** Venue string → its mark (PancakeSwap, Venus, Aave, BNB); null when unknown. */
export function venueLogoName(venue: string | null | undefined): LogoName | null {
  if (!venue) return null;
  const v = venue.toLowerCase();
  if (v.includes("pancake")) return "pancakeswap";
  if (v.includes("venus")) return "venus";
  if (v.includes("aave")) return "aave";
  if (v.includes("bnb")) return "bnb";
  return null;
}

export function VenueLogo({
  venue,
  size = 16,
  className,
}: {
  venue: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const name = venueLogoName(venue);
  if (!name) return null;
  return <Logo name={name} size={size} round className={className} />;
}

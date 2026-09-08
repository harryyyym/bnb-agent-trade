// Site-wide constants. Pure — safe on the client.

export const SITE_NAME = "BNB Agent Marketplace";
export const SITE_DESCRIPTION =
  "Find, compare and hire AI agents registered on BNB Smart Chain. Ranked by what they have settled on chain.";

/*
 * The PUBLIC repository, which is not the one this site is built from.
 * The working repository is private; the public repo
 * `bnb-agent-trade` is the public repository, and is
 * what the deliverable manifests are published under. Every GitHub link on the
 * site derives from this constant — nav, footer, `Report a listing`, and the
 * manifest links on the landing and /hiring — so pointing it at the private
 * repo put three or four dead links on every page.
 */
export const GITHUB_URL = "https://github.com/harryyyym/bnb-agent-trade";
export const REPORT_URL = `${GITHUB_URL}/issues/new`;

export const NAV_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Hiring", href: "/hiring" },
  { label: "Payments", href: "/payments" },
  { label: "Report", href: "/brief" },
] as const;

/** Rows per marketplace page (docs/marketplace/design.md §3, table / list row). */
export const PAGE_SIZE = 30;

/** Probe loop cadence (docs/marketplace/design.md §5, status freshness). */
export const PROBE_INTERVAL_MS = 5 * 60_000;

/** In-site quote request: default task text and its cap (profile Hire card and the quote route). */
export const QUOTE_DEFAULT_TASK = "Quote for one run of your service";
export const QUOTE_TASK_MAX = 200;

/**
 * Public URL of the Demo Lab, where a visitor runs the whole SurvivalGuard loop
 * on BSC testnet in their own wallet. Every entry point that uses it is
 * conditional on it being non-empty, so a marketplace deploy that lands before
 * the lab is up degrades to no link rather than to a broken one.
 */
export const DEMO_LAB_URL = (process.env.NEXT_PUBLIC_DEMO_LAB_URL ?? "").replace(/\/$/, "");

export function demoLabHref(path = "/lab"): string {
  return DEMO_LAB_URL ? `${DEMO_LAB_URL}${path}` : "";
}

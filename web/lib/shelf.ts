// Server-only access to web/app/shelf.json and shelf-stats.json. Client
// components receive the LiteRow projection from toLite(), never full rows.
import "server-only";

import shelfJson from "@/app/shelf.json";
import statsJson from "@/app/shelf-stats.json";
import { displayName, railsOf, rowKey, shortDescription } from "./format";
import type { Category, ChainStats, LiteRow, ShelfRow, ShelfStats } from "./types";

export type {
  Authority,
  Category,
  CategorySlug,
  Chain,
  ChainStats,
  LiteCommerce,
  LiteRow,
  Mode,
  Operator,
  ProbeWord,
  Provenance,
  SeededDispute,
  SeededPrice,
  SeededRecord,
  Rail,
  ShelfCommerce,
  ShelfDoc,
  ShelfDocSkill,
  ShelfLinks,
  ShelfProbe,
  ShelfQuality,
  ShelfReputation,
  ShelfRow,
  ShelfService,
  ShelfStats,
  ShelfTeam,
  TeamEvidence,
  TeamPrice,
  Tier,
} from "./types";
export {
  CATEGORY_LABEL,
  CATEGORY_SLUG,
  OFFICIAL_CATEGORIES,
  SLUG_CATEGORY,
  TRACK_ORDER,
  categoryFromSlug,
  isCategory,
} from "./categories";

// Names are settled here, once, so every surface agrees: a slug is listed as
// words and keeps its registered form on `rawName` for the profile.
const ROWS = (shelfJson as unknown as ShelfRow[]).map((r) => {
  const name = displayName(r.name);
  return name === r.name ? r : { ...r, name, rawName: r.name };
});
const STATS = statsJson as unknown as ShelfStats;
const BY_KEY = new Map(ROWS.map((r) => [rowKey(r), r] as const));

/** Landing "Featured" order. */
const FEATURED_ORDER = ["SurvivalGuard", "Dark Survivor", "Pancake Ranger"];

/** All rows in backend rank order (the default "Track record" sort — never re-ranked). */
export function getRows(): readonly ShelfRow[] {
  return ROWS;
}

/** Chain-sourced rows only — what every on-chain count on the site must be derived from. */
export function getChainRows(): readonly ShelfRow[] {
  return ROWS.filter((r) => (r.provenance ?? "chain") === "chain");
}

/** The demo lane, in rank order. Synthetic records; see agents/shelf/seeded.ts. */
export function getSeededRows(): readonly ShelfRow[] {
  return ROWS.filter((r) => r.provenance === "demo");
}

export function getRow(chain: number, id: number): ShelfRow | undefined {
  return BY_KEY.get(`${chain}:${id}`);
}

export function getStats(): ShelfStats {
  return STATS;
}

/** Per-chain stats (block, registry, funnel); undefined when that chain was not built. */
export function getChainStats(chain: number): ChainStats | undefined {
  return STATS.chains[String(chain) as "56" | "97"];
}

/** Our three, in landing order: SurvivalGuard, Dark Survivor, Pancake Ranger. */
export function getFeatured(): ShelfRow[] {
  const team = ROWS.filter((r) => r.operator === "team");
  const rank = (r: ShelfRow) => {
    const i = FEATURED_ORDER.findIndex((n) => r.name.toLowerCase().startsWith(n.toLowerCase()));
    return i === -1 ? FEATURED_ORDER.length : i;
  };
  return [...team].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

export function getRowsByCategory(category: Category): ShelfRow[] {
  return ROWS.filter((r) => r.category === category);
}

/** Client-safe projection. */
export function toLite(row: ShelfRow): LiteRow {
  const skills = Array.from(
    new Set(
      (row.doc?.skills ?? [])
        .flatMap((s) => [s.name, ...(s.tags ?? [])])
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  const c = row.commerce;
  return {
    key: rowKey(row),
    id: row.id,
    chain: row.chain,
    name: row.name,
    nameSource: row.nameSource,
    descriptionShort: shortDescription(row.description, 220),
    image: row.image,
    owner: row.owner,
    wallet: row.wallet,
    endpoint: row.endpoint,
    endpointHost: row.endpointHost,
    endpointTransient: row.endpointTransient,
    category: row.category,
    categorySource: row.categorySource,
    tier: row.tier,
    probe: {
      word: row.probe.word,
      code: row.probe.code,
      latencyMs: row.probe.latencyMs,
      checkedAt: row.probe.checkedAt,
      ...(row.probe.path ? { path: row.probe.path } : {}),
    },
    mode: row.mode,
    venue: row.venue,
    x402Support: row.x402Support,
    commerce: c
      ? {
          completed: c.completed,
          completedClients: c.completedClients.length,
          clients: c.clients,
          completedVolumeU: c.completedVolumeU,
          lastCompletedAt: c.lastCompletedAt,
        }
      : null,
    commerceSelfHire: row.commerceSelfHire,
    commerceOutsideClients: row.commerceOutsideClients ?? 0,
    operator: row.operator,
    rails: railsOf(row),
    skills,
    // Rows built before the demo lane have no provenance field; they are chain rows.
    provenance: row.provenance ?? "chain",
    // Only whether a demo exists — the path, label and note stay server-side.
    hasDemo: Boolean(row.team?.demo),
    ...(row.seededNote ? { seededNote: row.seededNote } : {}),
    ...(row.demonstrates ? { demonstrates: row.demonstrates } : {}),
    ...(row.record ? { record: row.record } : {}),
    ...(row.price ? { price: row.price } : {}),
    ...(row.dispute ? { dispute: row.dispute } : {}),
  };
}

let LITE: LiteRow[] | null = null;

/** All rows projected, memoised for the process lifetime (shelf.json is static). */
export function getLiteRows(): LiteRow[] {
  if (!LITE) LITE = ROWS.map(toLite);
  return LITE;
}

// The four official categories plus "other". Pure constants — safe on the client.
import type { Category, CategorySlug } from "./types";

export const TRACK_ORDER: readonly Category[] = [
  "rebalancing",
  "grid trading",
  "yield optimisation",
  "health factor monitoring",
  "other",
];

export const OFFICIAL_CATEGORIES: readonly Category[] = TRACK_ORDER.slice(0, 4);

export const CATEGORY_SLUG: Record<Category, CategorySlug> = {
  rebalancing: "rebalancing",
  "grid trading": "grid-trading",
  "yield optimisation": "yield-optimisation",
  "health factor monitoring": "health-factor-monitoring",
  other: "other",
};

export const SLUG_CATEGORY: Record<CategorySlug, Category> = {
  rebalancing: "rebalancing",
  "grid-trading": "grid trading",
  "yield-optimisation": "yield optimisation",
  "health-factor-monitoring": "health factor monitoring",
  other: "other",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  rebalancing: "Rebalancing",
  "grid trading": "Grid trading",
  "yield optimisation": "Yield optimisation",
  "health factor monitoring": "Health factor monitoring",
  other: "Other",
};

/**
 * The category as the row's meta line says it — the full label costs 90px of a
 * line that also has to carry the venue and what the agent is allowed to do.
 */
export const CATEGORY_SHORT: Record<Category, string> = {
  rebalancing: "Rebalancing",
  "grid trading": "Grid trading",
  "yield optimisation": "Yield",
  "health factor monitoring": "Health factor",
  other: "Other",
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (TRACK_ORDER as readonly string[]).includes(v);
}

/** Accepts a slug or a verbatim category; null when neither. */
export function categoryFromSlug(s: string | null | undefined): Category | null {
  if (!s) return null;
  if (s in SLUG_CATEGORY) return SLUG_CATEGORY[s as CategorySlug];
  return isCategory(s) ? s : null;
}

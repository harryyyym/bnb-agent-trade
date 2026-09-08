// What a visitor can ask for, in their words, and the category each ask lands
// in. Pure constants and one scoring function: shared by the server (which
// builds the answers) and the client (which matches as the visitor types).
//
// The match is keyword scoring, not a model. A question either contains a word
// this file knows or it does not, so the same question always reaches the same
// category, and a reader can see the whole vocabulary by reading `keys`.
import type { Category } from "./types";

export interface Intent {
  /** Stable id, and the slug the answer links to. */
  key: string;
  category: Category;
  /** The job, in the words the marketplace tabs use, so one vocabulary runs across the site. */
  title: string;
  /** One line: what an agent in this category does. */
  sub: string;
  /** The complete ask, offered as an inline completion. */
  example: string;
  keys: readonly string[];
}

export const INTENTS: readonly Intent[] = [
  {
    key: "health-factor-monitoring",
    category: "health factor monitoring",
    title: "Watch a lending position",
    sub: "Watches a health factor and repays before it crosses",
    example: "Protect my Venus position from liquidation",
    keys: [
      "protect",
      "liquidation",
      "liquidated",
      "health",
      "factor",
      "borrow",
      "debt",
      "repay",
      "collateral",
      "venus",
      "aave",
      "safe",
      "guard",
      "monitor",
    ],
  },
  {
    key: "rebalancing",
    category: "rebalancing",
    title: "Rebalance a position",
    sub: "Moves a concentrated band as the price moves",
    example: "Keep my PancakeSwap position in range",
    keys: [
      "range",
      "rebalance",
      "rebalancing",
      "liquidity",
      "lp",
      "pool",
      "band",
      "position",
      "pancakeswap",
      "pancake",
      "concentrated",
      "wbnb",
      "recentre",
    ],
  },
  {
    key: "yield-optimisation",
    category: "yield optimisation",
    title: "Find better yield",
    sub: "Reads rates across venues and reports where to sit",
    example: "Find better yield for 2 BNB",
    keys: [
      "yield",
      "earn",
      "apy",
      "apr",
      "rate",
      "rates",
      "idle",
      "interest",
      "lend",
      "lending",
      "supply",
      "deposit",
      "stake",
      "better",
      "return",
    ],
  },
  {
    key: "grid-trading",
    category: "grid trading",
    title: "Run a grid",
    sub: "Places a grid between two prices and refills the fills",
    example: "Run a grid on BNB between two prices",
    keys: ["grid", "trade", "trading", "buy", "sell", "price", "spread", "volatility", "ladder", "levels", "swing"],
  },
];

/**
 * How well a question fits an intent. A keyword present in the question is
 * worth two, a word of the question that shares a prefix with a keyword is
 * worth one, and a question that is a fragment of the title is worth two more.
 * Words of one or two letters are ignored, so "a", "my" and "on" cannot score.
 */
export function intentScore(intent: Intent, question: string): number {
  const q = question.trim().toLowerCase();
  if (!q) return 0;
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const keys = intent.keys.reduce((total, key) => {
    if (q.includes(key)) return total + 2;
    return total + (words.some((w) => key.startsWith(w) || w.startsWith(key)) ? 1 : 0);
  }, 0);
  return keys + (intent.title.toLowerCase().includes(q) ? 2 : 0);
}

/** The best-fitting intent, or null when the question shares no vocabulary with any. */
export function matchIntent<T extends Intent>(intents: readonly T[], question: string): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const intent of intents) {
    const score = intentScore(intent, question);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

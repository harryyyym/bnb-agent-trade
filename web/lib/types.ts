// Shapes of web/app/shelf.json rows, shelf-stats.json and the client-safe
// projection. Types only — safe to import from server and client files alike.

export type Chain = 56 | 97;

export type Category =
  | "rebalancing"
  | "grid trading"
  | "yield optimisation"
  | "health factor monitoring"
  | "other";

export type CategorySlug =
  | "rebalancing"
  | "grid-trading"
  | "yield-optimisation"
  | "health-factor-monitoring"
  | "other";

export type Tier = "SETTLED ON CHAIN" | "TX ON FILE" | "ENDPOINT RESPONDS" | "IDENTITY ONLY";

/** `live` is only produced by the probe loop for the featured agents' health endpoints. */
export type ProbeWord = "live" | "responds" | "gated" | "unreachable" | "no-public";

export type Mode = "monitor" | "advise" | "execute";
export type Operator = "team" | "third-party";
export type Rail = "erc8183" | "x402";
export type Authority = "advice" | "session" | "contract" | "operator-run" | "none";
export type Tone = "green" | "fg" | "muted" | "red";

/**
 * Where a row's numbers come from. "chain" rows are built by agents/shelf/build.ts
 * from ERC-8004 and ERC-8183 on BSC; "demo" rows are authored in
 * agents/shelf/seeded.ts and their records are synthetic. The two are never added
 * into one total, and a demo row is labelled on every surface it appears on.
 */
export type Provenance = "chain" | "demo";

/** A trading record in the shape the TermiX brief asks for: win rate, window, and risk taken. */
export interface SeededRecord {
  basis: string;
  window: { from: string; to: string; days: number };
  trades: number;
  winRatePct: number;
  returnPct: number;
  maxDrawdownPct: number;
  recoveryDays: number | null;
  benchmark: { name: string; returnPct: number };
  notes: string[];
}

export interface SeededPrice {
  amount: number;
  symbol: string;
  unit: string;
}

export interface SeededDispute {
  jobs: number;
  disputed: number;
  resolvedAgainstAgent: number;
  note: string;
}

export interface ShelfProbe {
  word: ProbeWord;
  code: number | null;
  latencyMs: number | null;
  checkedAt: string;
  /** Fallback path that answered (`/health`, `/healthz`, …), when any. */
  path?: string | null;
}

export interface ShelfService {
  name: string;
  endpoint: string;
}

export interface ShelfCommerce {
  open: number;
  funded: number;
  submitted: number;
  completed: number;
  rejected: number;
  expired: number;
  /** 18-decimal integer string in U. */
  completedVolumeRaw: string;
  completedVolumeU: number;
  /** Unix seconds. */
  lastCompletedAt: number | null;
  completedJobIds: number[];
  completedClients: string[];
  /** Distinct clients across all jobs (not only completed ones). */
  clients: number;
}

export interface ShelfReputation {
  clients: number;
  count: number;
  value: number | null;
  decimals: number;
}

export interface TeamEvidence {
  label: string;
  url: string;
  mono?: string;
}

export interface TeamPrice {
  amount: string;
  symbol: string;
  unit: string;
  rail: string;
  source: string;
}

export interface ShelfDemo {
  path: string;
  label: string;
  note: string;
}

export interface ShelfTeam {
  /** A runnable demo of this agent. When set, it outranks the quote panel. */
  demo?: ShelfDemo;
  app?: string;
  statusUrl?: string;
  custody: string;
  evidence: TeamEvidence[];
  price?: TeamPrice;
  settlementTx?: string;
}

export interface ShelfLinks {
  bscscan: string;
  scan: string;
  owner: string;
}

export interface ShelfDocSkill {
  name: string;
  description: string;
  tags: string[];
}

export interface ShelfDoc {
  kind: "a2a" | "json" | "manifest" | string;
  name: string;
  url: string;
  description: string;
  skills: ShelfDocSkill[];
  /** Raw agent card / manifest text. Server only — never ships to the client. */
  raw: string;
}

export interface ShelfQuality {
  score: number;
  reasons: string[];
}

export interface ShelfRow {
  id: number;
  chain: Chain;
  name: string;
  /** The registered string where `name` was re-cased from a slug (lib/format.ts `displayName`). */
  rawName?: string;
  description: string;
  image: string | null;
  owner: string;
  wallet: string;
  endpoint: string;
  endpointHost: string;
  endpointTransient: boolean;
  services: ShelfService[];
  supportedTrust: string[];
  x402Support: boolean | null;
  active: boolean | null;
  declaredCategory: string | null;
  category: Category;
  categoryConfidence: "high" | "medium" | "low";
  categorySource: "override" | "declared" | "curated";
  categoryScores: Record<string, number>;
  venue: string | null;
  mode: Mode | null;
  modeSource: "declared" | "on-chain";
  probe: ShelfProbe;
  quality: ShelfQuality;
  commerce: ShelfCommerce | null;
  commerceMatch: "wallet" | "owner" | null;
  commerceSelfHire: boolean;
  /**
   * Distinct buyers of a completed job who were not the operator's own wallet.
   * `commerceSelfHire` says *some* job was bought by the operator; this says how
   * many were not, so a row with both (Relic Health Factor Monitor today) is
   * never reported as if every buyer had been the operator.
   */
  commerceOutsideClients: number;
  reputation: ShelfReputation | null;
  tier: Tier;
  operator: Operator;
  team?: ShelfTeam;
  links: ShelfLinks;
  metadataScheme: "data" | "http" | "ipfs" | string;
  nameSource: "on-chain" | "agent-card";
  cardUrl?: string | null;
  doc: ShelfDoc | null;
  /** Absent on rows built before the demo lane existed; treat as "chain". */
  provenance?: Provenance;
  /** Seeded rows only — rendered verbatim above every number on the profile. */
  seededNote?: string;
  /** Seeded rows only — the marketplace feature this row exists to exercise. */
  demonstrates?: string;
  record?: SeededRecord;
  price?: SeededPrice;
  dispute?: SeededDispute;
}

/** Per-chain block of shelf-stats.json (`stats.chains["97"]`, `["56"]`). */
export interface ChainStats {
  builtAt: string;
  chain: Chain;
  chainLabel: string;
  registry: string;
  block: number;
  platformHosts: Record<string, number>;
  registered: number;
  resolvedMetadata: number;
  eligible: number;
  shelved: number;
  onTracks: number;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
  byProbe: Record<string, number>;
  byConfidence: Record<string, number>;
  rejectedByReason: Record<string, number>;
  commerce?: {
    contract: string;
    jobCounter: number;
    block: number;
    providers: number;
    token: string;
  };
  reputation?: {
    contract: string;
    agentsWithFeedback: number;
  };
}

/** shelf-stats.json: totals across chains plus one ChainStats per chain. */
export interface ShelfStats {
  builtAt: string;
  /** Rows in the demo lane. Never added into `shelved`, which is chain-sourced only. */
  seeded?: number;
  seededByCategory?: Record<string, number>;
  chains: Partial<Record<"56" | "97", ChainStats>>;
  registered: number;
  resolvedMetadata: number;
  eligible: number;
  shelved: number;
  onTracks: number;
  byChain: Record<string, number>;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
  byProbe: Record<string, number>;
  byConfidence: Record<string, number>;
  /** Rows whose buyer was the operator's own wallet. */
  selfHire: number;
}

/** Commerce summary carried by the client projection. */
export interface LiteCommerce {
  completed: number;
  /** Distinct clients on completed jobs. */
  completedClients: number;
  /** Distinct clients across all jobs (what the mockups call "buyers"). */
  clients: number;
  completedVolumeU: number;
  /** Unix seconds. */
  lastCompletedAt: number | null;
}

/**
 * Client-safe projection of a ShelfRow. No full description, scores, job id
 * lists, client addresses, quality reasons or raw documents.
 */
export interface LiteRow {
  /** `${chain}:${id}` */
  key: string;
  id: number;
  chain: Chain;
  name: string;
  nameSource: "on-chain" | "agent-card";
  /** ≤ 220 chars, cut at a word boundary. */
  descriptionShort: string;
  image: string | null;
  owner: string;
  wallet: string;
  endpoint: string;
  endpointHost: string;
  endpointTransient: boolean;
  category: Category;
  categorySource: "override" | "declared" | "curated";
  tier: Tier;
  probe: ShelfProbe;
  mode: Mode | null;
  venue: string | null;
  x402Support: boolean | null;
  commerce: LiteCommerce | null;
  commerceSelfHire: boolean;
  /** Distinct completed-job buyers that were not the operator's own wallet. */
  commerceOutsideClients: number;
  operator: Operator;
  rails: Rail[];
  /** Lower-cased skill names and tags, deduped — for search. */
  skills: string[];
  provenance: Provenance;
  /** This agent has a runnable demo; the row shows a chip and the profile leads with it. */
  hasDemo?: boolean;
  seededNote?: string;
  demonstrates?: string;
  record?: SeededRecord;
  price?: SeededPrice;
  dispute?: SeededDispute;
}

// ---------------------------------------------------------------- live data

export interface ProbeResult {
  word: ProbeWord;
  code: number | null;
  latencyMs: number | null;
  checkedAt: string;
  path?: string;
}

export interface ProbeSnapshot {
  checkedAt: string | null;
  source: "loop" | "build";
  /** key `${chain}:${id}` */
  results: Record<string, ProbeResult>;
}

export interface SettledJob {
  chain: Chain;
  jobId: number;
  provider: string;
  client: string;
  /** Decimal string in U ("2.00"); empty string when not known. */
  budgetU: string;
  completedAt: string | null;
  agent: { id: number; chain: number; name: string } | null;
  selfHire: boolean;
  tx?: string;
}

export type QuoteResult =
  | {
      ok: true;
      rail: "erc8183";
      fetchedAt: string;
      endpoint: string;
      summary: {
        price?: string;
        token?: string;
        expiresAt?: string;
        provider?: string;
        signature?: string;
        terms?: Record<string, unknown>;
      };
      raw: unknown;
    }
  | { ok: false; reason: string; status?: number };

export type X402Result =
  | {
      ok: true;
      fetchedAt: string;
      endpoint: string;
      terms: {
        amount?: string;
        asset?: string;
        network?: string;
        payTo?: string;
        scheme?: string;
        description?: string;
      };
      raw: unknown;
    }
  | { ok: false; reason: string; status?: number };

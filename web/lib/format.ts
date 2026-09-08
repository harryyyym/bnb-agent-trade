// Pure formatting and derivation helpers. No server-only import: usable from
// client components. Every number here binds to a field; missing renders "—".
import { CATEGORY_LABEL, CATEGORY_SHORT } from "./categories";
import type {
  Authority,
  Chain,
  LiteRow,
  Mode,
  ProbeResult,
  ProbeWord,
  Rail,
  ShelfDoc,
  ShelfProbe,
  ShelfRow,
  ShelfTeam,
  Tier,
  Tone,
} from "./types";

export const DASH = "–";

// ---------------------------------------------------------------- chains

export const IDENTITY_REGISTRY: Record<Chain, string> = {
  97: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  56: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
};

export function isChain(n: unknown): n is Chain {
  return n === 56 || n === 97;
}

export function chainLabel(chain: number): string {
  if (chain === 56) return "BSC mainnet";
  if (chain === 97) return "BSC testnet";
  return `chain ${chain}`;
}

export function explorerBase(chain: number): string {
  return chain === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com";
}

/** The ERC-8004 identity registry contract on BscScan — the one place every id is readable. */
export function registryUrl(chain: number): string {
  return `${explorerBase(chain)}/address/${IDENTITY_REGISTRY[isChain(chain) ? chain : 97]}`;
}

export function rowKey(row: { chain: number; id: number }): string {
  return `${row.chain}:${row.id}`;
}

export function agentHref(row: { chain: number; id: number }): string {
  return `/agents/${row.chain}/${row.id}`;
}

/** The profile's Hire card, where the signed-quote control lives. */
export function hireHref(row: { chain: number; id: number }): string {
  return `${agentHref(row)}#hire`;
}

/**
 * Parses `/agents/[chain]/[id]` params; null unless both are the canonical
 * decimal spelling (`97`, `2009` — not `0x61`, `097`, `97.0`), so one agent
 * has exactly one URL and one ISR entry.
 */
export function parseAgentParams(chain: string, id: string): { chain: Chain; id: number } | null {
  if (!/^\d+$/.test(chain) || !/^\d+$/.test(id)) return null;
  const c = Number(chain);
  const i = Number(id);
  if (!isChain(c) || !Number.isSafeInteger(i)) return null;
  if (String(c) !== chain || String(i) !== id) return null;
  return { chain: c, id: i };
}

export interface AgentLinks {
  /** Identity registry contract on BscScan. */
  registry: string;
  /** This token id on the registry, on BscScan. */
  bscscan: string;
  owner: string;
  /** null when the wallet is the owner. */
  wallet: string | null;
  /** null when the row has no public endpoint. */
  endpoint: string | null;
  tx: (hash: string) => string;
  address: (addr: string) => string;
}

export function links(row: {
  chain: number;
  id: number;
  owner: string;
  wallet?: string | null;
  endpoint?: string | null;
}): AgentLinks {
  const base = explorerBase(row.chain);
  const registry = IDENTITY_REGISTRY[isChain(row.chain) ? row.chain : 97];
  const sameWallet = !row.wallet || row.wallet.toLowerCase() === row.owner.toLowerCase();
  return {
    registry: registryUrl(row.chain),
    bscscan: `${base}/token/${registry}?a=${row.id}`,
    owner: `${base}/address/${row.owner}`,
    wallet: sameWallet ? null : `${base}/address/${row.wallet}`,
    endpoint: row.endpoint && /^https?:\/\//.test(row.endpoint) ? row.endpoint : null,
    tx: (hash) => `${base}/tx/${hash}`,
    address: (addr) => `${base}/address/${addr}`,
  };
}

// ---------------------------------------------------------------- numbers

const INT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const TWO = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function short(addr: string | null | undefined): string {
  if (!addr || addr.length < 12) return addr || DASH;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtInt(n: number | bigint | null | undefined): string {
  if (n === null || n === undefined || (typeof n === "number" && !Number.isFinite(n))) return DASH;
  return INT.format(n);
}

/** Two-decimal number with grouping; "—" when missing. */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return TWO.format(n);
}

/** 18-decimal integer (bigint or decimal string) → "2.00 U". */
export function fmtU(raw: bigint | string | null | undefined, decimals = 18): string {
  if (raw === null || raw === undefined || raw === "") return DASH;
  let v: bigint;
  try {
    v = typeof raw === "bigint" ? raw : BigInt(raw);
  } catch {
    return DASH;
  }
  // No bigint literals: tsconfig targets ES2017.
  const ZERO = BigInt(0);
  const HUNDRED = BigInt(100);
  const neg = v < ZERO;
  if (neg) v = -v;
  const scale = BigInt(10) ** BigInt(decimals);
  // Round to cents.
  const cents = (v * HUNDRED + scale / BigInt(2)) / scale;
  const whole = cents / HUNDRED;
  const frac = (cents % HUNDRED).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${INT.format(whole)}.${frac} U`;
}

/**
 * Already-decimal U amount (e.g. commerce.completedVolumeU) → "30.00 U".
 *
 * Two decimals except below a cent, where they would render every real testnet
 * payment as "0.00 U" — a settled job for 0.002 U reading as nothing paid is
 * the opposite of what the number is there to show.
 */
export function fmtUAmount(u: number | null | undefined): string {
  if (u === null || u === undefined || !Number.isFinite(u)) return DASH;
  if (u !== 0 && Math.abs(u) < 0.01) {
    return `${u.toFixed(5).replace(/0+$/, "").replace(/\.$/, "")} U`;
  }
  return `${TWO.format(u)} U`;
}

// ---------------------------------------------------------------- dates

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null;
    // Unix seconds below 1e12, milliseconds above.
    return new Date(input < 1e12 ? input * 1000 : input);
  }
  const t = Date.parse(input);
  return Number.isNaN(t) ? null : new Date(t);
}

/** "5 Sep 2026" (UTC). */
export function fmtDate(input: string | number | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return DASH;
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "5 Sep 2026, 05:54 UTC". */
export function fmtDateTime(input: string | number | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return DASH;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${fmtDate(d)}, ${hh}:${mm} UTC`;
}

/** "just now" | "2 min ago" | "3 h ago" | "2 days ago". */
export function ago(input: string | number | Date | null | undefined, now: number = Date.now()): string {
  const d = toDate(input);
  if (!d) return DASH;
  const s = Math.max(0, Math.floor((now - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** "checked 2 min ago". Compute on the server (or pass `now`) to keep SSR and CSR in step. */
export function relTime(input: string | number | Date | null | undefined, now: number = Date.now()): string {
  const a = ago(input, now);
  return a === DASH ? "not checked" : `checked ${a}`;
}

/**
 * "Status checked 2 min ago" when the probe loop has run; build-time results
 * are labelled with their date instead.
 */
export function statusChecked(
  checkedAt: string | null | undefined,
  source: "loop" | "build",
  now: number = Date.now(),
): string {
  if (!checkedAt) return "Status not checked yet";
  return source === "loop" ? `Status checked ${ago(checkedAt, now)}` : `Status checked ${fmtDateTime(checkedAt)}`;
}

/** One chain and the block its data was read at, for the footer line. */
export interface ChainBlock {
  chain: number;
  block: number | null | undefined;
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The one footer line per page: probe freshness, block(s), affiliation.
 * `chain` + `block` for one chain (profile); `chains` for a page spanning
 * several ("read from BSC mainnet 56 at block N and BSC testnet 97 at block M").
 */
export function footerLine(
  opts: { checkedAt: string | null | undefined; source: "loop" | "build"; now?: number } & (
    | { chain: number; block: number | null | undefined }
    | { chains: ChainBlock[] }
  ),
): string {
  const now = opts.now ?? Date.now();
  const probe = opts.checkedAt
    ? `Endpoints are checked every 5 minutes; last check ${
        opts.source === "loop" ? ago(opts.checkedAt, now) : fmtDateTime(opts.checkedAt)
      }.`
    : "Endpoints are checked every 5 minutes.";
  const chains: ChainBlock[] = "chains" in opts ? opts.chains : [{ chain: opts.chain, block: opts.block }];
  const read = chains.map((c) =>
    c.block ? `${chainLabel(c.chain)} ${c.chain} at block ${fmtInt(c.block)}` : `${chainLabel(c.chain)} ${c.chain}`,
  );
  const chain = read.length ? `On-chain data read from ${joinAnd(read)}.` : "";
  return [probe, chain, "Third-party agents are listed from the public ERC-8004 registry and are not affiliated with this site."]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------- text

/** First sentence, cut at a word boundary past `n` chars, always ends in "." or "…". */
export function firstSentence(text: string, n = 110): string {
  let s = text.replace(/\s+/g, " ").split(". ")[0].trim();
  if (s.length > n) {
    const cut = s.slice(0, n);
    const i = cut.lastIndexOf(" ");
    s = (i > 0 ? cut.slice(0, i) : cut) + "…";
  }
  s = s.replace(/\.+$/, "");
  return s.endsWith("…") ? s : `${s}.`;
}

/** ≤ n chars at a word boundary, "…" when cut. */
export function shortDescription(text: string, n = 220): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(" ");
  return `${(i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/**
 * The one self-hire sentence, no longer shown anywhere. It was shown as
 * a tooltip on a settled-job number and as the small secondary line under it,
 * on the featured cards, the marketplace rows, the payments list, the profile
 * and the landing settlement strip — one string, one wording.
 */
export const SELF_HIRE_NOTE = "buyer was the operator's own wallet";

/** Provenance for a settled-job count, shown as its `title`. */
export function jobsTitle(settled: boolean): string {
  return settled
    ? "completed ERC-8183 jobs with this agent as provider"
    : "no settled jobs on the ERC-8183 commerce contract";
}

/** Lower-cased haystack for the marketplace search box. */
export function searchText(row: LiteRow): string {
  return [
    row.name,
    `#${row.id}`,
    row.descriptionShort,
    row.venue ?? "",
    row.mode ?? "",
    CATEGORY_LABEL[row.category],
    row.endpointHost,
    row.owner,
    ...row.skills,
  ]
    .join(" ")
    .toLowerCase();
}

// ---------------------------------------------------------------- hiring model

type RailSource = Pick<ShelfRow, "operator" | "x402Support" | "services" | "supportedTrust"> & {
  team?: ShelfTeam | null;
  doc?: ShelfDoc | null;
};

function skillText(doc: ShelfDoc | null | undefined): string {
  return (doc?.skills ?? [])
    .flatMap((s) => [s.name, ...(s.tags ?? [])])
    .join(" ")
    .toLowerCase();
}

/**
 * Rails inferred from the agent card only:
 * `negotiate` / `notify_funded` skills or `erc8183` services → ERC-8183 escrow;
 * `x402` services or `x402Support` → x402 pay per call. The featured rows take escrow.
 */
export function railsOf(row: RailSource): Rail[] {
  const skills = skillText(row.doc);
  const svc = row.services.map((s) => s.name).join(" ").toLowerCase();
  const trust = (row.supportedTrust ?? []).join(" ").toLowerCase();
  const out: Rail[] = [];
  if (
    row.operator === "team" ||
    /negotiat|notify_funded|job is funded|funded job|8183/.test(skills) ||
    /8183/.test(svc) ||
    /8183/.test(trust)
  ) {
    out.push("erc8183");
  }
  if (Boolean(row.team?.price) || row.x402Support === true || /x402/.test(svc)) out.push("x402");
  return out;
}

export const RAIL_LABEL: Record<Rail, string> = {
  erc8183: "ERC-8183 escrow",
  x402: "x402 pay per call",
};

export function railLabel(rail: Rail): string {
  return RAIL_LABEL[rail];
}

type AuthoritySource = Pick<ShelfRow, "mode" | "description" | "supportedTrust"> & {
  team?: ShelfTeam | null;
  doc?: ShelfDoc | null;
};

function sessionLike(row: AuthoritySource): boolean {
  const text = [row.description, ...(row.supportedTrust ?? []), skillText(row.doc)].join(" ").toLowerCase();
  return /grantsession|session|altana/.test(text) || (/permission/.test(text) && /revoke/.test(text));
}

/** Authority model from `mode`, team custody and the agent's own words. */
export function authorityOf(row: AuthoritySource): Authority {
  if (row.mode === "advise") return "advice";
  if (row.mode !== "execute") return "none";
  const custody = row.team?.custody?.toLowerCase() ?? "";
  if (/contract-enforced/.test(custody)) return "contract";
  if (/operator-run|own funds/.test(custody)) return "operator-run";
  return sessionLike(row) ? "session" : "operator-run";
}

export const AUTHORITY_LABEL: Record<Authority, string> = {
  advice: "Advice",
  session: "Session",
  contract: "Contract",
  "operator-run": "Operator-run",
  none: "Monitoring",
};

type StepsSource = AuthoritySource & Pick<ShelfRow, "operator" | "name">;

/** Profile Hire steps. The featured three carry hand-written steps matching their real flows. */
export function hireSteps(row: StepsSource): string[] {
  if (row.operator === "team") {
    if (/pancake ranger/i.test(row.name)) {
      return [
        "Fund an ERC-8183 job for the agent wallet, or pay per call over x402",
        "The agent runs its own PancakeSwap V3 position and delivers a report",
        "Approve the deliverable, escrow pays out; nothing of yours moves",
      ];
    }
    if (/survivalguard/i.test(row.name)) {
      return [
        "Enroll your Aave V3 position and deposit a repay buffer into the guard contract",
        "The contract can only repay your own debt from that buffer; the keeper triggers it when your health factor drops",
        "Withdraw the buffer any time; also hireable through ERC-8183",
      ];
    }
    if (/dark survivor/i.test(row.name)) {
      return [
        "Set a watch on any wallet",
        "Alerts arrive on Telegram, metered per use",
        "No authority over funds is ever needed",
      ];
    }
  }
  if (row.mode === "monitor") {
    return [
      "Pay, negotiate an ERC-8183 quote and fund the job, or pay per call",
      "Receive the report or alerts",
      "No authority over your funds is needed",
    ];
  }
  if (row.mode === "execute" && sessionLike(row)) {
    return [
      "Grant the agent's key a session on your wallet: allowed contracts, spend cap, expiry",
      "Pay, fund an ERC-8183 job or pay per call",
      "It acts within the bound; every action is a BSC transaction. Revoke the session in one transaction",
    ];
  }
  if (row.mode === "execute") {
    return [
      "Pay, fund an ERC-8183 job or pay per call",
      "The agent executes with its own wallet within the limits it publishes",
      "Approve the deliverable; each action is a BSC transaction you can open",
    ];
  }
  return [
    "Pay, negotiate an ERC-8183 quote and fund the job, or pay per call",
    "Receive the plan or ready-to-broadcast calldata",
    "Sign and broadcast it yourself, nothing moves without your signature",
  ];
}

// ---------------------------------------------------------------- words

export function isReachable(word: ShelfProbe["word"] | ProbeResult["word"]): boolean {
  return word === "live" || word === "responds" || word === "gated";
}

/**
 * Status word. `live` is green and reserved for request-time
 * reads of the featured agents' health endpoints; `responds` is foreground, never green.
 */
export function statusWord(
  probe: ShelfProbe | ProbeResult,
  live?: boolean,
): { word: string; tone: Tone; title: string } {
  const lat = probe.latencyMs !== null && probe.latencyMs !== undefined ? `${fmtInt(probe.latencyMs)} ms` : null;
  const when = probe.checkedAt ? fmtDateTime(probe.checkedAt) : null;
  const title = `probe, ${[when, lat].filter(Boolean).join(", ") || "not recorded"}`;
  if (live || probe.word === "live") {
    return { word: "live", tone: "green", title: `health endpoint read ${when ? `${when}` : "at request time"}${lat ? `, ${lat}` : ""}` };
  }
  switch (probe.word) {
    case "responds":
      return { word: probe.code ? `responds (${probe.code})` : "responds", tone: "fg", title };
    case "gated":
      return { word: probe.code ? `gated (${probe.code})` : "gated", tone: "muted", title };
    case "no-public":
      return { word: "no public endpoint", tone: "muted", title: "not probed, no public endpoint" };
    default:
      return { word: probe.code ? `unreachable (${probe.code})` : "unreachable", tone: "red", title };
  }
}

export function toneClass(tone: Tone): string {
  switch (tone) {
    case "green":
      return "text-success";
    case "red":
      return "text-destructive";
    case "muted":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

/** Evidence word: grey ramp only, never coloured. */
export function evidenceWord(tier: Tier): { word: Tier; tone: "fg70" | "muted"; title: string } {
  switch (tier) {
    case "SETTLED ON CHAIN":
      return { word: tier, tone: "fg70", title: "at least one completed ERC-8183 job with this agent's wallet as provider" };
    case "TX ON FILE":
      return { word: tier, tone: "fg70", title: "transactions on file for this agent" };
    case "ENDPOINT RESPONDS":
      return { word: tier, tone: "muted", title: "the endpoint answered the probe" };
    default:
      return { word: tier, tone: "muted", title: "ERC-8004 identity only" };
  }
}

export function evidenceClass(tone: "fg70" | "muted"): string {
  return tone === "fg70" ? "text-foreground" : "text-muted-foreground";
}

// ---------------------------------------------------------------- proof

/**
 * The four claims a marketplace row makes about itself, every one of them
 * checkable by the reader without trusting this site. They are not a ladder: the gaps carry the meaning — an agent with
 * thirty settled jobs and a dead endpoint reads `PAID 3RD RAIL` with `ANSWERS`
 * dim, which is exactly what it is.
 */
export type ProofKey = "answers" | "paid" | "third" | "rail";

export const PROOF_ORDER: readonly ProofKey[] = ["answers", "paid", "third", "rail"];

/** The word rendered in the row. Each one is the check's own name, so the column needs no legend. */
export const PROOF_WORD: Record<ProofKey, string> = {
  answers: "ANSWERS",
  paid: "PAID",
  third: "3RD",
  rail: "RAIL",
};

export const PROOF_TITLE: Record<ProofKey, string> = {
  answers: "answers, the endpoint replied to the last check",
  paid: "paid, at least one ERC-8183 job has settled with this agent as the provider",
  third: "3rd, at least one buyer other than the provider",
  rail: "rail, the agent card declares ERC-8183 escrow or x402 pay per call",
};

/** The one sentence that states the default order, printed above the list. */
export const PROOF_RULE =
  "Ordered by proof: answers now · has been paid · paid by a third party · payment rail declared, then how many it has sold, then response time.";

/** The same rule where there is no room for it (below sm). */
export const PROOF_RULE_SHORT = "Ordered by the four proof checks, then sold, then response time.";

export interface ProofSource {
  probe: Pick<ShelfProbe, "word"> | Pick<ProbeResult, "word">;
  commerce: { completed: number } | null;
  commerceOutsideClients: number;
  rails: readonly Rail[];
}

export type Proof = Record<ProofKey, boolean> & { count: number };

export function proofOf(row: ProofSource): Proof {
  const answers = row.probe.word === "responds" || row.probe.word === "live";
  const paid = (row.commerce?.completed ?? 0) > 0;
  const third = row.commerceOutsideClients > 0;
  const rail = row.rails.length > 0;
  return { answers, paid, third, rail, count: Number(answers) + Number(paid) + Number(third) + Number(rail) };
}

/**
 * `Hire →` only when the endpoint answered its last check **and** a payment rail
 * is declared — which is exactly when the profile's Hire card can produce a
 * signed ERC-8183 quote or read 402 terms on demand. Everything else says
 * `Open →`; the word never promises something the next page cannot do.
 */
export function canHire(row: ProofSource): boolean {
  return (row.probe.word === "responds" || row.probe.word === "live") && row.rails.length > 0;
}

/**
 * `Testnet · Health factor · Venus · Advise, you sign` — the chain leads the
 * meta line rather than sitting on the name as a badge: it is one of two values
 * on every row, and as a badge it cost the name 70px and pushed the featured
 * SurvivalGuard to "SurvivalGua…" beside its other two badges. A seeded row
 * has no chain and says so on the name instead (see below).
 */
/**
 * The dot-separated facts under an agent's name. `max` drops whole segments from
 * the end until the line fits, because the alternative — letting CSS truncate it
 * — cuts a segment in half ("· Advise, yo…"), and half a fact is worse than one
 * fact fewer. The first segment is always kept, however long it is.
 */
export function metaLine(row: LiteRow, max?: number): string {
  const chain = row.provenance === "demo" ? null : row.chain === 56 ? "Mainnet" : "Testnet";
  const parts = [chain, CATEGORY_SHORT[row.category], row.venue, row.mode ? modeLabel(row.mode) : null].filter(
    (p): p is string => Boolean(p),
  );
  if (max === undefined) return parts.join(" · ");
  const kept = [parts[0] ?? ""];
  for (const part of parts.slice(1)) {
    if (kept.join(" · ").length + 3 + part.length > max) break;
    kept.push(part);
  }
  return kept.join(" · ");
}

/**
 * The self-hire disclosure, in the two shapes the copy rules
 * requires, and in one place so no surface can invent a third.
 *
 * `commerceSelfHire` means only that *some* completed job was bought by the
 * operator. Exactly one listed agent has that **and** a genuine third-party
 * buyer, so a surface that keys the sentence off the flag alone tells that
 * agent's readers every buyer was the operator — the one thing §5 forbids the
 * site to say about a stranger's record. `short` is the three-word form for a
 * narrow column; `title` is the sentence, and is absent on the mixed shape
 * because SELF_HIRE_NOTE would be false there. Use `selfHireSentence()` where
 * there is room for prose.
 */
export function soldNote(row: {
  commerce: { completed: number } | null;
  commerceSelfHire: boolean;
  commerceOutsideClients: number;
}): { short: string; title?: string } | null {
  // The self-hire disclosure is no longer shown anywhere on the site; the ranking rule that sorts operator-bought rows below
  // third-party-paid rows still runs in the shelf builder.
  void row;
  return null;
}

/**
 * The same disclosure as a sentence, for the profile and any other surface with
 * room for one. Reads the buyers, never the
 * flag, so the mixed shape is described as what it is.
 */
export function selfHireSentence(row: { commerceSelfHire: boolean; commerceOutsideClients: number }): string | null {
  void row;
  return null;
}

/**
 * Distinct buyers. `completedClients` is the addresses behind the completed
 * jobs and is the number to show; eight listed agents settle more jobs than the
 * builder keeps addresses for, and for those `clients` is the same fact read
 * from the contract's own counter. Missing is `—`, never 0.
 */
export function buyersOf(row: { commerce: { completed: number; completedClients: number; clients: number } | null }): number | null {
  const c = row.commerce;
  if (!c || c.completed === 0) return null;
  return c.completedClients || c.clients || null;
}

/** Latency only where the endpoint actually answered; a failure's timing is not a response time. */
export function answeredLatency(probe: Pick<ShelfProbe, "word" | "latencyMs">): number | null {
  return isReachable(probe.word) && probe.latencyMs !== null && probe.latencyMs !== undefined
    ? probe.latencyMs
    : null;
}

// ---------------------------------------------------------------- facets

/**
 * Venue as a buyer says it, not as the registry spells it. `venue` carries nine
 * raw strings ("PancakeSwap + Venus", "PancakeSwap V3"); a select of those made
 * the catalogue look four agents deep on Venus when it is thirty-eight. Each
 * facet matches any row whose venue names it, so a two-venue agent appears
 * under both.
 */
export const VENUE_FACETS = [
  { key: "venus", label: "Venus", match: /venus/i },
  { key: "pancakeswap", label: "PancakeSwap", match: /pancakeswap/i },
  { key: "aave", label: "Aave V3", match: /aave/i },
  { key: "lista", label: "Lista", match: /lista/i },
  { key: "multi", label: "Multi-venue", match: /multi-venue/i },
  { key: "wallet", label: "Any wallet", match: /any wallet/i },
] as const;

export type VenueKey = (typeof VENUE_FACETS)[number]["key"];

export function isVenueKey(v: unknown): v is VenueKey {
  return VENUE_FACETS.some((f) => f.key === v);
}

export function venueLabel(key: VenueKey): string {
  return VENUE_FACETS.find((f) => f.key === key)!.label;
}

export function matchesVenue(venue: string | null, key: VenueKey | null): boolean {
  if (!key) return true;
  if (!venue) return false;
  return VENUE_FACETS.find((f) => f.key === key)!.match.test(venue);
}

/**
 * `mode` in the words a buyer decides on. This is the highest-stakes question
 * anyone asks a marketplace — whether the thing will touch their position — so
 * it is a filter, a column and a comparison row, never a bare enum.
 */
export const MODE_ORDER: readonly Mode[] = ["monitor", "advise", "execute"];

export const MODE_LABEL: Record<Mode, string> = {
  monitor: "Watch only",
  advise: "Advise, you sign",
  execute: "Act for you",
};

export const MODE_TITLE: Record<Mode, string> = {
  monitor: "watch only, it reports; it never needs authority over your funds",
  advise: "advise, it returns a plan or calldata; you sign and broadcast it",
  execute: "act for you, it executes, inside a bound you grant or with its own wallet",
};

export function modeLabel(mode: Mode | null): string {
  return mode ? MODE_LABEL[mode] : "Not declared";
}

export const RAIL_ORDER: readonly Rail[] = ["erc8183", "x402"];

// ---------------------------------------------------------------- relevance

/**
 * Search ranking. `matchesQuery` decides *whether* a row matches; this decides
 * where it lands. A name match must beat a description match: typing "venus"
 * used to put an agent with no "Venus" in its name at the top of forty-eight
 * results, in an order the page could not explain.
 */
export function queryScore(row: LiteRow, q: string): number {
  if (!q) return 0;
  const name = row.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  const facets = [row.venue ?? "", row.mode ?? "", CATEGORY_LABEL[row.category]].join(" ").toLowerCase();
  if (facets.includes(q)) return 40;
  if (row.descriptionShort.toLowerCase().includes(q)) return 20;
  return 10;
}

/** Probe words in the order the status disc treats them. */
export function statusDot(word: ProbeWord): "green-solid" | "green-ring" | "muted-ring" | "red-solid" {
  switch (word) {
    case "live":
      return "green-solid";
    case "responds":
      return "green-ring";
    case "unreachable":
      return "red-solid";
    default:
      return "muted-ring";
  }
}

/**
 * The name a row is listed under. A registry name that arrives as a lowercase
 * slug — `healthfactor-agent`, `b8xrebal-agent`, `gridtrader` — is the
 * operator's, but on a page it reads as an id the site failed to resolve, and
 * four of them in a row on marketplace page 1 read as a half-finished import.
 * A slug becomes words: separators to spaces, each word capitalised. A name
 * with a space or a capital in it is theirs verbatim. The registered string is
 * kept on `rawName` and shown on the profile, so nothing is hidden.
 */
export function displayName(name: string): string {
  const s = name.trim();
  if (!s || /\s/.test(s) || /[A-Z]/.test(s)) return s;
  return s
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

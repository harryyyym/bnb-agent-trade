// One GET against an agent's paid endpoint to read its HTTP 402 terms. Handles
// x402 v1/v2 JSON bodies, the PAYMENT-REQUIRED / X-PAYMENT-REQUIRED header
// (base64 JSON), the MPP `WWW-Authenticate: Payment …` challenge and loose
// {price, token, recipient} bodies. Pure: no shelf import.
import { formatUnits } from "viem";
import { BODY_CAP, CALL_TIMEOUT_MS, errorName, fetchManual, parseJson, readCapped, safeUrl } from "./probe";
import type { X402Result } from "./types";

export interface X402Source {
  endpoint: string;
  /** Fallback path that answered at build time (row.probe.path). */
  path?: string | null;
  services?: readonly { name: string; endpoint: string }[];
}

type Obj = Record<string, unknown>;
type Terms = Extract<X402Result, { ok: true }>["terms"];
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined;

/**
 * Known settlement tokens (lower-cased address → symbol, decimals). BNB Chain
 * first; the ERC-8183 payment token `U` on both chains; then the USDC
 * deployments x402 gateways quote most often, so their amounts read in units.
 */
export const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0x55d398326f99059ff775485246999027b3197955": { symbol: "USDT", decimals: 18 },
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { symbol: "USDC", decimals: 18 },
  "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": { symbol: "USD1", decimals: 18 },
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": { symbol: "BUSD", decimals: 18 },
  "0x337610d27c682e347c9cd60bd4b3b107c9d34ddd": { symbol: "TEST_USDT", decimals: 18 },
  "0xc70b8741b8b07a6d61e54fd4b20f22fa648e5565": { symbol: "U", decimals: 18 }, // BSC testnet
  "0xce24439f2d9c6a2289f741120fe202248b666666": { symbol: "U", decimals: 18 }, // BSC mainnet
  "0x0000000000000000000000000000000000000000": { symbol: "BNB", decimals: 18 },
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", decimals: 6 }, // Base
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6 }, // Ethereum
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", decimals: 6 }, // Arbitrum
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": { symbol: "USDC", decimals: 6 }, // Optimism
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": { symbol: "USDC", decimals: 6 }, // Polygon
  "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": { symbol: "USDC", decimals: 6 }, // Avalanche
};
const BSC_SYMBOLS = new Set(["USDT", "USDC", "USD1", "BUSD", "BNB", "WBNB", "TEST_USDT", "U"]);
const BSC_NETWORK = /^(bsc|bsc-testnet|bsc-mainnet|bnb|bnb-chain|binance(-smart-chain)?|eip155:(56|97)|56|97)$/i;

/** ERC-20 decimals are a uint8; anything past 36 is not a token, and formatUnits is quadratic in it. */
export const MAX_DECIMALS = 36;

export function saneDecimals(v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_DECIMALS ? v : undefined;
}

/** Human units when the asset is a known token (or a known symbol on BSC); otherwise the raw amount. */
export function humanAmount(
  raw: string | undefined,
  asset: string | undefined,
  network: string | undefined,
  hint: { symbol?: string; decimals?: number } = {},
): { amount?: string; asset?: string } {
  const known = asset ? KNOWN_TOKENS[asset.toLowerCase()] : undefined;
  const symbol = known?.symbol ?? hint.symbol ?? (asset && BSC_SYMBOLS.has(asset.toUpperCase()) ? asset.toUpperCase() : undefined);
  const assetOut = symbol ?? asset;
  if (!raw) return { asset: assetOut };
  if (!/^\d+$/.test(raw)) return { amount: raw, asset: assetOut };
  let decimals = known?.decimals ?? saneDecimals(hint.decimals);
  if (decimals === undefined && symbol && BSC_SYMBOLS.has(symbol) && (!network || BSC_NETWORK.test(network))) decimals = 18;
  // The raw amount is untrusted too: past 78 digits it is not a uint256.
  if (decimals === undefined || raw.length > 78) return { amount: raw, asset: assetOut };
  try {
    return { amount: formatUnits(BigInt(raw), decimals), asset: assetOut };
  } catch {
    return { amount: raw, asset: assetOut };
  }
}

function b64(s: string): string | undefined {
  try {
    return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

/** x402 v1/v2 body or decoded header: { x402Version, accepts: [...] } */
function fromAccepts(j: Obj): Terms | null {
  const accepts = Array.isArray(j.accepts) ? j.accepts.filter(isObj) : [];
  if (accepts.length === 0) return null;
  const bsc = accepts.find((a) => str(a.network) && BSC_NETWORK.test(str(a.network) as string));
  const a = bsc ?? accepts[0];
  const extra = isObj(a.extra) ? a.extra : {};
  const network = str(a.network);
  const { amount, asset } = humanAmount(str(a.maxAmountRequired ?? a.amount ?? a.price), str(a.asset), network, {
    symbol: str(extra.name ?? extra.symbol),
    decimals: saneDecimals(extra.decimals),
  });
  return {
    amount,
    asset,
    network,
    payTo: str(a.payTo ?? a.recipient),
    scheme: str(a.scheme),
    description: str(a.description ?? j.error ?? j.description ?? (isObj(j.resource) ? j.resource.description : undefined)),
  };
}

/** MPP challenge: `Payment id="…", realm="…", method="evm", intent="charge", request="<base64url json>"`. */
function fromPaymentChallenge(header: string): Terms | null {
  const m = /(?:^|,\s*)Payment\s+(.*)$/i.exec(header);
  if (!m) return null;
  const params: Record<string, string> = {};
  for (const p of m[1].matchAll(/([a-zA-Z0-9_-]+)="((?:[^"\\]|\\.)*)"/g)) params[p[1].toLowerCase()] = p[2].replace(/\\(.)/g, "$1");
  const req = params.request ? parseJson(b64(params.request) ?? "") : undefined;
  if (!isObj(req)) return null;
  const details = isObj(req.methodDetails) ? req.methodDetails : {};
  const chainId = str(details.chainId ?? req.chainId);
  const network = chainId ? `eip155:${chainId}` : str(req.network);
  const { amount, asset } = humanAmount(str(req.amount), str(req.currency ?? req.token ?? req.asset), network);
  return {
    amount,
    asset,
    network,
    payTo: str(req.recipient ?? req.payTo),
    scheme: [params.method, params.intent].filter(Boolean).join("/") || undefined,
    description: params.description,
  };
}

const PRICE_KEYS = ["price", "amount", "maxAmountRequired", "cost", "fee"];
const TOKEN_KEYS = ["token", "currency", "asset", "tokenAddress", "paymentToken"];
const PAYTO_KEYS = ["payTo", "recipient", "receiver", "address", "to", "wallet"];
const NET_KEYS = ["network", "chain", "chainId"];
const NEST = ["payment", "x402", "paymentRequirements", "payment_required", "terms", "data", "quote"];

/** Loose MPP / custom shapes: {price, token, recipient} at the top or one level down. */
function fromLoose(j: Obj): Terms | null {
  const pick = (o: Obj, keys: string[]) => {
    for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
    return undefined;
  };
  const scopes: Obj[] = [j, ...NEST.map((k) => j[k]).filter(isObj)];
  for (const o of scopes) {
    const price = pick(o, PRICE_KEYS);
    if (price === undefined) continue;
    let rawAmount = str(price);
    let token = str(pick(o, TOKEN_KEYS));
    if (isObj(price)) {
      rawAmount = str(price.amount ?? price.value);
      token = str(price.currency ?? price.token ?? price.asset) ?? token;
    }
    const network = str(pick(o, NET_KEYS));
    const { amount, asset } = humanAmount(rawAmount, token, network);
    return {
      amount,
      asset,
      network,
      payTo: str(pick(o, PAYTO_KEYS)),
      scheme: str(o.scheme ?? o.method ?? o.rail),
      description: str(o.description ?? j.error ?? j.message),
    };
  }
  return null;
}

export interface Captured {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  truncated: boolean;
}

/** Terms from a captured 402, or null when nothing readable was found. */
export function parse402(cap: Captured): Terms | null {
  const h = cap.headers;
  for (const name of ["payment-required", "x-payment-required", "x-payment"]) {
    const v = h[name];
    if (!v) continue;
    const j = parseJson(v) ?? parseJson(b64(v) ?? "");
    if (isObj(j)) {
      const t = fromAccepts(j) ?? fromLoose(j);
      if (t) return t;
    }
  }
  if (isObj(cap.body)) {
    const t = fromAccepts(cap.body) ?? fromLoose(cap.body);
    if (t) return t;
  }
  if (h["www-authenticate"]) {
    const t = fromPaymentChallenge(h["www-authenticate"]);
    if (t) return t;
  }
  return null;
}

const HEADER_KEEP = ["content-type", "www-authenticate", "payment-required", "x-payment-required", "x-payment", "x-payment-response"];

/** Paid endpoints to try: x402-named services first, then the endpoint, then the build's fallback path. */
export function x402Candidates(src: X402Source): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    const s = safeUrl(u);
    if (s && !out.includes(s.toString())) out.push(s.toString());
  };
  for (const s of src.services ?? []) if (/x402|402|pay/i.test(s.name) || /x402/i.test(s.endpoint)) push(s.endpoint);
  push(src.endpoint);
  const ep = safeUrl(src.endpoint);
  if (ep && src.path) push(ep.origin + src.path);
  return out;
}

async function capture(url: URL): Promise<Captured> {
  const res = await fetchManual(url, {
    method: "GET",
    headers: { accept: "application/json" },
    timeoutMs: CALL_TIMEOUT_MS,
  });
  const body = await readCapped(res, BODY_CAP);
  const headers: Record<string, string> = {};
  for (const k of HEADER_KEEP) {
    const v = res.headers.get(k);
    if (v) headers[k] = v;
  }
  const json = parseJson(body.text);
  return { status: res.status, headers, body: json !== undefined ? json : body.text.slice(0, 4096), truncated: body.truncated };
}

/** GET each candidate until one answers 402; report the endpoint's own status when none does. */
export async function fetchX402TermsFor(src: X402Source): Promise<X402Result> {
  const candidates = x402Candidates(src);
  if (candidates.length === 0) return { ok: false, reason: "No public endpoint" };
  let endpointStatus: number | undefined;
  let lastStatus: number | undefined;
  let lastError: string | undefined;
  for (const c of candidates) {
    const url = safeUrl(c);
    if (!url) continue;
    try {
      const cap = await capture(url);
      if (cap.status === 402) {
        const terms = parse402(cap);
        if (!terms) return { ok: false, reason: "HTTP 402 without readable payment terms", status: 402 };
        return { ok: true, fetchedAt: new Date().toISOString(), endpoint: url.toString(), terms, raw: cap };
      }
      lastStatus = cap.status;
      if (c === safeUrl(src.endpoint)?.toString()) endpointStatus = cap.status;
    } catch (e) {
      lastError = errorName(e);
    }
  }
  const status = endpointStatus ?? lastStatus;
  if (status !== undefined) return { ok: false, reason: `No payment challenge (HTTP ${status})`, status };
  return { ok: false, reason: `Endpoint unreachable (${lastError ?? "no answer"})` };
}

// Deterministic default avatar: 5×5 mirrored grid from a 32-bit string hash of
// `${owner}:${id}` (FNV-1a → xorshift). Synchronous, so server and client
// render byte-identical SVG. Six low-chroma inks; never brand yellow.

import { cn } from "@/lib/utils";

const INK = ["#8fa3b8", "#a0b39a", "#b8a98f", "#9fa8c9", "#b39aa6", "#8fb3ad"] as const;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function xorshift(x: number): number {
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function identiconSeed(owner: string, id: number): { bits: number; ink: string } {
  const h = fnv1a(`${owner.toLowerCase()}:${id}`) || 1;
  const a = xorshift(h);
  const b = xorshift(a);
  return { bits: a & 0x7fff, ink: INK[b % INK.length] };
}

/** Cells lit for a seed, as [col,row] pairs on the 5×5 grid. */
export function identiconCells(bits: number): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if ((bits >> (row * 3 + col)) & 1) {
        for (const c of col === 2 ? [2] : [col, 4 - col]) {
          const k = `${c},${row}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push([c, row]);
          }
        }
      }
    }
  }
  if (out.length < 6 && !seen.has("2,2")) out.push([2, 2]);
  return out;
}

export function Identicon({
  owner,
  id,
  size = 40,
  className,
}: {
  owner: string;
  id: number;
  /** 32 table, 40 list row, 56 card, 64 profile header. */
  size?: number;
  className?: string;
}) {
  const { bits, ink } = identiconSeed(owner, id);
  const cells = identiconCells(bits);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      aria-hidden
      className={cn("shrink-0 rounded-lg border bg-secondary", className)}
    >
      {cells.map(([c, r]) => (
        <rect key={`${c}-${r}`} x={5 + c * 8} y={5 + r * 8} width={7} height={7} fill={ink} />
      ))}
    </svg>
  );
}

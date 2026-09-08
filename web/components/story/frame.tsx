import { ArrowUpRight, Download, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { CountUp } from "@/components/count-up";

/* Server-safe pieces of the story pages. Everything that animates lives in
   scrolly.tsx, progress.tsx, chapter-nav.tsx and charts/. */

export const TIER_TITLE = {
  "ONCHAIN-56": "Read from BNB Smart Chain mainnet, chain 56, at the block named",
  "ONCHAIN-97": "Read from BSC testnet, chain 97, at the block named",
  "OFFCHAIN-SIM": "A controlled simulation. No chain was touched.",
  MODELLED: "A published parameter set, not a measurement of a person",
} as const;
const TIER_WORD = {
  "ONCHAIN-56": "read on BNB Chain mainnet",
  "ONCHAIN-97": "read on BSC testnet",
  "OFFCHAIN-SIM": "simulation",
  MODELLED: "modelled person",
} as const;
export type Tier = keyof typeof TIER_TITLE;

/** The evidence word in a chart footer: plain text like the rest of the footer, with the full definition on hover. */
export function Chip({ tier }: { tier: Tier }) {
  return (
    <span className="evidence" data-tier={tier} title={TIER_TITLE[tier]}>
      {TIER_WORD[tier]}
    </span>
  );
}

/** Chapter heading: number tile, the eyebrow, the evidence chip on the right, the h2 under it. */
export function ChapterHead({
  n,
  id,
  eyebrow,
  tier,
  children,
}: {
  n: string;
  id: string;
  eyebrow: string;
  tier?: Tier;
  children: ReactNode;
}) {
  return (
    <header className="story-flow" style={{ rowGap: "14px" }}>
      <p className="chapter-eyebrow">
        <span className="n">{n}</span>
        <span>{eyebrow}</span>
        {tier ? <Chip tier={tier} /> : null}
      </p>
      <h2 id={id}>{children}</h2>
    </header>
  );
}

/**
 * The hero's one number (Octoverse: the finding as a sentence, then one giant
 * figure, then two supporting ones). `value` is the artefact's formatted string;
 * when it parses as a number it counts up once on view, otherwise it renders
 * as given.
 */
export function BigNumber({
  value,
  unit,
  label,
  foot,
  support,
}: {
  value: string;
  unit?: string;
  label: ReactNode;
  foot?: ReactNode;
  support: ReadonlyArray<{ value: string; label: ReactNode }>;
}) {
  return (
    <div className="story-bignum">
      <div>
        <p className="lead-value">
          <Figure value={value} />
          {unit ? <span className="unit">{unit}</span> : null}
        </p>
        <p className="lead-label">{label}</p>
        {foot ? <p className="lead-foot">{foot}</p> : null}
      </div>
      <div className="support">
        {support.map((s, i) => (
          <div key={i}>
            <span className="v">
              <Figure value={s.value} />
            </span>
            <span className="l">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A formatted artefact string; plain numerals count up, anything else renders as-is. */
function Figure({ value }: { value: string }) {
  const m = value.match(/^([−-]?)(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?$/);
  if (!m) return <>{value}</>;
  const n = Number((m[2] + (m[3] ? `.${m[3]}` : "")).replace(/,/g, ""));
  const decimals = m[3]?.length ?? 0;
  return (
    <>
      {m[1] ? "−" : ""}
      <CountUp value={n} decimals={decimals} />
    </>
  );
}

/** Three cards, one row, one per chapter. The middle one may be the unflattering one; same size. */
export function StatCards({
  cells,
}: {
  cells: ReadonlyArray<{ label: string; value: string; caption: ReactNode; highlight?: boolean }>;
}) {
  return (
    <div className="story-stats">
      {cells.map((c, i) => (
        <div key={i} className="story-stat" data-highlight={c.highlight ? "true" : "false"}>
          <span className="label">{c.label}</span>
          <span className="value">{c.value}</span>
          <span className="caption">{c.caption}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The chart frame: a metric-forward title, a caption that interprets, the plot,
 * then the footer every plot carries — evidence chips, n, the CSV, a link into
 * the study — and the table behind the chart, because a chart is an argument
 * and the numbers are the evidence (State of JS's export-data / show-table).
 */
export function ChartFrame({
  kicker,
  title,
  dek,
  tiers,
  n,
  csv,
  more,
  table,
  legend,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  dek?: ReactNode;
  tiers: ReadonlyArray<Tier>;
  n?: ReactNode;
  csv?: string;
  more?: { href: string; label: string };
  table?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="chart-frame" style={{ margin: 0 }}>
      <figcaption className="story-flow" style={{ rowGap: "8px" }}>
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <p className="chart-title">{title}</p>
        {dek ? <p className="chart-dek">{dek}</p> : null}
      </figcaption>
      {legend}
      <div className="chart-plot">{children}</div>
      <div className="chart-foot">
        {tiers.map((t) => (
          <Chip key={t} tier={t} />
        ))}
        {n ? <span>{n}</span> : null}
        {csv ? (
          <a href={csv} download>
            <Download size={12} aria-hidden />
            CSV
          </a>
        ) : null}
        {more ? (
          <a href={more.href} rel="noreferrer">
            {more.label}
            <ArrowUpRight size={12} aria-hidden />
          </a>
        ) : null}
      </div>
      {table ? (
        <details>
          <summary>
            <Table2 size={12} aria-hidden />
            Show the data as a table
          </summary>
          <div className="table-wrap">{table}</div>
        </details>
      ) : null}
    </figure>
  );
}

export function Legend({ items }: { items: ReadonlyArray<{ color: string; label: string }> }) {
  return (
    <div className="chart-legend" aria-hidden>
      {items.map((it) => (
        <span key={it.label}>
          <i style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function Claim({ children }: { children: ReactNode }) {
  return <p className="claim">{children}</p>;
}

export function Caveat({ children }: { children: ReactNode }) {
  return (
    <div className="caveat">
      <span className="label">Caveat carried</span>
      <p style={{ margin: 0, maxWidth: "none" }}>{children}</p>
    </div>
  );
}

export function SectionLinks({ children }: { children: ReactNode }) {
  return <p className="section-links">{children}</p>;
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={12} aria-hidden style={{ display: "inline", verticalAlign: "-1px", marginLeft: 3 }} />
    </a>
  );
}

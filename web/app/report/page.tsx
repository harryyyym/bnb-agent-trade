/*
 * /report — the T1 liquidation-protection study, as a page.
 *
 * A server component. The figure is a string of SVG compiled by
 * `web/scripts/render-figures.mjs` at BUILD time and committed, so the evidence
 * is in the document on first paint: no chart runtime reaches the browser, the
 * route prerenders complete, it prints, it screenshots, and a sceptic can read
 * the whisker endpoints out of view-source.
 *
 * Every number on this page comes from `STUDY`, which the render script lifts
 * out of the study's T1-confirmatory.json. Nothing quantitative
 * is typed into this file.
 */
import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { HeroBackdrop } from "@/components/hero-rays";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import {
  BOOKS,
  CLOCK,
  CLOCK_CSV,
  CLOCK_ROWS,
  METHOD,
  METHOD_ARMS,
  MIXTURE,
  MIXTURE_BINS,
  MIXTURE_CSV,
  PER_CELL_CSV,
  PER_CELL_METHOD,
  PER_CELL_ROWS,
  STUDY,
} from "./figures.generated";
import { E as BRIEF } from "../brief/evidence.generated";
import { ChapterChips, ChapterRail } from "@/components/story/chapter-nav";
import { ClockChart } from "@/components/story/charts/clock-chart";
import { ForestChart } from "@/components/story/charts/forest-chart";
import { MixtureChart } from "@/components/story/charts/mixture-chart";
import { BigNumber, ChartFrame, Legend, StatCards } from "@/components/story/frame";
import { ReadingProgress } from "@/components/story/progress";
import { Scrolly } from "@/components/story/scrolly";
import "@/components/story/story.css";
import "./report.css";

export const metadata: Metadata = {
  title: "T1, what liquidation protection is worth",
  description:
    "A controlled simulation: 16 cells, 800 paired price paths, an autonomous keeper against a modelled human operator. Two pre-registered primaries, a corrections log, and the raw ledgers.",
};

/*
 * The artefacts are served from this origin. They used to point at blob URLs in
 * the public repository, which does not carry the study, so five of the
 * page's outermost evidence links returned 404 — on a page whose own rule is
 * that a reader is one click from the file that produced a number. The copies
 * under public/evidence/ are made by `pnpm evidence` and committed.
 */
const EVIDENCE = "/evidence/";

// --- formatting -------------------------------------------------------------

const SUPERSCRIPT: Readonly<Record<string, string>> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
  "+": "",
};

/** 3.38e-117 → "3.4 × 10⁻¹¹⁷". A p-value in exponent notation is a tell of a spreadsheet. */
function sci(x: number): string {
  const [mantissa, exponent] = x.toExponential(1).split("e");
  const sup = [...exponent].map((c) => SUPERSCRIPT[c] ?? c).join("");
  return `${mantissa} × 10${sup}`;
}

const n1 = (x: number): string => x.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (x: number): string => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n3 = (x: number): string => x.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const n0 = (x: number): string => x.toLocaleString("en-US");
const n5 = (x: number): string => x.toLocaleString("en-US", { minimumFractionDigits: 5, maximumFractionDigits: 5 });
const pct = (x: number): string => `${n1(x * 100)}%`;
const bps = (x: number): string => `${n1(x)} bps`;
const mb = (bytes: number): string => `${(bytes / 1_000_000).toFixed(1)} MB`;
const bytes = (b: number): string => (b >= 1_000_000 ? mb(b) : `${Math.round(b / 1000)} KB`);

// --- small pieces -----------------------------------------------------------

function Num({ children }: { children: ReactNode }) {
  return <span className="num">{children}</span>;
}

function Evidence({ kind }: { kind: "sim" | "modelled" }) {
  return kind === "sim" ? (
    <span className="evidence evidence-sim" title="A controlled simulation. No chain was touched.">simulation</span>
  ) : (
    <span className="evidence evidence-modelled" title="A published parameter set, not a measurement of a person">modelled person</span>
  );
}

function H2({ n, children, id }: { n: string; children: ReactNode; id: string }) {
  return (
    <h2 id={id}>
      <span className="secnum">{n}</span>
      {children}
    </h2>
  );
}

// --- the corrections log ----------------------------------------------------

/* One line of prose per defect. The DIRECTION beside each is not written here —
   it is read off the artefact's own `direction` sentence by the render script,
   because a corrections log the page had editorialised would not be one. */
const DEFECT_TEXT: Readonly<Record<string, { what: string; where: string }>> = {
  c1b: {
    what: "C1b's tail was selected on terminal equity in absolute numeraire over a sample that mixes one-book and three-book portfolios. The two clusters do not overlap, so no three-book path could enter the tail: what was printed as CVaR(5%) of 800 paths was arithmetically CVaR(10%) of the 400 one-book paths, and the effect was inflated about fourfold.",
    where: "the second primary",
  },
  disclosure: {
    what: "The report rendered the engine-gaps table without its direction column, dropping, among others, the statement that one engine choice is worth the whole of a pre-registered loss in the agent's favour. The unit test that claimed to assert the disclosure only checked that the field was non-empty in the data structure.",
    where: "a renderer, and the test that guarded it",
  },
  gas: {
    what: "The gas table was computed over book records and labelled per arm-path, so the largest transaction count contradicted the mean transaction count printed two rows above it.",
    where: "the cost secondaries",
  },
  delay: {
    what: "The agent's realised delay was pooled over three round-robin book offsets and printed against book 0's model band alone, which read as the agent missing its own latency model by six seconds. It does not: every book index is inside the band that book's own offset gives it.",
    where: "the latency secondaries",
  },
  counts: {
    what: "Protects and transactions per run were averaged over two levels whose support differs, 0 or 1 on a one-book run, 0 to 3 on a three-book one. The pooled mean is set by how many cells hold three books, not by anything an arm did, and it describes neither level.",
    where: "the workload secondaries",
  },
};

/** The sections, in one place, so the contents rail and the headings cannot drift. */
const SECTIONS: ReadonlyArray<{ n: string; id: string; label: string }> = [
  { n: "0", id: "corrections", label: "What four passes found wrong" },
  { n: "1", id: "how-much", label: "How much, and how sure" },
  { n: "2", id: "conditions", label: "In which conditions" },
  { n: "3", id: "method", label: "How it was measured" },
  { n: "4", id: "limits", label: "What it does not show" },
];

/* Figure numbers in one place. Six kickers and five prose cross-references used
   to be typed strings, which means inserting a figure moved eleven of them by
   hand and the first one missed was a citation to the wrong plot. */
const FIGURES = ["clock", "mixture", "per-cell"] as const;
type FigureId = (typeof FIGURES)[number];

function figNo(id: FigureId): number {
  const i = FIGURES.indexOf(id);
  if (i < 0) throw new Error(`no such figure: ${id}`);
  return i + 1;
}

/** "Figure 3" in prose, numbered off the same list the kickers read. */
function Fig({ id }: { id: FigureId }) {
  return <>{`Figure ${figNo(id)}`}</>;
}

/** The arm a method row is about, in the words the rest of the page uses. */
const ARM_ROLE: Readonly<Record<string, string>> = {
  A: "the keeper. Unattended, evented, one protect per block round-robin across books. Its decision-to-execution latency is a measured input and is never zero.",
  H1: "an attentive operator. Always at the screen, no operational error, threshold rules, and a total event-to-broadcast delay FASTER than the agent's. Sequential across books.",
  H2: "a realistically available operator. A published availability schedule by hour, phone notification at night, sequential books. This is the arm the confirmatory test compares against.",
  H3: "H2 with sleep forced over 23:00–07:00 CST regardless of the schedule, which separates always on from smart.",
  P: "never repays, never closes. It measures whether intervening helps at all, and it is the column left to a reader who rejects a modelled human.",
};

/* The three clusters of Figure 2, named in prose. The counts and the threshold
   are the artefact's; only these words are the page's. */
const CLUSTER_LABEL: Readonly<Record<string, string>> = {
  tie: "exact tie",
  negligible: "under 10 bps",
  material: "protection binds",
};

const MOVED_LABEL: Readonly<Record<string, string>> = {
  toward: "toward the agent",
  against: "against the agent",
  neither: "neither way",
};

/* Figure 5 reads two published tables against each other, so the page needs to
   pick an arm out of each. Both throw rather than render a hole. */


/** One arm out of the method summary, by name. Throws rather than rendering a hole. */
function methodArm(arm: string) {
  const r = METHOD_ARMS.find((a) => a.arm === arm);
  if (!r) throw new Error(`no method summary for arm ${arm}`);
  return r;
}

/* A bootstrap cannot resolve a p below 1/(resamples + 1), so a p that lands
   exactly on that floor is printed as a bound rather than as a measurement. The
   floor is computed from the study's own resample count, not typed. */
const P_FLOOR = 1 / (METHOD.seeds.bootstrapIters + 1);

function pValue(p: number): string {
  return p <= P_FLOOR ? `< ${sci(P_FLOOR)}` : sci(p);
}

/* The two kinds of pre-registered survival target, and the distinction between
   them is the whole of Finding 5: every falsification lands on the first kind. */
const PREREG_KIND: Readonly<Record<string, string>> = {
  planned: "asserted in the plan, with no derivation printed",
  derived: "re-derived from the model’s own frozen constants",
};

/* Figures 1 and 6 read published survival tables. Each accessor throws rather
   than letting a missing row render as a hole in a sentence. */
function clockArm(arm: string) {
  const r = CLOCK.arms.find((a) => a.arm === arm);
  if (!r) throw new Error(`no clock summary for arm ${arm}`);
  return r;
}

function clockCell(arm: string, clock: "work" | "night", shock: string) {
  const row = CLOCK_ROWS.find((r) => r.arm === arm && r.clock === clock);
  const cell = row?.byShock.find((b) => b.shock === shock);
  if (!cell) throw new Error(`no ${arm} survival at ${clock} on ${shock}`);
  return cell.survival;
}



/** The word for a clock level wherever the page names one. */
const CLOCK_AT: Readonly<Record<string, string>> = { work: "09:30", night: "01:00" };

/* The confidence level, once, from the artefact. Every "95%" in the prose below
   is this string: the level is a property of the study's estimators, published
   as `level` beside every interval, and a page that typed it would be a page
   whose captions could outlive a change to it. */
const CI = `${n0(CLOCK.uncertainty.level * 100)}%`;
/* The forest plot's two, likewise, off the alpha of the intervals it draws. */
const CI_OUTER = `${n0(PER_CELL_METHOD.outerLevelPct)}%`;
const CI_INNER = `${n0(PER_CELL_METHOD.innerLevelPct)}%`;

// --- page -------------------------------------------------------------------

export default function ReportPage() {
  const { c1, c1b, mixture, design, corrections } = STUDY;
  const towardCount = corrections.defects.filter((d) => d.moved === "toward").length;
  /* Figure 6's table, pivoted out of the same rows the figure was drawn from.
     A missing cell throws rather than rendering an empty column. */
  /* The pooled estimate is not a cell. The rows arrive sorted by effect —
     descending, since the figure is read top-down — so the span below is taken
     with min/max rather than off the ends of the array: a sentence that reads
     "5,328.5 to 0.0" the moment someone flips the sort is a sentence that was
     never checking anything. */
  const cellRows = PER_CELL_ROWS.filter((r) => r.kind === "cell");
  const cellSpan = {
    lo: Math.min(...cellRows.map((r) => r.d)),
    hi: Math.max(...cellRows.map((r) => r.d)),
  };

  return (
    <>
      <SiteNav />
      <ReadingProgress />
      <main className="report story pt-6 pb-24 sm:pt-8">
        <div className="story-wide">
            <header className="story-hero">
              <h1>
                Where protection binds, an always-on keeper is worth <Num>{bps(mixture.materialMedianBps)}</Num> of
                equity, and the gap opens when nobody is awake.
              </h1>
              <p className="deck">
                Across <strong>{n0(design.paths)}</strong> paired price paths, an autonomous keeper and a modelled human
                operator were run against the same shocks, the same liquidators and the same venue rules. The gap
                between them is a gap in <strong>availability</strong>: it opens at 01:00, and it widens again on a
                second position.
              </p>

              <div className="story-plate">
                <HeroBackdrop />
              <BigNumber
                value={n1(mixture.materialMedianBps)}
                unit="bps"
                label={
                  <>
                    median paired gap in cost-inclusive terminal equity, the keeper minus the modelled operator, on the{" "}
                    <strong>{n0(mixture.material)} of {n0(mixture.nPairs)}</strong> paths, {pct(mixture.materialFraction)},
                    where protection binds. Basis points of each path&rsquo;s own opening equity.
                  </>
                }
                foot={
                  <>
                    <span>
                      pooled over all {n0(c1.nPairs)} paths the confirmatory median is {bps(c1.medianGapBps)}, 95% BCa{" "}
                      {n1(c1.ciLoBps)} to {n1(c1.ciHiBps)}, p = {sci(c1.pTwoSided)}
                    </span>
                  </>
                }
                support={[
                  {
                    value: `${n1(clockArm("H2").changePp)} pts`,
                    label: `positions per hundred a person on a realistic schedule loses when the same shock starts at 01:00 instead of 09:30; the agent moves ${n1(clockArm("A").changePp)} and its interval covers zero`,
                  },
                  {
                    value: `+${n1(BOOKS.advantageOverH1.threePp)} pts`,
                    label: `the agent's survival lead over an attentive person at three positions; at one position it is ${n1(BOOKS.advantageOverH1.onePp)} and inside the noise`,
                  },
                ]}
              />
              </div>
              <ChapterChips chapters={SECTIONS} />
            </header>
          <div className="story-body">
          <div className="report-flow">

              <p style={{ marginTop: "1.6rem" }}>
                The pooled figure is the study&rsquo;s confirmatory result and it is not the headline sentence, because
                the distribution of paired gaps has no middle: <Num>{n0(mixture.exactTies)}</Num> paths are exact ties
                where both arms did the same thing, and <Num>{n0(mixture.negligible)}</Num> more differ by less than a
                keeper fee. The pooled median falls between two populations rather than inside either one, {" "}
                <Num>{bps(mixture.materialMedianBps - c1.medianGapBps)}</Num> below the median of the paths where
                protection bound, and <Num>{n0(Math.round(c1.medianGapBps / MIXTURE.voidLoBps))}</Num> times the
                largest gap on any path where it did not. <a href="#how-much"><Fig id="mixture" /></a> is that distribution.
              </p>

              <div className="note">
                <p style={{ margin: 0 }}>
                  <strong>The human arm is a model, not a measurement.</strong> Arm H2 is a published parameter set, a
                  real schedule, phone notifications, sequential books, and none of it is fitted to this study&rsquo;s
                  data. Every human figure on this page carries <Evidence kind="modelled" /> for that reason. A reader
                  who declines to accept a modelled baseline should read the agent against <em>passive</em> instead, a
                  book that is never touched: <Num>{bps(STUDY.passive.medianGapBps)}</Num>, agent ahead on{" "}
                  <Num>{n0(c1.aAhead)}</Num> paths. Nothing here is a claim about money made or lost on BNB Chain
                  mainnet, and no testnet balance is converted to dollars anywhere on this page.
                </p>
              </div>

              <dl className="apparatus">
                <dt>What ran</dt>
                <dd>
                  {design.cells} cells, shock (4) × clock (2) × books (2), fully crossed, at{" "}
                  {design.pathsPerCell} paths each. {n0(design.paths)} paths, {n0(design.runs)} arm-runs,{" "}
                  {n0(design.bookRuns)} book-level ledgers. One price path is replayed across all five arms, which is
                  why the tests are paired.
                </dd>

                <dt>Evidence label</dt>
                <dd>
                  <Evidence kind="sim" /> on everything generated here; the human arms are{" "}
                  <Evidence kind="modelled" />. The venue is one Aave-V3-shaped rule tuple, not three integrations, and
                  the liquidator is testnet-shaped, mainnet MEV is faster than it, which is a pre-registered way for
                  the agent to lose that this study does not run.
                </dd>

                <dt>Corrections</dt>
                <dd>
                  Five defects were found by four independent passes over this study.{" "}
                  <strong>{towardCount} of them flattered the agent</strong>, one took something back from it, and one
                  moved the result in no direction at all. All five are in <a href="#corrections">§0</a>, with what was
                  published beside what is published now.
                </dd>

                <dt>Data</dt>
                <dd>
                  <ul className="artefacts">
                    {STUDY.artefacts.map((a) => (
                      <li key={a.name}>
                        {a.inRepo ? (
                          <a href={`${EVIDENCE}${a.name}`}>
                            {a.name}
                          </a>
                        ) : (
                          <span className="num">{a.name}</span>
                        )}{" "}
                        <span className="num">({bytes(a.bytes)})</span>, {a.what}
                        {a.inRepo ? null : <span className="muted"> · not in the repository, see below</span>}
                      </li>
                    ))}
                  </ul>
                  <p style={{ marginTop: "0.7rem", marginBottom: 0 }}>
                    <strong>The two large ones are not committed</strong>, and saying so is the difference between a
                    link and a data-availability statement: at{" "}
                    <span className="num">
                      {bytes(STUDY.artefacts[0].bytes)} and {bytes(STUDY.artefacts[1].bytes)}
                    </span>{" "}
                    they are excluded by the repository&rsquo;s own <code className="num">.gitignore</code> and are
                    regenerated rather than stored. What is committed is everything needed to regenerate them byte for
                    byte, the per-cell seeds in <code className="num">T1-cells.json</code> and the frozen constants
                    and run checks in <code className="num">T1-run-manifest.json</code>, plus every published
                    statistic in <code className="num">T1-confirmatory.json</code>. The two ledgers are available on
                    request as a release asset.
                  </p>
                  <p style={{ marginTop: "0.7rem", marginBottom: 0 }}>
                    Schema <code className="num">{STUDY.schema}</code>, generated{" "}
                    <span className="num">{STUDY.generatedAtUtc}</span>.
                  </p>
                </dd>
              </dl>
            {/* --------------------------------------------------------------
                Figure 1 is in the front matter, ahead of the corrections log,
                because it is the finding everything after it qualifies: the two
                arms that are always on do not care what hour the shock arrives,
                and the two on a schedule do. It is drawn on a SECONDARY, which
                the dek says twice — survival is never this study's headline. */}
            <div className="full report-scrolly" id="clock">
              <Scrolly
                label={`Figure ${figNo("clock")}`}
                graphic={
                  <ChartFrame
                    kicker={`Figure ${figNo("clock")}`}
                    title={<>Move the shock from working hours to 01:00 and the human on a schedule loses{" "}
                  {n1(Math.abs(clockArm("H2").changePp))} of every hundred positions. The two arms that are
                  always on move by less than this study can resolve.</>}
                    tiers={["OFFCHAIN-SIM", "MODELLED"]}
                    n={<>n = {n0(CLOCK.nBookLedgersPerArmPerClock)} book ledgers per arm per clock ·{" "}
                  {n0(CLOCK.nPairsPerClock)} paths per clock</>}
                    csv={CLOCK_CSV}
                  legend={<Legend items={[{ color: "var(--chart-1)", label: "the agent" }, { color: "var(--chart-2)", label: "a modelled person" }, { color: "var(--chart-3)", label: "nobody acts" }]} />}
                  table={<><div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Arm</th>
                        <th className="col-num">Shock starts</th>
                        <th className="col-num">All four</th>
                        {CLOCK.shocks.map((shock) => (
                          <th key={shock} className="col-num">
                            {shock}
                          </th>
                        ))}
                        <th className="col-num">night − work, pp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CLOCK_ROWS.map((r) => (
                        <tr key={`${r.arm}-${r.clock}`} className={r.arm === "A" ? "headline" : undefined}>
                          <td className="col-mono">{r.label}</td>
                          <td className="col-num">{CLOCK_AT[r.clock]}</td>
                          <td className="col-num">
                            {n3(r.survival)}
                            <span className="ci">
                              {n3(r.loPct / 100)} – {n3(r.hiPct / 100)}
                            </span>
                          </td>
                          {r.byShock.map((b) => (
                            <td key={b.shock} className="col-num">
                              {n3(b.survival)}
                            </td>
                          ))}
                          <td className="col-num">
                            {r.changePp === null ? "–" : n1(r.changePp)}
                            {r.changeLoPp === null || r.changeHiPp === null ? null : (
                              <span className="ci">
                                {n1(r.changeLoPp)} – {n1(r.changeHiPp)}
                                {r.changeSpansZero ? " ·" : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ fontSize: "14px", margin: "0 0 1rem" }}>
                  Book-level survival as a fraction of positions kept. Each shock column is{" "}
                  {n0(CLOCK.nBookLedgersPerArmPerClock / CLOCK.shocks.length)} book ledgers.{" "}
                  <strong>The dimmer figure under a number is its {CI} interval</strong>, and a{" "}
                  <strong>·</strong> beside one means it covers zero, the arm moved, but not by
                  more than this sample can resolve. The four shock columns carry no interval because the figure
                  does not draw them and the study does not interval them; publishing a band beside a rate
                  nobody estimated one for would be the same mistake in a table that it would be in a chart.
                </p></>}
                  >
                    <ClockChart />
                  </ChartFrame>
                }
                steps={[
                  <p key="s0">
                    <strong>Start at 09:30 on a weekday.</strong> Five policies face the same shocks on the same price paths. The always-on agent keeps {pct(clockArm("A").work)} of positions, the attentive person {pct(clockArm("H1").work)}, the person on a realistic schedule {pct(clockArm("H2").work)}. Doing nothing keeps {pct(clockArm("P").work)}.
                  </p>,
                  <p key="s1">
                    <strong>Now start the same shock at 01:00.</strong> Same paths, same liquidator draws, same venue rules; only the clock the shock starts on has changed. The second bar in every row is the night.
                  </p>,
                  <p key="s2">
                    <strong>Only the two scheduled humans move.</strong> The realistic person loses <Num>{n1(Math.abs(clockArm("H2").changePp))}</Num> positions per hundred on an interval of <Num>{n1(clockArm("H2").changeLoPp!)}</Num> to <Num>{n1(clockArm("H2").changeHiPp!)}</Num>; the same person with sleep forced loses <Num>{n1(Math.abs(clockArm("H3").changePp))}</Num>. The night takes away the two shocks that had been leaving a person time.
                  </p>,
                  <p key="s3">
                    <strong>The two always-on arms do not move by anything this study can resolve.</strong> The agent shifts <Num>{n1(clockArm("A").changePp)}</Num> points on <Num>{n1(clockArm("A").changeLoPp!)}</Num> to <Num>{n1(clockArm("A").changeHiPp!)}</Num>; the attentive person <Num>{n1(clockArm("H1").changePp)}</Num> on <Num>{n1(clockArm("H1").changeLoPp!)}</Num> to <Num>{n1(clockArm("H1").changeHiPp!)}</Num>. Both cover zero. Neither policy has a clock in it.
                  </p>,
                  <p key="s4">
                    <strong>Doing nothing is the floor, and survival is a secondary.</strong> Passive keeps {pct(clockArm("P").work)} at either clock because every shock here liquidates an untouched book by construction. An arm that closed the whole position would survive everything, which is why the headline is terminal equity and not this axis.
                  </p>,
                ]}
              />
              <details className="fig-notes">
                <summary>How this figure was drawn, and what its intervals are</summary>
                <p className="fig-dek">Book-level survival, the fraction of <em>positions</em> kept, for each of the five arms at
                  each clock, over {n0(CLOCK.nBookLedgersPerArmPerClock)} book-level ledgers per arm per clock,
                  drawn from {n0(CLOCK.nPairsPerClock)} price paths. Cells are pooled by book count, because a
                  three-book cell carries three times the books of a one-book one and pooling them any other way
                  is the defect <a href="#corrections">§0</a> is about. It is <em>book</em> survival and never{" "}
                  <em>portfolio</em> survival for the same reason: a portfolio comes through only when every one
                  of its books does, so at three books it is a three-of-three event and at one book a
                  one-of-one, and the agent&rsquo;s portfolio rate falls from{" "}
                  <Num>{pct(BOOKS.portfolioSurvival.one)}</Num> to{" "}
                  <Num>{pct(BOOKS.portfolioSurvival.three)}</Num> across that axis without any arm doing
                  anything differently. Both are in the <a href="#method">§3</a> table, side by side. The clock
                  is the instant the shock <em>starts</em>, weekday 09:30 or 01:00 CST, and not an hour an
                  operator chose.</p>
                <p className="fig-dek"><strong>The bars carry a {CI} interval and it is the point of the figure.</strong> These are
                  proportions estimated from a finite number of drawn paths, and at these rates the interval
                  reaches <Num>±{n1(CLOCK.uncertainty.widestHalfWidthPp)}</Num> points, so without one a reader
                  cannot tell an arm that moved from an arm whose movement its own interval swallows.{" "}
                  {CLOCK.uncertainty.armsInsideNoise.join(", ")} all move by an amount whose interval covers
                  zero; only {CLOCK.uncertainty.armsThatMove.join(" and ")} move measurably, and those two, and only
                  those two, carry a dashed rule down from their 09:30 level into their 01:00 row, so the
                  collapse is a distance to look at rather than a subtraction to do. Wilson score rather
                  than the textbook normal interval, because several of these rates sit at or beside 0% and
                  100% where a normal interval either leaves the unit range or collapses to a point of zero
                  width, and over an <em>effective</em> sample size rather than the raw{" "}
                  {n0(CLOCK.nBookLedgersPerArmPerClock)}, because three books replayed against one price path
                  are not three independent draws. That correction costs up to a factor of{" "}
                  <Num>{n2(CLOCK.uncertainty.maxDesignEffect)}</Num> of the nominal n and widens every band
                  here. The interval on the <em>change</em> between the two clocks is not these two bands
                  subtracted: it is a bootstrap that resamples whole paths, published beside them. All of it is{" "}
                  <strong>exploratory and uncorrected</strong>, and all of it is computed by the study, {" "}
                  <code className="num">exploratory.survivalUncertainty</code> in T1-confirmatory.json, rather
                  than by this page.</p>
                <p className="fig-dek">Rows are ordered by availability, not by height, and the two humans without a colour are the
                  exploratory arms. <strong>Survival is a secondary here and can never be the headline</strong>,
                  an arm that closes the whole position survives everything, and the primary barely moves on
                  this axis: the median paired gap against the realistic human is{" "}
                  <Num>{bps(CLOCK.medianGapAvsH2WorkBps)}</Num> in working hours against{" "}
                  <Num>{bps(CLOCK.medianGapAvsH2NightBps)}</Num> at night, because by 09:30 most paths are
                  already in the cluster where protection binds. the full study is about that
                  disagreement.</p>
                <p className="fig-dek">the same book-count weighting re-derives the study&rsquo;s own per-arm and per-book-level
                  rates{" "}
                  {CLOCK.worstPoolingDeviation === 0 ? "exactly" : `to ${sci(CLOCK.worstPoolingDeviation)}`}{" "}
                  before anything is drawn</p>
                <p className="fig-dek">intervals read from the study, not computed here: Wilson score at {CI} over the
                  clustering-adjusted n, with the change between clocks from a{" "}
                  {n0(CLOCK.uncertainty.iters)}-resample bootstrap over whole paths · exploratory, uncorrected</p>

              </details>
            </div>


            <p>
              The night does not make the human worse at the shocks that were always going to beat them. It
              takes away the two that had been leaving them time. The realistic human keeps{" "}
              <Num>{n1(clockCell("H2", "work", "grind") * 100)}</Num> of every hundred positions on the slow
              grind at 09:30 and <Num>{n1(clockCell("H2", "night", "grind") * 100)}</Num> at 01:00, and{" "}
              <Num>{n1(clockCell("H2", "work", "crash") * 100)}</Num> against{" "}
              <Num>{n1(clockCell("H2", "night", "crash") * 100)}</Num> on the crash. On the two wicks the
              number is identical at both clocks, {" "}
              <Num>{n1(clockCell("H2", "work", "wick-persist") * 100)}</Num> either way on{" "}
              <code className="num">wick-persist</code> and{" "}
              <Num>{n1(clockCell("H2", "work", "wick-1block") * 100)}</Num> either way on{" "}
              <code className="num">wick-1block</code>, because three seconds is not enough for a person at
              any hour. That is also why this is a claim about availability rather than about skill: across the
              same axis the agent moves by <Num>{n1(clockArm("A").changePp)}</Num> positions per hundred and
              the attentive human by <Num>{n1(clockArm("H1").changePp)}</Num>, both upward, and{" "}
              <strong>neither of those two movements is a difference this study can resolve</strong>. The agent&rsquo;s
              {CI} interval runs <Num>{n1(clockArm("A").changeLoPp!)}</Num> to{" "}
              <Num>{n1(clockArm("A").changeHiPp!)}</Num> points and the attentive human&rsquo;s{" "}
              <Num>{n1(clockArm("H1").changeLoPp!)}</Num> to <Num>{n1(clockArm("H1").changeHiPp!)}</Num>; both
              cover zero, and passive moves by exactly nothing on an interval of{" "}
              <Num>{n1(clockArm("P").changeLoPp!)}</Num> to <Num>{n1(clockArm("P").changeHiPp!)}</Num>. Neither
              of those two policies has a clock in it at all, so what the figure shows there is variation in the
              exogenous paths and the liquidator draws. The realistic human&rsquo;s{" "}
              <Num>{n1(clockArm("H2").changePp)}</Num> points, on an interval of{" "}
              <Num>{n1(clockArm("H2").changeLoPp!)}</Num> to <Num>{n1(clockArm("H2").changeHiPp!)}</Num>, is on
              a different scale entirely, and that separation is the whole finding rather than the ranking of
              the five bars.
            </p>

            <p className="muted" style={{ fontSize: "15px" }}>
              One oddity in the figure is better named than left to be found. H3 is H2 with sleep forced over
              23:00–07:00, so it is strictly less available by construction and cannot really be better, and
              it measures very slightly better at both clocks, <Num>{n1(clockArm("H3").work * 100)}</Num> against{" "}
              <Num>{n1(clockArm("H2").work * 100)}</Num> in working hours and{" "}
              <Num>{n1(clockArm("H3").night * 100)}</Num> against <Num>{n1(clockArm("H2").night * 100)}</Num> at
              night. The two arms share the market and share the liquidator, but they draw availability from
              separate streams, keyed by arm name on purpose so that adding or removing an arm cannot perturb
              another arm&rsquo;s draw. This one contrast is therefore paired on the exogenous world and{" "}
              <em>unpaired on the very quantity it tests</em>, which is why the study reports it as a null this
              design cannot resolve rather than as evidence that a sleep schedule does not matter.
            </p>


            {/* ------------------------------------------------------------- */}

            <H2 id="corrections" n="0">
              What four passes over this study found wrong with it
            </H2>

            <StatCards
              cells={[
                { label: "Defects found by four independent passes", value: n0(corrections.defects.length), caption: "one inflated a secondary about fourfold; every one is printed beside what replaced it" },
                { label: "Of them that flattered the agent", value: n0(towardCount), caption: "one took something back from it, one moved nothing", highlight: true },
                { label: "The primary, before and after", value: bps(c1.medianGapBps), caption: "unchanged, gaps are formed per path on that path's own equity, so none of the five could touch it" },
              ]}
            />

            <p>
              An independent replay recomputed every headline in this study from the stored ledgers, in a second
              language. Every one matched, including the primary. What it found instead were three defects in the
              analysis layer; a later independent verifier, reading the corrected document, found two more. Four of the
              five are the same mistake, a statistic computed over a sample that mixes the study&rsquo;s one-book and
              three-book portfolios, on a scale the book count itself sets.
            </p>

            <p>
              This section is at the front because one of the five was a fourfold inflation of a primary, and because
              three of them moved the published result in the direction the study is selling. An error that flatters
              the thing being measured is the one a reader is entitled to assume was left in on purpose.
            </p>

            {/* A stacked list rather than a table: one column here is a paragraph
                and four are short, which is a shape a five-column table cannot
                hold on any width this page has. */}
            <ol className="defects">
              {corrections.defects.map((d) => {
                const text = DEFECT_TEXT[d.id];
                return (
                  <li key={d.id}>
                    <p className={`defect-moved defect-${d.moved}`}>
                      moved {MOVED_LABEL[d.moved]}
                      <span className="muted"> · {text.where}</span>
                    </p>
                    <p className="defect-what">{text.what}</p>
                    <p className="defect-delta">
                      <span className="was">{d.before}</span>
                      <span aria-hidden> → </span>
                      <span className="sr-only">corrected to</span>
                      <span className="now">{d.after}</span>
                    </p>
                  </li>
                );
              })}
            </ol>

            <p>
              <strong>The primary is unchanged, and that is the check that any of this is trustworthy.</strong> C1&rsquo;s
              gaps are formed per path and divided by that path&rsquo;s own opening equity, so a one-book and a
              three-book pair enter on one scale and none of the five defects can touch it. If it had moved, something
              else would be broken.
            </p>

            <p>
              And the correction to the second primary makes this study&rsquo;s own point harder rather than easier.
              The tail gap fell from <Num>{bps(c1b.supersededBps)}</Num> to <Num>{bps(c1b.gapBps)}</Num>, which puts it
              much further below the median gap than the superseded figure was, the worst 5% of paths are exactly
              where the shock outruns the agent and it is liquidated too. The estimand was fixed because it was wrong.
              Which way it happened to point is not the reason.
            </p>

            <p>
              Four separate readings each found one more instance of one class and each was patched, so what the study
              carries now is a mechanism rather than a fifth patch: every summary the report prints is rebuilt three
              times, pooled, one-book only, three-book only, and every numeric leaf compared.{" "}
              <Num>{n0(corrections.nLeavesSwept)}</Num> statistics swept, <Num>{n0(corrections.nAxisSensitive)}</Num>{" "}
              moved by the book-count axis and therefore required to declare themselves,{" "}
              <Num>{corrections.nUndeclared}</Num> undeclared. An undeclared leaf stops the run before a report is
              produced.
            </p>

            {/* ------------------------------------------------------------- */}

            <H2 id="how-much" n="1">
              How much, and how sure
            </H2>

            <StatCards
              cells={[
                { label: "C1 · median paired gap, pooled over every path", value: bps(c1.medianGapBps), caption: `95% BCa ${n1(c1.ciLoBps)} to ${n1(c1.ciHiBps)} · p = ${sci(c1.pTwoSided)} two-sided`, highlight: true },
                { label: "C1b · the same gap in the worst 5% of outcomes", value: bps(c1b.gapBps), caption: `${n1(c1b.ciLoBps)} to ${n1(c1b.ciHiBps)} · corrected from ${bps(c1b.supersededBps)}` },
                { label: "Where protection binds", value: bps(mixture.materialMedianBps), caption: `${n0(mixture.material)} of ${n0(mixture.nPairs)} paths, ${pct(mixture.materialFraction)}` },
              ]}
            />

            <p>
              Two primaries were pre-registered and both were run, Holm-corrected over the family of two that this
              study actually contains rather than the family of four the plan lists for three tasks. Both tests are
              two-sided, which is the conservative choice against a pre-registered direction.
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>What it measures</th>
                    <th className="col-num">Gap</th>
                    <th className="col-num">95% CI</th>
                    <th className="col-num">p, two-sided</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="headline">
                    <td className="col-mono">C1</td>
                    <td>median paired gap in cost-inclusive terminal equity</td>
                    <td className="col-num">{bps(c1.medianGapBps)}</td>
                    <td className="col-num">
                      {n1(c1.ciLoBps)} – {n1(c1.ciHiBps)}
                    </td>
                    <td className="col-num">{sci(c1.pTwoSided)}</td>
                  </tr>
                  <tr>
                    <td className="col-mono">C1b</td>
                    <td>gap in the CVaR(5%) tail of the same return</td>
                    <td className="col-num">{bps(c1b.gapBps)}</td>
                    <td className="col-num">
                      {n1(c1b.ciLoBps)} – {n1(c1b.ciHiBps)}
                    </td>
                    <td className="col-num">&lt; 10⁻⁴</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="muted" style={{ fontSize: "15px" }}>
              C1b&rsquo;s p is the bootstrap&rsquo;s own floor, not a measurement: 10,000 resamples were drawn and none
              crossed zero, so the honest statement is <em>p &lt; 1/(resamples + 1)</em>. Both gaps are in basis points
              of each path&rsquo;s own opening equity, the endpoint is scale-free, so a one-book and a three-book
              portfolio enter on one scale.
            </p>

            <p>
              The two numbers disagree by a factor of five and the disagreement is the finding. C1 says what protection
              is worth on a typical path where it binds; C1b says what it is worth in the worst 5% of outcomes, and
              there it is worth far less, because the paths in that tail are the ones where the shock outran the agent
              and it was liquidated too. An insurance product that is weakest exactly in the tail is a thing a buyer
              should be told, and it is why both were pre-registered.
            </p>

            <p>
              Both are medians, and a median is only a summary of a population that has a middle. This one does not.
              Laid out path by path, the <Num>{n0(mixture.nPairs)}</Num> paired gaps fall into two populations with an
              empty span between them: on <Num>{n0(MIXTURE.noSeparation)}</Num> of them the two arms finish within{" "}
              <Num>{n0(MIXTURE.negligibleThresholdBps)}</Num> bps of each other, and on the rest the agent reaches the
              position and the modelled operator does not, or not in time. Nothing in this study lands between{" "}
              <Num>{bps(MIXTURE.voidLoBps)}</Num> and <Num>{bps(MIXTURE.voidHiBps)}</Num>, a two-order-of-magnitude
              hole, which is why the study&rsquo;s <Num>{n0(MIXTURE.negligibleThresholdBps)}</Num> bps threshold does
              no work: any cut inside that hole gives the same three counts.
            </p>

            <div className="full report-scrolly" id="mixture">
              <Scrolly
                label={`Figure ${figNo("mixture")}`}
                graphic={
                  <ChartFrame
                    kicker={`Figure ${figNo("mixture")}`}
                    title={<>The gap has no middle, so the median describes no path: a quarter of the sample sits on zero and the
                  rest is spread over two orders of magnitude above it.</>}
                    tiers={["OFFCHAIN-SIM", "MODELLED"]}
                    n={<>n = {n0(MIXTURE.nPairs)} paired paths · one row per path, not per cell</>}
                    csv={MIXTURE_CSV}
                  table={<><div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="col-num">From, bps</th>
                        <th className="col-num">To, bps</th>
                        <th>Cluster</th>
                        <th className="col-num">Paths</th>
                        <th className="col-num">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MIXTURE_BINS.map((b) => (
                        <tr key={`${b.lo}-${b.cluster}`}>
                          <td className="col-num">{n1(b.lo)}</td>
                          <td className="col-num">{n1(b.hi)}</td>
                          <td>{CLUSTER_LABEL[b.cluster]}</td>
                          <td className="col-num">{n0(b.n)}</td>
                          <td className="col-num">{pct(b.n / MIXTURE.nPairs)}</td>
                        </tr>
                      ))}
                      <tr className="headline">
                        <td className="col-num">{n1(MIXTURE_BINS[0].lo)}</td>
                        <td className="col-num">{n1(MIXTURE_BINS[MIXTURE_BINS.length - 1].hi)}</td>
                        <td>all paired paths</td>
                        <td className="col-num">{n0(MIXTURE.nPairs)}</td>
                        <td className="col-num">{pct(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div></>}
                  >
                    <MixtureChart />
                  </ChartFrame>
                }
                steps={[
                  <p key="s0">
                    <strong>Every one of the {n0(MIXTURE.nPairs)} paired gaps, laid out on one axis.</strong> Agent minus modelled person, in basis points of that path&rsquo;s own opening equity, linear to {n0(MIXTURE.symlogConstant)} bps and logarithmic beyond.
                  </p>,
                  <p key="s1">
                    <strong>{n0(MIXTURE.tie)} paths are exact ties.</strong> Both arms were liquidated in the same state or both were untouched, and they finish identical to the wei.
                  </p>,
                  <p key="s2">
                    <strong>{n0(MIXTURE.negligible)} more differ by less than a keeper fee</strong>, and then there is nothing at all between {n1(MIXTURE.voidLoBps)} and {n1(MIXTURE.voidHiBps)} bps. The {n0(MIXTURE.negligibleThresholdBps)} bps threshold does no work: any cut inside that hole gives the same three counts. The {n0(MIXTURE.nNegative)} paths where the agent finishes behind are the short bar left of zero.
                  </p>,
                  <p key="s3">
                    <strong>On the remaining {n0(MIXTURE.material)}, protection binds.</strong> The agent reaches the position and the modelled operator does not, or not in time, and the median of those paths is <Num>{bps(MIXTURE.materialMedianBps)}</Num>, the number in the hero.
                  </p>,
                  <p key="s4">
                    <strong>The pooled median falls between the two populations.</strong> C1, the confirmatory result, is <Num>{bps(MIXTURE.pooledMedianBps)}</Num>: {bps(MIXTURE.materialMedianBps - MIXTURE.pooledMedianBps)} below the material median and {n0(Math.round(MIXTURE.pooledMedianBps / MIXTURE.voidLoBps))} times the largest gap on any path where protection did not bind. It describes no path, which is why both numbers are printed.
                  </p>,
                ]}
              />
              <details className="fig-notes">
                <summary>How this figure was drawn, and what its intervals are</summary>
                <p className="fig-dek">Every one of the <Num>{n0(MIXTURE.nPairs)}</Num> paired gaps in cost-inclusive terminal equity, arm A
                  minus arm H2, in basis points of each path&rsquo;s own opening equity. Bars are counts of paths, not a
                  density, and are not smoothed, a kernel would invent a shape across the empty span that is the whole
                  finding. Every bar is the same width on the symmetric-log horizontal axis, linear to{" "}
                  <Num>{n0(MIXTURE.symlogConstant)}</Num> bps, logarithmic beyond, the same scale as <Fig id="per-cell" />, which
                  makes one bar <Num>{n1(MIXTURE.binWidthNarrowestBps)}</Num> bps wide at the left of the axis and{" "}
                  <Num>{n0(Math.round(MIXTURE.binWidthWidestBps))}</Num> bps wide at the right. The dashed rule is the
                  confirmatory pooled median, <Num>{bps(MIXTURE.pooledMedianBps)}</Num>.</p>
                <p className="fig-dek">every count tallied from T1-runs.jsonl and checked against the published mixture before drawing;
                  material median off by {sci(MIXTURE.medianDeviation)} bps</p>

              </details>
            </div>


            <p>
              The <Num>{n0(MIXTURE.nNegative)}</Num> paths on which the agent finishes <em>behind</em> the modelled
              human are in here too, as the short bar left of zero, at most{" "}
              <Num>{bps(Math.abs(MIXTURE.worstNegativeBps))}</Num> each. Every one of them comes from{" "}
              <code className="num">{MIXTURE.negativeShock}</code>, the shock that drops and then recovers, which is
              also the shock behind every gap above <Num>{n0(MIXTURE.farThresholdBps)}</Num> bps, all{" "}
              <Num>{n0(MIXTURE.nFar)}</Num> of them. The largest wins in this study come from the same
              shock seen from two sides, and the full study takes that up.
            </p>

            {/* ------------------------------------------------------------- */}

            <H2 id="conditions" n="2">
              In which conditions
            </H2>

            <StatCards
              cells={[
                { label: "Largest per-cell effect", value: `${n0(Math.round(cellSpan.hi))} bps`, caption: "the wick that recovers, one book, at night" , highlight: true },
                { label: "Smallest per-cell effect", value: `${n1(cellSpan.lo)} bps`, caption: "the slow grind in working hours, a person has three hours" },
                { label: "Cells whose 95% interval reaches zero", value: `${n0(cellRows.filter((r) => r.lo95 <= 0).length)} of ${n0(cellRows.length)}`, caption: "the largest effects in the study are also its least certain" },
              ]}
            />

            <p>
              The pooled effect is an average over sixteen deliberately different worlds, and it hides almost
              everything. Split by cell, the agent is worth nothing at all on the slow grind during working hours, a
              28% drift over eight hours leaves a human three hours of slack between crossing the trigger and health
              factor 1.0, and three hours is enough for anyone. On a 35% wick that prints for three seconds and stays
              down, it is worth four hundred basis points. On the wick that recovers, where being liquidated is the
              most expensive thing that happens anywhere in this study, it is worth fifty times that.
            </p>

            <div className="full report-scrolly" id="per-cell">
              <Scrolly
                label={`Figure ${figNo("per-cell")}`}
                graphic={
                  <ChartFrame
                    kicker={`Figure ${figNo("per-cell")}`}
                    title={<>Where the shock leaves a human time, the agent is worth nothing; where it does not, it is worth two
                  orders of magnitude more.</>}
                    tiers={["OFFCHAIN-SIM", "MODELLED"]}
                    n={<>n = {n0(c1.nPairs)} paired paths · {design.cells} cells</>}
                    csv={PER_CELL_CSV}
                  table={<><div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cell</th>
                        <th className="col-num">Books</th>
                        <th className="col-num">n</th>
                        <th className="col-num">Median gap, bps</th>
                        <th className="col-num">50% interval</th>
                        <th className="col-num">95% interval</th>
                        <th className="col-num">A ahead</th>
                        <th className="col-num">H2 ahead</th>
                        <th className="col-num">Ties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PER_CELL_ROWS.map((r) => (
                        <tr key={r.cell} className={r.kind === "pooled" ? "headline" : undefined}>
                          <td className="col-mono">{r.cell}</td>
                          <td className="col-num">{r.books ?? "–"}</td>
                          <td className="col-num">{n0(r.n)}</td>
                          <td className="col-num">{n1(r.d)}</td>
                          <td className="col-num">
                            {r.lo50 === null || r.hi50 === null ? "–" : `${n1(r.lo50)} – ${n1(r.hi50)}`}
                          </td>
                          <td className="col-num">
                            {n1(r.lo95)} – {n1(r.hi95)}
                          </td>
                          <td className="col-num">{n0(r.aWins)}</td>
                          <td className="col-num">{n0(r.h2Wins)}</td>
                          <td className="col-num">{n0(r.ties)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div></>}
                  >
                    <ForestChart />
                  </ChartFrame>
                }
                steps={[
                  <p key="s0">
                    <strong>Sixteen cells, largest effect first.</strong> Shock × clock × books, {design.pathsPerCell} paired paths each. The thick rule is the {CI_INNER} interval and the thin one the {CI_OUTER}, both the study&rsquo;s own bootstrap.
                  </p>,
                  <p key="s1">
                    <strong>The wick that recovers carries the largest effects and the least certain ones.</strong> On both one-book <code className="num">wick-1block</code> cells the {CI_OUTER} interval reaches all the way to zero, because a third of the paths are exact ties: the trough is long enough for the agent to act and long enough for a liquidator to reach the human too.
                  </p>,
                  <p key="s2">
                    <strong>Where the shock leaves a person time, the agent is worth nothing.</strong> On the slow grind and the crash during working hours the median gap is a keeper fee at most; three hours of slack between the trigger and health factor 1.0 is enough for anyone.
                  </p>,
                  <p key="s3">
                    <strong>Move the same two shocks to 01:00 and the gap opens.</strong> The person on a schedule is asleep, the agent is not, and the difference is the cost of a liquidation on that position.
                  </p>,
                  <p key="s4">
                    <strong>The diamond is C1, pooled over all {n0(c1.nPairs)} paths</strong>, <Num>{bps(c1.medianGapBps)}</Num> with the study&rsquo;s BCa interval. It is the confirmatory result and the least descriptive number on the figure.
                  </p>,
                ]}
              />
              <details className="fig-notes">
                <summary>How this figure was drawn, and what its intervals are</summary>
                <p className="fig-dek">Median paired gap in cost-inclusive terminal equity, arm A minus arm H2, in basis points of each
                  path&rsquo;s own opening equity, one row per cell and n = {design.pathsPerCell} paired paths each.
                  Thick rule {CI_INNER}, thin rule {CI_OUTER}. The horizontal scale is symmetric-log, linear to 10 bps,
                  logarithmic beyond, because the sixteen effects span {n1(cellSpan.lo)} to{" "}
                  {n0(Math.round(cellSpan.hi))} bps and a linear axis stacks twelve of them on the
                  null rule. Rows run largest effect first; a dashed rule reaching the null is a cell whose
                  lower bound the bootstrap could not lift off zero, not a very wide interval. The diamond
                  below the separating rule is C1, pooled over all {n0(c1.nPairs)} paths, with the
                  study&rsquo;s own BCa interval.</p>
                <p className="fig-dek"><strong>Where these sixteen intervals come from.</strong> They are the study&rsquo;s, not this
                  page&rsquo;s: a {PER_CELL_METHOD.estimator} bootstrap over that cell&rsquo;s own{" "}
                  {design.pathsPerCell} paired gaps, resampling <em>pairs</em>, so the pairing the design paid
                  for survives, at {n0(PER_CELL_METHOD.resamples)} resamples, one seed per cell from the
                  analysis block starting at {n0(PER_CELL_METHOD.seedBase)}, computed by{" "}
                  <code className="num">sim/full.ts</code> and published as{" "}
                  <code className="num">medianGapAvsH2Ci95</code> and{" "}
                  <code className="num">medianGapAvsH2Ci50</code> in T1-confirmatory.json. Until recently this
                  page computed them itself, from the run ledger, because the study published seven pooled
                  intervals and this figure needs sixteen per-cell ones; the arithmetic was right and it was
                  still the wrong place, because a figure carrying a statistic the study does not publish is a
                  statistic no reader can check. <strong>Exploratory and uncorrected</strong>, sixteen
                  intervals, no Holm, no multiplicity adjustment of any kind, so the widest of sixteen is a
                  maximum over sixteen draws rather than a finding. The acceleration is degenerate on{" "}
                  {PER_CELL_METHOD.nAccelerationDegenerate === cellRows.length
                    ? "all sixteen"
                    : n0(PER_CELL_METHOD.nAccelerationDegenerate)}{" "}
                  of them, as it is on C1&rsquo;s, because the jackknife of a median takes two or three distinct
                  values: each is in practice a bias-corrected percentile interval, and the artefact says so per
                  row rather than letting the letters BCa imply an accuracy it does not have.</p>
                <p className="fig-dek">intervals read from T1-confirmatory.json, not computed here; every median re-derived from
                  T1-runs.jsonl before drawing, worst disagreement with the published figure{" "}
                  {sci(PER_CELL_METHOD.worstMedianDeviation)}</p>

              </details>
            </div>


            <p>
              Read the two widest intervals rather than the two largest dots. On both{" "}
              <code className="num">wick-1block</code> one-book cells the 95% interval reaches all the way down to
              zero, because a third of the paths in each are exact ties, the trough is long enough for the agent to
              act, but also long enough for a liquidator to reach the human, and when both are seized in the same state
              they finish identical. The largest effects in this study are also its least certain, and a forest plot is
              the form that says so without being asked.
            </p>

            {/* ------------------------------------------------------------- */}


            {/* --------------------------------------------------------------
                §4. The apparatus, last, because a reader with four minutes
                should reach the result before the machinery. Every number in
                this section is lifted out of T1-confirmatory.json by the render
                script under the same rule as the figures: nothing quantitative
                is typed into this file. */}

            <H2 id="method" n="3">
              How it was measured
            </H2>

            <StatCards
              cells={[
                { label: "Crossed cells · shock × clock × books", value: n0(design.cells), caption: `${design.pathsPerCell} paired price paths each, ${n0(design.paths)} in all` },
                { label: "Arm-runs, one price path replayed across five arms", value: n0(design.runs), caption: "the market and the searchers are shared; only an arm's own actions move its state" },
                { label: "Book-level ledgers", value: n0(design.bookRuns), caption: "every one regenerable byte for byte from the committed seeds and constants" },
              ]}
            />

            <p>
              A simulation, and the label is on every figure. One exogenous price path is generated first, a
              shock shape plus idiosyncratic volatility of{" "}
              <Num>{pct(METHOD.position.volDaily)}</Num> a day, measured on BNB Chain mainnet, and then{" "}
              <em>replayed</em> across all five arms. On a three-book cell the three liquidators are replayed
              too. The market and the searchers are therefore shared, only an arm&rsquo;s own actions move its
              own state, and every test on this page is paired for that reason. An unpaired test would throw
              away the variance reduction the whole design exists to get.
            </p>

            <h3 id="arms">
              <span className="secnum">3.1</span>
              The five arms, and which two the confirmatory test is between
            </h3>

            <dl className="apparatus">
              {METHOD_ARMS.map((a) => (
                <Fragment key={a.arm}>
                  <dt>
                    {a.arm} · {a.status}
                  </dt>
                  <dd>
                    <Evidence kind={a.label === "MODELLED" ? "modelled" : "sim"} /> {ARM_ROLE[a.arm]}
                  </dd>
                </Fragment>
              ))}
            </dl>

            <p style={{ marginTop: "1.6rem" }}>
              <strong>Three of the five are models of a person and none of them is a measurement of one.</strong>{" "}
              Every parameter of H1, H2 and H3 is published and none is fitted to this study&rsquo;s data, which
              is the most that can be said for a modelled comparator. The arm that would have settled it, a
              runnable rule-based comparator a reviewer could execute themselves, was removed by the
              operator&rsquo;s decision and has no substitute here. A reader who declines to accept a modelled
              baseline is left with the agent against passive, and that column is on this page rather than in a
              footnote. Each arm below ran all <Num>{n0(methodArm("A").n)}</Num> paths.
            </p>

            <div className="table-wrap breakout">
              <table>
                <thead>
                  <tr>
                    <th>Arm</th>
                    <th className="col-num">Book survival</th>
                    <th className="col-num">Portfolio survival</th>
                    <th className="col-num">Median return</th>
                    <th className="col-num">Latency, 1 book</th>
                    <th className="col-num">Latency, last of 3</th>
                    <th className="col-num">Tx per run, 1 / 3</th>
                  </tr>
                </thead>
                <tbody>
                  {METHOD_ARMS.map((a) => (
                    <tr key={a.arm} className={a.status === "confirmatory" ? "headline" : undefined}>
                      <td className="col-mono">{a.arm}</td>
                      <td className="col-num">{n3(a.bookSurvival)}</td>
                      <td className="col-num">{n3(a.portfolioSurvival)}</td>
                      <td className="col-num">{pct(a.medianReturn)}</td>
                      <td className="col-num">{a.latencyOneSec === null ? "–" : `${n1(a.latencyOneSec)} s`}</td>
                      <td className="col-num">
                        {a.latencyThreeSec === null ? "–" : `${n1(a.latencyThreeSec)} s`}
                      </td>
                      <td className="col-num">
                        {n3(a.txOne)} / {n3(a.txThree)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="muted" style={{ fontSize: "15px" }}>
              <strong>The two survival columns are two different questions and only the first is comparable
              across this design.</strong> Book survival is positions kept over positions held, so the Books
              axis divides out of it. Portfolio survival is whether <em>every</em> book came through, which is a
              three-of-three event on half the design and a one-of-one on the other: the agent&rsquo;s falls
              from <Num>{pct(BOOKS.portfolioSurvival.one)}</Num> at one book to{" "}
              <Num>{pct(BOOKS.portfolioSurvival.three)}</Num> at three while its book rate falls only from{" "}
              <Num>{pct(BOOKS.bookSurvivalPooled.one)}</Num> to{" "}
              <Num>{pct(BOOKS.bookSurvivalPooled.three)}</Num>, and the difference between those two falls is
              the axis rather than the policy. That is why every survival figure on this page is book-level and
              why the portfolio column appears here, beside its own denominator, and nowhere else. The intervals
              on all of them, {n0(BOOKS.nRates)} rates and {n0(BOOKS.nContrasts)} differences, are in{" "}
              <code className="num">exploratory.survivalUncertainty</code> of T1-confirmatory.json.
            </p>

            <p className="muted" style={{ fontSize: "15px" }}>
              <strong>Every arm finishes down about half.</strong> The market itself falls on every path in
              this study, so the return column is a property of the shocks and not of any policy, the agent
              ends at <Num>{pct(methodArm("A").medianReturn)}</Num> and passive at{" "}
              <Num>{pct(methodArm("P").medianReturn)}</Num>, and the whole finding lives in the difference
              between two arms on the <em>same</em> path rather than anywhere in that column. The two latency
              columns are also two different quantities and are never summed: at one book it is the time to
              protect the only book, at three the time to protect the <em>last</em> of three under the
              round-robin. Pooling them was the fifth defect in <a href="#corrections">§0</a>.
            </p>

            <h3 id="venue">
              <span className="secnum">3.2</span>
              The position, and the venue rule tuple that scored it
            </h3>

            <p>
              A venue is a tuple read from published parameters, not a label. Swapping the label without
              swapping the rule is not a variable, so the tuple is printed rather than named, and two of its
              rows are marked <span className="num">PROVISIONAL</span> because they are Aave V3&rsquo;s canonical
              rule <em>adopted</em>, not a parameter read from a named venue&rsquo;s published configuration.
              Every arm starts from the identical position on every path, per book.
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th className="col-num">Value</th>
                    <th>Where it comes from</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Opening equity, per book</td>
                    <td className="col-num">{n2(METHOD.position.openingEquityPerBookN)} N</td>
                    <td>the denominator every basis point on this page is of</td>
                  </tr>
                  <tr>
                    <td>Health factor at open / trigger / target</td>
                    <td className="col-num">
                      {n2(METHOD.position.hf0)} / {n2(METHOD.position.triggerHf)} /{" "}
                      {n1(METHOD.position.targetHf)}
                    </td>
                    <td>frozen in the plan before the run</td>
                  </tr>
                  <tr>
                    <td>Liquidation threshold</td>
                    <td className="col-num">{n0(METHOD.position.ltBps)} bps</td>
                    <td>read from the chain-97 deploy script</td>
                  </tr>
                  <tr>
                    <td>Close factor</td>
                    <td className="col-num">{n0(METHOD.position.closeFactorBps)} bps</td>
                    <td>
                      <span className="num">PROVISIONAL</span>, Aave V3&rsquo;s canonical rule, adopted because
                      the mock pool has no liquidation entry point to mirror. Rises to the whole debt below health
                      factor {n2(METHOD.position.closeFactorFullBelowHf)}, and is read at the moment of seizure
                      rather than applied as a constant.
                    </td>
                  </tr>
                  <tr>
                    <td>Liquidation bonus</td>
                    <td className="col-num">{n0(METHOD.position.liquidationBonusBps)} bps</td>
                    <td>
                      <span className="num">PROVISIONAL</span>, the low end of the plan&rsquo;s range, which is
                      the choice that flatters the agent least. the study rescores the
                      other end.
                    </td>
                  </tr>
                  <tr>
                    <td>Keeper fee</td>
                    <td className="col-num">{n0(METHOD.position.keeperFeeBps)} bps</td>
                    <td>of the amount pulled; measured from the deployed contract&rsquo;s own source</td>
                  </tr>
                  <tr>
                    <td>Gas</td>
                    <td className="col-num">{n5(METHOD.position.gasCostPerTxN)} N</td>
                    <td>per transaction, reconciled against a real BNB Chain mainnet gas ledger</td>
                  </tr>
                  <tr>
                    <td>Idiosyncratic volatility</td>
                    <td className="col-num">{pct(METHOD.position.volDaily)}</td>
                    <td>realised daily volatility, measured on BNB Chain mainnet</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              At that opening health factor the position crosses the trigger on a{" "}
              <Num>{pct(METHOD.wickGeometry.triggerDropFraction)}</Num> fall and health factor 1.0 on a{" "}
              <Num>{pct(METHOD.wickGeometry.liquidatableDropFraction)}</Num> fall. Every shock in the design is
              larger than the second of those, which is what makes passive die by construction, otherwise
              there would be no errand to run and the task would be vacuous. That is a design choice and it is
              stated as one: this study measures what protection is worth in worlds where the position was
              going to be liquidated, and it does not sample the world&rsquo;s own frequency of those.
            </p>

            <p className="muted" style={{ fontSize: "15px" }}>
              The venue record, as the study wrote it:{" "}
              <span className="num">{METHOD.position.venueProvenance.replace(/\s*\u2014\s*/g, ", ")}</span>
            </p>

            <h3 id="race">
              <span className="secnum">3.3</span>
              The race, which is the only mechanism in the study
            </h3>

            <p>
              Everything the agent is worth here comes out of one comparison of delays. The agent observes,
              decides and gets mined in <Num>{n0(METHOD.delay.modelMinSec)}</Num> to{" "}
              <Num>{n0(METHOD.delay.modelMaxSec)}</Num> seconds, a{" "}
              <Num>{n0(METHOD.delay.floorSec)} s</Num> floor measured from a real testnet dip-to-repay
              transaction, up to <Num>{n0(METHOD.delay.jitterMaxSec)} s</Num> of jitter above it, and a{" "}
              <Num>{n0(METHOD.delay.chainMineSec)} s</Num> block, and it is charged{" "}
              <Num>{n0(METHOD.delay.agentPerExtraBookSec)} s</Num> for each extra book, one protect per block,
              round-robin. The human is charged <Num>{n0(METHOD.delay.humanPerExtraBookSec)} s</Num> per extra
              book, sequential hands, which is the plan&rsquo;s own figure and not this study&rsquo;s. Against
              both of them stands a liquidator drawn <span className="num">LogNormal</span> with a median of{" "}
              <Num>{n0(METHOD.delay.liquidatorMedianSec)} s</Num>, labelled{" "}
              <span className="num">{METHOD.delay.liquidatorLabel}</span>, because it is a target rather than a
              measurement, and because <strong>mainnet MEV is faster than it</strong>.
            </p>

            <p>
              <strong>The agent&rsquo;s per-book cost is deliberately an upper bound.</strong> A keeper batching
              consecutive nonces lands all three books in one block, which would make the marginal cost zero,
              and zero would decide the parallelism question by assumption rather than by measurement. So the
              agent is charged a whole block per book and every figure on this page understates it. The same
              rule runs the other way on the liquidator: the three books draw three independent searchers, so
              some of them draw a slow one a slow hand can still beat. Perfectly correlated liquidators would
              kill every book at once and hand the agent the axis for free.
            </p>

            <div className="table-wrap breakout">
              <table>
                <thead>
                  <tr>
                    <th className="col-num">Book</th>
                    <th className="col-num">Offset</th>
                    <th className="col-num">Its own model band</th>
                    <th className="col-num">Records</th>
                    <th className="col-num">Observed band</th>
                    <th className="col-num">Median</th>
                    <th>Inside its own band</th>
                  </tr>
                </thead>
                <tbody>
                  {METHOD.delay.rows.map((r) => (
                    <tr key={r.bookIndex}>
                      <td className="col-num">{r.bookIndex}</td>
                      <td className="col-num">+{n0(r.offsetSec)} s</td>
                      <td className="col-num">
                        {n0(r.modelMinSec)}–{n0(r.modelMaxSec)} s
                      </td>
                      <td className="col-num">{n0(r.nUncensored)}</td>
                      <td className="col-num">
                        {n3(r.observedMinSec)}–{n3(r.observedMaxSec)} s
                      </td>
                      <td className="col-num">{n3(r.observedMedianSec)} s</td>
                      <td>{r.inside ? "yes" : "NO"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              All <Num>{n0(METHOD.delay.nUncensored)}</Num> uncensored book records the agent produced sit
              inside the band that book&rsquo;s own offset gives it, so the latency model is not violated
              anywhere in the study. Printing this per book rather than pooled is{" "}
              <a href="#corrections">§0</a>&rsquo;s fourth defect: pooled and set beside book 0&rsquo;s band
              alone, the same records read as the agent missing its own model by six seconds, and that was the
              one correction in this study that took something <em>back</em> from the agent.
            </p>

            <h3 id="cost">
              <span className="secnum">3.4</span>
              What one protect costs, and what one seizure costs
            </h3>

            <p>
              A repayment retires debt rather than destroying it, so a protect costs the keeper fee plus one
              transaction of gas and nothing else. Almost the entire gap against a human is therefore an{" "}
              <em>avoided seizure</em>, and what a seizure is worth is not the liquidator&rsquo;s discount as
              the ledger memos it, which is marked at the seizure price. What it takes out of the primary is
              marked at the <em>terminal</em> price, and the two coincide only when the price does not move
              afterwards.
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th className="col-num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Book pairs where the human was seized and the agent was not</td>
                    <td className="col-num">
                      {n0(METHOD.cost.nSeizedPairs)} of {n0(METHOD.cost.nPairsTotal)}
                    </td>
                  </tr>
                  <tr>
                    <td>Median seizure, as the ledger memos it</td>
                    <td className="col-num">
                      {n2(METHOD.cost.medianMemoN)} N = {n1(METHOD.cost.medianMemoBps)} bps
                    </td>
                  </tr>
                  <tr className="headline">
                    <td>Median cost of that seizure to terminal equity</td>
                    <td className="col-num">
                      {n2(METHOD.cost.medianTerminalCostN)} N = {n1(METHOD.cost.medianTerminalCostBps)} bps
                    </td>
                  </tr>
                  <tr>
                    <td>Ratio of the true cost to the memo, min, median, max</td>
                    <td className="col-num">
                      {n3(METHOD.cost.minRatioTrueOverMemo)}, {n3(METHOD.cost.medianRatioTrueOverMemo)},{" "}
                      {n3(METHOD.cost.maxRatioTrueOverMemo)}
                    </td>
                  </tr>
                  <tr>
                    <td>Largest transaction count on any single arm-path</td>
                    <td className="col-num">{n0(METHOD.gas.maxTxOnAnyRun)}</td>
                  </tr>
                  <tr>
                    <td>Largest whole gas line on any arm-path</td>
                    <td className="col-num">
                      {n5(METHOD.gas.maxGasLineN)} N = {n3(METHOD.gas.maxGasLineBps)} bps
                    </td>
                  </tr>
                  <tr>
                    <td>Accounting identity residual over every pair</td>
                    <td className="col-num">{sci(METHOD.cost.identityResidualN)} N</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              <strong>That ratio crosses one, and the direction it crosses in is the reason the study quotes
              the harder number.</strong> On paths where the price ticks up after a seizure the memo{" "}
              <em>understates</em> what was lost, by as much as{" "}
              <Num>×{n1(METHOD.cost.maxRatioTrueOverMemo)}</Num>; on paths where it keeps falling the memo
              overstates it. Quoting the memo would have been the flattering choice on most paths and the wrong
              one on all of them, so this study prints the terminal-equity cost and puts the memo beside it.
              Gas is charged in numeraire rather than in the chain&rsquo;s own token, a disclosed compromise,
              and the bound on the error it introduces is computed from the run rather than assumed:{" "}
              <Num>{n3(METHOD.gas.maxMarkErrorBps)} bps</Num> at worst, against effects measured in hundreds.
            </p>

            <h3 id="tests">
              <span className="secnum">3.5</span>
              The tests, and the correction applied over them
            </h3>

            <p>
              Wilcoxon signed-rank on the paired endpoint for C1; a paths-resampled bootstrap for C1b, with the
              pairing preserved <em>inside</em> every replicate, both arms are recomputed on the same resampled
              set, because resampling the arms independently would destroy the correlation the design exists to
              exploit. Both are two-sided against a pre-registered direction, which is the conservative choice
              and roughly doubles each p.
            </p>

            <div className="table-wrap breakout">
              <table>
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Comparison</th>
                    <th className="col-num">p, raw</th>
                    <th className="col-num">p, Holm over {METHOD.holm.length}</th>
                    <th>Rejected at α = 0.05</th>
                  </tr>
                </thead>
                <tbody>
                  {METHOD.holm.map((h) => (
                    <tr key={h.id} className="headline">
                      <td className="col-mono">{h.id}</td>
                      <td>{h.comparison}</td>
                      <td className="col-num">{pValue(h.pRaw)}</td>
                      <td className="col-num">{pValue(h.pAdjusted)}</td>
                      <td>{h.rejected ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              <strong>The family is two, and the plan pre-registered four.</strong> A p corrected over two is
              not comparable with a p corrected over four, so the page says which was applied rather than
              leaving a reader to assume: the other two tests belong to tasks that are not in this study, and
              correcting over tests that were never run would be a courtesy to nobody.
            </p>

            <p>
              Separately from the two tests, the plan wrote{" "}
              <Num>{n0(METHOD.prereg.byKind.reduce((t, k) => t + k.n, 0))}</Num> survival predictions before any
              path existed, and <Num>{n0(METHOD.prereg.nFalsified)}</Num> of them are falsified at α = 0.05.{" "}
              <strong>Which ones is the finding.</strong>
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kind of target</th>
                    <th className="col-num">Written</th>
                    <th className="col-num">Falsified at α = 0.05</th>
                  </tr>
                </thead>
                <tbody>
                  {METHOD.prereg.byKind.map((k) => (
                    <tr key={k.kind} className={k.nFalsified > 0 ? "headline" : undefined}>
                      <td>{PREREG_KIND[k.kind]}</td>
                      <td className="col-num">{n0(k.n)}</td>
                      <td className="col-num">{n0(k.nFalsified)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              Every falsification lands on a number the plan asserted without printing its arithmetic, and not
              one lands on a number re-derived from the model&rsquo;s own frozen constants. That is the
              strongest internal-consistency evidence in the study, the simulator does what its published
              inputs say it should, and where it disagrees with the pre-registration it is the
              pre-registration&rsquo;s prose that was wrong. The two kinds are separate columns in the artefact
              so the claim can be checked rather than taken, and where a target was re-derived the planned
              figure it replaced is printed beside it. Re-deriving a prediction from published inputs is not
              the same act as tuning an input until a prediction comes true.
            </p>

            <h3 id="seeds">
              <span className="secnum">3.6</span>
              Seeds, and how to run it yourself
            </h3>

            <p>
              Seed block <span className="num">{METHOD.seeds.block}</span>, fifty contiguous seeds per cell,
              bootstrap seed <Num>{n0(METHOD.seeds.bootstrapSeed)}</Num> at{" "}
              <Num>{n0(METHOD.seeds.bootstrapIters)}</Num> resamples. The exogenous streams, the price path and
              each book&rsquo;s liquidator, exclude the arm from their key, which is what makes every arm face
              the same market and the same searchers; the arm-internal streams include the arm name, so adding
              or removing an arm perturbs no other arm&rsquo;s draw. Determinism is proved by regenerating the
              whole population from the same seeds and comparing digests, and again by re-running the engine on
              a sample of paths and comparing serialised results byte for byte, which covers the arm-internal
              streams a path digest cannot see.
            </p>

            <p className="muted" style={{ fontSize: "15px" }}>
              The corrections in <a href="#corrections">§0</a> were applied with the study&rsquo;s{" "}
              <span className="num">--rescore</span> step, which recomputes the manifest&rsquo;s own digests over the
              files as they sit on disk and refuses to proceed if either has moved. A defect in an estimator, a
              renderer or a label is not a defect in the runs, and re-running the runs to fix one would have
              discarded the byte-identical reproduction an independent replay had already established over
              them.
            </p>

            <details>
              <summary>Show the seed block for all {n0(METHOD.seeds.perCell.length)} cells</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cell</th>
                      <th className="col-num">Books</th>
                      <th className="col-num">Paths</th>
                      <th className="col-num">Seeds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METHOD.seeds.perCell.map((c) => (
                      <tr key={c.cell}>
                        <td className="col-mono">{c.cell}</td>
                        <td className="col-num">{c.books}</td>
                        <td className="col-num">{n0(c.seeds.length)}</td>
                        <td className="col-num">
                          {n0(c.seeds[0])}…{n0(c.seeds[c.seeds.length - 1])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ fontSize: "14px", margin: "0 0 1rem" }}>
                {METHOD.seeds.relationToPlan}
              </p>
            </details>


            {/* --------------------------------------------------------------
                §5. The limitations, in the page's own voice rather than
                condensed away. A study that names the sentence it does not
                support is worth more than one that leaves a reader to find it. */}

            <H2 id="limits" n="4">
              What this does not show
            </H2>

            <StatCards
              cells={[
                { label: "The agent against passive, for a reader who rejects a modelled person", value: bps(STUDY.passive.medianGapBps), caption: `ahead on ${n0(c1.aAhead)} paths · the column that survives every objection below` },
                { label: "Liquidator median delay this study ran", value: `${n0(METHOD.delay.liquidatorMedianSec)} s`, caption: "testnet-shaped · mainnet MEV is faster, and a faster liquidator is a pre-registered way to lose that was not run", highlight: true },
                { label: "Book counts tested", value: "1 and 3", caption: "nothing here supports an extrapolation to a large book count; the sign and the mechanism are established at three" },
              ]}
            />

            <p>
              None of the following is a hedge added at the end. Each one is a decision that was taken before
              the run and is on the page because a reader is entitled to attack it.
            </p>

            <ol className="limits">
              <li>
                <strong>The human is a model, not a person.</strong> Every parameter of the three human arms is
                published and none is fitted, but a reader who declines a modelled baseline should reject those
                three columns and read the agent against passive, {" "}
                <Num>{bps(STUDY.passive.medianGapBps)}</Num>. The runnable non-agent comparator that would have
                settled it was removed and has no substitute.
              </li>
              <li>
                <strong>One venue rule tuple</strong>, Aave-V3-shaped, and its close factor is that
                rule&rsquo;s canonical form <em>adopted</em> rather than read from a named venue&rsquo;s
                published configuration. Not Venus, not Lista, not three integrations.
              </li>
              <li>
                <strong>The liquidator is testnet-shaped</strong> at a median of{" "}
                <Num>{n0(METHOD.delay.liquidatorMedianSec)} s</Num>. Mainnet MEV is faster, and a faster
                liquidator is a pre-registered way for the agent to lose that this study does not run.
              </li>
              <li>
                <strong>The books axis has two levels, one and three.</strong> The interpolation check at two
                books was not run and nothing here supports an extrapolation to a large book count. What is
                established is the sign and the mechanism at three.
              </li>
              <li>
                <strong>Only one of the four shocks rewards holding.</strong> The mixture{" "}
                <a href="#how-much"><Fig id="mixture" /></a> shows is one the design chose, not one the world
                produced. Converting these basis points into an expectation needs the real-world weight between{" "}
                <em>the fall persists</em> and <em>the market repairs itself</em>, and this study does not
                estimate it.
              </li>
              <li>
                <strong>The pre-registration was not hashed.</strong> What survives of it is the discipline:
                predictions written into the code before the run, printed beside what was observed, and
                reported as failed when they fail. A reader who wants the stronger guarantee should note that
                this is not it.
              </li>
              <li>
                <strong>Interest is off</strong>, because the mock pool accrues none. Any venue where it is not
                zero moves every arm here, since all of them carry debt for the whole path.
              </li>
              <li>
                <strong>One contrast is unpaired on the thing it tests.</strong> The two realistic humans draw
                independent availability schedules, so the comparison that isolates a sleep window has far less
                power than its sample size suggests. It is reported as a null this design cannot resolve rather
                than as evidence that sleep does not matter.
              </li>
              <li>
                <strong>Testnet units are not dollars</strong> and are never converted to any. Nothing on this
                page is a claim about money made or lost on BNB Chain mainnet. Only chains 56 and 97 appear as
                sources anywhere in the study.
              </li>
            </ol>

            <div className="closing">
              <p className="closing-kicker">The sentence this study supports</p>
              <p className="closing-yes">
                On a simulated Aave-V3-shaped liquidation drill, an always-on keeper finishes ahead of a
                published model of a realistically-available human by a median of{" "}
                <Num>{bps(c1.medianGapBps)}</Num> of opening equity across {design.cells} crossed cells, {" "}
                <Num>{n0(c1.nPairs)}</Num> paired paths, p = {sci(c1.pTwoSided)} two-sided, Holm-corrected
                over the two tests that were run, and on the <Num>{pct(mixture.materialFraction)}</Num> of paths where
                protection actually binds that median is <Num>{bps(mixture.materialMedianBps)}</Num>. The
                advantage over an <em>attentive</em> human comes almost entirely from working more than one
                position at once.
              </p>
              <p className="closing-kicker">And the one it does not</p>
              <p className="closing-no">
                Any claim about dollars, about mainnet, about a venue other than the single rule tuple modelled
                here, about a liquidator faster than{" "}
                <Num>{n0(METHOD.delay.liquidatorMedianSec)} s</Num>, or about a book count larger than three.
              </p>
            </div>

            <p className="muted" style={{ fontSize: "15px", marginTop: "2.5rem" }}>
              Every figure on this page is drawn from a module compiled at build time out of{" "}
              <code className="num">T1-confirmatory.json</code> and the run ledgers, and rendered on the server;
              scrolling changes which marks are lit and never what they say, and the numbers in the markup are the
              numbers in the artefact.
            </p>
          </div>
          <ChapterRail chapters={SECTIONS} back={{ href: "/brief", label: `The three findings · ${BRIEF.links.brief.minutes} min` }} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

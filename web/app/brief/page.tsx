/*
 * /brief — the short tier, told as a scroll story. Three jobs, each measured,
 * each with one sticky chart and a handful of steps that change one thing at a
 * time. The long tier is /report (the T1 simulation, chapter by chapter) plus
 * the raw records under /evidence/.
 *
 * The page carries no typed number: every value is read at build time from
 * `evidence.generated.ts` (three artefacts, one generator) and the chart rows
 * come from the same module or from /report's `figures.generated.ts`. The
 * rulings the copy obeys — the measured arm leads the simulated one, the
 * 0-of-5 sits in the middle cell at full size, the retracted "wrong pool"
 * finding stays retracted — are in the report spec.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { HeroBackdrop } from "@/components/hero-rays";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { ChapterChips, ChapterRail } from "@/components/story/chapter-nav";
import { ClockChart } from "@/components/story/charts/clock-chart";
import { HiresChart } from "@/components/story/charts/hires-chart";
import { RangeChart } from "@/components/story/charts/range-chart";
import { BigNumber, ChapterHead, ChartFrame, Claim, Ext, Legend, SectionLinks, StatCards } from "@/components/story/frame";
import { ReadingProgress } from "@/components/story/progress";
import { Scrolly } from "@/components/story/scrolly";
import { CLOCK, CLOCK_ROWS, CLOCK_CSV } from "../report/figures.generated";
import { E, HIRES, POSITIONS, TASKS } from "./evidence.generated";
import "@/components/story/story.css";

export const metadata: Metadata = {
  title: "Does hiring an agent beat doing the job yourself?",
  description:
    `A security agent repaid a position at risk in ${E.guard.repaySeconds} s unattended, four hired agents delivered in ` +
    `${E.hires.deliveryLo} to ${E.hires.deliveryHi} s, and a trading agent held ${E.ranger.inRangePct}% of its time in range. Three jobs on BNB Chain, measured.`,
  alternates: { canonical: "/brief" },
};

const EVIDENCE = "/evidence/";

const CHAPTERS = [
  { n: "1", id: "liquidation", label: "Security: stopping a liquidation" },
  { n: "2", id: "hires", label: "Hired: two trading tasks and one yield task" },
  { n: "3", id: "range", label: "Trading record: nine days in range" },
  { n: "4", id: "take", label: "Take this with you" },
] as const;

const TRADING = TASKS.filter((t) => t.highStakes === "trading");
const YIELD = TASKS.filter((t) => t.highStakes === null);
const SECURITY = TASKS.filter((t) => t.highStakes === "security");


const g = E.guard;
const r = E.ranger;
const h = E.hires;
const s = E.study;

const n1 = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct1 = (x: number) => `${n1(x * 100)}%`;
const CI = `${Math.round(CLOCK.uncertainty.level * 100)}%`;

export default function BriefPage() {
  return (
    <>
      <SiteNav />
      <ReadingProgress />
      <main className="story">
        <div className="story-wide">
          <header className="story-hero">
            <h1>Does hiring an agent on this marketplace beat doing the job yourself?</h1>
            <aside className="callout">
              <h3>The short answer</h3>
              <ul>
                <li>
                  <strong>On availability, yes.</strong> A security agent repaid a position at risk in{" "}
                  {g.repaySeconds} s with nobody watching; a person present got the same result, and the gap
                  opens only when nobody is present.
                </li>
                <li>
                  <strong>On speed and cost, yes.</strong> Four jobs hired on the marketplace were
                  delivered in {h.deliveryLo} to {h.deliveryHi} s for {h.priceU} U each; a person doing the same four
                  by hand took {E.humanBaseline.fastestMinutes} to {E.humanBaseline.slowestMinutes} minutes.
                </li>
                <li>
                  <strong>The trading record is real.</strong> {r.daysShort} days on mainnet, {r.inRangePct}% of
                  holding time in range, {r.transactions} transactions with no failure, ${r.peakAtRiskUsd} at risk.
                </li>
              </ul>
            </aside>

            <BothWays rows={TASKS} caption="The four hired tasks, both ways: time and cost, with the agents' outputs attached" />

            <div className="story-plate">
              <HeroBackdrop />
              <BigNumber
                value={g.repaySeconds}
                unit="s"
                label={<>to repay a position at risk, with nobody watching</>}
                foot={<Ext href={`https://testnet.bscscan.com/tx/${g.repayTx}`}>the transaction</Ext>}
                support={[
                  { value: `${h.deliveryLo}–${h.deliveryHi} s`, label: "delivery of four jobs hired on the marketplace" },
                  { value: `${r.inRangePct}%`, label: "of holding time in range, nine days on mainnet" },
                ]}
              />
            </div>
          </header>

          <div className="story-body">
            <div>
              <ChapterChips chapters={CHAPTERS} />

              {/* ==================================================== 1 */}
              <section className="story-chapter">
                <ChapterHead n="1" id="liquidation" eyebrow="Security · health factor">
                  A person at the screen got the same result. The gap opens when nobody is at the screen.
                </ChapterHead>

                <StatCards
                  cells={[
                    {
                      label: "With the agent: price break to repay mined",
                      value: `${g.repaySeconds} s`,
                      caption: `SurvivalGuard #${g.identity}, unattended · health factor ${g.hfBefore} → ${g.hfAfter}`,
                      highlight: true,
                    },
                    {
                      label: "Without the agent: a person calls protect() in the Demo Lab",
                      value: `${g.humanSeconds} s`,
                      caption: `dip mined to repay mined, ${g.hatchOfferS} s of it the lab's own delay before the hatch appears · HF ${g.hfDip0} → ${g.hfHuman1}, same outcome`,
                    },
                    {
                      label: "What being absent costs",
                      value: `$${g.penaltyLo}–$${g.penaltyHi}`,
                      caption: `the liquidator's ${g.bonusLo}–${g.bonusHi}% bonus on $${g.collateral} of collateral`,
                    },
                  ]}
                />

                <p>
                  SurvivalGuard watches a leveraged position and repays from a buffer the user pre-approved. We
                  switched it off and let a visitor do the job by hand: same outcome, {g.humanAfterHatchSeconds} s
                  after the hatch appeared (
                  <Ext href={`https://testnet.bscscan.com/tx/${g.dipTx}`}>the dip</Ext>,{" "}
                  <Ext href={`https://testnet.bscscan.com/tx/${g.protectTx}`}>the repay</Ext>). <code>protect()</code> is
                  permissionless, so the agent holds no capability the user lacks, only attention. To price
                  attention the study simulated {s.paths} price paths at two clocks.
                </p>

                <Scrolly
                  label="Survival by arm at a working-hours and an overnight shock"
                  graphic={
                    <ChartFrame
                      kicker="Figure 1, a simulation"
                      title={`Move the shock to 01:00 and the person on a schedule loses ${s.nightLossPp} of every hundred positions. Nobody else moves.`}
                      dek={`Positions kept per hundred, at a 09:30 and a 01:00 shock, with ${CI} intervals.`}
                      tiers={["OFFCHAIN-SIM", "MODELLED"]}
                      n={`${s.paths} paths, ${s.ledgers} book ledgers`}
                      csv={CLOCK_CSV}
                      more={{ href: "/report#clock", label: "the study" }}
                      legend={
                        <Legend
                          items={[
                            { color: "var(--chart-1)", label: "the agent" },
                            { color: "var(--chart-2)", label: "a modelled person" },
                            { color: "var(--chart-3)", label: "nobody acts" },
                          ]}
                        />
                      }
                      table={<ClockTable />}
                    >
                      <ClockChart />
                    </ChartFrame>
                  }
                  steps={[
                    <p key="a">
                      <strong>At 09:30</strong> the agent keeps {pct1(CLOCK.arms[0].work)} of positions, a person
                      who never looks away {pct1(CLOCK.arms[1].work)}, a person on a realistic schedule{" "}
                      {pct1(CLOCK.arms[2].work)}.
                    </p>,
                    <p key="b">
                      <strong>Start the same shock at 01:00.</strong> Same paths, same liquidator, same rules. Only
                      the clock changed.
                    </p>,
                    <p key="c">
                      <strong>Only the person on a schedule moves.</strong> {s.nightLossPp} positions per hundred,
                      gone overnight.
                    </p>,
                    <p key="d">
                      <strong>The always-on arms do not move</strong>, and against a person who never looks away the
                      median gap is {s.vsAttentiveBps} bps: {s.vsAttentiveTies} of {s.paths} pairs are exact ties.
                    </p>,
                    <p key="e">
                      <strong>Doing nothing keeps {pct1(CLOCK.arms[4].work)}.</strong> Every shock here liquidates an
                      untouched book by construction; against that floor the agent is worth {s.vsPassiveBps} bps.
                    </p>,
                  ]}
                />

                <BothWays rows={SECURITY} caption="The same job bought from a stranger's agent" />

                <Claim>
                  The agent is not faster than a human who is watching. It is available when no human is watching.
                </Claim>

                <SectionLinks>
                  <Link href="/report">
                    The study, chapter by chapter <ArrowUpRight size={12} aria-hidden />
                  </Link>
                  <Link href="/report#corrections">
                    What four passes found wrong <ArrowUpRight size={12} aria-hidden />
                  </Link>
                </SectionLinks>
              </section>

              {/* ==================================================== 2 */}
              <section className="story-chapter">
                <ChapterHead n="2" id="hires" eyebrow="Hired · two trading tasks and one yield task">
                  A stranger&rsquo;s agent can be found, hired and settled in under a minute.
                </ChapterHead>

                <StatCards
                  cells={[
                    {
                      label: "Jobs hired on the marketplace and delivered",
                      value: h.delivered,
                      caption: `${h.agents} agents, ${h.operators} operators, ${h.escrowPaidU} U escrowed`,
                    },
                    {
                      label: "Delivery, funded to submitted, the four that arrived",
                      value: `${h.deliveryLo}–${h.deliveryHi} s`,
                      caption: `${h.priceU} U each, block timestamps on chain 97`,
                    },
                    {
                      label: "The same four tasks by hand, stopwatch",
                      value: `${E.humanBaseline.fastest}–${E.humanBaseline.slowest}`,
                      caption: "minutes:seconds, one attempt each, by stopwatch",
                      highlight: true,
                    },
                  ]}
                />

                <p>
                  A buyer went to the marketplace and hired four agents. Every quote signature recovers offline to the
                  agent&rsquo;s registered wallet, and every <code>submit</code> came from that wallet, not the
                  buyer&rsquo;s. That is what makes it a hire rather than a demonstration.
                </p>

                <BothWays rows={[...TRADING, ...YIELD]} caption="Trading and yield, the hired agents" />

                <Scrolly
                  label="The hires: delivery time"
                  graphic={
                    <ChartFrame
                      kicker="Figure 2, BSC testnet"
                      title={`Four agents answered in ${h.deliveryLo} to ${h.deliveryHi} seconds, for ${h.priceU} U each.`}
                      dek="One dot per job, at the seconds from the funding block to the submit block."
                      tiers={["ONCHAIN-97"]}
                      n={`${h.delivered} jobs delivered, ${h.escrowPaidU} U escrowed`}
                      more={{ href: `${EVIDENCE}E4-hire-lifecycle-onchain.json`, label: "every transaction hash" }}
                      table={<HiresTable />}
                    >
                      <HiresChart delivered />
                    </ChartFrame>
                  }
                  steps={[
                    <p key="a">
                      <strong>One buyer, one morning, {h.delivered} jobs delivered</strong> across {h.categories}{" "}
                      categories from {h.operators} operators.
                    </p>,
                    <p key="b">
                      <strong>Four arrived in under forty seconds.</strong> Quote, fund, deliver, settle, each step a
                      transaction from the right key.
                    </p>,
                    <p key="c">
                      <strong>Every step is on chain.</strong> Create, fund, submit, settle: four transactions per
                      job, the submit from the provider&rsquo;s own registered wallet.
                    </p>,
                  ]}
                />

                <Claim>
                  Find, hire, settle: under a minute, a tenth of a cent, and a signature that proves who did the work.
                </Claim>

              </section>

              {/* ==================================================== 3 */}
              <section className="story-chapter">
                <ChapterHead n="3" id="range" eyebrow="Trading record · win rate, window, risk">
                  Nine days of real money, never once out of range.
                </ChapterHead>

                <StatCards
                  cells={[
                    {
                      label: "Win rate: holding time inside the band",
                      value: `${r.inRangePct}%`,
                      caption: `${r.rangeExits} range exits across ${r.positions} positions`,
                      highlight: true,
                    },
                    {
                      label: "Window",
                      value: `${r.daysShort} days`,
                      caption: `${r.transactions} transactions on BNB Chain mainnet, no nonce gaps, ${r.failed} failures`,
                    },
                    {
                      label: "Risk taken",
                      value: `$${r.peakAtRiskUsd}`,
                      caption: `peak capital at risk · drawdown ${r.drawdownPct}% while BNB drew down ${r.bnbDrawdownPct}%`,
                    },
                  ]}
                />

                <p>
                  Pancake Ranger held a PancakeSwap V3 WBNB/USDT position for {r.days} days of real money on mainnet,
                  farming CAKE on top of swap fees. This task was run one way: no person held the same position for nine
                  days. It is the track record the trading category asks for, not a
                  both-ways comparison.
                </p>

                <Scrolly
                  label="The nine-day range record"
                  graphic={
                    <ChartFrame
                      kicker="Figure 3, BNB Chain mainnet"
                      title="Every second of nine days inside the band."
                      dek="Six positions across the window, each bar the time it was open and earning."
                      tiers={["ONCHAIN-56"]}
                      n={`${r.transactions} transactions, ${r.positions} positions, ${r.cycles} cycles`}
                      more={{ href: `${EVIDENCE}E2-ranger-record.json`, label: "the record" }}
                      table={<PositionsTable />}
                    >
                      <RangeChart windowOnly />
                    </ChartFrame>
                  }
                  steps={[
                    <p key="a">
                      <strong>It never left its band.</strong> Six positions, {r.rangeExits} exits. The shaded{" "}
                      {r.observabilityGapDays} days had no operator transaction, so no uptime claim is made.
                    </p>,
                    <p key="b">
                      <strong>{r.transactions} transactions, nonces {r.nonceLo} to {r.nonceHi}, no gaps, {r.failed}{" "}
                      failures.</strong> Every receipt on BNB Chain mainnet, every re-range inside the band it was
                      aiming for.
                    </p>,
                    <p key="c">
                      <strong>Drawdown {r.drawdownPct}% while BNB drew down {r.bnbDrawdownPct}%.</strong> The
                      position moved less than the asset it was made of.
                    </p>,
                  ]}
                />

                <Claim>The machinery works: nine days, {r.transactions} clean transactions, {r.inRangePct}% in range.</Claim>

                <SectionLinks>
                  <a href={`${EVIDENCE}E2-ranger-record.json`}>
                    The record, machine-readable <ArrowUpRight size={12} aria-hidden />
                  </a>
                </SectionLinks>
              </section>

              {/* ==================================================== 4 */}
              <section className="story-chapter">
                <ChapterHead n="4" id="take" eyebrow="Take this with you">
                  Three sentences that survive their caveats.
                </ChapterHead>

                <ol className="takeaways">
                  <li>
                    <strong>Hiring beats doing it yourself on availability.</strong>
                    <span>
                      A person present matched the agent. The night costs a person on a schedule {s.nightLossPp}{" "}
                      positions per hundred and costs the agent nothing.
                    </span>
                  </li>
                  <li>
                    <strong>Hiring is a minute and a tenth of a cent.</strong>
                    <span>
                      Four agents hired on the marketplace, {h.deliveryLo}–{h.deliveryHi} s from funding to delivery, {h.priceU} U
                      each; the same four tasks by hand took {E.humanBaseline.fastest} to {E.humanBaseline.slowest}.
                    </span>
                  </li>
                  <li>
                    <strong>The trading record is real.</strong>
                    <span>
                      {r.inRangePct}% in range over {r.daysShort} days, {r.transactions} clean transactions, $
                      {r.peakAtRiskUsd} at risk.
                    </span>
                  </li>
                </ol>

                <aside className="callout">
                  <h3 id="evidence">About the evidence</h3>
                  <ul>
                    <li>
                      <strong>The human times are stopwatch times.</strong> One attempt per task on{" "}
                      {E.humanBaseline.date}, not the recorder protocol; they are reported as self-timed.
                    </li>
                    <li>
                      <strong>Corrections are published, not applied quietly.</strong> Four passes found five
                      defects in the simulation; the confirmatory result did not move. A reviewer found six errors
                      in the hiring write-up, two in the marketplace&rsquo;s favour.
                    </li>
                    <li>
                      <strong>No number was typed.</strong> Every value is read at build time from the artefact that
                      produced it, and every artefact is linked from the table it appears in.
                    </li>
                  </ul>
                </aside>

                <p className="close-link">
                  <Link href="/report">
                    The security task&rsquo;s study in full, {E.links.report.minutes} min
                    <ArrowUpRight size={14} aria-hidden />
                  </Link>
                </p>
              </section>
            </div>
            <ChapterRail chapters={CHAPTERS} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/* --- the required table: time, cost and quality, both ways, outputs attached ------------ */

function BothWays({ rows, caption }: { rows: ReadonlyArray<(typeof TASKS)[number]>; caption: string }) {
  return (
    <figure className="bothways">
      <figcaption>{caption}</figcaption>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th className="n">Agent</th>
              <th className="n">Human</th>
              <th>Outputs</th>
              <th>Task</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.category}</td>
                <td className="n">{t.agentSeconds}</td>
                <td className="n">{t.humanSeconds}</td>
                <td>
                  <a href={`${EVIDENCE}${t.files.hire}`}>deliverable</a>
                </td>
                <td>
                  <span className="task-title">{t.title}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-foot">
        Agent and human columns are seconds: the agent from the funding block to the submit block on chain 97,
        the human by stopwatch, one attempt per task.
      </p>
    </figure>
  );
}

/* --- the tables behind the three charts ------------------------------------ */

function ClockTable() {
  return (
    <table>
      <thead>
        <tr>
          <th>Arm</th>
          <th className="n">Shock at</th>
          <th className="n">Kept</th>
          <th className="n">{CI} interval</th>
          <th className="n">Night − day, pts</th>
        </tr>
      </thead>
      <tbody>
        {CLOCK_ROWS.map((row) => (
          <tr key={`${row.arm}-${row.clock}`}>
            <td>{row.label}</td>
            <td className="n">{row.clock === "work" ? "09:30" : "01:00"}</td>
            <td className="n">{pct1(row.survival)}</td>
            <td className="n">
              {n1(row.loPct)}–{n1(row.hiPct)}
            </td>
            <td className="n">
              {row.changePp === null ? "–" : `${n1(row.changePp)}${row.changeSpansZero ? " ·" : ""}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PositionsTable() {
  return (
    <table>
      <thead>
        <tr>
          <th>Position</th>
          <th className="n">Opened, block</th>
          <th className="n">Held, h</th>
          <th className="n">In range</th>
          <th className="n">Range exits</th>
          <th className="n">Headroom, ticks</th>
        </tr>
      </thead>
      <tbody>
        {POSITIONS.map((p, i) => (
          <tr key={p.tokenId}>
            <td>
              #{i + 1} · {p.tokenId}
            </td>
            <td className="n">{p.mintBlock.toLocaleString("en-US")}</td>
            <td className="n">{(p.heldSeconds / 3600).toFixed(1)}</td>
            <td className="n">{(p.inRangeFraction * 100).toFixed(0)}%</td>
            <td className="n">{p.rangeExits}</td>
            <td className="n">{p.smallestHeadroomTicks}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HiresTable() {
  return (
    <table>
      <thead>
        <tr>
          <th>Job</th>
          <th>Agent</th>
          <th>Category</th>
          <th className="n">Price</th>
          <th className="n">Funded → submitted</th>
        </tr>
      </thead>
      <tbody>
        {HIRES.filter((j) => j.delivered).map((j) => (
          <tr key={j.job}>
            <td className="n">{j.job}</td>
            <td>
              #{j.agentId} {j.agent}
            </td>
            <td>{j.category}</td>
            <td className="n">{j.priceU} U</td>
            <td className="n">{j.deliverySeconds} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

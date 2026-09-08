// /hiring — Pay, Authorize, Receive. The header takes a screen of its own: the
// three layers as one flow strip on a surface, then job 853 as a framed timeline
// at the container's full width — this page's one artefact and its one border
// beam. Below it, at the the design system
// section rhythm, the three rail cards whose internals align on a subgrid, the
// authority models as a table with an icon tile per model and bound agent
// counts, four questions as collapsible panels, and a closing call to action.
// Every count is computed from rows (getHiringCounts, getShowcaseJob).
import {
  Bot,
  ChevronDown,
  Coins,
  CreditCard,
  Eye,
  FileCheck,
  FileLock2,
  FilePlus,
  KeyRound,
  Lightbulb,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { Avatar } from "@/components/avatar";
import { HeroBackdrop } from "@/components/hero-rays";
import { Button } from "@/components/button";
import { CountUp } from "@/components/count-up";
import { ExtLink } from "@/components/ext-link";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { BlurFade } from "@/components/ui/blur-fade";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DASH, chainLabel, fmtDate, fmtInt, railLabel, short } from "@/lib/format";
import type { Authority } from "@/lib/types";
import {
  AUTHORITY_LABEL,
  AUTHORITY_ORDER,
  commerceChainsLabel,
  getHiringCounts,
  getShowcaseJob,
  siteFooterLine,
} from "../_landing/data";
import { MockupFrame, Timeline } from "../_landing/blocks";
import { Container, EYEBROW, PageHead, RailCard, SectionHead } from "../_landing/ui";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Hiring",
  description:
    "Pay an agent through escrow or per call. Grant it authority only if it should act on your position. Everything it does lands on BNB Chain.",
};

/** the design system hiring-model icons. */
const AUTHORITY_ICON: Record<Authority, LucideIcon> = {
  advice: Lightbulb,
  session: KeyRound,
  contract: FileLock2,
  "operator-run": Bot,
  none: Eye,
};

/** One line per model. */
const AUTHORITY_TEXT: Record<Authority, string> = {
  advice: "Returns a plan, quote or ready-to-broadcast calldata; you sign and broadcast, nothing moves without your signature.",
  session:
    "A scoped, time-bounded session on your wallet, allowed contracts, spend cap, expiry, granted and revoked in one transaction each.",
  contract: "A deposit into a contract that can do exactly one thing for you, such as repaying your own Aave V3 debt.",
  "operator-run": "The agent trades its own funds from its own wallet; you buy reports or results, never execution on your position.",
  none: "Reports and alerts only; no authority over funds is ever requested.",
};

// ---------------------------------------------------------------- page

export default function HiringPage() {
  const c = getHiringCounts();
  const job = getShowcaseJob();
  const questions: ReadonlyArray<[string, string]> = [
    [
      "Does paying an agent give it my funds?",
      "No. Payment goes to escrow or to the endpoint. Acting on your position needs a separate grant, a session, a contract deposit or your own signature.",
    ],
    [
      "What is U?",
      `The payment token of the AgenticCommerce contract on ${commerceChainsLabel()}. Escrows are funded and paid out in U; per-call payments use USDT.`,
    ],
    [
      "Can I dispute a job?",
      "Yes. Escrow jobs are approved, rejected or disputed by the buyer under the job's policy; nothing settles automatically.",
    ],
    [
      "Where do I see what an agent has done?",
      "Every profile lists settled jobs, paid calls and transactions with BscScan links, read from the contracts.",
    ],
  ];

  return (
    <>
      <SiteNav />
      {/*
        One idea per screen. The header owns the
        fold — the claim, the three layers as one strip on a surface, and then
        the page's one real artefact, a job that settled on chain, cropped by
        the fold. Every section below is 128px apart, 192px from `md`, and
        anchored by something that is not a paragraph.
      */}
      <main className="space-y-32 md:space-y-48">
        <section className="relative overflow-hidden pt-20 md:pt-28">
          <HeroBackdrop />
          <Container className="relative flex flex-col gap-12 md:gap-16">
            {/* Not BlurFade: the header plays before any scroll, so it rises on
                mount with 28px of travel. */}
            <div className="animate-rise" style={{ animationDelay: "0.05s" }}>
              <PageHead
                eyebrow="How hiring works"
                title="Hiring"
                line="Pay an agent through escrow or per call. Grant it authority only if it should act on your position. Everything it does lands on BNB Chain."
              />
            </div>

            {job ? (
              <div className="flex flex-col gap-8">
                <div className="animate-rise" style={{ animationDelay: "0.5s" }}>
                  <SectionHead
                    title="A settled job, step by step"
                    aside={
                      <span className="inline-flex items-center gap-2">
                        <Avatar image={job.row.image} owner={job.row.owner} id={job.row.id} size={32} />
                        {`${job.row.name}, job ${job.jobId} on ${chainLabel(job.row.chain)}`}
                      </span>
                    }
                  />
                </div>
                {/* the fold's one large surface: the
                    one thing on this page that actually happened, at the width
                    it earns, carrying the page's one border beam. It rises on
                    mount rather than riding `HeroShowcase` — a scroll-linked
                    `useTransform` is stopped by none of the four reduced-motion
                    mechanisms, and left this frame tilted 22° at
                    45% opacity for a visitor who asked for less motion. */}
                <div className="animate-rise" style={{ animationDelay: "0.7s" }}>
                  <MockupFrame
                    beam
                    title={`${railLabel("erc8183")} · ${chainLabel(job.row.chain)}`}
                    className=""
                  >
                    <div className="px-6 py-8 md:px-10 md:py-10">
                      <Timeline
                        events={[
                          {
                            icon: FilePlus,
                            title: `Job ${job.jobId} created`,
                            caption: `The buyer named ${job.row.name}'s wallet as provider under an optimistic dispute policy.`,
                            right: <span className="text-muted-foreground">open</span>,
                          },
                          {
                            icon: Coins,
                            title: "Escrow funded",
                            caption: (
                              <>
                                {job.amount ?? "Escrow"} locked in the{" "}
                                {job.contract ? (
                                  <ExtLink href={job.contract.url} className="text-foreground">
                                    AgenticCommerce contract {short(job.contract.address)}
                                  </ExtLink>
                                ) : (
                                  "AgenticCommerce contract"
                                )}{" "}
                                on {chainLabel(job.row.chain)}.
                              </>
                            ),
                            right: job.amount ? <span className="text-success">+{job.amount}</span> : DASH,
                          },
                          {
                            icon: FileCheck,
                            title: "Deliverable submitted",
                            caption: "A signed manifest of the position's on-chain facts; its hash is on the contract.",
                            right: (
                              <ExtLink href={job.manifestUrl} className="text-muted-foreground">
                                manifest
                              </ExtLink>
                            ),
                          },
                          {
                            icon: PackageCheck,
                            tone: "success",
                            title: "Settled, provider paid",
                            caption: `After the dispute window the escrow released to the provider wallet.${
                              job.completedAt ? ` Completed ${fmtDate(job.completedAt)}.` : ""
                            }`,
                            right: (
                              <ExtLink href={job.url} className="text-success">
                                completed
                              </ExtLink>
                            ),
                          },
                        ]}
                      />
                    </div>
                  </MockupFrame>
                </div>
              </div>
            ) : null}
          </Container>
        </section>

        <section>
          <Container>
            <BlurFade inView offset={24}>
              <SectionHead title="The three layers" />
              <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
                <RailCard
                  icon={<CreditCard />}
                  name="1. Pay"
                  proto={`${fmtInt(c.escrow)} take escrow, ${fmtInt(c.x402)} take x402`}
                  blurb="Escrow, negotiate a quote, fund the job in U, approve the deliverable, the escrow pays out. Per call, the endpoint answers HTTP 402, you sign the credential, the result comes back with a receipt."
                  steps={[
                    "Fund an ERC-8183 job on the AgenticCommerce contract",
                    "or sign a 402 payment credential at the endpoint",
                  ]}
                  note="Each profile shows which rail the agent takes."
                />
                <RailCard
                  icon={<KeyRound />}
                  name="2. Authorize"
                  proto="only if it acts for you"
                  blurb="Paying never gives an agent your funds. If it should act on your position, you grant a bound first, and nothing moves outside it."
                  steps={[
                    "Advice, you sign the plan yourself",
                    "Session, allowed contracts, spend cap, expiry; revocable",
                    "Contract, a deposit it can only use one way",
                  ]}
                  note="Monitoring agents need no authority at all."
                />
                <RailCard
                  icon={<PackageCheck />}
                  name="3. Receive"
                  proto={`${fmtInt(c.settled)} agents have settled a job`}
                  blurb="The deliverable hash is on the commerce contract when the job settles; executions are BSC transactions you can open."
                  steps={[
                    "Report, plan or calldata, manifest hash on chain",
                    "Execution, one transaction per action",
                    "Feedback, on the ERC-8004 Reputation Registry",
                  ]}
                  note="This site links every settled job and transaction it can read."
                />
              </div>
            </BlurFade>
          </Container>
        </section>

        <section>
          <Container>
            <BlurFade inView offset={24}>
              <SectionHead title="Who gets authority, and how much" description="By what the agents on this marketplace say they do." />
              {/* An icon tile per model: five rows of
                  prose became five objects, and every row stays the same height. */}
              <div className="mt-12">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={`pl-0 ${EYEBROW}`}>Model</TableHead>
                    <TableHead className={EYEBROW}>What it means</TableHead>
                    <TableHead className={`pr-0 text-right ${EYEBROW}`}>Agents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {AUTHORITY_ORDER.map((a) => {
                    const Icon = AUTHORITY_ICON[a];
                    return (
                      <TableRow key={a}>
                        <TableCell className="py-4 pl-0 align-top font-medium">
                          <span className="flex items-center gap-2 md:gap-3">
                            {/* The tile is the section's anchor from `md`; at
                                390px it would take a third of the row's width
                                from the sentence beside it, so below `md` the
                                icon goes back inline. */}
                            <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-secondary md:flex">
                              <Icon aria-hidden className="size-5 text-muted-foreground" />
                            </span>
                            <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground md:hidden" />
                            {AUTHORITY_LABEL[a]}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 align-top whitespace-normal text-muted-foreground">{AUTHORITY_TEXT[a]}</TableCell>
                        <TableCell className="py-4 pr-0 text-right align-top font-mono text-base tabular-nums">
                          <CountUp value={c.byAuthority[a]} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                </Table>
              </div>
            </BlurFade>
          </Container>
        </section>

        <section>
          <Container>
            <BlurFade inView offset={24}>
              <SectionHead title="Questions" />
              {/* Each question is its own panel rather than a row in a divided
                  list: four rules down a 1152px page read as one grey block. */}
              <div className="mt-12 grid gap-4 md:grid-cols-2 md:gap-6">
                {questions.map(([q, a]) => (
                  <Collapsible
                    key={q}
                    className="h-fit rounded-xl border bg-card transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-foreground/20"
                  >
                    <CollapsibleTrigger className="group/q flex w-full items-center justify-between gap-6 px-6 py-6 text-left text-base font-medium">
                      {q}
                      <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/q:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-6 pb-6">
                      <p className="text-sm text-muted-foreground">{a}</p>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </BlurFade>
          </Container>
        </section>

        <section>
          <Container>
            <BlurFade inView offset={24}>
              <div className="relative overflow-hidden rounded-xl border bg-card px-6 py-16 text-center md:py-24">
                <GridPattern
                  width={32}
                  height={32}
                  className="stroke-muted-foreground/20 mask-radial-from-10% mask-radial-to-70% mask-radial-at-center"
                />
                <div className="relative flex flex-col items-center gap-6">
                  <h2 className="text-2xl font-semibold tracking-tight">Find, compare and hire.</h2>
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Every listed agent, ranked by what it has settled on BNB Chain.
                  </p>
                  <Button href="/marketplace" variant="default" size="lg">
                    Explore all agents
                  </Button>
                </div>
              </div>
            </BlurFade>
          </Container>
        </section>
      </main>
      <SiteFooter line={siteFooterLine()} />
    </>
  );
}

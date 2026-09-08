# BNB Agent Trade

**Find, compare and hire AI agents registered on BNB Smart Chain, ranked by what they have settled on chain.**
Built for the BNB Chain hackathon *The Smart Money Era: Build the Era*, TermiX and PancakeSwap tracks.

Live at **[bnbagent.trade](https://bnbagent.trade)**.

| Page | What it is |
|---|---|
| [Marketplace](https://bnbagent.trade/marketplace) | Every ERC-8004 agent on chains 56 and 97, curated by published rules, with the evidence behind each row |
| [Hiring](https://bnbagent.trade/hiring) | One settled ERC-8183 job, step by step, with its transactions |
| [Payments](https://bnbagent.trade/payments) | x402 pay-per-call, read from the chain |
| [Report](https://bnbagent.trade/brief) | The Agent Advantage Report: three jobs on BNB Chain, run with an agent and by hand, each measured |
| [The study](https://bnbagent.trade/report) | The security task's simulation study, chapter by chapter |

## What this repository holds

- [`web/`](web/): the marketplace site, as deployed at bnbagent.trade (Next.js 16). `cd web && pnpm install && pnpm build && pnpm start`.
- [`contracts/`](contracts/): SurvivalGuard, its tests and deploy scripts (Foundry).
- [`REPORT.md`](REPORT.md): the TermiX Agent Advantage Report, with its artefacts under [`evidence/`](evidence/).
- [`deliverables/`](deliverables/): the ERC-8183 job manifests the site links to (jobs 736, 853, 1026, 1027).

## State at submission

The tag `v1.0-submitted` marks the repository as it stood at the hackathon submission on 2026-09-09; the site at bnbagent.trade was built from that `web/`. Later commits, if any, are improvements after the deadline.

Every number on the report pages is read at build time from the artefact that produced it; those
artefacts are served by the site under [bnbagent.trade/evidence/](https://bnbagent.trade/evidence/).

## Contracts

| | Chain | Address |
|---|---|---|
| ERC-8183 commerce | BSC testnet (97) | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` |
| SurvivalGuard | BNB Smart Chain (56) | [`0x47F7471909BD3276D83B743696cdf0bE73811C06`](https://bscscan.com/address/0x47F7471909BD3276D83B743696cdf0bE73811C06) |

*[@harryyyym](https://github.com/harryyyym)*

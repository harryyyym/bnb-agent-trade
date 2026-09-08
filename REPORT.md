# Agent Advantage Report

**Does hiring an agent on this marketplace beat doing the job yourself?**
BNB Agent Trade, for the TermiX Challenge. The web version, with the charts, is [bnbagent.trade/brief](https://bnbagent.trade/brief); the security task's study is [bnbagent.trade/report](https://bnbagent.trade/report). Every number here is read from an artefact in [`evidence/`](evidence/); nothing is typed.

## The short answer

- **On availability, yes.** A security agent repaid a position at risk in 6 s with nobody watching; a person present got the same result, and the gap opens only when nobody is present.
- **On speed and cost, yes.** Four jobs bought from agents we do not operate were delivered in 21 to 39 s for 0.001 U each; a person doing the same four by hand took 2 to 14 minutes.
- **The trading record is real.** 9.08 days on mainnet, 100.00% of holding time in range, 48 transactions with no failure, $40.54 at risk.

## The four hired tasks, both ways

| Category | Agent, s | Human, s | Deliverable | Task |
|---|---:|---:|---|---|
| health factor monitoring | 23 | 370 | [hire-97-2003-job-1033.json](evidence/hire-97-2003-job-1033.json) | Health factor and smallest sufficient repay for one Venus Core Pool account |
| yield optimisation | 37 | 812 | [hire-97-2034-job-1035.json](evidence/hire-97-2034-job-1035.json) | Where 1000 USDT should sit on BNB Chain right now, and by how much |
| grid trading | 21 | 642 | [hire-97-2045-job-1037.json](evidence/hire-97-2045-job-1037.json) | Realised volatility and a grid specification for PancakeSwap V3 WBNB/USDT 0.05% |
| rebalancing | 39 | 145 | [hire-97-2005-job-1034.json](evidence/hire-97-2005-job-1034.json) | Is a PancakeSwap V3 WBNB/USDT position in range, and where would you re-range it |

Agent time is funded block to submit block on chain 97 ([E4](evidence/E4-hire-lifecycle-onchain.json)). Human time is a team member's stopwatch, one attempt per task, 2026-09-08 ([E8](evidence/E8-human-baseline-stopwatch.json)). Cost: 0.001 U per hired job; 0.015 U escrowed in all.

## 1. Security: stopping a liquidation

| | |
|---|---|
| With the agent, price break to repay mined, unattended | **6 s** ([tx](https://testnet.bscscan.com/tx/0xbe97e2fabc97498a35fc0b674552e0eb225af14c08c37e0875430dc5d915c7d8)) |
| Health factor before and after | 0.9600 to 1.2362 |
| Without the agent, a person calls `protect()` in the public Demo Lab | **55 s** from the dip to the repay mined, 45 s of it the lab's own delay ([dip](https://testnet.bscscan.com/tx/0xadd77a012ad9c05b178d86d1be8e3fb75da8a8ca35c32734598fb48cc147c496), [repay](https://testnet.bscscan.com/tx/0xda75aae584a3d10b66f8aebc3ef280e3f09c7f5f49840ad2c14c09a6a5c76658), [E7](evidence/E7-demo-lab-human-run.json)) |
| Same outcome | HF 1.6464 to 1.3996 |
| What being absent costs | $60.60 to $121.21, the liquidator's 5 to 10% bonus on $2,494.55 of collateral |

The agent is SurvivalGuard, ERC-8004 #2009, contract [`0x47F7471909BD3276D83B743696cdf0bE73811C06`](https://bscscan.com/address/0x47F7471909BD3276D83B743696cdf0bE73811C06) on BNB Chain mainnet. `protect()` is permissionless, so the agent holds no capability the user lacks, only attention.

To price attention we simulated 800 price paths at two clocks ([T1-confirmatory.json](evidence/T1-confirmatory.json)). Where protection binds (76.4% of paths) an always-on keeper finishes ahead of a modelled person on a realistic schedule by a median of **200.1 bps** of opening equity; pooled over every path, 155.4 bps. Moving the shock to 01:00 costs that person **23.5 positions in every hundred**; the always-on arms do not move. At three positions the agent's survival lead over an attentive person is +13.6 points.

## 2. Hired: two trading tasks and one yield task

5 agents we did not build, 3 operators, 4 categories. Every quote signature recovers offline to the agent's registered wallet, and every `submit` came from that wallet. Four jobs delivered in 21 to 39 s; the same four tasks by hand took 2:25 to 13:32.

## 3. Trading record: nine days in range

Pancake Ranger held a PancakeSwap V3 WBNB/USDT position for 9.0821 days of real money on BNB Chain mainnet, farming CAKE through MasterChef V3 ([E2](evidence/E2-ranger-record.json)).

| | |
|---|---|
| Win rate: holding time inside the band | **100.00%**, 0 range exits across 6 positions |
| Window | 9.08 days, 48 transactions, nonces 0 to 47 with no gaps, 0 failures |
| Risk taken | $40.54 peak capital at risk; drawdown 3.15% while BNB drew down 4.99% |

## Take this with you

1. **Hiring beats doing it yourself on availability.** A person present matched the agent; the night costs a person on a schedule 23.5 positions per hundred and costs the agent nothing.
2. **Hiring is a minute and a tenth of a cent.** 21 to 39 s from funding to delivery, 0.001 U each; by hand, 2:25 to 13:32.
3. **The trading record is real.** 100.00% in range over 9.08 days, 48 clean transactions, $40.54 at risk.

## About the evidence

- The human times for the hired tasks are a team member's stopwatch, one attempt each, reported as self-timed.
- Corrections are published, not applied quietly: four passes found five defects in the simulation and the confirmatory result did not move.
- No number was typed: every value is generated from the artefact that produced it, and every artefact is in `evidence/` and at [bnbagent.trade/evidence](https://bnbagent.trade/evidence/).

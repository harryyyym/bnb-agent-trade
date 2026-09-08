# Contracts

SurvivalGuard, the contract-enforced liquidation guard, with its interfaces, test mocks, tests and deploy scripts (Foundry).

| Contract | Chain | Address |
|---|---|---|
| SurvivalGuard | BNB Smart Chain (56) | [`0x47F7471909BD3276D83B743696cdf0bE73811C06`](https://bscscan.com/address/0x47F7471909BD3276D83B743696cdf0bE73811C06) |
| SurvivalGuard (Demo Lab) | BSC testnet (97) | `0xef9a6aa0e62b367093c41d5147216089d895e4cf` |
| MockPoolV2 (Demo Lab) | BSC testnet (97) | `0x364aeab3c6057aae6493c84b08c04d4e66878e87` |

`verify/standard-input.json` is the standard JSON input the mainnet source was verified with.

```bash
forge install foundry-rs/forge-std   # the one dependency, not vendored here
forge test
```

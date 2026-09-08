// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SurvivalGuard} from "../src/SurvivalGuard.sol";

/// @notice BSC mainnet (56): real Aave V3 Pool + AaveOracle (verified 2026-08-27 via PoolAddressesProvider).
contract DeployMainnet is Script {
    address constant AAVE_POOL = 0x6807dc923806fE8Fd134338EABCA509979a7e0cB;
    address constant AAVE_ORACLE = 0x39bc1bfDa2130d6Bb6DBEfd366939b4c7aa7C697;

    function run() external {
        // Signer comes from the CLI: `--account <keystore-name>` (encrypted Foundry keystore,
        // created with `cast wallet import`) or `--ledger`. No private key in .env.
        vm.startBroadcast();
        SurvivalGuard guard = new SurvivalGuard(AAVE_POOL, AAVE_ORACLE);
        vm.stopBroadcast();
        console.log("GUARD_ADDRESS_MAINNET=%s", address(guard));
    }
}

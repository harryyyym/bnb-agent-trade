// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SurvivalGuard} from "../src/SurvivalGuard.sol";
import {MockPoolV2} from "../src/mocks/MockPoolV2.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice BSC testnet (97), V2 stack: MockPoolV2 (per-account demo dip) + mock reserves + guard.
///         Identical to DeployTestnet in every other respect — same four reserves, same 5M USDT of
///         borrowable liquidity, same `new SurvivalGuard(pool, pool)` from byte-identical guard source.
///
///         Deploy with the **demo-operator key**, not the survivalguard-deployer keystore: whoever
///         broadcasts becomes the pool owner, and the point of V2 is that the demo oracle is owned by
///         a throwaway with no authority anywhere else.
contract DeployTestnetV2 is Script {
    function run() external {
        vm.startBroadcast();

        MockPoolV2 pool = new MockPoolV2();
        MockERC20 usdt = new MockERC20("Tether USD (mock)", "USDT", 18);
        MockERC20 eth = new MockERC20("Binance-Peg Ethereum (mock)", "ETH", 18);
        MockERC20 wbnb = new MockERC20("Wrapped BNB (mock)", "WBNB", 18);
        MockERC20 btcb = new MockERC20("Binance-Peg BTCB (mock)", "BTCB", 18);

        // Prices are pinned to the live market by scripts/demo/pin-oracle-to-market.ts after deploy;
        // these are only the opening values so the pool is usable the moment it exists.
        pool.listReserve(address(usdt), 1e8, 7500, 7300);
        pool.listReserve(address(eth), 4_000e8, 8000, 8300);
        pool.listReserve(address(wbnb), 700e8, 7000, 7500);
        pool.listReserve(address(btcb), 115_000e8, 7800, 8000);

        SurvivalGuard guard = new SurvivalGuard(address(pool), address(pool));

        // seed USDT liquidity so demo borrows can be served
        usdt.mint(msg.sender, 10_000_000e18);
        usdt.approve(address(pool), type(uint256).max);
        pool.seed(address(usdt), 5_000_000e18);

        vm.stopBroadcast();

        console.log("POOL_ADDRESS_TESTNET=%s", address(pool));
        console.log("GUARD_ADDRESS_TESTNET=%s", address(guard));
        console.log("USDT_ADDRESS=%s", address(usdt));
        console.log("XETH_ADDRESS=%s", address(eth));
        console.log("WBNB_ADDRESS=%s", address(wbnb));
        console.log("BTCB_ADDRESS=%s", address(btcb));
    }
}

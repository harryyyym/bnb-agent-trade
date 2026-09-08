// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SurvivalGuard} from "../src/SurvivalGuard.sol";
import {MockPool} from "../src/mocks/MockPool.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice BSC testnet (97): Aave is not deployed there, so deploy MockPool + mock reserves + guard.
///         Reserve set mirrors mainnet Aave on BSC: USDT (18), ETH (18), WBNB (18), BTCB (18).
contract DeployTestnet is Script {
    function run() external {
        // Signer comes from the CLI: `--account <keystore-name>` (encrypted Foundry keystore,
        // created with `cast wallet import`) or `--ledger`. No private key in .env.
        vm.startBroadcast();

        MockPool pool = new MockPool();
        MockERC20 usdt = new MockERC20("Tether USD (mock)", "USDT", 18);
        MockERC20 eth = new MockERC20("Binance-Peg Ethereum (mock)", "ETH", 18);
        MockERC20 wbnb = new MockERC20("Wrapped BNB (mock)", "WBNB", 18);
        MockERC20 btcb = new MockERC20("Binance-Peg BTCB (mock)", "BTCB", 18);

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
        console.log("USDT=%s", address(usdt));
        console.log("ETH=%s", address(eth));
        console.log("WBNB=%s", address(wbnb));
        console.log("BTCB=%s", address(btcb));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SurvivalGuard} from "../src/SurvivalGuard.sol";
import {MockPoolV2} from "../src/mocks/MockPoolV2.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @notice The demo dip's whole claim is "nobody else's position moves". These tests are that claim.
///         Everything else here checks the dip cannot be pointed at a stranger, cannot outlive the
///         session that made it, and cannot be used to lever up or withdraw while it is live.
contract MockPoolV2DipTest is Test {
    MockPoolV2 pool;
    MockERC20 usdt; // 18 dec, $1
    MockERC20 eth; // 18 dec, $4000
    SurvivalGuard guard;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol"); // supplies nothing, ever
    address keeper = makeAddr("keeper");
    address lp = makeAddr("lp");
    address operator; // = address(this), the pool deployer

    uint256 constant WAD = 1e18;

    function setUp() public {
        operator = address(this);
        pool = new MockPoolV2();
        usdt = new MockERC20("Tether USD (mock)", "USDT", 18);
        eth = new MockERC20("Binance-Peg Ethereum (mock)", "ETH", 18);
        pool.listReserve(address(usdt), 1e8, 7500, 7300);
        pool.listReserve(address(eth), 4_000e8, 8000, 8300);
        guard = new SurvivalGuard(address(pool), address(pool));

        usdt.mint(lp, 5_000_000e18);
        vm.startPrank(lp);
        usdt.approve(address(pool), type(uint256).max);
        pool.seed(address(usdt), 5_000_000e18);
        vm.stopPrank();

        _openPosition(alice);
        _openPosition(bob);
    }

    /// 1 ETH collateral ($4,000, LT 80% ⇒ $3,200), borrow 2,666 USDT ⇒ HF ≈ 1.2003.
    function _openPosition(address who) internal {
        eth.mint(who, 1e18);
        usdt.mint(who, 2_000e18); // buffer on top of the borrowed amount
        vm.startPrank(who);
        eth.approve(address(pool), type(uint256).max);
        pool.supply(address(eth), 1e18, who, 0);
        pool.borrow(address(usdt), 2_666e18, 2, 0, who);
        usdt.approve(address(guard), type(uint256).max);
        guard.enroll(
            SurvivalGuard.Plan({
                debtAsset: address(usdt),
                triggerHF: 1.15e18,
                targetHF: 1.4e18,
                maxRepayPerProtect: 1_000e18,
                cooldown: 600,
                active: false
            })
        );
        vm.stopPrank();
    }

    function _hf(address u) internal view returns (uint256 hf) {
        (,,,,, hf) = pool.getUserAccountData(u);
    }

    function _col(address u) internal view returns (uint256 c) {
        (c,,,,,) = pool.getUserAccountData(u);
    }

    // ---------------------------------------------------------------- isolation: the load-bearing claim
    function test_dip_movesOnlyTheCaller() public {
        uint256 bobHfBefore = _hf(bob);
        uint256 bobColBefore = _col(bob);

        vm.prank(alice);
        pool.dip(address(eth), 2000); // -20%

        assertApproxEqRel(_hf(alice), 0.96e18, 0.001e18, "alice HF should fall to ~0.96");
        assertEq(_hf(bob), bobHfBefore, "bob's HF must not move");
        assertEq(_col(bob), bobColBefore, "bob's collateral must not move");
        assertEq(pool.getAssetPrice(address(eth)), 4_000e8, "global price must not move");
    }

    function test_twoConcurrentDipsDoNotInterfere() public {
        vm.prank(alice);
        pool.dip(address(eth), 1000); // -10%
        vm.prank(bob);
        pool.dip(address(eth), 3500); // -35%

        // Each account sees exactly its own drop, at the same block, with no lease and no queue.
        assertEq(pool.priceFor(alice, address(eth)), 3_600e8);
        assertEq(pool.priceFor(bob, address(eth)), 2_600e8);
        assertEq(pool.priceFor(carol, address(eth)), 4_000e8);
        assertApproxEqRel(_hf(alice), 1.0803e18, 0.001e18);
        assertApproxEqRel(_hf(bob), 0.7802e18, 0.001e18);
    }

    function test_recoverRestoresOnlyTheCaller() public {
        uint256 before = _hf(alice);
        vm.startPrank(alice);
        pool.dip(address(eth), 2000);
        assertLt(_hf(alice), before);
        pool.recover(address(eth));
        vm.stopPrank();
        assertEq(_hf(alice), before, "recover must return the caller to the listed price");
    }

    function test_dipExpiresOnItsOwn() public {
        uint256 before = _hf(alice);
        vm.prank(alice);
        pool.dip(address(eth), 3000);
        assertLt(_hf(alice), before);

        vm.warp(block.timestamp + pool.DIP_TTL() - 1);
        assertLt(_hf(alice), before, "still dipped one second before expiry");
        vm.warp(block.timestamp + 2);
        assertEq(_hf(alice), before, "an abandoned dip heals itself");
        assertEq(pool.dipRemaining(alice, address(eth)), 0);
    }

    // ---------------------------------------------------------------- abuse controls
    function test_dipRefusedWithoutAPosition() public {
        vm.prank(carol);
        vm.expectRevert(bytes("supply first"));
        pool.dip(address(eth), 2000);
    }

    function test_dipRefusedOnUnlistedAsset() public {
        MockERC20 rando = new MockERC20("Rando", "RND", 18);
        vm.prank(alice);
        vm.expectRevert(bytes("unlisted"));
        pool.dip(address(rando), 1000);
    }

    function test_dipRefusedOutOfRange() public {
        // Read the constant up front: a view call between expectRevert and the call under test
        // would consume the expectation.
        uint16 max = pool.MAX_DROP_BPS();
        vm.startPrank(alice);
        vm.expectRevert(bytes("drop out of range"));
        pool.dip(address(eth), 0);
        vm.expectRevert(bytes("drop out of range"));
        pool.dip(address(eth), max + 1);
        pool.dip(address(eth), max); // the boundary itself is allowed
        vm.stopPrank();
        assertEq(pool.priceFor(alice, address(eth)), 1_600e8);
    }

    function test_dipForIsOperatorOnly() public {
        vm.prank(bob);
        vm.expectRevert(bytes("not owner"));
        pool.dipFor(alice, address(eth), 2000);

        // …and even the operator cannot dip an account that has no collateral.
        vm.expectRevert(bytes("supply first"));
        pool.dipFor(carol, address(eth), 2000);

        pool.dipFor(alice, address(eth), 2000);
        assertEq(pool.priceFor(alice, address(eth)), 3_200e8);
        assertEq(pool.priceFor(bob, address(eth)), 4_000e8, "a staged dip is still one account wide");
    }

    function test_recoverForIsOperatorOnly() public {
        pool.dipFor(alice, address(eth), 2000);
        vm.prank(bob);
        vm.expectRevert(bytes("not owner"));
        pool.recoverFor(alice, address(eth));
        pool.recoverFor(alice, address(eth));
        assertEq(pool.dipRemaining(alice, address(eth)), 0);
    }

    function test_cannotLeverUpOrWithdrawWhileDipped() public {
        vm.startPrank(alice);
        pool.dip(address(eth), 2000);
        vm.expectRevert(bytes("undercollateralised"));
        pool.borrow(address(usdt), 100e18, 2, 0, alice);
        vm.expectRevert(bytes("HF < 1"));
        pool.withdraw(address(eth), 1e18, alice);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- the guard still works
    function test_guardProtectsADippedAccount_andLeavesBystandersAlone() public {
        vm.prank(alice);
        pool.dip(address(eth), 1000); // -10% ⇒ HF ~1.080, under the 1.15 trigger

        (bool eligible,,, uint256 amount) = guard.previewProtect(alice);
        assertTrue(eligible, "guard should see the dipped health factor");

        (bool bobEligible,,,) = guard.previewProtect(bob);
        assertFalse(bobEligible, "bob is untouched and must stay ineligible");

        uint256 bobHfBefore = _hf(bob);
        vm.prank(keeper);
        uint256 repaid = guard.protect(alice);

        assertGt(repaid, 0);
        assertLe(repaid, amount);
        assertGe(_hf(alice), 1.15e18, "protect must lift alice back over her trigger");
        assertEq(_hf(bob), bobHfBefore, "protecting alice must not move bob by a wei");
        assertGt(usdt.balanceOf(keeper), 0, "keeper is paid its fee");
    }

    /// The debt leg keeps the global price, so the guard's repay sizing (which reads
    /// ORACLE.getAssetPrice(debtAsset)) agrees with the health factor it was handed.
    function test_debtLegIgnoresTheOverride() public {
        vm.startPrank(alice);
        pool.supply(address(usdt), 0, alice, 0); // no-op: alice holds no USDT collateral
        pool.dip(address(eth), 2500);
        vm.stopPrank();
        (, uint256 debtBefore,,,,) = pool.getUserAccountData(alice);
        assertEq(debtBefore, 2_666e8, "debt is still valued at the listed $1");
        assertEq(pool.getAssetPrice(address(usdt)), 1e8);
    }

    function test_protectRestoresTargetAfterFullEpisode() public {
        vm.prank(alice);
        pool.dip(address(eth), 1000);
        vm.prank(keeper);
        guard.protect(alice);
        uint256 hfDipped = _hf(alice);

        vm.prank(alice);
        pool.recover(address(eth));
        assertGt(_hf(alice), hfDipped, "restoring the price lifts HF further still");
    }

    function test_transferOwnershipRotatesTheOperator() public {
        address newOp = makeAddr("newOperator");
        pool.transferOwnership(newOp);
        assertEq(pool.owner(), newOp);
        vm.expectRevert(bytes("not owner"));
        pool.setPrice(address(eth), 1e8);
        vm.prank(newOp);
        pool.setPrice(address(eth), 3_000e8);
        assertEq(pool.getAssetPrice(address(eth)), 3_000e8);
    }

    /// No drop within range, on any account, can move a bystander.
    function testFuzz_bystanderNeverMoves(uint16 dropBps) public {
        dropBps = uint16(bound(uint256(dropBps), 1, pool.MAX_DROP_BPS()));
        uint256 bobHfBefore = _hf(bob);
        uint256 carolPrice = pool.priceFor(carol, address(eth));
        vm.prank(alice);
        pool.dip(address(eth), dropBps);
        assertEq(_hf(bob), bobHfBefore);
        assertEq(pool.priceFor(carol, address(eth)), carolPrice);
        assertEq(pool.getAssetPrice(address(eth)), 4_000e8);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {SurvivalGuard} from "../../src/SurvivalGuard.sol";
import {IPool, IAaveOracle} from "../../src/interfaces/IAaveV3.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";

interface IPoolExt is IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;
}

/// @notice Runs only with a fork: `BSC_RPC_URL=https://bsc-dataseed.bnbchain.org forge test --match-path 'test/fork/*' --fork-url $BSC_RPC_URL`
///         Stages a real Aave V3 BSC position (ETH collateral, USDT debt), mocks the oracle price lower,
///         and asserts SurvivalGuard repays the user's own debt and lifts HF.
contract AaveBscForkTest is Test {
    address constant POOL = 0x6807dc923806fE8Fd134338EABCA509979a7e0cB;
    address constant ORACLE = 0x39bc1bfDa2130d6Bb6DBEfd366939b4c7aa7C697;
    address constant USDT = 0x55d398326f99059fF775485246999027B3197955; // BEP-20 USDT: 18 decimals
    address constant ETH = 0x2170Ed0880ac9A755fd29B2688956BD959F933F8; // Binance-Peg ETH (BSC reserve symbol "ETH")

    SurvivalGuard guard;
    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");

    function setUp() public {
        guard = new SurvivalGuard(POOL, ORACLE);
    }

    function _hf(address u) internal view returns (uint256 hf) {
        (,,,,, hf) = IPool(POOL).getUserAccountData(u);
    }

    function test_fork_protectOnRealAave() public {
        // 1) give alice 1 ETH + USDT buffer via storage cheat
        deal(ETH, alice, 1e18);
        deal(USDT, alice, 2_000e18);
        vm.startPrank(alice);
        IERC20(ETH).approve(POOL, type(uint256).max);
        IPoolExt(POOL).supply(ETH, 1e18, alice, 0);
        uint256 ethPrice = IAaveOracle(ORACLE).getAssetPrice(ETH); // 8 dec
        (,,,, uint256 ltv,) = IPool(POOL).getUserAccountData(alice);
        // borrow ~90% of LTV-allowed USDT (BSC ETH: ltv 8000, lt 8300 -> HF ~1.15, above the 1.1 trigger)
        uint256 borrowUsd = (ethPrice * ltv * 90) / (10_000 * 100); // 8-dec USD
        uint256 borrowAmt = borrowUsd * 1e10; // USDT 18 dec on BSC (from 8-dec USD)
        IPoolExt(POOL).borrow(USDT, borrowAmt, 2, 0, alice);
        IERC20(USDT).approve(address(guard), type(uint256).max);
        (, uint256 debtBase,,,,) = IPool(POOL).getUserAccountData(alice);
        assertGt(debtBase, 0);
        (,,, uint256 lt,,) = IPool(POOL).getUserAccountData(alice);
        console.log("lt", lt, "ltv", ltv);
        console.log("HF after borrow", _hf(alice));
        guard.enroll(
            SurvivalGuard.Plan({
                debtAsset: USDT,
                triggerHF: 1.1e18,
                targetHF: 1.3e18,
                maxRepayPerProtect: 1_000e18,
                cooldown: 0,
                active: false
            })
        );
        vm.stopPrank();

        // 2) not eligible yet
        (bool eligible,,,) = guard.previewProtect(alice);
        assertFalse(eligible);

        // 3) mock the oracle: ETH -20%
        vm.mockCall(
            ORACLE,
            abi.encodeWithSelector(IAaveOracle.getAssetPrice.selector, ETH),
            abi.encode((ethPrice * 80) / 100)
        );
        uint256 hfBefore = _hf(alice);
        console.log("HF after dip", hfBefore);
        assertLt(hfBefore, 1.1e18);
        (eligible,,,) = guard.previewProtect(alice);
        assertTrue(eligible);

        // 4) protect
        uint256 keeperBefore = IERC20(USDT).balanceOf(keeper);
        vm.prank(keeper);
        uint256 repaid = guard.protect(alice);
        uint256 hfAfter = _hf(alice);
        console.log("repaid", repaid, "HF after protect", hfAfter);
        assertGt(hfAfter, hfBefore);
        assertGt(IERC20(USDT).balanceOf(keeper), keeperBefore);
        assertEq(IERC20(USDT).balanceOf(address(guard)), 0);
        assertApproxEqRel(hfAfter, 1.3e18, 2e16); // within 2% of target
    }
}

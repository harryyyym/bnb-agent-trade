// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "../interfaces/IERC20.sol";
import {DataTypes} from "../interfaces/IAaveV3.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Tiny Aave-V3-shaped lending pool for BSC testnet, which has no Aave V3 deployment.
///         Implements exactly the surface SurvivalGuard + the dApp use: supply/borrow/repay, per-asset
///         price + liquidation threshold, getUserAccountData, getReserveData, getAssetPrice.
///         Health factor maths matches Aave: HF = sum(collateral_i * LT_i) / sum(debt_j), 8-decimal USD.
///
///         V2 adds ONE thing to V1: a **per-account** price override ("the demo dip"). A visitor can
///         crash the price of their own collateral, watch SurvivalGuard repay, and restore it — without
///         moving any other visitor's health factor by a single wei. That is what makes a public demo
///         safe: the dip is a transaction the visitor signs for themselves, so there is no shared oracle
///         key in the request path and no way to aim a dip at a stranger.
///
///         The override is applied to the **supply leg of `_aggregate` only**. The debt leg and
///         `getAssetPrice()` keep the global listed price, so SurvivalGuard — which reads a price
///         directly for exactly one thing, `ORACLE.getAssetPrice(plan.debtAsset)` — stays consistent
///         with the health factor it is handed. The guard needs no change and is redeployed from
///         byte-identical source.
contract MockPoolV2 {
    struct Reserve {
        bool listed;
        uint256 price; // 8-dec USD
        uint16 liquidationThresholdBps;
        uint16 ltvBps;
        MockERC20 variableDebtToken; // mintable/burnable accounting token
        uint16 id;
    }

    /// @notice A live per-account price override. `price` is 8-dec USD; `expiry` is a unix timestamp.
    struct Dip {
        uint256 price;
        uint64 expiry;
    }

    address public owner;
    address[] public reserveList;
    mapping(address => Reserve) public reserves;
    mapping(address => mapping(address => uint256)) public supplied; // user => asset => amount
    /// @notice user => asset => override. Read only inside `_aggregate(user)`'s supply leg.
    mapping(address => mapping(address => Dip)) public dips;

    uint256 private constant WAD = 1e18;
    uint256 private constant BPS = 10_000;
    /// @notice The deepest a demo dip may go: -60%. Enough to cross any sane trigger, bounded so a
    ///         mis-typed value cannot produce a nonsense screenshot.
    uint16 public constant MAX_DROP_BPS = 6000;
    /// @notice A dip self-heals after 30 minutes, so an abandoned session leaves no wreckage.
    uint32 public constant DIP_TTL = 1800;

    event ReserveListed(address indexed asset, uint256 price, uint16 lt, uint16 ltv, address debtToken);
    event PriceSet(address indexed asset, uint256 price);
    event Supply(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount, address indexed payer);
    event Dipped(
        address indexed user, address indexed asset, uint256 fromPrice, uint256 toPrice, uint16 dropBps, uint64 expiry
    );
    event Recovered(address indexed user, address indexed asset, uint256 price);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ------------------------------------------------------------ admin
    function listReserve(address asset, uint256 price, uint16 ltBps, uint16 ltvBps) external onlyOwner {
        require(!reserves[asset].listed, "listed");
        MockERC20 dt = new MockERC20("Mock variable debt token", "vDebt", IERC20(asset).decimals());
        reserves[asset] = Reserve({
            listed: true,
            price: price,
            liquidationThresholdBps: ltBps,
            ltvBps: ltvBps,
            variableDebtToken: dt,
            id: uint16(reserveList.length)
        });
        reserveList.push(asset);
        emit ReserveListed(asset, price, ltBps, ltvBps, address(dt));
    }

    /// @notice Move the *listed* (global) price. Operator only, and never during judging: this one
    ///         does move every account at once. Its job is pinning the pool to the live market.
    function setPrice(address asset, uint256 price) external onlyOwner {
        require(reserves[asset].listed, "unlisted");
        reserves[asset].price = price;
        emit PriceSet(asset, price);
    }

    function setLiquidationThreshold(address asset, uint16 ltBps) external onlyOwner {
        reserves[asset].liquidationThresholdBps = ltBps;
    }

    /// @notice V1 had no way to rotate the operator. This one does, so the demo oracle never has to be
    ///         owned by a key that matters anywhere else.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ------------------------------------------------------------ demo dip (per account)
    /// @notice Drop `asset` by `dropBps` **for the caller only**. Requires the caller to actually hold
    ///         that collateral, so a dip can never be aimed at an account that is not the caller's,
    ///         and an empty wallet cannot spam dips that mean anything.
    function dip(address asset, uint16 dropBps) external {
        _dip(msg.sender, asset, dropBps);
    }

    /// @notice Operator-staged dip for one named account. Strictly weaker than `setPrice`, which the
    ///         operator already has: this moves exactly one account and nobody else. It exists so the
    ///         backend can drive a demo (or keep the pre-connect house account alive) without asking
    ///         the visitor for a second signature.
    function dipFor(address user, address asset, uint16 dropBps) external onlyOwner {
        _dip(user, asset, dropBps);
    }

    function recover(address asset) external {
        _recover(msg.sender, asset);
    }

    function recoverFor(address user, address asset) external onlyOwner {
        _recover(user, asset);
    }

    function _dip(address user, address asset, uint16 dropBps) internal {
        Reserve storage r = reserves[asset];
        require(r.listed, "unlisted");
        require(supplied[user][asset] > 0, "supply first");
        require(dropBps > 0 && dropBps <= MAX_DROP_BPS, "drop out of range");
        uint256 to = (r.price * (BPS - dropBps)) / BPS;
        uint64 exp = uint64(block.timestamp) + DIP_TTL;
        dips[user][asset] = Dip(to, exp);
        emit Dipped(user, asset, r.price, to, dropBps, exp);
    }

    function _recover(address user, address asset) internal {
        delete dips[user][asset];
        emit Recovered(user, asset, reserves[asset].price);
    }

    /// @notice The price `user` sees for `asset`: their live dip if any, otherwise the listed price.
    function priceFor(address user, address asset) public view returns (uint256) {
        Dip storage d = dips[user][asset];
        if (d.price != 0 && block.timestamp < d.expiry) return d.price;
        return reserves[asset].price;
    }

    /// @notice Seconds left on `user`'s dip for `asset`; 0 when none. For the UI countdown.
    function dipRemaining(address user, address asset) external view returns (uint64) {
        Dip storage d = dips[user][asset];
        if (d.price == 0 || block.timestamp >= d.expiry) return 0;
        return d.expiry - uint64(block.timestamp);
    }

    // ------------------------------------------------------------ user
    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(reserves[asset].listed, "unlisted");
        require(IERC20(asset).transferFrom(msg.sender, address(this), amount), "transferFrom");
        supplied[onBehalfOf][asset] += amount;
        emit Supply(onBehalfOf, asset, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        supplied[msg.sender][asset] -= amount;
        require(IERC20(asset).transfer(to, amount), "transfer");
        (,,,,, uint256 hf) = getUserAccountData(msg.sender);
        require(hf >= WAD, "HF < 1");
        emit Withdraw(msg.sender, asset, amount);
        return amount;
    }

    function borrow(address asset, uint256 amount, uint256, uint16, address onBehalfOf) external {
        require(onBehalfOf == msg.sender, "self only");
        Reserve storage r = reserves[asset];
        require(r.listed, "unlisted");
        r.variableDebtToken.mint(msg.sender, amount);
        (uint256 col, uint256 debt,, uint256 lt,,) = getUserAccountData(msg.sender);
        // borrowing allowed while HF stays >= 1 (demo pool; ignores LTV to make dips easy to stage)
        require((col * lt) / BPS >= debt, "undercollateralised");
        require(IERC20(asset).balanceOf(address(this)) >= amount, "no liquidity");
        require(IERC20(asset).transfer(msg.sender, amount), "transfer");
        emit Borrow(msg.sender, asset, amount);
    }

    /// @dev Aave semantics: repays min(amount, debt) from msg.sender on behalf of onBehalfOf; returns paid.
    function repay(address asset, uint256 amount, uint256, address onBehalfOf) external returns (uint256) {
        Reserve storage r = reserves[asset];
        require(r.listed, "unlisted");
        uint256 debt = r.variableDebtToken.balanceOf(onBehalfOf);
        uint256 paid = amount > debt ? debt : amount;
        require(paid > 0, "no debt");
        require(IERC20(asset).transferFrom(msg.sender, address(this), paid), "transferFrom");
        r.variableDebtToken.burn(onBehalfOf, paid);
        emit Repay(onBehalfOf, asset, paid, msg.sender);
        return paid;
    }

    /// @notice Seed liquidity so borrows can be served (anyone; testnet).
    function seed(address asset, uint256 amount) external {
        require(IERC20(asset).transferFrom(msg.sender, address(this), amount), "transferFrom");
    }

    // ------------------------------------------------------------ views (Aave-shaped)
    struct Agg {
        uint256 col;
        uint256 debt;
        uint256 wLT;
        uint256 wLTV;
    }

    function _aggregate(address user) internal view returns (Agg memory a) {
        for (uint256 i = 0; i < reserveList.length; i++) {
            address asset = reserveList[i];
            Reserve storage r = reserves[asset];
            uint256 dec = 10 ** IERC20(asset).decimals();
            uint256 s = supplied[user][asset];
            if (s > 0) {
                // Supply leg only: the demo dip lowers what THIS user's collateral is worth.
                uint256 v = (s * priceFor(user, asset)) / dec;
                a.col += v;
                a.wLT += v * r.liquidationThresholdBps;
                a.wLTV += v * r.ltvBps;
            }
            uint256 d = r.variableDebtToken.balanceOf(user);
            // Debt leg keeps the global price, so it agrees with getAssetPrice() — which is the only
            // price SurvivalGuard reads directly, and it reads it for the debt asset.
            if (d > 0) a.debt += (d * r.price) / dec;
        }
    }

    function getUserAccountData(address user)
        public
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        Agg memory a = _aggregate(user);
        totalCollateralBase = a.col;
        totalDebtBase = a.debt;
        if (a.col > 0) {
            currentLiquidationThreshold = a.wLT / a.col;
            ltv = a.wLTV / a.col;
        }
        uint256 borrowCap = (a.col * ltv) / BPS;
        availableBorrowsBase = borrowCap > a.debt ? borrowCap - a.debt : 0;
        healthFactor =
            a.debt == 0 ? type(uint256).max : (a.col * currentLiquidationThreshold * WAD) / (BPS * a.debt);
    }

    function getReserveData(address asset) external view returns (DataTypes.ReserveDataLegacy memory d) {
        Reserve storage r = reserves[asset];
        d.id = r.id;
        d.variableDebtTokenAddress = address(r.variableDebtToken);
        // aToken: we don't mint receipt tokens; expose the pool itself so UIs show a non-zero address.
        d.aTokenAddress = r.listed ? address(this) : address(0);
    }

    /// @notice IAaveOracle-compatible, so MockPoolV2 can serve as both POOL and ORACLE for SurvivalGuard.
    ///         Deliberately global: per-account overrides never reach the guard's debt-side maths.
    function getAssetPrice(address asset) external view returns (uint256) {
        return reserves[asset].price;
    }

    function getReservesList() external view returns (address[] memory) {
        return reserveList;
    }

    function variableDebtToken(address asset) external view returns (address) {
        return address(reserves[asset].variableDebtToken);
    }
}

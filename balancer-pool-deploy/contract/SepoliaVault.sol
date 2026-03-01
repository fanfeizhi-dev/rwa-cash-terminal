// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SepoliaVault
 * @notice EIP-4626 tokenized vault for Circle USDC on Sepolia with virtual per-block yield accrual.
 * @dev Yield is virtual — totalAssets() grows via discrete compounding based on a configurable APR,
 *      but actual withdrawals are capped by the vault's real USDC balance. No whitelist; any address
 *      can deposit, withdraw, and redeem. Testnet only.
 *
 *      Share token decimals = 6 (matches USDC). Rounding favours the vault in all conversions.
 */
contract SepoliaVault is ERC4626, Ownable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────

    /// @dev Stored totalAssets (real balance + accrued virtual yield) after last accrual.
    uint256 private _totalAssetsStored;

    /// @notice Block number at which yield was last accrued.
    uint256 public lastAccrualBlock;

    /// @notice Annual APR in basis points (e.g. 400 = 4 %).
    uint256 public aprBps;

    /// @notice Assumed blocks per year for per-block rate calculation. Immutable after deploy.
    uint256 public immutable blocksPerYear;

    // ─── Constants ───────────────────────────────────────────────────────

    uint256 private constant PRECISION = 1e18;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    /// @dev Cap delta-blocks to ~7 days (at 12 s / block) to bound gas in the pow loop.
    uint256 private constant MAX_DELTA_BLOCKS = 50_400;

    // ─── Events ──────────────────────────────────────────────────────────

    event YieldAccrued(uint256 newTotalAssets, uint256 deltaBlocks);
    event AprUpdated(uint256 oldAprBps, uint256 newAprBps);
    event YieldInjected(address indexed sender, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────

    error ZeroBlocksPerYear();

    // ─── Constructor ─────────────────────────────────────────────────────

    /**
     * @param asset_          Underlying ERC-20 (Circle USDC Sepolia).
     * @param name_           Share token name  (e.g. "RWA Demo Vault").
     * @param symbol_         Share token symbol (e.g. "rwaUSD").
     * @param aprBps_         Annual APR in basis points.
     * @param blocksPerYear_  Expected blocks per year (e.g. 2_628_000 for ~12 s blocks).
     */
    constructor(
        address asset_,
        string memory name_,
        string memory symbol_,
        uint256 aprBps_,
        uint256 blocksPerYear_
    )
        ERC4626(IERC20(asset_))
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {
        if (blocksPerYear_ == 0) revert ZeroBlocksPerYear();
        aprBps = aprBps_;
        blocksPerYear = blocksPerYear_;
        lastAccrualBlock = block.number;
    }

    // ─── Yield Accrual (internal) ────────────────────────────────────────

    /**
     * @dev Accrue virtual yield via discrete compounding. MUST be called before any
     *      state-changing operation that depends on totalAssets.
     */
    function _accrue() internal {
        if (_totalAssetsStored == 0 || aprBps == 0) {
            lastAccrualBlock = block.number;
            return;
        }

        uint256 deltaBlocks = block.number - lastAccrualBlock;
        if (deltaBlocks == 0) return;
        if (deltaBlocks > MAX_DELTA_BLOCKS) deltaBlocks = MAX_DELTA_BLOCKS;

        uint256 ratePerBlock = (PRECISION * aprBps) / BPS_DENOMINATOR / blocksPerYear;
        uint256 compoundFactor = _pow(PRECISION + ratePerBlock, deltaBlocks);

        _totalAssetsStored = (_totalAssetsStored * compoundFactor) / PRECISION;
        lastAccrualBlock = block.number;

        emit YieldAccrued(_totalAssetsStored, deltaBlocks);
    }

    /**
     * @dev Fixed-point exponentiation by squaring: (base / PRECISION)^exp, scaled by PRECISION.
     *      Gas: O(log2(exp)), ≤ 16 iterations for MAX_DELTA_BLOCKS.
     */
    function _pow(uint256 base, uint256 exp) internal pure returns (uint256) {
        uint256 result = PRECISION;
        while (exp > 0) {
            if (exp & 1 == 1) {
                result = (result * base) / PRECISION;
            }
            base = (base * base) / PRECISION;
            exp >>= 1;
        }
        return result;
    }

    // ─── ERC-4626 Overrides ──────────────────────────────────────────────

    /**
     * @notice Total assets including accrued virtual yield (view-only, no state change).
     * @dev All share ↔ asset conversions in the base ERC4626 use this value.
     */
    function totalAssets() public view override returns (uint256) {
        if (_totalAssetsStored == 0) return 0;

        uint256 deltaBlocks = block.number - lastAccrualBlock;
        if (deltaBlocks == 0 || aprBps == 0) return _totalAssetsStored;
        if (deltaBlocks > MAX_DELTA_BLOCKS) deltaBlocks = MAX_DELTA_BLOCKS;

        uint256 ratePerBlock = (PRECISION * aprBps) / BPS_DENOMINATOR / blocksPerYear;
        uint256 compoundFactor = _pow(PRECISION + ratePerBlock, deltaBlocks);

        return (_totalAssetsStored * compoundFactor) / PRECISION;
    }

    // --- deposit / mint ---

    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        returns (uint256)
    {
        _accrue();
        uint256 shares = super.deposit(assets, receiver);
        _totalAssetsStored += assets;
        return shares;
    }

    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        returns (uint256)
    {
        _accrue();
        uint256 assets = super.mint(shares, receiver);
        _totalAssetsStored += assets;
        return assets;
    }

    // --- withdraw / redeem ---

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        _accrue();
        uint256 shares = super.withdraw(assets, receiver, owner);
        _totalAssetsStored -= assets;
        return shares;
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        _accrue();
        uint256 assets = super.redeem(shares, receiver, owner);
        _totalAssetsStored -= assets;
        return assets;
    }

    // --- max* capped by real USDC balance ---

    /**
     * @notice Max assets withdrawable by `owner`, capped by the vault's real USDC balance
     *         so that virtual yield cannot be withdrawn until it is backed by real tokens.
     */
    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 ownerAssets = _convertToAssets(balanceOf(owner), Math.Rounding.Floor);
        uint256 realBalance = IERC20(asset()).balanceOf(address(this));
        return ownerAssets < realBalance ? ownerAssets : realBalance;
    }

    /**
     * @notice Max shares redeemable by `owner`, capped by real USDC balance.
     */
    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 ownerShares = balanceOf(owner);
        uint256 realBalance = IERC20(asset()).balanceOf(address(this));
        uint256 maxSharesByBalance = _convertToShares(realBalance, Math.Rounding.Floor);
        return ownerShares < maxSharesByBalance ? ownerShares : maxSharesByBalance;
    }

    // ─── Owner Functions ─────────────────────────────────────────────────

    /**
     * @notice Update the annual APR (basis points). Pending yield is accrued first.
     */
    function setAprBps(uint256 newAprBps) external onlyOwner {
        _accrue();
        uint256 old = aprBps;
        aprBps = newAprBps;
        emit AprUpdated(old, newAprBps);
    }

    /**
     * @notice Owner injects real USDC to back accrued virtual yield, enabling withdrawals.
     * @dev Pulls `amount` USDC from msg.sender into the vault. Does NOT change
     *      _totalAssetsStored (virtual yield already accounts for it).
     */
    function injectYield(uint256 amount) external onlyOwner nonReentrant {
        _accrue();
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        emit YieldInjected(msg.sender, amount);
    }

    // ─── View Helpers (frontend / Etherscan) ─────────────────────────────

    /// @notice Current annual APR in basis points (e.g. 400 = 4 %).
    function currentAprBps() external view returns (uint256) {
        return aprBps;
    }

    /// @notice Accrued virtual yield = totalAssets() − real USDC balance.
    function accruedYield() external view returns (uint256) {
        uint256 total = totalAssets();
        uint256 realBalance = IERC20(asset()).balanceOf(address(this));
        return total > realBalance ? total - realBalance : 0;
    }

    // ─── Reject ETH ──────────────────────────────────────────────────────

    receive() external payable {
        revert("ETH not accepted");
    }

    fallback() external payable {
        revert("ETH not accepted");
    }
}

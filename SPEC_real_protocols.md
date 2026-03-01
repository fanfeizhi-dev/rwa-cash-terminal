# SPEC.md — RWA Cash Terminal (Real-Protocol Buckets) on Ethereum Sepolia

> This spec supersedes the earlier "intent-only RWA + self-deployed vault" version. fileciteturn0file0  
> **Hard requirement:** Bucket A and Bucket B must each execute **real protocol interactions** and produce **verifiable Sepolia tx hashes**.  
> **MVP constraint:** start with **one** target market/pool per bucket (single integration each).
>
> **Updated 2026-02-28:** Bucket B migrated from Aave V3 to **LTV Protocol (Morpho EIP-4626 Vault)**. All Aave V3 references in the current architecture have been replaced with LTV Vault equivalents.

---

## 1. Project Overview

### 1.1 One-liner
A **crypto-native cash management terminal** that recommends and executes a two-bucket allocation on **Ethereum Sepolia**, where **both buckets are real protocol legs**:

- **Bucket A (RWA proxy leg)**: a *real* liquidity-pool interaction that represents "tokenized cash / money-market style exposure" in a demo-friendly way.
- **Bucket B (Stable yield leg)**: a *real* EIP-4626 vault deposit into an LTV Morpho Vault.

The terminal produces:
- an explainable **Risk Passport** (scores + terms + "why" bullets)
- an auditable **Receipt** that records **the two protocol tx hashes** + the allocation snapshot.

### 1.2 Why this project (what it proves on a resume)
Most yield dashboards show "APY" but not:
- allocation **policy** (risk budgeting, liquidity windows, regime switches)
- **institution-like auditability** (what plan was recommended, and the exact on-chain executions)
- structured **risk decomposition** (contract, liquidity, oracle, counterparty, operational)

This MVP demonstrates:
- **Finance product** thinking: allocation rules, liquidity preference, stress guardrails, risk passport
- **Web3 engineering**: real protocol interactions, tx proofs, receipts, address/config management
- **UI/UX**: terminal layout, execution stepper, receipts explorer

### 1.3 Non-goals (MVP)
- No production KYC. "Eligibility" is a UI gate + receipt note only.
- No automated rebalancing execution (advisory only).
- No cross-chain.

---

## 2. Chain, Assets, and "Realness" Criteria

### 2.1 Network
- **Ethereum Sepolia**

### 2.2 Funding / stablecoin for execution
Primary (recommended for repeatable demos):
- **Circle testnet USDC** via Circle Faucet (20 USDC / 2 hours / address / chain). citeturn0search2

Token address sourcing:
- USDC testnet contract addresses should be sourced from Circle's official list. citeturn0search5  
  (Note: Sepolia has multiple "USDC-like" tokens in the wild; the app must clearly display the token contract used.)

### 2.3 "Real protocol" definition
A bucket is considered "real" only if:
- the execution sends tx(s) to **third-party protocol contracts** (not only your own contracts),
- the receipt contains **txHash + to-address** that can be verified on Sepolia explorers,
- the UI shows protocol name + contract addresses used.

---

## 3. Buckets (Updated)

> We keep "two buckets" but make both **real protocol legs**. Each bucket starts with **one** market/pool integration.

### 3.1 Bucket B — Stable Yield (LTV Morpho Vault, EIP-4626)
**Protocol:** LTV Protocol (Morpho EIP-4626 Vault on Sepolia).  
**Action:** Deposit USDC into LTV Vault → receive vault shares.

Integration notes:
- LTV Vault address: `0x9A1Fc3ff25083f33373Bbf9617E12892FF19E07A` (Sepolia)
- Underlying asset: Circle USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`)
- Core tx sequence:
  1) `ERC20.approve(USDC, LTVVault, amountB)`
  2) `Vault.deposit(amountB, user)`
  3) (Optional) `Vault.withdraw(amount, user, user)` or `Vault.redeem(shares, user, user)` for demo of exit

**Receipt fields required:**
- `protocol = "LTV Morpho Vault"`
- `market = "Sepolia"`
- `vaultAddress`
- `assetAddress`
- `txHashApprove`, `txHashDeposit` (and optional withdraw/redeem tx)

### 3.2 Bucket A — RWA Proxy (Balancer pool interaction, real LP leg)
**Rationale:** True "tokenized treasuries" are often not accessible or liquid on public testnets. For MVP, Bucket A is defined as a **real LP interaction** that behaves like "cash management" primitives:
- user contributes stablecoin liquidity into a pool and receives a pool share token (BPT),
- exit is via pool exit (liquidity/exit risk is explicit),
- pricing/oracle risk can be modeled.

**Protocol:** Balancer on Sepolia (Vault + pool contracts).  
Balancer publishes Sepolia deployment addresses, including pool factories and core components. citeturn8search11

**Action:** Join a single configured Balancer pool with USDC → receive BPT.

Core tx sequence:
1) `ERC20.approve(USDC, BalancerVault, amountA)`
2) `Vault.joinPool(poolId, user, user, JoinPoolRequest{...})`
3) (Optional) `Vault.exitPool(...)` for demo exit

**Pool coverage (MVP):**
- start with **one** pool (configured by `POOL_ID` + token list + decimals)
- the repo includes a `protocol-config/sepolia.json` to store:
  - Balancer Vault address
  - target `poolId`
  - token addresses used by the pool

**Deployed Pool (2026-02-28):**

| Field | Value |
|-------|-------|
| Pool Name | `50 USDC 50 WETH` |
| Pool Symbol (BPT) | `B-50USDC-50WETH` |
| Pool Address | `0x440953587224069bEa16c06946a9F092915f0c75` |
| Pool ID | `0x440953587224069bea16c06946a9f092915f0c750002000000000000000002d0` |
| Tokens | Circle USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`) + WETH (`0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`) |
| Weights | 50/50 |
| Swap Fee | 0.3% |
| Factory | WeightedPoolFactory v4 (`0x7920BFa1b2041911b354747CA7A6cDD2dfC50Cfd`) |
| Initial Liquidity | 30 USDC + 0.01 WETH |
| BPT Total Supply | ~1.095 |
| Deployer | `0x851D512C49E08d1A925458C5a77A083CcCf39f67` |

Deployment tx hashes (all verified on Sepolia Etherscan):
- Create: `0x786f010e3238a55bc3acfe32c2ebabdefacf4a028d734a76ee6ed68211f7c593`
- Approve USDC: `0xc64ca5e7e34bfb55e9a80bdddb2b47663a37c75b46cc4f0ee3a36def2233f84b`
- Approve WETH: `0x4f8753fd50e2c7b448a61adce5b2e8f041692941f6180681f93f23e9570467a7`
- JoinPool INIT: `0xbb3aeccb480ba920a368aefc69cc55104a9d06a6cacfca8774d8efc560f7166f`

Verification: `Vault.getPoolTokens(poolId)` returns `[USDC, WETH]` with non-zero balances; BPT `totalSupply() > 0`. Config updated in `src/config/sepolia.json`.

**Receipt fields required:**
- `protocol = "Balancer"`
- `vaultAddress`
- `poolId`
- `assetAddress`
- `txHashApprove`, `txHashJoin` (and optional exit)

---

## 4. Allocation Engine (Rules) — Kept, but now both legs are executable

### 4.1 Inputs (unchanged)
User inputs:
- `amount` (USDC)
- `risk_profile`: `conservative | balanced | yield_seeking`
- `exit_window`: `T0 | T3 | T7`
- `eligibility`: `eligible | not_eligible`
- `market_regime`: `normal | stress`

System inputs:
- `bucketA_apr` (LP APR estimate or mocked band)
- `bucketB_apr` (LTV Vault APR from on-chain data / API / fallback if unavailable)
- risk vectors (Section 5)

### 4.2 Base allocations by risk profile
- Conservative: `A 0.60 / B 0.40`
- Balanced: `A 0.45 / B 0.55`
- Yield-seeking: `A 0.30 / B 0.70`

### 4.3 Exit window adjustment (Δ applied to Bucket A)
- T+0: `Δ = -0.20`  (prefer stable-yield liquidity)
- T+3: `Δ = -0.10`
- T+7: `Δ = +0.05`

Compute:
- `allocA_1 = allocA_base + Δ(exit_window)`
- `allocB_1 = 1 - allocA_1`

### 4.4 Guardrails
1) **Eligibility gating**
- If `not_eligible`: set `allocA = 0`, `allocB = 1`
  - UI explanation: "RWA proxy leg disabled due to eligibility status"
  - Receipt records the gating decision

2) **Stress mode cap**
- If `market_regime = stress`: `allocA = min(allocA_1, 0.20)` (avoid LP liquidity risk)

3) **Bounds**
- `allocA ∈ [0.00, 0.70]`
- `allocB ∈ [0.30, 1.00]`

### 4.5 Expected APR range
- `mid = allocA * aprA + allocB * aprB`
- Range width:
  - Conservative: ±0.5%
  - Balanced: ±0.8%
  - Yield-seeking: ±1.2%

Output:
- `expected_apr_range = [mid - width, mid + width]`

### 4.6 Rebalance advisory (no auto execution)
Trigger suggestion if:
- `|current - target| > 8%`, or
- regime/exit window changes.

---

## 5. Risk Passport (Updated risk sources to match real protocols)

### 5.1 Dimensions
1) Smart contract risk  
2) Liquidity / exit risk  
3) Oracle / pricing risk  
4) Market risk  
5) Operational risk  

### 5.2 Bucket risk vectors (demo defaults; higher = riskier)
**Bucket A — Balancer LP**
- Contract: 45
- Liquidity/exit: 55 (modulated by exit_window and stress mode)
- Oracle/pricing: 40
- Market: 20
- Operational: 25

**Bucket B — LTV Morpho Vault**
- Contract: 35
- Liquidity/exit: 15
- Oracle/pricing: 25
- Market: 10
- Operational: 20

### 5.3 Exit-window modulation (applies to Bucket A liquidity/exit)
- T+0: +20
- T+3: +10
- T+7: -5

### 5.4 Score aggregation
Portfolio vector = weighted sum by final allocations.  
Total score uses weights:
- Contract 25%
- Liquidity/exit 25%
- Oracle/pricing 20%
- Market 10%
- Operational 20%

Score → Grade:
- A: ≥ 80
- B: 65–79
- C: < 65

Explainable bullets must be rule-derived (e.g., "Stress mode capped LP leg to 20%").

---

## 6. Receipt (Auditable Record) — Now both are real tx hashes

### 6.1 Purpose
Receipt binds together:
- plan inputs & allocation outputs
- passport hash
- **two protocol executions** (Bucket A + Bucket B) with tx hashes

### 6.2 Schema (MVP JSON)
```json
{
  "receiptId": "string",
  "createdAt": "ISO8601",
  "chain": "sepolia",
  "wallet": "0x...",
  "inputs": {
    "amount": "1000.00",
    "riskProfile": "balanced",
    "exitWindow": "T3",
    "eligibility": "eligible",
    "marketRegime": "normal"
  },
  "snapshots": {
    "bucketA": { "protocol": "Balancer", "apr": 0.045 },
    "bucketB": { "protocol": "LTV Morpho Vault", "apr": 0.040 }
  },
  "allocation": {
    "bucketA_pct": 0.40,
    "bucketB_pct": 0.60,
    "expectedAprRange": [0.045, 0.061]
  },
  "executions": [
    {
      "bucket": "A",
      "protocol": "Balancer",
      "vault": "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "poolId": "0x440953587224069bea16c06946a9f092915f0c750002000000000000000002d0",
      "asset": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      "approveTx": "0x...",
      "actionTx": "0x...",
      "action": "joinPool",
      "amount": "400.00",
      "received": { "token": "BPT", "amount": "..." }
    },
    {
      "bucket": "B",
      "protocol": "LTV Morpho Vault",
      "vault": "0x9A1Fc3ff25083f33373Bbf9617E12892FF19E07A",
      "asset": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      "approveTx": "0x...",
      "actionTx": "0x...",
      "action": "deposit",
      "amount": "600.00",
      "received": { "token": "Vault Shares", "amount": "..." }
    }
  ],
  "passport": {
    "score": 78,
    "grade": "B",
    "radar": {
      "contract": 38,
      "liquidityExit": 30,
      "oraclePricing": 34,
      "market": 12,
      "operational": 22
    },
    "explanations": ["...", "...", "..."],
    "hash": "0xPassportHash"
  }
}
```

---

## 7. UI/UX Specification (Terminal)

### 7.1 Routes
- `/` Landing
- `/terminal/dashboard`
- `/terminal/build`
- `/terminal/passport/[planId]`
- `/terminal/receipt/[receiptId]`
- `/terminal/protocols` (shows addresses + configs used)

### 7.2 "Build Plan" Execution Stepper (must show real tx hashes)
Stepper states:
1) **Compute Plan** (allocation + passport preview)
2) **Execute Bucket A (Balancer)**  
   - Approve → JoinPool → capture tx hashes
3) **Execute Bucket B (LTV Vault)**  
   - Approve → Deposit → capture tx hashes
4) **Generate Receipt** (store locally + render receipt page + export JSON)

UI requirements:
- Show `to` contract addresses per tx
- "View on Sepolia Etherscan" links per tx hash

---

## 8. Implementation Plan

### 8.1 Repo structure
```
rwa-cash-terminal/
  apps/
    web/                       # Vite + React (or Next.js)
  packages/
    protocol-adapters/         # MorphoLtvAdapter, BalancerAdapter (TS)
    allocation-engine/         # deterministic rules + explanations
    passport/                  # risk scoring + radar data
  protocol-config/
    sepolia.json               # addresses + poolId + token list (single pool each bucket)
  docs/
    screenshots/
    diagrams/
```

### 8.2 Front-end stack
- Vite + React + TypeScript (current stack; Next.js optional)
- wagmi + viem (wallet + contract calls)
- Tailwind + shadcn/ui (terminal-grade components)
- Recharts/ECharts (radar, donut, line)

### 8.3 Protocol adapters (core engineering deliverable)
**MorphoLtvAdapter**
- reads vault address from `src/config/sepolia.json`
- exposes `approveAndDeposit(amount)`, `withdrawFromVault(amount)`, `redeemFromVault(shares)`
- returns `{ approveTxHash, depositTxHash, vaultSharesReceived }`

**BalancerAdapter**
- reads `vaultAddress` + `poolId` from `protocol-config/sepolia.json`
- exposes `approveAndJoinPool(amount)`
- returns `{ approveTxHash, joinTxHash, bptReceived }`

### 8.4 Config management (important)
- All protocol addresses and ids live in `protocol-config/sepolia.json`
- App must render `/terminal/protocols` page to show:
  - protocol name
  - contract addresses
  - pool id / market id
  - last-updated timestamp

### 8.5 Data persistence (MVP)
- Receipts stored in `localStorage` (and export JSON download)
- Optionally add "ReceiptRegistry" contract later (not required for MVP)

---

## 9. Success Criteria (Updated)
MVP is complete when:
- Both buckets execute real protocol calls on Sepolia and produce **verifiable tx hashes**
- Build page shows a stepper that executes:
  - Balancer joinPool (Bucket A)
  - LTV Vault deposit (Bucket B)
- Receipt page renders:
  - allocation snapshot
  - passport summary + hash
  - **2+ tx hashes** with explorer links
- Protocols page shows the exact contracts/poolId used

---

## 10. Known Risks / Constraints (Explicit)
- ~~Testnet liquidity and pool availability can be sparse~~ — **Resolved (2026-02-28)**: A custom Balancer WeightedPool containing Circle USDC + WETH has been deployed on Sepolia (see §11).
- Testnet liquidity and pool availability can be sparse; therefore each bucket starts with **one** carefully selected target pool/market.
- USDC testnet token variants may not be interchangeable; use Circle's official addresses and make the contract used explicit in UI. citeturn0search5

---

## 11. Deployment Log

### 2026-02-28: Balancer WeightedPool deployed on Sepolia

A Balancer V2 WeightedPool containing **Circle USDC + WETH** was deployed on Sepolia to resolve the BAL#500 (INVALID_POOL_ID) issue. The pool follows mainnet-professional standards (naming convention `B-50USDC-50WETH`, 0.3% swap fee, 50/50 weights, value-aligned initial liquidity).

- **Pool ID**: `0x440953587224069bea16c06946a9f092915f0c750002000000000000000002d0`
- **Pool Address (BPT)**: `0x440953587224069bEa16c06946a9F092915f0c75`
- **`src/config/sepolia.json`** updated with new `poolId`, `bptToken`, and `tokens` array (now includes both USDC and WETH).
- Deployment script: `balancer-pool-deploy/script/deploy.ts`
- Full audit record: `balancer-pool-deploy/output/deployment.json`
- References: `balancer-pool-deploy/部署指南_完整版.md`, `balancer-pool-deploy/AI_DEPLOY_PROMPT.md`

### 2026-02-28: Bucket B migrated from Aave V3 to LTV Morpho Vault

Bucket B was migrated from Aave V3 to LTV Protocol (Morpho EIP-4626 Vault). All source code under `src/` has been fully updated — zero Aave references remain in code. The spec document (this file) has been updated to reflect the new architecture.

- **LTV Vault**: `0x9A1Fc3ff25083f33373Bbf9617E12892FF19E07A`
- **Underlying asset**: Circle USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`)
- **Adapter**: `MorphoLtvAdapter` with `approveForLtv`, `depositToVault`, `withdrawFromVault`, `redeemFromVault`
- **Config**: `src/config/sepolia.json` → `ltvVault.vault`

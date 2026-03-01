// @ts-nocheck — deploy script run via tsx; viem v2 strict generics not needed
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodePacked,
  getAddress,
  type Hex,
  type Address,
  formatUnits,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Load .env from balancer-pool-deploy/ ───
const envPath = path.resolve(__dirname, "..", ".env");
config({ path: envPath });

// ─── Configuration ───
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const INITIAL_USDC = process.env.INITIAL_USDC || "30";
const INITIAL_WETH = process.env.INITIAL_WETH || "0.01";

if (!PRIVATE_KEY) throw new Error("Missing DEPLOYER_PRIVATE_KEY in .env");
if (!RPC_URL) throw new Error("Missing SEPOLIA_RPC_URL in .env");

const pk: Hex = PRIVATE_KEY.startsWith("0x")
  ? (PRIVATE_KEY as Hex)
  : (`0x${PRIVATE_KEY}` as Hex);

const account = privateKeyToAccount(pk);

// ─── Addresses ───
const VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8" as const;
const WEIGHTED_POOL_FACTORY =
  "0x7920BFa1b2041911b354747CA7A6cDD2dfC50Cfd" as const;
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const;
const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// ─── ABIs ───
const factoryAbi = [
  {
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "tokens", type: "address[]" },
      { name: "normalizedWeights", type: "uint256[]" },
      { name: "rateProviders", type: "address[]" },
      { name: "swapFeePercentage", type: "uint256" },
      { name: "owner", type: "address" },
      { name: "salt", type: "bytes32" },
    ],
    name: "create",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const poolRegisteredEventAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "poolId", type: "bytes32" },
      { indexed: true, name: "poolAddress", type: "address" },
      { indexed: false, name: "specialization", type: "uint8" },
    ],
    name: "PoolRegistered",
    type: "event",
  },
] as const;

const vaultAbi = [
  {
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "assets", type: "address[]" },
          { name: "maxAmountsIn", type: "uint256[]" },
          { name: "userData", type: "bytes" },
          { name: "fromInternalBalance", type: "bool" },
        ],
      },
    ],
    name: "joinPool",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "poolId", type: "bytes32" }],
    name: "getPoolTokens",
    outputs: [
      { name: "tokens", type: "address[]" },
      { name: "balances", type: "uint256[]" },
      { name: "lastChangeBlock", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const erc20Abi = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const wethAbi = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  ...erc20Abi,
] as const;

const poolGetPoolIdAbi = [
  {
    inputs: [],
    name: "getPoolId",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── Clients ───
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(RPC_URL),
});

// ─── Helpers ───
function log(step: string, msg: string) {
  console.log(`[${step}] ${msg}`);
}

async function waitForTx(hash: Hex, label: string) {
  log(label, `Waiting for tx ${hash} ...`);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });
  if (receipt.status === "reverted") {
    throw new Error(`${label}: Transaction reverted! tx=${hash}`);
  }
  log(label, `Confirmed in block ${receipt.blockNumber}`);
  return receipt;
}

// ─── Main deploy flow ───
async function main() {
  console.log("=".repeat(60));
  console.log("Balancer V2 WeightedPool Deployment — Sepolia");
  console.log("=".repeat(60));

  const deployer = account.address;
  log("INIT", `Deployer: ${deployer}`);

  // Pre-flight balance checks
  const ethBalance = await publicClient.getBalance({ address: deployer });
  log("INIT", `ETH balance: ${formatUnits(ethBalance, 18)} ETH`);
  if (ethBalance < parseUnits("0.005", 18)) {
    throw new Error("Insufficient ETH for gas (need >= 0.005 ETH)");
  }

  const usdcAmount = parseUnits(INITIAL_USDC, 6);
  const wethAmount = parseUnits(INITIAL_WETH, 18);
  log("INIT", `Initial liquidity: ${INITIAL_USDC} USDC + ${INITIAL_WETH} WETH`);

  // Check USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [deployer],
  });
  log("INIT", `USDC balance: ${formatUnits(usdcBalance, 6)} USDC`);
  if (usdcBalance < usdcAmount) {
    throw new Error(
      `Insufficient USDC: have ${formatUnits(usdcBalance, 6)}, need ${INITIAL_USDC}`
    );
  }

  // Check WETH balance, wrap if needed
  let wethBalance = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [deployer],
  });
  log("INIT", `WETH balance: ${formatUnits(wethBalance, 18)} WETH`);

  if (wethBalance < wethAmount) {
    const deficit = wethAmount - wethBalance;
    log("WRAP", `Need to wrap ${formatUnits(deficit, 18)} ETH → WETH`);
    const wrapHash = await walletClient.writeContract({
      address: WETH,
      abi: wethAbi,
      functionName: "deposit",
      value: deficit,
    });
    await waitForTx(wrapHash, "WRAP");

    wethBalance = await publicClient.readContract({
      address: WETH,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [deployer],
    });
    log("WRAP", `WETH balance after wrap: ${formatUnits(wethBalance, 18)} WETH`);
  }

  const txHashes: Record<string, string> = {};

  // ══════════════════════════════════════════════════════════
  // STEP 1: Create pool via WeightedPoolFactory.create()
  // ══════════════════════════════════════════════════════════
  log("CREATE", "Creating WeightedPool via Factory...");

  const tokens: [Address, Address] = [
    getAddress(USDC),
    getAddress(WETH),
  ];
  const weights: [bigint, bigint] = [
    500000000000000000n,
    500000000000000000n,
  ];
  const rateProviders: [Address, Address] = [ZERO_ADDRESS, ZERO_ADDRESS];
  const swapFee = 3000000000000000n; // 0.3%

  const salt = keccak256(
    encodePacked(
      ["uint256", "address"],
      [BigInt(Date.now()), deployer]
    )
  );
  log("CREATE", `Salt: ${salt}`);

  const createHash = await walletClient.writeContract({
    address: WEIGHTED_POOL_FACTORY,
    abi: factoryAbi,
    functionName: "create",
    args: [
      "50 USDC 50 WETH",
      "B-50USDC-50WETH",
      tokens,
      weights,
      rateProviders,
      swapFee,
      deployer,
      salt,
    ],
    gas: 6_000_000n,
  });
  txHashes.create = createHash;
  const createReceipt = await waitForTx(createHash, "CREATE");

  // Parse PoolRegistered event from Vault to get poolId
  let poolId: Hex | undefined;
  let poolAddress: Address | undefined;

  // Try Vault's PoolRegistered event first (most reliable)
  for (const eventLog of createReceipt.logs) {
    if (eventLog.address.toLowerCase() === VAULT.toLowerCase()) {
      try {
        const decoded = {
          topics: eventLog.topics,
        };
        // PoolRegistered event topic0
        const poolRegisteredTopic =
          "0x3c13bc30b8e878c53fd2c5b5b528c8e8267c78439818ce26d96e3ef824e67c70";
        if (decoded.topics[0] === poolRegisteredTopic) {
          poolId = decoded.topics[1] as Hex;
          poolAddress = `0x${decoded.topics[2]?.slice(26)}` as Address;
          break;
        }
      } catch {
        // continue
      }
    }
  }

  // Fallback: find pool address from factory event, then call getPoolId()
  if (!poolId) {
    // Look for the new contract address in logs
    for (const eventLog of createReceipt.logs) {
      if (
        eventLog.address.toLowerCase() ===
        WEIGHTED_POOL_FACTORY.toLowerCase()
      ) {
        // Factory PoolCreated event usually has poolAddress as indexed topic
        if (eventLog.topics.length >= 2) {
          const candidateAddr = `0x${eventLog.topics[1]?.slice(26)}` as Address;
          if (candidateAddr !== ZERO_ADDRESS) {
            poolAddress = getAddress(candidateAddr);
            break;
          }
        }
      }
    }

    // If we still don't have poolAddress, scan all created contracts
    if (!poolAddress) {
      // Last resort: check logs for any address that isn't known
      for (const eventLog of createReceipt.logs) {
        const addr = eventLog.address;
        if (
          addr.toLowerCase() !== VAULT.toLowerCase() &&
          addr.toLowerCase() !== WEIGHTED_POOL_FACTORY.toLowerCase() &&
          addr.toLowerCase() !== USDC.toLowerCase() &&
          addr.toLowerCase() !== WETH.toLowerCase()
        ) {
          poolAddress = getAddress(addr);
          break;
        }
      }
    }

    if (!poolAddress) {
      throw new Error("Could not determine pool address from create tx receipt");
    }

    log("CREATE", `Pool address (from logs): ${poolAddress}`);
    poolId = await publicClient.readContract({
      address: poolAddress,
      abi: poolGetPoolIdAbi,
      functionName: "getPoolId",
    });
  }

  if (!poolId) {
    throw new Error("Failed to obtain poolId");
  }

  poolAddress = poolAddress ? getAddress(poolAddress) : undefined;
  if (!poolAddress) {
    // Extract from poolId (first 20 bytes)
    poolAddress = getAddress(`0x${poolId.slice(2, 42)}`);
  }

  log("CREATE", `Pool address: ${poolAddress}`);
  log("CREATE", `Pool ID: ${poolId}`);

  // ══════════════════════════════════════════════════════════
  // STEP 2: Approve Vault to spend USDC and WETH
  // ══════════════════════════════════════════════════════════
  log("APPROVE", "Approving USDC for Vault...");
  const approveUsdcHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [VAULT, usdcAmount],
  });
  txHashes.approveUsdc = approveUsdcHash;
  await waitForTx(approveUsdcHash, "APPROVE-USDC");

  log("APPROVE", "Approving WETH for Vault...");
  const approveWethHash = await walletClient.writeContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "approve",
    args: [VAULT, wethAmount],
  });
  txHashes.approveWeth = approveWethHash;
  await waitForTx(approveWethHash, "APPROVE-WETH");

  // ══════════════════════════════════════════════════════════
  // STEP 3: Join pool with INIT (JoinKind = 0)
  // ══════════════════════════════════════════════════════════
  log("JOIN", "Joining pool with INIT liquidity...");

  const amountsIn: [bigint, bigint] = [usdcAmount, wethAmount];

  const userData = encodeAbiParameters(
    parseAbiParameters("uint256, uint256[]"),
    [0n, amountsIn]
  );

  const joinHash = await walletClient.writeContract({
    address: VAULT,
    abi: vaultAbi,
    functionName: "joinPool",
    args: [
      poolId,
      deployer,
      deployer,
      {
        assets: tokens,
        maxAmountsIn: amountsIn,
        userData,
        fromInternalBalance: false,
      },
    ],
    gas: 1_000_000n,
  });
  txHashes.joinPool = joinHash;
  await waitForTx(joinHash, "JOIN");

  // ══════════════════════════════════════════════════════════
  // STEP 4: Verify deployment
  // ══════════════════════════════════════════════════════════
  log("VERIFY", "Verifying pool on-chain...");

  const poolTokens = await publicClient.readContract({
    address: VAULT,
    abi: vaultAbi,
    functionName: "getPoolTokens",
    args: [poolId],
  });

  const [registeredTokens, balances, lastChangeBlock] = poolTokens;
  log("VERIFY", `Registered tokens: ${registeredTokens.join(", ")}`);
  log(
    "VERIFY",
    `Balances: ${balances.map((b, i) => {
      const dec = registeredTokens[i].toLowerCase() === USDC.toLowerCase() ? 6 : 18;
      return formatUnits(b, dec);
    }).join(", ")}`
  );
  log("VERIFY", `Last change block: ${lastChangeBlock}`);

  if (balances.some((b) => b === 0n)) {
    console.warn("⚠️  WARNING: Some balances are zero!");
  }

  const bptSupply = await publicClient.readContract({
    address: poolAddress,
    abi: erc20Abi,
    functionName: "totalSupply",
  });
  log("VERIFY", `BPT totalSupply: ${formatUnits(bptSupply, 18)}`);
  if (bptSupply === 0n) {
    throw new Error("BPT totalSupply is 0 — INIT may have failed silently");
  }

  log("VERIFY", "Deployment verified successfully!");

  // ══════════════════════════════════════════════════════════
  // STEP 5: Update sepolia.json
  // ══════════════════════════════════════════════════════════
  log("CONFIG", "Updating src/config/sepolia.json...");

  const sepoliaConfigPath = path.resolve(
    __dirname,
    "..",
    "..",
    "src",
    "config",
    "sepolia.json"
  );
  const sepoliaConfig = JSON.parse(fs.readFileSync(sepoliaConfigPath, "utf-8"));

  sepoliaConfig.balancer.poolId = poolId;
  sepoliaConfig.balancer.bptToken = poolAddress;
  sepoliaConfig.balancer.tokens = [USDC, WETH];

  fs.writeFileSync(sepoliaConfigPath, JSON.stringify(sepoliaConfig, null, 2) + "\n");
  log("CONFIG", "sepolia.json updated");

  // ══════════════════════════════════════════════════════════
  // STEP 6: Write deployment output
  // ══════════════════════════════════════════════════════════
  const output = {
    network: "sepolia",
    chainId: 11155111,
    deployer,
    poolId,
    poolAddress,
    poolName: "50 USDC 50 WETH",
    poolSymbol: "B-50USDC-50WETH",
    tokens: { USDC, WETH },
    weights: "50/50",
    swapFee: "0.3%",
    initialLiquidity: {
      USDC: INITIAL_USDC,
      WETH: INITIAL_WETH,
    },
    txHashes,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(__dirname, "..", "output", "deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
  log("OUTPUT", `Deployment record saved to ${outputPath}`);

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("\n❌ DEPLOYMENT FAILED:", err.message || err);
  process.exit(1);
});

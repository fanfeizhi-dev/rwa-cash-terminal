import { readContract } from '@wagmi/core';
import { config } from '../config/wagmi';
import sepoliaConfig from '../config/sepolia.json';
import { balancerVaultReadAbi, eip4626VaultReadAbi, erc20ReadAbi } from '../config/abis';
import { balancerPoolReadAbi } from '../config/abis';
import { sepolia } from 'wagmi/chains';
import { formatUnits } from 'viem';
import { RiskConfig, RiskVector, DEFAULT_RISK_CONFIG } from '../config/riskDefaults';
import type { OnChainPositions } from './onChainPositions';

export interface RiskDataResult {
  config: RiskConfig;
  sources: {
    primary: string;
    details: string[];
    fetchedAt: string;
  };
}

interface HeuristicSignals {
  contractVerifiedA: boolean | null;
  contractVerifiedB: boolean | null;
  poolTvlUsd: number | null;
  vaultTotalAssets: number | null;
  valuationMethodReliable: boolean;
  volatileTokenWeight: number | null;
  vaultAprBps: number | null;
}

async function checkEtherscanVerified(address: string): Promise<boolean | null> {
  try {
    const resp = await fetch(
      `https://api-sepolia.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=YourApiKeyToken`,
      { signal: AbortSignal.timeout(5000) },
    );
    const json = await resp.json();
    return json.status === '1';
  } catch {
    return null;
  }
}

async function fetchPoolTvl(): Promise<number | null> {
  try {
    const result = await readContract(config, {
      abi: balancerVaultReadAbi,
      functionName: 'getPoolTokens',
      args: [sepoliaConfig.balancer.poolId as `0x${string}`],
      chainId: sepolia.id,
      address: sepoliaConfig.balancer.vault as `0x${string}`,
    } as any);
    const [tokens, balances] = result as [readonly `0x${string}`[], readonly bigint[], bigint];
    const usdcAddr = sepoliaConfig.assets.USDC.address.toLowerCase();
    let usdcValue = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].toLowerCase() === usdcAddr) {
        usdcValue += Number(formatUnits(balances[i], sepoliaConfig.assets.USDC.decimals));
      }
    }
    // Rough total: multiply by 2 for a ~50/50 pool (heuristic only for risk scoring)
    return usdcValue > 0 ? usdcValue * 2 : null;
  } catch {
    return null;
  }
}

async function fetchVaultTotalAssets(): Promise<number | null> {
  try {
    const raw = await readContract(config, {
      abi: eip4626VaultReadAbi,
      functionName: 'totalAssets',
      args: [],
      chainId: sepolia.id,
      address: sepoliaConfig.ltvVault.vault as `0x${string}`,
    } as any) as bigint;
    return Number(formatUnits(raw, sepoliaConfig.assets.USDC.decimals));
  } catch {
    return null;
  }
}

async function fetchVaultAprBps(): Promise<number | null> {
  try {
    const raw = await readContract(config, {
      abi: eip4626VaultReadAbi,
      functionName: 'currentAprBps',
      args: [],
      chainId: sepolia.id,
      address: sepoliaConfig.ltvVault.vault as `0x${string}`,
    } as any) as bigint;
    return Number(raw);
  } catch {
    return null;
  }
}

async function fetchVolatileWeight(): Promise<number | null> {
  try {
    const weightsRaw = await readContract(config, {
      abi: balancerPoolReadAbi,
      functionName: 'getNormalizedWeights',
      args: [],
      chainId: sepolia.id,
      address: sepoliaConfig.balancer.bptToken as `0x${string}`,
    } as any);
    const tokensResult = await readContract(config, {
      abi: balancerVaultReadAbi,
      functionName: 'getPoolTokens',
      args: [sepoliaConfig.balancer.poolId as `0x${string}`],
      chainId: sepolia.id,
      address: sepoliaConfig.balancer.vault as `0x${string}`,
    } as any);
    const [tokens] = tokensResult as [readonly `0x${string}`[], readonly bigint[], bigint];
    const weights = (weightsRaw as readonly bigint[]).map(w => Number(formatUnits(w, 18)));
    const usdcAddr = sepoliaConfig.assets.USDC.address.toLowerCase();
    let volatileWeight = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].toLowerCase() !== usdcAddr) {
        volatileWeight += weights[i] ?? 0;
      }
    }
    return volatileWeight;
  } catch {
    return null;
  }
}

function scoreFromHeuristics(signals: HeuristicSignals): { bucketA: RiskVector; bucketB: RiskVector } {
  const bucketA: RiskVector = { ...DEFAULT_RISK_CONFIG.bucketA };
  const bucketB: RiskVector = { ...DEFAULT_RISK_CONFIG.bucketB };

  // Smart Contract Risk — verified contracts = lower risk
  if (signals.contractVerifiedA === true) bucketA.contract = Math.max(bucketA.contract - 15, 10);
  if (signals.contractVerifiedA === false) bucketA.contract = Math.min(bucketA.contract + 10, 90);
  if (signals.contractVerifiedB === true) bucketB.contract = Math.max(bucketB.contract - 15, 10);
  if (signals.contractVerifiedB === false) bucketB.contract = Math.min(bucketB.contract + 10, 90);

  // Liquidity Risk — low TVL = higher risk
  if (signals.poolTvlUsd !== null) {
    if (signals.poolTvlUsd > 500_000) bucketA.liquidity = Math.max(bucketA.liquidity - 20, 10);
    else if (signals.poolTvlUsd > 100_000) bucketA.liquidity = Math.max(bucketA.liquidity - 10, 15);
    else if (signals.poolTvlUsd < 10_000) bucketA.liquidity = Math.min(bucketA.liquidity + 15, 90);
  }
  if (signals.vaultTotalAssets !== null) {
    if (signals.vaultTotalAssets > 100_000) bucketB.liquidity = Math.max(bucketB.liquidity - 5, 5);
    else if (signals.vaultTotalAssets < 1_000) bucketB.liquidity = Math.min(bucketB.liquidity + 10, 60);
  }

  // Oracle / Pricing Risk — fallback pricing = higher risk
  if (!signals.valuationMethodReliable) {
    bucketA.oracle = Math.min(bucketA.oracle + 20, 80);
  } else {
    bucketA.oracle = Math.max(bucketA.oracle - 10, 15);
  }

  // Market Risk — higher volatile-asset weight = higher market risk
  if (signals.volatileTokenWeight !== null) {
    const volPct = signals.volatileTokenWeight * 100;
    if (volPct > 70) bucketA.market = Math.min(bucketA.market + 15, 70);
    else if (volPct > 50) bucketA.market = Math.min(bucketA.market + 5, 50);
    else bucketA.market = Math.max(bucketA.market - 5, 5);
  }

  // Operational Risk — extreme or zero APR is suspicious
  if (signals.vaultAprBps !== null) {
    if (signals.vaultAprBps === 0) bucketB.operational = Math.min(bucketB.operational + 15, 70);
    else if (signals.vaultAprBps > 5000) bucketB.operational = Math.min(bucketB.operational + 20, 80);
    else bucketB.operational = Math.max(bucketB.operational - 5, 5);
  }

  return { bucketA, bucketB };
}

export async function fetchRiskData(
  positions?: OnChainPositions | null,
): Promise<RiskDataResult> {
  const details: string[] = [];
  const fetchedAt = new Date().toISOString();

  try {
    const [
      contractVerifiedA,
      contractVerifiedB,
      poolTvl,
      vaultTotal,
      vaultApr,
      volatileWeight,
    ] = await Promise.all([
      checkEtherscanVerified(sepoliaConfig.balancer.vault),
      checkEtherscanVerified(sepoliaConfig.ltvVault.vault),
      fetchPoolTvl(),
      fetchVaultTotalAssets(),
      fetchVaultAprBps(),
      fetchVolatileWeight(),
    ]);

    const valuationMethodReliable = positions?.valuationMethod === 'pool_tokens';

    const signals: HeuristicSignals = {
      contractVerifiedA,
      contractVerifiedB,
      poolTvlUsd: poolTvl,
      vaultTotalAssets: vaultTotal,
      valuationMethodReliable,
      volatileTokenWeight: volatileWeight,
      vaultAprBps: vaultApr,
    };

    // Build detail strings
    details.push(
      `Smart Contract: Etherscan verification — Balancer Vault: ${contractVerifiedA === true ? 'verified' : contractVerifiedA === false ? 'unverified' : 'check failed'}, SepoliaVault: ${contractVerifiedB === true ? 'verified' : contractVerifiedB === false ? 'unverified' : 'check failed'}`,
    );
    details.push(
      `Liquidity: On-chain pool TVL ${poolTvl !== null ? `$${poolTvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '(unavailable)'}, Vault totalAssets ${vaultTotal !== null ? `$${vaultTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '(unavailable)'}`,
    );
    details.push(
      `Oracle: BPT price derivation method — ${valuationMethodReliable ? 'pool_tokens (reliable)' : 'fallback_1to1 (degraded)'}`,
    );
    details.push(
      `Market: Pool volatile-asset weight — ${volatileWeight !== null ? `${(volatileWeight * 100).toFixed(1)}%` : '(unavailable)'}`,
    );
    details.push(
      `Operational: Vault APR setting — ${vaultApr !== null ? `${vaultApr} bps (${(vaultApr / 100).toFixed(2)}%)` : '(unavailable)'}`,
    );

    const anySignal =
      contractVerifiedA !== null ||
      contractVerifiedB !== null ||
      poolTvl !== null ||
      vaultTotal !== null ||
      volatileWeight !== null ||
      vaultApr !== null;

    if (!anySignal) {
      console.warn('No on-chain heuristic signals available, using static defaults.');
      return {
        config: { ...DEFAULT_RISK_CONFIG, fetchedAt },
        sources: { primary: 'static_defaults', details: ['All on-chain queries failed. Fell back to static defaults.'], fetchedAt },
      };
    }

    const { bucketA, bucketB } = scoreFromHeuristics(signals);

    return {
      config: {
        bucketA,
        bucketB,
        isDemo: false,
        source: 'on_chain_heuristics',
        sourceDetails: details,
        fetchedAt,
      },
      sources: { primary: 'on_chain_heuristics', details, fetchedAt },
    };
  } catch (e) {
    console.warn('Failed to fetch risk data, falling back to defaults:', e);
    return {
      config: { ...DEFAULT_RISK_CONFIG, fetchedAt },
      sources: { primary: 'static_defaults', details: ['Risk data fetch failed. Using static defaults.'], fetchedAt },
    };
  }
}

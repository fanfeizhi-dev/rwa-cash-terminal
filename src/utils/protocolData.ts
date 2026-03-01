import { readContract } from '@wagmi/core';
import { config } from '../config/wagmi';
import sepoliaConfig from '../config/sepolia.json';
import { eip4626VaultReadAbi } from '../config/abis';
import { sepolia } from 'wagmi/chains';

export interface ProtocolAprData {
  bucketA_apr: number;
  bucketB_apr: number;
  bucketA_isEstimated: boolean;
  bucketB_isEstimated: boolean;
  fetchedAt: string;
}

export const FALLBACK_APR_A = 0.045;
export const FALLBACK_APR_B = 0.04;

async function fetchBalancerApr(): Promise<number | null> {
  try {
    const response = await fetch('https://api-v3.balancer.fi/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          poolGetPool(id: "${sepoliaConfig.balancer.poolId}", chain: SEPOLIA) {
            dynamicData {
              aprItems {
                apr
                type
              }
            }
          }
        }`
      }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await response.json();
    const aprItems = json?.data?.poolGetPool?.dynamicData?.aprItems;
    if (Array.isArray(aprItems) && aprItems.length > 0) {
      const totalApr = aprItems.reduce((sum: number, item: any) => sum + (Number(item.apr) || 0), 0);
      if (totalApr > 0 && totalApr < 1) {
        return totalApr;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchLtvVaultApr(): Promise<number | null> {
  try {
    const aprBps = await readContract(config, {
      abi: eip4626VaultReadAbi,
      functionName: 'currentAprBps',
      args: [],
      chainId: sepolia.id,
      address: sepoliaConfig.ltvVault.vault as `0x${string}`,
    } as any) as bigint;

    const apr = Number(aprBps) / 10_000;
    if (apr > 0 && apr < 1) {
      return apr;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchProtocolAprs(): Promise<ProtocolAprData> {
  let bucketB_apr = FALLBACK_APR_B;
  let bucketB_isEstimated = true;

  let bucketA_apr = FALLBACK_APR_A;
  let bucketA_isEstimated = true;

  try {
    const [balancerApr, ltvApr] = await Promise.all([
      fetchBalancerApr(),
      fetchLtvVaultApr(),
    ]);

    if (balancerApr !== null) {
      bucketA_apr = balancerApr;
      bucketA_isEstimated = false;
    }

    if (ltvApr !== null) {
      bucketB_apr = ltvApr;
      bucketB_isEstimated = false;
    }
  } catch (e) {
    console.warn('Failed to fetch protocol APRs, using fallbacks:', e);
  }

  return {
    bucketA_apr,
    bucketB_apr,
    bucketA_isEstimated,
    bucketB_isEstimated,
    fetchedAt: new Date().toISOString(),
  };
}

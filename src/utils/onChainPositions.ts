import { readContract } from '@wagmi/core';
import { config } from '../config/wagmi';
import sepoliaConfig from '../config/sepolia.json';
import { erc20ReadAbi, eip4626VaultReadAbi } from '../config/abis';
import { sepolia } from 'wagmi/chains';
import { formatUnits } from 'viem';
import { fetchBptPriceMultiSource, BptPriceResult } from './bptPriceOracle';

export interface OnChainPositions {
  usdcBalance: number;
  vaultShareBalance: number;
  vaultAssetValue: number;
  bptBalance: number;
  totalValueUsd: number;
  bucketASplit: number;
  bucketBSplit: number;
  isLoaded: boolean;
  isError: boolean;
  fetchedAt: string;
  bptPriceUsd?: number;
  valuationMethod?: 'pool_tokens' | 'coingecko' | 'defillama' | 'balancer_api' | 'fallback_1to1';
  bptPriceConfidence?: 'high' | 'medium' | 'low';
  bptPriceSources?: BptPriceResult['sources'];
  poolWeights?: { token: string; weight: number }[];
}

export async function fetchPositions(address: `0x${string}`): Promise<OnChainPositions> {
  const empty: OnChainPositions = {
    usdcBalance: 0, vaultShareBalance: 0, vaultAssetValue: 0, bptBalance: 0,
    totalValueUsd: 0, bucketASplit: 0, bucketBSplit: 0,
    isLoaded: false, isError: true, fetchedAt: new Date().toISOString(),
  };

  try {
    const readOpts = (addr: string) => ({
      abi: erc20ReadAbi, functionName: 'balanceOf' as const,
      args: [address], chainId: sepolia.id,
      address: addr as `0x${string}`,
    });

    const vaultAddr = sepoliaConfig.ltvVault.vault as `0x${string}`;

    const [vaultSharesRaw, vaultDecimalsRaw, bptRaw, usdcRaw, bptPriceData] = await Promise.all([
      readContract(config, {
        abi: eip4626VaultReadAbi,
        functionName: 'balanceOf',
        args: [address],
        chainId: sepolia.id,
        address: vaultAddr,
      } as any),
      readContract(config, {
        abi: eip4626VaultReadAbi,
        functionName: 'decimals',
        args: [],
        chainId: sepolia.id,
        address: vaultAddr,
      } as any).catch(() => 6),
      readContract(config, readOpts(sepoliaConfig.balancer.bptToken) as any),
      readContract(config, readOpts(sepoliaConfig.assets.USDC.address) as any),
      fetchBptPriceMultiSource(),
    ]) as [bigint, number, bigint, bigint, BptPriceResult];

    const vaultDecimals = Number(vaultDecimalsRaw);

    let vaultAssetValueRaw = 0n;
    if (vaultSharesRaw > 0n) {
      try {
        vaultAssetValueRaw = await readContract(config, {
          abi: eip4626VaultReadAbi,
          functionName: 'convertToAssets',
          args: [vaultSharesRaw],
          chainId: sepolia.id,
          address: vaultAddr,
        } as any) as bigint;
      } catch {
        vaultAssetValueRaw = vaultSharesRaw;
      }
    }

    const vaultShares = Number(formatUnits(vaultSharesRaw, vaultDecimals));
    const vaultAssetValue = Number(formatUnits(vaultAssetValueRaw, sepoliaConfig.assets.USDC.decimals));
    const bpt = Number(formatUnits(bptRaw, 18));
    const usdc = Number(formatUnits(usdcRaw, sepoliaConfig.assets.USDC.decimals));

    const bptValueUsd = bpt * bptPriceData.pricePerBpt;
    const totalValue = vaultAssetValue + bptValueUsd;
    const total = totalValue || 1;

    return {
      usdcBalance: usdc,
      vaultShareBalance: vaultShares,
      vaultAssetValue,
      bptBalance: bpt,
      totalValueUsd: totalValue,
      bucketASplit: bptValueUsd / total,
      bucketBSplit: vaultAssetValue / total,
      isLoaded: true,
      isError: false,
      fetchedAt: new Date().toISOString(),
      bptPriceUsd: bptPriceData.pricePerBpt,
      valuationMethod: bptPriceData.method,
      bptPriceConfidence: bptPriceData.confidence,
      bptPriceSources: bptPriceData.sources,
      poolWeights: bptPriceData.poolWeights,
    };
  } catch (e) {
    console.warn('Failed to fetch on-chain positions:', e);
    return empty;
  }
}

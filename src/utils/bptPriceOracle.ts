import { readContract } from '@wagmi/core';
import { config } from '../config/wagmi';
import sepoliaConfig from '../config/sepolia.json';
import { balancerVaultReadAbi, erc20ReadAbi, balancerPoolReadAbi } from '../config/abis';
import { sepolia } from 'wagmi/chains';
import { formatUnits } from 'viem';

export interface BptPriceResult {
  pricePerBpt: number;
  method: 'pool_tokens' | 'coingecko' | 'defillama' | 'balancer_api' | 'fallback_1to1';
  confidence: 'high' | 'medium' | 'low';
  sources: {
    poolTokens?: { price: number; success: boolean };
    coingecko?: { price: number; success: boolean };
    defiLlama?: { price: number; success: boolean };
    balancerApi?: { price: number; success: boolean };
  };
  poolWeights?: { token: string; weight: number }[];
  fetchedAt: string;
}

async function fetchPriceViaPoolTokens(): Promise<{
  price: number;
  weights: { token: string; weight: number }[] | null;
} | null> {
  try {
    const [poolTokensResult, totalSupplyRaw] = await Promise.all([
      readContract(config, {
        abi: balancerVaultReadAbi,
        functionName: 'getPoolTokens',
        args: [sepoliaConfig.balancer.poolId as `0x${string}`],
        chainId: sepolia.id,
        address: sepoliaConfig.balancer.vault as `0x${string}`,
      } as any),
      readContract(config, {
        abi: erc20ReadAbi,
        functionName: 'totalSupply',
        chainId: sepolia.id,
        address: sepoliaConfig.balancer.bptToken as `0x${string}`,
      } as any),
    ]);

    const [tokens, balances] = poolTokensResult as [readonly `0x${string}`[], readonly bigint[], bigint];
    const totalSupply = Number(formatUnits(totalSupplyRaw as bigint, 18));
    if (totalSupply === 0) return null;

    const usdcAddress = sepoliaConfig.assets.USDC.address.toLowerCase();
    let usdcValueUsd = 0;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].toLowerCase() === usdcAddress) {
        usdcValueUsd += Number(formatUnits(balances[i], sepoliaConfig.assets.USDC.decimals));
      }
    }

    // Try to get actual weights
    let weights: { token: string; weight: number }[] | null = null;
    let totalPoolValueUsd = 0;

    try {
      const weightsRaw = await readContract(config, {
        abi: balancerPoolReadAbi,
        functionName: 'getNormalizedWeights',
        args: [],
        chainId: sepolia.id,
        address: sepoliaConfig.balancer.bptToken as `0x${string}`,
      } as any);

      const w = (weightsRaw as readonly bigint[]).map(v => Number(formatUnits(v, 18)));
      weights = tokens.map((t, i) => ({ token: t, weight: w[i] ?? 0 }));

      const usdcIndex = tokens.findIndex(t => t.toLowerCase() === usdcAddress);
      if (usdcIndex >= 0 && w[usdcIndex] > 0) {
        totalPoolValueUsd = usdcValueUsd / w[usdcIndex];
      }
    } catch {
      // Fallback: assume 50/50 weights
      const hasNonUsdc = tokens.some(t => t.toLowerCase() !== usdcAddress);
      totalPoolValueUsd = hasNonUsdc && usdcValueUsd > 0 ? usdcValueUsd * 2 : usdcValueUsd;
    }

    if (totalPoolValueUsd === 0) return null;

    return { price: totalPoolValueUsd / totalSupply, weights };
  } catch (e) {
    console.warn('Pool tokens price fetch failed:', e);
    return null;
  }
}

async function fetchPriceViaBalancerApi(): Promise<number | null> {
  try {
    const response = await fetch('https://api-v3.balancer.fi/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          poolGetPool(id: "${sepoliaConfig.balancer.poolId}", chain: SEPOLIA) {
            dynamicData { totalLiquidity totalShares }
          }
        }`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await response.json();
    const dd = json?.data?.poolGetPool?.dynamicData;
    if (dd?.totalLiquidity && dd?.totalShares) {
      const tvl = Number(dd.totalLiquidity);
      const shares = Number(dd.totalShares);
      if (shares > 0 && tvl > 0) return tvl / shares;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchPriceViaDeFiLlama(): Promise<number | null> {
  try {
    const resp = await fetch(
      `https://coins.llama.fi/prices/current/ethereum:${sepoliaConfig.balancer.bptToken}`,
      { signal: AbortSignal.timeout(5000) },
    );
    const json = await resp.json();
    const key = `ethereum:${sepoliaConfig.balancer.bptToken}`.toLowerCase();
    const coin = json?.coins?.[key];
    if (coin?.price && coin.price > 0) return coin.price;
    return null;
  } catch {
    return null;
  }
}

async function fetchPriceViaCoinGecko(): Promise<number | null> {
  try {
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${sepoliaConfig.balancer.bptToken}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) },
    );
    const json = await resp.json();
    const addr = sepoliaConfig.balancer.bptToken.toLowerCase();
    if (json?.[addr]?.usd && json[addr].usd > 0) return json[addr].usd;
    return null;
  } catch {
    return null;
  }
}

export async function fetchBptPriceMultiSource(): Promise<BptPriceResult> {
  const fetchedAt = new Date().toISOString();
  const sources: BptPriceResult['sources'] = {};

  const [poolResult, balancerApiPrice, defiLlamaPrice, coinGeckoPrice] = await Promise.all([
    fetchPriceViaPoolTokens(),
    fetchPriceViaBalancerApi(),
    fetchPriceViaDeFiLlama(),
    fetchPriceViaCoinGecko(),
  ]);

  if (poolResult) sources.poolTokens = { price: poolResult.price, success: true };
  if (balancerApiPrice !== null) sources.balancerApi = { price: balancerApiPrice, success: true };
  if (defiLlamaPrice !== null) sources.defiLlama = { price: defiLlamaPrice, success: true };
  if (coinGeckoPrice !== null) sources.coingecko = { price: coinGeckoPrice, success: true };

  const prices: { source: string; price: number }[] = [];
  if (poolResult) prices.push({ source: 'pool_tokens', price: poolResult.price });
  if (balancerApiPrice !== null) prices.push({ source: 'balancer_api', price: balancerApiPrice });
  if (defiLlamaPrice !== null) prices.push({ source: 'defillama', price: defiLlamaPrice });
  if (coinGeckoPrice !== null) prices.push({ source: 'coingecko', price: coinGeckoPrice });

  if (prices.length === 0) {
    return {
      pricePerBpt: 1,
      method: 'fallback_1to1',
      confidence: 'low',
      sources,
      fetchedAt,
    };
  }

  // Primary: on-chain pool tokens
  const primary = poolResult
    ? { price: poolResult.price, method: 'pool_tokens' as const }
    : { price: prices[0].price, method: prices[0].source as BptPriceResult['method'] };

  // Cross-validation: check if sources agree
  let confidence: BptPriceResult['confidence'] = 'high';
  if (prices.length >= 2) {
    const maxDivergence = Math.max(
      ...prices.map(a =>
        Math.max(...prices.map(b => Math.abs(a.price - b.price) / Math.max(a.price, b.price))),
      ),
    );
    if (maxDivergence > 0.20) {
      confidence = 'low';
      console.warn(`BPT price divergence detected: ${(maxDivergence * 100).toFixed(1)}%`, prices);
    } else if (maxDivergence > 0.05) {
      confidence = 'medium';
    }
  } else if (prices.length === 1) {
    confidence = poolResult ? 'high' : 'medium';
  }

  return {
    pricePerBpt: primary.price,
    method: primary.method,
    confidence,
    sources,
    poolWeights: poolResult?.weights ?? undefined,
    fetchedAt,
  };
}

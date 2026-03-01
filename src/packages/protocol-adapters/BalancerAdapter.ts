import { encodeAbiParameters, parseAbiParameters } from 'viem';
import { sepolia } from 'wagmi/chains';
import { readContract } from '@wagmi/core';
import sepoliaConfig from '../../config/sepolia.json';
import { erc20Abi, balancerVaultAbi, balancerVaultReadAbi } from '../../config/abis';
import { config } from '../../config/wagmi';
import { estimateGasWithFallback } from '../../utils/gasEstimator';
import type { WriteContractFn } from './types';

export async function approveForBalancer(
  writeContract: WriteContractFn,
  account: `0x${string}`,
  usdcAmount: bigint,
): Promise<`0x${string}`> {
  const gas = await estimateGasWithFallback(
    {
      address: sepoliaConfig.assets.USDC.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [sepoliaConfig.balancer.vault as `0x${string}`, usdcAmount],
      account,
    },
    'approve',
  );

  return writeContract({
    address: sepoliaConfig.assets.USDC.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'approve',
    args: [sepoliaConfig.balancer.vault as `0x${string}`, usdcAmount],
    account,
    chain: sepolia,
    gas: gas.gasLimit,
  });
}

export async function joinPool(
  writeContract: WriteContractFn,
  account: `0x${string}`,
  usdcAmount: bigint,
): Promise<`0x${string}`> {
  const poolTokensResult = await readContract(config, {
    address: sepoliaConfig.balancer.vault as `0x${string}`,
    abi: balancerVaultReadAbi,
    functionName: 'getPoolTokens',
    args: [sepoliaConfig.balancer.poolId as `0x${string}`],
    chainId: sepolia.id,
  } as any);

  const tokens = [...poolTokensResult[0]] as `0x${string}`[];
  const amountsIn = tokens.map(t =>
    t.toLowerCase() === sepoliaConfig.assets.USDC.address.toLowerCase() ? usdcAmount : 0n
  );

  const userData = encodeAbiParameters(
    parseAbiParameters('uint256, uint256[], uint256'),
    [1n, amountsIn, 0n],
  );

  const joinArgs = [
    sepoliaConfig.balancer.poolId as `0x${string}`,
    account,
    account,
    { assets: tokens, maxAmountsIn: amountsIn, userData, fromInternalBalance: false },
  ];

  const gas = await estimateGasWithFallback(
    {
      address: sepoliaConfig.balancer.vault as `0x${string}`,
      abi: balancerVaultAbi,
      functionName: 'joinPool',
      args: joinArgs,
      account,
    },
    'joinPool',
  );

  return writeContract({
    address: sepoliaConfig.balancer.vault as `0x${string}`,
    abi: balancerVaultAbi,
    functionName: 'joinPool',
    args: joinArgs,
    account,
    chain: sepolia,
    gas: gas.gasLimit,
  });
}

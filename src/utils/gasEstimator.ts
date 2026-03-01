import { estimateGas } from '@wagmi/core';
import { encodeFunctionData } from 'viem';
import { config } from '../config/wagmi';
import { sepolia } from 'wagmi/chains';

export interface GasEstimateResult {
  gasLimit: bigint;
  method: 'estimated' | 'fallback';
  originalEstimate?: bigint;
}

const GAS_BUFFER_MULTIPLIER = 1.3;

const FALLBACK_GAS: Record<string, bigint> = {
  approve: 100_000n,
  deposit: 500_000n,
  withdraw: 500_000n,
  redeem: 500_000n,
  joinPool: 1_500_000n,
};

export async function estimateGasWithFallback(
  txRequest: {
    address: `0x${string}`;
    abi: readonly Record<string, unknown>[];
    functionName: string;
    args: unknown[];
    account: `0x${string}`;
  },
  operationType: keyof typeof FALLBACK_GAS,
): Promise<GasEstimateResult> {
  try {
    const data = encodeFunctionData({
      abi: txRequest.abi as any,
      functionName: txRequest.functionName,
      args: txRequest.args as any,
    });

    const estimate = await estimateGas(config, {
      to: txRequest.address,
      account: txRequest.account,
      chainId: sepolia.id,
      data,
    });

    const buffered = BigInt(Math.ceil(Number(estimate) * GAS_BUFFER_MULTIPLIER));
    return {
      gasLimit: buffered,
      method: 'estimated',
      originalEstimate: estimate,
    };
  } catch {
    return {
      gasLimit: FALLBACK_GAS[operationType] ?? 500_000n,
      method: 'fallback',
    };
  }
}

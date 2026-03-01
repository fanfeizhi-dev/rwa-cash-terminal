import { sepolia } from 'wagmi/chains';
import sepoliaConfig from '../../config/sepolia.json';
import { erc20Abi, eip4626VaultAbi } from '../../config/abis';
import { estimateGasWithFallback } from '../../utils/gasEstimator';
import type { WriteContractFn } from './types';

export async function approveForVault(
  writeContract: WriteContractFn,
  account: `0x${string}`,
  usdcAmount: bigint,
): Promise<`0x${string}`> {
  const gas = await estimateGasWithFallback(
    {
      address: sepoliaConfig.assets.USDC.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [sepoliaConfig.ltvVault.vault as `0x${string}`, usdcAmount],
      account,
    },
    'approve',
  );

  return writeContract({
    address: sepoliaConfig.assets.USDC.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'approve',
    args: [sepoliaConfig.ltvVault.vault as `0x${string}`, usdcAmount],
    account,
    chain: sepolia,
    gas: gas.gasLimit,
  });
}

export async function depositToVault(
  writeContract: WriteContractFn,
  account: `0x${string}`,
  usdcAmount: bigint,
): Promise<`0x${string}`> {
  const gas = await estimateGasWithFallback(
    {
      address: sepoliaConfig.ltvVault.vault as `0x${string}`,
      abi: eip4626VaultAbi,
      functionName: 'deposit',
      args: [usdcAmount, account],
      account,
    },
    'deposit',
  );

  return writeContract({
    address: sepoliaConfig.ltvVault.vault as `0x${string}`,
    abi: eip4626VaultAbi,
    functionName: 'deposit',
    args: [usdcAmount, account],
    account,
    chain: sepolia,
    gas: gas.gasLimit,
  });
}

export async function withdrawFromVault(
  writeContract: WriteContractFn,
  account: `0x${string}`,
  usdcAmount: bigint,
): Promise<`0x${string}`> {
  const gas = await estimateGasWithFallback(
    {
      address: sepoliaConfig.ltvVault.vault as `0x${string}`,
      abi: eip4626VaultAbi,
      functionName: 'withdraw',
      args: [usdcAmount, account, account],
      account,
    },
    'withdraw',
  );

  return writeContract({
    address: sepoliaConfig.ltvVault.vault as `0x${string}`,
    abi: eip4626VaultAbi,
    functionName: 'withdraw',
    args: [usdcAmount, account, account],
    account,
    chain: sepolia,
    gas: gas.gasLimit,
  });
}

export async function redeemFromVault(
  writeContract: WriteContractFn,
  account: `0x${string}`,
  shares: bigint,
): Promise<`0x${string}`> {
  const gas = await estimateGasWithFallback(
    {
      address: sepoliaConfig.ltvVault.vault as `0x${string}`,
      abi: eip4626VaultAbi,
      functionName: 'redeem',
      args: [shares, account, account],
      account,
    },
    'redeem',
  );

  return writeContract({
    address: sepoliaConfig.ltvVault.vault as `0x${string}`,
    abi: eip4626VaultAbi,
    functionName: 'redeem',
    args: [shares, account, account],
    account,
    chain: sepolia,
    gas: gas.gasLimit,
  });
}

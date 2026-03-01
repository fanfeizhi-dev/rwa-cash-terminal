import { readContract } from '@wagmi/core';
import { config } from '../config/wagmi';
import sepoliaConfig from '../config/sepolia.json';
import { eip4626VaultReadAbi, erc20ReadAbi, balancerVaultReadAbi } from '../config/abis';
import { sepolia } from 'wagmi/chains';

export interface ValidationResult {
  isValid: boolean;
  checks: ValidationCheck[];
  validatedAt: string;
}

export interface ValidationCheck {
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  details?: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const getPoolAbi = [
  {
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    name: 'getPool',
    outputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export async function validateConfig(): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];

  // 1. Address format validation
  const addressEntries: [string, string][] = [
    ['Balancer Vault', sepoliaConfig.balancer.vault],
    ['BPT Token', sepoliaConfig.balancer.bptToken],
    ['LTV Vault', sepoliaConfig.ltvVault.vault],
    ['USDC', sepoliaConfig.assets.USDC.address],
    ...sepoliaConfig.balancer.tokens.map((t, i) => [`Pool Token ${i}`, t] as [string, string]),
  ];

  let allAddressesValid = true;
  const invalidAddresses: string[] = [];
  for (const [label, addr] of addressEntries) {
    if (!ADDRESS_RE.test(addr)) {
      allAddressesValid = false;
      invalidAddresses.push(label);
    }
  }
  checks.push({
    name: 'Address Format',
    description: 'All configured addresses are valid hex format (0x + 40 chars)',
    status: allAddressesValid ? 'passed' : 'failed',
    details: allAddressesValid
      ? `${addressEntries.length} addresses validated`
      : `Invalid: ${invalidAddresses.join(', ')}`,
  });

  // 2. Balancer Pool ID → pool address matches bptToken
  try {
    const result = await readContract(config, {
      address: sepoliaConfig.balancer.vault as `0x${string}`,
      abi: getPoolAbi,
      functionName: 'getPool',
      args: [sepoliaConfig.balancer.poolId as `0x${string}`],
      chainId: sepolia.id,
    } as any) as [string, number];

    const poolAddress = result[0];
    const matches = poolAddress.toLowerCase() === sepoliaConfig.balancer.bptToken.toLowerCase();
    checks.push({
      name: 'Pool ID ↔ BPT',
      description: 'Balancer pool ID resolves to configured BPT token address',
      status: matches ? 'passed' : 'failed',
      details: matches
        ? `Pool: ${poolAddress.slice(0, 10)}...`
        : `Expected ${sepoliaConfig.balancer.bptToken}, got ${poolAddress}`,
    });
  } catch (e) {
    checks.push({
      name: 'Pool ID ↔ BPT',
      description: 'Balancer pool ID resolves to configured BPT token address',
      status: 'warning',
      details: 'RPC call failed — unable to verify',
    });
  }

  // 3. Pool tokens match config
  try {
    const result = await readContract(config, {
      address: sepoliaConfig.balancer.vault as `0x${string}`,
      abi: balancerVaultReadAbi,
      functionName: 'getPoolTokens',
      args: [sepoliaConfig.balancer.poolId as `0x${string}`],
      chainId: sepolia.id,
    } as any) as [readonly string[], readonly bigint[], bigint];

    const onChainTokens = [...result[0]].map(t => t.toLowerCase()).sort();
    const configTokens = [...sepoliaConfig.balancer.tokens].map(t => t.toLowerCase()).sort();
    const matches =
      onChainTokens.length === configTokens.length &&
      onChainTokens.every((t, i) => t === configTokens[i]);

    checks.push({
      name: 'Pool Tokens',
      description: 'On-chain pool tokens match configured token list',
      status: matches ? 'passed' : 'failed',
      details: matches
        ? `${onChainTokens.length} tokens verified`
        : `Config: [${configTokens.map(t => t.slice(0, 8)).join(', ')}], On-chain: [${onChainTokens.map(t => t.slice(0, 8)).join(', ')}]`,
    });
  } catch {
    checks.push({
      name: 'Pool Tokens',
      description: 'On-chain pool tokens match configured token list',
      status: 'warning',
      details: 'RPC call failed — unable to verify',
    });
  }

  // 4. LTV Vault EIP-4626 compliance
  try {
    const vaultAddr = sepoliaConfig.ltvVault.vault as `0x${string}`;
    const [underlyingAsset, decimals] = await Promise.all([
      readContract(config, {
        abi: eip4626VaultReadAbi,
        functionName: 'asset',
        args: [],
        chainId: sepolia.id,
        address: vaultAddr,
      } as any) as Promise<string>,
      readContract(config, {
        abi: eip4626VaultReadAbi,
        functionName: 'decimals',
        args: [],
        chainId: sepolia.id,
        address: vaultAddr,
      } as any) as Promise<number>,
    ]);

    const assetMatches = underlyingAsset.toLowerCase() === sepoliaConfig.ltvVault.asset.toLowerCase();
    const decimalsValid = Number(decimals) > 0 && Number(decimals) <= 18;

    checks.push({
      name: 'Vault EIP-4626',
      description: 'LTV Vault returns expected underlying asset and valid decimals',
      status: assetMatches && decimalsValid ? 'passed' : 'failed',
      details: assetMatches && decimalsValid
        ? `Asset: ${(underlyingAsset as string).slice(0, 10)}..., Decimals: ${decimals}`
        : !assetMatches
          ? `Asset mismatch: expected ${sepoliaConfig.ltvVault.asset}, got ${underlyingAsset}`
          : `Invalid decimals: ${decimals}`,
    });
  } catch {
    checks.push({
      name: 'Vault EIP-4626',
      description: 'LTV Vault returns expected underlying asset and valid decimals',
      status: 'warning',
      details: 'RPC call failed — unable to verify',
    });
  }

  // 5. USDC contract is alive
  try {
    const decimals = await readContract(config, {
      abi: erc20ReadAbi,
      functionName: 'decimals',
      args: [],
      chainId: sepolia.id,
      address: sepoliaConfig.assets.USDC.address as `0x${string}`,
    } as any) as number;

    const matches = Number(decimals) === sepoliaConfig.assets.USDC.decimals;
    checks.push({
      name: 'USDC Contract',
      description: 'USDC contract responds with correct decimals',
      status: matches ? 'passed' : 'failed',
      details: matches
        ? `Decimals: ${decimals}`
        : `Expected ${sepoliaConfig.assets.USDC.decimals}, got ${decimals}`,
    });
  } catch {
    checks.push({
      name: 'USDC Contract',
      description: 'USDC contract responds with correct decimals',
      status: 'warning',
      details: 'RPC call failed — unable to verify',
    });
  }

  return {
    isValid: checks.every(c => c.status !== 'failed'),
    checks,
    validatedAt: new Date().toISOString(),
  };
}

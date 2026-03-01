import { readContract } from '@wagmi/core';
import { config } from '../config/wagmi';
import sepoliaConfig from '../config/sepolia.json';
import { whitelistRegistryAbi } from '../config/abis';
import { sepolia } from 'wagmi/chains';

export interface EligibilityResult {
  isEligible: boolean;
  source: 'on_chain_registry' | 'local_whitelist' | 'permissive_mode' | 'user_input';
  checkedAt: string;
  registryAddress?: string;
  details: string;
}

const whitelistConfig = (sepoliaConfig as any).whitelist as {
  registry: string | null;
  mode: string;
  fallbackList: string[];
} | undefined;

let cachedResult: EligibilityResult | null = null;
let cachedAddress: string | null = null;

export async function checkEligibility(
  address: `0x${string}`,
): Promise<EligibilityResult> {
  if (cachedResult && cachedAddress === address.toLowerCase()) {
    return cachedResult;
  }

  const checkedAt = new Date().toISOString();

  // 1. On-chain registry check
  if (whitelistConfig?.registry) {
    try {
      const isWhitelisted = await readContract(config, {
        abi: whitelistRegistryAbi,
        functionName: 'isWhitelisted',
        args: [address],
        chainId: sepolia.id,
        address: whitelistConfig.registry as `0x${string}`,
      } as any) as boolean;

      const result: EligibilityResult = {
        isEligible: isWhitelisted,
        source: 'on_chain_registry',
        checkedAt,
        registryAddress: whitelistConfig.registry,
        details: isWhitelisted
          ? `Address verified as whitelisted via on-chain registry at ${whitelistConfig.registry}`
          : `Address not found in on-chain registry at ${whitelistConfig.registry}`,
      };
      cachedResult = result;
      cachedAddress = address.toLowerCase();
      return result;
    } catch (e) {
      console.warn('On-chain whitelist registry query failed, falling back:', e);
    }
  }

  // 2. Check mode
  const mode = whitelistConfig?.mode ?? 'permissive';

  if (mode === 'permissive') {
    const result: EligibilityResult = {
      isEligible: true,
      source: 'permissive_mode',
      checkedAt,
      details: 'Permissive mode active — no on-chain registry deployed. All addresses eligible by default.',
    };
    cachedResult = result;
    cachedAddress = address.toLowerCase();
    return result;
  }

  // 3. Restrictive mode — check fallback list
  const fallbackList = (whitelistConfig?.fallbackList ?? []).map(a => a.toLowerCase());
  const isInList = fallbackList.includes(address.toLowerCase());

  const result: EligibilityResult = {
    isEligible: isInList,
    source: 'local_whitelist',
    checkedAt,
    details: isInList
      ? 'Address found in local whitelist configuration.'
      : 'Address not found in local whitelist. Restrictive mode active.',
  };
  cachedResult = result;
  cachedAddress = address.toLowerCase();
  return result;
}

export function clearEligibilityCache(): void {
  cachedResult = null;
  cachedAddress = null;
}

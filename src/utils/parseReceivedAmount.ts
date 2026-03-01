import { getTransactionReceipt } from '@wagmi/core';
import { config } from '../config/wagmi';
import { sepolia } from 'wagmi/chains';
import { decodeEventLog, formatUnits } from 'viem';
import sepoliaConfig from '../config/sepolia.json';

const TRANSFER_EVENT_ABI = [
  {
    type: 'event' as const,
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;

/**
 * Parse the received token amount from a transaction receipt by looking for
 * Transfer events where the target token was sent to the user.
 */
export async function parseReceivedAmount(
  txHash: string,
  userAddress: string,
  bucket: 'A' | 'B',
): Promise<string | null> {
  try {
    const receipt = await getTransactionReceipt(config, {
      hash: txHash as `0x${string}`,
      chainId: sepolia.id,
    });

    const targetToken = bucket === 'A'
      ? sepoliaConfig.balancer.bptToken.toLowerCase()
      : sepoliaConfig.ltvVault.vault.toLowerCase();

    // Vault shares are typically 18 decimals for EIP-4626
    const decimals = bucket === 'A' ? 18 : 6;
    const userAddr = userAddress.toLowerCase();

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== targetToken) continue;

      try {
        const decoded = decodeEventLog({
          abi: TRANSFER_EVENT_ABI,
          data: log.data,
          topics: log.topics,
        }) as { eventName: string; args: { from: string; to: string; value: bigint } };

        if (
          decoded.eventName === 'Transfer' &&
          decoded.args.to.toLowerCase() === userAddr
        ) {
          return formatUnits(decoded.args.value, decimals);
        }
      } catch {
        // Not a Transfer event from this log, skip
      }
    }

    return null;
  } catch (e) {
    console.warn(`Failed to parse received amount for bucket ${bucket}:`, e);
    return null;
  }
}

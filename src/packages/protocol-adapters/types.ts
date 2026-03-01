export type WriteContractFn = (args: {
  address: `0x${string}`;
  abi: readonly Record<string, unknown>[];
  functionName: string;
  args: unknown[];
  account: `0x${string}`;
  chain: unknown;
  gas?: bigint;
}) => Promise<`0x${string}`>;

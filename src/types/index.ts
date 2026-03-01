export interface ProtocolBucket {
  id: 'A' | 'B';
  name: string;
  protocol: 'Balancer' | 'MorphoLTV' | 'StableYieldVault';
  asset: {
    symbol: 'USDC';
    address: string;
  };
  apr: number;
  contractAddress: string;
  poolId?: string;
}

export interface AllocationInput {
  amount: number;
  riskProfile: 'conservative' | 'balanced' | 'yield_seeking';
  exitWindow: 'T0' | 'T3' | 'T7';
  eligibility: 'eligible' | 'not_eligible';
  eligibilitySource?: 'on_chain_registry' | 'local_whitelist' | 'permissive_mode' | 'user_input';
  marketRegime: 'normal' | 'stress';
}

export interface AllocationPlan {
  inputs: AllocationInput;
  bucketA: {
    allocationPct: number;
    amount: number;
  };
  bucketB: {
    allocationPct: number;
    amount: number;
  };
  expectedAprRange: [number, number];
  aprSources?: {
    bucketA: { value: number; isEstimated: boolean };
    bucketB: { value: number; isEstimated: boolean };
    fetchedAt?: string;
  };
  generatedAt?: string;
  passport: {
    score: number;
    grade: 'A' | 'B' | 'C';
    hash?: string;
    explanations?: string[];
    riskDimensionsSource?: 'demo_defaults' | 'configured' | 'on_chain_heuristics' | 'defi_safety_api' | string;
    riskDataSources?: string[];
    radarData: {
      contract: number;
      liquidity: number;
      oracle: number;
      market: number;
      operational: number;
    };
  };
}

export type TxStatus = 'success' | 'failed' | 'pending';

export interface BucketExecution {
  approveTx: string;
  approveTxStatus?: TxStatus;
  actionTx: string;
  actionTxStatus?: TxStatus;
  receivedToken: string;
  receivedAmount?: string;
}

export interface Receipt {
  receiptId: string;
  wallet: string;
  timestamp: string;
  plan: AllocationPlan;
  overallStatus?: 'success' | 'partial_failure' | 'failed';
  executions: {
    bucketA: BucketExecution;
    bucketB: BucketExecution;
  };
}

export interface RiskProfileConfig {
  bucketA: number;
  bucketB: number;
  rangeWidth: number;
}

export interface AllocationEngineConfig {
  riskProfiles: {
    conservative: RiskProfileConfig;
    balanced: RiskProfileConfig;
    yield_seeking: RiskProfileConfig;
  };
  exitWindowDeltas: {
    T0: number;
    T3: number;
    T7: number;
  };
  stressModeCap: number;
  maxBucketA: number;
  minBucketA: number;
  scoreWeights: {
    contract: number;
    liquidity: number;
    oracle: number;
    market: number;
    operational: number;
  };
  gradeThresholds: {
    A: number;
    B: number;
  };
  rebalanceDriftThreshold: number;
}

export const DEFAULT_ALLOCATION_CONFIG: AllocationEngineConfig = {
  riskProfiles: {
    conservative: { bucketA: 0.60, bucketB: 0.40, rangeWidth: 0.005 },
    balanced:     { bucketA: 0.45, bucketB: 0.55, rangeWidth: 0.008 },
    yield_seeking: { bucketA: 0.30, bucketB: 0.70, rangeWidth: 0.012 },
  },
  exitWindowDeltas: { T0: -0.20, T3: -0.10, T7: 0.05 },
  stressModeCap: 0.20,
  maxBucketA: 0.70,
  minBucketA: 0.00,
  scoreWeights: {
    contract: 0.25,
    liquidity: 0.25,
    oracle: 0.20,
    market: 0.10,
    operational: 0.20,
  },
  gradeThresholds: { A: 80, B: 65 },
  rebalanceDriftThreshold: 0.08,
};

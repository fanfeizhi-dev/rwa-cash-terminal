export interface RiskVector {
  contract: number;
  liquidity: number;
  oracle: number;
  market: number;
  operational: number;
}

export interface RiskConfig {
  bucketA: RiskVector;
  bucketB: RiskVector;
  isDemo: boolean;
  source: string;
  sourceDetails?: string[];
  fetchedAt?: string;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  bucketA: {
    contract: 45,
    liquidity: 55,
    oracle: 40,
    market: 20,
    operational: 25,
  },
  bucketB: {
    contract: 35,
    liquidity: 15,
    oracle: 25,
    market: 10,
    operational: 20,
  },
  isDemo: true,
  source: 'Static defaults — not sourced from protocol or on-chain risk feeds',
};

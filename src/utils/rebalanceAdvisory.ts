import { OnChainPositions } from './onChainPositions';
import { AllocationPlan } from '../types';
import { DEFAULT_ALLOCATION_CONFIG } from '../config/allocationConfig';

export interface RebalanceAdvisory {
  shouldRebalance: boolean;
  reasons: string[];
  currentSplit: { bucketA: number; bucketB: number };
  targetSplit: { bucketA: number; bucketB: number };
  driftPct: number;
}

export function computeRebalanceAdvisory(
  positions: OnChainPositions | null,
  plan: AllocationPlan | null,
  driftThreshold?: number,
): RebalanceAdvisory | null {
  if (!positions || !positions.isLoaded || positions.totalValueUsd === 0 || !plan) {
    return null;
  }

  const threshold = driftThreshold ?? DEFAULT_ALLOCATION_CONFIG.rebalanceDriftThreshold;

  const currentA = positions.bucketASplit;
  const currentB = positions.bucketBSplit;
  const targetA = plan.bucketA.allocationPct;
  const targetB = plan.bucketB.allocationPct;

  const driftA = Math.abs(currentA - targetA);
  const driftB = Math.abs(currentB - targetB);
  const maxDrift = Math.max(driftA, driftB);

  const reasons: string[] = [];

  if (maxDrift > threshold) {
    reasons.push(
      `Portfolio drift detected: Bucket A is ${(currentA * 100).toFixed(1)}% (target ${(targetA * 100).toFixed(0)}%), Bucket B is ${(currentB * 100).toFixed(1)}% (target ${(targetB * 100).toFixed(0)}%). Drift exceeds ${(threshold * 100).toFixed(0)}% threshold.`
    );
  }

  return {
    shouldRebalance: reasons.length > 0,
    reasons,
    currentSplit: { bucketA: currentA, bucketB: currentB },
    targetSplit: { bucketA: targetA, bucketB: targetB },
    driftPct: maxDrift * 100,
  };
}

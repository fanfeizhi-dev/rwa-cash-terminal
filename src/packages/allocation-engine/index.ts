import { AllocationInput, AllocationPlan } from '../../types';
import { RiskConfig, DEFAULT_RISK_CONFIG } from '../../config/riskDefaults';
import { AllocationEngineConfig, DEFAULT_ALLOCATION_CONFIG } from '../../config/allocationConfig';

export const calculateAllocation = (
  inputs: AllocationInput,
  bucketA_apr: number,
  bucketB_apr: number,
  riskConfig?: RiskConfig,
  engineConfig?: AllocationEngineConfig,
): AllocationPlan => {
  const cfg = engineConfig ?? DEFAULT_ALLOCATION_CONFIG;

  const profile = cfg.riskProfiles[inputs.riskProfile];
  let allocA_base = profile.bucketA;
  let allocB_base = profile.bucketB;
  const rangeWidth = profile.rangeWidth;

  const delta = cfg.exitWindowDeltas[inputs.exitWindow];

  let allocA_1 = allocA_base + delta;
  let allocB_1 = 1 - allocA_1;

  const explanations: string[] = [];

  explanations.push(
    `Base allocation set to ${(allocA_base * 100).toFixed(0)}%/${(allocB_base * 100).toFixed(0)}% for ${inputs.riskProfile.replace('_', '-')} risk profile.`
  );
  explanations.push(
    `Exit window ${inputs.exitWindow} applied delta of ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}% to Bucket A.`
  );

  if (inputs.eligibility === 'not_eligible') {
    allocA_1 = 0;
    allocB_1 = 1;
    explanations.push('RWA proxy leg (Bucket A) disabled due to eligibility status. 100% routed to Bucket B.');
  }
  if (inputs.eligibilitySource && inputs.eligibilitySource !== 'user_input') {
    explanations.push(`Eligibility verified via ${inputs.eligibilitySource.replace(/_/g, ' ')}.`);
  }

  if (inputs.marketRegime === 'stress') {
    const preCap = allocA_1;
    allocA_1 = Math.min(allocA_1, cfg.stressModeCap);
    allocB_1 = 1 - allocA_1;
    if (preCap !== allocA_1) {
      explanations.push(`Stress mode active: Bucket A capped at ${(cfg.stressModeCap * 100).toFixed(0)}% to mitigate LP exit risk.`);
    } else {
      explanations.push(`Stress mode active: allocation already within ${(cfg.stressModeCap * 100).toFixed(0)}% cap.`);
    }
  }

  const preClamp = allocA_1;
  allocA_1 = Math.max(cfg.minBucketA, Math.min(allocA_1, cfg.maxBucketA));
  allocB_1 = 1 - allocA_1;

  if (preClamp !== allocA_1) {
    explanations.push(`Bucket A allocation clamped to ${preClamp < cfg.minBucketA ? `minimum bound of ${(cfg.minBucketA * 100).toFixed(0)}%` : `maximum bound of ${(cfg.maxBucketA * 100).toFixed(0)}%`}.`);
  }

  explanations.push(
    `Final allocation: Bucket A ${(allocA_1 * 100).toFixed(0)}% / Bucket B ${(allocB_1 * 100).toFixed(0)}%.`
  );

  const mid = allocA_1 * bucketA_apr + allocB_1 * bucketB_apr;
  const expectedAprRange: [number, number] = [Math.max(0, mid - rangeWidth), mid + rangeWidth];

  const rc = riskConfig ?? DEFAULT_RISK_CONFIG;
  const bucketA_risk = {
    ...rc.bucketA,
    liquidity: rc.bucketA.liquidity + (inputs.exitWindow === 'T0' ? 20 : inputs.exitWindow === 'T3' ? 10 : -5),
  };
  const bucketB_risk = { ...rc.bucketB };

  const radarData = {
    contract: Math.round(allocA_1 * bucketA_risk.contract + allocB_1 * bucketB_risk.contract),
    liquidity: Math.round(allocA_1 * bucketA_risk.liquidity + allocB_1 * bucketB_risk.liquidity),
    oracle: Math.round(allocA_1 * bucketA_risk.oracle + allocB_1 * bucketB_risk.oracle),
    market: Math.round(allocA_1 * bucketA_risk.market + allocB_1 * bucketB_risk.market),
    operational: Math.round(allocA_1 * bucketA_risk.operational + allocB_1 * bucketB_risk.operational),
  };

  const w = cfg.scoreWeights;
  const score = Math.round(
    radarData.contract * w.contract +
    radarData.liquidity * w.liquidity +
    radarData.oracle * w.oracle +
    radarData.market * w.market +
    radarData.operational * w.operational
  );

  const finalScore = 100 - score;

  let grade: 'A' | 'B' | 'C' = 'C';
  if (finalScore >= cfg.gradeThresholds.A) grade = 'A';
  else if (finalScore >= cfg.gradeThresholds.B) grade = 'B';

  return {
    inputs,
    bucketA: {
      allocationPct: allocA_1,
      amount: inputs.amount * allocA_1,
    },
    bucketB: {
      allocationPct: allocB_1,
      amount: inputs.amount * allocB_1,
    },
    expectedAprRange,
    passport: {
      score: finalScore,
      grade,
      explanations,
      radarData,
      riskDimensionsSource: rc.isDemo ? 'demo_defaults' : (rc.source || 'configured'),
    },
  };
};

import type { AllocationPlan } from '../types';

function sortKeysDeep(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortKeysDeep((obj as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

export async function computePassportHash(plan: AllocationPlan): Promise<string> {
  const canonical = {
    allocation: {
      bucketA_pct: plan.bucketA.allocationPct,
      bucketB_pct: plan.bucketB.allocationPct,
      expectedAprRange: plan.expectedAprRange,
    },
    inputs: {
      amount: plan.inputs.amount,
      eligibility: plan.inputs.eligibility,
      exitWindow: plan.inputs.exitWindow,
      marketRegime: plan.inputs.marketRegime,
      riskProfile: plan.inputs.riskProfile,
    },
    passport: {
      grade: plan.passport.grade,
      radarData: {
        contract: plan.passport.radarData.contract,
        liquidity: plan.passport.radarData.liquidity,
        market: plan.passport.radarData.market,
        operational: plan.passport.radarData.operational,
        oracle: plan.passport.radarData.oracle,
      },
      score: plan.passport.score,
    },
  };

  const json = JSON.stringify(sortKeysDeep(canonical));
  const encoded = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

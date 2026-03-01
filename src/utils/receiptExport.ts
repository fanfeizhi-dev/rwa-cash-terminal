import type { Receipt } from '../types';
import sepoliaConfig from '../config/sepolia.json';
import { FALLBACK_APR_A, FALLBACK_APR_B } from './protocolData';

export function formatReceiptForExport(receipt: Receipt) {
  const { plan, executions } = receipt;

  return {
    receiptId: receipt.receiptId,
    createdAt: receipt.timestamp,
    chain: 'sepolia',
    wallet: receipt.wallet,
    inputs: {
      amount: String(plan.inputs.amount),
      riskProfile: plan.inputs.riskProfile,
      exitWindow: plan.inputs.exitWindow,
      eligibility: plan.inputs.eligibility,
      marketRegime: plan.inputs.marketRegime,
    },
    snapshots: {
      bucketA: {
        protocol: 'Balancer',
        apr: plan.aprSources?.bucketA.value ?? FALLBACK_APR_A,
        isEstimated: plan.aprSources?.bucketA.isEstimated ?? true,
      },
      bucketB: {
        protocol: 'StableYieldVault',
        apr: plan.aprSources?.bucketB.value ?? FALLBACK_APR_B,
        isEstimated: plan.aprSources?.bucketB.isEstimated ?? true,
      },
      fetchedAt: plan.aprSources?.fetchedAt ?? null,
    },
    allocation: {
      bucketA_pct: plan.bucketA.allocationPct,
      bucketB_pct: plan.bucketB.allocationPct,
      expectedAprRange: plan.expectedAprRange,
    },
    executions: [
      {
        bucket: 'A',
        protocol: 'Balancer',
        vault: sepoliaConfig.balancer.vault,
        poolId: sepoliaConfig.balancer.poolId,
        asset: sepoliaConfig.assets.USDC.address,
        approveTx: executions.bucketA.approveTx,
        actionTx: executions.bucketA.actionTx,
        action: 'joinPool',
        amount: String(plan.bucketA.amount),
        received: { token: 'BPT', amount: executions.bucketA.receivedAmount ?? 'N/A' },
      },
      {
        bucket: 'B',
        protocol: 'StableYieldVault',
        vault: sepoliaConfig.ltvVault.vault,
        asset: sepoliaConfig.assets.USDC.address,
        approveTx: executions.bucketB.approveTx,
        actionTx: executions.bucketB.actionTx,
        action: 'deposit',
        amount: String(plan.bucketB.amount),
        received: { token: 'Vault Shares (rwaUSD)', amount: executions.bucketB.receivedAmount ?? 'N/A' },
      },
    ],
    passport: {
      score: plan.passport.score,
      grade: plan.passport.grade,
      hash: plan.passport.hash || '',
      explanations: plan.passport.explanations || [],
      riskDimensionsSource: plan.passport.riskDimensionsSource || 'demo_defaults',
      riskDataSources: plan.passport.riskDataSources || [],
      radar: {
        contract: plan.passport.radarData.contract,
        liquidityExit: plan.passport.radarData.liquidity,
        oraclePricing: plan.passport.radarData.oracle,
        market: plan.passport.radarData.market,
        operational: plan.passport.radarData.operational,
      },
    },
  };
}

export function downloadReceiptJson(receipt: Receipt) {
  const data = formatReceiptForExport(receipt);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${receipt.receiptId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

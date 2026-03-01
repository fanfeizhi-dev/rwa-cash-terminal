import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { useAccount } from 'wagmi';
import { cn } from '../components/Layout';
import { downloadReceiptJson } from '../utils/receiptExport';
import type { Receipt, BucketExecution } from '../types';

function ReceiptStatusBadge({ receipt }: { receipt: Receipt }) {
  const status = receipt.overallStatus;

  if (status === 'partial_failure') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
        PARTIAL FAILURE
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-700 border border-red-100">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
        FAILED
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-100">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
      EXECUTED
    </span>
  );
}

function TxStatusBadge({ status }: { status?: string }) {
  if (!status) return null;

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
        <span className="material-symbols-outlined text-[10px]">check_circle</span>
        SUCCESS
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
        <span className="material-symbols-outlined text-[10px]">error</span>
        FAILED
      </span>
    );
  }

  return null;
}

function TxRow({ label, txHash, status, linkColor }: {
  label: string;
  txHash: string;
  status?: string;
  linkColor?: string;
}) {
  const isFailed = status === 'failed';
  const colorClass = isFailed ? 'text-red-600 hover:text-red-800' : (linkColor || 'text-blue-600 hover:text-blue-800');

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
        <TxStatusBadge status={status} />
      </div>
      {txHash ? (
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("text-xs font-mono flex items-center gap-1 break-all", colorClass)}
        >
          {txHash}
          <span className="material-symbols-outlined text-[14px] shrink-0">open_in_new</span>
        </a>
      ) : (
        <span className="text-xs font-mono text-slate-400">Not executed</span>
      )}
    </div>
  );
}

function ErrorGuidance({ bucket, txHash }: { bucket: 'A' | 'B'; txHash: string }) {
  if (!txHash) return null;

  const guidance = bucket === 'A'
    ? 'Invalid Pool ID or token mismatch. Verify that the configured poolId exists on the current network.'
    : 'Deposit to Stable Yield Vault failed. Ensure USDC allowance was confirmed before deposit, and that the vault is not paused or out of liquidity.';

  return (
    <div className="mt-2 p-2 bg-red-50 rounded border border-red-100 text-[11px] text-red-700">
      <span className="font-bold">Possible cause: </span>
      {guidance}
      <a
        href={`https://sepolia.etherscan.io/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-1 text-red-600 underline hover:text-red-800"
      >
        View on Etherscan →
      </a>
    </div>
  );
}

function ReceivedAmountDisplay({ execution }: { execution: BucketExecution }) {
  if (execution.actionTxStatus === 'failed') {
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm text-red-600 font-mono font-semibold">—</span>
        <span className="text-[10px] text-red-500">Transaction reverted</span>
      </div>
    );
  }

  if (execution.receivedAmount) {
    return <span className="text-sm font-bold text-slate-900 font-mono">{execution.receivedAmount}</span>;
  }

  return <span className="text-sm text-slate-400 font-mono">N/A</span>;
}

export default function ReceiptDetail() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const { receipts } = useAppStore();
  const { address, isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <span className="material-symbols-outlined text-slate-300 text-3xl">account_balance_wallet</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Wallet Not Connected</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            Connect your wallet to view receipt details. Each wallet address has its own receipt history.
          </p>
        </div>
      </div>
    );
  }

  const receipt = receipts.find((r) => r.receiptId === receiptId);

  if (!receipt) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <span className="material-symbols-outlined text-slate-300 text-3xl">search_off</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Receipt Not Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            No receipt with ID <span className="font-mono font-semibold text-slate-700">{receiptId}</span> was found.
          </p>
          <Link to="/terminal/receipts" className="px-6 py-2 bg-black text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors shadow-md">
            Back to Gallery
          </Link>
        </div>
      </div>
    );
  }

  if (receipt.wallet.toLowerCase() !== address!.toLowerCase()) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <span className="material-symbols-outlined text-slate-300 text-3xl">lock</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Access Denied</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            This receipt belongs to a different wallet address. Connect the correct wallet to view.
          </p>
          <Link to="/terminal/receipts" className="px-6 py-2 bg-black text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors shadow-md">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  const { plan, executions } = receipt;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
        <Link to="/" className="hover:text-slate-700 transition-colors">Home</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link to="/terminal/receipts" className="hover:text-slate-700 transition-colors">Receipts</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-black font-bold font-mono">{receipt.receiptId}</span>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold font-mono text-slate-900">{receipt.receiptId}</h1>
            <p className="text-sm text-slate-500 mt-1">{new Date(receipt.timestamp).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <ReceiptStatusBadge receipt={receipt} />
            <button onClick={() => downloadReceiptJson(receipt)} className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold uppercase tracking-wider border border-slate-200 transition-colors flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">download</span>
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Wallet & Chain Info */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Wallet & Chain</h2>
        <div>
          <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Wallet</h3>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-sm font-mono text-slate-900 break-all">{receipt.wallet}</span>
            <a href={`https://sepolia.etherscan.io/address/${receipt.wallet}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-2 shrink-0">
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          </div>
        </div>
        <div>
          <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Chain</h3>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Ethereum Sepolia
          </div>
        </div>
      </div>

      {/* Allocation Summary */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Allocation Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Capital</span>
            <span className="text-sm font-bold text-slate-900 font-mono">${plan.inputs.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Risk Profile</span>
            <span className="text-sm font-bold text-slate-900">{plan.inputs.riskProfile.replace('_', '-').toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Exit Window</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{plan.inputs.exitWindow.replace('T', 'T+')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Market Regime</span>
            <span className="text-sm font-bold text-slate-900">{plan.inputs.marketRegime.toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Eligibility</span>
            <span className="text-sm font-bold text-slate-900">{plan.inputs.eligibility.replace('_', ' ').toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Expected APR Range</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{(plan.expectedAprRange[0] * 100).toFixed(1)}% - {(plan.expectedAprRange[1] * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Bucket A (Balancer)</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{(plan.bucketA.allocationPct * 100).toFixed(0)}% — ${plan.bucketA.amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Bucket B (Stable Yield)</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{(plan.bucketB.allocationPct * 100).toFixed(0)}% — ${plan.bucketB.amount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Execution Audit */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-6 space-y-6">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Execution Audit</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Bucket A */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Bucket A (Balancer)</h3>
            <TxRow
              label="Approve USDC"
              txHash={executions.bucketA.approveTx}
              status={executions.bucketA.approveTxStatus}
            />
            <TxRow
              label="Join Pool"
              txHash={executions.bucketA.actionTx}
              status={executions.bucketA.actionTxStatus}
            />
            {executions.bucketA.actionTxStatus === 'failed' && (
              <ErrorGuidance bucket="A" txHash={executions.bucketA.actionTx} />
            )}
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Received Token</span>
              <span className="text-sm font-bold text-slate-900 font-mono">{executions.bucketA.receivedToken}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Received Amount</span>
              <ReceivedAmountDisplay execution={executions.bucketA} />
            </div>
          </div>
          {/* Bucket B */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Bucket B (Stable Yield)</h3>
            <TxRow
              label="Approve USDC"
              txHash={executions.bucketB.approveTx}
              status={executions.bucketB.approveTxStatus}
            />
            <TxRow
              label="Deposit"
              txHash={executions.bucketB.actionTx}
              status={executions.bucketB.actionTxStatus}
            />
            {executions.bucketB.actionTxStatus === 'failed' && (
              <ErrorGuidance bucket="B" txHash={executions.bucketB.actionTx} />
            )}
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Received Token</span>
              <span className="text-sm font-bold text-slate-900 font-mono">{executions.bucketB.receivedToken}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Received Amount</span>
              <ReceivedAmountDisplay execution={executions.bucketB} />
            </div>
          </div>
        </div>
      </div>

      {/* Risk Passport Summary */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Risk Passport</h2>
          <Link
            to={`/terminal/passport/${receipt.receiptId}`}
            className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            View Full Passport <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Score</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{plan.passport.score}/100</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Grade</span>
            <span className="text-sm font-bold text-slate-900">{plan.passport.grade}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Passport Hash</span>
            <span className="text-sm font-bold text-slate-900 font-mono break-all max-w-[60%] text-right">{plan.passport.hash || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Contract</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{plan.passport.radarData.contract}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Liquidity / Exit</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{plan.passport.radarData.liquidity}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Oracle / Pricing</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{plan.passport.radarData.oracle}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Market</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{plan.passport.radarData.market}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Operational</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{plan.passport.radarData.operational}</span>
          </div>
        </div>
        {plan.passport.explanations && plan.passport.explanations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Allocation Rationale</h3>
            <ul className="space-y-2">
              {plan.passport.explanations.map((exp, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[14px] text-slate-400 mt-0.5 shrink-0">chevron_right</span>
                  <span className="text-xs text-slate-600">{exp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
        <div className="flex gap-3 border-t border-slate-100 pt-4">
          <Link to="/terminal/receipts" className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold uppercase tracking-wider border border-slate-200 transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Gallery
          </Link>
          <button onClick={() => downloadReceiptJson(receipt)} className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold uppercase tracking-wider border border-slate-200 transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Download JSON
          </button>
        </div>
      </div>
    </div>
  );
}

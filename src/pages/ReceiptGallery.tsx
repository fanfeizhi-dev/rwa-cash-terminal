import React from 'react';
import { useAppStore } from '../store';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { downloadReceiptJson } from '../utils/receiptExport';
import { cn } from '../components/Layout';
import type { Receipt } from '../types';

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

export default function ReceiptGallery() {
  const { receipts } = useAppStore();
  const { address, isConnected } = useAccount();

  const filteredReceipts = isConnected && address
    ? receipts.filter((r) => r.wallet?.toLowerCase() === address.toLowerCase())
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Receipt Gallery</h1>
          <p className="text-sm text-slate-500">
            Auditable records of all executed allocations on Ethereum Sepolia.
          </p>
        </div>
      </div>
      {!isConnected ? (
        <div className="bg-white rounded shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <span className="material-symbols-outlined text-slate-300 text-3xl">account_balance_wallet</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Wallet Not Connected</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            Connect your wallet to view your execution receipts. Each wallet address has its own receipt history.
          </p>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="bg-white rounded shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <span className="material-symbols-outlined text-slate-300 text-3xl">receipt_long</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Receipts Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            No receipts found for wallet{' '}
            <span className="font-mono font-semibold text-slate-700">{address?.slice(0, 6)}...{address?.slice(-4)}</span>.
            {' '}Build a plan to get started.
          </p>
          <Link to="/terminal/build" className="px-6 py-2 bg-black text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors shadow-md">
            Build Plan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredReceipts.map((receipt) => (
            <div key={receipt.receiptId} className="bg-white rounded shadow-sm border border-slate-200 p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-mono mb-1">{receipt.receiptId}</h3>
                  <p className="text-xs text-slate-500">{new Date(receipt.timestamp).toLocaleString()}</p>
                </div>
                <ReceiptStatusBadge receipt={receipt} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 flex-1">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Allocation Summary</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Capital</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">${receipt.plan.inputs.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Risk Grade</span>
                    <span className="text-sm font-bold text-slate-900">{receipt.plan.passport.grade} ({receipt.plan.passport.score}/100)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Bucket A (Balancer)</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">{(receipt.plan.bucketA.allocationPct * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Bucket B (Stable Yield)</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">{(receipt.plan.bucketB.allocationPct * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Execution Audit</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Bucket A (Balancer) - Join Pool</span>
                        <TxStatusBadge status={receipt.executions.bucketA.actionTxStatus} />
                      </div>
                      {receipt.executions.bucketA.actionTx && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${receipt.executions.bucketA.actionTx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "text-xs font-mono flex items-center gap-1 break-all",
                            receipt.executions.bucketA.actionTxStatus === 'failed'
                              ? "text-red-600 hover:text-red-800"
                              : "text-blue-600 hover:text-blue-800"
                          )}
                        >
                          {receipt.executions.bucketA.actionTx}
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      )}
                      {receipt.executions.bucketA.actionTxStatus === 'failed' ? (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-sm text-red-600 font-mono font-semibold">—</span>
                          <span className="text-[10px] text-red-500">Transaction reverted</span>
                        </div>
                      ) : receipt.executions.bucketA.receivedAmount ? (
                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                          Received: {receipt.executions.bucketA.receivedAmount} BPT
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Bucket B (Stable Yield) - Deposit</span>
                        <TxStatusBadge status={receipt.executions.bucketB.actionTxStatus} />
                      </div>
                      {receipt.executions.bucketB.actionTx && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${receipt.executions.bucketB.actionTx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "text-xs font-mono flex items-center gap-1 break-all",
                            receipt.executions.bucketB.actionTxStatus === 'failed'
                              ? "text-red-600 hover:text-red-800"
                              : "text-blue-600 hover:text-blue-800"
                          )}
                        >
                          {receipt.executions.bucketB.actionTx}
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      )}
                      {receipt.executions.bucketB.actionTxStatus === 'failed' ? (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-sm text-red-600 font-mono font-semibold">—</span>
                          <span className="text-[10px] text-red-500">Transaction reverted</span>
                        </div>
                      ) : receipt.executions.bucketB.receivedAmount ? (
                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                          Received: {receipt.executions.bucketB.receivedAmount} Vault Shares
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
                <Link to={`/terminal/receipt/${receipt.receiptId}`} className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold uppercase tracking-wider border border-slate-200 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  View Details
                </Link>
                <button onClick={() => downloadReceiptJson(receipt)} className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold uppercase tracking-wider border border-slate-200 transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  JSON
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

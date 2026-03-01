import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '../store';
import { useAccount } from 'wagmi';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { exportPassportPdf } from '../utils/passportPdf';
import { getMetricStatus } from '../utils/riskStatus';

function RiskSourceBadge({ source }: { source?: string }) {
  if (!source || source === 'demo_defaults') {
    return (
      <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-amber-200">
        DEMO DEFAULTS
      </span>
    );
  }
  if (source === 'on_chain_heuristics') {
    return (
      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-100">
        ON-CHAIN HEURISTICS
      </span>
    );
  }
  if (source === 'defi_safety_api') {
    return (
      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">
        LIVE RISK FEED
      </span>
    );
  }
  return (
    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-100">
      {source.toUpperCase().replace(/_/g, ' ')}
    </span>
  );
}

function EligibilityBadge({ source }: { source?: string }) {
  if (source === 'on_chain_registry') {
    return (
      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">
        VERIFIED ON-CHAIN
      </span>
    );
  }
  if (source === 'permissive_mode') {
    return (
      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-100">
        PERMISSIVE MODE
      </span>
    );
  }
  if (source === 'local_whitelist') {
    return (
      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-100">
        LOCAL WHITELIST
      </span>
    );
  }
  return (
    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">
      SELF-DECLARED
    </span>
  );
}

export default function PassportSnapshot() {
  const { planId } = useParams<{ planId: string }>();
  const { receipts } = useAppStore();
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <span className="material-symbols-outlined text-slate-300 text-3xl">account_balance_wallet</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Wallet Not Connected</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            Connect your wallet to view passport snapshots. Each wallet has its own receipt history.
          </p>
        </div>
      </div>
    );
  }

  const receipt = receipts.find((r) => r.receiptId === planId);

  if (!receipt) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <span className="material-symbols-outlined text-slate-300 text-3xl">search_off</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Snapshot Not Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            No receipt with ID <span className="font-mono font-semibold text-slate-700">{planId}</span> was found.
          </p>
          <Link to="/terminal/receipts" className="px-6 py-2 bg-black text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors shadow-md">
            Back to Receipts
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
            This passport snapshot belongs to a different wallet address. Connect the correct wallet to view.
          </p>
          <Link to="/terminal/receipts" className="px-6 py-2 bg-black text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors shadow-md">
            Go Back
          </Link>
        </div>
      </div>
    );
  }

  const { plan } = receipt;

  const isEligible = plan.inputs.eligibility === 'eligible';
  const riskSource = plan.passport.riskDimensionsSource;
  const eligibilitySource = plan.inputs.eligibilitySource;
  const eligibilityIcon = eligibilitySource === 'on_chain_registry' ? 'text-emerald-600'
    : eligibilitySource === 'permissive_mode' ? 'text-blue-600'
    : isEligible ? 'text-blue-600' : 'text-red-600';

  const radarData = [
    { subject: 'Smart Contract', A: plan.passport.radarData.contract, fullMark: 100 },
    { subject: 'Liquidity', A: plan.passport.radarData.liquidity, fullMark: 100 },
    { subject: 'Market', A: plan.passport.radarData.market, fullMark: 100 },
    { subject: 'Pricing', A: plan.passport.radarData.oracle, fullMark: 100 },
    { subject: 'Operational', A: plan.passport.radarData.operational, fullMark: 100 },
  ];

  const handleCopyHash = async () => {
    if (!plan.passport.hash) return;
    await navigator.clipboard.writeText(plan.passport.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = () => {
    setExporting(true);
    exportPassportPdf(plan, plan.passport.hash || '').finally(() => setExporting(false));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
        <Link to="/" className="hover:text-slate-700 transition-colors">Home</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link to="/terminal/receipts" className="hover:text-slate-700 transition-colors">Receipts</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link to={`/terminal/receipt/${receipt.receiptId}`} className="hover:text-slate-700 transition-colors font-mono">{receipt.receiptId}</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-black font-bold">Passport</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Passport Snapshot</h1>
            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-amber-200">
              ARCHIVED
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Historical risk assessment from <span className="font-mono font-semibold text-slate-700">{receipt.receiptId}</span> — {new Date(receipt.timestamp).toLocaleString()}
          </p>
        </div>
        <button onClick={handleExportPdf} disabled={exporting} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50">
          <span className="material-symbols-outlined text-[16px]">print</span>
          {exporting ? 'Generating...' : 'Export PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded shadow-sm border border-slate-200 p-6 relative">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Composite Risk Score</h3>
              </div>
              <p className="text-xs text-slate-500 font-mono">SNAPSHOT: {new Date(receipt.timestamp).toISOString()}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              GRADE: {plan.passport.grade}
            </span>
          </div>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-5xl font-bold text-slate-900 tracking-tight">{plan.passport.score}</span>
                <span className="text-lg text-slate-500 font-normal">/ 100</span>
              </div>
              <div className="w-full bg-gray-100 rounded-sm h-2 mb-4 overflow-hidden">
                <div className="bg-emerald-500 h-2 rounded-sm shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${plan.passport.score}%` }}></div>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center border-l border-slate-200 pl-0 md:pl-8 mt-4 md:mt-0">
              <div className="relative w-64 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Portfolio" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex-1 bg-white rounded shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined ${eligibilityIcon} text-[18px]`}>
                  {isEligible ? 'verified' : 'block'}
                </span>
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wide">Compliance Tier</span>
              </div>
              <EligibilityBadge source={eligibilitySource} />
            </div>
            <p className={`text-xl font-bold mb-1 ${isEligible ? 'text-slate-900' : 'text-red-600'}`}>
              {isEligible ? 'Protocol-Eligible' : 'RWA Proxy Not Eligible'}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {isEligible
                ? 'Address whitelisted for Bucket A (Balancer) LP interaction'
                : 'RWA proxy leg disabled due to eligibility status'}
            </p>
          </div>
          <div className="flex-1 bg-white rounded shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-purple-600 text-[18px]">history</span>
              <span className="text-xs font-bold uppercase text-slate-500 tracking-wide">Last Audit ID</span>
            </div>
            {plan.passport.hash ? (
              <p className="text-sm font-bold text-slate-900 font-mono mb-1 break-all">{plan.passport.hash}</p>
            ) : (
              <span className="text-sm text-slate-400 font-mono">N/A</span>
            )}
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">Deterministic hash of allocation & risk vectors at execution time</p>
            {plan.passport.hash && (
              <button onClick={handleCopyHash} className="mt-1 text-[10px] text-slate-400 hover:text-slate-600 font-mono flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-[12px]">{copied ? 'done' : 'content_copy'}</span>
                {copied ? 'Copied' : 'Copy Hash'}
              </button>
            )}
          </div>
        </div>
      </div>

      {plan.passport.explanations && plan.passport.explanations.length > 0 && (
        <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-[18px]">psychology</span>
              <h2 className="text-sm font-bold text-slate-900">Allocation Rationale</h2>
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-100">
              RULE-DERIVED
            </span>
          </div>
          <div className="p-6">
            <ul className="space-y-3">
              {plan.passport.explanations.map((explanation, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-slate-500">{i + 1}</span>
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">{explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-900">Detailed Metrics</h2>
          <RiskSourceBadge source={riskSource} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Metric ID</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Indicator Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {[
                { id: 'R-CTR-01', name: 'Smart Contract Risk', category: 'Technical', score: plan.passport.radarData.contract },
                { id: 'R-LIQ-02', name: 'Liquidity / Exit Risk', category: 'Liquidity', score: plan.passport.radarData.liquidity },
                { id: 'R-ORC-03', name: 'Oracle / Pricing Risk', category: 'Data', score: plan.passport.radarData.oracle },
                { id: 'R-MKT-04', name: 'Market Risk', category: 'Financial', score: plan.passport.radarData.market },
                { id: 'R-OPS-05', name: 'Operational Risk', category: 'Process', score: plan.passport.radarData.operational },
              ].map((metric) => {
                const status = getMetricStatus(metric.score);
                return (
                  <tr key={metric.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-mono text-slate-500 text-xs">{metric.id}</td>
                    <td className="px-6 py-3 font-medium text-slate-900">{metric.name}</td>
                    <td className="px-6 py-3 text-slate-500 text-xs">{metric.category}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${status.colorClasses}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-slate-900 text-xs">{metric.score}/100</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(!riskSource || riskSource === 'demo_defaults') && (
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-[14px]">info</span>
            <p className="text-[11px] text-amber-700 font-medium">
              Risk dimensions use demo defaults — not sourced from protocol or on-chain risk feeds.
            </p>
          </div>
        )}
        {riskSource && riskSource !== 'demo_defaults' && (
          <div className="px-6 py-3 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[14px]">check_circle</span>
            <p className="text-[11px] text-blue-700 font-medium">
              Risk dimensions sourced from {riskSource.replace(/_/g, ' ')} at time of execution.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

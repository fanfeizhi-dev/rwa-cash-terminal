import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAppStore } from '../store';
import { computeRebalanceAdvisory } from '../utils/rebalanceAdvisory';
import { cn } from '../components/Layout';
import type { PortfolioHistoryPoint } from '../utils/portfolioHistory';

type TimeRange = '7D' | '30D' | '90D';

function formatAxisDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-lg">
      <p className="text-xs font-bold text-slate-900 mb-1">{formatAxisDate(label)}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="text-xs text-slate-600">
          <span style={{ color: entry.color }}>{entry.name}:</span>{' '}
          <span className="font-mono font-bold">${Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { isConnected } = useAccount();
  const plan = useAppStore((s) => s.plan);
  const aprData = useAppStore((s) => s.aprData);
  const positions = useAppStore((s) => s.positions);
  const riskConfig = useAppStore((s) => s.riskConfig);
  const engineConfig = useAppStore((s) => s.engineConfig);
  const portfolioHistory = useAppStore((s) => s.portfolioHistory);
  const configValidation = useAppStore((s) => s.configValidation);

  const [selectedRange, setSelectedRange] = useState<TimeRange>('30D');

  const hasPositions = positions?.isLoaded && positions.totalValueUsd > 0;

  const advisory = useMemo(
    () => computeRebalanceAdvisory(positions, plan),
    [positions, plan],
  );

  const weightedApy = useMemo(() => {
    if (!aprData || !positions?.isLoaded || positions.totalValueUsd === 0) return null;
    return (positions.bucketASplit * aprData.bucketA_apr + positions.bucketBSplit * aprData.bucketB_apr) * 100;
  }, [aprData, positions]);

  const aprIsEstimated = aprData ? (aprData.bucketA_isEstimated || aprData.bucketB_isEstimated) : true;
  const showSampleMode = !isConnected || !hasPositions;

  const filteredChartData = useMemo(() => {
    if (!portfolioHistory || portfolioHistory.points.length < 2) return [];
    const rangeDays = selectedRange === '7D' ? 7 : selectedRange === '30D' ? 30 : 90;
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return portfolioHistory.points.filter(
      p => new Date(p.timestamp).getTime() >= cutoff
    );
  }, [portfolioHistory, selectedRange]);

  const hasChartData = filteredChartData.length >= 2;
  const historySource = portfolioHistory?.source ?? 'empty';

  const failedChecks = configValidation?.checks.filter(c => c.status === 'failed') ?? [];
  const hasConfigIssues = failedChecks.length > 0;

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-8 pb-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
        <p className="text-slate-500 text-base">Real-time overview of your RWA portfolio performance and liquidity.</p>
      </div>

      {showSampleMode && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <span className="material-symbols-outlined text-amber-600 text-[20px]">info</span>
          <div>
            <p className="text-sm font-bold text-slate-900">Sample Data Mode</p>
            <p className="text-xs text-amber-800/70 font-medium">
              Dashboard is showing placeholder data. Connect your wallet and execute a plan via Build to see real portfolio metrics.
            </p>
          </div>
        </div>
      )}

      {/* Config Validation Banner (Option A) */}
      {hasConfigIssues && (
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
          <span className="material-symbols-outlined text-red-600 text-[20px] mt-0.5 shrink-0">error</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Configuration Issue Detected</p>
            <p className="text-xs text-red-800/70 font-medium mt-1">
              {failedChecks.map(c => c.description).join('. ')}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {failedChecks.map((check, i) => (
                <span key={i} className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold border border-red-200 uppercase tracking-wider">
                  {check.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {configValidation && !hasConfigIssues && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
          <span className="material-symbols-outlined text-emerald-600 text-[14px]">verified</span>
          <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
            CONFIG VERIFIED · {configValidation.checks.length} CHECKS PASSED
          </span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Liquidity */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <span className="material-symbols-outlined">account_balance</span>
            </div>
            {hasPositions ? (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">LIVE</span>
                {positions?.valuationMethod === 'fallback_1to1' && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">BPT ≈ 1:1 USD (APPROX)</span>
                )}
              </div>
            ) : (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">SAMPLE DATA</span>
            )}
          </div>
          <p className="text-slate-500 text-sm font-medium mb-1">Total Liquidity</p>
          {hasPositions ? (
            <>
              <h3 className="text-slate-900 text-3xl font-bold tracking-tight">
                ${positions!.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-slate-400 text-xs mt-2 font-mono">
                Split: {(positions!.bucketASplit * 100).toFixed(0)}% RWA Proxy / {(positions!.bucketBSplit * 100).toFixed(0)}% Stable Yield
              </p>
            </>
          ) : !isConnected ? (
            <>
              <h3 className="text-slate-300 text-3xl font-bold tracking-tight">—</h3>
              <p className="text-slate-400 text-xs mt-2">Connect wallet to view</p>
            </>
          ) : (
            <>
              <h3 className="text-slate-900 text-3xl font-bold tracking-tight">$0.00</h3>
              <p className="text-slate-400 text-xs mt-2">No positions found</p>
            </>
          )}
        </div>

        {/* Active Yield (APY) */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <span className="material-symbols-outlined">show_chart</span>
            </div>
            {aprIsEstimated && (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">EST.</span>
            )}
          </div>
          <p className="text-slate-500 text-sm font-medium mb-1">Active Yield (APY)</p>
          {weightedApy !== null ? (
            <>
              <h3 className="text-slate-900 text-3xl font-bold tracking-tight">{weightedApy.toFixed(2)}%</h3>
              <p className="text-slate-400 text-xs mt-2">Weighted Average Return</p>
            </>
          ) : plan ? (
            <>
              <h3 className="text-slate-900 text-3xl font-bold tracking-tight">
                {((plan.expectedAprRange[0] + plan.expectedAprRange[1]) / 2 * 100).toFixed(2)}%
              </h3>
              <p className="text-slate-400 text-xs mt-2">Based on current plan (no positions)</p>
            </>
          ) : (
            <>
              <h3 className="text-slate-300 text-3xl font-bold tracking-tight">—</h3>
              <p className="text-slate-400 text-xs mt-2">Build a plan to view</p>
            </>
          )}
        </div>

        {/* Risk Grade */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-emerald-100 to-transparent rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <span className="material-symbols-outlined">security</span>
            </div>
            {plan ? (
              <div className="flex flex-col items-end gap-1">
                <span className="flex items-center text-slate-500 text-sm font-medium bg-slate-100 px-2 py-1 rounded-full">
                  Score: {plan.passport.score}/100
                </span>
                {riskConfig && !riskConfig.isDemo ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">LIVE</span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">DEMO DEFAULTS</span>
                )}
              </div>
            ) : (
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">NO PLAN</span>
            )}
          </div>
          <p className="text-slate-500 text-sm font-medium mb-1 relative z-10">Risk Grade</p>
          <h3 className="text-slate-900 text-3xl font-bold tracking-tight relative z-10">
            {plan ? plan.passport.grade : '—'}
          </h3>
          <p className="text-slate-400 text-xs mt-2 relative z-10">RWA-CT Risk Framework (Weighted Vector)</p>
        </div>
      </div>

      {/* Rebalance Advisory */}
      {advisory?.shouldRebalance && (
        <div className="bg-white rounded-xl p-6 border border-amber-200 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <span className="material-symbols-outlined">balance</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Rebalance Advisory</h3>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-amber-200">
                  ADVISORY ONLY
                </span>
              </div>
              <div className="space-y-2 mb-4">
                {advisory.reasons.map((reason, i) => (
                  <p key={i} className="text-sm text-slate-600 leading-relaxed">{reason}</p>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Current Split</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${advisory.currentSplit.bucketA * 100}%` }}></div>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-900">{(advisory.currentSplit.bucketA * 100).toFixed(0)}%/{(advisory.currentSplit.bucketB * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Target Split</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${advisory.targetSplit.bucketA * 100}%` }}></div>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-900">{(advisory.targetSplit.bucketA * 100).toFixed(0)}%/{(advisory.targetSplit.bucketB * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/terminal/build" className="py-2 px-4 bg-black hover:bg-slate-800 text-white rounded-lg font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 transform active:scale-95">
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  Review in Build Plan
                </Link>
                <p className="text-[10px] text-slate-400 font-medium">
                  This is an advisory suggestion only. No transactions will be executed automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col relative">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-900">Portfolio Performance</h3>
              {historySource === 'subgraph' && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">LIVE</span>
              )}
              {historySource === 'local_snapshots' && (
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold border border-blue-100 uppercase tracking-wider">LOCAL HISTORY</span>
              )}
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">Bucket A (Balancer LP)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-slate-800"></span>
                <span className="text-slate-600">Bucket B (Stable Yield)</span>
              </div>
            </div>
          </div>

          {hasPositions ? (
            <div className="flex-1 flex flex-col gap-6">
              {/* Time-series chart area */}
              {hasChartData ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Value Over Time</p>
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                      {(['7D', '30D', '90D'] as TimeRange[]).map(range => (
                        <button
                          key={range}
                          onClick={() => setSelectedRange(range)}
                          className={cn(
                            "px-3 py-1 rounded-md text-xs font-bold transition-all",
                            selectedRange === range
                              ? "bg-white text-black shadow-sm"
                              : "text-gray-500 hover:text-gray-900"
                          )}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={filteredChartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e293b" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#1e293b" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={formatAxisDate}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                        width={60}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="bucketAValueUsd"
                        name="Bucket A (Balancer LP)"
                        stackId="1"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#gradA)"
                      />
                      <Area
                        type="monotone"
                        dataKey="bucketBValueUsd"
                        name="Bucket B (Stable Yield)"
                        stackId="1"
                        stroke="#1e293b"
                        strokeWidth={2}
                        fill="url(#gradB)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-8">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 border border-blue-100">
                    <span className="material-symbols-outlined text-blue-400 text-2xl">timeline</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 mb-1">Historical data building...</p>
                  <p className="text-xs text-slate-500 text-center max-w-xs">
                    Portfolio snapshots are being collected. A time-series chart will appear here once enough data points are available.
                  </p>
                  <span className="mt-3 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold border border-blue-100 uppercase tracking-wider">
                    INDEXER: {historySource === 'subgraph' ? 'CONNECTED' : 'LOCAL SNAPSHOTS'}
                  </span>
                </div>
              )}

              {/* Current snapshot allocation bar */}
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Allocation Snapshot</p>
                <div className="flex h-10 rounded-lg overflow-hidden border border-slate-200">
                  <div className="bg-emerald-500 flex items-center justify-center transition-all" style={{ width: `${Math.max(positions!.bucketASplit * 100, 1)}%` }}>
                    {positions!.bucketASplit > 0.08 && (
                      <span className="text-white text-xs font-bold">{(positions!.bucketASplit * 100).toFixed(1)}%</span>
                    )}
                  </div>
                  <div className="bg-slate-800 flex items-center justify-center flex-1">
                    {positions!.bucketBSplit > 0.08 && (
                      <span className="text-white text-xs font-bold">{(positions!.bucketBSplit * 100).toFixed(1)}%</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">BPT Balance</p>
                    <p className="text-sm font-bold text-slate-900 font-mono">{positions!.bptBalance.toFixed(6)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vault Shares</p>
                    <p className="text-sm font-bold text-slate-900 font-mono">{positions!.vaultAssetValue.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">USDC Idle</p>
                    <p className="text-sm font-bold text-slate-900 font-mono">{positions!.usdcBalance.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">BPT Price</p>
                      {positions!.bptPriceConfidence === 'high' ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">LIVE</span>
                      ) : positions!.bptPriceConfidence === 'medium' ? (
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold border border-blue-100 uppercase tracking-wider">MULTI-SOURCE</span>
                      ) : positions!.valuationMethod === 'fallback_1to1' ? (
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">APPROX</span>
                      ) : null}
                    </div>
                    <p className="text-sm font-bold text-slate-900 font-mono">
                      ${positions!.bptPriceUsd?.toFixed(4) ?? '—'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      via {positions!.valuationMethod ?? 'unknown'}
                      {positions!.bptPriceSources && (() => {
                        const count = Object.values(positions!.bptPriceSources!).filter(s => s?.success).length;
                        return count > 1 ? ` · ${count} sources agree` : '';
                      })()}
                    </p>
                    {positions!.poolWeights && positions!.poolWeights.length > 0 && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Pool: {positions!.poolWeights.map(w => `${(w.weight * 100).toFixed(0)}%`).join('/')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="material-symbols-outlined text-blue-600 text-[16px]">info</span>
                <p className="text-[11px] text-blue-700 font-medium">
                  {positions?.valuationMethod === 'pool_tokens'
                    ? `BPT valued via Balancer pool reserves${positions.poolWeights && positions.poolWeights.length > 0 ? ` (${positions.poolWeights.map(w => `${(w.weight * 100).toFixed(1)}%`).join(' / ')})` : ''}. ${positions.bptPriceConfidence === 'high' ? 'Verified across multiple sources.' : positions.bptPriceConfidence === 'medium' ? 'Partial cross-source verification.' : 'Single source — limited verification.'}`
                    : positions?.valuationMethod === 'fallback_1to1'
                      ? 'BPT valued at 1:1 USD (approximate). Pool token query failed.'
                      : `BPT valued via ${positions?.valuationMethod ?? 'unknown'} source.`}
                </p>
              </div>
              {positions?.bptPriceConfidence === 'low' && positions.bptPriceSources && Object.keys(positions.bptPriceSources).length > 1 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                  <span className="material-symbols-outlined text-red-600 text-[16px]">warning</span>
                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">PRICE DIVERGENCE DETECTED</p>
                  <p className="text-[11px] text-red-700 font-medium">Multiple price sources show significant divergence (&gt;20%).</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 w-full min-h-[300px] flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <span className="material-symbols-outlined text-slate-300 text-3xl">monitoring</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No Portfolio Data</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-6">
                Connect your wallet and execute a plan via Build to see your real-time portfolio allocation and performance.
              </p>
              <Link
                to="/terminal/build"
                className="px-6 py-2 bg-black text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors shadow-md"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col gap-4">
          <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
          <Link to="/terminal/build" className="flex items-center justify-between w-full p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-100 group transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">add</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">Deposit Funds</p>
                <p className="text-xs text-slate-500">Deploy USDC via Build Plan</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600">chevron_right</span>
          </Link>
          <Link to="/terminal/build" className="flex items-center justify-between w-full p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-100 group transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">swap_horiz</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">Rebalance Portfolio</p>
                <p className="text-xs text-slate-500">Review & adjust allocation</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600">chevron_right</span>
          </Link>
          <Link to="/terminal/receipts" className="flex items-center justify-between w-full p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-100 group transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">download</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">Download Auditable Receipt</p>
                <p className="text-xs text-slate-500">JSON/PDF</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600">chevron_right</span>
          </Link>
        </div>
      </div>

      {/* Engine Configuration */}
      <details className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors rounded-xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-400 text-[20px]">settings</span>
            <span className="text-sm font-bold text-slate-900">Engine Configuration</span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              CURRENT PARAMS
            </span>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-[16px]">expand_more</span>
        </summary>
        <div className="px-6 pb-6 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Conservative Split</p>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {(engineConfig.riskProfiles.conservative.bucketA * 100).toFixed(0)}% / {(engineConfig.riskProfiles.conservative.bucketB * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Balanced Split</p>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {(engineConfig.riskProfiles.balanced.bucketA * 100).toFixed(0)}% / {(engineConfig.riskProfiles.balanced.bucketB * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Yield-Seeking Split</p>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {(engineConfig.riskProfiles.yield_seeking.bucketA * 100).toFixed(0)}% / {(engineConfig.riskProfiles.yield_seeking.bucketB * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Stress Mode Cap</p>
              <p className="text-sm font-bold text-slate-900 font-mono">{(engineConfig.stressModeCap * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Max Bucket A</p>
              <p className="text-sm font-bold text-slate-900 font-mono">{(engineConfig.maxBucketA * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Exit Delta T+0</p>
              <p className="text-sm font-bold text-slate-900 font-mono">{(engineConfig.exitWindowDeltas.T0 * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Exit Delta T+3</p>
              <p className="text-sm font-bold text-slate-900 font-mono">{(engineConfig.exitWindowDeltas.T3 * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Exit Delta T+7</p>
              <p className="text-sm font-bold text-slate-900 font-mono">{(engineConfig.exitWindowDeltas.T7 > 0 ? '+' : '') + (engineConfig.exitWindowDeltas.T7 * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Grade A Threshold</p>
              <p className="text-sm font-bold text-slate-900 font-mono">≥ {engineConfig.gradeThresholds.A}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Grade B Threshold</p>
              <p className="text-sm font-bold text-slate-900 font-mono">≥ {engineConfig.gradeThresholds.B}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Drift Threshold</p>
              <p className="text-sm font-bold text-slate-900 font-mono">{(engineConfig.rebalanceDriftThreshold * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Score Weights</p>
              <p className="text-xs font-bold text-slate-900 font-mono">
                C:{engineConfig.scoreWeights.contract} L:{engineConfig.scoreWeights.liquidity} O:{engineConfig.scoreWeights.oracle} M:{engineConfig.scoreWeights.market} Op:{engineConfig.scoreWeights.operational}
              </p>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

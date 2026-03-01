import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { cn } from '../components/Layout';
import { PieChart, Pie, Cell } from 'recharts';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { sepolia } from 'wagmi/chains';
import { waitForTransactionReceipt, readContract } from '@wagmi/core';
import sepoliaConfig from '../config/sepolia.json';
import { config } from '../config/wagmi';
import { erc20ReadAbi } from '../config/abis';
import { approveForBalancer, joinPool, approveForVault, depositToVault } from '../packages/protocol-adapters';
import { useNavigate } from 'react-router-dom';
import { computeRebalanceAdvisory } from '../utils/rebalanceAdvisory';
import { parseReceivedAmount } from '../utils/parseReceivedAmount';
import type { TxStatus } from '../types';

type StepStatus = 'waiting' | 'pending' | 'confirming' | 'confirmed' | 'failed';
type StepKey = 'approveA' | 'joinA' | 'approveB' | 'depositB';

const STEP_LABELS: Record<StepKey, string> = {
  approveA: 'Approve USDC (Balancer)',
  joinA: 'Join Balancer Pool',
  approveB: 'Approve USDC (Stable Yield)',
  depositB: 'Deposit Stable Yield Vault',
};

const STEP_ORDER: StepKey[] = ['approveA', 'joinA', 'approveB', 'depositB'];

const INITIAL_STEPS: Record<StepKey, StepStatus> = {
  approveA: 'waiting',
  joinA: 'waiting',
  approveB: 'waiting',
  depositB: 'waiting',
};

export default function BuildPlan() {
  const { inputs, setInputs, plan, generatePlan, addReceipt } = useAppStore();
  const positions = useAppStore((s) => s.positions);
  const eligibilityStatus = useAppStore((s) => s.eligibilityStatus);
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();

  const advisory = useMemo(
    () => computeRebalanceAdvisory(positions, plan),
    [positions, plan],
  );

  const [steps, setSteps] = useState<Record<StepKey, StepStatus>>(INITIAL_STEPS);
  const [txHashes, setTxHashes] = useState<Partial<Record<StepKey, string>>>({});
  const [executing, setExecuting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  useEffect(() => {
    generatePlan();
  }, [inputs, generatePlan]);

  const { writeContractAsync } = useWriteContract();

  const handleExecute = async () => {
    if (!isConnected || !address || !plan) return;

    setValidationError(null);
    setExecutionError(null);
    setTxHashes({});
    setSteps({ ...INITIAL_STEPS });

    const writeFn = writeContractAsync as Parameters<typeof approveForBalancer>[0];
    const amountA = parseUnits(plan.bucketA.amount.toString(), sepoliaConfig.assets.USDC.decimals);
    const amountB = parseUnits(plan.bucketB.amount.toString(), sepoliaConfig.assets.USDC.decimals);
    const totalNeeded = amountA + amountB;

    // ── Pre-validation (balance check) ──
    setValidating(true);
    try {
      const balance = await readContract(config, {
        address: sepoliaConfig.assets.USDC.address as `0x${string}`,
        abi: erc20ReadAbi,
        functionName: 'balanceOf',
        args: [address],
        chainId: sepolia.id,
      } as any) as bigint;

      if (balance < totalNeeded) {
        const available = formatUnits(balance, sepoliaConfig.assets.USDC.decimals);
        const required = formatUnits(totalNeeded, sepoliaConfig.assets.USDC.decimals);
        setValidationError(`Insufficient USDC balance. Required: ${required} USDC, Available: ${available} USDC`);
        setValidating(false);
        return;
      }
    } catch {
      setValidationError('Failed to validate USDC balance. Please check your connection.');
      setValidating(false);
      return;
    }
    setValidating(false);

    // ── Execution ──
    setExecuting(true);

    let approveATxHash = '';
    let joinATxHash = '';
    let approveBTxHash = '';
    let depositBTxHash = '';

    try {
      // Step 1: Approve USDC for Balancer Vault
      setSteps(prev => ({ ...prev, approveA: 'pending' }));
      approveATxHash = await approveForBalancer(writeFn, address, amountA);
      setTxHashes(prev => ({ ...prev, approveA: approveATxHash }));
      setSteps(prev => ({ ...prev, approveA: 'confirming' }));

      const approveAReceipt = await waitForTransactionReceipt(config, {
        hash: approveATxHash as `0x${string}`,
        confirmations: 1,
      });

      if (approveAReceipt.status === 'reverted') {
        setSteps(prev => ({ ...prev, approveA: 'failed' }));
        setExecutionError('Bucket A USDC approve reverted on-chain.');
        setExecuting(false);
        return;
      }
      setSteps(prev => ({ ...prev, approveA: 'confirmed' }));

      // Step 2: Join Balancer Pool
      setSteps(prev => ({ ...prev, joinA: 'pending' }));
      joinATxHash = await joinPool(writeFn, address, amountA);
      setTxHashes(prev => ({ ...prev, joinA: joinATxHash }));
      setSteps(prev => ({ ...prev, joinA: 'confirming' }));

      const joinAReceiptPromise = waitForTransactionReceipt(config, {
        hash: joinATxHash as `0x${string}`,
        confirmations: 1,
      });
      joinAReceiptPromise.then(r => {
        setSteps(prev => ({ ...prev, joinA: r.status === 'success' ? 'confirmed' : 'failed' }));
      });

      // Step 3: Approve USDC for LTV Vault
      setSteps(prev => ({ ...prev, approveB: 'pending' }));
      approveBTxHash = await approveForVault(writeFn, address, amountB);
      setTxHashes(prev => ({ ...prev, approveB: approveBTxHash }));
      setSteps(prev => ({ ...prev, approveB: 'confirming' }));

      const approveBReceipt = await waitForTransactionReceipt(config, {
        hash: approveBTxHash as `0x${string}`,
        confirmations: 1,
      });

      if (approveBReceipt.status === 'reverted') {
        setSteps(prev => ({ ...prev, approveB: 'failed' }));

        const joinAReceipt = await joinAReceiptPromise;
        const joinAStatus: TxStatus = joinAReceipt.status === 'success' ? 'success' : 'failed';

        let bptReceived: string | null = null;
        if (joinAStatus === 'success') {
          bptReceived = await parseReceivedAmount(joinATxHash, address, 'A');
        }

        const receiptId = `RWA-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        addReceipt({
          receiptId,
          wallet: address,
          timestamp: new Date().toISOString(),
          plan,
          overallStatus: joinAStatus === 'success' ? 'partial_failure' : 'failed',
          executions: {
            bucketA: {
              approveTx: approveATxHash,
              approveTxStatus: 'success',
              actionTx: joinATxHash,
              actionTxStatus: joinAStatus,
              receivedToken: 'BPT',
              receivedAmount: bptReceived ?? undefined,
            },
            bucketB: {
              approveTx: approveBTxHash,
              approveTxStatus: 'failed',
              actionTx: '',
              actionTxStatus: 'failed',
              receivedToken: 'Vault Shares',
            },
          },
        });

        setExecutionError('Bucket B USDC approve reverted on-chain. Partial receipt saved.');
        setExecuting(false);
        return;
      }
      setSteps(prev => ({ ...prev, approveB: 'confirmed' }));

      // ── Pre-validation: allowance for LTV Vault deposit ──
      try {
        const allowanceB = await readContract(config, {
          address: sepoliaConfig.assets.USDC.address as `0x${string}`,
          abi: erc20ReadAbi,
          functionName: 'allowance',
          args: [address, sepoliaConfig.ltvVault.vault as `0x${string}`],
          chainId: sepolia.id,
        } as any) as bigint;

        if (allowanceB < amountB) {
          setSteps(prev => ({ ...prev, depositB: 'failed' }));
          setExecutionError('Insufficient USDC allowance for LTV Vault. Please ensure the approve transaction was confirmed before deposit.');
          setExecuting(false);
          return;
        }
      } catch {
        setSteps(prev => ({ ...prev, depositB: 'failed' }));
        setExecutionError('Failed to validate USDC allowance. Please check your connection.');
        setExecuting(false);
        return;
      }

      // Step 4: Deposit to LTV Vault
      setSteps(prev => ({ ...prev, depositB: 'pending' }));
      depositBTxHash = await depositToVault(writeFn, address, amountB);
      setTxHashes(prev => ({ ...prev, depositB: depositBTxHash }));
      setSteps(prev => ({ ...prev, depositB: 'confirming' }));

      const depositBReceiptPromise = waitForTransactionReceipt(config, {
        hash: depositBTxHash as `0x${string}`,
        confirmations: 1,
      });
      depositBReceiptPromise.then(r => {
        setSteps(prev => ({ ...prev, depositB: r.status === 'success' ? 'confirmed' : 'failed' }));
      });

      // Wait for both action tx receipts
      const [joinAReceipt, depositBReceipt] = await Promise.all([
        joinAReceiptPromise,
        depositBReceiptPromise,
      ]);

      const joinAStatus: TxStatus = joinAReceipt.status === 'success' ? 'success' : 'failed';
      const depositBStatus: TxStatus = depositBReceipt.status === 'success' ? 'success' : 'failed';

      const [bptReceived, vaultSharesReceived] = await Promise.all([
        joinAStatus === 'success' ? parseReceivedAmount(joinATxHash, address, 'A') : Promise.resolve(null),
        depositBStatus === 'success' ? parseReceivedAmount(depositBTxHash, address, 'B') : Promise.resolve(null),
      ]);

      const allSuccess = joinAStatus === 'success' && depositBStatus === 'success';
      const allFailed = joinAStatus === 'failed' && depositBStatus === 'failed';
      const overallStatus = allSuccess ? 'success' as const : allFailed ? 'failed' as const : 'partial_failure' as const;

      const receiptId = `RWA-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      addReceipt({
        receiptId,
        wallet: address,
        timestamp: new Date().toISOString(),
        plan,
        overallStatus,
        executions: {
          bucketA: {
            approveTx: approveATxHash,
            approveTxStatus: 'success',
            actionTx: joinATxHash,
            actionTxStatus: joinAStatus,
            receivedToken: 'BPT',
            receivedAmount: bptReceived ?? undefined,
          },
          bucketB: {
            approveTx: approveBTxHash,
            approveTxStatus: 'success',
            actionTx: depositBTxHash,
            actionTxStatus: depositBStatus,
            receivedToken: 'Vault Shares',
            receivedAmount: vaultSharesReceived ?? undefined,
          },
        },
      });

      navigate('/terminal/receipts');

    } catch (error) {
      console.error('Execution failed:', error);
      setExecutionError(error instanceof Error ? error.message : 'Execution failed unexpectedly.');
      setExecuting(false);
    }
  };

  if (!plan) return null;

  const data = [
    { name: 'Bucket A', value: plan.bucketA.allocationPct },
    { name: 'Bucket B', value: plan.bucketB.allocationPct },
  ];

  const COLORS = ['#10b981', '#1e293b'];
  const isExecuting = executing || validating;

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <span className="material-symbols-outlined text-lg">home</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span>Execution</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-black font-bold">Build Plan</span>
        </div>
      </div>
      {advisory?.shouldRebalance && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <span className="material-symbols-outlined text-amber-600 text-[20px]">balance</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Rebalance Suggested</p>
            <p className="text-xs text-amber-800/70 font-medium">
              Current portfolio has drifted {advisory.driftPct.toFixed(1)}% from target. Adjust your configuration below to realign.
            </p>
          </div>
          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-amber-200">
            DRIFT: {advisory.driftPct.toFixed(1)}%
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto">
        {/* ── Column 1: Configure Strategy ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm shadow-md">1</div>
              <h3 className="text-lg font-bold text-gray-900">Configure Strategy</h3>
            </div>
            <div className="space-y-8 flex-1">
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Deploy Capital</label>
                <div className="flex rounded-lg border border-gray-200 bg-gray-50 shadow-inner transition-all hover:border-gray-300 focus-within:ring-2 focus-within:ring-black focus-within:border-black overflow-hidden">
                  <input
                    type="number"
                    value={inputs.amount}
                    onChange={(e) => setInputs({ amount: Number(e.target.value) })}
                    className="flex-1 min-w-0 pl-4 py-4 bg-transparent border-none focus:ring-0 focus:outline-none font-mono text-2xl font-bold text-gray-900"
                  />
                  <div className="flex items-center px-4 border-l border-gray-200 bg-gray-100">
                    <span className="text-gray-900 font-bold text-sm">USDC</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-3 tracking-wider flex justify-between items-center">
                  Risk Profile
                  {inputs.eligibility === 'not_eligible' && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">RESTRICTED</span>
                  )}
                </label>
                <div className={cn("bg-gray-100 p-1.5 rounded-xl grid grid-cols-3 gap-1 h-12 shadow-inner", inputs.eligibility === 'not_eligible' && "opacity-50 pointer-events-none")}>
                  {['conservative', 'balanced', 'yield_seeking'].map((profile) => (
                    <button
                      key={profile}
                      onClick={() => setInputs({ riskProfile: profile as any })}
                      className={cn(
                        "rounded-lg text-xs transition-all",
                        inputs.riskProfile === profile
                          ? "font-bold bg-white text-black shadow-sm ring-1 ring-black/5"
                          : "font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                      )}
                    >
                      {profile.replace('_', '-').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-3 tracking-wider">Exit Window (Liquidity Preference)</label>
                <div className="bg-gray-100 p-1.5 rounded-xl grid grid-cols-3 gap-1 h-12 shadow-inner">
                  {['T0', 'T3', 'T7'].map((window) => (
                    <button
                      key={window}
                      onClick={() => setInputs({ exitWindow: window as any })}
                      className={cn(
                        "rounded-lg text-xs transition-all relative",
                        inputs.exitWindow === window
                          ? "font-bold bg-white text-black shadow-sm ring-1 ring-black/5"
                          : "font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                      )}
                    >
                      {window.replace('T', 'T+')}
                      {inputs.exitWindow === window && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-3 tracking-wider">
                  Eligibility Status
                </label>
                <div className={cn(
                  "bg-gray-100 p-1.5 rounded-xl grid grid-cols-2 gap-1 h-12 shadow-inner",
                  eligibilityStatus && eligibilityStatus.source === 'on_chain_registry' && "opacity-60 pointer-events-none"
                )}>
                  <button
                    onClick={() => setInputs({ eligibility: 'eligible', eligibilitySource: 'user_input' })}
                    className={cn(
                      "rounded-lg text-xs transition-all",
                      inputs.eligibility === 'eligible'
                        ? "font-bold bg-white text-black shadow-sm ring-1 ring-black/5"
                        : "font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                    )}
                  >
                    ELIGIBLE
                  </button>
                  <button
                    onClick={() => setInputs({ eligibility: 'not_eligible', eligibilitySource: 'user_input' })}
                    className={cn(
                      "rounded-lg text-xs transition-all",
                      inputs.eligibility === 'not_eligible'
                        ? "font-bold bg-red-50 text-red-700 shadow-sm ring-1 ring-red-200"
                        : "font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                    )}
                  >
                    NOT ELIGIBLE
                  </button>
                </div>
                {eligibilityStatus && (
                  <div className="flex items-center gap-2 mt-2">
                    {eligibilityStatus.source === 'on_chain_registry' ? (
                      <>
                        <span className="material-symbols-outlined text-emerald-600 text-[14px]">verified</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">
                          VERIFIED ON-CHAIN
                        </span>
                      </>
                    ) : eligibilityStatus.source === 'permissive_mode' ? (
                      <>
                        <span className="material-symbols-outlined text-blue-600 text-[14px]">info</span>
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-100">
                          PERMISSIVE MODE
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">No registry deployed</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
              {inputs.eligibility === 'not_eligible' && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-600 text-[20px] mt-0.5 shrink-0">block</span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">RWA Proxy Leg Disabled</p>
                    <p className="text-xs text-red-800/70 mt-1 font-medium">
                      RWA proxy leg disabled due to eligibility status. All capital will be routed to Bucket B (Stable Yield Vault).
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100 mt-auto">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-600 text-[20px]">info</span>
                    <div className="text-sm font-bold text-gray-900">Stress Mode</div>
                  </div>
                  <div className="text-[11px] text-red-800/70 mt-1 font-medium">Bucket A capped at 20% to mitigate LP exit risk</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={inputs.marketRegime === 'stress'}
                    onChange={(e) => setInputs({ marketRegime: e.target.checked ? 'stress' : 'normal' })}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 shadow-inner"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Allocation Preview ── */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-900 text-gray-900 flex items-center justify-center font-bold text-sm">2</div>
              <h3 className="text-lg font-bold text-gray-900">Allocation Preview</h3>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center relative py-4">
              <div className="relative w-64 h-64 mb-8">
                <PieChart width={256} height={256}>
                  <Pie
                    data={data}
                    cx={128}
                    cy={128}
                    innerRadius={80}
                    outerRadius={100}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Net APY</span>
                  <span className="text-5xl font-black text-gray-900 tracking-tight font-mono">
                    {((plan.expectedAprRange[0] + plan.expectedAprRange[1]) / 2 * 100).toFixed(1)}%
                  </span>
                  <div className="mt-1 text-[11px] font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                    Expected Range: {(plan.expectedAprRange[0] * 100).toFixed(1)}% - {(plan.expectedAprRange[1] * 100).toFixed(1)}%
                  </div>
                  {plan.aprSources && (plan.aprSources.bucketA.isEstimated || plan.aprSources.bucketB.isEstimated) && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[12px]">info</span>
                      APR Estimated
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full space-y-3 px-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm bg-slate-800"></div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Bucket B (Stable Yield)</span>
                      <span className="text-[10px] text-gray-500">Low Risk • Stable Yield</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-gray-900 font-mono">{(plan.bucketB.allocationPct * 100).toFixed(0)}%</span>
                    {plan.aprSources && (
                      <span className="text-[10px] text-slate-400 ml-2">APR: {(plan.aprSources.bucketB.value * 100).toFixed(2)}%{plan.aprSources.bucketB.isEstimated ? ' (est.)' : ''}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Bucket A (Balancer LP)</span>
                      <span className="text-[10px] text-gray-500">Yield Farming • Balancer</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-gray-900 font-mono">{(plan.bucketA.allocationPct * 100).toFixed(0)}%</span>
                    {plan.aprSources && (
                      <span className="text-[10px] text-slate-400 ml-2">APR: {(plan.aprSources.bucketA.value * 100).toFixed(2)}%{plan.aprSources.bucketA.isEstimated ? ' (est.)' : ''}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 3: Execution Timeline ── */}
        <div className="lg:col-span-4">
          <div className="bg-black rounded-xl p-6 border border-gray-800 shadow-2xl h-full flex flex-col text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
            <div className="flex items-center gap-3 mb-8 relative z-10 pb-4 border-b border-gray-800">
              <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm shadow-[0_0_10px_rgba(255,255,255,0.3)]">3</div>
              <h3 className="text-lg font-bold tracking-tight">Execution Timeline</h3>
            </div>
            <div className="flex-1 relative z-10 overflow-y-auto pr-2 custom-scrollbar flex flex-col justify-center">
              <div className="relative pl-8 border-l border-gray-800 space-y-10 ml-2">
                {STEP_ORDER.map((key) => {
                  const status = steps[key];
                  const hash = txHashes[key];
                  const isActive = status !== 'waiting';
                  const isFailed = status === 'failed';
                  const isConfirmed = status === 'confirmed';

                  return (
                    <div key={key} className="relative group">
                      <div className={cn(
                        "absolute -left-[37px] top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center z-20 transition-all",
                        isConfirmed ? "bg-black border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" :
                        isFailed ? "bg-black border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" :
                        isActive ? "bg-black border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]" :
                        "bg-black border-gray-700"
                      )}>
                        <div className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          isConfirmed ? "bg-emerald-500" :
                          isFailed ? "bg-red-500" :
                          isActive ? "bg-blue-500" :
                          "bg-gray-700"
                        )}></div>
                      </div>
                      <div>
                        <h4 className={cn(
                          "text-sm font-bold mb-1 uppercase tracking-wider transition-colors",
                          isActive ? "text-white" : "text-gray-500"
                        )}>{STEP_LABELS[key]}</h4>
                        <div className="flex items-center gap-2 mb-2">
                          {status === 'confirmed' && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono border border-emerald-500/20">CONFIRMED</span>
                          )}
                          {status === 'pending' && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono border border-blue-500/20 animate-pulse">PENDING</span>
                          )}
                          {status === 'confirming' && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono border border-amber-500/20 animate-pulse">CONFIRMING</span>
                          )}
                          {status === 'failed' && (
                            <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono border border-red-500/20">FAILED</span>
                          )}
                          {status === 'waiting' && (
                            <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono border border-gray-700">WAITING</span>
                          )}
                        </div>
                        {hash && (
                          <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-emerald-400/80 hover:text-emerald-300 transition-colors break-all">
                            <span className="material-symbols-outlined text-[12px] shrink-0">open_in_new</span>
                            {hash.slice(0, 10)}...{hash.slice(-8)}
                          </a>
                        )}
                        {isFailed && hash && (
                          <p className="text-[11px] text-red-400/80 mt-1 font-medium">
                            Transaction reverted on-chain.{' '}
                            <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="underline">View details</a>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-gray-800 relative z-10">
              {validationError && (
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  {validationError}
                </div>
              )}
              {executionError && (
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  {executionError}
                </div>
              )}
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="w-full py-3 bg-white hover:bg-gray-100 text-black rounded-lg font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {validating ? 'hourglass_top' : 'rocket_launch'}
                </span>
                {validating ? 'Validating...' : executing ? 'Executing...' : 'Execute Plan'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

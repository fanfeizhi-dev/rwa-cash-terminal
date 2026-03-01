import React, { useState, useEffect } from 'react';
import { readContract } from '@wagmi/core';
import sepoliaConfig from '../config/sepolia.json';
import { useAppStore } from '../store';
import { config } from '../config/wagmi';
import { eip4626VaultReadAbi } from '../config/abis';
import { sepolia } from 'wagmi/chains';
import { cn } from '../components/Layout';

export default function ProtocolDirectory() {
  const aprData = useAppStore((s) => s.aprData);
  const configValidation = useAppStore((s) => s.configValidation);
  const [vaultMeta, setVaultMeta] = useState<{ symbol: string; decimals: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vaultAddr = sepoliaConfig.ltvVault.vault as `0x${string}`;
        const [symbol, decimals] = await Promise.all([
          readContract(config, {
            abi: eip4626VaultReadAbi,
            functionName: 'symbol',
            args: [],
            chainId: sepolia.id,
            address: vaultAddr,
          } as any),
          readContract(config, {
            abi: eip4626VaultReadAbi,
            functionName: 'decimals',
            args: [],
            chainId: sepolia.id,
            address: vaultAddr,
          } as any),
        ]);
        if (!cancelled) {
          setVaultMeta({ symbol: symbol as string, decimals: Number(decimals) });
        }
      } catch (err) {
        console.warn('Failed to fetch vault metadata:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return (
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">
            PASSED
          </span>
        );
      case 'failed':
        return (
          <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold border border-red-200 uppercase tracking-wider">
            FAILED
          </span>
        );
      case 'warning':
        return (
          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">
            WARNING
          </span>
        );
      default:
        return (
          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold border border-slate-200 uppercase tracking-wider">
            SKIPPED
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Protocol Directory</h1>
          <p className="text-sm text-slate-500">
            Verified smart contracts and liquidity pools on Ethereum Sepolia.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 text-[16px]">update</span>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Configuration Last Updated</span>
        </div>
        <span className="text-xs font-mono text-slate-900">
          {typeof __BUILD_TIMESTAMP__ !== 'undefined' ? new Date(__BUILD_TIMESTAMP__).toLocaleString() : '—'}
        </span>
      </div>
      <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-600 text-2xl">paid</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">USDC (Circle Testnet)</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Base Asset — Used by Both Buckets</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Token Contract (Sepolia)</h3>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-sm font-mono text-slate-900 break-all">{sepoliaConfig.assets.USDC.address}</span>
              <a href={`https://sepolia.etherscan.io/address/${sepoliaConfig.assets.USDC.address}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-2 shrink-0">
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              </a>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Decimals</h3>
              <span className="text-sm font-bold text-slate-900 font-mono">{sepoliaConfig.assets.USDC.decimals}</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Source</h3>
              <span className="text-sm font-bold text-slate-900">Circle Faucet</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            ⚠ Sepolia has multiple USDC-like tokens. This terminal exclusively uses the Circle testnet USDC at the address above. Verify before interacting.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center p-2">
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <rect x="65" y="50" width="70" height="24" rx="12" fill="#1E1E1E"/>
                <rect x="45" y="88" width="110" height="24" rx="12" fill="#1E1E1E"/>
                <rect x="25" y="126" width="150" height="24" rx="12" fill="#1E1E1E"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Balancer v2</h2>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Bucket A (RWA Proxy)</p>
            </div>
          </div>
          <div className="space-y-4 flex-1">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vault Contract</h3>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-sm font-mono text-slate-900 break-all">{sepoliaConfig.balancer.vault}</span>
                <a href={`https://sepolia.etherscan.io/address/${sepoliaConfig.balancer.vault}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-2 shrink-0">
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pool ID (USDC/WETH)</h3>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-sm font-mono text-slate-900 break-all">{sepoliaConfig.balancer.poolId}</span>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Risk Profile</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Represents the "yield-seeking" leg. Uses a Balancer weighted pool to simulate RWA exposure with higher potential returns but increased market risk.
              </p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Pool APR {aprData?.bucketA_isEstimated === false ? '' : '(Est.)'}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {aprData ? (aprData.bucketA_apr * 100).toFixed(2) + '%' : '—'}
                </span>
                {aprData && !aprData.bucketA_isEstimated && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">LIVE</span>
                )}
                {aprData?.bucketA_isEstimated && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">EST.</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <a href="https://balancer.fi" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
              View Protocol Documentation <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
        </div>
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-700 text-2xl">savings</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Stable Yield Vault</h2>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Bucket B (Stable Yield)</p>
            </div>
          </div>
          <div className="space-y-4 flex-1">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vault Contract (EIP-4626)</h3>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-sm font-mono text-slate-900 break-all">{sepoliaConfig.ltvVault.vault}</span>
                <a href={`https://sepolia.etherscan.io/address/${sepoliaConfig.ltvVault.vault}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-2 shrink-0">
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Underlying Asset (Circle USDC)</h3>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-sm font-mono text-slate-900 break-all">{sepoliaConfig.ltvVault.asset}</span>
                <a href={`https://sepolia.etherscan.io/address/${sepoliaConfig.ltvVault.asset}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 ml-2 shrink-0">
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </a>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Share Token</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 font-mono">
                    {vaultMeta?.symbol ?? 'rwaUSD'}
                  </span>
                  {vaultMeta && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">LIVE</span>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Decimals</h3>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {vaultMeta?.decimals ?? 6}
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  APR {aprData?.bucketB_isEstimated === false ? '' : '(Est.)'}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 font-mono">
                    {aprData ? (aprData.bucketB_apr * 100).toFixed(2) + '%' : '—'}
                  </span>
                  {aprData && !aprData.bucketB_isEstimated && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200 uppercase tracking-wider">LIVE</span>
                  )}
                  {aprData?.bucketB_isEstimated && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200 uppercase tracking-wider">EST.</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Risk Profile</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Self-deployed EIP-4626 vault accepting Circle USDC with no whitelist requirement. Virtual per-block yield accrual. Withdrawals are capped by real USDC balance. Testnet only.
              </p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <a href={`https://sepolia.etherscan.io/address/${sepoliaConfig.ltvVault.vault}#code`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
              View Verified Contract on Etherscan <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
        </div>
      </div>

      {/* Configuration Validation */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-400 text-[20px]">fact_check</span>
            <h3 className="text-lg font-bold text-slate-900">Configuration Validation</h3>
          </div>
          {configValidation && (
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border",
              configValidation.isValid
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            )}>
              {configValidation.isValid ? 'ALL CHECKS PASSED' : 'ISSUES DETECTED'}
            </span>
          )}
        </div>

        {configValidation ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Check</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {configValidation.checks.map((check, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">{check.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{check.description}</td>
                      <td className="px-4 py-3">{statusBadge(check.status)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{check.details ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 font-mono">
              Last validated: {new Date(configValidation.validatedAt).toLocaleString()}
            </p>
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-slate-400">Validation in progress...</p>
          </div>
        )}
      </div>
    </div>
  );
}

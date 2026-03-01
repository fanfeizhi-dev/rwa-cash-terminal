import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useAppStore } from '../store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: 'grid_view' },
  { name: 'Build Plan', path: '/terminal/build', icon: 'architecture' },
  { name: 'Risk Passport', path: '/terminal/passport', icon: 'verified_user' },
  { name: 'Receipt Gallery', path: '/terminal/receipts', icon: 'receipt_long' },
  { name: 'Protocol Directory', path: '/terminal/protocols', icon: 'menu_book' },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadReceipts = useAppStore((s) => s.loadReceipts);
  const fetchAprs = useAppStore((s) => s.fetchAprs);
  const fetchPositions = useAppStore((s) => s.fetchPositions);
  const fetchRiskData = useAppStore((s) => s.fetchRiskData);
  const checkEligibilityAction = useAppStore((s) => s.checkEligibility);
  const validateConfig = useAppStore((s) => s.validateConfig);
  const fetchPortfolioHistory = useAppStore((s) => s.fetchPortfolioHistory);
  const configValidation = useAppStore((s) => s.configValidation);

  const [toast, setToast] = useState<string | null>(null);
  const prevAddressRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    fetchAprs();
    fetchRiskData();
    validateConfig();
  }, [fetchAprs, fetchRiskData, validateConfig]);

  useEffect(() => {
    if (address) {
      loadReceipts(address);
      fetchPositions(address);
      checkEligibilityAction(address);
      fetchPortfolioHistory(address);
      if (prevAddressRef.current && prevAddressRef.current !== address) {
        const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
        setToast(`Wallet switched. Accessing records for ${short}...`);
        setTimeout(() => setToast(null), 4000);
      }
      prevAddressRef.current = address;
    } else {
      prevAddressRef.current = undefined;
    }
  }, [address, loadReceipts, fetchPositions, checkEligibilityAction, fetchPortfolioHistory]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setShowWalletDropdown(false);
    }
  }, []);

  useEffect(() => {
    if (showWalletDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWalletDropdown, handleClickOutside]);

  const handleCopyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const avatarColors = address
    ? { c1: address.slice(2, 8), c2: address.slice(8, 14) }
    : null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full shadow-2xl text-sm font-semibold border border-slate-700 animate-fade-in">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">swap_horiz</span>
          <span className="font-mono">{toast}</span>
        </div>
      )}
      <aside className="flex flex-col w-72 h-full bg-black border-r border-slate-800 shadow-xl z-20 shrink-0">
        <div className="flex flex-col h-full justify-between p-6">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col px-2">
              <h1 className="text-white text-lg font-bold tracking-tight leading-normal">RWA-TERMINAL</h1>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mt-1">Institutional Terminal</p>
            </div>
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                      isActive
                        ? 'bg-white text-black shadow-lg shadow-white/10 hover:translate-x-1'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                    )}
                  >
                    <span className={cn("material-symbols-outlined", isActive && "fill-1")}>{item.icon}</span>
                    <p className="text-sm font-semibold">{item.name}</p>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="px-2 pt-6 border-t border-slate-800">
            <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-900 transition-colors group">
              {isConnected && address ? (
                <>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white overflow-hidden border-2 border-slate-700 group-hover:border-white transition-colors"
                    style={{ background: `linear-gradient(135deg, #${avatarColors!.c1}, #${avatarColors!.c2})` }}
                  />
                  <div className="flex flex-col items-start">
                    <p className="font-mono text-white text-sm font-medium">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </p>
                    <p className="text-emerald-500 text-xs flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>
                      Connected
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-700 group-hover:border-white transition-colors">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">account_balance_wallet</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <p className="text-slate-400 text-sm font-medium">Not Connected</p>
                    <p className="text-slate-500 text-xs">Connect wallet to start</p>
                  </div>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
        <header className="flex items-center justify-between px-8 py-5 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-slate-900 font-bold text-sm tracking-wide">
              RWA-TERMINAL <span className="text-slate-400 font-normal mx-2">|</span> Institutional Terminal
            </h2>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "w-2 h-2 rounded-full",
                configValidation?.isValid ? "bg-emerald-500" :
                configValidation ? "bg-red-500 animate-pulse" : "bg-slate-300"
              )}></span>
              <span className="text-[10px] text-slate-500 font-medium">
                {configValidation?.isValid ? 'Config OK' : configValidation ? 'Config Issue' : 'Validating...'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center rounded-full h-9 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-semibold transition-colors">
              <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
              <span>Ethereum Sepolia</span>
            </button>
            {isConnected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAddress}
                  className="flex items-center justify-center rounded-full h-9 px-6 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-sm font-bold transition-all transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px] mr-2">
                    {copied ? 'done' : 'check_circle'}
                  </span>
                  <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </button>
                <button
                  onClick={() => disconnect()}
                  className="rounded-full h-9 w-9 flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                </button>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowWalletDropdown((v) => !v)}
                  className="flex items-center justify-center rounded-full h-9 px-6 bg-black text-white hover:bg-slate-800 shadow-md shadow-black/20 text-sm font-bold transition-all transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px] mr-2">account_balance_wallet</span>
                  <span>Connect Wallet</span>
                </button>
                {showWalletDropdown && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-lg p-4 w-[320px] z-50">
                    <p className="text-sm font-bold text-slate-900 pb-3 mb-3 border-b border-slate-100">Connect Wallet</p>
                    <button
                      className="flex items-center gap-3 p-3 w-full rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200"
                      onClick={() => {
                        connect({ connector: injected() });
                        setShowWalletDropdown(false);
                      }}
                    >
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                        alt="MetaMask"
                        className="w-10 h-10"
                      />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-bold text-slate-900">MetaMask</span>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 ml-auto">chevron_right</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
};

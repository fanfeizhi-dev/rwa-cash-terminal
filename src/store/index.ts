import { create } from 'zustand';
import { AllocationInput, AllocationPlan, Receipt } from '../types';
import { calculateAllocation } from '../packages/allocation-engine';
import { computePassportHash } from '../utils/passportHash';
import { fetchProtocolAprs, ProtocolAprData, FALLBACK_APR_A, FALLBACK_APR_B } from '../utils/protocolData';
import { fetchPositions as fetchOnChainPositions, OnChainPositions } from '../utils/onChainPositions';
import { RiskConfig } from '../config/riskDefaults';
import { AllocationEngineConfig, DEFAULT_ALLOCATION_CONFIG } from '../config/allocationConfig';
import { fetchRiskData as fetchRiskDataFromProvider } from '../utils/riskDataProvider';
import { checkEligibility as checkEligibilityUtil, EligibilityResult } from '../utils/eligibilityCheck';
import { fetchPortfolioHistory as fetchPortfolioHistoryUtil, PortfolioHistory, persistPositionSnapshot } from '../utils/portfolioHistory';
import { validateConfig as validateConfigUtil, ValidationResult } from '../utils/configValidator';

interface AppState {
  inputs: AllocationInput;
  plan: AllocationPlan | null;
  receipts: Receipt[];
  aprData: ProtocolAprData | null;
  positions: OnChainPositions | null;
  riskConfig: RiskConfig | null;
  eligibilityStatus: EligibilityResult | null;
  engineConfig: AllocationEngineConfig;
  portfolioHistory: PortfolioHistory | null;
  configValidation: ValidationResult | null;
  setInputs: (inputs: Partial<AllocationInput>) => void;
  generatePlan: () => Promise<void>;
  addReceipt: (receipt: Receipt) => void;
  loadReceipts: (address: string) => void;
  fetchAprs: () => Promise<void>;
  fetchPositions: (address: string) => Promise<void>;
  fetchRiskData: () => Promise<void>;
  checkEligibility: (address: string) => Promise<void>;
  fetchPortfolioHistory: (address: string) => Promise<void>;
  validateConfig: () => Promise<void>;
}

const STORAGE_PREFIX = 'rwa_receipts_';

function readReceiptsFromStorage(address: string): Receipt[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${address.toLowerCase()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReceiptsToStorage(address: string, receipts: Receipt[]): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${address.toLowerCase()}`,
      JSON.stringify(receipts)
    );
  } catch (e) {
    console.error('Failed to persist receipts:', e);
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  inputs: {
    amount: 20,
    riskProfile: 'balanced',
    exitWindow: 'T3',
    eligibility: 'eligible',
    marketRegime: 'normal',
  },
  plan: null,
  receipts: [],
  aprData: null,
  positions: null,
  riskConfig: null,
  eligibilityStatus: null,
  engineConfig: DEFAULT_ALLOCATION_CONFIG,
  portfolioHistory: null,
  configValidation: null,
  setInputs: (newInputs) => {
    set((state) => ({ inputs: { ...state.inputs, ...newInputs } }));
    get().generatePlan();
  },
  generatePlan: async () => {
    const { inputs, aprData, riskConfig, engineConfig } = get();
    const bucketA_apr = aprData?.bucketA_apr ?? FALLBACK_APR_A;
    const bucketB_apr = aprData?.bucketB_apr ?? FALLBACK_APR_B;

    const plan = calculateAllocation(inputs, bucketA_apr, bucketB_apr, riskConfig ?? undefined, engineConfig);
    plan.generatedAt = new Date().toISOString();

    plan.aprSources = {
      bucketA: { value: bucketA_apr, isEstimated: aprData?.bucketA_isEstimated ?? true },
      bucketB: { value: bucketB_apr, isEstimated: aprData?.bucketB_isEstimated ?? true },
      fetchedAt: aprData?.fetchedAt,
    };

    if (riskConfig?.sourceDetails) {
      plan.passport.riskDataSources = riskConfig.sourceDetails;
    }

    plan.passport.hash = await computePassportHash(plan);
    set({ plan });
  },
  addReceipt: (receipt) => {
    const updated = [...get().receipts, receipt];
    set({ receipts: updated });
    writeReceiptsToStorage(receipt.wallet, updated);
  },
  loadReceipts: (address) => {
    const receipts = readReceiptsFromStorage(address);
    set({ receipts });
  },
  fetchAprs: async () => {
    const aprData = await fetchProtocolAprs();
    set({ aprData });
    await get().generatePlan();
  },
  fetchPositions: async (address) => {
    const positions = await fetchOnChainPositions(address as `0x${string}`);
    set({ positions });
    if (positions.isLoaded && !positions.isError) {
      persistPositionSnapshot(address, positions);
    }
  },
  fetchRiskData: async () => {
    try {
      const { positions } = get();
      const result = await fetchRiskDataFromProvider(positions);
      set({ riskConfig: result.config });
      await get().generatePlan();
    } catch (e) {
      console.warn('Failed to fetch risk data:', e);
    }
  },
  checkEligibility: async (address) => {
    try {
      const result = await checkEligibilityUtil(address as `0x${string}`);
      set({ eligibilityStatus: result });

      const { inputs } = get();
      const newEligibility = result.isEligible ? 'eligible' : 'not_eligible';
      if (result.source !== 'user_input' && inputs.eligibility !== newEligibility) {
        set((state) => ({
          inputs: {
            ...state.inputs,
            eligibility: newEligibility,
            eligibilitySource: result.source,
          },
        }));
        get().generatePlan();
      } else if (!inputs.eligibilitySource) {
        set((state) => ({
          inputs: { ...state.inputs, eligibilitySource: result.source },
        }));
      }
    } catch (e) {
      console.warn('Failed to check eligibility:', e);
    }
  },
  fetchPortfolioHistory: async (address) => {
    const { positions } = get();
    const history = await fetchPortfolioHistoryUtil(address as `0x${string}`, positions);
    set({ portfolioHistory: history });
  },
  validateConfig: async () => {
    try {
      const result = await validateConfigUtil();
      set({ configValidation: result });
    } catch (e) {
      console.warn('Config validation failed:', e);
    }
  },
}));

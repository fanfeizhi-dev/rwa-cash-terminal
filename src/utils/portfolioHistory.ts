import { OnChainPositions } from './onChainPositions';
import sepoliaConfig from '../config/sepolia.json';

export interface PortfolioHistoryPoint {
  timestamp: string;
  totalValueUsd: number;
  bucketAValueUsd: number;
  bucketBValueUsd: number;
  bucketASplit: number;
  bucketBSplit: number;
  bptPriceUsd?: number;
}

export interface PortfolioHistory {
  points: PortfolioHistoryPoint[];
  source: 'subgraph' | 'local_snapshots' | 'empty';
  fetchedAt: string;
  rangeLabel: string;
}

const HISTORY_PREFIX = 'rwa_history_';
const MAX_SNAPSHOTS = 90;

interface StoredSnapshot {
  timestamp: string;
  totalValueUsd: number;
  bucketASplit: number;
  bucketBSplit: number;
  bptBalance: number;
  vaultAssetValue: number;
  bptPriceUsd: number;
}

function readSnapshots(address: string): StoredSnapshot[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_PREFIX}${address.toLowerCase()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSnapshots(address: string, snapshots: StoredSnapshot[]): void {
  try {
    localStorage.setItem(
      `${HISTORY_PREFIX}${address.toLowerCase()}`,
      JSON.stringify(snapshots),
    );
  } catch (e) {
    console.warn('Failed to persist portfolio snapshot:', e);
  }
}

export function persistPositionSnapshot(
  address: string,
  positions: OnChainPositions,
): void {
  if (!positions.isLoaded || positions.isError || positions.totalValueUsd === 0) return;

  const snapshots = readSnapshots(address);
  const today = new Date().toISOString().slice(0, 10);
  const alreadyHasToday = snapshots.some(s => s.timestamp.slice(0, 10) === today);
  if (alreadyHasToday) return;

  snapshots.push({
    timestamp: new Date().toISOString(),
    totalValueUsd: positions.totalValueUsd,
    bucketASplit: positions.bucketASplit,
    bucketBSplit: positions.bucketBSplit,
    bptBalance: positions.bptBalance,
    vaultAssetValue: positions.vaultAssetValue,
    bptPriceUsd: positions.bptPriceUsd ?? 1,
  });

  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
  }

  writeSnapshots(address, snapshots);
}

async function fetchSubgraphHistory(
  poolId: string,
): Promise<PortfolioHistoryPoint[] | null> {
  try {
    const response = await fetch('https://api-v3.balancer.fi/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          poolGetPool(id: "${poolId}", chain: SEPOLIA) {
            dynamicData {
              totalLiquidity
              totalShares
            }
            snapshots(range: THIRTY_DAYS) {
              timestamp
              totalLiquidity
              volume24h
              fees24h
              totalShares
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await response.json();
    const snapshots = json?.data?.poolGetPool?.snapshots;
    if (!Array.isArray(snapshots) || snapshots.length < 2) return null;

    return snapshots.map((s: any) => {
      const tvl = Number(s.totalLiquidity) || 0;
      return {
        timestamp: new Date(Number(s.timestamp) * 1000).toISOString(),
        totalValueUsd: tvl,
        bucketAValueUsd: tvl * 0.5,
        bucketBValueUsd: tvl * 0.5,
        bucketASplit: 0.5,
        bucketBSplit: 0.5,
        bptPriceUsd: Number(s.totalShares) > 0 ? tvl / Number(s.totalShares) : undefined,
      };
    });
  } catch {
    return null;
  }
}

function localSnapshotsToHistory(
  address: string,
  rangeDays: number,
): PortfolioHistoryPoint[] {
  const snapshots = readSnapshots(address);
  const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;

  return snapshots
    .filter(s => new Date(s.timestamp).getTime() >= cutoff)
    .map(s => ({
      timestamp: s.timestamp,
      totalValueUsd: s.totalValueUsd,
      bucketAValueUsd: s.totalValueUsd * s.bucketASplit,
      bucketBValueUsd: s.totalValueUsd * s.bucketBSplit,
      bucketASplit: s.bucketASplit,
      bucketBSplit: s.bucketBSplit,
      bptPriceUsd: s.bptPriceUsd,
    }));
}

export async function fetchPortfolioHistory(
  address: `0x${string}`,
  positions: OnChainPositions | null,
): Promise<PortfolioHistory> {
  const fetchedAt = new Date().toISOString();

  // Strategy 1: Try subgraph
  try {
    const subgraphPoints = await fetchSubgraphHistory(sepoliaConfig.balancer.poolId);
    if (subgraphPoints && subgraphPoints.length >= 2) {
      return {
        points: subgraphPoints,
        source: 'subgraph',
        fetchedAt,
        rangeLabel: 'Last 30 days',
      };
    }
  } catch {
    // fall through to local
  }

  // Strategy 2: Local snapshots
  const localPoints = localSnapshotsToHistory(address, 90);

  // Add current position as the latest point if available
  if (positions?.isLoaded && !positions.isError && positions.totalValueUsd > 0) {
    const lastTimestamp = localPoints.length > 0 ? localPoints[localPoints.length - 1].timestamp : '';
    const today = new Date().toISOString().slice(0, 10);
    if (!lastTimestamp || lastTimestamp.slice(0, 10) !== today) {
      localPoints.push({
        timestamp: new Date().toISOString(),
        totalValueUsd: positions.totalValueUsd,
        bucketAValueUsd: positions.totalValueUsd * positions.bucketASplit,
        bucketBValueUsd: positions.totalValueUsd * positions.bucketBSplit,
        bucketASplit: positions.bucketASplit,
        bucketBSplit: positions.bucketBSplit,
        bptPriceUsd: positions.bptPriceUsd,
      });
    }
  }

  if (localPoints.length >= 2) {
    return {
      points: localPoints,
      source: 'local_snapshots',
      fetchedAt,
      rangeLabel: `Last ${Math.min(localPoints.length, 90)} days`,
    };
  }

  return {
    points: localPoints,
    source: 'empty',
    fetchedAt,
    rangeLabel: 'No data',
  };
}

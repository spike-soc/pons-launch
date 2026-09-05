import { useEffect, useMemo } from 'react';
import { type Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { curveAbi, factoryAbi, launcherTokenAbi } from '../constants/abis';
import {
  getFactoryAddress,
  MEME_TOKEN_ADDRESSES
} from '../constants/contracts';
import launchesJson from '../../json/pons-launches.json';

export type MemeLaunchCardData = {
  token: Address;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  deployer: string;
  graduated: boolean;
  progressPct: number;
  marketCapUsd: number | null;
  latestBuyAt: string | null;
  exists: boolean;
  loading: boolean;
};

type IndexedLaunch = {
  token?: string;
  name?: string;
  symbol?: string;
  logo?: string;
  description?: string;
  deployer?: string;
  graduated?: boolean;
  graduationProgressPct?: number;
  marketCapUsd?: number | null;
  latestBuyAt?: string | null;
};

type LaunchedTokenResult = {
  token: Address;
  curve: Address;
  deployer: Address;
  graduationThreshold: bigint;
  phase: number;
  exists: boolean;
};

function asLaunchedToken(value: unknown): LaunchedTokenResult | null {
  if (value == null) return null;

  if (Array.isArray(value)) {
    return {
      token: value[0] as Address,
      curve: value[1] as Address,
      deployer: value[2] as Address,
      graduationThreshold: BigInt(value[5] as bigint),
      phase: Number(value[10]),
      exists: Boolean(value[14]),
    };
  }

  const row = value as Record<string, unknown>;
  if (row.exists === undefined) return null;
  return {
    token: row.token as Address,
    curve: row.curve as Address,
    deployer: row.deployer as Address,
    graduationThreshold: BigInt(row.graduationThreshold as bigint),
    phase: Number(row.phase),
    exists: Boolean(row.exists),
  };
}

function indexLaunches() {
  const map = new Map<string, IndexedLaunch>();
  const buckets = [
    launchesJson.active?.items,
    (launchesJson as { graduated?: { items?: IndexedLaunch[] } }).graduated
      ?.items,
  ];
  for (const items of buckets) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item?.token) continue;
      map.set(item.token.toLowerCase(), item);
    }
  }
  return map;
}

const indexedLaunches = indexLaunches();
const factoryAddress = getFactoryAddress();

export function useMemeLaunchCards() {
  const tokens = useMemo(() => [...MEME_TOKEN_ADDRESSES] as Address[], []);

  const launchReads = useReadContracts({
    contracts: tokens.map((token) => ({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: 'getLaunchedToken' as const,
      args: [token] as const,
    })),
    query: { enabled: tokens.length > 0 },
  });

  const launched = useMemo(
    () => (launchReads.data ?? []).map((row) => asLaunchedToken(row.result)),
    [launchReads.data]
  );

  useEffect(() => {
    tokens.forEach((token, index) => {
      const raw = launchReads.data?.[index];
      console.log(token, '==>', raw?.result ?? raw);
    });
  }, [tokens, launchReads.data]);

  const metaReads = useReadContracts({
    contracts: tokens.flatMap((token) => [
      { address: token, abi: launcherTokenAbi, functionName: 'name' as const },
      {
        address: token,
        abi: launcherTokenAbi,
        functionName: 'symbol' as const,
      },
      {
        address: token,
        abi: launcherTokenAbi,
        functionName: 'getTokenInfo' as const,
      },
    ]),
    query: { enabled: tokens.length > 0 },
  });

  const curveAddresses = useMemo(
    () => launched.map((row) => (row?.exists ? row.curve : undefined)),
    [launched],
  );

  const progressReads = useReadContracts({
    contracts: curveAddresses.flatMap((curve) =>
      curve
        ? [
            {
              address: curve,
              abi: curveAbi,
              functionName: 'realQuoteReserve' as const,
            },
            {
              address: curve,
              abi: curveAbi,
              functionName: 'graduationThreshold' as const,
            },
            {
              address: curve,
              abi: curveAbi,
              functionName: 'graduated' as const,
            },
          ]
        : [],
    ),
    query: { enabled: curveAddresses.some(Boolean) },
  });

  const cards = useMemo(() => {
    let progressOffset = 0;

    return tokens.map((token, index) => {
      const indexed = indexedLaunches.get(token.toLowerCase());
      const launch = launched[index];
      const nameResult = metaReads.data?.[index * 3]?.result as
        | string
        | undefined;
      const symbolResult = metaReads.data?.[index * 3 + 1]?.result as
        | string
        | undefined;
      const infoResult = metaReads.data?.[index * 3 + 2]?.result as
        | readonly [Address, string, string, unknown]
        | undefined;

      let progressPct = indexed?.graduationProgressPct ?? 0;
      let graduated =
        Boolean(indexed?.graduated) || (launch ? launch.phase >= 2 : false);

      if (launch?.exists) {
        const raised = progressReads.data?.[progressOffset]?.result as
          | bigint
          | undefined;
        const threshold =
          (progressReads.data?.[progressOffset + 1]?.result as
            | bigint
            | undefined) ?? launch.graduationThreshold;
        const curveGraduated = Boolean(
          progressReads.data?.[progressOffset + 2]?.result,
        );
        progressOffset += 3;

        if (curveGraduated || launch.phase >= 2) {
          graduated = true;
          progressPct = 100;
        } else if (raised !== undefined && threshold > 0n) {
          progressPct = Math.min(
            100,
            (Number(raised) / Number(threshold)) * 100,
          );
        }
      }

      const card: MemeLaunchCardData = {
        token,
        name: nameResult || indexed?.name || 'Unknown',
        symbol: symbolResult || indexed?.symbol || 'TOKEN',
        logo: infoResult?.[1] || indexed?.logo || '',
        description: infoResult?.[2] || indexed?.description || '',
        deployer: launch?.deployer || indexed?.deployer || '',
        graduated,
        progressPct,
        marketCapUsd: indexed?.marketCapUsd ?? null,
        latestBuyAt: indexed?.latestBuyAt ?? null,
        exists: Boolean(launch?.exists ?? indexed),
        loading:
          launchReads.isLoading ||
          metaReads.isLoading ||
          progressReads.isLoading,
      };
      return card;
    });
  }, [
    tokens,
    launched,
    metaReads.data,
    progressReads.data,
    launchReads.isLoading,
    metaReads.isLoading,
    progressReads.isLoading,
  ]);

  return {
    tokens,
    cards,
    isLoading: launchReads.isLoading || metaReads.isLoading,
  };
}

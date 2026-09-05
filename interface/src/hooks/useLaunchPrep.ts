import { useMemo } from 'react';
import { formatEther, type Address, zeroAddress } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { factoryAbi } from '../constants/abis';
import { getFactoryAddress } from '../constants/contracts';

export type LaunchConfigView = {
  id: bigint;
  supply: bigint;
  curveFeeBps: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  poolFee: number;
  tickSpacing: number;
  enabled: boolean;
};

type UseLaunchPrepArgs = {
  account?: string;
  /** Prefer this id when it exists and is enabled; otherwise first open config. */
  preferredLaunchConfigId?: bigint;
  pairToken?: Address;
};

export function useLaunchPrep({
  account,
  preferredLaunchConfigId = 0n,
  pairToken = zeroAddress
}: UseLaunchPrepArgs) {
  const factory = getFactoryAddress();
  const owner = account as Address | undefined;

  const { data: launchFee, isLoading: feeLoading } = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: 'launchFee'
  });

  const { data: configCount } = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: 'launchConfigCount'
  });

  const { data: maxCreatorTaxBps } = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: 'maxCreatorTaxBps'
  });

  const { data: canLaunch, isLoading: canLaunchLoading } = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: 'canLaunch',
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(owner) }
  });

  const count = Number(configCount ?? 0n);
  const { data: configRows, isLoading: configsLoading } = useReadContracts({
    contracts: Array.from({ length: count }, (_, id) => ({
      address: factory,
      abi: factoryAbi,
      functionName: 'getLaunchConfig' as const,
      args: [BigInt(id)] as const
    })),
    query: { enabled: count > 0 }
  });

  const configs = useMemo(() => {
    if (!configRows) return [] as LaunchConfigView[];
    return configRows.flatMap((row, id) => {
      if (row.status !== 'success' || row.result == null) return [];
      const value = row.result as unknown;

      let parsed: Omit<LaunchConfigView, 'id'>;
      if (Array.isArray(value)) {
        parsed = {
          supply: value[0] as bigint,
          curveFeeBps: value[1] as bigint,
          phantomQuote: value[2] as bigint,
          graduationThreshold: value[3] as bigint,
          poolFee: Number(value[4]),
          tickSpacing: Number(value[5]),
          enabled: Boolean(value[6])
        };
      } else {
        const obj = value as {
          supply: bigint;
          curveFeeBps: bigint;
          phantomQuote: bigint;
          graduationThreshold: bigint;
          poolFee: number;
          tickSpacing: number;
          enabled: boolean;
        };
        parsed = {
          supply: obj.supply,
          curveFeeBps: obj.curveFeeBps,
          phantomQuote: obj.phantomQuote,
          graduationThreshold: obj.graduationThreshold,
          poolFee: obj.poolFee,
          tickSpacing: obj.tickSpacing,
          enabled: obj.enabled
        };
      }

      return [{ id: BigInt(id), ...parsed }];
    });
  }, [configRows]);

  const openConfigs = useMemo(() => configs.filter((c) => c.enabled), [configs]);

  const selectedConfig = useMemo(() => {
    const preferred = openConfigs.find((c) => c.id === preferredLaunchConfigId);
    return preferred ?? openConfigs[0];
  }, [openConfigs, preferredLaunchConfigId]);

  const selectedConfigId = selectedConfig?.id;

  const {
    data: expectedEconomics,
    isLoading: economicsLoading,
    refetch: refetchEconomics
  } = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: 'previewLaunchEconomics',
    args:
      selectedConfigId !== undefined
        ? [selectedConfigId, pairToken]
        : undefined,
    query: { enabled: selectedConfigId !== undefined }
  });

  return {
    factory,
    launchFee,
    launchFeeEth: launchFee !== undefined ? formatEther(launchFee) : undefined,
    maxCreatorTaxBps: maxCreatorTaxBps !== undefined ? Number(maxCreatorTaxBps) : undefined,
    canLaunch: Boolean(canLaunch),
    expectedEconomics: expectedEconomics as `0x${string}` | undefined,
    configs,
    openConfigs,
    selectedConfig,
    isLoading: feeLoading || canLaunchLoading || economicsLoading || configsLoading,
    refetchEconomics
  };
}

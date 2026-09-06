import { useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { curveAbi } from '../constants/abis';
import {
  quoteBuyFromState,
  type CurveQuoteState,
  type QuoteBuyResult
} from '../lib/quoteBuy';

type UseCurveBuyQuoteArgs = {
  curve?: Address | null;
  recipient?: Address;
  quoteIn: bigint;
  enabled?: boolean;
};

function asBigint(value: unknown, fallback = 0n): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  return fallback;
}

export function useCurveBuyQuote({
  curve,
  recipient,
  quoteIn,
  enabled = true
}: UseCurveBuyQuoteArgs) {
  const curveAddress = curve && curve !== zeroAddress ? curve : undefined;
  const ready = Boolean(enabled && curveAddress);

  const coreReads = useReadContracts({
    contracts: curveAddress
      ? [
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'getReserves' as const
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'sellableTokens' as const
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'feeBps' as const
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'creatorTaxBps' as const
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'realQuoteReserve' as const
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'graduationThreshold' as const
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'graduated' as const
          }
        ]
      : [],
    query: { enabled: ready }
  });

  const snipeRead = useReadContract({
    address: curveAddress,
    abi: curveAbi,
    functionName: 'currentSnipeTaxBps',
    args: recipient ? [recipient] : undefined,
    query: {
      enabled: ready && Boolean(recipient),
      retry: false
    }
  });

  const state: CurveQuoteState | null = useMemo(() => {
    const rows = coreReads.data;
    if (!rows || rows.length < 4) return null;

    const reservesRow = rows[0];
    const sellableRow = rows[1];
    const feeRow = rows[2];
    const creatorTaxRow = rows[3];

    if (!reservesRow || reservesRow.status !== 'success' || reservesRow.result == null) {
      return null;
    }

    const reserves = reservesRow.result as readonly [bigint, bigint];
    return {
      quoteReserve: asBigint(reserves[0]),
      tokenReserve: asBigint(reserves[1]),
      sellable: asBigint(
        sellableRow?.status === 'success' ? sellableRow.result : 0n
      ),
      feeBps: asBigint(feeRow?.status === 'success' ? feeRow.result : 0n),
      creatorTaxBps: asBigint(
        creatorTaxRow?.status === 'success' ? creatorTaxRow.result : 0n
      ),
      snipeBps:
        snipeRead.isSuccess && snipeRead.data != null
          ? asBigint(snipeRead.data)
          : 0n
    };
  }, [coreReads.data, snipeRead.data, snipeRead.isSuccess]);

  const quote: QuoteBuyResult | null = useMemo(() => {
    if (!state) return null;
    return quoteBuyFromState(quoteIn, state);
  }, [state, quoteIn]);

  const raised = asBigint(
    coreReads.data?.[4]?.status === 'success'
      ? coreReads.data[4].result
      : 0n
  );
  const graduationThreshold = asBigint(
    coreReads.data?.[5]?.status === 'success'
      ? coreReads.data[5].result
      : 0n
  );
  const graduated = Boolean(
    coreReads.data?.[6]?.status === 'success'
      ? coreReads.data[6].result
      : false
  );

  const progressPct =
    graduationThreshold > 0n
      ? Math.min(100, (Number(raised) / Number(graduationThreshold)) * 100)
      : 0;

  return {
    state,
    quote,
    raised,
    graduationThreshold,
    progressPct,
    graduated,
    isLoading: coreReads.isLoading,
    isError: coreReads.isError,
    refetch: coreReads.refetch
  };
}

import { useEffect, useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { curveAbi } from '../constants/abis';
import { robinhoodChain } from '../constants/chain';
import { logContractRead } from '../lib/contractDebug';
import {
  quoteSellFromState,
  type CurveSellQuoteState,
  type QuoteSellResult
} from '../lib/quoteSell';

type UseCurveSellQuoteArgs = {
  curve?: Address | null;
  tokensIn: bigint;
  enabled?: boolean;
};

function asBigint(value: unknown, fallback = 0n): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  return fallback;
}

export function useCurveSellQuote({
  curve,
  tokensIn,
  enabled = true
}: UseCurveSellQuoteArgs) {
  const curveAddress = curve && curve !== zeroAddress ? curve : undefined;
  const ready = Boolean(enabled && curveAddress);

  const coreReads = useReadContracts({
    contracts: curveAddress
      ? [
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'getReserves' as const,
            chainId: robinhoodChain.id
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'feeBps' as const,
            chainId: robinhoodChain.id
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'creatorTaxBps' as const,
            chainId: robinhoodChain.id
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'readyToGraduate' as const,
            chainId: robinhoodChain.id
          },
          {
            address: curveAddress,
            abi: curveAbi,
            functionName: 'graduated' as const,
            chainId: robinhoodChain.id
          }
        ]
      : [],
    query: { enabled: ready }
  });

  useEffect(() => {
    if (!ready || !curveAddress || !coreReads.data) return;

    const rows = coreReads.data;
    const readRows = [
      {
        method: 'Curve.getReserves',
        row: rows[0],
        fields: {
          quoteReserve: '定价用 quote 储备，包含 phantomQuote',
          tokenReserve: '定价用 token 储备',
          display: '卖出 quote 的恒定乘积公式输入'
        }
      },
      {
        method: 'Curve.feeBps',
        row: rows[1],
        fields: {
          return: '基础交易费率，bps 计价',
          display: '从卖出得到的 grossQuoteOut 中扣除'
        }
      },
      {
        method: 'Curve.creatorTaxBps',
        row: rows[2],
        fields: {
          return: 'creator 额外税率，bps 计价',
          display: '从卖出得到的 grossQuoteOut 中扣除'
        }
      },
      {
        method: 'Curve.readyToGraduate',
        row: rows[3],
        fields: {
          return: '是否已达到毕业条件但未完成迁移',
          display: 'true 时关闭 sell，避免即将毕业状态继续交易'
        }
      },
      {
        method: 'Curve.graduated',
        row: rows[4],
        fields: {
          return: '是否已经毕业',
          display: 'true 时关闭 sell'
        }
      }
    ];

    for (const item of readRows) {
      logContractRead({
        scope: 'CurveSellQuote',
        contract: curveAddress,
        method: item.method,
        row: item.row,
        fields: item.fields
      });
    }
  }, [ready, curveAddress, coreReads.data]);

  const state: CurveSellQuoteState | null = useMemo(() => {
    const rows = coreReads.data;
    if (!rows || rows.length < 3) return null;

    const reservesRow = rows[0];
    const feeRow = rows[1];
    const creatorTaxRow = rows[2];

    if (!reservesRow || reservesRow.status !== 'success' || reservesRow.result == null) {
      return null;
    }

    const reserves = reservesRow.result as readonly [bigint, bigint];

    return {
      quoteReserve: asBigint(reserves[0]),
      tokenReserve: asBigint(reserves[1]),
      feeBps: asBigint(feeRow?.status === 'success' ? feeRow.result : 0n),
      creatorTaxBps: asBigint(
        creatorTaxRow?.status === 'success' ? creatorTaxRow.result : 0n
      )
    };
  }, [coreReads.data]);

  const readyToGraduate = Boolean(
    coreReads.data?.[3]?.status === 'success' ? coreReads.data[3].result : false
  );
  const graduated = Boolean(
    coreReads.data?.[4]?.status === 'success' ? coreReads.data[4].result : false
  );
  const isSellClosed = graduated || readyToGraduate;

  const quote: QuoteSellResult | null = useMemo(() => {
    if (!state || isSellClosed) return null;
    return quoteSellFromState(tokensIn, state);
  }, [state, tokensIn, isSellClosed]);

  return {
    state,
    quote,
    readyToGraduate,
    graduated,
    isSellClosed,
    isLoading: coreReads.isLoading,
    isError: coreReads.isError,
    refetch: coreReads.refetch
  };
}

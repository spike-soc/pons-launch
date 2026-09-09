import { useEffect, useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { curveAbi } from '../constants/abis';
import { logContractRead } from '../lib/contractDebug';
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

  useEffect(() => {
    if (!ready || !curveAddress || !coreReads.data) return;

    const rows = coreReads.data;
    const readRows = [
      {
        method: 'Curve.getReserves',
        row: rows[0],
        fields: {
          quoteReserve: '定价用 quote 储备，包含 phantomQuote，不等于真实余额',
          tokenReserve: '定价用 token 储备',
          display: '买入 quote 的恒定乘积公式输入'
        }
      },
      {
        method: 'Curve.sellableTokens',
        row: rows[1],
        fields: {
          return: '曲线上还能卖出的 token 数量上限',
          display: '买入 quote 结果超过该值时会钳制并计算 refund'
        }
      },
      {
        method: 'Curve.feeBps',
        row: rows[2],
        fields: {
          return: '基础交易费率，bps 计价，100 bps = 1%',
          display: '买入先扣费、卖出从 grossQuoteOut 中扣费'
        }
      },
      {
        method: 'Curve.creatorTaxBps',
        row: rows[3],
        fields: {
          return: 'creator 额外税率，bps 计价',
          display: '买入先扣 tax、卖出从 grossQuoteOut 中扣 tax'
        }
      },
      {
        method: 'Curve.realQuoteReserve',
        row: rows[4],
        fields: {
          return: '真实 quote 储备，不含 phantom',
          display: '毕业进度 raised，不能用于 AMM 定价'
        }
      },
      {
        method: 'Curve.graduationThreshold',
        row: rows[5],
        fields: {
          return: '毕业阈值',
          display: '毕业进度分母'
        }
      },
      {
        method: 'Curve.graduated',
        row: rows[6],
        fields: {
          return: '是否已经毕业',
          display: 'true 时关闭 buy'
        }
      },
      {
        method: 'Curve.currentSnipeTaxBps',
        args: recipient ? [recipient] : [],
        row: {
          status: snipeRead.isSuccess
            ? 'success'
            : snipeRead.isError
              ? 'error'
              : snipeRead.isLoading
                ? 'loading'
                : 'idle',
          result: snipeRead.data,
          error: snipeRead.error
        },
        fields: {
          recipient: '买入 token 接收地址',
          return: '该 recipient 当前适用的 sniper tax，bps 计价',
          display: '参与买入 quote 的 snipeTax 估算；读不到时前端按 0 处理'
        }
      }
    ];

    for (const item of readRows) {
      logContractRead({
        scope: 'CurveBuyQuote',
        contract: curveAddress,
        method: item.method,
        args: item.args,
        row: item.row,
        fields: item.fields
      });
    }
  }, [
    ready,
    curveAddress,
    recipient,
    coreReads.data,
    snipeRead.data,
    snipeRead.isSuccess,
    snipeRead.isError,
    snipeRead.isLoading,
    snipeRead.error
  ]);

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
    coreReads.data?.[4]?.status === 'success' ? coreReads.data[4].result : 0n
  );
  const graduationThreshold = asBigint(
    coreReads.data?.[5]?.status === 'success' ? coreReads.data[5].result : 0n
  );
  const graduated = Boolean(
    coreReads.data?.[6]?.status === 'success' ? coreReads.data[6].result : false
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

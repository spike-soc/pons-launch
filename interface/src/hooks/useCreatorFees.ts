import { useEffect, useMemo } from 'react';
import { type Address, getAddress, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { curveAbi, feeEscrowAbi } from '../constants/abis';
import { PONS_V2_ADDRESSES } from '../constants/contracts';
import { logContractRead } from '../lib/contractDebug';
import type { LaunchpadTokenDetail } from './useLaunchpadTokenDetail';

const BASIS_POINTS = 10_000n;
const NOT_GRADUATED_PHASE = 0;

type UseCreatorFeesArgs = {
  detail: LaunchpadTokenDetail | null;
  walletAddress?: string;
};

type UseReadContractsArgs = NonNullable<Parameters<typeof useReadContracts>[0]>;

function readBigint(value: unknown): bigint {
  return typeof value === 'bigint' ? value : 0n;
}

function readUint(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  return 0n;
}

function sameAddress(a: Address | string | undefined, b: Address | undefined) {
  if (!a || !b) return false;

  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return false;
  }
}

export function useCreatorFees({ detail, walletAddress }: UseCreatorFeesArgs) {
  const feeEscrow = PONS_V2_ADDRESSES.feeEscrow;
  const curve = detail?.curve && detail.curve !== zeroAddress ? detail.curve : undefined;
  const recipient = detail?.creatorFeeRecipient;
  const quoteToken =
    detail?.pairToken && detail.pairToken !== zeroAddress ? detail.pairToken : undefined;
  const isFeeRecipient = sameAddress(walletAddress, recipient);

  const reads = useReadContracts({
    contracts: (feeEscrow && curve && recipient
      ? [
          {
            address: feeEscrow,
            abi: feeEscrowAbi,
            functionName: 'balanceOf' as const,
            args: [recipient]
          },
          ...(quoteToken
            ? [
                {
                  address: feeEscrow,
                  abi: feeEscrowAbi,
                  functionName: 'balanceOfToken' as const,
                  args: [recipient, quoteToken]
                }
              ]
            : []),
          {
            address: curve,
            abi: curveAbi,
            functionName: 'quoteFeeBalance' as const
          },
          {
            address: curve,
            abi: curveAbi,
            functionName: 'creatorTaxBalance' as const
          },
          {
            address: curve,
            abi: curveAbi,
            functionName: 'buybackQuoteBalance' as const
          },
          {
            address: curve,
            abi: curveAbi,
            functionName: 'protocolFeeShareBps' as const
          }
        ]
      : []) as UseReadContractsArgs['contracts'],
    query: { enabled: Boolean(feeEscrow && curve && recipient) }
  });

  useEffect(() => {
    if (!feeEscrow || !curve || !recipient || !reads.data) return;

    const curveOffset = quoteToken ? 2 : 1;
    const readRows = [
      {
        contract: feeEscrow,
        method: 'FeeEscrow.balanceOf',
        args: [recipient],
        row: reads.data[0],
        fields: {
          recipient: '当前 creatorFeeRecipient 地址',
          return: '该 recipient 在 FeeEscrow 中可 claim 的原生 ETH 数量',
          display: 'Creator fees 卡片右侧 Claimable now'
        }
      },
      ...(quoteToken
        ? [
            {
              contract: feeEscrow,
              method: 'FeeEscrow.balanceOfToken',
              args: [recipient, quoteToken] as const,
              row: reads.data[1],
              fields: {
                recipient: '当前 creatorFeeRecipient 地址',
                token: 'ERC20 quote asset 地址',
                return: '该 recipient 在 FeeEscrow 中可 claim 的 ERC20 quote 数量',
                display: '非 ETH pair 时 Creator fees 卡片右侧 Claimable now'
              }
            }
          ]
        : []),
      {
        contract: curve,
        method: 'Curve.quoteFeeBalance',
        row: reads.data[curveOffset],
        fields: {
          return: 'Curve 尚未 sweep 的基础交易费总额，包含 protocol / buyback / creator 份额',
          display: '参与计算 Creator fees 卡片左侧 Earned'
        }
      },
      {
        contract: curve,
        method: 'Curve.creatorTaxBalance',
        row: reads.data[curveOffset + 1],
        fields: {
          return: 'Curve 尚未 sweep 的 creator tax，全部归 creatorFeeRecipient',
          display: '加到 Creator fees 卡片左侧 Earned'
        }
      },
      {
        contract: curve,
        method: 'Curve.buybackQuoteBalance',
        row: reads.data[curveOffset + 2],
        fields: {
          return: 'quoteFeeBalance 中已标记为 buyback and lock 的 creator 份额',
          display:
            '大于 0 时普通 creator 不能直接 collect，需要 sweep operator 带 minBuybackTokensOut 执行'
        }
      },
      {
        contract: curve,
        method: 'Curve.protocolFeeShareBps',
        row: reads.data[curveOffset + 3],
        fields: {
          return: '基础交易费中归协议的比例，bps 计价',
          formula:
            'creatorBaseFee = quoteFeeBalance - quoteFeeBalance * protocolFeeShareBps / 10000',
          display: '用于从 quoteFeeBalance 中扣掉协议份额后估算 creator pending'
        }
      }
    ];

    for (const item of readRows) {
      logContractRead({
        scope: 'CreatorFees',
        contract: item.contract,
        method: item.method,
        args: item.args,
        row: item.row,
        fields: item.fields
      });
    }
  }, [feeEscrow, curve, recipient, quoteToken, reads.data]);

  const fees = useMemo(() => {
    const rows = reads.data;
    const curveOffset = quoteToken ? 2 : 1;
    const claimableEth =
      rows?.[0]?.status === 'success' ? readBigint(rows[0].result) : 0n;
    const claimableToken =
      quoteToken && rows?.[1]?.status === 'success' ? readBigint(rows[1].result) : 0n;
    const quoteFeeBalance =
      rows?.[curveOffset]?.status === 'success'
        ? readBigint(rows[curveOffset].result)
        : 0n;
    const creatorTaxBalance =
      rows?.[curveOffset + 1]?.status === 'success'
        ? readBigint(rows[curveOffset + 1].result)
        : 0n;
    const buybackQuoteBalance =
      rows?.[curveOffset + 2]?.status === 'success'
        ? readBigint(rows[curveOffset + 2].result)
        : 0n;
    const protocolFeeShareBps =
      rows?.[curveOffset + 3]?.status === 'success'
        ? readUint(rows[curveOffset + 3].result)
        : 0n;
    const protocolFeeAmount = (quoteFeeBalance * protocolFeeShareBps) / BASIS_POINTS;
    const creatorBaseFee =
      quoteFeeBalance > protocolFeeAmount ? quoteFeeBalance - protocolFeeAmount : 0n;
    const pendingCreatorEstimate = creatorBaseFee + creatorTaxBalance;
    const pendingCurveFees = quoteFeeBalance + creatorTaxBalance;
    const isNotGraduated = detail?.phase === NOT_GRADUATED_PHASE;
    const collectBlockedReason = !isNotGraduated
      ? 'Graduated fee collection is not supported here yet'
      : buybackQuoteBalance > 0n
        ? 'Current fees include buyback balance and require the sweep operator'
        : null;

    return {
      claimableEth,
      claimableToken,
      claimableQuote: detail?.isNativeQuote ? claimableEth : claimableToken,
      quoteFeeBalance,
      creatorTaxBalance,
      buybackQuoteBalance,
      protocolFeeShareBps,
      pendingCreatorEstimate,
      pendingCurveFees,
      isNotGraduated,
      collectBlockedReason,
      canCollectCurveFees:
        Boolean(isFeeRecipient && isNotGraduated) &&
        buybackQuoteBalance === 0n &&
        pendingCurveFees > 0n,
      canClaimQuote:
        Boolean(isFeeRecipient) &&
        (detail?.isNativeQuote ? claimableEth > 0n : claimableToken > 0n),
      canTransfer: Boolean(isFeeRecipient)
    };
  }, [detail?.phase, detail?.isNativeQuote, isFeeRecipient, quoteToken, reads.data]);

  return {
    feeEscrow,
    quoteToken,
    recipient,
    isFeeRecipient,
    /** Demo 暂未接 holder distributor；正确判断见 docs/TokenDetailContracts.md */
    routesToHolders: false,
    ...fees,
    isLoading: reads.isLoading,
    isError: reads.isError,
    refetch: reads.refetch
  };
}

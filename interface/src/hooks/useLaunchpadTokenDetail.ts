import { useEffect, useMemo } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useReadContract, useReadContracts } from 'wagmi';
import { curveAbi, factoryAbi, launcherTokenAbi } from '../constants/abis';
import { getFactoryAddress } from '../constants/contracts';
import { logContractRead } from '../lib/contractDebug';

export type LaunchpadTokenSocials = {
  twitter: string;
  telegram: string;
  discord: string;
  website: string;
  farcaster: string;
};

export type LaunchpadTokenDetail = {
  token: Address;
  curve?: Address;
  creator?: Address;
  creatorFeeRecipient?: Address;
  pairToken?: Address;
  phase?: number;
  buybackEnabled: boolean;
  exists: boolean;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: bigint;
  logo: string;
  description: string;
  socials: LaunchpadTokenSocials;
  creatorTaxBps?: bigint;
  graduationThreshold?: bigint;
  realQuoteReserve?: bigint;
  sellableTokens?: bigint;
  readyToGraduate: boolean;
  graduated: boolean;
  isNativeQuote: boolean;
};

function readAddress(value: unknown): Address | undefined {
  return typeof value === 'string' && value.startsWith('0x')
    ? (value as Address)
    : undefined;
}

function readBigint(value: unknown): bigint | undefined {
  return typeof value === 'bigint' ? value : undefined;
}

export function useLaunchpadTokenDetail(token: Address | undefined) {
  const factory = getFactoryAddress();

  const launchRead = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: 'getLaunchedToken',
    args: token ? [token] : undefined,
    query: { enabled: Boolean(factory && token) }
  });

  const launch = launchRead.data;
  const curve = readAddress(launch?.curve);

  const reads = useReadContracts({
    contracts:
      token && curve
        ? [
            { address: token, abi: launcherTokenAbi, functionName: 'name' as const },
            { address: token, abi: launcherTokenAbi, functionName: 'symbol' as const },
            { address: token, abi: launcherTokenAbi, functionName: 'decimals' as const },
            { address: token, abi: launcherTokenAbi, functionName: 'totalSupply' as const },
            {
              address: token,
              abi: launcherTokenAbi,
              functionName: 'getTokenInfo' as const
            },
            {
              address: curve,
              abi: curveAbi,
              functionName: 'realQuoteReserve' as const
            },
            {
              address: curve,
              abi: curveAbi,
              functionName: 'sellableTokens' as const
            },
            {
              address: curve,
              abi: curveAbi,
              functionName: 'graduationThreshold' as const
            },
            {
              address: curve,
              abi: curveAbi,
              functionName: 'readyToGraduate' as const
            },
            { address: curve, abi: curveAbi, functionName: 'graduated' as const },
            { address: curve, abi: curveAbi, functionName: 'isNativeQuote' as const },
            { address: curve, abi: curveAbi, functionName: 'pairToken' as const },
            { address: curve, abi: curveAbi, functionName: 'creatorTaxBps' as const }
          ]
        : [],
    query: { enabled: Boolean(token && curve) }
  });

  useEffect(() => {
    if (!token || !factory) return;

    logContractRead({
      scope: 'LaunchpadTokenDetail',
      contract: factory,
      method: 'Factory.getLaunchedToken',
      args: [token],
      row: {
        status: launchRead.isSuccess
          ? 'success'
          : launchRead.isError
            ? 'error'
            : launchRead.isLoading
              ? 'loading'
              : 'idle',
        result: launchRead.data,
        error: launchRead.error
      },
      fields: {
        token: 'meme token 合约地址',
        curve: '该 token 对应的 Pons V2 bonding curve 地址',
        deployer: '发币交易的原始发起者',
        creatorFeeRecipient: '当前 Creator fees 收款地址，也是 Transfer 权限地址',
        pairToken: '报价资产地址；0x0 表示原生 ETH',
        graduationThreshold: '毕业阈值，真实 quote reserve 达到后进入毕业流程',
        poolFee: '毕业后 Uniswap v4 pool fee',
        tickSpacing: '毕业后 Uniswap v4 tick spacing',
        creatorTaxBps: 'creator 额外税率，bps 计价',
        buybackEnabled: '是否将 creator fee 的 buyback 份额用于 buyback and lock',
        phase: '发射阶段；0=未毕业，1+=毕业迁移后续阶段',
        sweptQuote: '毕业迁移时已 sweep 的 quote 数量',
        sweptTokens: '毕业迁移时已 sweep 的 token 数量',
        sweptAt: '毕业 sweep 时间戳',
        exists: 'Factory 是否登记了该 token'
      }
    });

    const rows = reads.data;
    const readRows = [
      {
        contract: token,
        method: 'Token.name',
        row: rows?.[0],
        fields: { return: 'ERC-20 name，详情页标题/About 展示' }
      },
      {
        contract: token,
        method: 'Token.symbol',
        row: rows?.[1],
        fields: { return: 'ERC-20 symbol，交易面板与费用卡片展示' }
      },
      {
        contract: token,
        method: 'Token.decimals',
        row: rows?.[2],
        fields: { return: 'ERC-20 decimals，用于 formatUnits / parseUnits' }
      },
      {
        contract: token,
        method: 'Token.totalSupply',
        row: rows?.[3],
        fields: { return: '固定总供应量（token 最小精度）' }
      },
      {
        contract: token,
        method: 'Token.getTokenInfo',
        row: rows?.[4],
        fields: {
          tokenDeployer: 'token 记录的创建者地址',
          tokenLogo: 'token logo URL',
          tokenDescription: 'token 描述',
          tokenSocials:
            '社交链接结构，包含 twitter、telegram、discord、website、farcaster'
        }
      },
      {
        contract: curve,
        method: 'Curve.realQuoteReserve',
        row: rows?.[5],
        fields: { return: '真实 quote 储备，不含 phantom，只用于毕业进度' }
      },
      {
        contract: curve,
        method: 'Curve.sellableTokens',
        row: rows?.[6],
        fields: { return: '曲线上还能卖出的 token 数量上限' }
      },
      {
        contract: curve,
        method: 'Curve.graduationThreshold',
        row: rows?.[7],
        fields: { return: '毕业所需真实 quote 储备阈值' }
      },
      {
        contract: curve,
        method: 'Curve.readyToGraduate',
        row: rows?.[8],
        fields: { return: '是否已达到毕业条件但尚未完成迁移' }
      },
      {
        contract: curve,
        method: 'Curve.graduated',
        row: rows?.[9],
        fields: { return: '是否已经毕业，毕业后 bonding curve 关闭' }
      },
      {
        contract: curve,
        method: 'Curve.isNativeQuote',
        row: rows?.[10],
        fields: { return: '报价资产是否是原生 ETH' }
      },
      {
        contract: curve,
        method: 'Curve.pairToken',
        row: rows?.[11],
        fields: { return: '报价资产 ERC20 地址；原生 ETH 时通常为 zero address' }
      },
      {
        contract: curve,
        method: 'Curve.creatorTaxBps',
        row: rows?.[12],
        fields: { return: 'creator 额外税率，bps 计价，100 bps = 1%' }
      }
    ];

    for (const item of readRows) {
      if (!item.contract) continue;

      logContractRead({
        scope: 'LaunchpadTokenDetail',
        contract: item.contract,
        method: item.method,
        row: item.row,
        fields: item.fields
      });
    }
  }, [
    token,
    factory,
    curve,
    launchRead.data,
    launchRead.error,
    launchRead.isSuccess,
    launchRead.isError,
    launchRead.isLoading,
    reads.data
  ]);

  const detail = useMemo<LaunchpadTokenDetail | null>(() => {
    if (!token) return null;

    const rows = reads.data;
    const tokenInfo =
      rows?.[4]?.status === 'success'
        ? (rows[4].result as
            | readonly [Address, string, string, LaunchpadTokenSocials]
            | undefined)
        : undefined;
    const creatorFeeRecipient = readAddress(launch?.creatorFeeRecipient);
    const pairToken =
      readAddress(launch?.pairToken) ??
      (rows?.[11]?.status === 'success' ? readAddress(rows[11].result) : undefined);

    return {
      token,
      curve,
      creator: tokenInfo?.[0] ?? readAddress(launch?.deployer),
      creatorFeeRecipient,
      pairToken,
      phase:
        launch?.phase !== undefined && launch?.phase !== null
          ? Number(launch.phase)
          : undefined,
      buybackEnabled: Boolean(launch?.buybackEnabled),
      exists: Boolean(launch?.exists),
      name:
        rows?.[0]?.status === 'success' && typeof rows[0].result === 'string'
          ? rows[0].result
          : 'Unknown',
      symbol:
        rows?.[1]?.status === 'success' && typeof rows[1].result === 'string'
          ? rows[1].result
          : 'TOKEN',
      decimals:
        rows?.[2]?.status === 'success' && typeof rows[2].result === 'number'
          ? rows[2].result
          : 18,
      totalSupply:
        rows?.[3]?.status === 'success' ? readBigint(rows[3].result) : undefined,
      logo: tokenInfo?.[1] ?? '',
      description: tokenInfo?.[2] ?? '',
      socials: tokenInfo?.[3] ?? {
        twitter: '',
        telegram: '',
        discord: '',
        website: '',
        farcaster: ''
      },
      creatorTaxBps:
        rows?.[12]?.status === 'success'
          ? readBigint(rows[12].result)
          : readBigint(launch?.creatorTaxBps),
      graduationThreshold:
        rows?.[7]?.status === 'success'
          ? readBigint(rows[7].result)
          : readBigint(launch?.graduationThreshold),
      realQuoteReserve:
        rows?.[5]?.status === 'success' ? readBigint(rows[5].result) : undefined,
      sellableTokens:
        rows?.[6]?.status === 'success' ? readBigint(rows[6].result) : undefined,
      readyToGraduate: Boolean(
        rows?.[8]?.status === 'success' ? rows[8].result : false
      ),
      graduated: Boolean(rows?.[9]?.status === 'success' ? rows[9].result : false),
      isNativeQuote: pairToken === undefined || pairToken === zeroAddress
    };
  }, [token, curve, launch, reads.data]);

  return {
    detail,
    factory,
    isLoading: launchRead.isLoading || reads.isLoading,
    isError: launchRead.isError || reads.isError,
    refetch: async () => {
      await Promise.all([launchRead.refetch(), reads.refetch()]);
    }
  };
}

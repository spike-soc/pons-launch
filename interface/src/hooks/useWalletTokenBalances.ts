import { useMemo } from 'react';
import { erc20Abi, type Address } from 'viem';
import { useBalance, useReadContracts } from 'wagmi';
import { getTrackedTokens } from '../constants/trackedTokens';

/** Read native ETH + configured ERC-20 balances for the connected wallet. */
export function useWalletTokenBalances(address?: string, chainId?: number) {
  const trackedTokens = useMemo(() => getTrackedTokens(chainId ?? 0), [chainId]);
  const owner = address as Address | undefined;

  const { data: ethBalance, isLoading: ethLoading } = useBalance({
    address: owner,
    query: { enabled: Boolean(owner) }
  });

  const { data: tokenBalances, isLoading: tokensLoading } = useReadContracts({
    contracts: trackedTokens.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: owner ? [owner] : undefined
    })),
    query: { enabled: Boolean(owner) && trackedTokens.length > 0 }
  });

  return {
    trackedTokens,
    ethBalance,
    ethLoading,
    tokenBalances,
    tokensLoading
  };
}

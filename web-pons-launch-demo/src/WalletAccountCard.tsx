import { LogOut } from 'lucide-react';
import { useMemo } from 'react';
import { erc20Abi, formatUnits, type Address } from 'viem';
import { useBalance, useReadContracts } from 'wagmi';
import { robinhoodChain } from './chain';
import { getTrackedTokens } from './tokens';

type WalletAccountCardProps = {
  address?: string;
  chainId?: number;
  chainReady: boolean;
  onDisconnect: () => void;
};

function formatAddress(address?: string) {
  if (!address) return '—';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(value?: bigint, decimals = 18, maxFractionDigits = 4) {
  if (value === undefined) return '—';
  const raw = Number(formatUnits(value, decimals));
  if (!Number.isFinite(raw)) return '—';
  if (raw === 0) return '0';
  if (raw < 0.0001) return '<0.0001';
  return raw.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0
  });
}

export function WalletAccountCard({
  address,
  chainId,
  chainReady,
  onDisconnect
}: WalletAccountCardProps) {
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

  const chainLabel =
    chainId === robinhoodChain.id
      ? robinhoodChain.name
      : chainId
        ? `Chain ${chainId}`
        : 'Unknown';

  return (
    <aside className="wallet-card" aria-label="Wallet account">
      <div className="wallet-card-row">
        <span>Address</span>
        <strong title={address}>{formatAddress(address)}</strong>
      </div>

      <div className="wallet-card-row">
        <span>Chain</span>
        <strong className={chainReady ? 'wallet-chain-ok' : 'wallet-chain-warn'}>{chainLabel}</strong>
      </div>

      <div className="wallet-card-row wallet-card-eth">
        <span>ETH</span>
        <strong>
          {ethLoading ? '…' : formatAmount(ethBalance?.value, ethBalance?.decimals ?? 18)}
        </strong>
      </div>

      <div className="wallet-token-list">
        <p>Balances</p>
        {trackedTokens.length === 0 ? (
          <div className="wallet-token-empty">No tracked tokens on this chain</div>
        ) : (
          <ul>
            {trackedTokens.map((token, index) => {
              const result = tokenBalances?.[index];
              const value = result?.status === 'success' ? (result.result as bigint) : undefined;
              return (
                <li key={token.address}>
                  <div>
                    <strong>{token.symbol}</strong>
                    <small>{token.name}</small>
                  </div>
                  <span>{tokensLoading ? '…' : formatAmount(value, token.decimals)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button className="wallet-disconnect" type="button" onClick={onDisconnect}>
        <LogOut size={14} strokeWidth={2} />
        <span>Disconnect</span>
      </button>
    </aside>
  );
}

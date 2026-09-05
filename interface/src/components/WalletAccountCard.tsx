import { LogOut } from 'lucide-react';
import { robinhoodChain } from '../constants/chain';
import { useWalletTokenBalances } from '../hooks/useWalletTokenBalances';
import { formatAddress, formatEthBalance, formatTokenAmount } from '../lib/format';

type WalletAccountCardProps = {
  address?: string;
  chainId?: number;
  chainReady: boolean;
  onDisconnect: () => void;
};

export function WalletAccountCard({
  address,
  chainId,
  chainReady,
  onDisconnect
}: WalletAccountCardProps) {
  const { trackedTokens, ethBalance, ethLoading, tokenBalances, tokensLoading } =
    useWalletTokenBalances(address, chainId);

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
          {ethLoading
            ? '…'
            : formatEthBalance(ethBalance?.value, ethBalance?.decimals ?? 18)}
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
                  <span>{tokensLoading ? '…' : formatTokenAmount(value, token.decimals)}</span>
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

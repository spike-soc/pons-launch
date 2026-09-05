import { useLogin, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useEffect, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { robinhoodChain } from '../constants/chain';

export type AuthView = {
  authenticated: boolean;
  ready: boolean;
  walletAddress?: string;
  chainId?: number;
  chainReady: boolean;
  reconnecting?: boolean;
  privyConfigured: boolean;
  onAuthClick: () => void;
};

/** Sync Privy login state into wagmi's active wallet for contract calls. */
export function useSyncedPrivyAuth(): AuthView {
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const primaryWallet = useMemo(() => {
    return (
      address ||
      user?.wallet?.address ||
      user?.linkedAccounts?.find((account) => account.type === 'wallet')?.address
    );
  }, [address, user]);

  // Wait until Privy has restored the session from storage before syncing wagmi.
  useEffect(() => {
    if (!ready || !authenticated || !wallets.length) return;

    const preferred =
      wallets.find(
        (wallet) => wallet.address.toLowerCase() === primaryWallet?.toLowerCase()
      ) || wallets[0];

    if (!preferred) return;
    if (address && preferred.address.toLowerCase() === address.toLowerCase()) return;

    void setActiveWallet(preferred);
  }, [ready, authenticated, wallets, primaryWallet, address, setActiveWallet]);

  const reconnecting = ready && authenticated && !isConnected;

  return {
    ready,
    authenticated: ready && authenticated,
    walletAddress: primaryWallet,
    chainId,
    chainReady:
      ready && authenticated && isConnected && chainId === robinhoodChain.id,
    reconnecting,
    privyConfigured: true,
    onAuthClick: () => {
      if (!ready) return;
      if (authenticated) logout();
      else login();
    }
  };
}

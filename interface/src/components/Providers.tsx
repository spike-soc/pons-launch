import { PrivyProvider, type PrivyClientConfig } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { robinhoodChain } from '../constants/chain';
import { wagmiConfig } from '../lib/wagmi';

const queryClient = new QueryClient();

const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: 'light',
    accentColor: '#111111',
    walletChainType: 'ethereum-only'
  },
  loginMethods: ['email', 'wallet'],
  defaultChain: robinhoodChain,
  supportedChains: [robinhoodChain],
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets'
    }
  }
};

type AppProvidersProps = {
  children: ReactNode;
  privyAppId: string;
};

export function AppProviders({ children, privyAppId }: AppProvidersProps) {
  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

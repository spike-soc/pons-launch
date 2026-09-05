import { createConfig } from '@privy-io/wagmi';
import { http } from 'wagmi';
import { robinhoodChain, rpcHttpUrl } from './chain';

export const wagmiConfig = createConfig({
  chains: [robinhoodChain],
  transports: {
    [robinhoodChain.id]: http(rpcHttpUrl)
  }
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}

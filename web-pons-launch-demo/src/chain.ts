import { defineChain } from 'viem';

const chainId = Number(import.meta.env.VITE_CHAIN_ID || 4663);
const chainName = import.meta.env.VITE_CHAIN_NAME || 'Robinhood Chain';
const rpcUrl =
  import.meta.env.VITE_RPC_URL ||
  (chainId === 46630
    ? 'https://rpc.testnet.chain.robinhood.com'
    : 'https://rpc.mainnet.chain.robinhood.com');
const explorerUrl =
  import.meta.env.VITE_EXPLORER_URL ||
  (chainId === 46630
    ? 'https://explorer.testnet.chain.robinhood.com'
    : 'https://robinhoodchain.blockscout.com');

export const robinhoodChain = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [rpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: explorerUrl
    }
  }
});

export const rpcHttpUrl = rpcUrl;

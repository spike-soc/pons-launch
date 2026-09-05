import type { Address } from 'viem';

export type TrackedToken = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
};

/** Robinhood Chain mainnet (4663) assets shown in the wallet balance card. */
export const MAINNET_TRACKED_TOKENS: TrackedToken[] = [
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
    decimals: 18
  },
  {
    symbol: 'USDG',
    name: 'Global Dollar',
    address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
    decimals: 6
  },
  {
    symbol: 'TSLA',
    name: 'Tesla • Robinhood Token',
    address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d',
    decimals: 18
  }
];

export function getTrackedTokens(chainId: number): TrackedToken[] {
  if (chainId === 4663) return MAINNET_TRACKED_TOKENS;
  return [];
}

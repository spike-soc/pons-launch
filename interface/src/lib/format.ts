import { formatUnits } from 'viem';

export function formatAddress(address?: string) {
  if (!address) return '—';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(
  value?: bigint,
  decimals = 18,
  maxFractionDigits = 4,
  minFractionDigits = 0
) {
  if (value === undefined) return '—';
  const raw = Number(formatUnits(value, decimals));
  if (!Number.isFinite(raw)) return '—';
  if (raw === 0) return (0).toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: minFractionDigits
  });
  const threshold = 10 ** -maxFractionDigits;
  if (raw > 0 && raw < threshold) return `<${threshold}`;
  return raw.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: minFractionDigits
  });
}

/** Wallet ETH balance: always show 5 decimal places. */
export function formatEthBalance(value?: bigint, decimals = 18) {
  return formatTokenAmount(value, decimals, 5, 5);
}

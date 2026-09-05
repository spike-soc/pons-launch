const PONS_IPFS_GATEWAY = 'https://www.ponsfamily.com/api/ipfs/content';

function toPonsIpfsUrl(cidOrPath: string) {
  const path = cidOrPath.replace(/^ipfs:\/\//, '').replace(/^\/+/, '');
  return `${PONS_IPFS_GATEWAY}/${path}?variant=card`;
}

export function resolveLogoUrl(logo?: string) {
  if (!logo) return '';
  if (logo.startsWith('ipfs://')) {
    return toPonsIpfsUrl(logo);
  }
  if (logo.startsWith('Qm') || logo.startsWith('bafy') || logo.startsWith('bafk')) {
    return toPonsIpfsUrl(logo);
  }
  if (logo.startsWith('/api/ipfs/content/')) {
    return `https://www.ponsfamily.com${logo}${logo.includes('?') ? '' : '?variant=card'}`;
  }
  return logo;
}

export function formatMarketCapUsd(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  if (value >= 1) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}

export function formatRelativeTime(iso?: string | null) {
  if (!iso) return 'onchain';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'onchain';
  const deltaSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (deltaSec < 45) return 'now';
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h`;
  return `${Math.floor(deltaSec / 86400)}d`;
}

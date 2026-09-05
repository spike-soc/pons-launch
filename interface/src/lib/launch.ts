import { getAddress, isAddress, parseEther, type Address, zeroAddress } from 'viem';

/** Matches PonsV2LaunchDeployer metadata caps (bytes length). */
export const LAUNCH_METADATA_LIMITS = {
  name: 64,
  symbol: 16,
  logo: 512,
  description: 2048,
  social: 256,
  snipeExemptions: 32
} as const;

export function randomSalt(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function isNativePair(pairToken: Address) {
  return pairToken === zeroAddress;
}

export function parseQuoteInEth(
  raw: string
): { ok: true; value: bigint } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: 0n };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: `Invalid developer buy amount: "${raw}"` };
  }
  try {
    const value = parseEther(trimmed);
    return { ok: true, value };
  } catch {
    return { ok: false, error: `Invalid developer buy amount: "${raw}"` };
  }
}

export function parseOptionalAddressStrict(
  raw: string,
  fallback: Address
): { ok: true; value: Address } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true, value: fallback };
  if (!isAddress(value)) {
    return { ok: false, error: `Invalid address: ${value}` };
  }
  return { ok: true, value: getAddress(value) };
}

export function parseAddressListStrict(
  raw: string
): { ok: true; value: Address[] } | { ok: false; error: string } {
  const parts = raw.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: true, value: [] };
  if (parts.length > LAUNCH_METADATA_LIMITS.snipeExemptions) {
    return {
      ok: false,
      error: `Too many snipe exemptions (max ${LAUNCH_METADATA_LIMITS.snipeExemptions})`
    };
  }

  const out: Address[] = [];
  const seen = new Set<string>();
  const invalid: string[] = [];

  for (const part of parts) {
    if (!isAddress(part)) {
      invalid.push(part);
      continue;
    }
    const addr = getAddress(part);
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }

  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Invalid snipe exemption address(es): ${invalid.join(', ')}`
    };
  }

  return { ok: true, value: out };
}

export function validateLaunchMetadata(input: {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: {
    twitter: string;
    telegram: string;
    discord: string;
    website: string;
    farcaster: string;
  };
}): string | null {
  const byteLen = (s: string) => new TextEncoder().encode(s).length;

  if (!input.name || !input.symbol) return 'Name and symbol are required';
  if (byteLen(input.name) > LAUNCH_METADATA_LIMITS.name) {
    return `Name too long (max ${LAUNCH_METADATA_LIMITS.name} bytes)`;
  }
  if (byteLen(input.symbol) > LAUNCH_METADATA_LIMITS.symbol) {
    return `Symbol too long (max ${LAUNCH_METADATA_LIMITS.symbol} bytes)`;
  }
  if (byteLen(input.logo) > LAUNCH_METADATA_LIMITS.logo) {
    return `Logo URI too long (max ${LAUNCH_METADATA_LIMITS.logo} bytes)`;
  }
  if (byteLen(input.description) > LAUNCH_METADATA_LIMITS.description) {
    return `Description too long (max ${LAUNCH_METADATA_LIMITS.description} bytes)`;
  }

  for (const [key, value] of Object.entries(input.socials)) {
    if (byteLen(value) > LAUNCH_METADATA_LIMITS.social) {
      return `socials.${key} too long (max ${LAUNCH_METADATA_LIMITS.social} bytes)`;
    }
  }

  return null;
}

/** UI percent → contract bps. 1% = 100 bps. */
export function percentToCreatorTaxBps(
  raw: string,
  maxBps?: number
): { ok: true; bps: number } | { ok: false; error: string } {
  const trimmed = raw.trim() || '0';
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: `Invalid creator tax percent: ${raw}` };
  }
  const pct = Number(trimmed);
  if (!Number.isFinite(pct) || pct < 0) {
    return { ok: false, error: 'Creator tax percent must be ≥ 0' };
  }
  const bps = Math.round(pct * 100);
  if (bps > 65535) return { ok: false, error: 'Creator tax out of range' };
  if (maxBps !== undefined && bps > maxBps) {
    return {
      ok: false,
      error: `Creator tax ${bps} bps above max ${maxBps} bps (${maxBps / 100}%)`
    };
  }
  return { ok: true, bps };
}

import type { Address } from 'viem';
import { getAddress, isAddress } from 'viem';

/** Official pons v2 deployments on Robinhood Chain mainnet (4663). */
const DEFAULT_PONS_V2_ADDRESSES = {
  factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  memeHook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044',
  feeEscrow: '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e',
  buybackVault: '0x42df2a798f82289E177311362e8f5ccC45c1219c',
  launchLocker: '0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952',
  launchAndBuy: '0xe33E9E479dF8802cb0866d5d05258bEc4cF62948',
  launchDeployer: '0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42',
  graduationExecutor: '0xC7819B64A1dAECD7eC19856d026cb14EfBd89046',
  graduationGuard: '0xf5695117b99B6f6401e67d4195BD653628176C6C'
} as const satisfies Record<string, Address>;

function envAddress(key: string, fallback: Address): Address {
  const raw = (import.meta.env[key] as string | undefined)?.trim();
  if (!raw) return fallback;
  if (!isAddress(raw)) {
    console.warn(`[pons] Invalid ${key}=${raw}, using default ${fallback}`);
    return fallback;
  }
  return getAddress(raw);
}

/** Env overrides win; otherwise official mainnet defaults. */
export const PONS_V2_ADDRESSES = {
  factory: envAddress('VITE_PONS_V2_FACTORY_ADDRESS', DEFAULT_PONS_V2_ADDRESSES.factory),
  memeHook: envAddress('VITE_PONS_V2_MEME_HOOK_ADDRESS', DEFAULT_PONS_V2_ADDRESSES.memeHook),
  feeEscrow: envAddress('VITE_PONS_V2_FEE_ESCROW_ADDRESS', DEFAULT_PONS_V2_ADDRESSES.feeEscrow),
  buybackVault: envAddress(
    'VITE_PONS_V2_BUYBACK_VAULT_ADDRESS',
    DEFAULT_PONS_V2_ADDRESSES.buybackVault
  ),
  launchLocker: envAddress(
    'VITE_PONS_V2_LAUNCH_LOCKER_ADDRESS',
    DEFAULT_PONS_V2_ADDRESSES.launchLocker
  ),
  launchAndBuy: envAddress(
    'VITE_PONS_V2_LAUNCH_AND_BUY_ADDRESS',
    DEFAULT_PONS_V2_ADDRESSES.launchAndBuy
  ),
  launchDeployer: envAddress(
    'VITE_PONS_V2_LAUNCH_DEPLOYER_ADDRESS',
    DEFAULT_PONS_V2_ADDRESSES.launchDeployer
  ),
  graduationExecutor: envAddress(
    'VITE_PONS_V2_GRADUATION_EXECUTOR_ADDRESS',
    DEFAULT_PONS_V2_ADDRESSES.graduationExecutor
  ),
  graduationGuard: envAddress(
    'VITE_PONS_V2_GRADUATION_GUARD_ADDRESS',
    DEFAULT_PONS_V2_ADDRESSES.graduationGuard
  )
} as const satisfies Record<string, Address>;

export type PonsV2AddressKey = keyof typeof PONS_V2_ADDRESSES;

export function getFactoryAddress(): Address {
  return PONS_V2_ADDRESSES.factory;
}

export function getLaunchAndBuyAddress(): Address {
  return PONS_V2_ADDRESSES.launchAndBuy;
}

/**
 * Demo meme token addresses shown in the launch feed.
 * Edit this list instead of `.env`.
 */
export const MEME_TOKEN_ADDRESSES = [
  '0x7C0814eb37ACfec08Fdd5ebe2aaD9CB38686333E',
  '0x2C87a344c6757a45c61Ba2aca47bE37942Dc1C18',
] as const satisfies readonly Address[];

export type MemeTokenAddress = (typeof MEME_TOKEN_ADDRESSES)[number];

import type { Address } from 'viem';

function requireAddress(value: string | undefined, label: string): Address {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Missing or invalid ${label}`);
  }
  return value as Address;
}

function optionalAddress(value: string | undefined): Address | undefined {
  if (!value) return undefined;
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) return undefined;
  return value as Address;
}

export const ponsV2Addresses = {
  factory: optionalAddress(import.meta.env.VITE_PONS_V2_FACTORY_ADDRESS),
  memeHook: optionalAddress(import.meta.env.VITE_PONS_V2_MEME_HOOK_ADDRESS),
  feeEscrow: optionalAddress(import.meta.env.VITE_PONS_V2_FEE_ESCROW_ADDRESS),
  buybackVault: optionalAddress(import.meta.env.VITE_PONS_V2_BUYBACK_VAULT_ADDRESS),
  launchLocker: optionalAddress(import.meta.env.VITE_PONS_V2_LAUNCH_LOCKER_ADDRESS),
  launchAndBuy: optionalAddress(import.meta.env.VITE_PONS_V2_LAUNCH_AND_BUY_ADDRESS),
  launchDeployer: optionalAddress(import.meta.env.VITE_PONS_V2_LAUNCH_DEPLOYER_ADDRESS),
  graduationExecutor: optionalAddress(import.meta.env.VITE_PONS_V2_GRADUATION_EXECUTOR_ADDRESS),
  graduationGuard: optionalAddress(import.meta.env.VITE_PONS_V2_GRADUATION_GUARD_ADDRESS)
} as const;

export function getFactoryAddress(): Address {
  return requireAddress(import.meta.env.VITE_PONS_V2_FACTORY_ADDRESS, 'VITE_PONS_V2_FACTORY_ADDRESS');
}

export function getLaunchAndBuyAddress(): Address {
  return requireAddress(
    import.meta.env.VITE_PONS_V2_LAUNCH_AND_BUY_ADDRESS,
    'VITE_PONS_V2_LAUNCH_AND_BUY_ADDRESS'
  );
}

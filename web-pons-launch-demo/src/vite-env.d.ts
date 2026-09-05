/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_CHAIN_NAME: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_EXPLORER_URL: string;
  readonly VITE_PONS_V2_FACTORY_ADDRESS: string;
  readonly VITE_PONS_V2_MEME_HOOK_ADDRESS: string;
  readonly VITE_PONS_V2_FEE_ESCROW_ADDRESS: string;
  readonly VITE_PONS_V2_BUYBACK_VAULT_ADDRESS: string;
  readonly VITE_PONS_V2_LAUNCH_LOCKER_ADDRESS: string;
  readonly VITE_PONS_V2_LAUNCH_AND_BUY_ADDRESS: string;
  readonly VITE_PONS_V2_LAUNCH_DEPLOYER_ADDRESS: string;
  readonly VITE_PONS_V2_GRADUATION_EXECUTOR_ADDRESS: string;
  readonly VITE_PONS_V2_GRADUATION_GUARD_ADDRESS: string;
  readonly VITE_IMAGE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

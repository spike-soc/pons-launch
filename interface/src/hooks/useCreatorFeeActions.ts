import { useState } from 'react';
import {
  type Address,
  BaseError,
  ContractFunctionRevertedError,
  getAddress,
  isAddress
} from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { curveAbi, factoryAbi, feeEscrowAbi } from '../constants/abis';

type CreatorFeeActionsInput = {
  token?: Address;
  curve?: Address;
  factory?: Address;
  feeEscrow?: Address;
  quoteToken?: Address;
  isNativeQuote: boolean;
  canCollectCurveFees: boolean;
  canClaimQuote: boolean;
  canTransfer: boolean;
  collectBlockedReason?: string | null;
};

function mapCreatorFeeError(error: unknown): string {
  if (!(error instanceof Error)) return 'Transaction failed';

  const base = error instanceof BaseError ? error : null;
  const reverted = base?.walk((e) => e instanceof ContractFunctionRevertedError) as
    | ContractFunctionRevertedError
    | null
    | undefined;

  switch (reverted?.data?.errorName) {
    case 'InternalSwapRequiresOperator':
      return 'Current fees include buyback and require the sweep operator';
    case 'MinimumOutputRequired':
      return 'This sweep requires a buyback minimum output';
    case 'NotFeeSweepOperator':
      return 'Current wallet cannot collect curve fees';
    case 'NotCreatorFeeRecipient':
      return 'Current wallet is not the fee recipient';
    case 'TokenNotFound':
      return 'Token launch record not found';
    default:
      break;
  }

  return base?.shortMessage || error.message || 'Transaction failed';
}

export function useCreatorFeeActions({
  token,
  curve,
  factory,
  feeEscrow,
  quoteToken,
  isNativeQuote,
  canCollectCurveFees,
  canClaimQuote,
  canTransfer,
  collectBlockedReason
}: CreatorFeeActionsInput) {
  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function transfer(newRecipient: string) {
    setErrorMessage(null);

    if (!factory || !token || !canTransfer) {
      const message = 'Current wallet cannot transfer fee recipient';
      setErrorMessage(message);
      throw new Error(message);
    }
    if (!isAddress(newRecipient)) {
      const message = 'Enter a valid wallet address';
      setErrorMessage(message);
      throw new Error(message);
    }

    try {
      return await writeContractAsync({
        address: factory,
        abi: factoryAbi,
        functionName: 'transferCreatorFeeRecipient',
        args: [token, getAddress(newRecipient)]
      });
    } catch (error) {
      const message = mapCreatorFeeError(error);
      setErrorMessage(message);
      throw new Error(message);
    }
  }

  async function collectCurveFees() {
    setErrorMessage(null);

    if (!curve || !canCollectCurveFees) {
      const message = collectBlockedReason || 'Cannot collect curve fees now';
      setErrorMessage(message);
      throw new Error(message);
    }

    try {
      return await writeContractAsync({
        address: curve,
        abi: curveAbi,
        functionName: 'sweepFees',
        args: [0n]
      });
    } catch (error) {
      const message = mapCreatorFeeError(error);
      setErrorMessage(message);
      throw new Error(message);
    }
  }

  async function claimQuote() {
    setErrorMessage(null);

    if (!feeEscrow || !canClaimQuote) {
      const message = 'No claimable creator fees';
      setErrorMessage(message);
      throw new Error(message);
    }
    if (!isNativeQuote && !quoteToken) {
      const message = 'Quote token is unavailable';
      setErrorMessage(message);
      throw new Error(message);
    }

    try {
      if (isNativeQuote) {
        return await writeContractAsync({
          address: feeEscrow,
          abi: feeEscrowAbi,
          functionName: 'claim'
        });
      }

      return await writeContractAsync({
        address: feeEscrow,
        abi: feeEscrowAbi,
        functionName: 'claimToken',
        args: [quoteToken as Address]
      });
    } catch (error) {
      const message = mapCreatorFeeError(error);
      setErrorMessage(message);
      throw new Error(message);
    }
  }

  return {
    transfer,
    collectCurveFees,
    claimQuote,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
    errorMessage,
    reset
  };
}

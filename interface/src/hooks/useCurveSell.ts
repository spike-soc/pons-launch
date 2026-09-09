import { useCallback, useState } from 'react';
import { type Address, BaseError, ContractFunctionRevertedError } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { curveAbi } from '../constants/abis';
import { minQuoteOutWithSlippage } from '../lib/quoteSell';

export type CurveSellInput = {
  curve: Address;
  tokensIn: bigint;
  quoteOut: bigint;
  recipient: Address;
  slippageBps?: bigint;
};

function mapSellError(error: unknown): string {
  if (!(error instanceof Error)) return 'Sell failed';

  const base = error instanceof BaseError ? error : null;
  const reverted = base?.walk((e) => e instanceof ContractFunctionRevertedError) as
    | ContractFunctionRevertedError
    | null
    | undefined;

  switch (reverted?.data?.errorName) {
    case 'SlippageExceeded':
      return 'Price moved; try again（SlippageExceeded）';
    case 'CurveGraduated':
      return 'Curve is closed; trade on the pool（CurveGraduated）';
    case 'ZeroAmount':
      return 'Amount must be greater than 0（ZeroAmount）';
    case 'ZeroAddress':
      return 'Invalid recipient（ZeroAddress）';
    case 'ERC20InsufficientAllowance':
      return 'Approve the token before selling（ERC20InsufficientAllowance）';
    case 'ERC20InsufficientBalance':
      return 'Insufficient token balance（ERC20InsufficientBalance）';
    default:
      break;
  }

  return base?.shortMessage || error.message || 'Sell failed';
}

export function useCurveSell() {
  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sell = useCallback(
    async (input: CurveSellInput) => {
      setErrorMessage(null);
      const { curve, tokensIn, quoteOut, recipient, slippageBps = 100n } = input;

      if (tokensIn <= 0n) {
        const message = 'Enter a token amount to sell';
        setErrorMessage(message);
        throw new Error(message);
      }

      const minQuoteOut = minQuoteOutWithSlippage(quoteOut, slippageBps);

      try {
        return await writeContractAsync({
          address: curve,
          abi: curveAbi,
          functionName: 'sell',
          args: [tokensIn, minQuoteOut, recipient]
        });
      } catch (error) {
        const message = mapSellError(error);
        setErrorMessage(message);
        throw error;
      }
    },
    [writeContractAsync]
  );

  return {
    sell,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
    receipt: receipt.data,
    errorMessage,
    reset
  };
}

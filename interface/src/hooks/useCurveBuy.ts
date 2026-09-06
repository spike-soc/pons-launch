import { useCallback, useState } from 'react';
import {
  BaseError,
  ContractFunctionRevertedError,
  formatEther,
  type Address
} from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { curveAbi } from '../constants/abis';
import { minTokensOutWithSlippage } from '../lib/quoteBuy';

export type CurveBuyInput = {
  curve: Address;
  quoteIn: bigint;
  tokensOut: bigint;
  recipient: Address;
  /** Slippage in bps; default 100 = 1%. */
  slippageBps?: bigint;
};

const LOG = '[buy]';

function mapBuyError(error: unknown): string {
  if (!(error instanceof Error)) return 'Buy failed';

  const base = error instanceof BaseError ? error : null;
  const reverted = base?.walk((e) => e instanceof ContractFunctionRevertedError) as
    | ContractFunctionRevertedError
    | null
    | undefined;

  const name = reverted?.data?.errorName;
  switch (name) {
    case 'SlippageExceeded':
      return 'Price moved; try again（SlippageExceeded）';
    case 'CurveGraduated':
      return 'Curve already graduated（CurveGraduated）';
    case 'ZeroAmount':
      return 'Amount must be greater than 0（ZeroAmount）';
    case 'NativeValueMismatch':
      return 'msg.value must equal quoteIn（NativeValueMismatch）';
    case 'ZeroAddress':
      return 'Invalid recipient（ZeroAddress）';
    default:
      break;
  }

  return base?.shortMessage || error.message || 'Buy failed';
}

export function useCurveBuy() {
  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buy = useCallback(
    async (input: CurveBuyInput) => {
      setErrorMessage(null);
      const {
        curve,
        quoteIn,
        tokensOut,
        recipient,
        slippageBps = 100n
      } = input;

      if (quoteIn <= 0n) {
        const message = 'Enter an ETH amount to buy';
        setErrorMessage(message);
        throw new Error(message);
      }

      const minTokensOut = minTokensOutWithSlippage(tokensOut, slippageBps);

      console.log(LOG, 'step:writeContract buy', {
        curve,
        quoteIn: quoteIn.toString(),
        quoteInEth: formatEther(quoteIn),
        tokensOut: tokensOut.toString(),
        minTokensOut: minTokensOut.toString(),
        recipient,
        value: quoteIn.toString()
      });

      try {
        const txHash = await writeContractAsync({
          address: curve,
          abi: curveAbi,
          functionName: 'buy',
          args: [quoteIn, minTokensOut, recipient],
          value: quoteIn
        });
        console.log(LOG, 'step:writeContract sent', { txHash });
        return txHash;
      } catch (error) {
        const message = mapBuyError(error);
        console.error(LOG, 'step:writeContract failed', { message, error });
        setErrorMessage(message);
        throw error;
      }
    },
    [writeContractAsync]
  );

  return {
    buy,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
    receipt: receipt.data,
    errorMessage,
    reset
  };
}

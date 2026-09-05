import { useCallback, useState } from 'react';
import {
  BaseError,
  ContractFunctionRevertedError,
  formatEther,
  type Address,
  zeroAddress
} from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import {
  launchAndBuyAbi,
  launchTokenWriteAbi,
  type TokenParamsInput
} from '../constants/abis';
import { getFactoryAddress, getLaunchAndBuyAddress } from '../constants/contracts';

export type LaunchSubmitInput = {
  params: TokenParamsInput;
  launchConfigId: bigint;
  pairToken: Address;
  snipeTaxExemptions: Address[];
  /** Native quote amount for developer buy; 0 = launch only. */
  quoteIn: bigint;
  minTokensOut: bigint;
  recipient: Address;
  launchFee: bigint;
};

const LOG = '[launch]';

function mapLaunchError(error: unknown): string {
  if (!(error instanceof Error)) return 'Launch failed';

  const base = error instanceof BaseError ? error : null;
  const reverted = base?.walk((e) => e instanceof ContractFunctionRevertedError) as
    | ContractFunctionRevertedError
    | null
    | undefined;

  const name = reverted?.data?.errorName;
  switch (name) {
    case 'LaunchFeeNotPaid':
      return 'Launch fee mismatch（LaunchFeeNotPaid）';
    case 'NotWhitelisted':
      return 'Wallet cannot launch yet（NotWhitelisted）';
    case 'LaunchEconomicsMismatch':
      return 'Economics changed; refresh and retry（LaunchEconomicsMismatch）';
    case 'CreatorTaxTooHigh':
      return 'Creator tax above protocol cap（CreatorTaxTooHigh）';
    case 'PairTokenNotApproved':
      return 'Pair token not approved（PairTokenNotApproved）';
    case 'ExemptionListTooLong':
      return 'Too many snipe exemptions（ExemptionListTooLong）';
    case 'InvalidTokenParams':
      return 'Invalid name or symbol（InvalidTokenParams）';
    case 'MetadataTooLong':
      return 'Metadata too long（MetadataTooLong）';
    case 'LaunchConfigDisabled':
      return 'Launch config disabled（LaunchConfigDisabled）';
    default:
      break;
  }

  return base?.shortMessage || error.message || 'Launch failed';
}

function serializeLaunchInput(input: LaunchSubmitInput) {
  return {
    launchConfigId: input.launchConfigId.toString(),
    pairToken: input.pairToken,
    quoteIn: input.quoteIn.toString(),
    quoteInEth: formatEther(input.quoteIn),
    minTokensOut: input.minTokensOut.toString(),
    recipient: input.recipient,
    launchFee: input.launchFee.toString(),
    launchFeeEth: formatEther(input.launchFee),
    msgValue:
      input.quoteIn > 0n && input.pairToken === zeroAddress
        ? (input.launchFee + input.quoteIn).toString()
        : input.launchFee.toString(),
    snipeTaxExemptions: input.snipeTaxExemptions,
    params: input.params
  };
}

export function useLaunchToken() {
  const { writeContractAsync, data: hash, isPending, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const launch = useCallback(
    async (input: LaunchSubmitInput) => {
      setErrorMessage(null);
      console.log(LOG, 'step:writeContract start', serializeLaunchInput(input));

      const {
        params,
        launchConfigId,
        pairToken,
        snipeTaxExemptions,
        quoteIn,
        minTokensOut,
        recipient,
        launchFee
      } = input;

      const tokenParams = {
        name: params.name,
        symbol: params.symbol,
        logo: params.logo,
        description: params.description,
        socials: params.socials,
        creatorFeeRecipient: params.creatorFeeRecipient,
        creatorTaxBps: params.creatorTaxBps,
        buybackEnabled: params.buybackEnabled,
        expectedEconomics: params.expectedEconomics,
        salt: params.salt
      };

      try {
        if (quoteIn > 0n) {
          if (params.creatorFeeRecipient === zeroAddress) {
            console.error(LOG, 'step:writeContract abort — creatorFeeRecipient is zero');
            throw new Error('creatorFeeRecipient required for launchAndBuy');
          }
          const value =
            pairToken === zeroAddress ? launchFee + quoteIn : launchFee;
          const to = getLaunchAndBuyAddress();

          console.log(LOG, 'step:writeContract launchAndBuy', {
            to,
            functionName: 'launchAndBuy',
            tokenParams,
            launchConfigId: launchConfigId.toString(),
            pairToken,
            quoteIn: quoteIn.toString(),
            minTokensOut: minTokensOut.toString(),
            recipient,
            snipeTaxExemptions,
            value: value.toString(),
            valueEth: formatEther(value)
          });

          const txHash = await writeContractAsync({
            address: to,
            abi: launchAndBuyAbi,
            functionName: 'launchAndBuy',
            args: [
              tokenParams,
              launchConfigId,
              pairToken,
              quoteIn,
              minTokensOut,
              recipient,
              snipeTaxExemptions
            ],
            value
          });
          console.log(LOG, 'step:writeContract sent launchAndBuy', { txHash });
          return txHash;
        }

        const to = getFactoryAddress();
        console.log(LOG, 'step:writeContract launchToken', {
          to,
          functionName: 'launchToken',
          tokenParams,
          launchConfigId: launchConfigId.toString(),
          pairToken,
          snipeTaxExemptions,
          value: launchFee.toString(),
          valueEth: formatEther(launchFee)
        });

        const txHash = await writeContractAsync({
          address: to,
          abi: launchTokenWriteAbi,
          functionName: 'launchToken',
          args: [tokenParams, launchConfigId, pairToken, snipeTaxExemptions],
          value: launchFee
        });
        console.log(LOG, 'step:writeContract sent launchToken', { txHash });
        return txHash;
      } catch (error) {
        const message = mapLaunchError(error);
        console.error(LOG, 'step:writeContract failed', { message, error });
        setErrorMessage(message);
        throw error;
      }
    },
    [writeContractAsync]
  );

  return {
    launch,
    hash,
    isPending,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
    receipt: receipt.data,
    errorMessage,
    reset
  };
}

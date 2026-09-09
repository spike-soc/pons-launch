/** Pons V2 curve local sell quote. Mirrors the curve sell math. */

import { amountOut, BPS } from './quoteBuy';

export type CurveSellQuoteState = {
  quoteReserve: bigint;
  tokenReserve: bigint;
  feeBps: bigint;
  creatorTaxBps: bigint;
};

export type QuoteSellResult = {
  grossQuoteOut: bigint;
  quoteOut: bigint;
  fee: bigint;
  tax: bigint;
};

export function quoteSellFromState(
  tokensIn: bigint,
  state: CurveSellQuoteState
): QuoteSellResult {
  if (tokensIn <= 0n) {
    return {
      grossQuoteOut: 0n,
      quoteOut: 0n,
      fee: 0n,
      tax: 0n
    };
  }

  const grossQuoteOut = amountOut(tokensIn, state.tokenReserve, state.quoteReserve);
  const fee = (grossQuoteOut * state.feeBps) / BPS;
  const tax = (grossQuoteOut * state.creatorTaxBps) / BPS;

  return {
    grossQuoteOut,
    quoteOut: grossQuoteOut - fee - tax,
    fee,
    tax
  };
}

export function minQuoteOutWithSlippage(
  quoteOut: bigint,
  slippageBps = 100n
): bigint {
  if (quoteOut === 0n) return 0n;
  if (slippageBps >= BPS) return 0n;
  return (quoteOut * (BPS - slippageBps)) / BPS;
}

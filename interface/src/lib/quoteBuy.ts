/** Pons V2 curve local quote — mirrors contractsV2 buy math / docs Qoute.md. */

export const BPS = 10_000n;

export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  return (a + b - 1n) / b;
}

export function amountOut(
  inAmount: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (inAmount === 0n || reserveIn === 0n || reserveOut === 0n) return 0n;
  return (inAmount * reserveOut) / (reserveIn + inAmount);
}

export function amountIn(
  outAmount: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (outAmount === 0n || reserveIn === 0n || reserveOut === 0n) return 0n;
  if (outAmount >= reserveOut) return 0n;
  return (outAmount * reserveIn) / (reserveOut - outAmount) + 1n;
}

export type CurveQuoteState = {
  quoteReserve: bigint;
  tokenReserve: bigint;
  sellable: bigint;
  feeBps: bigint;
  creatorTaxBps: bigint;
  /** 0 when method missing on deployed curve. */
  snipeBps: bigint;
};

export type QuoteBuyResult = {
  tokensOut: bigint;
  spent: bigint;
  refund: bigint;
  fee: bigint;
  tax: bigint;
  snipeTax: bigint;
  snipeBpsUsed: bigint;
};

/**
 * Local buy quote: deduct fees from quoteIn, constant-product, clamp to sellable.
 * Matches Qoute.md; snipeBps may be 0 to match Solidity buy() without snipe.
 */
export function quoteBuyFromState(
  quoteIn: bigint,
  state: CurveQuoteState
): QuoteBuyResult {
  if (quoteIn <= 0n) {
    return {
      tokensOut: 0n,
      spent: 0n,
      refund: 0n,
      fee: 0n,
      tax: 0n,
      snipeTax: 0n,
      snipeBpsUsed: 0n
    };
  }

  const { quoteReserve, tokenReserve, sellable, feeBps, creatorTaxBps } = state;

  let snipeBps = state.snipeBps;
  if (snipeBps > 0n) {
    const maxSnipeBps = BPS - feeBps - creatorTaxBps - 100n;
    if (maxSnipeBps > 0n && snipeBps > maxSnipeBps) {
      snipeBps = maxSnipeBps;
    }
    if (maxSnipeBps <= 0n) snipeBps = 0n;
  }

  let spent = quoteIn;
  let fee = (spent * feeBps) / BPS;
  let tax = (spent * creatorTaxBps) / BPS;
  let snipeTax = (spent * snipeBps) / BPS;

  let tokensOut = amountOut(
    spent - fee - tax - snipeTax,
    quoteReserve,
    tokenReserve
  );

  if (sellable > 0n && tokensOut > sellable) {
    tokensOut = sellable;
    const net = amountIn(sellable, quoteReserve, tokenReserve);
    const denom = BPS - feeBps - creatorTaxBps - snipeBps;
    if (denom > 0n && net > 0n) {
      const grossed = ceilDiv(net * BPS, denom);
      spent = grossed < quoteIn ? grossed : quoteIn;
      fee = (spent * feeBps) / BPS;
      tax = (spent * creatorTaxBps) / BPS;
      snipeTax = (spent * snipeBps) / BPS;
    }
  }

  return {
    tokensOut,
    spent,
    refund: quoteIn - spent,
    fee,
    tax,
    snipeTax,
    snipeBpsUsed: snipeBps
  };
}

export function minTokensOutWithSlippage(
  tokensOut: bigint,
  slippageBps = 100n
): bigint {
  if (tokensOut === 0n) return 0n;
  if (slippageBps >= BPS) return 0n;
  return (tokensOut * (BPS - slippageBps)) / BPS;
}

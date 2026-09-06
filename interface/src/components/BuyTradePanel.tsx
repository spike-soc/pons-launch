import { ArrowDownUp, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatEther, parseEther, type Address } from 'viem';
import { useBalance } from 'wagmi';
import { useCurveBuy } from '../hooks/useCurveBuy';
import { useCurveBuyQuote } from '../hooks/useCurveBuyQuote';
import type { MemeLaunchCardData } from '../hooks/useMemeLaunchCards';
import { formatEthBalance, formatTokenAmount } from '../lib/format';
import { resolveLogoUrl } from '../lib/meme';

type BuyTradePanelProps = {
  item: MemeLaunchCardData;
  authenticated: boolean;
  walletAddress?: string;
  chainReady: boolean;
  onClose: () => void;
  onLogin?: () => void;
};

function parseEthInput(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0n;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

export function BuyTradePanel({
  item,
  authenticated,
  walletAddress,
  chainReady,
  onClose,
  onLogin
}: BuyTradePanelProps) {
  const [sellEth, setSellEth] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const recipient = walletAddress as Address | undefined;
  const quoteIn = useMemo(() => parseEthInput(sellEth), [sellEth]);
  const quoteInSafe = quoteIn ?? 0n;

  const {
    quote,
    raised,
    graduationThreshold,
    progressPct,
    graduated,
    isLoading: quoteLoading
  } = useCurveBuyQuote({
    curve: item.curve,
    recipient,
    quoteIn: quoteInSafe,
    enabled: Boolean(item.curve)
  });

  const { data: ethBalance } = useBalance({
    address: recipient,
    query: { enabled: Boolean(recipient) }
  });

  const {
    buy,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    errorMessage,
    reset
  } = useCurveBuy();

  const logoSrc = resolveLogoUrl(item.logo);
  const availableEth = ethBalance?.value ?? 0n;
  const tokensOut = quote?.tokensOut ?? 0n;

  const raisedEth = formatEther(raised);
  const thresholdEth = formatEther(graduationThreshold);
  const tokensOutDisplay =
    tokensOut > 0n ? formatTokenAmount(tokensOut, 18, 4) : '0';

  function setPct(pct: number) {
    if (availableEth === 0n) {
      setSellEth('0');
      return;
    }
    const amount = (availableEth * BigInt(pct)) / 100n;
    setSellEth(formatEther(amount));
    setLocalError(null);
    reset();
  }

  function setMax() {
    setPct(100);
  }

  async function onConfirmBuy() {
    setLocalError(null);
    reset();

    if (!authenticated || !recipient) {
      onLogin?.();
      setLocalError('Connect wallet first');
      return;
    }
    if (!chainReady) {
      setLocalError('Switch to Robinhood Chain');
      return;
    }
    if (!item.curve) {
      setLocalError('Curve address unavailable');
      return;
    }
    if (graduated || item.graduated) {
      setLocalError('Curve already graduated');
      return;
    }
    if (quoteIn === null) {
      setLocalError('Invalid ETH amount');
      return;
    }
    if (quoteIn <= 0n) {
      setLocalError('Enter an ETH amount');
      return;
    }
    if (!quote || quote.tokensOut <= 0n) {
      setLocalError(quoteLoading ? 'Quote loading…' : 'Quote is zero');
      return;
    }

    console.log('[buy]', 'step:1 confirm', {
      token: item.token,
      curve: item.curve,
      sellEth,
      quoteIn: quoteIn.toString(),
      quote
    });

    try {
      await buy({
        curve: item.curve,
        quoteIn,
        tokensOut: quote.tokensOut,
        recipient
      });
    } catch {
      // errorMessage set in hook
    }
  }

  const ctaLabel = !authenticated
    ? 'Connect wallet'
    : isPending || isConfirming
      ? 'Confirm in wallet…'
      : isSuccess
        ? 'Bought'
        : `Buy ${item.symbol}`;

  const busy = isPending || isConfirming;

  return (
    <section className="buy-panel" aria-label={`Buy ${item.symbol}`}>
      <header className="buy-panel-head">
        <div className="buy-panel-token">
          <span className="buy-panel-logo">
            {logoSrc ? (
              <img src={logoSrc} alt={item.name} />
            ) : (
              <span>{item.symbol.slice(0, 2)}</span>
            )}
          </span>
          <div>
            <h2>{item.name}</h2>
            <p>
              {item.symbol}
              <em>Paired ETH</em>
            </p>
          </div>
        </div>
        <button
          className="buy-panel-close"
          type="button"
          aria-label="Close buy panel"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>

      <div className="buy-panel-curve">
        <div className="buy-panel-curve-row">
          <span>Bonding curve</span>
          <strong>{progressPct.toFixed(0)}% to graduation</strong>
        </div>
        <div className="buy-panel-curve-track">
          <span style={{ width: `${Math.min(100, progressPct)}%` }} />
        </div>
        <p className="buy-panel-curve-note">
          {Number(raisedEth).toLocaleString(undefined, { maximumFractionDigits: 6 })} of{' '}
          {Number(thresholdEth).toLocaleString(undefined, { maximumFractionDigits: 2 })} ETH
          raised. At the threshold the curve closes and liquidity moves to a Uniswap v4 pool.
        </p>
      </div>

      <div className="buy-panel-legs">
        <div className="buy-leg">
          <div className="buy-leg-top">
            <span>Sell</span>
          </div>
          <div className="buy-leg-main">
            <input
              className="buy-leg-amount"
              inputMode="decimal"
              placeholder="0"
              value={sellEth}
              onChange={(e) => {
                setSellEth(e.target.value);
                setLocalError(null);
                reset();
              }}
            />
            <div className="buy-leg-asset">
              <span className="buy-asset-pill">
                <span className="buy-asset-eth" aria-hidden>
                  ◆
                </span>
                ETH
              </span>
            </div>
          </div>
          <div className="buy-leg-meta">
            <span>$0.00</span>
            <span className="buy-leg-avail">
              {formatEthBalance(availableEth)} available
              <button className="buy-max-btn" type="button" onClick={setMax}>
                Max
              </button>
            </span>
          </div>
        </div>

        <div className="buy-swap-icon" aria-hidden>
          <ArrowDownUp size={16} />
        </div>

        <div className="buy-leg">
          <div className="buy-leg-top">
            <span>Buy</span>
          </div>
          <div className="buy-leg-main">
            <div className="buy-leg-amount buy-leg-amount-ro">
              {quoteLoading && quoteInSafe > 0n ? '…' : tokensOutDisplay}
            </div>
            <div className="buy-leg-asset">
              <span className="buy-asset-pill">{item.symbol}</span>
            </div>
          </div>
          <div className="buy-leg-meta">
            <span>$0.00</span>
            <span className="buy-leg-avail">0 available</span>
          </div>
        </div>
      </div>

      <div className="buy-pct-row">
        {[25, 50, 75].map((pct) => (
          <button
            key={pct}
            className="buy-pct-btn"
            type="button"
            onClick={() => setPct(pct)}
          >
            {pct}%
          </button>
        ))}
        <button className="buy-pct-btn" type="button" onClick={setMax}>
          Max
        </button>
      </div>

      {(localError || errorMessage) && (
        <p className="buy-panel-error">{localError || errorMessage}</p>
      )}
      {hash ? (
        <p className="buy-panel-hash">
          tx {hash.slice(0, 10)}…{hash.slice(-6)}
          {isSuccess ? ' · confirmed' : isConfirming ? ' · confirming…' : ''}
        </p>
      ) : null}

      <button
        className="buy-cta"
        type="button"
        disabled={busy || graduated || item.graduated || !item.curve}
        onClick={() => void onConfirmBuy()}
      >
        {ctaLabel}
      </button>
    </section>
  );
}

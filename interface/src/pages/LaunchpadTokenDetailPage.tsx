import { ArrowDownUp, Copy, DollarSign, ExternalLink, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  erc20Abi,
  formatEther,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
  type Address
} from 'viem';
import { useBalance, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import type { AuthView } from '../hooks/useSyncedPrivyAuth';
import { useCreatorFeeActions } from '../hooks/useCreatorFeeActions';
import { useCreatorFees } from '../hooks/useCreatorFees';
import { useCurveBuy } from '../hooks/useCurveBuy';
import { useCurveBuyQuote } from '../hooks/useCurveBuyQuote';
import { useCurveSell } from '../hooks/useCurveSell';
import { useCurveSellQuote } from '../hooks/useCurveSellQuote';
import {
  type LaunchpadTokenDetail,
  useLaunchpadTokenDetail
} from '../hooks/useLaunchpadTokenDetail';
import { robinhoodChain } from '../constants/chain';
import { logContractRead } from '../lib/contractDebug';
import { formatAddress, formatTokenAmount } from '../lib/format';
import { resolveLogoUrl } from '../lib/meme';

type LaunchpadTokenDetailPageProps = {
  auth: AuthView;
};

type TradeMode = 'buy' | 'sell';

function parseDecimalInput(
  raw: string,
  parser: (value: string) => bigint,
  decimals: number
): bigint | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0n;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const [whole, fraction = ''] = trimmed.split('.');
  const normalized =
    fraction.length > decimals
      ? `${whole}.${fraction.slice(0, decimals)}`
      : trimmed;

  try {
    return parser(normalized);
  } catch {
    return null;
  }
}

function formatFillUnits(value: bigint, decimals: number, fractionDigits: number) {
  const raw = formatUnits(value, decimals);
  const [whole, fraction = ''] = raw.split('.');
  const trimmedFraction = fraction.slice(0, fractionDigits).replace(/0+$/, '');
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function GraduationProgress({ detail }: { detail: LaunchpadTokenDetail }) {
  const raised = Number(formatEther(detail.realQuoteReserve ?? 0n));
  const threshold = Number(formatEther(detail.graduationThreshold ?? 0n));
  const progress =
    threshold > 0 ? Math.min(100, Math.max(0, (raised / threshold) * 100)) : 0;

  return (
    <div className="detail-curve-box">
      <div className="detail-curve-row">
        <span>Bonding curve</span>
        <strong>{progress.toFixed(0)}% to graduation</strong>
      </div>
      <div className="detail-curve-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p>
        {formatTokenAmount(detail.realQuoteReserve, 18, 6)} of{' '}
        {formatTokenAmount(detail.graduationThreshold, 18, 2)} ETH raised. At
        the threshold the curve closes and liquidity moves to a Uniswap v4 pool.
      </p>
    </div>
  );
}

function TokenHeader({ detail }: { detail: LaunchpadTokenDetail }) {
  const logoUrl = resolveLogoUrl(detail.logo);
  const creatorTaxPct = detail.creatorTaxBps
    ? `${(Number(detail.creatorTaxBps) / 100).toFixed(2)}%`
    : '0.00%';

  return (
    <section className="detail-card token-about">
      <div>
        <h1>About</h1>
        <p className="token-about-desc">
          {detail.description ||
            `${detail.name} (${detail.symbol}) is a fixed-supply meme token launched via pons v2.`}
        </p>
        <p className="token-about-meta">
          Creator {formatAddress(detail.creator)} · {creatorTaxPct} creator tax
        </p>
      </div>

      <div className="token-about-supply">
        <span>Supply</span>
        <strong>{formatTokenAmount(detail.totalSupply, detail.decimals, 0)}</strong>
        <em>{detail.symbol}</em>
        <small>fixed at launch</small>
      </div>

      <div className="token-about-pair">
        <span>Paired ETH</span>
        <button type="button" className="detail-pill">
          {formatAddress(detail.token)}
          <Copy size={14} />
        </button>
        <div className="detail-pill-row">
          <a
            className="detail-pill"
            href={`${robinhoodChain.blockExplorers.default.url}/address/${detail.token}`}
            target="_blank"
            rel="noreferrer"
          >
            Explorer
            <ExternalLink size={14} />
          </a>
          {detail.socials.telegram ? (
            <a className="detail-pill" href={detail.socials.telegram} target="_blank" rel="noreferrer">
              Telegram
            </a>
          ) : null}
        </div>
      </div>

      {logoUrl ? (
        <div className="token-about-media">
          <img src={logoUrl} alt={detail.name} />
          <div>
            <strong>{detail.name}</strong>
            <span>{detail.symbol}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CreatorFeesCard({
  detail,
  factory,
  auth,
  onRefetch
}: {
  detail: LaunchpadTokenDetail;
  factory: Address;
  auth: AuthView;
  onRefetch: () => Promise<void>;
}) {
  const fees = useCreatorFees({ detail, walletAddress: auth.walletAddress });
  const actions = useCreatorFeeActions({
    token: detail.token,
    curve: detail.curve,
    factory,
    feeEscrow: fees.feeEscrow,
    quoteToken: fees.quoteToken,
    isNativeQuote: detail.isNativeQuote,
    canCollectCurveFees: fees.canCollectCurveFees,
    canClaimQuote: fees.canClaimQuote,
    canTransfer: fees.canTransfer,
    collectBlockedReason: fees.collectBlockedReason
  });
  const refetchFees = fees.refetch;
  const [newRecipient, setNewRecipient] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const quoteSymbol = detail.isNativeQuote ? 'ETH' : 'QUOTE';
  const busy = actions.isPending || actions.isConfirming;

  useEffect(() => {
    if (!actions.isSuccess) return;
    setMessage('Transaction confirmed');
    void onRefetch();
    void refetchFees();
  }, [actions.isSuccess, onRefetch, refetchFees]);

  async function handleCollect() {
    setMessage(null);
    try {
      await actions.collectCurveFees();
      setMessage('Collect transaction submitted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Collect failed');
    }
  }

  async function handleClaim() {
    setMessage(null);
    try {
      await actions.claimQuote();
      setMessage('Claim transaction submitted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Claim failed');
    }
  }

  async function handleTransfer() {
    setMessage(null);
    try {
      await actions.transfer(newRecipient);
      setNewRecipient('');
      setMessage('Transfer transaction submitted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Transfer failed');
    }
  }

  return (
    <>
      <section className="detail-card fees-card">
        <div className="fees-title">
          <span className="fees-icon">
            <DollarSign size={24} />
          </span>
          <h2>Creator fees</h2>
        </div>

        <div className="fees-stats">
          <div className="fees-stat">
            <strong>{formatTokenAmount(fees.pendingCreatorEstimate, 18, 6)} {quoteSymbol}</strong>
            <span>Earned by {detail.symbol}</span>
          </div>
          <div className="fees-stat">
            <strong>{formatTokenAmount(fees.claimableQuote, 18, 6)} {quoteSymbol}</strong>
            <span>
              Claimable now, paid to {formatAddress(detail.creatorFeeRecipient)}
            </span>
          </div>
        </div>

        {!fees.routesToHolders ? (
          <div className="fee-recipient-row">
            <div>
              <span>Fee recipient</span>
              <strong>{formatAddress(detail.creatorFeeRecipient)}</strong>
            </div>
            {fees.canTransfer ? (
              <div className="transfer-inline">
                <input
                  value={newRecipient}
                  placeholder="0x recipient"
                  onChange={(event) => setNewRecipient(event.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !isAddress(newRecipient)}
                  onClick={() => void handleTransfer()}
                >
                  Transfer
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="fee-actions">
          <button
            type="button"
            className="fee-secondary"
            disabled={busy || !fees.canCollectCurveFees}
            title={fees.collectBlockedReason ?? undefined}
            onClick={() => void handleCollect()}
          >
            Collect curve fees
          </button>
          <button
            type="button"
            className="fee-primary"
            disabled={busy || !fees.canClaimQuote}
            onClick={() => void handleClaim()}
          >
            Claim {quoteSymbol}
          </button>
        </div>

        {actions.errorMessage || message ? (
          <p className="fees-message">{actions.errorMessage || message}</p>
        ) : null}
      </section>

      <section className="detail-card fees-card">
        <div className="fees-title">
          <span className="fees-icon">
            <Users size={24} />
          </span>
          <h2>Holder fee sharing</h2>
        </div>
        <p className="holder-note">
          {detail.symbol} pays creator fees to {formatAddress(detail.creatorFeeRecipient)}.
          Holder distributor integration requires the distributor factory address
          and ABI.
        </p>
      </section>
    </>
  );
}

function DetailTradePanel({
  detail,
  auth
}: {
  detail: LaunchpadTokenDetail;
  auth: AuthView;
}) {
  const publicClient = usePublicClient();
  const [mode, setMode] = useState<TradeMode>('buy');
  const [amount, setAmount] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const recipient = auth.walletAddress as Address | undefined;
  const quoteIn = useMemo(() => parseDecimalInput(amount, parseEther, 18), [amount]);
  const tokensIn = useMemo(
    () =>
      parseDecimalInput(
        amount,
        (value) => parseUnits(value, detail.decimals),
        detail.decimals
      ),
    [amount, detail.decimals]
  );

  const { data: ethBalance } = useBalance({
    address: recipient,
    query: { enabled: Boolean(recipient) }
  });
  const tokenBalance = useReadContract({
    address: detail.token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: recipient ? [recipient] : undefined,
    query: { enabled: Boolean(recipient) }
  });
  const allowance = useReadContract({
    address: detail.token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: recipient && detail.curve ? [recipient, detail.curve] : undefined,
    query: { enabled: Boolean(recipient && detail.curve && mode === 'sell') }
  });
  const approveWrite = useWriteContract();
  const buyQuote = useCurveBuyQuote({
    curve: detail.curve,
    recipient,
    quoteIn: mode === 'buy' ? (quoteIn ?? 0n) : 0n,
    enabled: Boolean(detail.curve)
  });
  const sellQuote = useCurveSellQuote({
    curve: detail.curve,
    tokensIn: mode === 'sell' ? (tokensIn ?? 0n) : 0n,
    enabled: Boolean(detail.curve)
  });
  const buyTx = useCurveBuy();
  const sellTx = useCurveSell();

  useEffect(() => {
    if (!recipient) return;

    logContractRead({
      scope: 'TradePanel',
      contract: detail.token,
      method: 'Token.balanceOf',
      args: [recipient],
      row: {
        status: tokenBalance.isSuccess
          ? 'success'
          : tokenBalance.isError
            ? 'error'
            : tokenBalance.isLoading
              ? 'loading'
              : 'idle',
        result: tokenBalance.data,
        error: tokenBalance.error
      },
      fields: {
        account: '当前连接钱包地址',
        return: '钱包持有的 meme token 数量，单位 token 最小精度',
        display: 'Sell 输入框 available 和余额不足校验'
      }
    });

    if (!detail.curve || mode !== 'sell') return;

    logContractRead({
      scope: 'TradePanel',
      contract: detail.token,
      method: 'Token.allowance',
      args: [recipient, detail.curve],
      row: {
        status: allowance.isSuccess
          ? 'success'
          : allowance.isError
            ? 'error'
            : allowance.isLoading
              ? 'loading'
              : 'idle',
        result: allowance.data,
        error: allowance.error
      },
      fields: {
        owner: '当前连接钱包地址',
        spender: '当前 token 的 bonding curve 地址',
        return: '钱包授权 curve 可划走的 meme token 数量',
        display: 'Sell 提交前判断是否需要先 approve'
      }
    });
  }, [
    recipient,
    detail.token,
    detail.curve,
    mode,
    tokenBalance.data,
    tokenBalance.error,
    tokenBalance.isSuccess,
    tokenBalance.isError,
    tokenBalance.isLoading,
    allowance.data,
    allowance.error,
    allowance.isSuccess,
    allowance.isError,
    allowance.isLoading
  ]);

  const quoteAsset = detail.isNativeQuote ? 'ETH' : 'PAIR';
  const inputSymbol = mode === 'buy' ? quoteAsset : detail.symbol;
  const outputSymbol = mode === 'buy' ? detail.symbol : quoteAsset;
  const inputAmount = mode === 'buy' ? quoteIn : tokensIn;
  const outputAmount =
    mode === 'buy' ? buyQuote.quote?.tokensOut : sellQuote.quote?.quoteOut;
  const inputBalance =
    mode === 'buy' ? ethBalance?.value : (tokenBalance.data as bigint | undefined);
  const inputDecimals = mode === 'buy' ? 18 : detail.decimals;
  const outputDecimals = mode === 'buy' ? detail.decimals : 18;
  const outputDisplay = formatTokenAmount(outputAmount, outputDecimals, 6);
  const tradeBusy =
    buyTx.isPending ||
    buyTx.isConfirming ||
    sellTx.isPending ||
    sellTx.isConfirming ||
    approveWrite.isPending;
  const tradeError = localError || buyTx.errorMessage || sellTx.errorMessage || null;
  const isClosed = detail.graduated || detail.readyToGraduate || sellQuote.isSellClosed;

  function handleSwitchMode() {
    setMode((current) => (current === 'buy' ? 'sell' : 'buy'));
    setAmount('');
    setLocalError(null);
    buyTx.reset();
    sellTx.reset();
  }

  function handleFillPct(pct: number) {
    if (!inputBalance) {
      setAmount('0');
      return;
    }

    const nextAmount = (inputBalance * BigInt(pct)) / 100n;
    setAmount(formatFillUnits(nextAmount, inputDecimals, mode === 'buy' ? 8 : 4));
    setLocalError(null);
    buyTx.reset();
    sellTx.reset();
  }

  async function handleSubmit() {
    setLocalError(null);
    buyTx.reset();
    sellTx.reset();

    if (!auth.authenticated || !recipient) {
      auth.onAuthClick();
      setLocalError('Connect wallet first');
      return;
    }
    if (!auth.chainReady) {
      setLocalError('Switch to Robinhood Chain');
      return;
    }
    if (!detail.curve) {
      setLocalError('Curve address unavailable');
      return;
    }
    if (!detail.isNativeQuote) {
      setLocalError('Only ETH pair trading is supported here');
      return;
    }
    if (inputAmount === null) {
      setLocalError('Enter a valid amount');
      return;
    }
    if (inputAmount <= 0n) {
      setLocalError('Enter an amount');
      return;
    }
    if (inputBalance !== undefined && inputAmount > inputBalance) {
      setLocalError('Insufficient balance');
      return;
    }
    if (isClosed) {
      setLocalError('Curve is closed');
      return;
    }

    try {
      if (mode === 'buy') {
        if (!buyQuote.quote || buyQuote.quote.tokensOut <= 0n) {
          setLocalError(buyQuote.isLoading ? 'Quote loading…' : 'Quote is zero');
          return;
        }
        await buyTx.buy({
          curve: detail.curve,
          quoteIn: inputAmount,
          tokensOut: buyQuote.quote.tokensOut,
          recipient
        });
        return;
      }

      if (!sellQuote.quote || sellQuote.quote.quoteOut <= 0n) {
        setLocalError(sellQuote.isLoading ? 'Quote loading…' : 'Quote is zero');
        return;
      }

      if ((allowance.data ?? 0n) < inputAmount) {
        const approveHash = await approveWrite.writeContractAsync({
          address: detail.token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [detail.curve, inputAmount]
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
        await allowance.refetch();
      }

      await sellTx.sell({
        curve: detail.curve,
        tokensIn: inputAmount,
        quoteOut: sellQuote.quote.quoteOut,
        recipient
      });
    } catch {
      // hook errorMessage is rendered below
    }
  }

  const ctaLabel = !auth.authenticated
    ? 'Connect wallet'
    : tradeBusy
      ? 'Confirm in wallet…'
      : mode === 'buy'
        ? `Buy ${detail.symbol}`
        : `Sell ${detail.symbol}`;

  return (
    <section className="buy-panel detail-trade-panel" aria-label="Trade token">
      <header className="buy-panel-head">
        <div className="buy-panel-token">
          <span className="buy-panel-logo">
            {resolveLogoUrl(detail.logo) ? (
              <img src={resolveLogoUrl(detail.logo)} alt={detail.name} />
            ) : (
              <span>{detail.symbol.slice(0, 2)}</span>
            )}
          </span>
          <div>
            <h2>{detail.name}</h2>
            <p>
              {detail.symbol}
              <em>Paired {quoteAsset}</em>
            </p>
          </div>
        </div>
      </header>

      {!detail.graduated ? <GraduationProgress detail={detail} /> : null}

      <div className="buy-panel-legs">
        <div className="buy-leg">
          <div className="buy-leg-top">
            <span>{mode === 'buy' ? 'Sell' : 'Sell'}</span>
            <span>{formatTokenAmount(inputBalance, inputDecimals, 6)} available</span>
          </div>
          <div className="buy-leg-main">
            <input
              className="buy-leg-amount"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setLocalError(null);
                buyTx.reset();
                sellTx.reset();
              }}
            />
            <div className="buy-leg-asset">
              <span className="buy-asset-pill">{inputSymbol}</span>
            </div>
          </div>
        </div>

        <button
          className="buy-swap-icon"
          type="button"
          aria-label="Switch trade mode"
          onClick={handleSwitchMode}
        >
          <ArrowDownUp size={16} />
        </button>

        <div className="buy-leg">
          <div className="buy-leg-top">
            <span>{mode === 'buy' ? 'Buy' : 'Buy'}</span>
            <span>{outputSymbol}</span>
          </div>
          <div className="buy-leg-main">
            <div className="buy-leg-amount buy-leg-amount-ro">
              {(mode === 'buy' && buyQuote.isLoading) ||
              (mode === 'sell' && sellQuote.isLoading)
                ? '…'
                : outputDisplay}
            </div>
            <div className="buy-leg-asset">
              <span className="buy-asset-pill">{outputSymbol}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="buy-pct-row">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            className="buy-pct-btn"
            type="button"
            onClick={() => handleFillPct(pct)}
          >
            {pct === 100 ? 'Max' : `${pct}%`}
          </button>
        ))}
      </div>

      {tradeError ? <p className="buy-panel-error">{tradeError}</p> : null}
      {buyTx.hash || sellTx.hash ? (
        <p className="buy-panel-hash">
          tx {(buyTx.hash ?? sellTx.hash)?.slice(0, 10)}…
          {(buyTx.hash ?? sellTx.hash)?.slice(-6)}
        </p>
      ) : null}

      <button
        className="buy-cta"
        type="button"
        disabled={tradeBusy || isClosed}
        onClick={() => void handleSubmit()}
      >
        {ctaLabel}
      </button>
    </section>
  );
}

export function LaunchpadTokenDetailPage({ auth }: LaunchpadTokenDetailPageProps) {
  const params = useParams();
  const memeAddress = params.memeAddress;
  const token = memeAddress && isAddress(memeAddress) ? (memeAddress as Address) : undefined;
  const { detail, factory, isLoading, isError, refetch } =
    useLaunchpadTokenDetail(token);

  if (!token) {
    return (
      <section className="detail-page">
        <div className="detail-card">Invalid token address.</div>
      </section>
    );
  }

  if (isLoading && !detail) {
    return (
      <section className="detail-page">
        <div className="detail-card">Loading token…</div>
      </section>
    );
  }

  if (isError || !detail || !detail.exists) {
    return (
      <section className="detail-page">
        <div className="detail-card detail-error">
          <p>Token information failed to load.</p>
          <button type="button" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="detail-page">
      <Link className="detail-back" to="/memes">
        Back to launches
      </Link>

      <TokenHeader detail={detail} />

      <CreatorFeesCard
        detail={detail}
        factory={factory}
        auth={auth}
        onRefetch={refetch}
      />

      <div className="detail-trade-grid">
        <DetailTradePanel detail={detail} auth={auth} />
      </div>
    </section>
  );
}

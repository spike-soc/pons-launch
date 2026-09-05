import { ChevronDown, ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatEther, type Address, zeroAddress } from 'viem';
import { useLaunchPrep } from '../hooks/useLaunchPrep';
import { useLaunchToken } from '../hooks/useLaunchToken';
import {
  LAUNCH_METADATA_LIMITS,
  parseAddressListStrict,
  parseOptionalAddressStrict,
  parseQuoteInEth,
  percentToCreatorTaxBps,
  randomSalt,
  validateLaunchMetadata
} from '../lib/launch';
import { resolveLogoUrl } from '../lib/meme';

export type LaunchPreviewState = {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  graduationEth?: string;
  tradeFeePct?: string;
  launchFeeEth?: string;
};

type LaunchTokenFormProps = {
  authenticated: boolean;
  walletAddress?: string;
  chainReady: boolean;
  reconnecting?: boolean;
  onPreviewChange?: (preview: LaunchPreviewState) => void;
};

function FieldLabel({ en, zh, param }: { en: string; zh: string; param: string }) {
  return (
    <span className="field-label">
      {en} {zh}
      <em>（{param}）</em>
    </span>
  );
}

export function LaunchTokenForm({
  authenticated,
  walletAddress,
  chainReady,
  reconnecting = false,
  onPreviewChange
}: LaunchTokenFormProps) {
  const defaultImageUrl =
    import.meta.env.VITE_IMAGE_URL ||
    'ipfs://bafkreigimpy4z33vrasjxx5y2tolroswe576booatc3nd622rdp6au3jae';
  const [name, setName] = useState('SPIKE ICE');
  const [symbol, setSymbol] = useState('SPI');
  const [description, setDescription] = useState(
    'SPIKE ICE (SPI) is a fixed-supply meme token on Robinhood Chain, launched via pons v2.'
  );
  const [logo, setLogo] = useState(defaultImageUrl);
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');
  const [discord, setDiscord] = useState('');
  const [website, setWebsite] = useState('');
  const [farcaster, setFarcaster] = useState('');
  const [developerBuy, setDeveloperBuy] = useState('');
  const [creatorFeeRecipient, setCreatorFeeRecipient] = useState('');
  const [recipient, setRecipient] = useState('');
  /** UI percent; converted to creatorTaxBps on submit (1% = 100 bps). */
  const [creatorTaxPercent, setCreatorTaxPercent] = useState('0');
  const [buybackEnabled, setBuybackEnabled] = useState(true);
  const [salt, setSalt] = useState<string>(() => randomSalt());
  const [exemptionsRaw, setExemptionsRaw] = useState('');
  /** Demo: no curve quote yet — leave 0 or set manually. */
  const [minTokensOut, setMinTokensOut] = useState('0');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const pairToken = zeroAddress as Address;

  const prep = useLaunchPrep({
    account: walletAddress,
    preferredLaunchConfigId: 0n,
    pairToken
  });

  const { launch, isPending, isConfirming, isSuccess, hash, errorMessage } = useLaunchToken();

  const feeRecipientDefault = (walletAddress as Address | undefined) ?? zeroAddress;
  const displayName = name.trim() || 'Your token';
  const hasImage = Boolean(logo.trim());
  const logoPreview = resolveLogoUrl(logo.trim()) || logo.trim();

  const graduationEth =
    prep.selectedConfig !== undefined
      ? formatEther(prep.selectedConfig.graduationThreshold)
      : undefined;
  const tradeFeePct =
    prep.selectedConfig !== undefined
      ? (Number(prep.selectedConfig.curveFeeBps) / 100).toFixed(2)
      : undefined;

  useEffect(() => {
    onPreviewChange?.({
      name,
      symbol,
      logo,
      description,
      graduationEth,
      tradeFeePct,
      launchFeeEth: prep.launchFeeEth
    });
  }, [
    name,
    symbol,
    logo,
    description,
    graduationEth,
    tradeFeePct,
    prep.launchFeeEth,
    onPreviewChange
  ]);

  const formReady = Boolean(name.trim() && symbol.trim() && description.trim() && authenticated);
  const gateOk = !authenticated || (prep.canLaunch && chainReady);
  const canSubmit =
    formReady &&
    gateOk &&
    prep.selectedConfig?.enabled === true &&
    prep.launchFee !== undefined &&
    prep.expectedEconomics !== undefined &&
    !isPending &&
    !isConfirming;

  const quotePreview = parseQuoteInEth(developerBuy);
  const quoteInPreview = quotePreview.ok ? quotePreview.value : 0n;

  const statusText = !authenticated
    ? 'Login to launch'
    : reconnecting
      ? 'Reconnecting wallet…'
      : !chainReady
        ? 'Wrong chain'
        : !prep.canLaunch && !prep.isLoading
          ? 'Not whitelisted'
          : !prep.selectedConfig
            ? 'No open launch config'
            : isPending || isConfirming
              ? 'Confirm in wallet…'
              : isSuccess
                ? 'Launched'
                : canSubmit
                  ? quoteInPreview > 0n
                    ? 'Launch and buy'
                    : 'Launch token'
                  : 'Fill token details';

  async function onLaunchClick() {
    // Explicit user gesture only — do not bind to form onSubmit (Enter key).
    await runLaunch();
  }

  async function runLaunch() {
    setLocalError(null);
    console.log('[launch]', 'step:1 launch button clicked', {
      authenticated,
      walletAddress,
      chainReady,
      canLaunch: prep.canLaunch,
      selectedConfig: prep.selectedConfig,
      launchFee: prep.launchFee?.toString(),
      expectedEconomics: prep.expectedEconomics,
      form: {
        name,
        symbol,
        description,
        logo,
        twitter,
        telegram,
        discord,
        website,
        farcaster,
        developerBuy,
        creatorFeeRecipient,
        recipient,
        creatorTaxPercent,
        buybackEnabled,
        salt,
        exemptionsRaw,
        minTokensOut
      }
    });

    if (!authenticated || !walletAddress) {
      console.warn('[launch]', 'step:1 abort — not authenticated');
      setLocalError('Connect wallet first');
      return;
    }
    if (!chainReady) {
      console.warn('[launch]', 'step:1 abort — wrong chain');
      setLocalError('Switch to Robinhood Chain before launching');
      return;
    }
    if (!prep.canLaunch) {
      console.warn('[launch]', 'step:1 abort — canLaunch=false');
      setLocalError('Wallet cannot launch（canLaunch=false）');
      return;
    }
    if (!prep.selectedConfig?.enabled) {
      console.warn('[launch]', 'step:1 abort — no enabled config');
      setLocalError('No enabled launch config available');
      return;
    }
    if (prep.launchFee === undefined) {
      console.warn('[launch]', 'step:1 abort — launchFee loading');
      setLocalError('Launch prep still loading');
      return;
    }

    console.log('[launch]', 'step:2 parse quoteIn', { developerBuy });
    const quoteParsed = parseQuoteInEth(developerBuy);
    if (!quoteParsed.ok) {
      console.warn('[launch]', 'step:2 abort', quoteParsed.error);
      setLocalError(quoteParsed.error);
      return;
    }
    const quoteIn = quoteParsed.value;
    console.log('[launch]', 'step:2 quoteIn ok', {
      quoteIn: quoteIn.toString(),
      path: quoteIn > 0n ? 'launchAndBuy' : 'launchToken'
    });

    console.log('[launch]', 'step:3 parse creator tax %', { creatorTaxPercent });
    const taxParsed = percentToCreatorTaxBps(creatorTaxPercent, prep.maxCreatorTaxBps);
    if (!taxParsed.ok) {
      console.warn('[launch]', 'step:3 abort', taxParsed.error);
      setLocalError(taxParsed.error);
      return;
    }
    console.log('[launch]', 'step:3 creatorTaxBps', taxParsed.bps);

    let minOut = 0n;
    try {
      minOut = BigInt(minTokensOut.trim() || '0');
      console.log('[launch]', 'step:4 minTokensOut', minOut.toString());
    } catch {
      console.warn('[launch]', 'step:4 abort Invalid minTokensOut');
      setLocalError('Invalid minTokensOut');
      return;
    }
    if (quoteIn > 0n && minOut === 0n) {
      console.warn(
        '[launch]',
        'step:4 note — quoteIn>0 but minTokensOut=0 (demo, no slippage protection)'
      );
    }

    console.log('[launch]', 'step:5 parse addresses', {
      creatorFeeRecipient,
      recipient,
      exemptionsRaw
    });
    const feeRecipientParsed = parseOptionalAddressStrict(
      creatorFeeRecipient,
      feeRecipientDefault
    );
    if (!feeRecipientParsed.ok) {
      console.warn('[launch]', 'step:5 abort fee recipient', feeRecipientParsed.error);
      setLocalError(`creatorFeeRecipient: ${feeRecipientParsed.error}`);
      return;
    }

    const buyRecipientParsed = parseOptionalAddressStrict(recipient, feeRecipientDefault);
    if (!buyRecipientParsed.ok) {
      console.warn('[launch]', 'step:5 abort recipient', buyRecipientParsed.error);
      setLocalError(`recipient: ${buyRecipientParsed.error}`);
      return;
    }

    const exemptionsParsed = parseAddressListStrict(exemptionsRaw);
    if (!exemptionsParsed.ok) {
      console.warn('[launch]', 'step:5 abort exemptions', exemptionsParsed.error);
      setLocalError(exemptionsParsed.error);
      return;
    }
    console.log('[launch]', 'step:5 addresses ok', {
      creatorFeeRecipient: feeRecipientParsed.value,
      recipient: buyRecipientParsed.value,
      snipeTaxExemptions: exemptionsParsed.value
    });

    if (quoteIn > 0n && feeRecipientParsed.value === zeroAddress) {
      console.warn('[launch]', 'step:5 abort — zero fee recipient with buy');
      setLocalError('creatorFeeRecipient required when quoteIn > 0');
      return;
    }

    const socials = {
      twitter: twitter.trim(),
      telegram: telegram.trim(),
      discord: discord.trim(),
      website: website.trim(),
      farcaster: farcaster.trim()
    };

    console.log('[launch]', 'step:6 validate metadata', {
      name: name.trim(),
      symbol: symbol.trim(),
      logo: logo.trim(),
      description: description.trim(),
      socials
    });
    const metadataError = validateLaunchMetadata({
      name: name.trim(),
      symbol: symbol.trim(),
      logo: logo.trim(),
      description: description.trim(),
      socials
    });
    if (metadataError) {
      console.warn('[launch]', 'step:6 abort', metadataError);
      setLocalError(metadataError);
      return;
    }

    const saltValue = salt.trim();
    if (saltValue && !/^0x[0-9a-fA-F]{64}$/.test(saltValue)) {
      console.warn('[launch]', 'step:6 abort invalid salt', saltValue);
      setLocalError('salt must be bytes32 hex (0x + 64 hex chars)');
      return;
    }
    console.log('[launch]', 'step:6 metadata ok', { salt: saltValue || '(will randomize)' });

    try {
      console.log('[launch]', 'step:7 refetch expectedEconomics…');
      const economicsResult = await prep.refetchEconomics();
      const expectedEconomics = (economicsResult.data ?? prep.expectedEconomics) as
        | `0x${string}`
        | undefined;
      console.log('[launch]', 'step:7 economics', {
        fromRefetch: economicsResult.data,
        fallback: prep.expectedEconomics,
        used: expectedEconomics
      });
      if (!expectedEconomics) {
        console.warn('[launch]', 'step:7 abort — no expectedEconomics');
        setLocalError('Could not refresh expectedEconomics');
        return;
      }

      const submitInput = {
        params: {
          name: name.trim(),
          symbol: symbol.trim(),
          logo: logo.trim(),
          description: description.trim(),
          socials,
          creatorFeeRecipient: feeRecipientParsed.value,
          creatorTaxBps: taxParsed.bps,
          buybackEnabled,
          expectedEconomics,
          salt: (saltValue || randomSalt()) as `0x${string}`
        },
        launchConfigId: prep.selectedConfig.id,
        pairToken,
        snipeTaxExemptions: exemptionsParsed.value,
        quoteIn,
        minTokensOut: minOut,
        recipient: buyRecipientParsed.value,
        launchFee: prep.launchFee
      };

      console.log('[launch]', 'step:8 call useLaunchToken.launch', {
        launchConfigId: submitInput.launchConfigId.toString(),
        pairToken: submitInput.pairToken,
        quoteIn: submitInput.quoteIn.toString(),
        minTokensOut: submitInput.minTokensOut.toString(),
        recipient: submitInput.recipient,
        launchFee: submitInput.launchFee.toString(),
        snipeTaxExemptions: submitInput.snipeTaxExemptions,
        params: submitInput.params
      });

      const txHash = await launch(submitInput);
      console.log('[launch]', 'step:9 success', { txHash });
      setSalt(randomSalt());
    } catch (error) {
      console.error('[launch]', 'step:9 failed', error);
    }
  }

  const dueLine = [
    'ETH pair',
    prep.launchFeeEth ? `ETH ${prep.launchFeeEth} fee` : 'fee…',
    prep.selectedConfig ? `config #${String(prep.selectedConfig.id)}` : null,
    quoteInPreview > 0n ? `+ buy ${developerBuy.trim()} ETH` : null
  ]
    .filter(Boolean)
    .join(', ');

  const maxTaxPct =
    prep.maxCreatorTaxBps !== undefined ? prep.maxCreatorTaxBps / 100 : undefined;

  return (
    <form
      className="token-form"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <h1>Launch token</h1>

      <div className="field-grid">
        <label className="field">
          <FieldLabel en="Name" zh="名称" param="name" />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`Token name (≤${LAUNCH_METADATA_LIMITS.name} bytes)`}
            maxLength={LAUNCH_METADATA_LIMITS.name}
            required
          />
        </label>
        <label className="field">
          <FieldLabel en="Ticker" zh="代号" param="symbol" />
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder={`symbol (≤${LAUNCH_METADATA_LIMITS.symbol})`}
            maxLength={LAUNCH_METADATA_LIMITS.symbol}
            required
          />
        </label>
      </div>

      <label className="field">
        <FieldLabel en="Description" zh="描述" param="description" />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={`A short description (≤${LAUNCH_METADATA_LIMITS.description} bytes)`}
          maxLength={LAUNCH_METADATA_LIMITS.description}
          required
        />
      </label>

      <label className="field">
        <FieldLabel en="Token image" zh="图片" param="logo" />
        <input
          value={logo}
          onChange={(event) => setLogo(event.target.value)}
          placeholder="ipfs://… or https://…"
          maxLength={LAUNCH_METADATA_LIMITS.logo}
        />
        <span className="image-picker image-picker-static" aria-hidden>
          <span className="image-box">
            {hasImage ? (
              <img src={logoPreview} alt={`${displayName} artwork`} />
            ) : (
              <ImageIcon size={16} strokeWidth={1.75} />
            )}
          </span>
          <span>{hasImage ? 'Logo preview' : 'Paste logo URI'}</span>
        </span>
      </label>

      <div className="field-grid">
        <label className="field">
          <FieldLabel en="X profile" zh="X账号" param="socials.twitter" />
          <input
            value={twitter}
            onChange={(event) => setTwitter(event.target.value)}
            placeholder="x.com/handle"
            maxLength={LAUNCH_METADATA_LIMITS.social}
          />
        </label>
        <label className="field">
          <FieldLabel en="Telegram" zh="电报" param="socials.telegram" />
          <input
            value={telegram}
            onChange={(event) => setTelegram(event.target.value)}
            placeholder="t.me/community"
            maxLength={LAUNCH_METADATA_LIMITS.social}
          />
        </label>
      </div>

      <label className="field">
        <FieldLabel en="Paired asset" zh="计价资产" param="pairToken" />
        <button className="asset-select" type="button" disabled>
          <span className="eth-mark">◆</span>
          <strong>ETH</strong>
          <ChevronDown className="asset-arrow" size={14} strokeWidth={1.8} />
        </button>
      </label>

      <p className="field-note">
        Graduates once the curve raises {graduationEth ?? '—'} ETH（graduationThreshold）
        {prep.selectedConfig
          ? ` · using launchConfigId=${String(prep.selectedConfig.id)}`
          : ''}
      </p>

      <label className="field">
        <FieldLabel en="Developer buy" zh="首购金额" param="quoteIn" />
        <div className="developer-buy">
          <input
            value={developerBuy}
            onChange={(event) => setDeveloperBuy(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
          <div className="buy-asset">
            <span className="eth-mark">◆</span>
            <span>ETH</span>
          </div>
          <small>0 → launchToken only; &gt;0 → launchAndBuy</small>
        </div>
      </label>

      <button
        className="advanced-row"
        type="button"
        onClick={() => setAdvancedOpen((open) => !open)}
        aria-expanded={advancedOpen}
      >
        <span>Advanced 高级</span>
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          style={{ transform: advancedOpen ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {advancedOpen ? (
        <div className="advanced-panel">
          <div className="field-grid">
            <label className="field">
              <FieldLabel en="Discord" zh="Discord" param="socials.discord" />
              <input
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                maxLength={LAUNCH_METADATA_LIMITS.social}
              />
            </label>
            <label className="field">
              <FieldLabel en="Website" zh="网站" param="socials.website" />
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                maxLength={LAUNCH_METADATA_LIMITS.social}
              />
            </label>
          </div>

          <label className="field">
            <FieldLabel en="Farcaster" zh="Farcaster" param="socials.farcaster" />
            <input
              value={farcaster}
              onChange={(e) => setFarcaster(e.target.value)}
              maxLength={LAUNCH_METADATA_LIMITS.social}
            />
          </label>

          <label className="field">
            <FieldLabel en="Fee recipient" zh="手续费收款" param="creatorFeeRecipient" />
            <input
              value={creatorFeeRecipient}
              onChange={(e) => setCreatorFeeRecipient(e.target.value)}
              placeholder={walletAddress || '0x… (empty = wallet; invalid blocked)'}
            />
          </label>

          <label className="field">
            <FieldLabel en="Buy recipient" zh="首购接收" param="recipient" />
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={walletAddress || '0x… (empty = wallet; invalid blocked)'}
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <FieldLabel en="Creator tax %" zh="创建者税百分比" param="creatorTaxBps" />
              <input
                value={creatorTaxPercent}
                onChange={(e) => setCreatorTaxPercent(e.target.value)}
                inputMode="decimal"
                placeholder={
                  maxTaxPct !== undefined ? `0–${maxTaxPct}% → bps` : 'e.g. 1 = 100 bps'
                }
              />
              <small className="field-hint">
                Enter percent; submitted as bps (1% = 100 bps
                {maxTaxPct !== undefined ? `, max ${maxTaxPct}%` : ''})
              </small>
            </label>
            <label className="field field-checkbox">
              <FieldLabel en="Buyback" zh="回购锁仓" param="buybackEnabled" />
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={buybackEnabled}
                  onChange={(e) => setBuybackEnabled(e.target.checked)}
                />
                <span>{buybackEnabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </label>
          </div>

          <label className="field">
            <FieldLabel en="Min tokens out" zh="最少到手" param="minTokensOut" />
            <input
              value={minTokensOut}
              onChange={(e) => setMinTokensOut(e.target.value)}
              inputMode="numeric"
              placeholder="0"
            />
            <small className="field-hint">
              Demo: no curve quote yet — default 0 (no slippage protection). Set manually if
              needed.
            </small>
          </label>

          <label className="field">
            <FieldLabel en="Salt" zh="盐值" param="salt" />
            <div className="salt-row">
              <input value={salt} onChange={(e) => setSalt(e.target.value)} spellCheck={false} />
              <button type="button" className="salt-refresh" onClick={() => setSalt(randomSalt())}>
                New
              </button>
            </div>
          </label>

          <label className="field">
            <FieldLabel en="Snipe exemptions" zh="狙击税豁免" param="snipeTaxExemptions" />
            <textarea
              value={exemptionsRaw}
              onChange={(e) => setExemptionsRaw(e.target.value)}
              placeholder="0xabc…, 0xdef… (max 32; invalid addresses block submit)"
            />
          </label>

          <label className="field">
            <FieldLabel en="Expected economics" zh="经济钉扎" param="expectedEconomics" />
            <input
              value={prep.expectedEconomics ?? ''}
              readOnly
              spellCheck={false}
              placeholder="Loading previewLaunchEconomics…"
            />
          </label>
        </div>
      ) : null}

      <div className="submit-area">
        <p>
          {dueLine}
          <span>⌁</span>
        </p>
        {(localError || errorMessage) && (
          <p className="form-error">{localError || errorMessage}</p>
        )}
        {hash ? (
          <p className="form-tx">
            tx {hash.slice(0, 10)}…{hash.slice(-6)}
          </p>
        ) : null}
        <button
          className="submit-button"
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            void onLaunchClick();
          }}
        >
          {statusText}
        </button>
      </div>
    </form>
  );
}

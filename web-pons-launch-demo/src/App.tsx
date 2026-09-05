import { useLogin, useLogout, usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { ChevronDown, ChevronLeft, ImageIcon, LockKeyhole } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { robinhoodChain } from './chain';
import { WalletAccountCard } from './WalletAccountCard';

type AppProps = {
  auth: {
    authenticated: boolean;
    ready: boolean;
    walletAddress?: string;
    chainId?: number;
    chainReady: boolean;
    privyConfigured: boolean;
    onAuthClick: () => void;
  };
};

export function PrivyConnectedApp() {
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const primaryWallet = useMemo(() => {
    return (
      address ||
      user?.wallet?.address ||
      user?.linkedAccounts?.find((account) => account.type === 'wallet')?.address
    );
  }, [address, user]);

  useEffect(() => {
    if (!authenticated || !wallets.length) return;

    const preferred =
      wallets.find((wallet) => wallet.address.toLowerCase() === primaryWallet?.toLowerCase()) ||
      wallets[0];

    if (!preferred) return;
    if (address && preferred.address.toLowerCase() === address.toLowerCase()) return;

    void setActiveWallet(preferred);
  }, [authenticated, wallets, primaryWallet, address, setActiveWallet]);

  return (
    <App
      auth={{
        ready,
        authenticated,
        walletAddress: primaryWallet,
        chainId,
        chainReady: isConnected && chainId === robinhoodChain.id,
        privyConfigured: true,
        onAuthClick: () => (authenticated ? logout() : login())
      }}
    />
  );
}

export function App({ auth }: AppProps) {
  const defaultImageUrl = import.meta.env.VITE_IMAGE_URL || '';
  const [name, setName] = useState('SPIKE ICE TOKEN');
  const [ticker, setTicker] = useState('SPT');
  const [description, setDescription] = useState(
    'Launch and explore fixed-supply tokens on Robinhood Chain.'
  );
  const [imageUrl] = useState(defaultImageUrl);
  const [xProfile, setXProfile] = useState('');
  const [telegram, setTelegram] = useState('');
  const [developerBuy, setDeveloperBuy] = useState('');

  const canLaunch = Boolean(name.trim() && ticker.trim() && description.trim() && auth.authenticated);
  const displayName = name.trim() || 'Your token';
  const displayTicker = ticker.trim() || 'ticker';
  const hasImage = Boolean(imageUrl.trim());

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="back-button" type="button" aria-label="Back">
          <ChevronLeft size={16} strokeWidth={2} />
          <span>Back</span>
        </button>

        <div className="top-actions">
          {auth.authenticated ? (
            <WalletAccountCard
              address={auth.walletAddress}
              chainId={auth.chainId}
              chainReady={auth.chainReady}
              onDisconnect={auth.onAuthClick}
            />
          ) : (
            <button
              className="login-button"
              type="button"
              disabled={!auth.privyConfigured || !auth.ready}
              onClick={auth.onAuthClick}
              title={auth.privyConfigured ? 'Connect with Privy' : 'Set VITE_PRIVY_APP_ID to enable Privy'}
            >
              <LockKeyhole size={14} />
              <span>{auth.privyConfigured ? 'Login' : 'Privy app id required'}</span>
            </button>
          )}
          <span className="version-pill">v2</span>
        </div>
      </header>

      <section className="launch-panel" aria-label="Launch token demo">
        <form className="token-form">
          <h1>Launch token</h1>

          <div className="field-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Token name"
              />
            </label>
            <label className="field">
              <span>Ticker</span>
              <input
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                placeholder="symbol"
              />
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A short description of the token"
            />
          </label>

          <label className="field">
            <span>Token image</span>
            <button className="image-picker" type="button">
              <span className="image-box">
                {hasImage ? (
                  <img src={imageUrl} alt={`${displayName} artwork`} />
                ) : (
                  <ImageIcon size={16} strokeWidth={1.75} />
                )}
              </span>
              <span>{hasImage ? 'Using VITE_IMAGE_URL' : 'Choose image'}</span>
            </button>
          </label>

          <div className="field-grid">
            <label className="field">
              <span>X profile</span>
              <input
                value={xProfile}
                onChange={(event) => setXProfile(event.target.value)}
                placeholder="x.com/handle"
              />
            </label>
            <label className="field">
              <span>Telegram</span>
              <input
                value={telegram}
                onChange={(event) => setTelegram(event.target.value)}
                placeholder="t.me/community"
              />
            </label>
          </div>

          <label className="field">
            <span>Paired asset</span>
            <button className="asset-select" type="button">
              <span className="eth-mark">◆</span>
              <strong>ETH</strong>
              <ChevronDown className="asset-arrow" size={14} strokeWidth={1.8} />
            </button>
          </label>

          <p className="field-note">Graduates once the curve raises 4.2 ETH.</p>

          <label className="field">
            <span>Developer buy</span>
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
              <small>0 available, bought in the launch transaction</small>
            </div>
          </label>

          <button className="advanced-row" type="button">
            <span>Advanced</span>
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>

          <div className="submit-area">
            <p>
              ETH pair, ETH 0.0005 due
              <span>⌁</span>
            </p>
            <button className="submit-button" type="button" disabled={!canLaunch}>
              {!auth.authenticated
                ? 'Login to launch'
                : canLaunch
                  ? 'Launch token'
                  : 'Fill token details'}
            </button>
          </div>
        </form>

        <aside className="preview-stage" aria-label="Token preview">
          <div className="token-card">
            <span className="preview-image">
              {hasImage ? (
                <img src={imageUrl} alt={`${displayName} artwork`} />
              ) : (
                <ImageIcon size={18} strokeWidth={1.7} />
              )}
            </span>
            <h2>{displayName}</h2>
            <p>{displayTicker}</p>

            <dl>
              <div>
                <dt>Launch fee</dt>
                <dd>
                  0.0005 <span className="mini-eth">◆</span>
                </dd>
              </div>
              <div>
                <dt>Paired with</dt>
                <dd>ETH</dd>
              </div>
              <div>
                <dt>Trade fee</dt>
                <dd>1.00%</dd>
              </div>
              <div>
                <dt>Launch window</dt>
                <dd>99% snipe tax, 3s</dd>
              </div>
              <div>
                <dt>Graduation</dt>
                <dd>4.2 ETH</dd>
              </div>
              <div>
                <dt>Liquidity</dt>
                <dd>Locked</dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>
    </main>
  );
}

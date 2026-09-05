import { ImageIcon, LockKeyhole, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  LaunchTokenForm,
  type LaunchPreviewState,
} from './components/LaunchTokenForm';
import { MemeTokenCard } from './components/MemeTokenCard';
import { WalletAccountCard } from './components/WalletAccountCard';
import { type AuthView, useSyncedPrivyAuth } from './hooks/useSyncedPrivyAuth';
import { useMemeLaunchCards } from './hooks/useMemeLaunchCards';
import { resolveLogoUrl } from './lib/meme';

type AppProps = {
  auth: AuthView;
};

export function PrivyConnectedApp() {
  const auth = useSyncedPrivyAuth();
  return <App auth={auth} />;
}

export function App({ auth }: AppProps) {
  const { cards: memeCards, isLoading: memeLoading } = useMemeLaunchCards();
  const [preview, setPreview] = useState<LaunchPreviewState>({
    name: 'SPIKE ICE',
    symbol: 'SPI',
    logo:
      import.meta.env.VITE_IMAGE_URL ||
      'ipfs://bafkreigimpy4z33vrasjxx5y2tolroswe576booatc3nd622rdp6au3jae',
    description:
      'SPIKE ICE (SPI) is a fixed-supply meme token on Robinhood Chain, launched via pons v2.',
  });

  const onPreviewChange = useCallback((next: LaunchPreviewState) => {
    setPreview(next);
  }, []);

  const displayName = preview.name.trim() || 'Your token';
  const displayTicker = preview.symbol.trim() || 'ticker';
  const logoSrc = resolveLogoUrl(preview.logo.trim()) || preview.logo.trim();
  const hasImage = Boolean(logoSrc);

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="back-button"
          type="button"
          aria-label="Refresh"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={16} strokeWidth={2} />
          <span>Refresh</span>
        </button>

        <div className="top-actions">
          {!auth.ready ? (
            <button className="login-button" type="button" disabled>
              <LockKeyhole size={14} />
              <span>Restoring…</span>
            </button>
          ) : !auth.authenticated ? (
            <button
              className="login-button"
              type="button"
              disabled={!auth.privyConfigured}
              onClick={auth.onAuthClick}
              title={
                auth.privyConfigured
                  ? 'Connect with Privy'
                  : 'Set VITE_PRIVY_APP_ID to enable Privy'
              }
            >
              <LockKeyhole size={14} />
              <span>
                {auth.privyConfigured ? 'Login' : 'Privy app id required'}
              </span>
            </button>
          ) : null}
          <span className="version-pill">v2</span>
        </div>
      </header>

      <section className="launch-panel" aria-label="Launch token demo">
        <LaunchTokenForm
          authenticated={auth.authenticated}
          walletAddress={auth.walletAddress}
          chainReady={auth.chainReady}
          reconnecting={auth.reconnecting}
          onPreviewChange={onPreviewChange}
        />

        <aside className="preview-stage" aria-label="Token preview">
          <div className="preview-stack">
            {auth.ready && auth.authenticated ? (
              <WalletAccountCard
                address={auth.walletAddress}
                chainId={auth.chainId}
                chainReady={auth.chainReady}
                onDisconnect={auth.onAuthClick}
              />
            ) : null}

            <div className="token-card">
              <span className="preview-image">
                {hasImage ? (
                  <img src={logoSrc} alt={`${displayName} artwork`} />
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
                    {preview.launchFeeEth ?? '…'}{' '}
                    <span className="mini-eth">◆</span>
                  </dd>
                </div>
                <div>
                  <dt>Paired with</dt>
                  <dd>ETH</dd>
                </div>
                <div>
                  <dt>Trade fee</dt>
                  <dd>
                    {preview.tradeFeePct ? `${preview.tradeFeePct}%` : '…'}
                  </dd>
                </div>
                <div>
                  <dt>Launch window</dt>
                  <dd>99% snipe tax</dd>
                </div>
                <div>
                  <dt>Graduation</dt>
                  <dd>{preview.graduationEth ?? '…'} ETH</dd>
                </div>
                <div>
                  <dt>Liquidity</dt>
                  <dd>Locked</dd>
                </div>
              </dl>
            </div>

            <section className="meme-feed" aria-label="Meme launches">
              <div className="meme-feed-head">
                <h2>Meme launches</h2>
                <span>
                  {memeLoading ? 'Loading…' : `${memeCards.length} tokens`}
                </span>
              </div>
              <div className="meme-feed-grid">
                {memeCards.map((item) => (
                  <MemeTokenCard key={item.token} item={item} />
                ))}
              </div>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}

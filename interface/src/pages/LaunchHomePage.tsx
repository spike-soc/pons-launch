import { ImageIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  LaunchTokenForm,
  type LaunchPreviewState,
} from '../components/LaunchTokenForm';
import { WalletAccountCard } from '../components/WalletAccountCard';
import type { AuthView } from '../hooks/useSyncedPrivyAuth';
import { resolveLogoUrl } from '../lib/meme';

type LaunchHomePageProps = {
  auth: AuthView;
};

export function LaunchHomePage({ auth }: LaunchHomePageProps) {
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
        </div>
      </aside>
    </section>
  );
}

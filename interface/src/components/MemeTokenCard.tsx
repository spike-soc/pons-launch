import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAddress } from '../lib/format';
import {
  formatMarketCapUsd,
  formatRelativeTime,
  resolveLogoUrl
} from '../lib/meme';
import type { MemeLaunchCardData } from '../hooks/useMemeLaunchCards';

type MemeTokenCardProps = {
  item: MemeLaunchCardData;
  buySelected?: boolean;
  onBuyClick?: (item: MemeLaunchCardData) => void;
};

export function MemeTokenCard({
  item,
  buySelected = false,
  onBuyClick
}: MemeTokenCardProps) {
  const logoUrl = resolveLogoUrl(item.logo);
  const marketCap = formatMarketCapUsd(item.marketCapUsd);
  const progress = Math.max(0, Math.min(100, item.progressPct));
  const launchpadUrl = `/launchpad/${item.token}`;
  const canBuy = Boolean(item.curve) && !item.graduated;

  return (
    <article
      className={buySelected ? 'meme-card meme-card-selected' : 'meme-card'}
      title={item.description || item.name}
    >
      <Link
        className="meme-card-media"
        to={launchpadUrl}
        aria-label={`Open ${item.name} launchpad detail`}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={item.name} loading="lazy" />
        ) : (
          <div className="meme-card-media-fallback">{item.symbol.slice(0, 2)}</div>
        )}
        <span className="meme-card-badge">V2</span>
      </Link>

      <div className="meme-card-body">
        <div className="meme-card-title-row">
          <h3>{item.name}</h3>
          {item.graduated ? (
            <span className="meme-card-graduated" title="Graduated">
              <Users size={12} strokeWidth={2.4} />
            </span>
          ) : null}
        </div>

        <p className="meme-card-symbol">${item.symbol}</p>

        {item.description ? (
          <p className="meme-card-desc">{item.description}</p>
        ) : (
          <p className="meme-card-desc meme-card-desc-empty" />
        )}

        {marketCap ? (
          <p className="meme-card-mc">
            <strong>{marketCap}</strong> <span>MC</span>
          </p>
        ) : (
          <p className="meme-card-mc">
            <strong>{progress.toFixed(2)}%</strong> <span>to graduate</span>
          </p>
        )}

        <div className="meme-card-progress">
          <div className="meme-card-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <em>{progress.toFixed(2)}%</em>
        </div>

        <div className="meme-card-footer">
          <span>{formatAddress(item.deployer || item.token)}</span>
          <strong>{formatRelativeTime(item.latestBuyAt)}</strong>
        </div>

        <div className="meme-card-actions">
          <button
            className="meme-card-btn meme-card-btn-buy"
            type="button"
            disabled={!canBuy}
            title={
              !item.curve
                ? 'Curve unavailable'
                : item.graduated
                  ? 'Graduated'
                  : 'Buy on bonding curve'
            }
            onClick={() => onBuyClick?.(item)}
          >
            Buy
          </button>
          <button className="meme-card-btn meme-card-btn-sell" type="button" disabled>
            Sell
          </button>
        </div>
      </div>
    </article>
  );
}

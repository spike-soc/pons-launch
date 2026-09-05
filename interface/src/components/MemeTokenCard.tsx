import { Users } from 'lucide-react';
import { formatAddress } from '../lib/format';
import {
  formatMarketCapUsd,
  formatRelativeTime,
  resolveLogoUrl
} from '../lib/meme';
import type { MemeLaunchCardData } from '../hooks/useMemeLaunchCards';

type MemeTokenCardProps = {
  item: MemeLaunchCardData;
};

export function MemeTokenCard({ item }: MemeTokenCardProps) {
  const logoUrl = resolveLogoUrl(item.logo);
  const marketCap = formatMarketCapUsd(item.marketCapUsd);
  const progress = Math.max(0, Math.min(100, item.progressPct));

  return (
    <article className="meme-card" title={item.description || item.name}>
      <div className="meme-card-media">
        {logoUrl ? (
          <img src={logoUrl} alt={item.name} loading="lazy" />
        ) : (
          <div className="meme-card-media-fallback">{item.symbol.slice(0, 2)}</div>
        )}
        <span className="meme-card-badge">V2</span>
      </div>

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

        {item.description ? <p className="meme-card-desc">{item.description}</p> : null}

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
      </div>
    </article>
  );
}

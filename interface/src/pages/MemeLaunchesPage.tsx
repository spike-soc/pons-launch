import { useState } from 'react';
import { BuyTradePanel } from '../components/BuyTradePanel';
import { MemeTokenCard } from '../components/MemeTokenCard';
import type { AuthView } from '../hooks/useSyncedPrivyAuth';
import {
  useMemeLaunchCards,
  type MemeLaunchCardData
} from '../hooks/useMemeLaunchCards';

type MemeLaunchesPageProps = {
  auth: AuthView;
};

export function MemeLaunchesPage({ auth }: MemeLaunchesPageProps) {
  const { cards: memeCards, isLoading: memeLoading } = useMemeLaunchCards();
  const [selected, setSelected] = useState<MemeLaunchCardData | null>(null);

  function onBuyClick(item: MemeLaunchCardData) {
    setSelected((prev) =>
      prev?.token.toLowerCase() === item.token.toLowerCase() ? null : item
    );
  }

  return (
    <section className="meme-page" aria-label="Meme launches">
      <div className="meme-page-head">
        <h1>Meme launches</h1>
        <span>
          {memeLoading ? 'Loading…' : `${memeCards.length} tokens`}
        </span>
      </div>

      <div className="meme-page-grid">
        {memeCards.map((item) => (
          <MemeTokenCard
            key={item.token}
            item={item}
            buySelected={
              selected?.token.toLowerCase() === item.token.toLowerCase()
            }
            onBuyClick={onBuyClick}
          />
        ))}
      </div>

      {selected ? (
        <BuyTradePanel
          item={selected}
          authenticated={auth.authenticated}
          walletAddress={auth.walletAddress}
          chainReady={auth.chainReady}
          onClose={() => setSelected(null)}
          onLogin={auth.onAuthClick}
        />
      ) : null}
    </section>
  );
}

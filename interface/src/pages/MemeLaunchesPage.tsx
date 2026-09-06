import { MemeTokenCard } from '../components/MemeTokenCard';
import { useMemeLaunchCards } from '../hooks/useMemeLaunchCards';

export function MemeLaunchesPage() {
  const { cards: memeCards, isLoading: memeLoading } = useMemeLaunchCards();

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
          <MemeTokenCard key={item.token} item={item} />
        ))}
      </div>
    </section>
  );
}

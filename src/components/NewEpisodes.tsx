import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { checkForNewEpisodes, type NewEpisodeInfo } from '../services/newEpisodes';
import { Bell } from 'lucide-react';

interface NewEpisodesItem extends NewEpisodeInfo {
  nextEpisode: {
    season: number;
    episode: number;
    title?: string;
    airDate?: string;
  };
}

export const NewEpisodes: FC = () => {
  const [items, setItems] = useState<NewEpisodesItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const newEpisodes = await checkForNewEpisodes();
        if (cancelled) return;

        const enriched: NewEpisodesItem[] = newEpisodes.map((item) => {
          const nextEp = item.newEpisodes[0];
          return {
            ...item,
            nextEpisode: {
              season: nextEp.seasonNumber,
              episode: nextEp.episodeNumber,
              title: nextEp.title,
              airDate: nextEp.airDate,
            },
          };
        });

        setItems(enriched);
      } catch (e) {
        console.warn('Failed to check for new episodes:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <section className="mb-12" aria-labelledby="new-episodes-heading">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="w-6 h-6 text-amber-400" />
          <h2 id="new-episodes-heading" className="text-xl font-bold text-white tracking-tight">
            New Episodes Available
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.showId} className="group relative bg-slate-800/40 rounded-xl overflow-hidden border-2 border-slate-700/50 hover:border-amber-500/50 transition-all flex flex-col">
            <Link
              to={`/tv/${item.showId}/season/${item.nextEpisode.season}/episode/${item.nextEpisode.episode}`}
              className="relative bg-slate-900 flex flex-col"
            >
              <div className="aspect-video w-full bg-slate-900 relative overflow-hidden">
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.showTitle}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-700/20 to-transparent" />
                    <svg className="w-12 h-12 text-slate-600/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[9px] font-semibold text-amber-300 uppercase tracking-wider">
                  New
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
                  <div className="h-full bg-amber-400 w-full" />
                </div>
              </div>

              <div className="p-3">
                <h3 className="text-sm font-semibold text-slate-200 line-clamp-1">
                  {item.showTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  S{item.nextEpisode.season} E{item.nextEpisode.episode}
                  {item.nextEpisode.title ? ` • ${item.nextEpisode.title}` : ''}
                  {item.nextEpisode.airDate && (
                    <>
                      {' • '}
                      <span className="text-amber-400/90 font-semibold">
                        {new Date(item.nextEpisode.airDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
};
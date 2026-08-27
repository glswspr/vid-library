import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { MediaItem } from '../types';
import { getMediaDetails } from '../services/catalog';
import { VideoPlayer } from '../components/VideoPlayer';
import { MoreLikeThis } from '../components/MoreLikeThis';
import { Skeleton } from '../components/Skeleton';
import { ArrowLeft, Bookmark, BookmarkCheck } from 'lucide-react';
import { isInWatchlist, toggleWatchlist, updateProgressGenreForShow } from '../utils/storage';
import ExpandableText from '../components/ExpandableText';

const formatRuntime = (duration?: string): string => {
  if (!duration) return '';
  const mins = parseInt(duration, 10);
  if (!mins) return duration;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export const MoviePage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [inList, setInList] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setInList(isInWatchlist(id));
    getMediaDetails(id, 'movie').then((data) => {
      setMovie(data);
      setLoading(false);
      document.title = `${data.title} (${data.year || 'Movie'}) - VidLibrary`;
      if (data.genre) updateProgressGenreForShow(data.id, data.genre);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  const handleToggleList = () => {
    if (!movie) return;
    setInList(toggleWatchlist({
      id: movie.id,
      title: movie.title,
      type: movie.type,
      posterUrl: movie.posterUrl,
      year: movie.year,
    }));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Skeleton className="w-24 h-5 mb-6" />
        <Skeleton className="w-full aspect-video rounded-2xl mb-4" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-24 h-9" />
          <Skeleton className="w-24 h-9" />
          <Skeleton className="w-24 h-9" />
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <h2 className="text-xl font-bold text-white mb-2">Movie Not Found</h2>
        <p className="text-sm mb-4">The requested movie could not be found.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500 text-slate-950 font-bold text-sm rounded-xl">
          <ArrowLeft className="w-5 h-5" /> Back
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Back
        </Link>

        <button
          type="button"
          onClick={handleToggleList}
          aria-pressed={inList}
          aria-label={inList ? 'Remove from My List' : 'Add to My List'}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all cursor-pointer ${
            inList
              ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-slate-100'
          }`}
        >
          {inList ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          {inList ? 'In My List' : 'My List'}
        </button>
      </div>

      <div className="flex items-end gap-4 mb-8">
        {movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt=""
            className="hidden sm:block w-28 h-40 rounded-xl object-cover border border-slate-700/60 shadow-lg"
          />
        ) : null}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {movie.title}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {movie.year ? `${movie.year}` : ''}
            {movie.duration ? ` • ${formatRuntime(movie.duration)}` : ''}
            {movie.rating ? ` • ${movie.rating}★` : ''}
            {movie.genre ? ` • ${movie.genre}` : ''}
          </p>
          {movie.description ? (
            <ExpandableText text={movie.description} maxChars={220} />
          ) : null}
          {movie.cast && movie.cast.length > 0 && (
            <p className="text-xs text-slate-500 mt-3 max-w-2xl">
              <span className="text-slate-400 font-semibold">Cast:</span>{' '}
              {movie.cast.slice(0, 5).join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="mb-8">
        <VideoPlayer media={movie} />
      </div>

      <MoreLikeThis media={movie} />
    </div>
  );
};

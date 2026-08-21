import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { TVShowDetails } from '../types';
import { getTVShowDetails } from '../services/catalog';
import { VideoPlayer } from '../components/VideoPlayer';
import { MoreLikeThis } from '../components/MoreLikeThis';
import { Skeleton } from '../components/Skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight, Tv, CheckCircle2, Bookmark, BookmarkCheck } from 'lucide-react';
import { getWatchProgress, isInWatchlist, toggleWatchlist } from '../utils/storage';
import { isTvDevice } from '../utils/tv';
import { useEpisodeNavigation } from '../hooks/useEpisodeNavigation';
import { WATCHED_THRESHOLD } from '../constants';
import ExpandableText from '../components/ExpandableText';

export const TVShowPage: FC = () => {
  const { id, season: seasonParam, episode: episodeParam } = useParams<{
    id: string;
    season?: string;
    episode?: string;
  }>();

  const navigate = useNavigate();

  const currentSeason = seasonParam ? parseInt(seasonParam, 10) : 1;
  const currentEpisode = episodeParam ? parseInt(episodeParam, 10) : 1;

  const [show, setShow] = useState<TVShowDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [inList, setInList] = useState<boolean>(false);
  const nextEpisodeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setInList(isInWatchlist(id));
    getTVShowDetails(id).then((data) => {
      setShow(data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  const handleToggleList = () => {
    if (!show) return;
    setInList(toggleWatchlist({
      id: show.id,
      title: show.title,
      type: show.type,
      posterUrl: show.posterUrl,
      year: show.year,
    }));
  };

  useEffect(() => {
    if (show) {
      document.title = `${show.title} - S${currentSeason}E${currentEpisode} - VidLibrary`;
    }
  }, [show, currentSeason, currentEpisode]);

  useEffect(() => {
    if (!show || !isTvDevice()) return;
    nextEpisodeBtnRef.current?.focus();
  }, [show, currentSeason, currentEpisode]);

  const { nextSeason: nextSeasonNum, nextEpisode: nextEpisodeNum,
          prevSeason: prevSeasonNum, prevEpisode: prevEpisodeNum,
          goNext: handleNextEpisode, goPrev: handlePrevEpisode } =
    useEpisodeNavigation(show, currentSeason, currentEpisode, navigate);

  useEffect(() => {
    if (!show || !id) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (document.activeElement !== document.body) return;

      if (e.key === 'ArrowRight') { handleNextEpisode(); }
      else if (e.key === 'ArrowLeft') { handlePrevEpisode(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextEpisode, handlePrevEpisode, show, id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Skeleton className="w-24 h-5 mb-6" />
        <Skeleton className="w-full aspect-video rounded-2xl mb-6" />
        <Skeleton className="w-full h-24 rounded-2xl mb-6" />
        <Skeleton className="w-full h-40 rounded-2xl" />
      </div>
    );
  }

  if (!show || !id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <h2 className="text-xl font-bold text-white mb-2">TV Show Not Found</h2>
        <p className="text-sm mb-4">The requested TV show could not be found.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-slate-950 font-semibold text-xs rounded-lg">
          <ArrowLeft className="w-4 h-4" /> Back to Catalog
        </Link>
      </div>
    );
  }

  const handleSelectSeason = (sNum: number) => {
    navigate(`/tv/${id}/season/${sNum}/episode/1`);
  };

  const handleSelectEpisode = (eNum: number) => {
    navigate(`/tv/${id}/season/${currentSeason}/episode/${eNum}`);
  };

  const activeSeasonData = show.seasons.find((s) => s.seasonNumber === currentSeason) || show.seasons[0];
  const currentEp = activeSeasonData?.episodes.find((e) => e.episodeNumber === currentEpisode);

  return (
    <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

      <div className="flex items-end gap-4 mb-5">
        {show.posterUrl ? (
          <img
            src={show.posterUrl}
            alt=""
            className="hidden sm:block w-28 h-40 rounded-xl object-cover border border-slate-700/60 shadow-lg"
          />
        ) : null}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {show.title}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {show.year ? `${show.year} • ` : ''}
            {show.seasons.length} season{show.seasons.length === 1 ? '' : 's'}
            {show.rating ? ` • ${show.rating}★` : ''}
          </p>
          {show.description ? (
            <ExpandableText text={show.description} maxChars={220} />
          ) : null}
        </div>
      </div>

      <div className="mb-4">
        <VideoPlayer
          media={show}
          season={currentSeason}
          episode={currentEpisode}
          onAutoNext={() => {
            if (nextSeasonNum && nextEpisodeNum) handleNextEpisode();
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-8">
        <div>
          <div className="text-sm text-cyan-400 font-semibold tracking-wide uppercase">
            Season {currentSeason} • Episode {currentEpisode}
          </div>
          <h2 className="text-xl font-bold text-white mt-0.5">
            {show.title}
          </h2>
          {currentEp?.title ? (
            <div className="text-base font-semibold text-slate-200 mt-1">
              {currentEp.title}
            </div>
          ) : null}
          {currentEp?.overview ? (
            <ExpandableText text={currentEp.overview} maxChars={220} />
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {prevSeasonNum && prevEpisodeNum && (
            <button
              type="button"
              onClick={handlePrevEpisode}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 border-2 border-slate-700 hover:border-cyan-500 text-slate-200 font-bold text-sm rounded-xl transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
              Prev
            </button>
          )}

          {nextSeasonNum && nextEpisodeNum && (
            <button
              ref={nextEpisodeBtnRef}
              data-tv-autofocus
              type="button"
              onClick={handleNextEpisode}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              Next Episode
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {show.cast && show.cast.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-white mb-3">Cast</h3>
          <div className="flex flex-wrap gap-2">
            {show.cast.slice(0, 12).map((name) => (
              <span key={name} className="px-3 py-1.5 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-slate-300">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Episodes</h3>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 overflow-x-auto max-w-full pb-1"
              role="tablist"
              aria-label="Select season"
            >
              {show.seasons.map((s) => {
                const isActive = s.seasonNumber === currentSeason;
                return (
                  <button
                    key={s.seasonNumber}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelectSeason(s.seasonNumber)}
                    className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    S{s.seasonNumber}
                  </button>
                );
              })}
            </div>

            <select
              value={currentSeason}
              onChange={(e) => handleSelectSeason(parseInt(e.target.value, 10))}
              aria-label="Jump to season"
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm font-semibold cursor-pointer focus:border-cyan-500"
            >
              {show.seasons.map((s) => (
                <option key={s.seasonNumber} value={s.seasonNumber}>
                  Season {s.seasonNumber} ({s.episodeCount} episodes)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {activeSeasonData?.episodes.map((ep) => {
            const isSelected = ep.episodeNumber === currentEpisode;
            const progress = getWatchProgress(show.id, currentSeason, ep.episodeNumber);
            const isWatched = progress && (
              progress.completed ||
              (progress.duration > 0 && (progress.progress / progress.duration) > WATCHED_THRESHOLD)
            );

            return (
              <button
                key={ep.episodeNumber}
                type="button"
                onClick={() => handleSelectEpisode(ep.episodeNumber)}
                className={`p-4 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 ring-2 ring-cyan-500/30'
                    : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 hover:border-slate-500 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-sm font-bold mb-1">
                    <span>Episode {ep.episodeNumber}</span>
                    {isWatched && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-1 font-normal">
                    {ep.title || `Episode ${ep.episodeNumber}`}
                  </div>
                </div>

                {progress && progress.duration > 0 && (
                  <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400"
                      style={{ width: `${Math.min(100, (progress.progress / progress.duration) * 100)}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <MoreLikeThis media={show} />
    </div>
  );
};

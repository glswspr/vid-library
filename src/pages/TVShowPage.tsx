import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { TVShowDetails } from '../types';
import { getTVShowDetails } from '../services/catalog';
import { VideoPlayer } from '../components/VideoPlayer';
import { MoreLikeThis } from '../components/MoreLikeThis';
import { Skeleton } from '../components/Skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight, Tv, Check, Bookmark, BookmarkCheck, Play, Eye, EyeOff } from 'lucide-react';
import { getAllWatchProgress, getWatchProgress, isInWatchlist, toggleWatchlist, markEpisodeWatched, markEpisodeUnwatched, updateProgressGenreForShow } from '../utils/storage';
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
  const [epRefreshKey, setEpRefreshKey] = useState(0);
  const nextEpisodeBtnRef = useRef<HTMLButtonElement>(null);

  const handleSelectSeason = (sNum: number) => {
    navigate(`/tv/${id}/season/${sNum}/episode/1`);
  };

  const handleSelectEpisode = (eNum: number) => {
    navigate(`/tv/${id}/season/${currentSeason}/episode/${eNum}`);
  };

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

  const activeSeasonData = show
    ? show.seasons.find((s) => s.seasonNumber === currentSeason) || show.seasons[0]
    : undefined;
  const currentEp = activeSeasonData?.episodes.find((e) => e.episodeNumber === currentEpisode);

  const resumeTarget = useMemo(() => {
    if (!show) return null;
    return getAllWatchProgress().find(
      (p) => p.id === show.id && p.type === 'tv' && p.seasonNumber != null && p.episodeNumber != null,
    ) || null;
  }, [show, epRefreshKey]);
  const isOnResumeTarget = resumeTarget != null &&
    resumeTarget.seasonNumber === currentSeason &&
    resumeTarget.episodeNumber === currentEpisode;

  const episodeCards = useMemo(() => {
    if (!activeSeasonData) return [];
    return activeSeasonData.episodes.map((ep) => {
      const isSelected = ep.episodeNumber === currentEpisode;
      const progress = getWatchProgress(show?.id || '', currentSeason, ep.episodeNumber);
      const isWatched = progress && (
        progress.completed ||
        (progress.duration > 0 && (progress.progress / progress.duration) > WATCHED_THRESHOLD)
      );
      const progressPercent = progress && progress.duration > 0
        ? Math.min(100, Math.round((progress.progress / progress.duration) * 100))
        : 0;

      const handleToggleWatched = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!show) return;
        if (isWatched) {
          markEpisodeUnwatched(show.id, currentSeason, ep.episodeNumber);
        } else {
          markEpisodeWatched({
            id: show.id,
            title: show.title,
            type: show.type,
            posterUrl: show.posterUrl,
            seasonNumber: currentSeason,
            episodeNumber: ep.episodeNumber,
            progress: 0,
            duration: ep.runtime || 0,
          });
        }
        setEpRefreshKey((k) => k + 1);
      };

      return (
        <div
          key={ep.episodeNumber}
          onClick={() => handleSelectEpisode(ep.episodeNumber)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSelectEpisode(ep.episodeNumber);
            }
          }}
          role="button"
          tabIndex={0}
          className={`
            group relative rounded-lg border text-left transition-all duration-200 cursor-pointer overflow-hidden
            flex flex-col
            hover:scale-[1.04] hover:shadow-xl hover:shadow-black/40 hover:border-slate-500
            active:scale-[0.97]
            ${isSelected
              ? 'bg-cyan-500/10 border-cyan-500/80 ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-500/10'
              : isWatched
                ? 'bg-slate-800/40 border-emerald-500/60 shadow-sm shadow-emerald-500/10 hover:bg-slate-800'
                : 'bg-slate-800/40 border-slate-700/60 shadow-sm hover:bg-slate-800'
            }
          `}
        >
          <div className="aspect-[4/3] w-full relative overflow-hidden bg-slate-800">
            {ep.stillPath ? (
              <img
                src={ep.stillPath}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-700/20 to-transparent" />
                <Play className="w-5 h-5 text-slate-600/60" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {isWatched && (
              <div className="absolute inset-0 bg-emerald-500/25 ring-1 ring-inset ring-emerald-400/50 pointer-events-none" />
            )}
            
            <div className="absolute top-1 left-1">
              <span className="text-[9px] font-bold text-white/90 bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5 border border-white/10 shadow-sm">
                {ep.episodeNumber}
              </span>
            </div>
            
            {isWatched && (
              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_6px_rgba(52,211,153,0.7)]">
                <Check className="w-3 h-3 text-slate-950" strokeWidth={3.5} />
              </div>
            )}
            
            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <button
                type="button"
                onClick={handleToggleWatched}
                aria-label={isWatched ? 'Mark as Unwatched' : 'Mark as Watched'}
                className={`
                  w-10 h-10 rounded-full border backdrop-blur-md
                  flex items-center justify-center
                  transform scale-75 group-hover:scale-100 transition-transform duration-300
                  shadow-lg cursor-pointer
                  ${isWatched
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/50'
                    : 'bg-black/80 border-white/30 text-white hover:bg-black hover:scale-110'
                  }
                `}
              >
                {isWatched ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {progressPercent > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]" style={{ width: `${progressPercent}%` }} />
              </div>
            )}
          </div>
          
          <div className="px-1.5 py-1.5">
            <div className="text-[10px] text-slate-400 line-clamp-1 font-medium leading-tight group-hover:text-slate-200 transition-colors">
              {ep.title || `Episode ${ep.episodeNumber}`}
            </div>
          </div>
        </div>
      );
    });
  }, [show?.id, currentSeason, currentEpisode, epRefreshKey, activeSeasonData, handleSelectEpisode]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setInList(isInWatchlist(id));
    getTVShowDetails(id).then((data) => {
      setShow(data);
      setLoading(false);
      if (data.genre) updateProgressGenreForShow(data.id, data.genre);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

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
          {resumeTarget && !isOnResumeTarget && (
            <button
              type="button"
              onClick={() => navigate(`/tv/${id}/season/${resumeTarget.seasonNumber}/episode/${resumeTarget.episodeNumber}`)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              Resume S{resumeTarget.seasonNumber} E{resumeTarget.episodeNumber}
            </button>
          )}

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

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-1.5">
          {episodeCards}
        </div>
      </div>

      <MoreLikeThis media={show} />
    </div>
  );
};

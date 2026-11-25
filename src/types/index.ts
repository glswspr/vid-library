export type MediaType = 'movie' | 'tv';
export type ProviderId = 'vidprime' | 'vixsrc' | 'vidnest' | 'vidlink' | 'peachify' | 'vidcore' | 'mapple' | 'vidsrc' | 'vidzee' | 'vidapi' | 'm111';
export type SubtitleLang = 'off' | 'en' | 'sv' | 'fa';

export interface MediaItem {
  id: string; // IMDB or TMDB ID
  imdbId?: string;
  tmdbId?: string;
  title: string;
  year?: string;
  rating?: string;
  posterUrl?: string;
  backdropUrl?: string;
  genre?: string;
  type: MediaType;
  description?: string;
  seasonsCount?: number;
  duration?: string;
  cast?: string[];
  credits?: { department: string; job: string; cast?: { name: string; character?: string }[] }[];
}

export interface Episode {
  episodeNumber: number;
  seasonNumber: number;
  title?: string;
  airDate?: string;
  overview?: string;
  stillPath?: string;
  runtime?: number;
}

export interface Season {
  seasonNumber: number;
  episodeCount: number;
  episodes: Episode[];
}

export interface TVShowDetails extends MediaItem {
  seasons: Season[];
}

export interface WatchProgress {
  id: string; // IMDB or TMDB ID
  title: string;
  type: MediaType;
  posterUrl?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  rating?: string;
  genre?: string; // Comma-separated genre names, backfilled from media details
  progress: number; // Seconds
  duration: number; // Seconds
  completed?: boolean; // True when the episode was finished (drives the watched checkmark)
  updatedAt: number; // Timestamp
}

export interface WatchlistItem {
  id: string; // IMDB or TMDB ID
  title: string;
  type: MediaType;
  posterUrl?: string;
  year?: string;
  rating?: string;
  updatedAt: number; // Timestamp
}

export interface PlayerCapabilities {
  supportsSubtitles: boolean;
  supportsProgress: boolean;
  supportsAutoplayNext: boolean;
}

import type { MediaType, ProviderId, SubtitleLang, PlayerCapabilities } from '../types';

export interface EmbedOptions {
  id: string; // IMDB or TMDB ID
  type: MediaType;
  season?: number;
  episode?: number;
  subtitle?: SubtitleLang;
  resumeAt?: number;
  autoplay?: boolean;
}

export interface VideoProvider {
  id: ProviderId;
  name: string;
  getEmbedUrl(options: EmbedOptions): string | Promise<string>;
  getCapabilities(): PlayerCapabilities;
}

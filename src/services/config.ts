/** 2embed catalog API. In dev, routes through the Vite proxy to avoid CORS. */
export const EMBED2_BASE = import.meta.env.DEV ? '/embed2' : 'https://api.2embed.cc';

export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
export const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY || '';

/** Fallback TMDB API key embedded in VidRock's public player bundle. */
export const FALLBACK_TMDB_API_KEY = '54e00466a09676df57ba51c4ca30b1a6';

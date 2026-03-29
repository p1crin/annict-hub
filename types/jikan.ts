/**
 * Jikan API (MyAnimeList) Type Definitions
 * API Documentation: https://docs.api.jikan.moe/
 */

// ========================================
// Anime Types
// ========================================

export interface JikanAnime {
  mal_id: number;
  url: string;
  images: JikanImages;
  trailer: JikanTrailer;
  approved: boolean;
  titles: JikanTitle[];
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  title_synonyms: string[];
  type: JikanAnimeType | null;
  source: string | null;
  episodes: number | null;
  status: JikanAiringStatus | null;
  airing: boolean;
  aired: JikanDateRange;
  duration: string | null;
  rating: string | null;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  synopsis: string | null;
  background: string | null;
  season: JikanSeason | null;
  year: number | null;
  broadcast: JikanBroadcast;
  producers: JikanMalItem[];
  licensors: JikanMalItem[];
  studios: JikanMalItem[];
  genres: JikanMalItem[];
  explicit_genres: JikanMalItem[];
  themes: JikanMalItem[];
  demographics: JikanMalItem[];
}

export type JikanAnimeType = 'TV' | 'Movie' | 'OVA' | 'Special' | 'ONA' | 'Music';

export type JikanAiringStatus = 'Finished Airing' | 'Currently Airing' | 'Not yet aired';

export type JikanSeason = 'winter' | 'spring' | 'summer' | 'fall';

// ========================================
// Theme Songs Types
// ========================================

export interface JikanAnimeThemes {
  openings: string[]; // e.g., ["1: \"Song Title\" by Artist (eps 1-12)"]
  endings: string[];
}

export interface JikanParsedTheme {
  sequence: number; // 1, 2, 3, etc.
  title: string;
  artist?: string;
  episodes?: string; // e.g., "1-12" or "1, 3, 5"
  type: 'OP' | 'ED';
  rawString: string; // Original string from API
}

// ========================================
// Images Types
// ========================================

export interface JikanImages {
  jpg: JikanImageSet;
  webp: JikanImageSet;
}

export interface JikanImageSet {
  image_url: string | null;
  small_image_url: string | null;
  large_image_url: string | null;
}

// ========================================
// Common Types
// ========================================

export interface JikanTitle {
  type: string;
  title: string;
}

export interface JikanMalItem {
  mal_id: number;
  type: string;
  name: string;
  url: string;
}

export interface JikanDateRange {
  from: string | null;
  to: string | null;
  prop: {
    from: JikanDate;
    to: JikanDate;
  };
  string: string | null;
}

export interface JikanDate {
  day: number | null;
  month: number | null;
  year: number | null;
}

export interface JikanBroadcast {
  day: string | null;
  time: string | null;
  timezone: string | null;
  string: string | null;
}

export interface JikanTrailer {
  youtube_id: string | null;
  url: string | null;
  embed_url: string | null;
}

// ========================================
// API Response Types
// ========================================

export interface JikanApiResponse<T> {
  data: T;
}

export interface JikanPaginatedResponse<T> {
  data: T[];
  pagination: JikanPagination;
}

export interface JikanPagination {
  last_visible_page: number;
  has_next_page: boolean;
  current_page: number;
  items: {
    count: number;
    total: number;
    per_page: number;
  };
}

// ========================================
// Search Types
// ========================================

export interface JikanSearchParams {
  q?: string; // Search query
  page?: number;
  limit?: number;
  type?: JikanAnimeType;
  score?: number;
  min_score?: number;
  max_score?: number;
  status?: JikanAiringStatus;
  rating?: string;
  sfw?: boolean;
  genres?: string; // Comma-separated genre IDs
  order_by?: 'mal_id' | 'title' | 'start_date' | 'end_date' | 'episodes' | 'score' | 'scored_by' | 'rank' | 'popularity' | 'members' | 'favorites';
  sort?: 'desc' | 'asc';
  letter?: string; // First letter of title
  producer?: string; // Producer ID
}

// ========================================
// Error Types
// ========================================

export interface JikanError {
  status: number;
  type: string;
  message: string;
  error: string;
}

// ========================================
// Helper Types
// ========================================

export interface JikanImageFallback {
  malId: number;
  imageUrl?: string;
  source: 'jikan';
  fetchedAt: Date;
}

export interface JikanThemeSearchResult {
  malId: number;
  themes: JikanParsedTheme[];
  fetchedAt: Date;
}

// ========================================
// Theme Parser Types
// ========================================

export interface JikanThemeParseResult {
  success: boolean;
  theme?: JikanParsedTheme;
  error?: string;
}

// ========================================
// Rate Limiting Types
// ========================================

export interface JikanRateLimitInfo {
  requestsPerSecond: 3;
  requestsPerMinute: 60;
  lastRequestTime: Date;
  queue: Array<() => Promise<any>>;
}

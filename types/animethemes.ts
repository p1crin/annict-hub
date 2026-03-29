/**
 * AnimeThemes.moe API Type Definitions
 * API Documentation: https://docs.animethemes.moe/
 */

// ========================================
// API Response Types
// ========================================

export interface AnimeThemesResponse<T> {
  anime?: T extends 'anime' ? AnimeThemesAnime | AnimeThemesAnime[] : never;
  animetheme?: T extends 'animetheme' ? AnimeTheme | AnimeTheme[] : never;
  links?: AnimeThemesLinks;
  meta?: AnimeThemesMeta;
}

export interface AnimeThemesLinks {
  first?: string;
  last?: string;
  prev?: string | null;
  next?: string | null;
}

export interface AnimeThemesMeta {
  current_page?: number;
  from?: number;
  last_page?: number;
  path?: string;
  per_page?: number;
  to?: number;
  total?: number;
}

// ========================================
// Anime Types
// ========================================

export interface AnimeThemesAnime {
  id: number;
  name: string;
  slug: string;
  year?: number;
  season?: AnimeThemesSeason;
  synopsis?: string;
  media_format?: string;
  animethemes?: AnimeTheme[];
  resources?: AnimeThemesResource[];
  images?: AnimeThemesImage[];
  series?: AnimeThemesSeries[];
  synonyms?: AnimeThemesSynonym[];
}

export type AnimeThemesSeason = 'Winter' | 'Spring' | 'Summer' | 'Fall';

// ========================================
// Theme (OP/ED) Types
// ========================================

export interface AnimeTheme {
  id: number;
  type: 'OP' | 'ED';
  sequence: number;
  slug: string; // e.g., "OP1", "ED2"
  group?: string;
  song?: AnimeThemesSong;
  animethemeentries?: AnimeThemeEntry[];
  anime?: AnimeThemesAnime;
}

export interface AnimeThemesSong {
  id: number;
  title: string;
  artists?: AnimeThemesArtist[];
}

export interface AnimeThemesArtist {
  id: number;
  name: string;
  slug: string;
  as?: string; // Artist credited as
}

// ========================================
// Theme Entry (Video) Types
// ========================================

export interface AnimeThemeEntry {
  id: number;
  version?: number;
  episodes?: string; // e.g., "1-12", "1, 3, 5"
  nsfw: boolean;
  spoiler: boolean;
  notes?: string;
  videos?: AnimeThemesVideo[];
}

export interface AnimeThemesVideo {
  id: number;
  basename: string;
  filename: string;
  path: string;
  size: number;
  resolution: number; // e.g., 720, 1080
  nc: boolean; // Non-Credit
  subbed: boolean;
  lyrics: boolean;
  uncen: boolean;
  source?: 'BD' | 'DVD' | 'WEB' | 'RAW';
  overlap?: 'None' | 'Transition' | 'Over';
  link: string; // Direct video URL
  tags?: string;
  audio?: AnimeThemesAudio;
}

export interface AnimeThemesAudio {
  id: number;
  basename: string;
  filename: string;
  path: string;
  size: number;
  link: string; // Direct audio URL
}

// ========================================
// Resource (External Links) Types
// ========================================

export interface AnimeThemesResource {
  id: number;
  link: string;
  external_id: number;
  site: AnimeThemesResourceSite;
  as?: string;
}

export type AnimeThemesResourceSite =
  | 'MyAnimeList'
  | 'AniList'
  | 'AniDB'
  | 'Kitsu'
  | 'Anime-Planet'
  | 'ANN'
  | 'Official Site'
  | 'Twitter'
  | 'YouTube';

// ========================================
// Image Types
// ========================================

export interface AnimeThemesImage {
  id: number;
  facet: 'Cover' | 'Small Cover' | 'Large Cover';
  link: string;
}

// ========================================
// Series Types
// ========================================

export interface AnimeThemesSeries {
  id: number;
  name: string;
  slug: string;
}

// ========================================
// Synonym (Alternative Titles) Types
// ========================================

export interface AnimeThemesSynonym {
  id: number;
  text: string;
  type?: number;
}

// ========================================
// Search/Filter Parameters
// ========================================

export interface AnimeThemesSearchParams {
  // Filtering
  'filter[name]'?: string;
  'filter[year]'?: number;
  'filter[season]'?: AnimeThemesSeason;
  'filter[site]'?: AnimeThemesResourceSite;
  'filter[external_id]'?: number;
  'filter[has]'?: string; // e.g., "resources"

  // Including relationships
  include?: string; // e.g., "animethemes.song.artists,resources,images"

  // Pagination
  'page[size]'?: number;
  'page[number]'?: number;

  // Sorting
  sort?: string; // e.g., "name", "-year"
}

// ========================================
// Helper Types
// ========================================

export interface AnimeThemesThemeWithDetails extends AnimeTheme {
  songTitle?: string;
  artistNames?: string;
  bestVideo?: AnimeThemesVideo;
  episodeRange?: string;
}

export interface AnimeThemesMatchResult {
  matched: boolean;
  anime?: AnimeThemesAnime;
  themes?: AnimeThemesThemeWithDetails[];
  error?: string;
  matchMethod?: 'mal_id' | 'title_year' | 'title_only' | 'fuzzy';
  confidence?: number; // 0-1
}

// ========================================
// Video Quality Ranking
// ========================================

export interface AnimeThemesVideoQuality {
  video: AnimeThemesVideo;
  score: number; // Calculated quality score
  reasons: string[]; // Why this video was selected
}

export interface AnimeThemesVideoPreferences {
  preferNC: boolean; // Prefer Non-Credit versions
  minResolution: number; // Minimum resolution (e.g., 720)
  preferredSource: 'BD' | 'DVD' | 'WEB' | 'any';
  avoidSpoilers: boolean;
  avoidNSFW: boolean;
}

// ========================================
// Batch Processing Types
// ========================================

export interface AnimeThemesBatchRequest {
  annictWorkId: number;
  title: string;
  titleEn?: string;
  malAnimeId?: number;
  year?: number;
}

export interface AnimeThemesBatchResult extends AnimeThemesBatchRequest {
  success: boolean;
  anime?: AnimeThemesAnime;
  themes?: AnimeThemesThemeWithDetails[];
  error?: string;
}

// ========================================
// Cache Types
// ========================================

export interface AnimeThemesCacheEntry {
  annictWorkId: number;
  animeId: number;
  data: AnimeThemesAnime;
  cachedAt: Date;
  expiresAt: Date;
}

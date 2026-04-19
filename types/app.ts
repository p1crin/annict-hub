/**
 * Application Internal Type Definitions
 */

import type { AnnictStatus, AnnictSeasonName } from './annict';
import type { AnimeCacheRow, ThemeSongRow, SpotifyMatchRow } from './supabase';
import type { SpotifyTrack } from './spotify';

// ========================================
// Anime Display Types
// ========================================

export interface AnimeCardData {
  id: string;
  annictWorkId: number;
  title: string;
  titleEn?: string;
  imageUrl?: string;
  seasonYear?: number;
  seasonName?: string;
  malAnimeId?: number;
  syobocalTid?: number;
  status?: AnnictStatus;
  episodesCount?: number;
  watchersCount?: number;
  hasThemes: boolean;
  themesCount: number;
}

export interface AnimeWithThemes extends AnimeCardData {
  themes: ThemeSongData[];
}

export interface ThemeSongData {
  id: string;
  annictWorkId: number;
  type: 'OP' | 'ED';
  sequence: number;
  title: string;
  titleJa?: string;
  artist?: string;
  artistJa?: string;
  episodes?: string;
  videoUrl?: string;
  audioUrl?: string;
  source: 'animethemes' | 'jikan' | 'manual' | 'syobocal';
  confidence?: 'high' | 'medium' | 'low';
  animethemesAnimeId?: number;
  animethemesThemeId?: number;
  spotifyMatch?: SpotifyMatchData;
  /** Anime release year, used by the Spotify scorer for release-year proximity. */
  seasonYear?: number;
  /** Anime title, used as free-text context in Spotify fallback searches. */
  animeTitle?: string;
}

export interface SpotifyMatchData {
  id: string;
  trackId: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  albumImageUrl?: string;
  previewUrl?: string;
  spotifyUri: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  verified: boolean;
}

export interface SpotifyMatchResult {
  theme: ThemeSongData;
  spotifyTrack: SpotifyTrack | null;
  score?: number;
  confidence: 'high' | 'medium' | 'low';
}

// ========================================
// Filter & Search Types
// ========================================

export interface AnimeFilterOptions {
  search?: string;
  status?: AnnictStatus[];
  seasonYear?: number;
  seasonName?: AnnictSeasonName;
  minWatchersCount?: number;
  hasThemes?: boolean;
  sortBy?: AnimeSortField;
}

export type AnimeSortField =
  | 'default'
  | 'year_desc'
  | 'title_asc'
  | 'popularity_desc';

export interface SearchState {
  query: string;
  filters: AnimeFilterOptions;
  results: AnimeCardData[];
  totalCount: number;
  isLoading: boolean;
  error?: string;
}

// ========================================
// Playlist Creation Types
// ========================================

export interface PlaylistCreationState {
  step: PlaylistCreationStep;
  selectedAnime: AnimeCardData[];
  themes: ThemeSongWithAnime[];
  spotifyMatches: Map<string, SpotifyMatchCandidate[]>; // themeId -> candidates
  userSelections: Map<string, string>; // themeId -> selectedSpotifyTrackId
  skippedThemes: SkippedTheme[];
  progress: PlaylistProgress;
  error?: string;
}

export type PlaylistCreationStep =
  | 'select_anime'
  | 'fetch_themes'
  | 'search_spotify'
  | 'review_matches'
  | 'create_playlist'
  | 'completed'
  | 'error';

export interface ThemeSongWithAnime extends ThemeSongData {
  animeTitle: string;
  animeImageUrl?: string;
}

export interface SpotifyMatchCandidate {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  albumImageUrl?: string;
  previewUrl?: string;
  spotifyUri: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  matchReasons: string[];
}

export interface SkippedTheme {
  themeId: string;
  themeTitle: string;
  animeTitle: string;
  reason: SkipReason;
}

export type SkipReason =
  | 'no_match_found'
  | 'low_confidence'
  | 'user_skipped'
  | 'error';

export interface PlaylistProgress {
  currentStep: PlaylistCreationStep;
  stepProgress: number; // 0-100
  totalProgress: number; // 0-100
  message: string;
  processedCount: number;
  totalCount: number;
}

export interface PlaylistCreationResult {
  playlistId: string;
  playlistUrl: string;
  playlistName: string;
  summary: {
    total: number;
    added: number;
    skipped: number;
    reviewed: number;
  };
  addedTracks: Array<{
    themeTitle: string;
    animeTitle: string;
    spotifyTrackName: string;
    score: number;
  }>;
  skippedThemes: SkippedTheme[];
}

// ========================================
// Session & Auth Types
// ========================================

export interface AppSession {
  user: AppUser;
  annictToken: string;
  spotifyToken?: SpotifyTokenData;
  expiresAt: Date;
}

export interface AppUser {
  id: string;
  annictId: number;
  username: string;
  name?: string;
  avatarUrl?: string;
}

export interface SpotifyTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user?: AppUser;
  hasAnnictAuth: boolean;
  hasSpotifyAuth: boolean;
  isLoading: boolean;
  error?: string;
}

// ========================================
// UI State Types
// ========================================

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100
}

export interface ErrorState {
  hasError: boolean;
  message: string;
  details?: string;
  retryable: boolean;
  onRetry?: () => void;
}

// ========================================
// Pagination Types
// ========================================

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface InfiniteScrollState {
  items: AnimeCardData[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error?: string;
  nextCursor?: string;
}

// ========================================
// API Response Types
// ========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  statusCode?: number;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationState;
}

// ========================================
// Cache Types
// ========================================

export interface CacheEntry<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  key: string;
}

export interface CacheOptions {
  ttl?: number; // seconds
  forceRefresh?: boolean;
}

// ========================================
// Batch Processing Types
// ========================================

export interface BatchProcessingState<T, R> {
  items: T[];
  results: Map<string, R>; // itemId -> result
  errors: Map<string, Error>; // itemId -> error
  progress: number; // 0-100
  isProcessing: boolean;
  isPaused: boolean;
  currentBatch: number;
  totalBatches: number;
}

export interface BatchProcessingOptions {
  batchSize: number;
  concurrency: number;
  delayBetweenBatches?: number; // ms
  onProgress?: (progress: number) => void;
  onBatchComplete?: (batchNumber: number) => void;
  onError?: (error: Error, itemId: string) => void;
}

// ========================================
// Form Types
// ========================================

export interface PlaylistCreationFormData {
  name: string;
  description?: string;
  makePublic: boolean;
  autoSelectHighConfidence: boolean;
  skipLowConfidence: boolean;
}

export interface AnimeSelectionFormData {
  selectedAnimeIds: string[];
  includeOP: boolean;
  includeED: boolean;
}

// ========================================
// Statistics Types
// ========================================

export interface DashboardStatistics {
  totalAnime: number;
  totalThemes: number;
  totalPlaylists: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'playlist_created' | 'anime_added' | 'theme_matched';
  title: string;
  description?: string;
  timestamp: Date;
  metadata?: unknown;
}

// ========================================
// Utility Types
// ========================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>>
  & {
    [K in Keys]-?:
      Required<Pick<T, K>>
      & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys];

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

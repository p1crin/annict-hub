/**
 * Spotify Web API Type Definitions
 * API Documentation: https://developer.spotify.com/documentation/web-api
 */

// ========================================
// OAuth Types
// ========================================

export interface SpotifyOAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyOAuthError {
  error: string;
  error_description?: string;
}

// ========================================
// User Types
// ========================================

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  country?: string;
  product?: 'premium' | 'free' | 'open';
  images?: SpotifyImage[];
  followers?: SpotifyFollowers;
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'user';
}

export interface SpotifyFollowers {
  href: string | null;
  total: number;
}

// ========================================
// Track Types
// ========================================

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  explicit: boolean;
  popularity: number;
  preview_url?: string | null;
  track_number: number;
  disc_number: number;
  external_ids?: SpotifyExternalIds;
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'track';
  is_local: boolean;
  is_playable?: boolean;
}

export interface SpotifySimplifiedTrack {
  id: string;
  name: string;
  artists: SpotifySimplifiedArtist[];
  duration_ms: number;
  explicit: boolean;
  preview_url?: string | null;
  track_number: number;
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'track';
  is_local: boolean;
}

// ========================================
// Artist Types
// ========================================

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  popularity?: number;
  followers?: SpotifyFollowers;
  images?: SpotifyImage[];
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'artist';
}

export interface SpotifySimplifiedArtist {
  id: string;
  name: string;
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'artist';
}

// ========================================
// Album Types
// ========================================

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: 'album' | 'single' | 'compilation';
  artists: SpotifySimplifiedArtist[];
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  total_tracks: number;
  images: SpotifyImage[];
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'album';
  genres?: string[];
  label?: string;
  popularity?: number;
}

export interface SpotifySimplifiedAlbum {
  id: string;
  name: string;
  album_type: 'album' | 'single' | 'compilation';
  artists: SpotifySimplifiedArtist[];
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  total_tracks: number;
  images: SpotifyImage[];
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'album';
}

// ========================================
// Playlist Types
// ========================================

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  public: boolean;
  collaborative: boolean;
  owner: SpotifyUser;
  tracks: SpotifyPagingObject<SpotifyPlaylistTrack>;
  images: SpotifyImage[];
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'playlist';
  snapshot_id: string;
  followers?: SpotifyFollowers;
}

export interface SpotifySimplifiedPlaylist {
  id: string;
  name: string;
  description: string | null;
  public: boolean;
  collaborative: boolean;
  owner: SpotifyUser;
  tracks: {
    href: string;
    total: number;
  };
  images: SpotifyImage[];
  external_urls: SpotifyExternalUrls;
  href: string;
  uri: string;
  type: 'playlist';
  snapshot_id: string;
}

export interface SpotifyPlaylistTrack {
  added_at: string;
  added_by: SpotifyUser;
  is_local: boolean;
  track: SpotifyTrack;
}

// ========================================
// Search Types
// ========================================

export interface SpotifySearchResponse {
  tracks?: SpotifyPagingObject<SpotifyTrack>;
  artists?: SpotifyPagingObject<SpotifyArtist>;
  albums?: SpotifyPagingObject<SpotifyAlbum>;
  playlists?: SpotifyPagingObject<SpotifySimplifiedPlaylist>;
}

export interface SpotifySearchParams {
  q: string;
  type: ('track' | 'artist' | 'album' | 'playlist')[];
  market?: string;
  limit?: number;
  offset?: number;
}

// ========================================
// Common Types
// ========================================

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyExternalUrls {
  spotify: string;
}

export interface SpotifyExternalIds {
  isrc?: string;
  ean?: string;
  upc?: string;
}

export interface SpotifyPagingObject<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

// ========================================
// Error Types
// ========================================

export interface SpotifyError {
  error: {
    status: number;
    message: string;
  };
}

export interface SpotifyRateLimitError extends SpotifyError {
  error: {
    status: 429;
    message: string;
  };
  'retry-after': number;
}

// ========================================
// Playlist Creation Types
// ========================================

export interface SpotifyCreatePlaylistRequest {
  name: string;
  description?: string;
  public?: boolean;
  collaborative?: boolean;
}

export interface SpotifyAddTracksRequest {
  uris: string[]; // Track URIs
  position?: number;
}

export interface SpotifyAddTracksResponse {
  snapshot_id: string;
}

// ========================================
// Matching & Scoring Types
// ========================================

export interface SpotifyTrackMatch {
  track: SpotifyTrack;
  score: number; // 0-100
  reasons: SpotifyMatchReason[];
  confidence: 'high' | 'medium' | 'low';
}

export interface SpotifyMatchReason {
  type:
    | 'title_exact'
    | 'title_similar'
    | 'artist_exact'
    | 'artist_similar'
    | 'artist_mismatch'
    | 'popularity'
    | 'release_year';
  score: number;
  details?: string;
}

export interface SpotifySearchQuery {
  trackTitle: string;
  /** Full artist string as received (e.g. "A、B、C"). Used for scoring. */
  artistName?: string;
  /** Single primary artist, used for Spotify's `artist:"..."` field modifier. */
  primaryArtist?: string;
  /** Anime title, used as additional free-text context in fallback searches. */
  animeTitle?: string;
  albumName?: string;
  year?: number;
}

export interface SpotifyMatchingOptions {
  minScore?: number; // Minimum score to consider a match (0-100)
  maxResults?: number; // Maximum number of candidates to return
  preferExactArtist?: boolean;
  preferPopular?: boolean;
  market?: string; // e.g., 'JP' for Japan
}

// ========================================
// Batch Operations
// ========================================

export interface SpotifyBatchSearchRequest {
  queries: SpotifySearchQuery[];
  options?: SpotifyMatchingOptions;
}

export interface SpotifyBatchSearchResult {
  query: SpotifySearchQuery;
  matches: SpotifyTrackMatch[];
  bestMatch?: SpotifyTrackMatch;
  status: 'success' | 'no_match' | 'error';
  error?: string;
}

// ========================================
// Playlist Creation Flow Types
// ========================================

export interface SpotifyPlaylistCreationRequest {
  name: string;
  description?: string;
  tracks: Array<{
    animeTitle: string;
    themeTitle: string;
    themeArtist?: string;
    spotifyTrackUri?: string; // If already matched
    searchQuery?: SpotifySearchQuery;
  }>;
  options?: {
    autoSelectHighConfidence: boolean; // Auto-add tracks with high confidence
    skipLowConfidence: boolean; // Skip tracks with low confidence without asking
    makePublic: boolean;
  };
}

export interface SpotifyPlaylistCreationResult {
  playlist: SpotifyPlaylist;
  addedTracks: Array<{
    animeTitle: string;
    themeTitle: string;
    spotifyTrack: SpotifyTrack;
    score: number;
  }>;
  skippedTracks: Array<{
    animeTitle: string;
    themeTitle: string;
    reason: string;
  }>;
  manualReviewRequired: Array<{
    animeTitle: string;
    themeTitle: string;
    candidates: SpotifyTrackMatch[];
  }>;
  summary: {
    total: number;
    added: number;
    skipped: number;
    needsReview: number;
  };
}

// ========================================
// Token Management
// ========================================

export interface SpotifyTokenInfo {
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
  scope: string;
}

export interface SpotifyTokenRefreshRequest {
  refresh_token: string;
  grant_type: 'refresh_token';
}

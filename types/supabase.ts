/**
 * Supabase Database Type Definitions
 */

// ========================================
// Database Tables
// ========================================

export interface Database {
  public: {
    Tables: {
      users: User;
      anime_cache: AnimeCache;
      theme_songs: ThemeSong;
      spotify_matches: SpotifyMatch;
      rankings: Ranking;
      ranking_items: RankingItem;
    };
  };
}

// ========================================
// User Table
// ========================================

export interface User {
  Row: UserRow;
  Insert: UserInsert;
  Update: UserUpdate;
}

export interface UserRow {
  id: string; // UUID
  annict_id: number;
  username: string;
  name?: string;
  avatar_url?: string;
  annict_access_token?: string; // Encrypted
  spotify_access_token?: string; // Encrypted
  spotify_refresh_token?: string; // Encrypted
  spotify_token_expires_at?: string; // ISO timestamp
  created_at: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

export type UserInsert = Omit<UserRow, 'id' | 'created_at' | 'updated_at'>;
export type UserUpdate = Partial<UserInsert>;

// ========================================
// Anime Cache Table
// ========================================

export interface AnimeCache {
  Row: AnimeCacheRow;
  Insert: AnimeCacheInsert;
  Update: AnimeCacheUpdate;
}

export interface AnimeCacheRow {
  id: string; // UUID
  annict_user_id: number; // Annict user ID for cache separation
  annict_work_id: number;
  title: string;
  title_en?: string;
  title_kana?: string;
  mal_anime_id?: number;
  syobocal_tid?: number; // Syobocal Title ID for theme lookup
  anilist_anime_id?: number;
  season_year?: number;
  season_name?: string; // 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN'
  image_url?: string;
  image_source?: 'annict' | 'jikan'; // Where the image came from
  media?: string; // 'TV' | 'OVA' | 'MOVIE' | 'WEB' | 'OTHER'
  episodes_count?: number;
  watchers_count?: number;
  last_tracked_at?: string;
  official_site_url?: string;
  twitter_username?: string;
  animethemes_anime_id?: number; // Matched AnimeThemes.moe ID
  animethemes_slug?: string;
  status?: string; // User's watch status: 'WANNA_WATCH' | 'WATCHING' | 'WATCHED' | 'ON_HOLD' | 'STOP_WATCHING' | 'NO_STATUS'
  synced_at: string; // ISO timestamp
  created_at: string; // ISO timestamp
}

export type AnimeCacheInsert = Omit<AnimeCacheRow, 'id' | 'created_at'>;
export type AnimeCacheUpdate = Partial<AnimeCacheInsert>;

// ========================================
// Theme Songs Table
// ========================================

export interface ThemeSong {
  Row: ThemeSongRow;
  Insert: ThemeSongInsert;
  Update: ThemeSongUpdate;
}

export interface ThemeSongRow {
  id: string; // UUID
  anime_cache_id: string; // FK to anime_cache
  type: 'OP' | 'ED';
  sequence: number; // 1, 2, 3, etc.
  title: string;
  title_ja?: string;
  artist?: string;
  artist_ja?: string;
  episodes?: string; // e.g., "1-12"
  animethemes_id?: number; // AnimeThemes.moe theme ID
  animethemes_slug?: string; // e.g., "OP1"
  video_url?: string; // AnimeThemes.moe video URL
  video_resolution?: number;
  source: 'animethemes' | 'jikan' | 'manual' | 'syobocal';
  synced_at: string; // ISO timestamp
  created_at: string; // ISO timestamp
}

export type ThemeSongInsert = Omit<ThemeSongRow, 'id' | 'created_at'>;
export type ThemeSongUpdate = Partial<ThemeSongInsert>;

// ========================================
// Spotify Matches Table
// ========================================

export interface SpotifyMatch {
  Row: SpotifyMatchRow;
  Insert: SpotifyMatchInsert;
  Update: SpotifyMatchUpdate;
}

export interface SpotifyMatchRow {
  id: string; // UUID
  theme_song_id: string; // FK to theme_songs
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  album_name?: string;
  album_image_url?: string;
  preview_url?: string;
  spotify_uri: string; // spotify:track:...
  score: number; // 0-100
  confidence: 'high' | 'medium' | 'low';
  match_reasons?: string; // JSON string of match reasons
  verified: boolean; // User-verified match
  verified_by?: string; // User ID who verified
  created_at: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

export type SpotifyMatchInsert = Omit<SpotifyMatchRow, 'id' | 'created_at' | 'updated_at'>;
export type SpotifyMatchUpdate = Partial<SpotifyMatchInsert>;

// ========================================
// Rankings Table (Future Feature)
// ========================================

export interface Ranking {
  Row: RankingRow;
  Insert: RankingInsert;
  Update: RankingUpdate;
}

export interface RankingRow {
  id: string; // UUID
  user_id: string; // FK to users
  title: string;
  description?: string;
  season?: string; // e.g., "2024-autumn"
  year?: number;
  is_public: boolean;
  slug?: string; // URL-friendly slug
  views_count: number;
  likes_count: number;
  created_at: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

export type RankingInsert = Omit<RankingRow, 'id' | 'views_count' | 'likes_count' | 'created_at' | 'updated_at'>;
export type RankingUpdate = Partial<RankingInsert>;

// ========================================
// Ranking Items Table (Future Feature)
// ========================================

export interface RankingItem {
  Row: RankingItemRow;
  Insert: RankingItemInsert;
  Update: RankingItemUpdate;
}

export interface RankingItemRow {
  id: string; // UUID
  ranking_id: string; // FK to rankings
  anime_cache_id: string; // FK to anime_cache
  rank: number; // 1, 2, 3, etc.
  comment?: string;
  created_at: string; // ISO timestamp
}

export type RankingItemInsert = Omit<RankingItemRow, 'id' | 'created_at'>;
export type RankingItemUpdate = Partial<RankingItemInsert>;

// ========================================
// Joined Types (for queries with joins)
// ========================================

export interface AnimeCacheWithThemes extends AnimeCacheRow {
  theme_songs: ThemeSongRow[];
}

export interface ThemeSongWithSpotifyMatch extends ThemeSongRow {
  spotify_match?: SpotifyMatchRow;
  anime: AnimeCacheRow;
}

export interface SpotifyMatchWithTheme extends SpotifyMatchRow {
  theme_song: ThemeSongRow;
}

export interface RankingWithItems extends RankingRow {
  ranking_items: Array<RankingItemRow & { anime: AnimeCacheRow }>;
  user: Pick<UserRow, 'id' | 'username' | 'avatar_url'>;
}

// ========================================
// Query Result Types
// ========================================

export interface AnimeCacheQueryResult {
  data: AnimeCacheRow[] | null;
  error: Error | null;
  count: number | null;
}

export interface ThemeSongQueryResult {
  data: ThemeSongRow[] | null;
  error: Error | null;
  count: number | null;
}

export interface SpotifyMatchQueryResult {
  data: SpotifyMatchRow[] | null;
  error: Error | null;
  count: number | null;
}

// ========================================
// Cache Statistics
// ========================================

export interface CacheStatistics {
  totalAnime: number;
  totalThemes: number;
  totalSpotifyMatches: number;
  cacheHitRate: number; // 0-1
  averageMatchScore: number; // 0-100
  lastSyncedAt?: string;
}

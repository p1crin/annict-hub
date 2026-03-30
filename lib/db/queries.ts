/**
 * Database Query Helpers
 */

import { supabase, getServiceRoleClient, isCacheFresh, getCacheTTL } from './supabase';
import type {
  AnimeCacheRow,
  AnimeCacheInsert,
  ThemeSongRow,
  ThemeSongInsert,
  SpotifyMatchRow,
  SpotifyMatchInsert,
  UserRow,
  UserInsert,
} from '@/types/supabase';

// ========================================
// User Queries
// ========================================

export async function getUserByAnnictId(annictId: number): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('annict_id', annictId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return data;
}

export async function upsertUser(user: UserInsert): Promise<UserRow | null> {
  const client = getServiceRoleClient();

  const { data, error } = await client
    .from('users')
    .upsert(user as any, {
      onConflict: 'annict_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting user:', error);
    return null;
  }

  return data as unknown as UserRow;
}

// ========================================
// Anime Cache Queries
// ========================================

export async function getAnimeCacheByAnnictId(
  annictWorkId: number
): Promise<AnimeCacheRow | null> {
  const { data, error } = await supabase
    .from('anime_cache')
    .select('*')
    .eq('annict_work_id', annictWorkId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Error fetching anime cache:', error);
    return null;
  }

  return data;
}

export async function getAnimeCacheByAnnictIds(
  annictWorkIds: number[]
): Promise<AnimeCacheRow[]> {
  const { data, error } = await supabase
    .from('anime_cache')
    .select('*')
    .in('annict_work_id', annictWorkIds);

  if (error) {
    console.error('Error fetching anime caches:', error);
    return [];
  }

  return data || [];
}

export async function upsertAnimeCache(
  anime: AnimeCacheInsert
): Promise<AnimeCacheRow | null> {
  const client = getServiceRoleClient();

  const { data, error } = await client
    .from('anime_cache')
    .upsert(anime as any, {
      onConflict: 'annict_work_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting anime cache:', error);
    return null;
  }

  return data as unknown as AnimeCacheRow;
}

export async function bulkUpsertAnimeCache(
  animes: AnimeCacheInsert[]
): Promise<AnimeCacheRow[]> {
  const client = getServiceRoleClient();

  const { data, error } = await client
    .from('anime_cache')
    .upsert(animes as any, {
      onConflict: 'annict_work_id',
    })
    .select();

  if (error) {
    console.error('Error bulk upserting anime cache:', error);
    return [];
  }

  return (data as unknown as AnimeCacheRow[]) || [];
}

// ========================================
// Theme Song Queries
// ========================================

export async function getThemeSongsByAnimeId(
  animeCacheId: string
): Promise<ThemeSongRow[]> {
  const { data, error } = await supabase
    .from('theme_songs')
    .select('*')
    .eq('anime_cache_id', animeCacheId)
    .order('type', { ascending: true })
    .order('sequence', { ascending: true });

  if (error) {
    console.error('Error fetching theme songs:', error);
    return [];
  }

  return data || [];
}

export async function upsertThemeSong(
  theme: ThemeSongInsert
): Promise<ThemeSongRow | null> {
  const client = getServiceRoleClient();

  const { data, error } = await client
    .from('theme_songs')
    .upsert(theme as any, {
      onConflict: 'anime_cache_id,type,sequence',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting theme song:', error);
    return null;
  }

  return data as unknown as ThemeSongRow;
}

export async function bulkUpsertThemeSongs(
  themes: ThemeSongInsert[]
): Promise<ThemeSongRow[]> {
  const client = getServiceRoleClient();

  const { data, error } = await client
    .from('theme_songs')
    .upsert(themes as any, {
      onConflict: 'anime_cache_id,type,sequence',
    })
    .select();

  if (error) {
    console.error('Error bulk upserting theme songs:', error);
    return [];
  }

  return (data as unknown as ThemeSongRow[]) || [];
}

// ========================================
// Spotify Match Queries
// ========================================

export async function getSpotifyMatchByThemeId(
  themeSongId: string
): Promise<SpotifyMatchRow | null> {
  const { data, error } = await supabase
    .from('spotify_matches')
    .select('*')
    .eq('theme_song_id', themeSongId)
    .order('score', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Error fetching spotify match:', error);
    return null;
  }

  return data;
}

export async function getSpotifyMatchesByThemeIds(
  themeSongIds: string[]
): Promise<SpotifyMatchRow[]> {
  const { data, error } = await supabase
    .from('spotify_matches')
    .select('*')
    .in('theme_song_id', themeSongIds)
    .order('score', { ascending: false });

  if (error) {
    console.error('Error fetching spotify matches:', error);
    return [];
  }

  return data || [];
}

export async function upsertSpotifyMatch(
  match: SpotifyMatchInsert
): Promise<SpotifyMatchRow | null> {
  const client = getServiceRoleClient();

  const { data, error } = await client
    .from('spotify_matches')
    .upsert(match as any, {
      onConflict: 'theme_song_id,spotify_track_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting spotify match:', error);
    return null;
  }

  return data as unknown as SpotifyMatchRow;
}

export async function bulkUpsertSpotifyMatches(
  matches: SpotifyMatchInsert[]
): Promise<SpotifyMatchRow[]> {
  const client = getServiceRoleClient();

  const { data, error } = await client
    .from('spotify_matches')
    .upsert(matches as any, {
      onConflict: 'theme_song_id,spotify_track_id',
    })
    .select();

  if (error) {
    console.error('Error bulk upserting spotify matches:', error);
    return [];
  }

  return (data as unknown as SpotifyMatchRow[]) || [];
}

// ========================================
// Cache Management
// ========================================

export async function checkAnimeCacheFreshness(
  annictWorkId: number,
  ttlSeconds?: number
): Promise<boolean> {
  const cached = await getAnimeCacheByAnnictId(annictWorkId);
  if (!cached) return false;

  return isCacheFresh(cached.synced_at, ttlSeconds || getCacheTTL());
}

export async function getCachedAnimeWithThemes(annictWorkId: number) {
  const anime = await getAnimeCacheByAnnictId(annictWorkId);
  if (!anime) return null;

  const themes = await getThemeSongsByAnimeId(anime.id);
  const themeIds = themes.map((t) => t.id);
  const matches = await getSpotifyMatchesByThemeIds(themeIds);

  const themesWithMatches = themes.map((theme) => ({
    ...theme,
    spotify_match: matches.find((m) => m.theme_song_id === theme.id),
  }));

  return {
    ...anime,
    themes: themesWithMatches,
  };
}

// ========================================
// Statistics
// ========================================

export async function getCacheStatistics() {
  const client = getServiceRoleClient();

  const [animeCount, themesCount, matchesCount] = await Promise.all([
    client.from('anime_cache').select('id', { count: 'exact', head: true }),
    client.from('theme_songs').select('id', { count: 'exact', head: true }),
    client.from('spotify_matches').select('id', { count: 'exact', head: true }),
  ]);

  const avgScoreResult = await client
    .from('spotify_matches')
    .select('score');

  const scores = (avgScoreResult.data as any)?.map((m: any) => Number(m.score)) || [];
  const avgScore = scores.length > 0
    ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    : 0;

  return {
    totalAnime: animeCount.count || 0,
    totalThemes: themesCount.count || 0,
    totalSpotifyMatches: matchesCount.count || 0,
    averageMatchScore: avgScore,
  };
}

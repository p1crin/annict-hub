/**
 * Spotify Web API Client
 */

import axios, { AxiosInstance } from 'axios';
import { spotifyRateLimiter } from '../utils/rate-limit';
import { retry } from '../utils/retry';
import type {
  SpotifyUser,
  SpotifyTrack,
  SpotifySearchResponse,
  SpotifyPlaylist,
  SpotifyTrackMatch,
  SpotifyMatchReason,
  SpotifySearchQuery,
  SpotifyMatchingOptions,
  SpotifyCreatePlaylistRequest,
  SpotifyAddTracksRequest,
} from '@/types/spotify';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// ========================================
// Pure helpers (exported for testing)
// ========================================

/**
 * Normalize + compare two strings. Returns 0-1 similarity.
 * Strips punctuation, lowercases, and uses containment + Levenshtein.
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const a = normalize(str1);
  const b = normalize(str2);

  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;

  if (a.includes(b) || b.includes(a)) {
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;
    return shorter.length / longer.length;
  }

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

/**
 * Best per-artist similarity.
 * Checks each Spotify artist individually against both the primary artist and
 * the full artist string (e.g. "A、B、C"), returning the maximum. This prevents
 * short primary names from being "drowned" by a long multi-artist field.
 */
export function bestArtistSimilarity(
  trackArtists: Array<{ name: string }>,
  query: { artistName?: string; primaryArtist?: string }
): number {
  const targets = [query.primaryArtist, query.artistName].filter(
    (s): s is string => !!s && s.length > 0
  );
  if (targets.length === 0 || trackArtists.length === 0) return 0;

  let best = 0;
  for (const artist of trackArtists) {
    for (const target of targets) {
      const sim = calculateStringSimilarity(artist.name, target);
      if (sim > best) best = sim;
    }
  }
  return best;
}

/**
 * Score a track against a search query. Pure function — used by the class
 * method and by tests directly.
 */
export function scoreTrackMatch(
  track: SpotifyTrack,
  query: SpotifySearchQuery,
  options: { preferExactArtist?: boolean } = {}
): { score: number; reasons: SpotifyMatchReason[] } {
  const reasons: SpotifyMatchReason[] = [];
  let totalScore = 0;

  // Title similarity (50 points max)
  const titleSimilarity = calculateStringSimilarity(track.name, query.trackTitle);
  const titleScore = titleSimilarity * 50;
  totalScore += titleScore;

  if (titleSimilarity >= 0.9) {
    reasons.push({
      type: 'title_exact',
      score: titleScore,
      details: 'Exact or near-exact title match',
    });
  } else if (titleSimilarity >= 0.6) {
    reasons.push({
      type: 'title_similar',
      score: titleScore,
      details: `Title similarity: ${(titleSimilarity * 100).toFixed(0)}%`,
    });
  }

  // Artist similarity (30 points max, -30 penalty for strong mismatch)
  const hasArtistQuery = !!(query.artistName || query.primaryArtist);
  if (hasArtistQuery) {
    const artistSimilarity = bestArtistSimilarity(track.artists, query);
    const artistScore = artistSimilarity * 30;
    totalScore += artistScore;

    if (artistSimilarity >= 0.9) {
      reasons.push({
        type: 'artist_exact',
        score: artistScore,
        details: 'Exact or near-exact artist match',
      });
    } else if (artistSimilarity >= 0.6) {
      reasons.push({
        type: 'artist_similar',
        score: artistScore,
        details: `Artist similarity: ${(artistSimilarity * 100).toFixed(0)}%`,
      });
    }

    // Strong mismatch: a high title match with an unrelated artist is the
    // single biggest source of wrong bestMatch (see wrong character-song
    // matches reported in ops). Penalize so those fall below the threshold.
    if (artistSimilarity < 0.3) {
      const penalty = options.preferExactArtist ? -50 : -30;
      totalScore += penalty;
      reasons.push({
        type: 'artist_mismatch',
        score: penalty,
        details: `Artist mismatch (similarity ${(artistSimilarity * 100).toFixed(0)}%)`,
      });
    }
  }

  // Popularity bonus (10 points max)
  const popularityScore = (track.popularity / 100) * 10;
  totalScore += popularityScore;
  reasons.push({
    type: 'popularity',
    score: popularityScore,
    details: `Popularity: ${track.popularity}/100`,
  });

  // Release year proximity (10 points max)
  if (query.year && track.album.release_date) {
    const releaseYear = parseInt(track.album.release_date.substring(0, 4), 10);
    const yearDiff = Math.abs(releaseYear - query.year);
    const yearScore = Math.max(0, 10 - yearDiff);
    totalScore += yearScore;

    if (yearDiff === 0) {
      reasons.push({
        type: 'release_year',
        score: yearScore,
        details: 'Same release year',
      });
    } else if (yearDiff <= 2) {
      reasons.push({
        type: 'release_year',
        score: yearScore,
        details: `Release year within ${yearDiff} year(s)`,
      });
    }
  }

  // Clamp to [0, 100] so penalties can't produce negatives and bonuses can't
  // push above 100 if inputs are extreme.
  totalScore = Math.max(0, Math.min(100, totalScore));
  return { score: totalScore, reasons };
}

/**
 * Build a Spotify search query string using field modifiers.
 * Uses `track:"..."` and `artist:"..."` for precision. Strips embedded `"`
 * since Spotify has no literal-quote escape.
 */
export function buildSpotifySearchString(query: SpotifySearchQuery): string {
  const sanitize = (s: string) => s.replace(/"/g, '').trim();
  const parts: string[] = [];
  parts.push(`track:"${sanitize(query.trackTitle)}"`);
  if (query.primaryArtist) parts.push(`artist:"${sanitize(query.primaryArtist)}"`);
  if (query.year) parts.push(`year:${query.year}`);
  return parts.join(' ');
}

/**
 * Free-text fallback query. No field modifiers — used when the structured
 * query returned nothing strong.
 */
export function buildFreeTextSearchString(query: SpotifySearchQuery): string {
  const parts: string[] = [query.trackTitle];
  if (query.primaryArtist) parts.push(query.primaryArtist);
  if (query.animeTitle) parts.push(query.animeTitle);
  return parts.filter((p) => p && p.length > 0).join(' ').trim();
}

class SpotifyClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: SPOTIFY_API_BASE,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(accessToken: string): Promise<SpotifyUser | null> {
    try {
      const result = await spotifyRateLimiter.execute(() =>
        retry(() =>
          this.client.get<SpotifyUser>('/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        )
      );

      return result.data;
    } catch (error: any) {
      console.error('Spotify: Failed to get current user:', error.message);
      return null;
    }
  }

  /**
   * Search for tracks
   */
  async searchTracks(
    query: string,
    accessToken: string,
    limit: number = 10
  ): Promise<SpotifyTrack[]> {
    try {
      const result = await spotifyRateLimiter.execute(() =>
        retry(() =>
          this.client.get<SpotifySearchResponse>('/search', {
            params: {
              q: query,
              type: 'track',
              limit,
              market: 'JP', // Prefer Japanese market for anime songs
            },
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        )
      );

      return result.data.tracks?.items || [];
    } catch (error: any) {
      console.error(`Spotify: Failed to search tracks "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Search and match tracks with scoring.
   * Builds a structured Spotify query (track:/artist:/year:) so field
   * boundaries are clear, then scores each candidate with scoreTrackMatch.
   */
  async searchAndMatch(
    query: SpotifySearchQuery,
    accessToken: string,
    options: SpotifyMatchingOptions = {}
  ): Promise<SpotifyTrackMatch[]> {
    const {
      minScore = 60,
      maxResults = 5,
      preferExactArtist = true,
    } = options;

    const searchQuery = buildSpotifySearchString(query);
    const tracks = await this.searchTracks(searchQuery, accessToken, 20);

    const matches: SpotifyTrackMatch[] = tracks
      .map((track) => {
        const { score, reasons } = scoreTrackMatch(track, query, {
          preferExactArtist,
        });

        let confidence: 'high' | 'medium' | 'low';
        if (score >= 80) confidence = 'high';
        else if (score >= 60) confidence = 'medium';
        else confidence = 'low';

        return { track, score, reasons, confidence };
      })
      .filter((match) => match.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return matches;
  }

  /**
   * Free-text variant of searchAndMatch. Used as fallback when the structured
   * query returns weak results. Builds `title artist animeTitle` without
   * field modifiers.
   */
  async searchAndMatchFreeText(
    query: SpotifySearchQuery,
    accessToken: string,
    options: SpotifyMatchingOptions = {}
  ): Promise<SpotifyTrackMatch[]> {
    const {
      minScore = 60,
      maxResults = 5,
      preferExactArtist = true,
    } = options;

    const searchQuery = buildFreeTextSearchString(query);
    const tracks = await this.searchTracks(searchQuery, accessToken, 20);

    const matches: SpotifyTrackMatch[] = tracks
      .map((track) => {
        const { score, reasons } = scoreTrackMatch(track, query, {
          preferExactArtist,
        });

        let confidence: 'high' | 'medium' | 'low';
        if (score >= 80) confidence = 'high';
        else if (score >= 60) confidence = 'medium';
        else confidence = 'low';

        return { track, score, reasons, confidence };
      })
      .filter((match) => match.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return matches;
  }

  /**
   * Create a playlist
   */
  async createPlaylist(
    userId: string,
    request: SpotifyCreatePlaylistRequest,
    accessToken: string
  ): Promise<SpotifyPlaylist | null> {
    try {
      const result = await spotifyRateLimiter.execute(() =>
        retry(() =>
          this.client.post<SpotifyPlaylist>(
            `/users/${userId}/playlists`,
            request,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          )
        )
      );

      return result.data;
    } catch (error: any) {
      console.error('Spotify: Failed to create playlist:', error.message);
      return null;
    }
  }

  /**
   * Add tracks to playlist
   */
  async addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    accessToken: string
  ): Promise<boolean> {
    try {
      // Spotify allows max 100 tracks per request
      const batches: string[][] = [];
      for (let i = 0; i < trackUris.length; i += 100) {
        batches.push(trackUris.slice(i, i + 100));
      }

      for (const batch of batches) {
        await spotifyRateLimiter.execute(() =>
          retry(() =>
            this.client.post<{ snapshot_id: string }>(
              `/playlists/${playlistId}/tracks`,
              { uris: batch },
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            )
          )
        );

        // Small delay between batches
        if (batches.length > 1) {
          await this.sleep(500);
        }
      }

      return true;
    } catch (error: any) {
      console.error(
        'Spotify: Failed to add tracks to playlist:',
        error.message
      );
      return false;
    }
  }

  /**
   * Batch search and match tracks
   */
  async batchSearchAndMatch(
    queries: SpotifySearchQuery[],
    accessToken: string,
    options: SpotifyMatchingOptions = {},
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, SpotifyTrackMatch[]>> {
    const results = new Map<string, SpotifyTrackMatch[]>();

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const key = `${query.trackTitle}|${query.artistName || ''}`;

      const matches = await this.searchAndMatch(query, accessToken, options);
      results.set(key, matches);

      if (onProgress) {
        onProgress(i + 1, queries.length);
      }

      // Small delay between searches
      await this.sleep(200);
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const spotifyClient = new SpotifyClient();

// Export class for testing
export { SpotifyClient };

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
   * Calculate similarity between two strings (0-1)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    // Normalize: lowercase, keep alphanumeric + CJK + Hiragana + Katakana, strip punctuation
    const normalize = (s: string) =>
      s.toLowerCase()
        .replace(/[^\w\s\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const normalized1 = normalize(str1);
    const normalized2 = normalize(str2);

    if (normalized1 === normalized2) return 1.0;
    if (normalized1.length === 0 || normalized2.length === 0) return 0;

    // Check containment (one string contains the other)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
      const longer = normalized1.length < normalized2.length ? normalized2 : normalized1;
      return shorter.length / longer.length;
    }

    // Levenshtein distance-based similarity
    const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
    const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

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
   * Score a track match
   */
  private scoreTrackMatch(
    track: SpotifyTrack,
    query: SpotifySearchQuery
  ): { score: number; reasons: SpotifyMatchReason[] } {
    const reasons: SpotifyMatchReason[] = [];
    let totalScore = 0;

    // Title similarity (50 points max)
    const titleSimilarity = this.calculateStringSimilarity(
      track.name,
      query.trackTitle
    );
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

    // Artist similarity (30 points max)
    if (query.artistName) {
      const trackArtists = track.artists.map((a) => a.name).join(' ');
      const artistSimilarity = this.calculateStringSimilarity(
        trackArtists,
        query.artistName
      );
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

    return { score: totalScore, reasons };
  }

  /**
   * Search and match tracks with scoring
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
      market = 'JP',
    } = options;

    // Build search query
    let searchQuery = query.trackTitle;

    if (query.artistName) {
      searchQuery += ` ${query.artistName}`;
    }

    if (query.additionalKeywords && query.additionalKeywords.length > 0) {
      searchQuery += ` ${query.additionalKeywords.join(' ')}`;
    }

    // Search tracks
    const tracks = await this.searchTracks(searchQuery, accessToken, 20);

    // Score each track
    const matches: SpotifyTrackMatch[] = tracks
      .map((track) => {
        const { score, reasons } = this.scoreTrackMatch(track, query);

        // Determine confidence
        let confidence: 'high' | 'medium' | 'low';
        if (score >= 80) confidence = 'high';
        else if (score >= 60) confidence = 'medium';
        else confidence = 'low';

        return {
          track,
          score,
          reasons,
          confidence,
        };
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

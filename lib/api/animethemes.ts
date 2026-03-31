/**
 * AnimeThemes.moe API Client
 */

import axios, { AxiosInstance } from 'axios';
import { animeThemesRateLimiter } from '../utils/rate-limit';
import { retry } from '../utils/retry';
import type {
  AnimeThemesAnime,
  AnimeThemesResponse,
  AnimeThemesSearchParams,
  AnimeTheme,
  AnimeThemesVideo,
  AnimeThemesThemeWithDetails,
  AnimeThemesMatchResult,
} from '@/types/animethemes';

const ANIMETHEMES_BASE_URL =
  process.env.ANIMETHEMES_API_URL || 'https://api.animethemes.moe';

class AnimeThemesClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ANIMETHEMES_BASE_URL,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Search anime by MAL ID
   */
  async searchByMalId(malId: number): Promise<AnimeThemesAnime | null> {
    try {
      const params: AnimeThemesSearchParams = {
        'filter[has]': 'resources',
        'filter[site]': 'MyAnimeList',
        'filter[external_id]': malId,
        include:
          'animethemes.song.artists,animethemes.animethemeentries.videos,resources,images',
      };

      const result = await animeThemesRateLimiter.execute(() =>
        retry(() =>
          this.client.get<AnimeThemesResponse<'anime'>>('/anime', { params })
        )
      );

      const anime = result.data.anime;
      if (Array.isArray(anime) && anime.length > 0) {
        return anime[0];
      }

      return null;
    } catch (error: any) {
      console.error(
        `AnimeThemes: Failed to search by MAL ID ${malId}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Search anime by title and year
   */
  async searchByTitle(
    title: string,
    year?: number
  ): Promise<AnimeThemesAnime[]> {
    try {
      const params: AnimeThemesSearchParams = {
        'filter[name]': title,
        include:
          'animethemes.song.artists,animethemes.animethemeentries.videos,resources,images,synonyms',
      };

      if (year) {
        params['filter[year]'] = year;
      }

      const result = await animeThemesRateLimiter.execute(() =>
        retry(() =>
          this.client.get<AnimeThemesResponse<'anime'>>('/anime', { params })
        )
      );

      const anime = result.data.anime;
      return Array.isArray(anime) ? anime : anime ? [anime] : [];
    } catch (error: any) {
      console.error(
        `AnimeThemes: Failed to search by title "${title}":`,
        error.message
      );
      return [];
    }
  }

  /**
   * Get anime by ID
   */
  async getAnimeById(id: number): Promise<AnimeThemesAnime | null> {
    try {
      const params: AnimeThemesSearchParams = {
        include:
          'animethemes.song.artists,animethemes.animethemeentries.videos,resources,images,synonyms',
      };

      const result = await animeThemesRateLimiter.execute(() =>
        retry(() =>
          this.client.get<AnimeThemesResponse<'anime'>>(`/anime/${id}`, {
            params,
          })
        )
      );

      const anime = result.data.anime;
      return Array.isArray(anime) ? anime[0] : anime || null;
    } catch (error: any) {
      console.error(
        `AnimeThemes: Failed to get anime by ID ${id}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Get best video for a theme
   */
  getBestVideo(theme: AnimeTheme): AnimeThemesVideo | null {
    if (!theme.animethemeentries || theme.animethemeentries.length === 0) {
      return null;
    }

    // Collect all videos from all entries
    const allVideos: AnimeThemesVideo[] = [];
    for (const entry of theme.animethemeentries) {
      if (entry.videos) {
        allVideos.push(...entry.videos);
      }
    }

    if (allVideos.length === 0) {
      return null;
    }

    // Score videos based on quality preferences
    const scoredVideos = allVideos.map((video) => {
      let score = 0;

      // Prefer NC (non-credit) versions
      if (video.nc) score += 50;

      // Prefer higher resolution
      if (video.resolution >= 1080) score += 30;
      else if (video.resolution >= 720) score += 20;
      else score += 10;

      // Prefer BD source
      if (video.source === 'BD') score += 15;
      else if (video.source === 'WEB') score += 10;
      else if (video.source === 'DVD') score += 5;

      // Avoid spoilers (prefer non-spoiler)
      if (!video.tags?.includes('spoiler')) score += 5;

      return { video, score };
    });

    // Sort by score descending
    scoredVideos.sort((a, b) => b.score - a.score);

    return scoredVideos[0].video;
  }

  /**
   * Get themes with details
   */
  getThemesWithDetails(anime: AnimeThemesAnime): AnimeThemesThemeWithDetails[] {
    if (!anime.animethemes) return [];

    return anime.animethemes.map((theme) => {
      const songTitle = theme.song?.title || 'Unknown';
      const artistNames = theme.song?.artists
        ?.map((a) => a.name)
        .join(', ') || 'Unknown';
      const bestVideo = this.getBestVideo(theme);
      const episodeRange = theme.animethemeentries?.[0]?.episodes;

      // Fix: Extract sequence from slug if sequence is null
      // slug format: "OP1", "ED2", etc.
      let sequence = theme.sequence;
      if (sequence === null || sequence === undefined) {
        const match = theme.slug.match(/^(OP|ED)(\d+)$/);
        if (match) {
          sequence = parseInt(match[2], 10);
        }
      }

      return {
        ...theme,
        sequence,
        songTitle,
        artistNames,
        bestVideo: bestVideo || undefined,
        episodeRange,
      };
    });
  }

  /**
   * Filter themes by type (OP or ED)
   */
  filterThemesByType(
    themes: AnimeThemesThemeWithDetails[],
    type: 'OP' | 'ED'
  ): AnimeThemesThemeWithDetails[] {
    return themes.filter((theme) => theme.type === type);
  }

  /**
   * Calculate similarity score between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = str1.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normalized2 = str2.toLowerCase().replace(/[^\w\s]/g, '').trim();

    if (normalized1 === normalized2) return 1.0;

    // Simple word-based similarity
    const words1 = normalized1.split(/\s+/);
    const words2 = normalized2.split(/\s+/);

    const commonWords = words1.filter((word) => words2.includes(word));
    const similarity = (2 * commonWords.length) / (words1.length + words2.length);

    return similarity;
  }

  /**
   * Find best matching anime from candidates
   */
  private findBestMatch(
    candidates: AnimeThemesAnime[],
    targetTitle: string,
    targetYear?: number
  ): { anime: AnimeThemesAnime; confidence: number } | null {
    if (candidates.length === 0) return null;

    let bestMatch: AnimeThemesAnime | null = null;
    let highestScore = 0;

    for (const candidate of candidates) {
      let score = this.calculateSimilarity(candidate.name, targetTitle);

      // Bonus for matching year
      if (targetYear && candidate.year === targetYear) {
        score += 0.3;
      }

      // Check synonyms if available
      if (candidate.synonyms) {
        for (const synonym of candidate.synonyms) {
          const synonymScore = this.calculateSimilarity(synonym.text, targetTitle);
          if (synonymScore > score) {
            score = synonymScore;
          }
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = candidate;
      }
    }

    if (bestMatch && highestScore >= 0.5) {
      return { anime: bestMatch, confidence: highestScore };
    }

    return null;
  }

  /**
   * Match anime with fallback strategies
   */
  async matchAnime(
    title: string,
    titleEn?: string,
    malId?: number,
    year?: number
  ): Promise<AnimeThemesMatchResult> {
    // Strategy 1: MAL ID (most reliable)
    if (malId) {
      const anime = await this.searchByMalId(malId);
      if (anime) {
        const themes = this.getThemesWithDetails(anime);
        return {
          matched: true,
          anime,
          themes,
          matchMethod: 'mal_id',
          confidence: 1.0,
        };
      }
    }

    // Strategy 2: Title + Year
    if (year) {
      const candidates = await this.searchByTitle(title, year);
      const match = this.findBestMatch(candidates, title, year);
      if (match && match.confidence >= 0.7) {
        const themes = this.getThemesWithDetails(match.anime);
        return {
          matched: true,
          anime: match.anime,
          themes,
          matchMethod: 'title_year',
          confidence: match.confidence,
        };
      }
    }

    // Strategy 3: Title only (Japanese)
    const candidatesJp = await this.searchByTitle(title);
    const matchJp = this.findBestMatch(candidatesJp, title, year);
    if (matchJp && matchJp.confidence >= 0.7) {
      const themes = this.getThemesWithDetails(matchJp.anime);
      return {
        matched: true,
        anime: matchJp.anime,
        themes,
        matchMethod: 'title_only',
        confidence: matchJp.confidence,
      };
    }

    // Strategy 4: English title
    if (titleEn) {
      const candidatesEn = await this.searchByTitle(titleEn);
      const matchEn = this.findBestMatch(candidatesEn, titleEn, year);
      if (matchEn && matchEn.confidence >= 0.6) {
        const themes = this.getThemesWithDetails(matchEn.anime);
        return {
          matched: true,
          anime: matchEn.anime,
          themes,
          matchMethod: 'fuzzy',
          confidence: matchEn.confidence,
        };
      }
    }

    // No match found
    return {
      matched: false,
      error: 'No matching anime found in AnimeThemes.moe',
    };
  }

  /**
   * Batch match anime
   */
  async batchMatchAnime(
    requests: Array<{
      title: string;
      titleEn?: string;
      malId?: number;
      year?: number;
    }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<AnimeThemesMatchResult[]> {
    const results: AnimeThemesMatchResult[] = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const result = await this.matchAnime(
        request.title,
        request.titleEn,
        request.malId,
        request.year
      );

      results.push(result);

      if (onProgress) {
        onProgress(i + 1, requests.length);
      }

      // Small delay between requests
      await this.sleep(200);
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const animeThemesClient = new AnimeThemesClient();

// Export class for testing
export { AnimeThemesClient };

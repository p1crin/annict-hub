/**
 * Jikan API Client (MyAnimeList)
 * Used for: Image fallback and theme song parsing
 */

import axios, { AxiosInstance } from 'axios';
import { jikanRateLimiter } from '../utils/rate-limit';
import { retry } from '../utils/retry';
import type {
  JikanAnime,
  JikanAnimeThemes,
  JikanParsedTheme,
  JikanApiResponse,
} from '@/types/jikan';

const JIKAN_BASE_URL =
  process.env.JIKAN_API_URL || 'https://api.jikan.moe/v4';

class JikanClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: JIKAN_BASE_URL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Get anime by MAL ID
   */
  async getAnime(malId: number): Promise<JikanAnime | null> {
    try {
      const result = await jikanRateLimiter.execute(() =>
        retry(() => this.client.get<JikanApiResponse<JikanAnime>>(`/anime/${malId}`))
      );

      return result.data.data;
    } catch (error: any) {
      console.error(`Jikan: Failed to fetch anime ${malId}:`, error.message);
      return null;
    }
  }

  /**
   * Get anime themes (OP/ED)
   */
  async getAnimeThemes(malId: number): Promise<JikanAnimeThemes | null> {
    try {
      const result = await jikanRateLimiter.execute(() =>
        retry(() =>
          this.client.get<JikanApiResponse<JikanAnimeThemes>>(
            `/anime/${malId}/themes`
          )
        )
      );

      return result.data.data;
    } catch (error: any) {
      console.error(
        `Jikan: Failed to fetch themes for anime ${malId}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Get anime image URL
   */
  async getAnimeImage(malId: number): Promise<string | null> {
    const anime = await this.getAnime(malId);
    if (!anime) return null;

    // Prefer large image
    return (
      anime.images.jpg.large_image_url ||
      anime.images.jpg.image_url ||
      anime.images.webp.large_image_url ||
      anime.images.webp.image_url ||
      null
    );
  }

  /**
   * Extract Japanese text from parenthesized content within a string.
   * E.g., "Guren no Yumiya (紅蓮の弓矢)" -> { base: "Guren no Yumiya", japanese: "紅蓮の弓矢" }
   */
  private extractJapanese(text: string): { base: string; japanese?: string } {
    // Match text with Japanese characters (Hiragana, Katakana, CJK) in parentheses
    const jaRegex = /^(.*?)\s*\(([^)]*[\u3000-\u9FFF\uF900-\uFAFF][^)]*)\)\s*$/;
    const match = text.match(jaRegex);
    if (match) {
      return { base: match[1].trim(), japanese: match[2].trim() };
    }
    return { base: text.trim() };
  }

  /**
   * Parse theme string from Jikan
   * Example: "1: \"Gurenge\" by LiSA (eps 1-19)"
   * Example: "#2: \"Homura (炎)\" by LiSA"
   * Example: "1: \"Guren no Yumiya (紅蓮の弓矢)\" by Linked Horizon (eps 1-13)"
   */
  parseThemeString(themeString: string, type: 'OP' | 'ED'): JikanParsedTheme | null {
    try {
      // Match pattern: [#]number: "title" by artist (optional episode info)
      const regex = /#?(\d+):\s*"([^"]+)"(?:\s+by\s+([^(]+))?(?:\s+\(([^)]+)\))?/;
      const match = themeString.match(regex);

      if (!match) {
        console.warn(`Failed to parse theme string: ${themeString}`);
        return null;
      }

      const [, sequenceStr, rawTitle, rawArtist, episodes] = match;

      // Extract Japanese title from parentheses within the title
      const titleResult = this.extractJapanese(rawTitle);

      // Extract Japanese artist name from the raw string after "by"
      let artistBase = rawArtist?.trim();
      let artistJa: string | undefined;
      if (artistBase) {
        // Re-parse artist from raw string to capture Japanese in parens
        // e.g., 'Linked Horizon (きただにひろし) (eps 1-13)' or 'Linked Horizon (きただにひろし)'
        const byIndex = themeString.indexOf('" by ');
        if (byIndex !== -1) {
          const afterBy = themeString.substring(byIndex + 5);
          // Remove trailing episode info like (eps 1-13)
          const withoutEps = afterBy.replace(/\s*\(eps?\s*[\d\s,\-]+\)\s*$/i, '').trim();
          const artistResult = this.extractJapanese(withoutEps);
          artistBase = artistResult.base;
          artistJa = artistResult.japanese;
        }
      }

      return {
        sequence: parseInt(sequenceStr, 10),
        title: titleResult.base,
        titleJa: titleResult.japanese,
        artist: artistBase,
        artistJa,
        episodes: episodes?.replace(/eps?\s*/i, '').trim(),
        type,
        rawString: themeString,
      };
    } catch (error) {
      console.error(`Error parsing theme string: ${themeString}`, error);
      return null;
    }
  }

  /**
   * Get and parse all themes for an anime
   */
  async getParsedThemes(malId: number): Promise<JikanParsedTheme[]> {
    const themes = await this.getAnimeThemes(malId);
    if (!themes) return [];

    const parsedThemes: JikanParsedTheme[] = [];

    // Parse openings
    for (const opening of themes.openings) {
      const parsed = this.parseThemeString(opening, 'OP');
      if (parsed) {
        parsedThemes.push(parsed);
      }
    }

    // Parse endings
    for (const ending of themes.endings) {
      const parsed = this.parseThemeString(ending, 'ED');
      if (parsed) {
        parsedThemes.push(parsed);
      }
    }

    return parsedThemes;
  }

  /**
   * Search anime by title
   */
  async searchAnime(query: string, limit: number = 5): Promise<JikanAnime[]> {
    try {
      const result = await jikanRateLimiter.execute(() =>
        retry(() =>
          this.client.get('/anime', {
            params: {
              q: query,
              limit,
              sfw: false, // Include all content
            },
          })
        )
      );

      return result.data.data || [];
    } catch (error: any) {
      console.error(`Jikan: Failed to search anime "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Batch get anime data
   */
  async batchGetAnime(malIds: number[]): Promise<Map<number, JikanAnime>> {
    const results = new Map<number, JikanAnime>();

    // Process sequentially due to rate limits
    for (const malId of malIds) {
      const anime = await this.getAnime(malId);
      if (anime) {
        results.set(malId, anime);
      }

      // Small delay between requests to respect rate limits
      await this.sleep(350); // ~3 requests/second
    }

    return results;
  }

  /**
   * Batch get anime images
   */
  async batchGetImages(malIds: number[]): Promise<Map<number, string>> {
    const results = new Map<number, string>();

    for (const malId of malIds) {
      const imageUrl = await this.getAnimeImage(malId);
      if (imageUrl) {
        results.set(malId, imageUrl);
      }

      await this.sleep(350); // ~3 requests/second
    }

    return results;
  }

  /**
   * Batch get anime themes
   */
  async batchGetThemes(
    malIds: number[]
  ): Promise<Map<number, JikanParsedTheme[]>> {
    const results = new Map<number, JikanParsedTheme[]>();

    for (const malId of malIds) {
      const themes = await this.getParsedThemes(malId);
      if (themes.length > 0) {
        results.set(malId, themes);
      }

      await this.sleep(350); // ~3 requests/second
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const jikanClient = new JikanClient();

// Export class for testing
export { JikanClient };

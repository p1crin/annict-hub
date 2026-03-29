/**
 * Anime Matcher - Match Annict anime with AnimeThemes.moe
 */

import { animeThemesClient } from '../api/animethemes';
import type { AnnictWork } from '@/types/annict';
import type {
  AnimeThemesMatchResult,
  AnimeThemesThemeWithDetails,
} from '@/types/animethemes';

export interface AnimeMatchResult {
  annictWorkId: number;
  matched: boolean;
  animeThemesId?: number;
  themes?: AnimeThemesThemeWithDetails[];
  matchMethod?: 'mal_id' | 'title_year' | 'title_only' | 'fuzzy';
  confidence?: number;
  error?: string;
}

/**
 * Match a single anime from Annict to AnimeThemes.moe
 */
export async function matchAnime(work: AnnictWork): Promise<AnimeMatchResult> {
  try {
    const result = await animeThemesClient.matchAnime(
      work.title,
      work.titleEn || undefined,
      work.malAnimeId || undefined,
      work.seasonYear || undefined
    );

    if (result.matched && result.anime) {
      return {
        annictWorkId: work.annictId,
        matched: true,
        animeThemesId: result.anime.id,
        themes: result.themes,
        matchMethod: result.matchMethod,
        confidence: result.confidence,
      };
    }

    return {
      annictWorkId: work.annictId,
      matched: false,
      error: result.error || 'No match found',
    };
  } catch (error: any) {
    console.error(
      `Failed to match anime ${work.annictId} (${work.title}):`,
      error.message
    );
    return {
      annictWorkId: work.annictId,
      matched: false,
      error: error.message,
    };
  }
}

/**
 * Batch match multiple anime
 */
export async function batchMatchAnime(
  works: AnnictWork[],
  onProgress?: (current: number, total: number, currentAnime?: string) => void
): Promise<Map<number, AnimeMatchResult>> {
  const results = new Map<number, AnimeMatchResult>();

  for (let i = 0; i < works.length; i++) {
    const work = works[i];

    if (onProgress) {
      onProgress(i + 1, works.length, work.title);
    }

    const result = await matchAnime(work);
    results.set(work.annictId, result);

    // Small delay between requests
    await sleep(300);
  }

  return results;
}

/**
 * Filter themes by type (OP or ED)
 */
export function filterThemesByType(
  themes: AnimeThemesThemeWithDetails[],
  type: 'OP' | 'ED'
): AnimeThemesThemeWithDetails[] {
  return themes.filter((theme) => theme.type === type);
}

/**
 * Get summary statistics for batch matching
 */
export function getMatchingSummary(results: Map<number, AnimeMatchResult>) {
  let totalMatched = 0;
  let totalUnmatched = 0;
  let totalThemes = 0;
  const matchMethods: Record<string, number> = {};

  for (const result of results.values()) {
    if (result.matched) {
      totalMatched++;
      totalThemes += result.themes?.length || 0;

      if (result.matchMethod) {
        matchMethods[result.matchMethod] =
          (matchMethods[result.matchMethod] || 0) + 1;
      }
    } else {
      totalUnmatched++;
    }
  }

  return {
    total: results.size,
    matched: totalMatched,
    unmatched: totalUnmatched,
    totalThemes,
    averageThemesPerAnime: totalMatched > 0 ? totalThemes / totalMatched : 0,
    matchRate: results.size > 0 ? (totalMatched / results.size) * 100 : 0,
    matchMethods,
  };
}

/**
 * Retry failed matches
 */
export async function retryFailedMatches(
  works: AnnictWork[],
  previousResults: Map<number, AnimeMatchResult>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, AnimeMatchResult>> {
  const failedWorks = works.filter((work) => {
    const result = previousResults.get(work.annictId);
    return !result || !result.matched;
  });

  console.log(`Retrying ${failedWorks.length} failed matches...`);

  return batchMatchAnime(failedWorks, onProgress);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

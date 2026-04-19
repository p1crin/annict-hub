/**
 * Anime Matcher - Match Annict anime to Japanese theme songs via Syobocal
 */

import { syobocalClient } from '../api/syobocal';
import { syobocalToThemeDetails } from './syobocal-adapter';
import type { AnnictWork } from '@/types/annict';
import type { AnimeThemesThemeWithDetails } from '@/types/animethemes';

export interface AnimeMatchResult {
  success: boolean;
  annictWorkId: number;
  matched: boolean;
  syobocalTid?: number;
  themes?: AnimeThemesThemeWithDetails[];
  matchMethod?: 'syobocal_tid';
  error?: string;
}

/**
 * Match a single anime via Syobocal TID from Annict
 */
export async function matchAnime(work: AnnictWork): Promise<AnimeMatchResult> {
  if (!work.syobocalTid) {
    return {
      success: false,
      annictWorkId: work.annictId,
      matched: false,
      error: 'No syobocalTid on Annict work',
    };
  }

  try {
    const result = await syobocalClient.getThemes(String(work.syobocalTid));

    if (!result.success || !result.themes) {
      return {
        success: false,
        annictWorkId: work.annictId,
        matched: false,
        syobocalTid: work.syobocalTid,
        error: result.error || 'Syobocal returned no themes',
      };
    }

    const themes = syobocalToThemeDetails(work.syobocalTid, result.themes);

    if (themes.length === 0) {
      return {
        success: false,
        annictWorkId: work.annictId,
        matched: false,
        syobocalTid: work.syobocalTid,
        error: 'No OP/ED themes extracted from Syobocal',
      };
    }

    return {
      success: true,
      annictWorkId: work.annictId,
      matched: true,
      syobocalTid: work.syobocalTid,
      themes,
      matchMethod: 'syobocal_tid',
    };
  } catch (error: any) {
    console.error(
      `Failed to match anime ${work.annictId} (${work.title}):`,
      error.message
    );
    return {
      success: false,
      annictWorkId: work.annictId,
      matched: false,
      syobocalTid: work.syobocalTid,
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
  const CONCURRENCY = 5;
  let completed = 0;

  for (let i = 0; i < works.length; i += CONCURRENCY) {
    const chunk = works.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((work) => matchAnime(work))
    );
    chunkResults.forEach((result, j) => {
      results.set(chunk[j].annictId, result);
      completed++;
      if (onProgress) onProgress(completed, works.length, chunk[j].title);
    });
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


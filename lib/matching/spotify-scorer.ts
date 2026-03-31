/**
 * Spotify Track Matching and Scoring
 */

import { spotifyClient } from '../api/spotify';
import type {
  SpotifySearchQuery,
  SpotifyTrackMatch,
  SpotifyMatchingOptions,
} from '@/types/spotify';
import type { AnimeThemesThemeWithDetails } from '@/types/animethemes';

export interface ThemeSpotifyMatch {
  themeId: string;
  themeName: string;
  animeTitle: string;
  matches: SpotifyTrackMatch[];
  bestMatch?: SpotifyTrackMatch;
  status: 'matched' | 'needs_review' | 'no_match';
}

/**
 * Create search query from theme
 * Prefers Japanese titles when available for better Spotify matching
 */
export function createSearchQuery(
  theme: AnimeThemesThemeWithDetails,
  animeTitle: string
): SpotifySearchQuery {
  return {
    trackTitle: theme.songTitleJa || theme.songTitle || theme.song?.title || 'Unknown',
    artistName: theme.artistNamesJa || theme.artistNames || theme.song?.artists?.[0]?.name,
    additionalKeywords: ['anime', theme.type === 'OP' ? 'opening' : 'ending'],
  };
}

/**
 * Create romanized fallback search query
 */
function createFallbackSearchQuery(
  theme: AnimeThemesThemeWithDetails,
  animeTitle: string
): SpotifySearchQuery {
  return {
    trackTitle: theme.songTitle || theme.song?.title || 'Unknown',
    artistName: theme.artistNames || theme.song?.artists?.[0]?.name,
    additionalKeywords: ['anime', theme.type === 'OP' ? 'opening' : 'ending'],
  };
}

/**
 * Match a single theme to Spotify tracks
 */
export async function matchThemeToSpotify(
  theme: AnimeThemesThemeWithDetails,
  animeTitle: string,
  accessToken: string,
  options: SpotifyMatchingOptions = {}
): Promise<ThemeSpotifyMatch> {
  const query = createSearchQuery(theme, animeTitle);
  const searchOptions = { minScore: 50, maxResults: 5, ...options };

  let matches = await spotifyClient.searchAndMatch(
    query,
    accessToken,
    searchOptions,
  );

  // Fallback: if Japanese title was used but results are poor, retry with romanized
  const hasJapaneseTitle = theme.songTitleJa && theme.songTitleJa !== theme.songTitle;
  if (hasJapaneseTitle && (matches.length === 0 || matches[0]?.confidence !== 'high')) {
    const fallbackQuery = createFallbackSearchQuery(theme, animeTitle);
    const fallbackMatches = await spotifyClient.searchAndMatch(
      fallbackQuery,
      accessToken,
      searchOptions,
    );

    // Merge and deduplicate by track ID, keeping higher scores
    const seen = new Map<string, SpotifyTrackMatch>();
    for (const m of [...matches, ...fallbackMatches]) {
      const existing = seen.get(m.track.id);
      if (!existing || m.score > existing.score) {
        seen.set(m.track.id, m);
      }
    }
    matches = Array.from(seen.values()).sort((a, b) => b.score - a.score).slice(0, 5);
  }

  // Determine status
  let status: 'matched' | 'needs_review' | 'no_match';
  let bestMatch: SpotifyTrackMatch | undefined;

  if (matches.length === 0) {
    status = 'no_match';
  } else {
    bestMatch = matches[0];

    if (bestMatch.confidence === 'high') {
      status = 'matched';
    } else {
      status = 'needs_review';
    }
  }

  return {
    themeId: theme.id.toString(),
    themeName: query.trackTitle,
    animeTitle,
    matches,
    bestMatch,
    status,
  };
}

/**
 * Batch match themes to Spotify
 */
export async function batchMatchThemesToSpotify(
  themes: Array<{ theme: AnimeThemesThemeWithDetails; animeTitle: string }>,
  accessToken: string,
  options: SpotifyMatchingOptions = {},
  onProgress?: (current: number, total: number, currentTheme?: string) => void
): Promise<Map<string, ThemeSpotifyMatch>> {
  const results = new Map<string, ThemeSpotifyMatch>();

  for (let i = 0; i < themes.length; i++) {
    const { theme, animeTitle } = themes[i];

    if (onProgress) {
      onProgress(i + 1, themes.length, theme.songTitle);
    }

    const result = await matchThemeToSpotify(
      theme,
      animeTitle,
      accessToken,
      options
    );

    results.set(theme.id.toString(), result);

    // Small delay between searches
    await sleep(250);
  }

  return results;
}

/**
 * Get matching summary
 */
export function getMatchingSummary(results: Map<string, ThemeSpotifyMatch>) {
  let matched = 0;
  let needsReview = 0;
  let noMatch = 0;
  let totalScore = 0;
  let scoreCount = 0;

  for (const result of results.values()) {
    if (result.status === 'matched') {
      matched++;
      if (result.bestMatch) {
        totalScore += result.bestMatch.score;
        scoreCount++;
      }
    } else if (result.status === 'needs_review') {
      needsReview++;
      if (result.bestMatch) {
        totalScore += result.bestMatch.score;
        scoreCount++;
      }
    } else {
      noMatch++;
    }
  }

  return {
    total: results.size,
    matched,
    needsReview,
    noMatch,
    averageScore: scoreCount > 0 ? totalScore / scoreCount : 0,
    matchRate: results.size > 0 ? (matched / results.size) * 100 : 0,
    autoSelectableRate:
      results.size > 0 ? (matched / results.size) * 100 : 0,
  };
}

/**
 * Group matches by status
 */
export function groupMatchesByStatus(
  results: Map<string, ThemeSpotifyMatch>
) {
  const groups = {
    matched: [] as ThemeSpotifyMatch[],
    needsReview: [] as ThemeSpotifyMatch[],
    noMatch: [] as ThemeSpotifyMatch[],
  };

  for (const result of results.values()) {
    if (result.status === 'matched') {
      groups.matched.push(result);
    } else if (result.status === 'needs_review') {
      groups.needsReview.push(result);
    } else {
      groups.noMatch.push(result);
    }
  }

  return groups;
}

/**
 * Create Spotify URIs from matched themes
 */
export function createPlaylistUris(
  results: Map<string, ThemeSpotifyMatch>,
  includeNeedsReview: boolean = false
): {
  uris: string[];
  skipped: Array<{ themeId: string; themeName: string; reason: string }>;
} {
  const uris: string[] = [];
  const skipped: Array<{ themeId: string; themeName: string; reason: string }> =
    [];

  for (const result of results.values()) {
    if (result.status === 'matched' && result.bestMatch) {
      uris.push(result.bestMatch.track.uri);
    } else if (
      result.status === 'needs_review' &&
      includeNeedsReview &&
      result.bestMatch
    ) {
      uris.push(result.bestMatch.track.uri);
    } else if (result.status === 'no_match') {
      skipped.push({
        themeId: result.themeId,
        themeName: result.themeName,
        reason: 'No match found',
      });
    } else if (result.status === 'needs_review' && !includeNeedsReview) {
      skipped.push({
        themeId: result.themeId,
        themeName: result.themeName,
        reason: 'Needs manual review',
      });
    }
  }

  return { uris, skipped };
}

/**
 * Retry searches for unmatched themes with different query strategies
 */
export async function retryUnmatchedThemes(
  results: Map<string, ThemeSpotifyMatch>,
  accessToken: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ThemeSpotifyMatch>> {
  const unmatchedResults: ThemeSpotifyMatch[] = [];

  for (const result of results.values()) {
    if (result.status === 'no_match') {
      unmatchedResults.push(result);
    }
  }

  console.log(`Retrying ${unmatchedResults.length} unmatched themes...`);

  const updatedResults = new Map<string, ThemeSpotifyMatch>();

  for (let i = 0; i < unmatchedResults.length; i++) {
    const result = unmatchedResults[i];

    // Try simpler query (just title, no keywords)
    const simpleQuery: SpotifySearchQuery = {
      trackTitle: result.themeName,
    };

    const matches = await spotifyClient.searchAndMatch(
      simpleQuery,
      accessToken,
      {
        minScore: 40, // Even lower threshold
        maxResults: 5,
      }
    );

    if (matches.length > 0) {
      updatedResults.set(result.themeId, {
        ...result,
        matches,
        bestMatch: matches[0],
        status: matches[0].confidence === 'high' ? 'matched' : 'needs_review',
      });
    }

    if (onProgress) {
      onProgress(i + 1, unmatchedResults.length);
    }

    await sleep(250);
  }

  return updatedResults;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

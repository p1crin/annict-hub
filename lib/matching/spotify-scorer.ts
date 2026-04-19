/**
 * Spotify Track Matching and Scoring
 */

import { spotifyClient } from '../api/spotify';
import { splitPrimaryArtist } from '../api/syobocal';
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

export interface CreateSearchQueryContext {
  animeTitle?: string;
  year?: number;
}

/**
 * Create a Spotify search query from a theme.
 *
 * Prefers Japanese fields (Syobocal route). The full artist string is kept
 * on `artistName` for scoring, and the split-off primary artist is put on
 * `primaryArtist` for Spotify's `artist:"..."` field modifier.
 */
export function createSearchQuery(
  theme: AnimeThemesThemeWithDetails,
  context: CreateSearchQueryContext | string = {}
): SpotifySearchQuery {
  // Backwards-compat: old call sites passed animeTitle as a string.
  const ctx: CreateSearchQueryContext =
    typeof context === 'string' ? { animeTitle: context } : context;

  const artistName =
    theme.artistNamesJa || theme.artistNames || theme.song?.artists?.[0]?.name;

  const primaryArtist = artistName
    ? splitPrimaryArtist(artistName).primary
    : undefined;

  return {
    trackTitle:
      theme.songTitleJa || theme.songTitle || theme.song?.title || 'Unknown',
    artistName,
    primaryArtist,
    animeTitle: ctx.animeTitle,
    year: ctx.year,
  };
}

/**
 * Romanized fallback when a Japanese-only title produced weak results.
 * Syobocal doesn't supply romaji, so in practice this only fires when a
 * non-Syobocal source (song.title) has a separate romanized name.
 */
function createFallbackSearchQuery(
  theme: AnimeThemesThemeWithDetails,
  ctx: CreateSearchQueryContext
): SpotifySearchQuery | null {
  const romajiTitle = theme.songTitle || theme.song?.title;
  if (!romajiTitle || romajiTitle === theme.songTitleJa) return null;

  const artistName =
    theme.artistNames || theme.song?.artists?.[0]?.name || theme.artistNamesJa;
  const primaryArtist = artistName
    ? splitPrimaryArtist(artistName).primary
    : undefined;

  return {
    trackTitle: romajiTitle,
    artistName,
    primaryArtist,
    animeTitle: ctx.animeTitle,
    year: ctx.year,
  };
}

function mergeMatches(
  ...groups: SpotifyTrackMatch[][]
): SpotifyTrackMatch[] {
  const seen = new Map<string, SpotifyTrackMatch>();
  for (const group of groups) {
    for (const m of group) {
      const existing = seen.get(m.track.id);
      if (!existing || m.score > existing.score) {
        seen.set(m.track.id, m);
      }
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Match a single theme to Spotify tracks.
 *
 * Strategy (each stage runs only if the previous didn't yield `high`):
 *   1. Structured query: `track:"..." artist:"..." year:YYYY`
 *   2. Free-text query: `title primaryArtist animeTitle`
 *   3. Romanized fallback (only if theme has a distinct romaji title)
 */
export async function matchThemeToSpotify(
  theme: AnimeThemesThemeWithDetails,
  animeTitle: string,
  accessToken: string,
  options: SpotifyMatchingOptions & { year?: number } = {}
): Promise<ThemeSpotifyMatch> {
  const { year, ...matchingOptions } = options;
  const ctx: CreateSearchQueryContext = { animeTitle, year };
  const query = createSearchQuery(theme, ctx);
  const searchOptions = { minScore: 50, maxResults: 5, ...matchingOptions };

  const stage1 = await spotifyClient.searchAndMatch(
    query,
    accessToken,
    searchOptions
  );

  let matches = stage1;

  // Stage 2: free-text fallback when stage 1 didn't produce a confident hit.
  if (matches.length === 0 || matches[0]?.confidence !== 'high') {
    const stage2 = await spotifyClient.searchAndMatchFreeText(
      query,
      accessToken,
      searchOptions
    );
    matches = mergeMatches(stage1, stage2);
  }

  // Stage 3: romanized retry (rarely applicable on Syobocal route).
  if (matches.length === 0 || matches[0]?.confidence !== 'high') {
    const romajiQuery = createFallbackSearchQuery(theme, ctx);
    if (romajiQuery) {
      const stage3 = await spotifyClient.searchAndMatch(
        romajiQuery,
        accessToken,
        searchOptions
      );
      matches = mergeMatches(matches, stage3);
    }
  }

  let status: 'matched' | 'needs_review' | 'no_match';
  let bestMatch: SpotifyTrackMatch | undefined;

  if (matches.length === 0) {
    status = 'no_match';
  } else {
    bestMatch = matches[0];
    status = bestMatch.confidence === 'high' ? 'matched' : 'needs_review';
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
 * Batch match themes to Spotify. `year` on each entry is forwarded to the
 * per-theme matcher so the release-year scoring can fire.
 */
export async function batchMatchThemesToSpotify(
  themes: Array<{
    theme: AnimeThemesThemeWithDetails;
    animeTitle: string;
    year?: number;
  }>,
  accessToken: string,
  options: SpotifyMatchingOptions = {},
  onProgress?: (current: number, total: number, currentTheme?: string) => void
): Promise<Map<string, ThemeSpotifyMatch>> {
  const results = new Map<string, ThemeSpotifyMatch>();

  for (let i = 0; i < themes.length; i++) {
    const { theme, animeTitle, year } = themes[i];

    if (onProgress) {
      onProgress(i + 1, themes.length, theme.songTitleJa || theme.songTitle);
    }

    const result = await matchThemeToSpotify(theme, animeTitle, accessToken, {
      ...options,
      year,
    });

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

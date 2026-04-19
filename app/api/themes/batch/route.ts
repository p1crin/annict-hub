/**
 * Batch Theme Songs API
 * Fetches theme songs for multiple anime in batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { batchMatchAnime } from '@/lib/matching/anime-matcher';
import { supabase, getServiceRoleClient } from '@/lib/db/supabase';
import type { AnnictWork } from '@/types/annict';
import type { ThemeSongData } from '@/types/app';
import type { AnimeCacheRow, ThemeSongRow } from '@/types/supabase';

export const dynamic = 'force-dynamic';

interface BatchThemesRequest {
  anime: Array<{
    annictWorkId: number;
    title: string;
    titleEn?: string;
    malAnimeId?: number;
    syobocalTid?: number;
    seasonYear?: number;
  }>;
  forceRefresh?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: BatchThemesRequest = await request.json();
    const { anime, forceRefresh = false } = body;

    if (!anime || !Array.isArray(anime) || anime.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: anime array required' },
        { status: 400 }
      );
    }

    console.log(`Processing batch themes for ${anime.length} anime`);

    // Fetch anime from cache to get their IDs (filtered by user)
    const { data: animeCacheData }: { data: AnimeCacheRow[] | null } = await supabase
      .from('anime_cache')
      .select('*')
      .eq('annict_user_id', session.user.annictId)
      .in('annict_work_id', anime.map(a => a.annictWorkId)) as { data: AnimeCacheRow[] | null };

    const animeCacheMap = new Map(
      animeCacheData?.map(cache => [cache.annict_work_id, cache]) || []
    );

    // Convert to AnnictWork format for matching
    const works: AnnictWork[] = anime
      .filter(a => animeCacheMap.has(a.annictWorkId))
      .map((a) => {
        const cache = animeCacheMap.get(a.annictWorkId)!;
        return {
          id: cache.id,
          annictId: a.annictWorkId,
          title: a.title,
          titleEn: a.titleEn,
          malAnimeId: a.malAnimeId,
          syobocalTid: a.syobocalTid ?? cache.syobocal_tid,
          seasonYear: a.seasonYear,
        };
      });

    // Check cache first (unless force refresh)
    const cachedThemes: Record<number, ThemeSongData[]> = {};

    if (!forceRefresh) {
      for (const work of works) {
        const cache = animeCacheMap.get(work.annictId)!;
        const { data: cached } = await supabase
          .from('theme_songs')
          .select('*')
          .eq('anime_cache_id', cache.id);

        if (cached && cached.length > 0) {
          const typedCache = cached as ThemeSongRow[];
          cachedThemes[work.annictId] = typedCache.map((theme) => ({
            id: theme.id,
            annictWorkId: work.annictId,
            type: theme.type as 'OP' | 'ED',
            sequence: theme.sequence,
            title: theme.title,
            titleJa: theme.title_ja || undefined,
            artist: theme.artist || undefined,
            artistJa: theme.artist_ja || undefined,
            episodes: theme.episodes || undefined,
            videoUrl: theme.video_url || undefined,
            audioUrl: undefined,
            source: theme.source as 'animethemes' | 'jikan' | 'manual' | 'syobocal',
            confidence: undefined,
            animethemesAnimeId: undefined,
            animethemesThemeId: theme.animethemes_id || undefined,
            seasonYear: work.seasonYear,
            animeTitle: work.title,
          }));
        }
      }
    }

    // Filter out cached works
    const worksToMatch = works.filter(
      (work) => !cachedThemes[work.annictId]
    );

    console.log(
      `Using ${Object.keys(cachedThemes).length} cached, fetching ${worksToMatch.length} new`
    );

    // Match themes for non-cached works
    let matchResults: Record<number, ThemeSongData[]> = {};

    if (worksToMatch.length > 0) {
      const results = await batchMatchAnime(
        worksToMatch,
        (current, total, currentAnime) => {
          console.log(
            `Theme matching progress: ${current}/${total}${currentAnime ? ` - ${currentAnime}` : ''}`
          );
        }
      );

      // Convert match results to ThemeSongData and cache
      for (const [annictId, result] of results.entries()) {
        if (result.success && result.themes) {
          const cache = animeCacheMap.get(annictId)!;

          const work = works.find((w) => w.annictId === annictId);
          const themes: ThemeSongData[] = result.themes.map((theme) => {
            const titleJa = theme.songTitleJa;
            const titleRomaji = theme.songTitle;
            return {
              id: `${annictId}-${theme.type}${theme.sequence}`,
              annictWorkId: annictId,
              type: theme.type,
              sequence: theme.sequence,
              title: titleJa || titleRomaji || `${theme.type}${theme.sequence}`,
              titleJa,
              artist: theme.artistNamesJa || theme.artistNames,
              artistJa: theme.artistNamesJa,
              episodes: theme.episodeRange,
              videoUrl: theme.bestVideo?.link,
              audioUrl: theme.bestVideo?.audio?.link,
              source: 'syobocal' as const,
              confidence: undefined,
              animethemesAnimeId: undefined,
              animethemesThemeId: undefined,
              seasonYear: work?.seasonYear,
              animeTitle: work?.title,
            };
          });

          matchResults[annictId] = themes;

          // Cache in Supabase using service role client
          const themeRecords = themes.map((theme) => ({
            anime_cache_id: cache.id,
            type: theme.type,
            sequence: theme.sequence,
            title: theme.title,
            title_ja: theme.titleJa,
            artist: theme.artist,
            artist_ja: theme.artistJa,
            episodes: theme.episodes,
            animethemes_id: undefined,
            animethemes_slug: `${theme.type}${theme.sequence}`,
            video_url: theme.videoUrl,
            video_resolution: undefined,
            source: theme.source,
            synced_at: new Date().toISOString(),
          }));

          const serviceClient = getServiceRoleClient();
          const { error: upsertError } = await serviceClient
            .from('theme_songs')
            .upsert(themeRecords as any, { onConflict: 'anime_cache_id,type,sequence' });

          if (upsertError) {
            console.error(`Error upserting theme songs for anime ${annictId}:`, upsertError);
          }
        }
      }
    }

    // Merge cached and newly matched themes
    const allThemes = { ...cachedThemes, ...matchResults };

    // Calculate statistics
    const totalAnime = anime.length;
    const matchedAnime = Object.keys(allThemes).length;
    const totalThemes = Object.values(allThemes).reduce(
      (sum, themes) => sum + themes.length,
      0
    );

    return NextResponse.json({
      success: true,
      themes: allThemes,
      stats: {
        totalAnime,
        matchedAnime,
        unmatchedAnime: totalAnime - matchedAnime,
        totalThemes,
        cached: Object.keys(cachedThemes).length,
        fetched: Object.keys(matchResults).length,
      },
    });

  } catch (error: any) {
    console.error('Batch themes API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch themes',
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}

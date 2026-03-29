/**
 * Batch Theme Songs API
 * Fetches theme songs for multiple anime in batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { batchMatchAnime } from '@/lib/matching/anime-matcher';
import { supabase } from '@/lib/db/supabase';
import type { AnnictWork } from '@/types/annict';
import type { ThemeSongData } from '@/types/app';

export const dynamic = 'force-dynamic';

interface BatchThemesRequest {
  anime: Array<{
    annictWorkId: number;
    title: string;
    titleEn?: string;
    malAnimeId?: number;
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

    // Convert to AnnictWork format for matching
    const works: AnnictWork[] = anime.map((a) => ({
      annictId: a.annictWorkId,
      title: a.title,
      titleEn: a.titleEn,
      malAnimeId: a.malAnimeId,
      seasonYear: a.seasonYear,
    }));

    // Check cache first (unless force refresh)
    const cachedThemes: Record<number, ThemeSongData[]> = {};

    if (!forceRefresh) {
      for (const work of works) {
        const { data: cached } = await supabase
          .from('theme_songs')
          .select('*')
          .eq('annict_work_id', work.annictId);

        if (cached && cached.length > 0) {
          cachedThemes[work.annictId] = cached.map((theme) => ({
            annictWorkId: theme.annict_work_id,
            type: theme.type as 'OP' | 'ED',
            sequence: theme.sequence,
            title: theme.title,
            artist: theme.artist || undefined,
            videoUrl: theme.video_url || undefined,
            audioUrl: theme.audio_url || undefined,
            source: theme.source as 'animethemes' | 'jikan' | 'manual',
            confidence: theme.confidence as 'high' | 'medium' | 'low' | undefined,
            animethemesAnimeId: theme.animethemes_anime_id || undefined,
            animethemesThemeId: theme.animethemes_theme_id || undefined,
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
      const results = await batchMatchAnime(worksToMatch, {
        parallel: true,
        onProgress: (progress) => {
          console.log(
            `Theme matching progress: ${progress.processed}/${progress.total}`
          );
        },
      });

      // Convert match results to ThemeSongData and cache
      for (const result of results) {
        if (result.success && result.themes) {
          const themes: ThemeSongData[] = result.themes.map((theme) => ({
            annictWorkId: result.annictWorkId,
            type: theme.type,
            sequence: theme.sequence,
            title: theme.song || `${theme.type}${theme.sequence}`,
            artist: theme.artist,
            videoUrl: theme.video?.url,
            audioUrl: theme.audio?.url,
            source: theme.source || 'animethemes',
            confidence: theme.confidence,
            animethemesAnimeId: result.animethemesAnimeId,
            animethemesThemeId: theme.id,
          }));

          matchResults[result.annictWorkId] = themes;

          // Cache in Supabase
          const themeRecords = themes.map((theme) => ({
            annict_work_id: theme.annictWorkId,
            type: theme.type,
            sequence: theme.sequence,
            title: theme.title,
            artist: theme.artist,
            video_url: theme.videoUrl,
            audio_url: theme.audioUrl,
            source: theme.source,
            confidence: theme.confidence,
            animethemes_anime_id: theme.animethemesAnimeId,
            animethemes_theme_id: theme.animethemesThemeId,
          }));

          await supabase.from('theme_songs').upsert(themeRecords);
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

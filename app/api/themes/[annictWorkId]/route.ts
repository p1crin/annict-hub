/**
 * Single Anime Theme Songs API
 * Fetches theme songs for a specific anime
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { matchAnime } from '@/lib/matching/anime-matcher';
import { supabase } from '@/lib/db/supabase';
import type { ThemeSongData } from '@/types/app';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    annictWorkId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const annictWorkId = parseInt(params.annictWorkId, 10);

    if (isNaN(annictWorkId)) {
      return NextResponse.json(
        { error: 'Invalid annictWorkId' },
        { status: 400 }
      );
    }

    const forceRefresh = request.nextUrl.searchParams.get('forceRefresh') === 'true';

    console.log(`Fetching themes for anime ${annictWorkId}`);

    // Check cache first
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('theme_songs')
        .select('*')
        .eq('annict_work_id', annictWorkId);

      if (cached && cached.length > 0) {
        console.log(`Using cached themes for anime ${annictWorkId}`);

        const themes: ThemeSongData[] = cached.map((theme) => ({
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

        return NextResponse.json({
          success: true,
          themes,
          cached: true,
        });
      }
    }

    // Fetch anime info from cache
    const { data: animeCache } = await supabase
      .from('anime_cache')
      .select('*')
      .eq('annict_work_id', annictWorkId)
      .single();

    if (!animeCache) {
      return NextResponse.json(
        { error: 'Anime not found in cache. Please fetch library first.' },
        { status: 404 }
      );
    }

    // Match themes
    const work = {
      annictId: animeCache.annict_work_id,
      title: animeCache.title,
      titleEn: animeCache.title_en || undefined,
      malAnimeId: animeCache.mal_anime_id || undefined,
      seasonYear: animeCache.season_year || undefined,
    };

    const result = await matchAnime(work);

    if (!result.success || !result.themes || result.themes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No themes found',
        themes: [],
      });
    }

    // Convert to ThemeSongData
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

    return NextResponse.json({
      success: true,
      themes,
      cached: false,
    });

  } catch (error: any) {
    console.error('Single anime themes API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch themes',
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}

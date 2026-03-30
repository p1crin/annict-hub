/**
 * Single Anime Theme Songs API
 * Fetches theme songs for a specific anime
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { matchAnime } from '@/lib/matching/anime-matcher';
import { supabase } from '@/lib/db/supabase';
import type { ThemeSongData } from '@/types/app';
import type { ThemeSongRow } from '@/types/supabase';

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

    // Fetch anime info from cache first (needed for anime_cache_id)
    const { data: animeCache } = await supabase
      .from('anime_cache')
      .select('*')
      .eq('annict_work_id', annictWorkId)
      .maybeSingle();

    // Check theme cache if anime exists and not forcing refresh
    if (animeCache && !forceRefresh) {
      const { data: cached } = await supabase
        .from('theme_songs')
        .select('*')
        .eq('anime_cache_id', animeCache.id);

      if (cached && cached.length > 0) {
        const typedCache = cached as ThemeSongRow[];
        console.log(`Using cached themes for anime ${annictWorkId}`);

        const themes: ThemeSongData[] = typedCache.map((theme) => ({
          id: theme.id,
          annictWorkId: annictWorkId,
          type: theme.type,
          sequence: theme.sequence,
          title: theme.title,
          artist: theme.artist,
          episodes: theme.episodes,
          videoUrl: theme.video_url,
          audioUrl: undefined,
          source: theme.source,
          confidence: undefined,
          animethemesAnimeId: undefined,
          animethemesThemeId: theme.animethemes_id,
        }));

        return NextResponse.json({
          success: true,
          themes,
          cached: true,
        });
      }
    }

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
    const themes: ThemeSongData[] = result.themes.map((theme, index) => ({
      id: `${annictWorkId}-${theme.type}${theme.sequence}`,
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

    // Cache in Supabase using anime_cache_id
    const themeRecords = themes.map((theme) => ({
      anime_cache_id: animeCache.id,
      type: theme.type,
      sequence: theme.sequence,
      title: theme.title,
      artist: theme.artist,
      episodes: undefined,
      animethemes_id: theme.animethemesThemeId,
      animethemes_slug: `${theme.type}${theme.sequence}`,
      video_url: theme.videoUrl,
      video_resolution: undefined,
      source: theme.source,
      synced_at: new Date().toISOString(),
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

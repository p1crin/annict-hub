/**
 * Single Anime Theme Songs API
 * Fetches theme songs for a specific anime
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { matchAnime } from '@/lib/matching/anime-matcher';
import { syobocalClient } from '@/lib/api/syobocal';
import { supabase, getServiceRoleClient } from '@/lib/db/supabase';
import type { ThemeSongData } from '@/types/app';
import type { AnimeCacheRow, ThemeSongInsert, ThemeSongRow } from '@/types/supabase';
import type { AnimeThemesThemeWithDetails } from '@/types/animethemes';
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

    // Fetch anime info from cache first (needed for anime_cache_id, filtered by user)
    const { data: animeCache }: { data: AnimeCacheRow | null } = await supabase
      .from('anime_cache')
      .select('*')
      .eq('annict_user_id', session.user.annictId)
      .eq('annict_work_id', annictWorkId)
      .maybeSingle() as { data: AnimeCacheRow | null };

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
          titleJa: theme.title_ja || undefined,
          artist: theme.artist,
          artistJa: theme.artist_ja || undefined,
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
      id: animeCache.id,
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

    // Enrich with Japanese titles from Syobocal
    let syobocalThemes: { op: Array<{ title: string; artist?: string; episode?: string }>; ed: Array<{ title: string; artist?: string; episode?: string }> } = { op: [], ed: [] };

    if (animeCache.syobocal_tid) {
      console.log(`[Syobocal] Fetching themes for TID ${animeCache.syobocal_tid}`);
      const syobocalResult = await syobocalClient.getThemes(animeCache.syobocal_tid.toString());

      if (syobocalResult.success && syobocalResult.themes) {
        syobocalThemes = {
          op: syobocalResult.themes.op,
          ed: syobocalResult.themes.ed,
        };
        console.log(`[Syobocal] Found ${syobocalThemes.op.length} OP, ${syobocalThemes.ed.length} ED themes`);
      } else {
        console.log(`[Syobocal] No themes found or error: ${syobocalResult.error}`);
      }
    } else {
      console.log(`[Syobocal] No syobocal_tid available for anime ${annictWorkId}`);
    }

    // Convert to ThemeSongData
    const themes: ThemeSongData[] = result.themes.map((theme: AnimeThemesThemeWithDetails) => {
      // Match Syobocal theme by type and sequence (1-indexed)
      const syobocalThemeList = theme.type === 'OP' ? syobocalThemes.op : syobocalThemes.ed;
      const syobocalMatch = syobocalThemeList[theme.sequence - 1]; // Convert to 0-indexed

      // Use Syobocal data if available, otherwise use AnimeThemes data
      const titleJa = syobocalMatch?.title;
      const artistJa = syobocalMatch?.artist ? syobocalClient.cleanArtistName(syobocalMatch.artist) : undefined;
      const episodes = syobocalMatch?.episode;

      console.log(`[Match] ${theme.type}${theme.sequence}: AnimeThemes="${theme.songTitle}", Syobocal="${titleJa || 'N/A'}"`);

      return {
        id: `${annictWorkId}-${theme.type}${theme.sequence}`,
        annictWorkId: result.annictWorkId,
        type: theme.type,
        sequence: theme.sequence,
        title: theme.songTitle || theme.song?.title || `${theme.type}${theme.sequence}`,
        titleJa: titleJa,
        artist: theme.artistNames,
        artistJa: artistJa,
        episodes: episodes,
        videoUrl: theme.bestVideo?.link,
        audioUrl: theme.bestVideo?.audio?.link,
        source: 'animethemes' as const,
        confidence: undefined,
        animethemesAnimeId: result.animethemesAnimeId,
        animethemesThemeId: theme.id,
      };
    });

    // Cache in Supabase using anime_cache_id
    const themeRecords = themes.map((theme) => ({
      anime_cache_id: animeCache.id,
      type: theme.type,
      sequence: theme.sequence,
      title: theme.title,
      title_ja: theme.titleJa,
      artist: theme.artist,
      artist_ja: theme.artistJa,
      episodes: theme.episodes,
      animethemes_id: theme.animethemesThemeId,
      animethemes_slug: `${theme.type}${theme.sequence}`,
      video_url: theme.videoUrl,
      video_resolution: undefined,
      source: theme.source,
      synced_at: new Date().toISOString(),
    }));

    // Batch upsert theme songs using service role client
    const serviceClient = getServiceRoleClient();
    const { error: upsertError } = await serviceClient
      .from('theme_songs')
      .upsert(themeRecords as any, { onConflict: 'anime_cache_id,type,sequence' });

    if (upsertError) {
      console.error('Error upserting theme songs:', upsertError);
    } else {
      console.log(`Successfully cached ${themeRecords.length} theme songs`);
    }

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

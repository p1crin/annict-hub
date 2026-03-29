/**
 * Annict Library API
 * Fetches user's anime library with caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { annictClient } from '@/lib/api/annict';
import { jikanClient } from '@/lib/api/jikan';
import { supabase } from '@/lib/db/supabase';
import { fetchAnimeImage } from '@/lib/utils/image-fetcher';
import type { AnnictStatus } from '@/types/annict';
import type { AnimeCardData } from '@/types/app';
import type { AnimeCacheRow, AnimeCacheInsert } from '@/types/supabase';

export const dynamic = 'force-dynamic';

interface LibraryRequestQuery {
  status?: AnnictStatus;
  season?: string;
  limit?: number;
  forceRefresh?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status') as AnnictStatus | null;
    const seasonParam = searchParams.get('season');
    const limitParam = searchParams.get('limit');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // Fetch all library entries from Annict
    const states: AnnictStatus[] = statusParam ? [statusParam] : ['WATCHED'];
    const entries = await annictClient.getAllLibraryEntries(
      session.annictToken,
      states
    );

    console.log(`Total entries fetched: ${entries.length}`);

    // Process entries and build anime card data
    const animeData: AnimeCardData[] = [];

    for (const entry of entries) {
      const work = entry.work;

      // Check cache first (unless force refresh)
      let cachedAnime: AnimeCacheRow | null = null;
      if (!forceRefresh) {
        const { data } = await supabase
          .from('anime_cache')
          .select('*')
          .eq('annict_work_id', work.annictId)
          .maybeSingle();

        if (data) {
          cachedAnime = data as AnimeCacheRow;
        }
      }

      // Determine image URL
      let imageUrl = work.images?.facebookOgImageUrl || work.images?.recommendedUrl;
      let malAnimeId = cachedAnime?.mal_anime_id;

      // If no Annict image, try to fetch from Jikan
      if (!imageUrl) {
        console.log(`No Annict image for ${work.title}, fetching from Jikan...`);
        const imageResult = await fetchAnimeImage(work);

        if (imageResult.imageUrl) {
          imageUrl = imageResult.imageUrl;
        }
      }

      // Use MAL ID from work if available
      if (!malAnimeId && work.malAnimeId) {
        malAnimeId = work.malAnimeId;
      }

      // Cache anime data in Supabase
      const cacheData: AnimeCacheInsert = {
        annict_work_id: work.annictId,
        title: work.title,
        title_en: work.titleEn,
        mal_anime_id: malAnimeId,
        season_year: work.seasonYear,
        season_name: work.seasonName,
        image_url: imageUrl,
        synced_at: new Date().toISOString(),
      };
      await supabase.from('anime_cache').upsert(cacheData as any);

      // Build anime card data
      const cardData: AnimeCardData = {
        id: `${work.annictId}`,
        annictWorkId: work.annictId,
        title: work.title,
        titleEn: work.titleEn,
        imageUrl: imageUrl || '/placeholder-anime.png',
        seasonYear: work.seasonYear,
        seasonName: work.seasonName,
        status: entry.status,
        hasThemes: false, // Will be updated when themes are fetched
        themesCount: 0, // Will be updated when themes are fetched
      };

      animeData.push(cardData);
    }

    // Apply limit if specified
    const limitedData = limitParam
      ? animeData.slice(0, parseInt(limitParam, 10))
      : animeData;

    // Return response
    return NextResponse.json({
      success: true,
      data: limitedData,
      total: animeData.length,
      filtered: limitedData.length,
    });

  } catch (error: any) {
    console.error('Library API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch library',
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}

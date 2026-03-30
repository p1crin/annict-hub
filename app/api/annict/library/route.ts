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
    const afterCursor = searchParams.get('after');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const useCache = searchParams.get('cache') !== 'false'; // Default to true

    // If using cache, try to get from Supabase first (only on initial load)
    if (useCache && !forceRefresh && !afterCursor) {
      const { data: cachedAnime, error: cacheError } = await supabase
        .from('anime_cache')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(limitParam ? parseInt(limitParam, 10) : 1000);

      if (!cacheError && cachedAnime && cachedAnime.length > 0) {
        const typedCache = cachedAnime as AnimeCacheRow[];
        // Check if cache is fresh (less than 1 hour old)
        const latestSync = new Date(typedCache[0].synced_at);
        const cacheAge = Date.now() - latestSync.getTime();
        const oneHour = 60 * 60 * 1000;

        if (cacheAge < oneHour) {
          console.log(`Using cached data (${typedCache.length} items, ${Math.round(cacheAge / 1000 / 60)} minutes old)`);

          // Convert cached data to AnimeCardData
          const animeData: AnimeCardData[] = typedCache.map((anime) => ({
            id: `${anime.annict_work_id}`,
            annictWorkId: anime.annict_work_id,
            title: anime.title,
            titleEn: anime.title_en,
            imageUrl: anime.image_url || '/placeholder-anime.png',
            seasonYear: anime.season_year,
            seasonName: anime.season_name,
            status: 'WATCHED' as AnnictStatus,
            hasThemes: false,
            themesCount: 0,
          }));

          return NextResponse.json({
            success: true,
            data: animeData,
            total: animeData.length,
            filtered: animeData.length,
            cached: true,
            cacheAge: Math.round(cacheAge / 1000 / 60), // minutes
            hasMore: false,
            endCursor: null,
          });
        }
      }
    }

    // Fetch from Annict (limit to 50 for initial load)
    const states: AnnictStatus[] = statusParam ? [statusParam] : ['WATCHED'];
    const fetchLimit = limitParam ? parseInt(limitParam, 10) : 50;

    console.log(`Fetching ${fetchLimit} entries from Annict${afterCursor ? ' (page ' + afterCursor + ')' : ''}...`);

    const entries = await annictClient.getLibraryEntries(
      session.annictToken,
      {
        first: fetchLimit,
        after: afterCursor || undefined,
        states,
      }
    );

    const libraryEntries = entries.edges.map(edge => edge.node);
    console.log(`Fetched ${libraryEntries.length} entries from Annict`);

    // Process entries and build anime card data
    const animeData: AnimeCardData[] = [];

    for (const entry of libraryEntries) {
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
      let imageUrl = work.image?.internalUrl;
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
        status: entry.status.state,
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
      cached: false,
      hasMore: entries.pageInfo.hasNextPage,
      endCursor: entries.pageInfo.endCursor || null,
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

/**
 * Annict Library API
 * Fetches user's anime library with caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { annictClient } from '@/lib/api/annict';
import { jikanClient } from '@/lib/api/jikan';
import { supabase, getServiceRoleClient } from '@/lib/db/supabase';
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
    // Always get all cached data for this user (ignore limit parameter for cache)
    if (useCache && !forceRefresh && !afterCursor) {
      const { data: cachedAnime, error: cacheError } = await supabase
        .from('anime_cache')
        .select('*')
        .eq('annict_user_id', session.user.annictId)
        .order('synced_at', { ascending: false });

      if (!cacheError && cachedAnime && cachedAnime.length > 0) {
        const typedCache = cachedAnime as AnimeCacheRow[];
        // Check if cache is fresh (less than 24 hours old)
        const latestSync = new Date(typedCache[0].synced_at);
        const cacheAge = Date.now() - latestSync.getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours

        if (cacheAge < twentyFourHours) {
          console.log(`Using cached data (${typedCache.length} items, ${Math.round(cacheAge / 1000 / 60)} minutes old)`);

          // If cache count is a multiple of 50, it might be incomplete
          // Force a refresh to get all data
          if (typedCache.length > 0 && typedCache.length % 50 === 0 && !forceRefresh) {
            console.log(`⚠️  Cache has exactly ${typedCache.length} items (multiple of 50). Triggering full refresh to ensure complete data.`);
            // Don't use cache, fall through to fetch from Annict
          } else {
            // Convert cached data to AnimeCardData
            const animeData: AnimeCardData[] = typedCache.map((anime) => ({
              id: `${anime.annict_work_id}`,
              annictWorkId: anime.annict_work_id,
              title: anime.title,
              titleEn: anime.title_en,
              imageUrl: anime.image_url || '/placeholder-anime.png',
              seasonYear: anime.season_year,
              seasonName: anime.season_name,
              malAnimeId: anime.mal_anime_id,
              status: (anime.status || 'WATCHED') as AnnictStatus,
              hasThemes: false,
              themesCount: 0,
            }));

            console.log(`✅ Returning complete cached data (${animeData.length} items)`);

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
    }

    // Fetch from Annict (limit to 50 for initial load)
    // Get all statuses except NO_STATUS (user has registered some status)
    const states: AnnictStatus[] = statusParam
      ? [statusParam]
      : ['WANNA_WATCH', 'WATCHING', 'WATCHED', 'ON_HOLD', 'STOP_WATCHING'];
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
    const cacheDataBatch: AnimeCacheInsert[] = [];

    for (const entry of libraryEntries) {
      const work = entry.work;

      // Check cache first (unless force refresh) for this user
      let cachedAnime: AnimeCacheRow | null = null;
      if (!forceRefresh) {
        const { data } = await supabase
          .from('anime_cache')
          .select('*')
          .eq('annict_user_id', session.user.annictId)
          .eq('annict_work_id', work.annictId)
          .maybeSingle();

        if (data) {
          cachedAnime = data as AnimeCacheRow;
        }
      }

      // Determine image URL
      let imageUrl = work.image?.internalUrl;
      let malAnimeId = cachedAnime?.mal_anime_id;

      // If no Annict image and no cached image, try to fetch from Jikan
      if (!imageUrl && !cachedAnime?.image_url) {
        console.log(`No Annict image for ${work.title}, fetching from Jikan...`);
        const imageResult = await fetchAnimeImage(work);

        if (imageResult.imageUrl) {
          imageUrl = imageResult.imageUrl;
        }
      } else if (!imageUrl && cachedAnime?.image_url) {
        // Reuse cached image
        console.log(`Using cached image for ${work.title}`);
        imageUrl = cachedAnime.image_url;
      }

      // Use MAL ID from work if available
      if (!malAnimeId && work.malAnimeId) {
        malAnimeId = work.malAnimeId;
      }

      // Prepare cache data for batch upsert
      const cacheData: AnimeCacheInsert = {
        annict_user_id: session.user.annictId,
        annict_work_id: work.annictId,
        title: work.title,
        title_en: work.titleEn,
        mal_anime_id: malAnimeId,
        season_year: work.seasonYear,
        season_name: work.seasonName,
        image_url: imageUrl,
        status: entry.status.state,
        synced_at: new Date().toISOString(),
      };
      cacheDataBatch.push(cacheData);

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

    // Batch upsert all cache data to Supabase
    if (cacheDataBatch.length > 0) {
      console.log(`Batch upserting ${cacheDataBatch.length} anime to cache...`);
      const serviceClient = getServiceRoleClient();
      const { error: batchCacheError } = await serviceClient
        .from('anime_cache')
        .upsert(cacheDataBatch as any, { onConflict: 'annict_user_id,annict_work_id' });

      if (batchCacheError) {
        console.error('Error batch caching anime:', batchCacheError);
      } else {
        console.log(`Successfully cached ${cacheDataBatch.length} anime`);
      }
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

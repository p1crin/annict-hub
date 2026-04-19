/**
 * Annict Library API
 * Fetches user's anime library with caching and incremental sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { annictClient } from '@/lib/api/annict';
import { supabase, getServiceRoleClient } from '@/lib/db/supabase';
import { fetchAnimeImage } from '@/lib/utils/image-fetcher';
import type { AnnictLibraryEntry, AnnictStatus } from '@/types/annict';
import type { AnimeCardData } from '@/types/app';
import type { AnimeCacheRow, AnimeCacheInsert } from '@/types/supabase';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5 * 60 * 1000;       // 5 minutes
const FULL_SYNC_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheRowToCard(row: AnimeCacheRow): AnimeCardData {
  return {
    id: `${row.annict_work_id}`,
    annictWorkId: row.annict_work_id,
    title: row.title,
    titleEn: row.title_en,
    imageUrl: row.image_url || '/placeholder-anime.png',
    seasonYear: row.season_year,
    seasonName: row.season_name,
    malAnimeId: row.mal_anime_id,
    syobocalTid: row.syobocal_tid,
    status: (row.status || 'WATCHED') as AnnictStatus,
    watchersCount: row.watchers_count,
    trackingKey: row.tracking_key,
    hasThemes: false,
    themesCount: 0,
  };
}

async function buildCacheInsert(
  entry: AnnictLibraryEntry,
  annictUserId: number,
  existing: AnimeCacheRow | null,
  trackingKey?: number
): Promise<AnimeCacheInsert> {
  const work = entry.work;
  let imageUrl = work.image?.internalUrl;
  let malAnimeId = existing?.mal_anime_id ?? work.malAnimeId;

  if (!imageUrl) {
    if (existing?.image_url) {
      imageUrl = existing.image_url;
    } else {
      const result = await fetchAnimeImage(work);
      if (result.imageUrl) imageUrl = result.imageUrl;
    }
  }

  return {
    annict_user_id: annictUserId,
    annict_work_id: work.annictId,
    title: work.title,
    title_en: work.titleEn,
    mal_anime_id: malAnimeId,
    syobocal_tid: work.syobocalTid,
    season_year: work.seasonYear,
    season_name: work.seasonName,
    image_url: imageUrl,
    watchers_count: work.watchersCount,
    last_tracked_at: entry.updatedAt,
    tracking_key: trackingKey,
    status: entry.status.state,
    synced_at: new Date().toISOString(),
  };
}

async function upsertBatch(batch: AnimeCacheInsert[]) {
  if (batch.length === 0) return;
  const serviceClient = getServiceRoleClient();
  const { error } = await serviceClient
    .from('anime_cache')
    .upsert(batch as any, { onConflict: 'annict_user_id,annict_work_id' });
  if (error) console.error('Upsert error:', error);
  else console.log(`Upserted ${batch.length} entries`);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status') as AnnictStatus | null;
    const limitParam = searchParams.get('limit');
    const afterCursor = searchParams.get('after');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const useCache = searchParams.get('cache') !== 'false';

    const states: AnnictStatus[] = statusParam
      ? [statusParam]
      : ['WANNA_WATCH', 'WATCHING', 'WATCHED', 'ON_HOLD', 'STOP_WATCHING'];

    // --- Backward-compat: explicit cursor pagination (used by legacy client) ---
    if (afterCursor) {
      const fetchLimit = limitParam ? parseInt(limitParam, 10) : 50;
      const entries = await annictClient.getLibraryEntries(session.annictToken, {
        first: fetchLimit,
        after: afterCursor,
        states,
      });
      const libraryEntries = entries.edges.map((e) => e.node);
      const { data: existingRows } = await supabase
        .from('anime_cache')
        .select('*')
        .eq('annict_user_id', session.user.annictId)
        .in('annict_work_id', libraryEntries.map((e) => e.work.annictId));
      const existingMap = new Map(
        ((existingRows ?? []) as AnimeCacheRow[]).map((r) => [r.annict_work_id, r])
      );
      const batch: AnimeCacheInsert[] = [];
      for (const entry of libraryEntries) {
        batch.push(await buildCacheInsert(entry, session.user.annictId, existingMap.get(entry.work.annictId) ?? null));
      }
      await upsertBatch(batch);
      return NextResponse.json({
        success: true,
        data: batch.map((r) => cacheRowToCard(r as unknown as AnimeCacheRow)),
        total: batch.length,
        filtered: batch.length,
        cached: false,
        hasMore: entries.pageInfo.hasNextPage,
        endCursor: entries.pageInfo.endCursor || null,
      });
    }

    // --- Load full cache for this user ---
    const { data: cachedRows, error: cacheError } = await supabase
      .from('anime_cache')
      .select('*')
      .eq('annict_user_id', session.user.annictId)
      .order('synced_at', { ascending: false });

    const typedCache = (!cacheError && cachedRows) ? (cachedRows as AnimeCacheRow[]) : [];
    const cacheMap = new Map(typedCache.map((r) => [r.annict_work_id, r]));

    // --- Fresh cache: serve immediately ---
    if (useCache && !forceRefresh && typedCache.length > 0) {
      const latestSynced = new Date(typedCache[0].synced_at).getTime();
      const cacheAge = Date.now() - latestSynced;
      if (cacheAge < CACHE_TTL_MS && typedCache.length % 50 !== 0) {
        console.log(`Cache hit (${typedCache.length} items, ${Math.round(cacheAge / 1000 / 60)} min old)`);
        return NextResponse.json({
          success: true,
          data: typedCache.map(cacheRowToCard),
          total: typedCache.length,
          filtered: typedCache.length,
          cached: true,
          cacheAge: Math.round(cacheAge / 1000 / 60),
          hasMore: false,
          endCursor: null,
        });
      }
    }

    // --- Decide: full sync or incremental ---
    const oldestSynced = typedCache.length > 0
      ? Math.min(...typedCache.map((r) => new Date(r.synced_at).getTime()))
      : 0;
    const needsFullSync =
      forceRefresh ||
      typedCache.length === 0 ||
      Date.now() - oldestSynced > FULL_SYNC_AGE_MS;

    if (needsFullSync) {
      // ===== Full sync =====
      console.log(`Full sync started (reason: ${forceRefresh ? 'forceRefresh' : typedCache.length === 0 ? 'empty cache' : 'weekly'})`);
      const allEntries = await annictClient.getAllLibraryEntries(session.annictToken, states);
      console.log(`Full sync: ${allEntries.length} entries from Annict`);

      const batch: AnimeCacheInsert[] = [];
      const baseKey = Date.now();
      for (let i = 0; i < allEntries.length; i++) {
        batch.push(await buildCacheInsert(allEntries[i], session.user.annictId, cacheMap.get(allEntries[i].work.annictId) ?? null, baseKey - i));
      }
      await upsertBatch(batch);

      batch.forEach((r) => cacheMap.set(r.annict_work_id, r as unknown as AnimeCacheRow));
      const allCards = Array.from(cacheMap.values()).map(cacheRowToCard);

      return NextResponse.json({
        success: true,
        data: allCards,
        total: allCards.length,
        filtered: allCards.length,
        cached: false,
        hasMore: false,
        endCursor: null,
      });
    }

    // ===== Incremental sync =====
    // Fetch page 1 (most recently tracked 50 entries) and upsert any that are
    // new or have a status change. Weekly full sync handles deletions / older entries.
    const page = await annictClient.getLibraryEntries(session.annictToken, {
      first: 50,
      states,
    });

    // Upsert all page-1 entries to keep tracking_key up-to-date
    const batch: AnimeCacheInsert[] = [];
    const baseKey = Date.now();
    for (let i = 0; i < page.edges.length; i++) {
      const entry = page.edges[i].node;
      batch.push(await buildCacheInsert(entry, session.user.annictId, cacheMap.get(entry.work.annictId) ?? null, baseKey - i));
    }

    const changedCount = page.edges.filter((e) => {
      const cached = cacheMap.get(e.node.work.annictId);
      return !cached || cached.status !== e.node.status.state;
    }).length;
    console.log(`Incremental sync: ${page.edges.length} entries upserted (${changedCount} status changes)`);
    await upsertBatch(batch);
    batch.forEach((r) => cacheMap.set(r.annict_work_id, r as unknown as AnimeCacheRow));

    const allCards = Array.from(cacheMap.values()).map(cacheRowToCard);

    return NextResponse.json({
      success: true,
      data: allCards,
      total: allCards.length,
      filtered: allCards.length,
      cached: false,
      hasMore: false,
      endCursor: null,
    });

  } catch (error: any) {
    console.error('Library API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch library', details: error.response?.data || null },
      { status: 500 }
    );
  }
}

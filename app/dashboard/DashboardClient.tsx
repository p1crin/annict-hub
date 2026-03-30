/**
 * Dashboard Client Component
 * Client-side dashboard logic with anime library management
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimeGrid from '@/components/anime/AnimeGrid';
import AnimeFilters from '@/components/anime/AnimeFilters';
import Button from '@/components/shared/Button';
import Loading from '@/components/shared/Loading';
import type { AppSession, AnimeCardData } from '@/types/app';
import type { AnnictStatus } from '@/types/annict';

interface DashboardClientProps {
  session: AppSession;
}

export default function DashboardClient({ session }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [anime, setAnime] = useState<AnimeCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AnnictStatus | 'ALL'>('ALL');
  const [selectedSeason, setSelectedSeason] = useState<string | 'ALL'>('ALL');

  // Legacy state (not used with fetchAllAnime)
  const [hasMore, setHasMore] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const loadingMore = false; // 全件取得するため、追加読み込みはなし

  // Fetch anime library on mount
  useEffect(() => {
    fetchAllAnime();
  }, []);

  // Check for Spotify connection status
  useEffect(() => {
    const spotifyConnected = searchParams.get('spotify_connected');
    const spotifyError = searchParams.get('spotify_error');

    if (spotifyConnected === 'true') {
      // Show success message
      console.log('Spotify connected successfully!');
      // Clear URL params
      router.replace('/dashboard');
    }

    if (spotifyError) {
      console.error('Spotify connection error:', spotifyError);
      // Show error message
      // Clear URL params
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  const fetchAllAnime = async () => {
    setLoading(true);
    setIsCached(false);

    try {
      let cursor: string | null = null;
      const animeMap = new Map<number, AnimeCardData>(); // 最初から Map を使用
      let page = 1;

      // 1ページ目: キャッシュを試す
      console.log('📥 Fetching page 1 (trying cache)...');
      const firstParams = new URLSearchParams();
      firstParams.set('limit', '50');

      const firstRes = await fetch(`/api/annict/library?${firstParams}`);
      if (!firstRes.ok) {
        throw new Error(`API error: ${firstRes.status}`);
      }

      const firstData = await firstRes.json();
      const firstFetched: AnimeCardData[] = firstData.data || [];

      console.log(`Fetched ${firstFetched.length} anime (cached: ${firstData.cached}, hasMore: ${firstData.hasMore})`);

      // 重複排除しながら追加
      firstFetched.forEach((anime) => {
        animeMap.set(anime.annictWorkId, anime);
      });

      // UI更新
      setAnime(Array.from(animeMap.values()));
      setIsCached(firstData.cached || false);

      // 続きがあれば取得
      if (firstData.hasMore) {
        cursor = firstData.endCursor;
        page++;
        setIsBackgroundSyncing(true);

        while (cursor) {
          const params = new URLSearchParams();
          params.set('limit', '50');
          params.set('after', cursor);
          params.set('cache', 'false'); // 2ページ目以降はキャッシュなし

          console.log(`📥 Fetching page ${page}... cursor=${cursor}`);

          const res = await fetch(`/api/annict/library?${params}`);
          if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
          }

          const data = await res.json();
          const fetched: AnimeCardData[] = data.data || [];

          console.log(`Fetched ${fetched.length} anime (hasMore: ${data.hasMore})`);

          // 重複排除しながら追加
          fetched.forEach((anime) => {
            animeMap.set(anime.annictWorkId, anime);
          });

          // UI更新
          setAnime(Array.from(animeMap.values()));

          if (!data.hasMore) {
            console.log('✅ Finished fetching all anime');
            break;
          }

          cursor = data.endCursor;
          page++;

          // Annict rate limit対策
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      setHasMore(false);
      setEndCursor(null);
      setIsBackgroundSyncing(false);

      console.log(`🎉 Total anime: ${animeMap.size} (unique)`);
    } catch (err) {
      console.error('Error fetching anime:', err);
      alert(`エラー: ${err instanceof Error ? err.message : 'アニメライブラリの取得に失敗しました'}`);
    } finally {
      setLoading(false);
      setIsBackgroundSyncing(false);
    }
  };
  /**
   * Load more anime (not used anymore - fetchAllAnime gets all data)
   */
  const handleLoadMore = () => {
    // 全件取得するため、この関数は不要
    console.log('Load more is not needed - all anime already fetched');
  };

  /**
   * Handle anime selection toggle
   */
  const handleToggleSelect = (animeItem: AnimeCardData) => {
    setSelectedAnime((prev) =>
      prev.includes(animeItem.annictWorkId)
        ? prev.filter((id) => id !== animeItem.annictWorkId)
        : [...prev, animeItem.annictWorkId]
    );
  };

  /**
   * Handle select all
   */
  const handleSelectAll = () => {
    if (selectedAnime.length === filteredAnime.length) {
      setSelectedAnime([]);
    } else {
      setSelectedAnime(filteredAnime.map((a) => a.annictWorkId));
    }
  };

  /**
   * Navigate to playlist creation
   */
  const handleCreatePlaylist = () => {
    const selected = anime.filter((a) =>
      selectedAnime.includes(a.annictWorkId)
    );
    // Store selected anime in session storage
    sessionStorage.setItem('selectedAnime', JSON.stringify(selected));
    router.push('/playlist/create');
  };

  /**
   * Connect Spotify
   */
  const handleConnectSpotify = async () => {
    try {
      const response = await fetch('/api/spotify/auth-url');
      const data = await response.json();
      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error getting Spotify auth URL:', error);
    }
  };

  /**
   * Logout
   */
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Filter anime
  const filteredAnime = useMemo(() => {
    let filtered = anime;

    // Filter by status
    if (selectedStatus !== 'ALL') {
      filtered = filtered.filter((a) => a.status === selectedStatus);
    }

    // Filter by season
    if (selectedSeason !== 'ALL') {
      filtered = filtered.filter((a) => {
        const season = `${a.seasonYear} ${a.seasonName}`;
        return season === selectedSeason;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          (a.titleEn && a.titleEn.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [anime, selectedStatus, selectedSeason, searchQuery]);

  // Get available seasons
  const availableSeasons = useMemo(() => {
    const seasons = new Set<string>();
    anime.forEach((a) => {
      if (a.seasonYear && a.seasonName) {
        seasons.add(`${a.seasonYear} ${a.seasonName}`);
      }
    });
    return Array.from(seasons).sort().reverse();
  }, [anime]);

  if (loading) {
    const loadingMessage = isCached
      ? "アニメライブラリを読み込み中..."
      : "初回読み込み中です。データの取得に1-2分ほどかかる場合があります...";
    return <Loading message={loadingMessage} fullScreen />;
  }

  return (
    <div className="min-h-screen gradient-dreamy">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-pastel sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <h1 className="text-2xl font-bold text-gradient">🎵 AnnictHub</h1>

          {/* User info and actions */}
          <div className="flex items-center gap-4">
            {/* User name */}
            <p className="text-sm text-gray-600 hidden sm:block">
              {session.user.username}
            </p>

            {/* Spotify status */}
            {!session.spotifyToken ? (
              <Button onClick={handleConnectSpotify} variant="secondary" size="sm">
                Spotify連携
              </Button>
            ) : (
              <div className="text-xs text-gray-600 hidden sm:block">
                ✓ Spotify連携済み
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Background sync indicator */}
      {isBackgroundSyncing && (
        <div className="bg-blue-50 border-b border-blue-200 py-3">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <p className="text-sm text-blue-700">
              残りのアニメを取得中... ({anime.length}件取得済み)
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <AnimeFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          selectedSeason={selectedSeason}
          onSeasonChange={setSelectedSeason}
          availableSeasons={availableSeasons}
          totalCount={anime.length}
          filteredCount={filteredAnime.length}
        />

        {/* Selection controls */}
        {filteredAnime.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-pastel p-4"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={handleSelectAll}
                className="text-sm text-lavender hover:text-peach font-medium transition-colors"
              >
                {selectedAnime.length === filteredAnime.length
                  ? '選択を解除'
                  : 'すべて選択'}
              </button>
              <p className="text-sm text-gray-600">
                {selectedAnime.length} 件選択中
              </p>
            </div>

            <Button
              onClick={handleCreatePlaylist}
              disabled={selectedAnime.length === 0 || !session.spotifyToken}
              size="sm"
            >
              🎧 プレイリスト作成
            </Button>
          </motion.div>
        )}

        {/* Spotify connection notice */}
        {!session.spotifyToken && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-soft-yellow rounded-2xl shadow-pastel"
          >
            <p className="text-sm text-gray-700 text-center">
              プレイリストを作成するには、Spotifyアカウントを連携してください
            </p>
          </motion.div>
        )}

        {/* Anime grid */}
        <AnimeGrid
          anime={filteredAnime}
          loading={false}
          hasMore={false}
          selectedAnime={selectedAnime}
          onToggleSelect={handleToggleSelect}
        />

        {/* Load more button */}
        {hasMore && !searchQuery && selectedStatus === 'ALL' && selectedSeason === 'ALL' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex justify-center"
          >
            <Button
              onClick={handleLoadMore}
              disabled={loadingMore}
              variant="secondary"
              size="lg"
            >
              {loadingMore ? '読み込み中...' : 'もっと読み込む'}
            </Button>
          </motion.div>
        )}

        {/* Loading more indicator */}
        {loadingMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex justify-center"
          >
            <Loading message="追加のアニメを読み込み中..." />
          </motion.div>
        )}

      </main>
    </div>
  );
}

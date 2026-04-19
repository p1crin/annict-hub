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
import AnimeDetailModal from '@/components/anime/AnimeDetailModal';
import Button from '@/components/shared/Button';
import Loading from '@/components/shared/Loading';
import type { AppSession, AnimeCardData, AnimeSortField } from '@/types/app';
import type { AnnictStatus } from '@/types/annict';

interface DashboardClientProps {
  session: AppSession;
}

const SEASON_ORDER: Record<string, number> = {
  WINTER: 0,
  SPRING: 1,
  SUMMER: 2,
  AUTUMN: 3,
};

export default function DashboardClient({ session }: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [anime, setAnime] = useState<AnimeCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ fetched: 0, page: 0 });
  const [isCached, setIsCached] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AnnictStatus | 'ALL'>('ALL');
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<AnimeSortField>('default');

  // Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAnimeForDetail, setSelectedAnimeForDetail] =
    useState<AnimeCardData | null>(null);

  // Legacy state (not used with fetchAllAnime)
  const [hasMore, setHasMore] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const loadingMore = false; // 全件取得するため、追加読み込みはなし

  // Fetch anime library on mount
  useEffect(() => {
    fetchAllAnime();
  }, []);

  // Load sort preference from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem(`anime-sort-${session.user.annictId}`);
    if (saved) {
      setSortBy(saved as AnimeSortField);
    }
  }, [session.user.annictId]);

  // Save sort preference to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(`anime-sort-${session.user.annictId}`, sortBy);
  }, [sortBy, session.user.annictId]);

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
      setLoadingProgress({ fetched: animeMap.size, page: 1 });
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
          setLoadingProgress({ fetched: animeMap.size, page });

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

  /**
   * Handle anime click to open detail modal
   */
  const handleAnimeClick = (anime: AnimeCardData) => {
    setSelectedAnimeForDetail(anime);
    setShowDetailModal(true);
  };

  /**
   * Close detail modal
   */
  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedAnimeForDetail(null);
  };

  // Filter anime
  const filteredAnime = useMemo(() => {
    // Defensive check: ensure anime is an array
    if (!Array.isArray(anime)) {
      console.error('anime is not an array:', anime);
      return [];
    }

    let filtered = anime;

    // Filter by status
    if (selectedStatus !== 'ALL') {
      filtered = filtered.filter((a) => a.status === selectedStatus);
    }

    // Filter by season
    if (selectedSeasons.length > 0) {
      filtered = filtered.filter((a) => {
        const season = `${a.seasonYear} ${a.seasonName}`;
        return selectedSeasons.includes(season);
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
  }, [anime, selectedStatus, selectedSeasons, searchQuery]);

  // Get available seasons
  const availableSeasons = useMemo(() => {
    // Defensive check: ensure anime is an array
    if (!Array.isArray(anime)) {
      console.error('anime is not an array in availableSeasons:', anime);
      return [];
    }

    const seasons = new Set<string>();
    anime.forEach((a) => {
      if (a.seasonYear && a.seasonName) {
        seasons.add(`${a.seasonYear} ${a.seasonName}`);
      }
    });
    return Array.from(seasons).sort((a, b) => {
      const [ay, an] = a.split(' ');
      const [by, bn] = b.split(' ');
      const yd = Number(by) - Number(ay);
      if (yd !== 0) return yd;
      return (SEASON_ORDER[bn] ?? -1) - (SEASON_ORDER[an] ?? -1);
    });
  }, [anime]);

  // Sort filtered anime
  const sortedAnime = useMemo(() => {
    if (sortBy === 'default') return filteredAnime;

    return [...filteredAnime].sort((a, b) => {
      if (sortBy === 'watched_desc') {
        return (b.trackingKey ?? -Infinity) - (a.trackingKey ?? -Infinity);
      }
      if (sortBy === 'year_desc') {
        const yearDiff = (b.seasonYear ?? -Infinity) - (a.seasonYear ?? -Infinity);
        if (yearDiff !== 0) return yearDiff;
        return (SEASON_ORDER[b.seasonName ?? ''] ?? -1) - (SEASON_ORDER[a.seasonName ?? ''] ?? -1);
      }
      if (sortBy === 'title_asc') {
        return a.title.localeCompare(b.title, 'ja');
      }
      if (sortBy === 'popularity_desc') {
        return (b.watchersCount ?? 0) - (a.watchersCount ?? 0);
      }
      return 0;
    });
  }, [filteredAnime, sortBy]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-dreamy flex items-center justify-center z-50">
        <div className="flex flex-col items-center justify-center gap-4 w-full max-w-sm px-6">
          {/* Spinner */}
          <div className="relative w-16 h-16">
            <motion.div
              className="absolute inset-0 border-4 border-lavender-light rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{
                borderTopColor: 'var(--lavender)',
                borderRightColor: 'var(--peach)',
              }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center text-2xl"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              ✨
            </motion.div>
          </div>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gray-600 font-medium text-center"
          >
            {isCached
              ? "アニメライブラリを読み込み中..."
              : "初回読み込み中はデータの取得に数分かかる場合があります"}
          </motion.p>

          {/* Progress bar */}
          {loadingProgress.fetched > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{loadingProgress.fetched} 件取得済み</span>
                <span>ページ {loadingProgress.page}</span>
              </div>
              <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, var(--lavender), var(--peach))',
                  }}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* Floating decorations */}
          <div className="relative w-full h-8">
            <motion.div
              className="absolute left-1/4 text-xl"
              animate={{ y: [0, -10, 0], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              ♪
            </motion.div>
            <motion.div
              className="absolute right-1/4 text-xl"
              animate={{ y: [0, -10, 0], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            >
              ♪
            </motion.div>
          </div>
        </div>
      </div>
    );
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
          selectedSeasons={selectedSeasons}
          onSeasonsChange={setSelectedSeasons}
          availableSeasons={availableSeasons}
          totalCount={anime.length}
          filteredCount={filteredAnime.length}
          sortBy={sortBy}
          onSortChange={setSortBy}
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

            <div className="flex items-center gap-2">
              {/* Create playlist button */}
              <Button
                onClick={handleCreatePlaylist}
                disabled={selectedAnime.length === 0 || !session.spotifyToken}
                size="sm"
              >
                🎧 プレイリスト作成
              </Button>
            </div>
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
          anime={sortedAnime}
          loading={false}
          hasMore={false}
          selectedAnime={selectedAnime}
          onToggleSelect={handleToggleSelect}
          onAnimeClick={handleAnimeClick}
        />

        {/* Load more button */}
        {hasMore && !searchQuery && selectedStatus === 'ALL' && selectedSeasons.length === 0 && (
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

      {/* Detail Modal */}
      <AnimeDetailModal
        anime={selectedAnimeForDetail}
        isOpen={showDetailModal}
        onClose={handleCloseModal}
        selectedAnime={selectedAnime}
        onToggleSelect={handleToggleSelect}
      />
    </div>
  );
}

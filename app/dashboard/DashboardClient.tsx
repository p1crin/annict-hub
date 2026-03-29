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
  const [selectedAnime, setSelectedAnime] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AnnictStatus | 'ALL'>('ALL');
  const [selectedSeason, setSelectedSeason] = useState<string | 'ALL'>('ALL');

  // Fetch anime library on mount
  useEffect(() => {
    fetchAnimeLibrary();
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

  /**
   * Fetch anime library from API
   */
  const fetchAnimeLibrary = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/annict/library');
      if (!response.ok) {
        throw new Error('Failed to fetch library');
      }

      const data = await response.json();
      setAnime(data.data || []);
    } catch (error) {
      console.error('Error fetching library:', error);
      // Show error message
    } finally {
      setLoading(false);
    }
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
      filtered = filtered.filter((a) => a.watchedStatus === selectedStatus);
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
    return <Loading message="アニメライブラリを読み込み中..." fullScreen />;
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
              ℹ️ プレイリストを作成するには、Spotifyアカウントを連携してください
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
      </main>
    </div>
  );
}

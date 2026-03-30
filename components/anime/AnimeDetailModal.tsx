/**
 * Anime Detail Modal Component
 * Displays detailed information about an anime including theme songs
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { AnimeCardData, ThemeSongData } from '@/types/app';
import type { AnnictStatus } from '@/types/annict';

interface AnimeDetailModalProps {
  anime: AnimeCardData | null;
  isOpen: boolean;
  onClose: () => void;
  selectedAnime?: number[];
  onToggleSelect?: (anime: AnimeCardData) => void;
}

export default function AnimeDetailModal({
  anime,
  isOpen,
  onClose,
  selectedAnime = [],
  onToggleSelect,
}: AnimeDetailModalProps) {
  const [themes, setThemes] = useState<ThemeSongData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch theme songs when modal opens
  useEffect(() => {
    if (isOpen && anime) {
      fetchThemes(anime.annictWorkId);
    }
  }, [isOpen, anime]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const fetchThemes = async (annictWorkId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/themes/${annictWorkId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch themes');
      }

      const data = await response.json();
      setThemes(data.themes || []);
    } catch (err) {
      console.error('Error fetching themes:', err);
      setError('主題歌情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!anime) return null;

  const isSelected = selectedAnime.includes(anime.annictWorkId);
  const openings = themes.filter((t) => t.type === 'OP');
  const endings = themes.filter((t) => t.type === 'ED');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="relative">
              {/* Background Image */}
              <div className="relative w-full h-48 bg-gradient-to-br from-lavender-light to-peach-light">
                <Image
                  src={anime.imageUrl || '/placeholder-anime.png'}
                  alt={anime.title}
                  fill
                  className="object-cover opacity-30"
                  sizes="800px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent" />
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10"
              >
                <span className="text-xl">×</span>
              </button>

              {/* Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {anime.title}
                </h2>
                {anime.titleEn && anime.titleEn !== anime.title && (
                  <p className="text-sm text-gray-600">{anime.titleEn}</p>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {anime.seasonYear && (
                  <span className="px-3 py-1 bg-gradient-to-r from-lavender-light to-peach-light rounded-full text-sm font-medium">
                    {anime.seasonYear}
                    {anime.seasonName && ` ${getSeasonText(anime.seasonName)}`}
                  </span>
                )}
                {anime.status && anime.status !== 'NO_STATUS' && (
                  <StatusBadge status={anime.status} />
                )}
              </div>

              {/* Theme Songs */}
              <div className="space-y-6">
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lavender"></div>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-500 text-sm">{error}</p>
                  </div>
                ) : themes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">
                      主題歌情報が見つかりませんでした
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Openings */}
                    {openings.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3">
                          オープニング
                        </h3>
                        <div className="space-y-2">
                          {openings.map((theme, index) => (
                            <ThemeItem key={index} theme={theme} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Endings */}
                    {endings.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3">
                          エンディング
                        </h3>
                        <div className="space-y-2">
                          {endings.map((theme, index) => (
                            <ThemeItem key={index} theme={theme} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            {onToggleSelect && (
              <div className="border-t border-gray-200 p-4">
                <button
                  onClick={() => onToggleSelect(anime)}
                  className={`
                    w-full py-3 px-4 rounded-xl font-medium transition-colors
                    ${
                      isSelected
                        ? 'bg-gradient-to-r from-lavender to-peach text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {isSelected ? '✓ 選択中' : 'プレイリストに追加'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Theme Item Component
 */
function ThemeItem({ theme }: { theme: ThemeSongData }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Theme Type and Sequence */}
          <p className="text-xs text-gray-500 mb-1">
            {theme.type}
            {theme.sequence}
            {theme.episodes && ` (${theme.episodes})`}
          </p>

          {/* Title */}
          <p className="font-semibold text-gray-800 mb-1">{theme.title}</p>

          {/* Artist */}
          {theme.artist && (
            <p className="text-sm text-gray-600">{theme.artist}</p>
          )}

          {/* Source */}
          <p className="text-xs text-gray-400 mt-2">
            出典: {getSourceLabel(theme.source)}
          </p>
        </div>

        {/* Video Link */}
        {theme.videoUrl && (
          <a
            href={theme.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-lavender text-white rounded-lg text-xs font-medium hover:bg-peach transition-colors whitespace-nowrap"
          >
            動画を見る
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: AnnictStatus }) {
  const badges: Record<
    string,
    { label: string; className: string }
  > = {
    WATCHING: {
      label: '視聴中',
      className: 'bg-gradient-to-r from-mint to-sky-200 text-sky-800',
    },
    WATCHED: {
      label: '視聴済',
      className: 'bg-gradient-to-r from-emerald-400 to-green-500 text-white',
    },
    WANNA_WATCH: {
      label: '見たい',
      className: 'bg-gradient-to-r from-yellow-200 to-orange-200 text-gray-700',
    },
    ON_HOLD: {
      label: '中断',
      className: 'bg-amber-400 text-white',
    },
    STOP_WATCHING: {
      label: '視聴停止',
      className: 'bg-gray-500 text-white',
    },
  };

  const badge = badges[status] || {
    label: status,
    className: 'bg-gray-300 text-gray-700',
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

/**
 * Get season text
 */
function getSeasonText(season: string): string {
  const seasonMap: Record<string, string> = {
    WINTER: '冬',
    SPRING: '春',
    SUMMER: '夏',
    AUTUMN: '秋',
    FALL: '秋',
  };

  return seasonMap[season.toUpperCase()] || season;
}

/**
 * Get source label
 */
function getSourceLabel(source: string): string {
  const sourceMap: Record<string, string> = {
    animethemes: 'AnimeThemes',
    jikan: 'MyAnimeList',
    manual: '手動入力',
  };

  return sourceMap[source] || source;
}

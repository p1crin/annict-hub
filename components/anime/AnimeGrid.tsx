/**
 * Anime Grid Component
 * Displays anime cards in a responsive grid with infinite scroll
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimeCard from './AnimeCard';
import type { AnimeCardData } from '@/types/app';

interface AnimeGridProps {
  anime: AnimeCardData[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  selectedAnime?: number[];
  onToggleSelect?: (anime: AnimeCardData) => void;
  onAnimeClick?: (anime: AnimeCardData) => void;
}

export default function AnimeGrid({
  anime,
  loading = false,
  hasMore = false,
  onLoadMore,
  selectedAnime = [],
  onToggleSelect,
  onAnimeClick,
}: AnimeGridProps) {
  const observerTarget = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Infinite scroll observer
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsIntersecting(entries[0].isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Trigger load more when intersecting
  useEffect(() => {
    if (isIntersecting && hasMore && !loading && onLoadMore) {
      onLoadMore();
    }
  }, [isIntersecting, hasMore, loading, onLoadMore]);

  if (anime.length === 0 && !loading) {
    return (
      <div className="text-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-gray-500"
        >
          <div className="text-6xl mb-4">📺</div>
          <p className="text-lg font-medium">アニメが見つかりませんでした</p>
          <p className="text-sm mt-2">
            フィルターを変更するか、Annictで視聴履歴を追加してください
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      {/* Grid */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
        layout
      >
        <AnimatePresence mode="popLayout">
          {anime.map((item, index) => (
            <motion.div
              key={item.annictWorkId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <AnimeCard
                anime={item}
                selected={selectedAnime.includes(item.annictWorkId)}
                onSelect={onToggleSelect}
                onClick={onAnimeClick}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {/* Intersection observer target */}
      {hasMore && <div ref={observerTarget} className="h-20" />}

      {/* End message */}
      {!hasMore && anime.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-gray-500"
        >
          <p className="text-sm">すべてのアニメを表示しました ✨</p>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Loading Spinner Component
 */
function LoadingSpinner() {
  return (
    <div className="relative w-16 h-16">
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 border-4 border-lavender-light rounded-full"
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          borderTopColor: 'var(--lavender)',
          borderRightColor: 'var(--peach)',
        }}
      />

      {/* Inner sparkle */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-2xl"
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        ✨
      </motion.div>
    </div>
  );
}

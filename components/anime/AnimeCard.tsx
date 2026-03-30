/**
 * Anime Card Component
 * Displays anime with image, title, and metadata
 */

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import type { AnimeCardData } from '@/types/app';

interface AnimeCardProps {
  anime: AnimeCardData;
  selected?: boolean;
  onSelect?: (anime: AnimeCardData) => void;
  onClick?: (anime: AnimeCardData) => void;
}

export default function AnimeCard({
  anime,
  selected = false,
  onSelect,
  onClick,
}: AnimeCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(anime);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(anime);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.03, y: -5 }}
      transition={{ duration: 0.3 }}
      className={`
        relative bg-white rounded-2xl shadow-pastel overflow-hidden
        cursor-pointer group
        ${selected ? 'ring-2 ring-lavender ring-offset-2' : ''}
      `}
      onClick={handleClick}
    >
      {/* Checkbox for selection */}
      {onSelect && (
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={handleCheckboxChange}
            className="w-5 h-5 rounded border-2 border-white bg-white/80 checked:bg-lavender checked:border-lavender cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Image */}
      <div className="relative w-full aspect-[3/4] bg-gradient-to-br from-lavender-light to-peach-light">
        <Image
          src={anime.imageUrl || '/placeholder-anime.png'}
          alt={anime.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onError={(e) => {
            // Fallback to placeholder on error
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-anime.png';
          }}
        />

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status badge */}
        {anime.status && anime.status !== 'NO_STATUS' && (
          <div className="absolute top-3 right-3">
            <StatusBadge status={anime.status} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-800 mb-1 line-clamp-2 group-hover:text-lavender transition-colors">
          {anime.title}
        </h3>

        {/* English title */}
        {anime.titleEn && anime.titleEn !== anime.title && (
          <p className="text-xs text-gray-500 mb-2 line-clamp-1">
            {anime.titleEn}
          </p>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {anime.seasonYear && (
            <span className="px-2 py-1 bg-gradient-to-r from-lavender-light to-peach-light rounded-full">
              {anime.seasonYear}
              {anime.seasonName && ` ${getSeasonEmoji(anime.seasonName)}`}
            </span>
          )}
        </div>
      </div>

      {/* Hover effect decoration */}
      <div className="absolute -bottom-1 -right-1 text-4xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none">
        ♪
      </div>
    </motion.div>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: string }) {
  const badges: Record<string, { label: string; className: string }> = {
    WATCHING: {
      label: '視聴中',
      className: 'bg-gradient-to-r from-mint to-baby-blue text-white',
    },
    WATCHED: {
      label: '視聴済',
      className: 'bg-gradient-to-r from-lavender to-peach text-white',
    },
    WANNA_WATCH: {
      label: '見たい',
      className: 'bg-gradient-to-r from-soft-yellow to-peach-light text-gray-700',
    },
    ON_HOLD: {
      label: '中断',
      className: 'bg-gray-400 text-white',
    },
    STOP_WATCHING: {
      label: '視聴停止',
      className: 'bg-gray-600 text-white',
    },
  };

  const badge = badges[status] || {
    label: status,
    className: 'bg-gray-300 text-gray-700',
  };

  return (
    <span
      className={`
        px-2 py-1 rounded-full text-xs font-semibold
        backdrop-blur-sm shadow-md
        ${badge.className}
      `}
    >
      {badge.label}
    </span>
  );
}

/**
 * Get season emoji
 */
function getSeasonEmoji(season: string): string {
  const seasonMap: Record<string, string> = {
    WINTER: '❄️',
    SPRING: '🌸',
    SUMMER: '☀️',
    AUTUMN: '🍂',
    FALL: '🍂',
  };

  return seasonMap[season.toUpperCase()] || '';
}

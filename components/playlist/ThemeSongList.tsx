/**
 * Theme Song List Component
 * Displays theme songs with type, title, and artist
 */

'use client';

import { motion } from 'framer-motion';
import type { ThemeSongData } from '@/types/app';

interface ThemeSongListProps {
  themes: ThemeSongData[];
  animeTitle?: string;
  selectedThemes?: number[];
  onToggleSelect?: (index: number) => void;
  showVideo?: boolean;
}

export default function ThemeSongList({
  themes,
  animeTitle,
  selectedThemes = [],
  onToggleSelect,
  showVideo = false,
}: ThemeSongListProps) {
  if (themes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">🎵</div>
        <p className="text-sm">主題歌が見つかりませんでした</p>
      </div>
    );
  }

  // Group themes by type
  const openings = themes.filter((t) => t.type === 'OP');
  const endings = themes.filter((t) => t.type === 'ED');

  return (
    <div className="space-y-6">
      {animeTitle && (
        <h3 className="text-lg font-bold text-gray-800 mb-4">{animeTitle}</h3>
      )}

      {/* Openings */}
      {openings.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <span className="text-lg">▶️</span>
            オープニング ({openings.length})
          </h4>
          <div className="space-y-2">
            {openings.map((theme, index) => (
              <ThemeSongItem
                key={`${theme.annictWorkId}-${theme.type}-${theme.sequence}`}
                theme={theme}
                index={themes.indexOf(theme)}
                selected={selectedThemes.includes(themes.indexOf(theme))}
                onToggleSelect={onToggleSelect}
                showVideo={showVideo}
              />
            ))}
          </div>
        </div>
      )}

      {/* Endings */}
      {endings.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <span className="text-lg">⏹️</span>
            エンディング ({endings.length})
          </h4>
          <div className="space-y-2">
            {endings.map((theme, index) => (
              <ThemeSongItem
                key={`${theme.annictWorkId}-${theme.type}-${theme.sequence}`}
                theme={theme}
                index={themes.indexOf(theme)}
                selected={selectedThemes.includes(themes.indexOf(theme))}
                onToggleSelect={onToggleSelect}
                showVideo={showVideo}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Theme Song Item Component
 */
interface ThemeSongItemProps {
  theme: ThemeSongData;
  index: number;
  selected: boolean;
  onToggleSelect?: (index: number) => void;
  showVideo: boolean;
}

function ThemeSongItem({
  theme,
  index,
  selected,
  onToggleSelect,
  showVideo,
}: ThemeSongItemProps) {
  const handleToggle = () => {
    if (onToggleSelect) {
      onToggleSelect(index);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`
        p-4 rounded-xl bg-gradient-to-r from-lavender-light to-peach-light
        ${selected ? 'ring-2 ring-lavender ring-offset-2' : ''}
        ${onToggleSelect ? 'cursor-pointer hover:shadow-md' : ''}
        transition-all duration-300
      `}
      onClick={onToggleSelect ? handleToggle : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={handleToggle}
            className="mt-1 w-5 h-5 rounded border-2 border-gray-300 checked:bg-lavender checked:border-lavender cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type and sequence */}
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-white rounded-full text-xs font-bold text-gray-700">
              {theme.type}{theme.sequence}
            </span>
            {theme.confidence && (
              <ConfidenceBadge confidence={theme.confidence} />
            )}
          </div>

          {/* Title */}
          <p className="font-semibold text-gray-800 mb-0.5">{theme.title}</p>

          {/* Artist */}
          {theme.artist && (
            <p className="text-sm text-gray-600">by {theme.artist}</p>
          )}

          {/* Source */}
          <p className="text-xs text-gray-500 mt-1">
            出典: {getSourceLabel(theme.source)}
          </p>

          {/* Video/Audio links */}
          {showVideo && (theme.videoUrl || theme.audioUrl) && (
            <div className="flex gap-2 mt-2">
              {theme.videoUrl && (
                <a
                  href={theme.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1 bg-white rounded-full text-lavender hover:bg-lavender hover:text-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  🎥 動画
                </a>
              )}
              {theme.audioUrl && (
                <a
                  href={theme.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1 bg-white rounded-full text-peach hover:bg-peach hover:text-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  🎵 音声
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Confidence Badge Component
 */
function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const badges = {
    high: { label: '高精度', className: 'bg-mint text-gray-700' },
    medium: { label: '中精度', className: 'bg-soft-yellow text-gray-700' },
    low: { label: '低精度', className: 'bg-peach text-white' },
  };

  const badge = badges[confidence];

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

/**
 * Get source label
 */
function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    animethemes: 'AnimeThemes.moe',
    jikan: 'MyAnimeList',
    manual: '手動入力',
  };

  return labels[source] || source;
}

/**
 * Anime Filters Component
 * Search and filter controls for anime list
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}
import type { AnnictStatus } from '@/types/annict';
import type { AnimeSortField } from '@/types/app';

interface AnimeFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStatus?: AnnictStatus | 'ALL';
  onStatusChange: (status: AnnictStatus | 'ALL') => void;
  selectedSeason?: string | 'ALL';
  onSeasonChange: (season: string | 'ALL') => void;
  availableSeasons?: string[];
  totalCount?: number;
  filteredCount?: number;
  sortBy?: AnimeSortField;
  onSortChange?: (sort: AnimeSortField) => void;
}

export default function AnimeFilters({
  searchQuery,
  onSearchChange,
  selectedStatus = 'ALL',
  onStatusChange,
  selectedSeason = 'ALL',
  onSeasonChange,
  availableSeasons = [],
  totalCount = 0,
  filteredCount = 0,
  sortBy = 'default',
  onSortChange,
}: AnimeFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDesktop = useIsDesktop();
  const effectiveExpanded = isDesktop || isExpanded;

  const statuses: Array<{ value: AnnictStatus | 'ALL'; label: string; emoji: string }> = [
    { value: 'ALL', label: 'すべて', emoji: '📺' },
    { value: 'WATCHED', label: '視聴済', emoji: '✅' },
    { value: 'WATCHING', label: '視聴中', emoji: '▶️' },
    { value: 'WANNA_WATCH', label: '見たい', emoji: '⭐' },
    { value: 'ON_HOLD', label: '中断', emoji: '⏸️' },
    { value: 'STOP_WATCHING', label: '視聴停止', emoji: '⏹️' },
  ];

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-pastel p-6 mb-6">
      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="アニメを検索..."
          className="w-full px-5 py-3 pl-12 bg-gradient-to-r from-lavender-light to-peach-light rounded-2xl border-none outline-none focus:ring-2 focus:ring-lavender transition-all"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">
          🔍
        </div>
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Sort order — always visible */}
      {onSortChange && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-gray-500 shrink-0">並び順</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: 'default', label: 'デフォルト' },
                { value: 'year_desc', label: '新しい順' },
                { value: 'title_asc', label: 'タイトル順' },
                { value: 'popularity_desc', label: '人気順' },
              ] as { value: AnimeSortField; label: string }[]
            ).map((option) => (
              <button
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium
                  transition-all duration-300
                  ${
                    sortBy === option.value
                      ? 'bg-gradient-to-r from-lavender to-peach text-white shadow-md scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter toggle button (mobile) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="md:hidden w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors flex items-center justify-center gap-2"
      >
        <span>フィルター</span>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          ▼
        </motion.span>
      </button>

      {/* Filters (status + season) */}
      <motion.div
        initial={false}
        animate={{
          height: effectiveExpanded ? 'auto' : 0,
          opacity: effectiveExpanded ? 1 : 0,
        }}
        className="overflow-hidden"
      >
        <div className="pt-4 md:pt-0 space-y-4">
          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              視聴ステータス
            </label>
            <div className="flex flex-wrap gap-2">
              {statuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => onStatusChange(status.value)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium
                    transition-all duration-300
                    ${
                      selectedStatus === status.value
                        ? 'bg-gradient-to-r from-lavender to-peach text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  <span className="mr-1">{status.emoji}</span>
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Season filter */}
          {availableSeasons.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                放送シーズン
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                <button
                  onClick={() => onSeasonChange('ALL')}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium
                    transition-all duration-300
                    ${
                      selectedSeason === 'ALL'
                        ? 'bg-gradient-to-r from-lavender to-peach text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  すべて
                </button>
                {availableSeasons.map((season) => (
                  <button
                    key={season}
                    onClick={() => onSeasonChange(season)}
                    className={`
                      px-4 py-2 rounded-full text-sm font-medium
                      transition-all duration-300
                      ${
                        selectedSeason === season
                          ? 'bg-gradient-to-r from-lavender to-peach text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                  >
                    {season}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Results count */}
      {totalCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600 text-center">
          {filteredCount !== totalCount ? (
            <>
              <span className="font-bold text-lavender">{filteredCount}</span> 件 / 全{' '}
              {totalCount} 件
            </>
          ) : (
            <>
              全 <span className="font-bold text-lavender">{totalCount}</span> 件
            </>
          )}
        </div>
      )}
    </div>
  );
}

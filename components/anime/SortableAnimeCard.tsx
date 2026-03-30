/**
 * Sortable Anime Card Component
 * Wraps AnimeCard with drag-and-drop functionality
 */

'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AnimeCard from './AnimeCard';
import type { AnimeCardData } from '@/types/app';

interface SortableAnimeCardProps {
  anime: AnimeCardData;
  selected?: boolean;
  onSelect?: (anime: AnimeCardData) => void;
  onClick?: (anime: AnimeCardData) => void;
  isSortMode?: boolean;
}

export default function SortableAnimeCard({
  anime,
  selected = false,
  onSelect,
  onClick,
  isSortMode = false,
}: SortableAnimeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: anime.annictWorkId,
    disabled: !isSortMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isSortMode ? 'grab' : 'pointer',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isSortMode ? { ...attributes, ...listeners } : {})}
    >
      <AnimeCard
        anime={anime}
        selected={selected}
        onSelect={isSortMode ? undefined : onSelect}
        onClick={isSortMode ? undefined : onClick}
      />
    </div>
  );
}

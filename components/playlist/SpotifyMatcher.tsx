/**
 * Spotify Matcher Component
 * Manual track selection UI for low-confidence matches
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SpotifyMatchResult, ThemeSongData } from '@/types/app';
import type { SpotifyTrack } from '@/types/spotify';

interface SpotifyMatcherProps {
  match: SpotifyMatchResult;
  alternatives?: SpotifyTrack[];
  onSelectTrack: (track: SpotifyTrack | null) => void;
  onSkip: () => void;
}

export default function SpotifyMatcher({
  match,
  alternatives = [],
  onSelectTrack,
  onSkip,
}: SpotifyMatcherProps) {
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(
    match.spotifyTrack || null
  );

  const handleSelect = (track: SpotifyTrack) => {
    setSelectedTrack(track);
  };

  const handleConfirm = () => {
    onSelectTrack(selectedTrack);
  };

  const handleSkipClick = () => {
    onSkip();
  };

  const allTracks = [
    ...(match.spotifyTrack ? [match.spotifyTrack] : []),
    ...alternatives.filter(
      (alt) => !match.spotifyTrack || alt.id !== match.spotifyTrack.id
    ),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-3xl shadow-pastel p-6"
    >
      {/* Theme info */}
      <div className="mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-lavender to-peach flex items-center justify-center text-white font-bold text-lg">
            {match.theme.type}
            {match.theme.sequence}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800">
              {match.theme.title}
            </h3>
            {match.theme.artist && (
              <p className="text-sm text-gray-600">by {match.theme.artist}</p>
            )}
          </div>
        </div>

        {/* Match status */}
        {match.confidence && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-600">マッチ精度:</span>
            <ConfidenceBadge confidence={match.confidence} />
            {match.score !== undefined && (
              <span className="text-xs text-gray-500">
                (スコア: {match.score.toFixed(1)}%)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Track selection */}
      <div className="space-y-3 mb-6">
        <h4 className="text-sm font-semibold text-gray-700">
          Spotifyトラックを選択:
        </h4>

        {allTracks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-3xl mb-2">😔</div>
            <p className="text-sm">候補が見つかりませんでした</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allTracks.map((track) => (
              <TrackOption
                key={track.id}
                track={track}
                selected={selectedTrack?.id === track.id}
                onSelect={() => handleSelect(track)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={!selectedTrack}
          className={`
            flex-1 py-3 rounded-2xl font-semibold transition-all duration-300
            ${
              selectedTrack
                ? 'bg-gradient-to-r from-lavender to-peach text-white hover:shadow-lg hover:scale-105'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          ✓ 確定
        </button>
        <button
          onClick={handleSkipClick}
          className="px-6 py-3 rounded-2xl font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-300"
        >
          スキップ
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Track Option Component
 */
interface TrackOptionProps {
  track: SpotifyTrack;
  selected: boolean;
  onSelect: () => void;
}

function TrackOption({ track, selected, onSelect }: TrackOptionProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`
        p-4 rounded-xl cursor-pointer transition-all duration-300
        ${
          selected
            ? 'bg-gradient-to-r from-lavender-light to-peach-light ring-2 ring-lavender'
            : 'bg-gray-50 hover:bg-gray-100'
        }
      `}
    >
      <div className="flex items-center gap-4">
        {/* Radio button */}
        <div
          className={`
            w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
            ${
              selected
                ? 'border-lavender bg-lavender'
                : 'border-gray-300 bg-white'
            }
          `}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>

        {/* Album art */}
        {track.album.images[0] && (
          <img
            src={track.album.images[0].url}
            alt={track.album.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        )}

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">{track.name}</p>
          <p className="text-sm text-gray-600 truncate">
            {track.artists.map((a) => a.name).join(', ')}
          </p>
          <p className="text-xs text-gray-500 truncate">{track.album.name}</p>
        </div>

        {/* Popularity */}
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span>🔥</span>
          <span>{track.popularity}</span>
        </div>

        {/* Preview button */}
        {track.preview_url && (
          <a
            href={track.preview_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs px-3 py-1 bg-white rounded-full text-lavender hover:bg-lavender hover:text-white transition-colors"
          >
            🎵 試聴
          </a>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Confidence Badge Component
 */
function ConfidenceBadge({
  confidence,
}: {
  confidence: 'high' | 'medium' | 'low';
}) {
  const badges = {
    high: { label: '高精度', className: 'bg-mint text-gray-700' },
    medium: { label: '中精度', className: 'bg-soft-yellow text-gray-700' },
    low: { label: '低精度', className: 'bg-peach text-white' },
  };

  const badge = badges[confidence];

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

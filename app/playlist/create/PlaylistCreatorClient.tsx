/**
 * Playlist Creator Client Component
 * Multi-step playlist creation workflow
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ProgressSteps, { Step } from '@/components/playlist/ProgressSteps';
import Button from '@/components/shared/Button';
import Loading from '@/components/shared/Loading';
import type { AppSession, AnimeCardData, ThemeSongData, SpotifyMatchResult } from '@/types/app';

interface PlaylistCreatorClientProps {
  session: AppSession; // eslint-disable-line @typescript-eslint/no-unused-vars
}

type WorkflowStep = 'select' | 'fetch-themes' | 'match-spotify' | 'review' | 'create';

const steps: Step[] = [
  { id: 'select', label: '選択確認', emoji: '📺' },
  { id: 'fetch-themes', label: '主題歌取得', emoji: '🎵' },
  { id: 'match-spotify', label: 'Spotify検索', emoji: '🔍' },
  { id: 'review', label: '確認・調整', emoji: '✏️' },
  { id: 'create', label: 'プレイリスト作成', emoji: '🎧' },
];

export default function PlaylistCreatorClient({ session }: PlaylistCreatorClientProps) {
  const router = useRouter();

  // State
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('select');
  const [selectedAnime, setSelectedAnime] = useState<AnimeCardData[]>([]);
  const [themes, setThemes] = useState<ThemeSongData[]>([]);
  const [matches, setMatches] = useState<SpotifyMatchResult[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  // Load selected anime from session storage
  useEffect(() => {
    const stored = sessionStorage.getItem('selectedAnime');
    if (stored) {
      const anime = JSON.parse(stored);
      setSelectedAnime(anime);
      setPlaylistName(
        `アニメ主題歌プレイリスト ${new Date().toLocaleDateString('ja-JP')}`
      );
    } else {
      router.push('/dashboard');
    }
  }, [router]);

  /**
   * Step 1: Confirm selection -> Step 2
   */
  const handleConfirmSelection = () => {
    setCurrentStep('fetch-themes');
    fetchThemes();
  };

  /**
   * Step 2: Fetch themes
   */
  const fetchThemes = async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: selectedAnime.length, message: '主題歌を取得中...' });

    try {
      const response = await fetch('/api/themes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceRefresh: true, // Force refresh to bypass potentially corrupted cache
          anime: selectedAnime.map((a) => ({
            annictWorkId: a.annictWorkId,
            title: a.title,
            titleEn: a.titleEn,
            malAnimeId: a.malAnimeId,
            syobocalTid: a.syobocalTid,
            seasonYear: a.seasonYear,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('主題歌の取得に失敗しました');
      }

      const data = await response.json();

      // Flatten themes from all anime
      const allThemes: ThemeSongData[] = [];
      Object.values(data.themes).forEach((animeThemes: any) => {
        allThemes.push(...animeThemes);
      });

      console.log(`Found ${allThemes.length} themes from ${selectedAnime.length} anime`);
      setThemes(allThemes);
      setProgress({ current: selectedAnime.length, total: selectedAnime.length, message: `${allThemes.length}曲の主題歌を取得しました` });

      // Wait a moment before moving to next step
      await new Promise(resolve => setTimeout(resolve, 800));

      setCurrentStep('match-spotify');

      // Auto-proceed to Spotify matching
      setTimeout(() => matchSpotify(allThemes), 500);

    } catch (err: any) {
      setError(err.message || '主題歌の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 3: Match with Spotify
   */
  const matchSpotify = async (themesToMatch: ThemeSongData[]) => {
    setLoading(true);
    setError(null);

    // Start progress simulation
    const totalThemes = themesToMatch.length;
    const estimatedTimePerTheme = 300; // ms per theme (search + delay)
    const totalEstimatedTime = totalThemes * estimatedTimePerTheme;

    let progressInterval: NodeJS.Timeout;
    let currentProgress = 0;

    // Simulate progress while waiting
    progressInterval = setInterval(() => {
      currentProgress += 1;
      const estimatedCurrent = Math.min(currentProgress, totalThemes - 1);
      setProgress({
        current: estimatedCurrent,
        total: totalThemes,
        message: `Spotifyで検索中... (${estimatedCurrent}/${totalThemes})`
      });
    }, estimatedTimePerTheme);

    try {
      const response = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themes: themesToMatch }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Spotify検索に失敗しました');
      }

      const data = await response.json();

      // Convert ThemeSpotifyMatch to SpotifyMatchResult.
      // Backend re-keys `themeId` to the original ThemeSongData.id ("3820-OP1"),
      // so direct equality is the only match path — no fuzzy fallback.
      const matchesArray = Object.values(data.matches)
        .map((match: any) => {
          const theme = themesToMatch.find(t => t.id === match.themeId);
          if (!theme) {
            console.warn(`Could not find theme for match: ${match.themeId}`);
            return null;
          }
          return {
            theme,
            spotifyTrack: match.bestMatch?.track || null,
            score: match.bestMatch?.score,
            confidence: match.bestMatch?.confidence || 'low',
          } as SpotifyMatchResult;
        })
        .filter((m): m is SpotifyMatchResult => m !== null);

      console.log(`Converted ${matchesArray.length} matches`);

      // Show completion
      setProgress({
        current: totalThemes,
        total: totalThemes,
        message: `検索完了！ ${matchesArray.filter(m => m.spotifyTrack).length}/${totalThemes} 曲がマッチしました`
      });

      setMatches(matchesArray);

      // Wait a moment before showing review
      await new Promise(resolve => setTimeout(resolve, 1000));

      setCurrentStep('review');

    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || 'Spotify検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 4: Review -> Step 5
   */
  const handleProceedToCreate = () => {
    setCurrentStep('create');
  };

  /**
   * Step 5: Create playlist
   */
  const createPlaylist = async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 1, message: 'プレイリストを作成中...' });

    try {
      const response = await fetch('/api/spotify/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playlistName,
          description: playlistDescription,
          isPublic: false,
          matches,
          skipUnmatched: true,
          skipLowConfidence: false,
        }),
      });

      if (!response.ok) {
        throw new Error('プレイリストの作成に失敗しました');
      }

      const data = await response.json();

      // Success! Redirect to success page or dashboard
      sessionStorage.removeItem('selectedAnime');
      router.push(`/dashboard?playlist_created=true&playlist_url=${encodeURIComponent(data.playlist.url)}`);

    } catch (err: any) {
      setError(err.message || 'プレイリストの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Go back to dashboard
   */
  const handleCancel = () => {
    if (confirm('プレイリスト作成をキャンセルしますか？')) {
      sessionStorage.removeItem('selectedAnime');
      router.push('/dashboard');
    }
  };

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const completedSteps = steps
    .slice(0, currentStepIndex)
    .map((_, i) => i);

  return (
    <div className="min-h-screen gradient-dreamy">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-pastel sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gradient">🎧 プレイリスト作成</h1>
          <button
            onClick={handleCancel}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress steps */}
        <div className="mb-8">
          <ProgressSteps
            steps={steps}
            currentStep={currentStepIndex}
            completedSteps={completedSteps}
          />
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl"
          >
            <p className="text-red-600 text-sm text-center">{error}</p>
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="mb-6">
            <Loading message={progress.message} />
            {progress.total > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-lavender to-peach"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-xs text-gray-600 text-center mt-2">
                  {progress.current} / {progress.total}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          {currentStep === 'select' && !loading && (
            <StepSelectAnime
              anime={selectedAnime}
              onConfirm={handleConfirmSelection}
              onCancel={handleCancel}
            />
          )}

          {currentStep === 'fetch-themes' && !loading && (
            <StepFetchingThemes themes={themes} />
          )}

          {currentStep === 'match-spotify' && !loading && (
            <StepMatchingSpotify matches={matches} />
          )}

          {currentStep === 'review' && !loading && (
            <StepReview
              matches={matches}
              onProceed={handleProceedToCreate}
              onBack={() => setCurrentStep('select')}
            />
          )}

          {currentStep === 'create' && !loading && (
            <StepCreatePlaylist
              playlistName={playlistName}
              onNameChange={setPlaylistName}
              playlistDescription={playlistDescription}
              onDescriptionChange={setPlaylistDescription}
              trackCount={matches.filter((m) => m.spotifyTrack).length}
              onCreate={createPlaylist}
              onBack={() => setCurrentStep('review')}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/**
 * Step 1: Select Anime
 */
function StepSelectAnime({
  anime,
  onConfirm,
  onCancel,
}: {
  anime: AnimeCardData[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-3xl shadow-pastel p-6"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        選択したアニメ ({anime.length}件)
      </h2>

      <div className="max-h-96 overflow-y-auto mb-6">
        <div className="space-y-2">
          {anime.map((item) => (
            <div
              key={item.annictWorkId}
              className="p-3 bg-gradient-to-r from-lavender-light to-peach-light rounded-xl"
            >
              <p className="font-semibold text-gray-800">{item.title}</p>
              {item.titleEn && item.titleEn !== item.title && (
                <p className="text-xs text-gray-600">{item.titleEn}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onConfirm} fullWidth>
          主題歌を取得
        </Button>
        <Button onClick={onCancel} variant="ghost" fullWidth>
          キャンセル
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * Step 2: Fetching Themes (display after fetch)
 */
function StepFetchingThemes({ themes }: { themes: ThemeSongData[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-3xl shadow-pastel p-6"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        主題歌取得完了 ({themes.length}曲)
      </h2>
      <p className="text-gray-600 text-center">Spotifyで検索中...</p>
    </motion.div>
  );
}

/**
 * Step 3: Matching Spotify (display after match)
 */
function StepMatchingSpotify({ matches }: { matches: SpotifyMatchResult[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-3xl shadow-pastel p-6"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Spotify検索完了 ({matches.length}曲)
      </h2>
      <p className="text-gray-600 text-center">結果を確認しています...</p>
    </motion.div>
  );
}

/**
 * Step 4: Review
 */
function StepReview({
  matches,
  onProceed,
  onBack,
}: {
  matches: SpotifyMatchResult[];
  onProceed: () => void;
  onBack: () => void;
}) {
  const matchedCount = matches.filter((m) => m.spotifyTrack).length;
  const highConfidence = matches.filter((m) => m.confidence === 'high').length;
  const mediumConfidence = matches.filter((m) => m.confidence === 'medium').length;
  const lowConfidence = matches.filter((m) => m.confidence === 'low').length;
  const unmatchedCount = matches.filter((m) => !m.spotifyTrack).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Stats */}
      <div className="bg-white rounded-3xl shadow-pastel p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">マッチング結果</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-r from-lavender-light to-peach-light rounded-xl">
            <p className="text-2xl font-bold text-gray-800">{matchedCount}</p>
            <p className="text-xs text-gray-600">マッチ成功</p>
          </div>
          <div className="text-center p-4 bg-mint rounded-xl">
            <p className="text-2xl font-bold text-gray-800">{highConfidence}</p>
            <p className="text-xs text-gray-600">高精度</p>
          </div>
          <div className="text-center p-4 bg-soft-yellow rounded-xl">
            <p className="text-2xl font-bold text-gray-800">{mediumConfidence}</p>
            <p className="text-xs text-gray-600">中精度</p>
          </div>
          <div className="text-center p-4 bg-peach-light rounded-xl">
            <p className="text-2xl font-bold text-gray-800">{lowConfidence}</p>
            <p className="text-xs text-gray-600">低精度</p>
          </div>
        </div>
      </div>

      {/* Matched tracks list */}
      {matchedCount > 0 && (
        <div className="bg-white rounded-3xl shadow-pastel p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">マッチした楽曲</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {matches.filter(m => m.spotifyTrack).map((match, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-lavender-light to-peach-light rounded-xl"
              >
                {/* Album cover */}
                {match.spotifyTrack?.album.images?.[0] && (
                  <img
                    src={match.spotifyTrack.album.images[0].url}
                    alt={match.spotifyTrack.album.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">
                    {match.theme.title}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    → {match.spotifyTrack?.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {match.spotifyTrack?.artists.map(a => a.name).join(', ')}
                  </p>
                </div>

                {/* Confidence badge */}
                <div className={`
                  px-2 py-1 rounded-full text-xs font-semibold
                  ${match.confidence === 'high' ? 'bg-mint text-white' : ''}
                  ${match.confidence === 'medium' ? 'bg-soft-yellow text-gray-700' : ''}
                  ${match.confidence === 'low' ? 'bg-peach-light text-gray-700' : ''}
                `}>
                  {match.confidence === 'high' ? '高' : match.confidence === 'medium' ? '中' : '低'}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Unmatched tracks */}
      {unmatchedCount > 0 && (
        <div className="bg-white rounded-3xl shadow-pastel p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            マッチしなかった楽曲 ({unmatchedCount}件)
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {matches.filter(m => !m.spotifyTrack).map((match, index) => (
              <div
                key={index}
                className="p-3 bg-gray-100 rounded-xl"
              >
                <p className="font-semibold text-gray-700 text-sm">
                  {match.theme.title}
                </p>
                <p className="text-xs text-gray-500">
                  {match.theme.artist || 'アーティスト不明'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-3xl shadow-pastel p-6">
        <div className="flex gap-3">
          <Button onClick={onProceed} disabled={matchedCount === 0} fullWidth>
            プレイリストを作成 ({matchedCount}曲)
          </Button>
          <Button onClick={onBack} variant="ghost" fullWidth>
            戻る
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Step 5: Create Playlist
 */
function StepCreatePlaylist({
  playlistName,
  onNameChange,
  playlistDescription,
  onDescriptionChange,
  trackCount,
  onCreate,
  onBack,
}: {
  playlistName: string;
  onNameChange: (name: string) => void;
  playlistDescription: string;
  onDescriptionChange: (desc: string) => void;
  trackCount: number;
  onCreate: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-3xl shadow-pastel p-6"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        プレイリスト情報を入力
      </h2>

      <div className="space-y-4 mb-6">
        {/* Playlist name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            プレイリスト名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={playlistName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="例: 2024年冬アニメOP&ED"
            className="w-full px-4 py-3 bg-gradient-to-r from-lavender-light to-peach-light rounded-2xl border-none outline-none focus:ring-2 focus:ring-lavender"
          />
        </div>

        {/* Playlist description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            説明 (任意)
          </label>
          <textarea
            value={playlistDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="このプレイリストの説明..."
            rows={3}
            className="w-full px-4 py-3 bg-gradient-to-r from-lavender-light to-peach-light rounded-2xl border-none outline-none focus:ring-2 focus:ring-lavender resize-none"
          />
        </div>

        {/* Track count */}
        <div className="p-4 bg-gradient-to-r from-mint to-baby-blue rounded-2xl text-center">
          <p className="text-gray-700">
            <span className="text-2xl font-bold text-white">{trackCount}</span> 曲を追加
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onCreate} disabled={!playlistName} fullWidth>
          作成
        </Button>
        <Button onClick={onBack} variant="ghost" fullWidth>
          戻る
        </Button>
      </div>
    </motion.div>
  );
}

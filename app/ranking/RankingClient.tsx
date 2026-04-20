'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, Reorder, useDragControls } from 'framer-motion';
import type { AppSession, AnimeCardData } from '@/types/app';

interface RankingClientProps {
  session: AppSession;
}

type Step = 'select' | 'rank';

const SEASON_ORDER: Record<string, number> = {
  WINTER: 0,
  SPRING: 1,
  SUMMER: 2,
  AUTUMN: 3,
};

const SEASON_LABEL: Record<string, string> = {
  WINTER: '冬',
  SPRING: '春',
  SUMMER: '夏',
  AUTUMN: '秋',
};

function formatSeasonLabel(season: string): string {
  const [year, name] = season.split(' ');
  return `${year}年${SEASON_LABEL[name] ?? name}`;
}

function buildTweetText(top5: AnimeCardData[], selectedSeasons: string[]): string {
  const seasonLabel =
    selectedSeasons.length === 0
      ? '全期間'
      : [...selectedSeasons]
          .sort((a, b) => {
            const [ay, an] = a.split(' ');
            const [by, bn] = b.split(' ');
            const yd = Number(ay) - Number(by);
            if (yd !== 0) return yd;
            return (SEASON_ORDER[an] ?? 0) - (SEASON_ORDER[bn] ?? 0);
          })
          .map(formatSeasonLabel)
          .join(', ');

  const header = `${seasonLabel} 視聴アニメ TOP5\n\n`;
  const footer = '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const urlPart = appUrl ? `\n${appUrl}` : '';

  const maxTitleLen = Math.floor((280 - header.length - footer.length - urlPart.length - 15) / 5);

  const lines = top5.map((a, i) => {
    const title = a.title.length > maxTitleLen ? a.title.slice(0, maxTitleLen - 1) + '…' : a.title;
    return `${i + 1}. ${title}`;
  });

  return header + lines.join('\n') + footer + urlPart;
}

interface RankItemProps {
  anime: AnimeCardData;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function RankItem({ anime, index, total, onMoveUp, onMoveDown }: RankItemProps) {
  const controls = useDragControls();
  const isTop5 = index < 5;

  return (
    <Reorder.Item
      value={anime}
      dragListener={false}
      dragControls={controls}
      className={`flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm select-none ${
        isTop5 ? '' : 'opacity-40'
      }`}
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 10 }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={(e) => controls.start(e)}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none px-1 shrink-0"
        aria-label="ドラッグして並び替え"
      >
        <svg width="16" height="20" viewBox="0 0 16 20" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="10" r="1.5" /><circle cx="11" cy="10" r="1.5" />
          <circle cx="5" cy="16" r="1.5" /><circle cx="11" cy="16" r="1.5" />
        </svg>
      </div>

      {/* Rank badge */}
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          isTop5
            ? 'bg-gradient-to-br from-lavender to-peach text-white'
            : 'bg-gray-100 text-gray-400'
        }`}
      >
        {index + 1}
      </span>

      {/* Thumbnail */}
      <div className="w-10 h-14 relative rounded-lg overflow-hidden shrink-0 bg-gray-100">
        <Image
          src={anime.imageUrl || '/placeholder-anime.png'}
          alt={anime.title}
          fill
          className="object-cover"
          sizes="40px"
        />
      </div>

      {/* Title */}
      <p className="flex-1 text-sm font-medium text-gray-800 line-clamp-2">{anime.title}</p>

      {/* Fallback arrow buttons */}
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs flex items-center justify-center transition-colors"
          aria-label="上に移動"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs flex items-center justify-center transition-colors"
          aria-label="下に移動"
        >
          ▼
        </button>
      </div>
    </Reorder.Item>
  );
}

export default function RankingClient(_: RankingClientProps) {
  const [step, setStep] = useState<Step>('select');
  const [allAnime, setAllAnime] = useState<AnimeCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ranked, setRanked] = useState<AnimeCardData[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/annict/library');
        const data = await res.json();
        const watched = (data.data as AnimeCardData[]).filter((a) => a.status === 'WATCHED');
        setAllAnime(watched);
      } catch (e) {
        console.error('Failed to fetch library', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const availableSeasons = useMemo(() => {
    const seasons = new Set<string>();
    allAnime.forEach((a) => {
      if (a.seasonYear && a.seasonName) seasons.add(`${a.seasonYear} ${a.seasonName}`);
    });
    return Array.from(seasons).sort((a, b) => {
      const [ay, an] = a.split(' ');
      const [by, bn] = b.split(' ');
      const yd = Number(by) - Number(ay);
      if (yd !== 0) return yd;
      return (SEASON_ORDER[bn] ?? -1) - (SEASON_ORDER[an] ?? -1);
    });
  }, [allAnime]);

  const filteredAnime = useMemo(() => {
    if (selectedSeasons.length === 0) return allAnime;
    return allAnime.filter((a) => selectedSeasons.includes(`${a.seasonYear} ${a.seasonName}`));
  }, [allAnime, selectedSeasons]);

  const selectedCount = selectedIds.size;

  function toggleSeason(season: string) {
    setSelectedSeasons((prev) =>
      prev.includes(season) ? prev.filter((s) => s !== season) : [...prev, season]
    );
  }

  function toggleAnime(anime: AnimeCardData) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(anime.id)) {
        next.delete(anime.id);
      } else {
        next.add(anime.id);
      }
      return next;
    });
  }

  function goToRank() {
    const selected = filteredAnime.filter((a) => selectedIds.has(a.id));
    setRanked(selected);
    setStep('rank');
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setRanked((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setRanked((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function handleTweet() {
    const text = buildTweetText(ranked.slice(0, 5), selectedSeasons);
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  return (
    <div className="min-h-screen gradient-dreamy">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-pastel sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 transition-colors">
            ← ダッシュボード
          </Link>
          <h1 className="text-xl font-bold text-gradient">🏆 ランキング作成</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lavender" />
          </div>
        ) : step === 'select' ? (
          <>
            {/* Season filter */}
            {availableSeasons.length > 0 && (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-pastel p-6 mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">放送シーズンで絞り込み</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedSeasons([])}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      selectedSeasons.length === 0
                        ? 'bg-gradient-to-r from-lavender to-peach text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    すべて
                  </button>
                  {availableSeasons.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSeason(s)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        selectedSeasons.includes(s)
                          ? 'bg-gradient-to-r from-lavender to-peach text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {formatSeasonLabel(s)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Anime grid */}
            {filteredAnime.length === 0 ? (
              <p className="text-center text-gray-500 py-16">
                該当するアニメがありません
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {filteredAnime.map((anime) => {
                  const selected = selectedIds.has(anime.id);
                  return (
                    <motion.div
                      key={anime.id}
                      whileHover={{ scale: 1.04 }}
                      onClick={() => toggleAnime(anime)}
                      className={`relative cursor-pointer rounded-xl overflow-hidden shadow-sm transition-all ${
                        selected ? 'ring-2 ring-lavender ring-offset-2' : ''
                      }`}
                    >
                      <div className="aspect-[2/3] relative bg-gray-100">
                        <Image
                          src={anime.imageUrl || '/placeholder-anime.png'}
                          alt={anime.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 17vw"
                        />
                        {selected && (
                          <div className="absolute inset-0 bg-lavender/30 flex items-center justify-center">
                            <span className="text-white text-2xl font-bold drop-shadow">✓</span>
                          </div>
                        )}
                      </div>
                      <div className="p-1.5 bg-white">
                        <p className="text-[10px] leading-tight text-gray-700 line-clamp-2">
                          {anime.title}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Step 2: rank */
          <div className="max-w-xl mx-auto">
            <p className="text-sm text-gray-500 mb-4 text-center">
              ☰ をドラッグして順番を入れ替えてください。上位5件がTOP5になります。
            </p>
            <Reorder.Group axis="y" values={ranked} onReorder={setRanked} className="space-y-2 list-none p-0">
              {ranked.map((anime, index) => (
                <RankItem
                  key={anime.id}
                  anime={anime}
                  index={index}
                  total={ranked.length}
                  onMoveUp={() => moveUp(index)}
                  onMoveDown={() => moveDown(index)}
                />
              ))}
            </Reorder.Group>
            {ranked.length > 5 && (
              <p className="text-xs text-gray-400 text-center mt-2">
                ※ 6位以下はツイートに含まれません
              </p>
            )}
          </div>
        )}
      </main>

      {/* Fixed footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 p-4 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {step === 'select' ? (
            <>
              <p className="text-sm text-gray-600">
                <span className="font-bold text-lavender">{selectedCount}</span> 件選択中
              </p>
              <button
                onClick={goToRank}
                disabled={selectedCount === 0}
                className="px-6 py-3 rounded-full font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-lavender to-peach text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
              >
                TOP5を決める ({selectedCount}件選択中)
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-6 py-3 rounded-full font-medium text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ← 戻る
              </button>
              <button
                onClick={handleTweet}
                className="px-6 py-3 rounded-full font-medium text-sm bg-[#1DA1F2] hover:bg-[#1a91da] text-white shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                𝕏 ツイートする
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

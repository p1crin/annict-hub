/**
 * Landing Page
 * Introduction and call-to-action
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getAnnictAuthUrl } from '@/lib/auth/oauth-annict';
import LoginButton from '@/components/layout/LoginButton';

export default async function LandingPage() {
  // Redirect if already logged in
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  const authUrl = getAnnictAuthUrl();

  return (
    <div className="min-h-screen gradient-dreamy overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center p-4">
        <div className="max-w-5xl w-full">
          {/* Main content */}
          <div className="text-center mb-12">
            {/* Logo/Title */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-gradient mb-6 animate-float">
              🎵 AnnictHub
            </h1>
            <p className="text-xl sm:text-2xl text-gray-700 mb-4 font-medium">
              あなたが見たアニメの主題歌で
            </p>
            <p className="text-xl sm:text-2xl text-gray-700 mb-12 font-medium">
              Spotifyプレイリストを自動作成
            </p>

            {/* CTA Button */}
            <div className="max-w-md mx-auto mb-16">
              <LoginButton authUrl={authUrl} />
            </div>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 mb-16">
              <Stat emoji="📺" label="アニメ作品" value="10,000+" />
              <Stat emoji="🎼" label="主題歌" value="20,000+" />
              <Stat emoji="🎧" label="プレイリスト" value="簡単作成" />
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <FeatureCard
              emoji="🔐"
              title="簡単ログイン"
              description="Annictアカウントで簡単にログイン。面倒な登録は不要です。"
            />
            <FeatureCard
              emoji="🤖"
              title="自動マッチング"
              description="AIが主題歌とSpotifyの楽曲を自動でマッチング。精度も確認できます。"
            />
            <FeatureCard
              emoji="✨"
              title="ワンクリック作成"
              description="選んだアニメの主題歌を、ワンクリックでSpotifyプレイリストに追加。"
            />
          </div>

          {/* How it works */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-pastel p-8 sm:p-12">
            <h2 className="text-3xl font-bold text-center text-gradient mb-12">
              使い方
            </h2>
            <div className="grid md:grid-cols-4 gap-8">
              <Step
                number={1}
                emoji="🔑"
                title="ログイン"
                description="Annictアカウントでログイン"
              />
              <Step
                number={2}
                emoji="📺"
                title="アニメ選択"
                description="視聴したアニメから選ぶ"
              />
              <Step
                number={3}
                emoji="🎵"
                title="主題歌取得"
                description="自動で主題歌を検索"
              />
              <Step
                number={4}
                emoji="🎧"
                title="プレイリスト作成"
                description="Spotifyに保存完了"
              />
            </div>
          </div>
        </div>

        {/* Floating Decorations */}
        <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute top-20 left-10 text-6xl animate-float opacity-20">
            ♪
          </div>
          <div
            className="absolute top-40 right-20 text-7xl animate-float opacity-20"
            style={{ animationDelay: '1s' }}
          >
            ★
          </div>
          <div
            className="absolute bottom-32 left-20 text-5xl animate-float opacity-20"
            style={{ animationDelay: '2s' }}
          >
            ♥
          </div>
          <div
            className="absolute bottom-20 right-10 text-6xl animate-float opacity-20"
            style={{ animationDelay: '0.5s' }}
          >
            ♪
          </div>
          <div
            className="absolute top-1/2 left-1/4 text-4xl animate-float opacity-20"
            style={{ animationDelay: '1.5s' }}
          >
            ✨
          </div>
          <div
            className="absolute top-1/3 right-1/3 text-5xl animate-float opacity-20"
            style={{ animationDelay: '2.5s' }}
          >
            🎹
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-gray-600 text-sm">
        <p>
          Powered by{' '}
          <a
            href="https://annict.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lavender hover:underline"
          >
            Annict
          </a>
          ,{' '}
          <a
            href="https://animethemes.moe"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lavender hover:underline"
          >
            AnimeThemes.moe
          </a>
          , and{' '}
          <a
            href="https://spotify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lavender hover:underline"
          >
            Spotify
          </a>
        </p>
        <p className="mt-2">© 2024 AnnictHub. All rights reserved.</p>
      </footer>
    </div>
  );
}

/**
 * Stat Component
 */
function Stat({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <div className="text-4xl mb-2">{emoji}</div>
      <div className="text-2xl font-bold text-gradient mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

/**
 * Feature Card Component
 */
function FeatureCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-pastel p-6 hover:shadow-xl hover:scale-105 transition-all duration-300">
      <div className="text-5xl mb-4 text-center">{emoji}</div>
      <h3 className="text-xl font-bold text-gray-800 mb-3 text-center">
        {title}
      </h3>
      <p className="text-gray-600 text-sm text-center">{description}</p>
    </div>
  );
}

/**
 * Step Component
 */
function Step({
  number,
  emoji,
  title,
  description,
}: {
  number: number;
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="relative mx-auto w-16 h-16 mb-4">
        <div className="absolute inset-0 bg-gradient-to-r from-lavender to-peach rounded-full flex items-center justify-center text-white font-bold text-xl">
          {number}
        </div>
        <div className="absolute -top-2 -right-2 text-3xl">{emoji}</div>
      </div>
      <h4 className="font-bold text-gray-800 mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

/**
 * Login Page
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getAnnictAuthUrl } from '@/lib/auth/oauth-annict';
import LoginButton from '@/components/layout/LoginButton';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Redirect if already logged in
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  const authUrl = getAnnictAuthUrl();
  const params = await searchParams;
  const error = params.error;

  return (
    <div className="min-h-screen flex items-center justify-center gradient-dreamy p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-pastel p-8 sm:p-12">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-gradient mb-2">
              🎵 AnnictHub
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              アニメの主題歌でSpotifyプレイリストを作成
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <p className="text-red-600 text-sm text-center">
                {getErrorMessage(error)}
              </p>
            </div>
          )}

          {/* Features */}
          <div className="mb-8 space-y-3">
            <Feature icon="📺" text="Annictの視聴済みアニメを取得" />
            <Feature icon="🎼" text="主題歌を自動で検索" />
            <Feature icon="🎧" text="Spotifyプレイリストを作成" />
          </div>

          {/* Login Button */}
          <LoginButton authUrl={authUrl} />

          {/* Privacy Note */}
          <p className="text-xs text-gray-500 text-center mt-6">
            Annictアカウントでログインすることで、
            <br />
            利用規約とプライバシーポリシーに同意したものとみなされます
          </p>
        </div>

        {/* Floating Decorations */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-20 left-10 text-4xl animate-float opacity-20">
            ♪
          </div>
          <div className="absolute top-40 right-20 text-5xl animate-float opacity-20"
            style={{ animationDelay: '1s' }}>
            ★
          </div>
          <div className="absolute bottom-32 left-20 text-3xl animate-float opacity-20"
            style={{ animationDelay: '2s' }}>
            ♥
          </div>
          <div className="absolute bottom-20 right-10 text-4xl animate-float opacity-20"
            style={{ animationDelay: '0.5s' }}>
            ♪
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-lavender-light to-peach-light rounded-xl">
      <span className="text-2xl">{icon}</span>
      <span className="text-gray-700 text-sm">{text}</span>
    </div>
  );
}

function getErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    missing_code: '認証コードが取得できませんでした',
    auth_failed: '認証に失敗しました',
    access_denied: 'アクセスが拒否されました',
    not_authenticated: 'ログインが必要です',
  };

  return messages[error] || '予期しないエラーが発生しました';
}

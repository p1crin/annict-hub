/**
 * Login Button Component
 */

'use client';

export default function LoginButton({ authUrl }: { authUrl: string }) {
  return (
    <a
      href={authUrl}
      className="block w-full bg-gradient-to-r from-lavender to-peach text-white font-semibold text-center py-4 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
    >
      Annictでログイン
    </a>
  );
}

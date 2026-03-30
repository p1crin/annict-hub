import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'myanimelist.net',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.myanimelist.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'annict.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.annict.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.annict.jp',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

/**
 * Spotify Search API
 * Searches for tracks on Spotify and scores matches
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { refreshSpotifyToken } from '@/lib/auth/oauth-spotify';
import { updateSession } from '@/lib/auth/session';
import { spotifyClient } from '@/lib/api/spotify';
import { batchMatchThemesToSpotify } from '@/lib/matching/spotify-scorer';
import type { ThemeSongData } from '@/types/app';

export const dynamic = 'force-dynamic';

interface SearchRequest {
  themes: ThemeSongData[];
  animeTitle?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session || !session.spotifyToken) {
      return NextResponse.json(
        { error: 'Spotify not connected' },
        { status: 401 }
      );
    }

    // Check if token needs refresh
    let accessToken = session.spotifyToken.accessToken;
    const now = new Date();
    const expiresAt = new Date(session.spotifyToken.expiresAt);

    if (now >= expiresAt) {
      console.log('Refreshing expired Spotify token...');

      if (!session.spotifyToken.refreshToken) {
        return NextResponse.json(
          { error: 'Spotify token expired. Please reconnect.' },
          { status: 401 }
        );
      }

      try {
        const tokenResponse = await refreshSpotifyToken(
          session.spotifyToken.refreshToken
        );

        const newExpiresAt = new Date(
          Date.now() + tokenResponse.expires_in * 1000
        );

        const updatedSpotifyToken = {
          ...session.spotifyToken,
          accessToken: tokenResponse.access_token,
          expiresAt: newExpiresAt,
        };

        await updateSession({ spotifyToken: updatedSpotifyToken });
        accessToken = tokenResponse.access_token;
      } catch (refreshError: any) {
        console.error('Token refresh failed:', refreshError);
        return NextResponse.json(
          { error: 'Spotify token expired. Please reconnect.' },
          { status: 401 }
        );
      }
    }

    // Parse request body
    const body: SearchRequest = await request.json();
    const { themes, animeTitle } = body;

    if (!themes || !Array.isArray(themes) || themes.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: themes array required' },
        { status: 400 }
      );
    }

    console.log(`Searching Spotify for ${themes.length} themes`);

    // Match themes with Spotify tracks
    const matches = await batchMatchThemesToSpotify(
      accessToken,
      themes,
      animeTitle,
      (progress) => {
        console.log(
          `Spotify matching progress: ${progress.processed}/${progress.total}`
        );
      }
    );

    // Calculate statistics
    const highConfidence = matches.filter((m) => m.confidence === 'high').length;
    const mediumConfidence = matches.filter((m) => m.confidence === 'medium').length;
    const lowConfidence = matches.filter((m) => m.confidence === 'low').length;
    const unmatched = matches.filter((m) => !m.spotifyTrack).length;

    return NextResponse.json({
      success: true,
      matches,
      stats: {
        total: themes.length,
        matched: matches.length - unmatched,
        unmatched,
        highConfidence,
        mediumConfidence,
        lowConfidence,
      },
    });

  } catch (error: any) {
    console.error('Spotify search API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to search Spotify',
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}

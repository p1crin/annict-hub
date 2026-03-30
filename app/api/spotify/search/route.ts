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
import type { AnimeThemesThemeWithDetails } from '@/types/animethemes';

export const dynamic = 'force-dynamic';

interface SearchRequest {
  themes: ThemeSongData[];
  animeTitle?: string;
}

/**
 * Convert ThemeSongData to AnimeThemesThemeWithDetails
 * This adapter transforms our internal format to the format expected by the matching function
 * Note: Only populates fields actually used by the matching function (songTitle, artistNames, type)
 */
function adaptThemeSongData(theme: ThemeSongData): AnimeThemesThemeWithDetails {
  // Create a minimal object with only the fields used by createSearchQuery
  const adapted = {
    id: parseInt(theme.id, 10) || 0,
    type: theme.type,
    sequence: theme.sequence,
    slug: `${theme.type}${theme.sequence}`,
    songTitle: theme.title,
    artistNames: theme.artist,
    song: theme.title ? {
      id: 0,
      title: theme.title,
      artists: theme.artist ? [{
        id: 0,
        name: theme.artist,
        slug: theme.artist.toLowerCase().replace(/\s+/g, '-')
      }] : undefined
    } : undefined,
    bestVideo: theme.videoUrl ? {
      id: 0,
      basename: '',
      filename: '',
      path: '',
      size: 0,
      resolution: 720,
      nc: false,
      subbed: false,
      lyrics: false,
      uncen: false,
      link: theme.videoUrl,
    } : undefined,
    episodeRange: theme.episodes,
  };

  // Type assertion is safe here because we only use songTitle, artistNames, and type in the matcher
  return adapted as AnimeThemesThemeWithDetails;
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
    // Transform themes to include animeTitle for each theme
    const themesWithAnimeTitle = themes.map(theme => {
      const adapted = adaptThemeSongData(theme);
      console.log(`Adapted theme: ${JSON.stringify({
        original: { title: theme.title, artist: theme.artist },
        adapted: { songTitle: adapted.songTitle, artistNames: adapted.artistNames }
      })}`);
      return {
        theme: adapted,
        animeTitle: animeTitle || ''
      };
    });

    const matches = await batchMatchThemesToSpotify(
      themesWithAnimeTitle,
      accessToken,
      {},
      (current, total, currentTheme) => {
        console.log(
          `Spotify matching progress: ${current}/${total}${currentTheme ? ` - ${currentTheme}` : ''}`
        );
      }
    );

    // Calculate statistics
    // Convert Map to array of values for processing
    const matchesArray = Array.from(matches.values());
    const highConfidence = matchesArray.filter((m) => m.bestMatch?.confidence === 'high').length;
    const mediumConfidence = matchesArray.filter((m) => m.bestMatch?.confidence === 'medium').length;
    const lowConfidence = matchesArray.filter((m) => m.bestMatch?.confidence === 'low').length;
    const unmatched = matchesArray.filter((m) => m.status === 'no_match').length;

    // Convert Map to object for JSON response
    const matchesObject = Object.fromEntries(matches);

    return NextResponse.json({
      success: true,
      matches: matchesObject,
      stats: {
        total: themes.length,
        matched: matchesArray.length - unmatched,
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

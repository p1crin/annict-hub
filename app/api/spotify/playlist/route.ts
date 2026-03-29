/**
 * Spotify Playlist API
 * Creates playlists and adds tracks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { refreshSpotifyToken } from '@/lib/auth/oauth-spotify';
import { updateSession } from '@/lib/auth/session';
import { spotifyClient } from '@/lib/api/spotify';
import { supabase } from '@/lib/db/supabase';
import type { ThemeSongData } from '@/types/app';
import type { SpotifyTrack } from '@/types/spotify';

export const dynamic = 'force-dynamic';

interface SpotifyMatchResult {
  theme: ThemeSongData;
  spotifyTrack: SpotifyTrack | null;
  score?: number;
  confidence: 'high' | 'medium' | 'low';
}

interface CreatePlaylistRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
  matches: SpotifyMatchResult[];
  skipUnmatched?: boolean;
  skipLowConfidence?: boolean;
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
    const body: CreatePlaylistRequest = await request.json();
    const {
      name,
      description,
      isPublic = false,
      matches,
      skipUnmatched = true,
      skipLowConfidence = false,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Playlist name is required' },
        { status: 400 }
      );
    }

    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json(
        { error: 'No tracks provided' },
        { status: 400 }
      );
    }

    console.log(`Creating playlist "${name}" with ${matches.length} potential tracks`);

    // Filter matches based on settings
    let filteredMatches = matches;

    if (skipUnmatched) {
      filteredMatches = filteredMatches.filter((m) => m.spotifyTrack);
    }

    if (skipLowConfidence) {
      filteredMatches = filteredMatches.filter(
        (m) => m.confidence !== 'low' && m.spotifyTrack
      );
    }

    console.log(`After filtering: ${filteredMatches.length} tracks`);

    if (filteredMatches.length === 0) {
      return NextResponse.json(
        { error: 'No tracks to add after filtering' },
        { status: 400 }
      );
    }

    // Get user profile
    const profile = await spotifyClient.getCurrentUser(accessToken);

    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to get Spotify user profile' },
        { status: 500 }
      );
    }

    // Create playlist
    const playlist = await spotifyClient.createPlaylist(
      profile.id,
      {
        name,
        description:
          description ||
          `アニメ主題歌プレイリスト - Created by AnnictHub 🎵`,
        public: isPublic,
      },
      accessToken
    );

    if (!playlist) {
      return NextResponse.json(
        { error: 'Failed to create playlist' },
        { status: 500 }
      );
    }

    console.log(`Playlist created: ${playlist.id}`);

    // Extract track URIs
    const trackUris = filteredMatches
      .filter((m) => m.spotifyTrack)
      .map((m) => m.spotifyTrack!.uri);

    // Add tracks to playlist (Spotify API limit: 100 tracks per request)
    const batchSize = 100;
    let addedCount = 0;

    for (let i = 0; i < trackUris.length; i += batchSize) {
      const batch = trackUris.slice(i, i + batchSize);
      await spotifyClient.addTracksToPlaylist(
        playlist.id,
        batch,
        accessToken
      );
      addedCount += batch.length;
      console.log(`Added ${addedCount}/${trackUris.length} tracks`);
    }

    // Save to database
    const { data: ranking, error: rankingError } = await supabase
      .from('rankings')
      .insert({
        user_id: session.user.id,
        title: name,
        description,
        spotify_playlist_id: playlist.id,
        spotify_playlist_url: playlist.external_urls.spotify,
        is_public: isPublic,
        track_count: addedCount,
      } as any)
      .select()
      .maybeSingle();

    if (rankingError) {
      console.error('Failed to save ranking:', rankingError);
    } else if (ranking) {
      // Save ranking items
      const rankingItems = filteredMatches
        .filter((m) => m.spotifyTrack)
        .map((m, index) => ({
          ranking_id: (ranking as any).id,
          annict_work_id: m.theme.annictWorkId,
          theme_type: m.theme.type,
          theme_sequence: m.theme.sequence,
          theme_title: m.theme.title,
          spotify_track_id: m.spotifyTrack!.id,
          spotify_track_uri: m.spotifyTrack!.uri,
          match_score: m.score,
          confidence: m.confidence,
          position: index + 1,
        }));

      await supabase.from('ranking_items').insert(rankingItems as any);
    }

    // Calculate statistics
    const stats = {
      totalMatches: matches.length,
      addedToPlaylist: addedCount,
      skipped: matches.length - addedCount,
      highConfidence: filteredMatches.filter((m) => m.confidence === 'high')
        .length,
      mediumConfidence: filteredMatches.filter(
        (m) => m.confidence === 'medium'
      ).length,
      lowConfidence: filteredMatches.filter((m) => m.confidence === 'low')
        .length,
    };

    return NextResponse.json({
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls.spotify,
        trackCount: addedCount,
      },
      stats,
    });

  } catch (error: any) {
    console.error('Playlist creation API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to create playlist',
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve user's created playlists
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch user's rankings from database
    const { data: rankings, error } = await supabase
      .from('rankings')
      .select('*, ranking_items(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      playlists: rankings || [],
    });

  } catch (error: any) {
    console.error('Fetch playlists API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch playlists',
      },
      { status: 500 }
    );
  }
}

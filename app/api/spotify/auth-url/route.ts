/**
 * Spotify Auth URL API
 * Returns the Spotify OAuth authorization URL
 */

import { NextResponse } from 'next/server';
import { getSpotifyAuthUrl } from '@/lib/auth/oauth-spotify';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Get Spotify auth URL
    const authUrl = getSpotifyAuthUrl(state);

    return NextResponse.json({
      success: true,
      authUrl,
      state,
    });

  } catch (error: any) {
    console.error('Spotify auth URL API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate auth URL',
      },
      { status: 500 }
    );
  }
}

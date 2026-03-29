/**
 * Spotify OAuth Callback Handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeSpotifyCode } from '@/lib/auth/oauth-spotify';
import { updateSession, getSession } from '@/lib/auth/session';
import type { SpotifyTokenData } from '@/types/app';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Handle OAuth error
  if (error) {
    console.error('Spotify OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/dashboard?spotify_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?spotify_error=missing_code', request.url)
    );
  }

  try {
    // Check if user is logged in
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(
        new URL('/login?error=not_authenticated', request.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await exchangeSpotifyCode(code);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Create Spotify token data
    const spotifyToken: SpotifyTokenData = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
      scope: tokenResponse.scope,
    };

    // Update session with Spotify token
    await updateSession({ spotifyToken });

    // Redirect to dashboard
    return NextResponse.redirect(
      new URL('/dashboard?spotify_connected=true', request.url)
    );
  } catch (error: any) {
    console.error('Spotify callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/dashboard?spotify_error=${encodeURIComponent(
          error.message || 'auth_failed'
        )}`,
        request.url
      )
    );
  }
}

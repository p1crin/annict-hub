/**
 * Spotify OAuth 2.0 Helper Functions
 */

import axios from 'axios';
import type { SpotifyOAuthTokenResponse, SpotifyOAuthError } from '@/types/spotify';

const SPOTIFY_OAUTH_BASE = 'https://accounts.spotify.com';

/**
 * Get authorization URL for Spotify OAuth
 */
export function getSpotifyAuthUrl(state?: string): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Missing Spotify OAuth configuration');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: [
      'playlist-modify-public',
      'playlist-modify-private',
      'playlist-read-private',
      'user-read-email',
      'user-read-private',
    ].join(' '),
    state: state || generateRandomString(16),
  });

  return `${SPOTIFY_OAUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeSpotifyCode(
  code: string
): Promise<SpotifyOAuthTokenResponse> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Spotify OAuth configuration');
  }

  try {
    const response = await axios.post<SpotifyOAuthTokenResponse>(
      `${SPOTIFY_OAUTH_BASE}/api/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString('base64')}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Spotify OAuth error:', error.response?.data);
    throw new Error(
      error.response?.data?.error_description || 'Failed to exchange Spotify code'
    );
  }
}

/**
 * Refresh Spotify access token
 */
export async function refreshSpotifyToken(
  refreshToken: string
): Promise<SpotifyOAuthTokenResponse> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify OAuth configuration');
  }

  try {
    const response = await axios.post<SpotifyOAuthTokenResponse>(
      `${SPOTIFY_OAUTH_BASE}/api/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString('base64')}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Spotify token refresh error:', error.response?.data);
    throw new Error(
      error.response?.data?.error_description || 'Failed to refresh Spotify token'
    );
  }
}

/**
 * Validate Spotify access token
 */
export async function validateSpotifyToken(
  accessToken: string
): Promise<boolean> {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 5000,
    });

    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Generate random string for state parameter
 */
function generateRandomString(length: number): string {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

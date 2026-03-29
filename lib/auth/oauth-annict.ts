/**
 * Annict OAuth 2.0 Helper Functions
 */

import axios from 'axios';
import type { AnnictOAuthTokenResponse, AnnictOAuthError } from '@/types/annict';

const ANNICT_OAUTH_BASE = 'https://api.annict.com/oauth';

/**
 * Get authorization URL for Annict OAuth
 */
export function getAnnictAuthUrl(): string {
  const clientId = process.env.ANNICT_CLIENT_ID;
  const redirectUri = process.env.ANNICT_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Missing Annict OAuth configuration');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read', // Read access to user's library
  });

  return `${ANNICT_OAUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeAnnictCode(
  code: string
): Promise<AnnictOAuthTokenResponse> {
  const clientId = process.env.ANNICT_CLIENT_ID;
  const clientSecret = process.env.ANNICT_CLIENT_SECRET;
  const redirectUri = process.env.ANNICT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Annict OAuth configuration');
  }

  try {
    const response = await axios.post<AnnictOAuthTokenResponse>(
      `${ANNICT_OAUTH_BASE}/token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Annict OAuth error:', error.response?.data);
    throw new Error(
      error.response?.data?.error_description || 'Failed to exchange Annict code'
    );
  }
}

/**
 * Validate Annict access token
 */
export async function validateAnnictToken(
  accessToken: string
): Promise<boolean> {
  try {
    // Test the token by making a simple API request
    const response = await axios.post(
      'https://api.annict.com/graphql',
      {
        query: '{ viewer { username } }',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    return !response.data.errors;
  } catch {
    return false;
  }
}

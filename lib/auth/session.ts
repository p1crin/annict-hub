/**
 * Session Management with Cookies
 */

import { cookies } from 'next/headers';
import { annictClient } from '../api/annict';
import { getUserByAnnictId, upsertUser } from '../db/queries';
import type { AppSession, AppUser, SpotifyTokenData } from '@/types/app';

const SESSION_COOKIE_NAME = 'anime_theme_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Encrypt sensitive data (simple base64 for now, should use proper encryption in production)
 */
function encrypt(data: string): string {
  return Buffer.from(data).toString('base64');
}

/**
 * Decrypt sensitive data
 */
function decrypt(data: string): string {
  return Buffer.from(data, 'base64').toString('utf-8');
}

/**
 * Create session
 */
export async function createSession(
  annictAccessToken: string,
  spotifyTokenData?: SpotifyTokenData
): Promise<AppSession> {
  // Get user info from Annict
  const viewer = await annictClient.getViewer(annictAccessToken);

  if (!viewer) {
    throw new Error('Failed to get user information from Annict');
  }

  // Upsert user in database
  const dbUser = await upsertUser({
    annict_id: viewer.annictId,
    username: viewer.username,
    name: viewer.name || undefined,
    avatar_url: viewer.avatarUrl || undefined,
    annict_access_token: encrypt(annictAccessToken),
    spotify_access_token: spotifyTokenData?.accessToken
      ? encrypt(spotifyTokenData.accessToken)
      : undefined,
    spotify_refresh_token: spotifyTokenData?.refreshToken
      ? encrypt(spotifyTokenData.refreshToken)
      : undefined,
    spotify_token_expires_at: spotifyTokenData?.expiresAt.toISOString(),
  });

  if (!dbUser) {
    throw new Error('Failed to create user in database');
  }

  const user: AppUser = {
    id: dbUser.id,
    annictId: dbUser.annict_id,
    username: dbUser.username,
    name: dbUser.name || undefined,
    avatarUrl: dbUser.avatar_url || undefined,
  };

  const session: AppSession = {
    user,
    annictToken: annictAccessToken,
    spotifyToken: spotifyTokenData,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
  };

  // Save session to cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return session;
}

/**
 * Get current session
 */
export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  try {
    const session: AppSession = JSON.parse(sessionCookie.value);

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await destroySession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to parse session:', error);
    await destroySession();
    return null;
  }
}

/**
 * Update session (e.g., after Spotify auth)
 */
export async function updateSession(
  updates: Partial<AppSession>
): Promise<AppSession | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const updatedSession = {
    ...session,
    ...updates,
  };

  // Update database if Spotify tokens changed
  if (updates.spotifyToken) {
    const dbUser = await getUserByAnnictId(session.user.annictId);
    if (dbUser) {
      await upsertUser({
        annict_id: dbUser.annict_id,
        username: dbUser.username,
        name: dbUser.name || undefined,
        avatar_url: dbUser.avatar_url || undefined,
        annict_access_token: dbUser.annict_access_token || undefined,
        spotify_access_token: encrypt(updates.spotifyToken.accessToken),
        spotify_refresh_token: updates.spotifyToken.refreshToken
          ? encrypt(updates.spotifyToken.refreshToken)
          : undefined,
        spotify_token_expires_at: updates.spotifyToken.expiresAt.toISOString(),
      });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(updatedSession), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return updatedSession;
}

/**
 * Destroy session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Require authentication (throw if not authenticated)
 */
export async function requireAuth(): Promise<AppSession> {
  const session = await getSession();

  if (!session) {
    throw new Error('Authentication required');
  }

  return session;
}

/**
 * Get Annict token from session
 */
export async function getAnnictToken(): Promise<string | null> {
  const session = await getSession();
  return session?.annictToken || null;
}

/**
 * Get Spotify token from session
 */
export async function getSpotifyToken(): Promise<SpotifyTokenData | null> {
  const session = await getSession();
  return session?.spotifyToken || null;
}

/**
 * Check if Spotify is connected
 */
export async function hasSpotifyAuth(): Promise<boolean> {
  const session = await getSession();
  return session?.spotifyToken !== undefined;
}

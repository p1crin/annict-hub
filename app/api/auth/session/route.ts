/**
 * Session API
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Return session info (without sensitive tokens)
    return NextResponse.json({
      user: session.user,
      hasSpotifyAuth: session.spotifyToken !== undefined,
      expiresAt: session.expiresAt,
    });
  } catch (error: any) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

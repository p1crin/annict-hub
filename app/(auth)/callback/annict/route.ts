/**
 * Annict OAuth Callback Handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeAnnictCode } from '@/lib/auth/oauth-annict';
import { createSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Handle OAuth error
  if (error) {
    console.error('Annict OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', request.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await exchangeAnnictCode(code);

    // Create session
    await createSession(tokenResponse.access_token);

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error: any) {
    console.error('Annict callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message || 'auth_failed')}`,
        request.url
      )
    );
  }
}

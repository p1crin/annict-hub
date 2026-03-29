/**
 * Logout API
 */

import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

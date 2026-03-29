/**
 * Supabase Client Configuration
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

/**
 * Public Supabase client (uses anon key)
 * Use this for client-side operations
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Server-side Supabase client (uses service role key)
 * Use this for server-side operations that bypass RLS
 * WARNING: Only use in API routes or server components
 */
export function getServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Helper type for Supabase query results
 */
export type SupabaseQueryResult<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Check if cache is fresh based on synced_at timestamp
 */
export function isCacheFresh(
  syncedAt: string | Date,
  ttlSeconds: number = 86400 // 24 hours default
): boolean {
  const syncedDate =
    typeof syncedAt === 'string' ? new Date(syncedAt) : syncedAt;
  const now = new Date();
  const diffMs = now.getTime() - syncedDate.getTime();
  const diffSeconds = diffMs / 1000;

  return diffSeconds < ttlSeconds;
}

/**
 * Get TTL from environment or use default
 */
export function getCacheTTL(): number {
  const ttl = process.env.CACHE_TTL;
  return ttl ? parseInt(ttl, 10) : 86400; // Default: 24 hours
}

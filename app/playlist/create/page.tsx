/**
 * Playlist Creation Page
 * Multi-step workflow for creating Spotify playlists
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import PlaylistCreatorClient from './PlaylistCreatorClient';

export default async function PlaylistCreatePage() {
  // Check authentication
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Check Spotify connection
  if (!session.spotifyToken) {
    redirect('/dashboard');
  }

  return <PlaylistCreatorClient session={session} />;
}

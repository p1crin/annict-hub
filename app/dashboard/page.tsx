/**
 * Dashboard Page
 * Main anime library view with filtering and playlist creation
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  // Check authentication
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return <DashboardClient session={session} />;
}

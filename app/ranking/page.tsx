import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import RankingClient from './RankingClient';

export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return <RankingClient session={session} />;
}

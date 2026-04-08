import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/home/LandingPage';

export const metadata: Metadata = {
  title: 'Podium | Reliable speech delivery',
  description: 'Prepare talks, choose a voice, and stay ready to present even when connectivity drops.',
};

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect('/library');
  }

  return <LandingPage />;
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AuthScreen } from './components/AuthScreen';

export const metadata: Metadata = {
  title: 'Log in — Basecamp',
  description: 'Sign in to the YETI Robotics Basecamp platform.',
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const session = await getSession();
  if (session?.user) {
    redirect('/');
  }

  const { error, redirect: redirectUrl } = await searchParams;

  return <AuthScreen authError={error} redirectUrl={redirectUrl} />;
}

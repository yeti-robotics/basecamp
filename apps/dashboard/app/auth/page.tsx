import type { Metadata } from 'next';
import { AuthScreen } from './components/AuthScreen';

export const metadata: Metadata = {
  title: 'Log in — Basecamp',
  description: 'Sign in to the YETI Robotics Basecamp platform.',
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string; redirect?: string }>;
}) {
  const { signup, redirect } = await searchParams;

  return <AuthScreen redirectUrl={redirect} signupRestricted={signup === 'restricted'} />;
}

import type { Metadata } from 'next';
import { AuthScreen } from './components/AuthScreen';

export const metadata: Metadata = {
  title: 'Log into Basecamp',
  description: 'Sign in to the YETI Robotics Basecamp system.',
};

export default function AuthPage() {
  return <AuthScreen />;
}

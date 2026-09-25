import { headers } from 'next/headers';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type AuthSession = {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: string;
  };
};

export async function getSession(): Promise<AuthSession | null> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie');

  if (!cookie) {
    return null;
  }

  const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';

  try {
    const response = await fetch(`${apiInternalUrl}/api/auth/get-session`, {
      headers: { cookie },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error:', response.status, errorText);
      return null;
    }

    return (await response.json()) as AuthSession | null;
  } catch {
    return null;
  }
}

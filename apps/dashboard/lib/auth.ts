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

const retryDelaysMs = [200, 400, 800, 1_600];
const transientStatuses = new Set([500, 502, 503, 504]);

class SessionResponseError extends Error {
  constructor(readonly status: number) {
    super(`Session check failed (${status})`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSession(): Promise<AuthSession | null> {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie');

  if (!cookie) {
    return null;
  }

  const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';
  const url = `${apiInternalUrl}/api/auth/get-session`;
  const attempts = retryDelaysMs.length + 1;
  let lastFailure: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const delayMs = retryDelaysMs[attempt - 1];
    if (delayMs !== undefined) await sleep(delayMs);
    try {
      const response = await fetch(url, {
        headers: { cookie },
        cache: 'no-store',
      });
      if (response.ok) return (await response.json()) as AuthSession | null;

      const failure = new SessionResponseError(response.status);
      if (!transientStatuses.has(failure.status)) throw failure;
      lastFailure = failure;
    } catch (error) {
      if (error instanceof SessionResponseError && !transientStatuses.has(error.status)) {
        throw error;
      }
      lastFailure = error;
    }
  }

  console.error('Session check failed because the API was unavailable');
  throw new Error('Session check failed because the API was unavailable', { cause: lastFailure });
}

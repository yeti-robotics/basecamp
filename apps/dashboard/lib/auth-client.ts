import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // Browser requests must use the dashboard's auth proxy, including its cookies.
  baseURL: typeof window === 'undefined' ? undefined : `${window.location.origin}/api/auth`,
  fetchOptions: {
    credentials: 'include',
    cache: 'no-store',
  },
});

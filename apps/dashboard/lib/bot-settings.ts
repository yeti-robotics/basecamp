import { headers } from 'next/headers';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';

export type BotStatus = {
  desiredEnabled: boolean;
  tokenConfigured: boolean;
  connection: 'off' | 'connecting' | 'connected' | 'failed';
  statusMessage: string;
};

function safeBotStatus(value: unknown): BotStatus | null {
  if (typeof value !== 'object' || value === null) return null;
  const status = value as Record<string, unknown>;
  if (
    typeof status.desiredEnabled !== 'boolean' ||
    typeof status.tokenConfigured !== 'boolean' ||
    typeof status.statusMessage !== 'string' ||
    !status.statusMessage.trim() ||
    !['off', 'connecting', 'connected', 'failed'].includes(String(status.connection))
  ) {
    return null;
  }
  return {
    desiredEnabled: status.desiredEnabled,
    tokenConfigured: status.tokenConfigured,
    connection: status.connection as BotStatus['connection'],
    statusMessage: status.statusMessage,
  };
}

export async function getBotStatus(): Promise<BotStatus | null> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;

  try {
    const response = await fetch(`${apiInternalUrl}/api/settings/bot`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!response.ok) return null;

    return safeBotStatus(await response.json());
  } catch {
    return null;
  }
}

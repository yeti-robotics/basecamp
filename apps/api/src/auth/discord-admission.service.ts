import type { ConfigService } from '@nestjs/config';

export type DiscordAdmissionResult = 'allowed' | 'denied' | 'unavailable';
type Fetcher = typeof fetch;

const snowflakePattern = /^\d{17,20}$/;

export class DiscordAdmissionService {
  constructor(
    private readonly config: ConfigService,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 5_000,
  ) {}

  async verify(discordId: string): Promise<DiscordAdmissionResult> {
    if (!snowflakePattern.test(discordId)) return 'denied';

    const guildId = this.config.get<string>('DISCORD_GUILD_ID')?.trim();
    const token = this.config.get<string>('DISCORD_ADMISSION_BOT_TOKEN')?.trim();
    if (!guildId || !snowflakePattern.test(guildId) || !token) return 'unavailable';

    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`;
    try {
      const response = await this.fetcher(url, {
        headers: { Authorization: `Bot ${token}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.status === 404) return 'denied';
      if (!response.ok) return 'unavailable';

      const member: unknown = await response.json();
      if (
        typeof member !== 'object' ||
        member === null ||
        !('user' in member) ||
        typeof member.user !== 'object' ||
        member.user === null ||
        !('id' in member.user) ||
        member.user.id !== discordId
      ) {
        return 'unavailable';
      }

      return 'allowed';
    } catch {
      return 'unavailable';
    }
  }
}

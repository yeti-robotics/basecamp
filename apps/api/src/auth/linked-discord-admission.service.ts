import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { createAuth } from '../auth.js';
import { DatabaseService } from '../database/database.service.js';
import { account } from '../database/schema/auth.js';
import { AUTH, DISCORD_ADMISSION } from './auth.module.js';
import type { DiscordAdmissionService } from './discord-admission.service.js';

const MEMBERSHIP_SCOPE = 'guilds.members.read';

@Injectable()
export class LinkedDiscordAdmissionService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(AUTH) private readonly auth: ReturnType<typeof createAuth>,
    @Inject(DISCORD_ADMISSION) private readonly admission: DiscordAdmissionService,
  ) {}

  async verifyLinked(
    userId: string,
    discordId: string,
  ): Promise<'allowed' | 'denied' | 'unavailable'> {
    try {
      const linkedAccounts = await this.database.db
        .select({ id: account.id })
        .from(account)
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, 'discord'),
            eq(account.accountId, discordId),
          ),
        )
        .limit(1);
      const linkedAccount = linkedAccounts[0];
      if (!linkedAccount) return 'unavailable';

      const tokens = await this.auth.api.getAccessToken({
        body: { accountId: linkedAccount.id, userId },
      });
      if (!tokens.accessToken || !tokens.scopes.includes(MEMBERSHIP_SCOPE)) {
        return 'unavailable';
      }

      return await this.admission.verify(tokens.accessToken, discordId);
    } catch {
      return 'unavailable';
    }
  }
}

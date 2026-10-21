import { Injectable, Logger } from '@nestjs/common';
import { ActivityType } from 'discord.js';
import { eq, sql } from 'drizzle-orm';
import { Context, type ContextOf, Once } from 'necord';
import { DatabaseService } from '../database/database.service.js';
import { bot_settings, DEFAULT_BOT_STATUS_MESSAGE } from '../database/schema/bot-settings.js';

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(private readonly database: DatabaseService) {}

  @Once('clientReady')
  public async onReady(@Context() [client]: ContextOf<'clientReady'>): Promise<void> {
    this.logger.log(`Bot logged in as ${client.user.username}`);

    const rows = await this.database.db
      .select({ statusMessage: bot_settings.status_message })
      .from(bot_settings)
      .where(eq(bot_settings.id, 1))
      .limit(1);
    const statusMessage = rows[0]?.statusMessage?.trim() || DEFAULT_BOT_STATUS_MESSAGE;
    client.user.setActivity(statusMessage, { type: ActivityType.Custom });
  }

  public async checkConnection(): Promise<boolean> {
    try {
      await this.database.db.execute(sql`SELECT 1 AS connected`);
      return true;
    } catch {
      return false;
    }
  }
}

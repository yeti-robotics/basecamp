import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { bot_settings, DEFAULT_BOT_STATUS_MESSAGE } from '../database/schema/bot-settings.js';

@Injectable()
export class BotSettingsStore {
  constructor(private readonly database: DatabaseService) {}

  async load(): Promise<{
    enabled: boolean;
    tokenCiphertext: string | null;
    statusMessage: string;
  }> {
    const rows = await this.database.db
      .select({
        enabled: bot_settings.enabled,
        tokenCiphertext: bot_settings.token_ciphertext,
        statusMessage: bot_settings.status_message,
      })
      .from(bot_settings)
      .where(eq(bot_settings.id, 1))
      .limit(1);
    const row = rows[0];
    return {
      enabled: row?.enabled ?? false,
      tokenCiphertext: row?.tokenCiphertext ?? null,
      statusMessage: row?.statusMessage?.trim() || DEFAULT_BOT_STATUS_MESSAGE,
    };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.database.db
      .insert(bot_settings)
      .values({ id: 1, enabled })
      .onConflictDoUpdate({ target: bot_settings.id, set: { enabled } });
  }

  async setStatusMessage(statusMessage: string): Promise<void> {
    await this.database.db
      .insert(bot_settings)
      .values({ id: 1, status_message: statusMessage })
      .onConflictDoUpdate({
        target: bot_settings.id,
        set: { status_message: statusMessage },
      });
  }

  async setToken(ciphertext: string): Promise<void> {
    await this.database.db
      .insert(bot_settings)
      .values({ id: 1, token_ciphertext: ciphertext })
      .onConflictDoUpdate({ target: bot_settings.id, set: { token_ciphertext: ciphertext } });
  }
}

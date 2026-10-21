import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { bot_settings } from '../database/schema/bot-settings.js';

@Injectable()
export class BotSettingsStore {
  constructor(private readonly database: DatabaseService) {}

  async load(): Promise<{ enabled: boolean; tokenCiphertext: string | null }> {
    const rows = await this.database.db
      .select({ enabled: bot_settings.enabled, tokenCiphertext: bot_settings.token_ciphertext })
      .from(bot_settings)
      .where(eq(bot_settings.id, 1))
      .limit(1);
    const row = rows[0];
    return {
      enabled: row?.enabled ?? false,
      tokenCiphertext: row?.tokenCiphertext ?? null,
    };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.database.db
      .insert(bot_settings)
      .values({ id: 1, enabled })
      .onConflictDoUpdate({ target: bot_settings.id, set: { enabled } });
  }

  async setToken(ciphertext: string): Promise<void> {
    await this.database.db
      .insert(bot_settings)
      .values({ id: 1, token_ciphertext: ciphertext })
      .onConflictDoUpdate({ target: bot_settings.id, set: { token_ciphertext: ciphertext } });
  }
}

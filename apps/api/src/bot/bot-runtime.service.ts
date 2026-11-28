import type { INestApplicationContext } from '@nestjs/common';
import {
  BadRequestException,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityType, Client } from 'discord.js';
import { DEFAULT_BOT_STATUS_MESSAGE } from '../database/schema/bot-settings.js';
import { BotContextFactory } from './bot-context.factory.js';
import { BotSettingsStore } from './bot-settings.store.js';
import { BotTokenCipher } from './bot-token-cipher.js';

export type BotConnectionState = 'off' | 'connecting' | 'connected' | 'failed';

export interface BotStatus {
  desiredEnabled: boolean;
  tokenConfigured: boolean;
  connection: BotConnectionState;
  statusMessage: string;
  message?: string;
}

function discordFailureMessage(error: unknown, developmentGuildId?: string): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;

  if (code === 50001 || code === 50013 || code === 10004) {
    return developmentGuildId
      ? 'Discord could not register commands in the development guild. Check DISCORD_DEVELOPMENT_GUILD_ID and the bot installation permissions.'
      : 'Discord could not register commands. Check the bot installation permissions.';
  }
  if (code === 'TokenInvalid' || code === 'TOKEN_INVALID' || status === 401) {
    return 'Discord rejected the saved bot token. Replace it in Settings and retry.';
  }
  if (status === 429) {
    return 'Discord is rate limiting the bot. Wait a few minutes, then retry.';
  }
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN'
  ) {
    return 'Discord could not be reached. Check the network and retry.';
  }
  return 'Discord bot connection failed. Check the token and configuration, then retry.';
}

@Injectable()
export class BotRuntimeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private desiredEnabled = false;
  private tokenCiphertext: string | null = null;
  private statusMessage = DEFAULT_BOT_STATUS_MESSAGE;
  private connection: BotConnectionState = 'off';
  private message: string | undefined;
  private context: INestApplicationContext | null = null;
  private startup: AbortController | null = null;
  private reconciliation: Promise<void> = Promise.resolve();

  constructor(
    private readonly settings: BotSettingsStore,
    private readonly cipher: BotTokenCipher,
    private readonly contextFactory: BotContextFactory,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const saved = await this.settings.load();
      this.desiredEnabled = saved.enabled;
      this.tokenCiphertext = saved.tokenCiphertext;
      this.statusMessage = saved.statusMessage;
    } catch {
      this.connection = 'failed';
      this.message = 'Discord bot settings could not be loaded';
      return;
    }

    if (this.desiredEnabled) {
      setImmediate(() => {
        void this.reconcileSerial().catch(() => undefined);
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.startup?.abort();
    await this.enqueue(async () => {
      try {
        await this.closeContext();
        this.connection = 'off';
        this.message = undefined;
      } catch {
        this.connection = 'failed';
        this.message = 'Discord bot did not stop cleanly';
      }
    });
  }

  async status(): Promise<BotStatus> {
    return {
      desiredEnabled: this.desiredEnabled,
      tokenConfigured: Boolean(this.tokenCiphertext),
      connection: this.connection,
      statusMessage: this.statusMessage,
      ...(this.message ? { message: this.message } : {}),
    };
  }

  async setStatusMessage(statusMessage: string): Promise<BotStatus> {
    const trimmed = statusMessage.trim();
    if (!trimmed) throw new BadRequestException('Status message is required');
    if (trimmed.length > 128) {
      throw new BadRequestException('Status message must be 128 characters or fewer');
    }

    await this.settings.setStatusMessage(trimmed);
    this.statusMessage = trimmed;
    this.publishStatus(trimmed);
    return this.status();
  }

  async setEnabled(enabled: boolean): Promise<BotStatus> {
    if (enabled && !this.tokenCiphertext) {
      throw new BadRequestException('Save a Discord bot token before enabling the bot');
    }

    await this.settings.setEnabled(enabled);
    this.desiredEnabled = enabled;
    if (!enabled) this.startup?.abort();
    return this.reconcileSerial();
  }

  async replaceToken(token: string): Promise<BotStatus> {
    if (!token.trim()) throw new BadRequestException('Discord bot token must not be blank');

    const ciphertext = this.cipher.encrypt(token.trim());
    await this.settings.setToken(ciphertext);
    this.tokenCiphertext = ciphertext;
    this.startup?.abort();
    return this.reconcileSerial(true);
  }

  private reconcileSerial(forceRestart = false): Promise<BotStatus> {
    return this.enqueue(() => this.reconcile(forceRestart)).then(() => this.status());
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const next = this.reconciliation.then(work);
    this.reconciliation = next.catch(() => undefined);
    return next;
  }

  private async reconcile(forceRestart: boolean): Promise<void> {
    if (!this.desiredEnabled) {
      try {
        await this.closeContext();
        this.connection = 'off';
        this.message = undefined;
      } catch {
        this.connection = 'failed';
        this.message = 'Discord bot did not stop cleanly';
      }
      return;
    }

    if (!this.tokenCiphertext) {
      this.connection = 'failed';
      this.message = 'Save a Discord bot token before enabling the bot';
      return;
    }

    if (forceRestart) {
      try {
        await this.closeContext();
      } catch {
        this.connection = 'failed';
        this.message = 'Discord bot did not stop cleanly';
        return;
      }
    }
    if (this.context) {
      this.connection = 'connected';
      this.message = undefined;
      return;
    }

    this.connection = 'connecting';
    this.message = undefined;
    const ciphertext = this.tokenCiphertext;
    const developmentGuildId =
      this.config.get<string>('DISCORD_DEVELOPMENT_GUILD_ID')?.trim() || undefined;
    const startup = new AbortController();
    this.startup = startup;
    let startedContext: INestApplicationContext | null = null;
    let failedBeforeContextWasReturned = false;
    const reportClientError = (error: unknown) => {
      if (startedContext) {
        if (this.context !== startedContext && this.startup !== startup) return;
      } else if (this.startup !== startup) {
        return;
      }
      this.connection = 'failed';
      this.message = discordFailureMessage(error, developmentGuildId);
      if (!startedContext) {
        failedBeforeContextWasReturned = true;
        return;
      }
      const failedContext = startedContext;
      void this.enqueue(async () => {
        if (this.context !== failedContext) return;
        this.context = null;
        try {
          await failedContext.close();
        } catch {
          // The connection remains failed; do not expose Discord's raw error.
        }
      });
    };
    let token: string;
    try {
      token = this.cipher.decrypt(ciphertext);
    } catch (error) {
      this.startup = null;
      this.connection = 'failed';
      this.message =
        error instanceof Error && error.message.includes('BOT_SETTINGS_ENCRYPTION_KEY')
          ? 'Configure BOT_SETTINGS_ENCRYPTION_KEY to use the Discord bot'
          : 'The saved Discord bot token could not be decrypted';
      return;
    }

    try {
      const context = await this.contextFactory.start(
        token,
        developmentGuildId,
        startup.signal,
        reportClientError,
      );
      startedContext = context;
      if (this.startup === startup) this.startup = null;
      if (failedBeforeContextWasReturned) {
        await context.close();
        this.connection = 'failed';
        return;
      }
      if (!this.desiredEnabled || this.tokenCiphertext !== ciphertext) {
        await context.close();
        return;
      }
      this.context = context;
      this.connection = 'connected';
    } catch (error) {
      if (this.startup === startup) this.startup = null;
      if (!this.desiredEnabled || this.tokenCiphertext !== ciphertext) return;
      this.connection = 'failed';
      this.message = discordFailureMessage(error, developmentGuildId);
    }
  }

  private publishStatus(statusMessage: string): void {
    if (!this.context || this.connection !== 'connected') return;
    try {
      const client = this.context.get(Client, { strict: false });
      client.user?.setActivity(statusMessage, { type: ActivityType.Custom });
    } catch {
      // A closing context should not fail the saved setting.
    }
  }

  private async closeContext(): Promise<void> {
    const context = this.context;
    this.context = null;
    if (context) await context.close();
  }
}

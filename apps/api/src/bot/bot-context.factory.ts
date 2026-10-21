import type { INestApplicationContext } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Client } from 'discord.js';
import { botContextModuleForToken } from './bot-context.module.js';

@Injectable()
export class BotContextFactory {
  private readonly logger = new Logger(BotContextFactory.name);

  async start(
    token: string,
    developmentGuildId?: string,
    signal?: AbortSignal,
    onError?: () => void,
  ): Promise<INestApplicationContext> {
    // logger: false calls Logger.overrideLogger(false), which clears the
    // process-wide logger and silences the parent API as well as this context.
    const context = await NestFactory.createApplicationContext(
      botContextModuleForToken(token, developmentGuildId),
      { abortOnError: false },
    );
    let login: Promise<string> | undefined;
    try {
      if (signal?.aborted) throw new Error('Discord bot startup was cancelled');
      const client = context.get(Client, { strict: false });
      // discord.js uses captureRejections, so a rejected async event handler is
      // re-emitted as `error`. EventEmitter throws when that event has no listener.
      client.on('error', (error: unknown) => {
        const detail = error instanceof Error ? error.message : 'unknown Discord client error';
        this.logger.error(`Discord client error: ${detail}`);
        try {
          onError?.();
        } catch {
          // Keep Discord client errors from escaping into the API process.
        }
      });
      login = client.login(token);
      if (signal) {
        let abortListener: (() => void) | undefined;
        try {
          await Promise.race([
            login,
            new Promise<never>((_resolve, reject) => {
              abortListener = () => {
                reject(new Error('Discord bot startup was cancelled'));
              };
              signal.addEventListener('abort', abortListener, { once: true });
            }),
          ]);
          if (signal.aborted) throw new Error('Discord bot startup was cancelled');
        } finally {
          if (abortListener) signal.removeEventListener('abort', abortListener);
        }
      } else {
        await login;
      }
      return context;
    } catch (error) {
      // discord.js login cannot be cancelled while its gateway discovery request
      // is in flight. Wait for it to settle before closing, or it can open a
      // gateway connection after the context has already been destroyed.
      if (signal?.aborted) {
        await login?.catch(() => undefined);
      } else {
        const detail = error instanceof Error ? error.message : 'unknown error';
        this.logger.error(`Discord bot startup failed: ${detail}`);
      }
      await context.close();
      throw error;
    }
  }
}

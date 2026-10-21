import type { INestApplicationContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Client } from 'discord.js';
import { botContextModuleForToken } from './bot-context.module.js';

@Injectable()
export class BotContextFactory {
  async start(
    token: string,
    developmentGuildId?: string,
    signal?: AbortSignal,
    onError?: () => void,
  ): Promise<INestApplicationContext> {
    const context = await NestFactory.createApplicationContext(
      botContextModuleForToken(token, developmentGuildId),
      { abortOnError: false, logger: false },
    );
    let login: Promise<string> | undefined;
    try {
      if (signal?.aborted) throw new Error('Discord bot startup was cancelled');
      const client = context.get(Client, { strict: false });
      // discord.js uses captureRejections, so a rejected async event handler is
      // re-emitted as `error`. EventEmitter throws when that event has no listener.
      client.on('error', () => {
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
      if (signal?.aborted) await login?.catch(() => undefined);
      await context.close();
      throw error;
    }
  }
}

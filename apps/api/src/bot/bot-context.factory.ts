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
  ): Promise<INestApplicationContext> {
    const context = await NestFactory.createApplicationContext(
      botContextModuleForToken(token, developmentGuildId),
      { abortOnError: false, logger: false },
    );
    try {
      if (signal?.aborted) throw new Error('Discord bot startup was cancelled');
      const client = context.get(Client, { strict: false });
      const login = client.login(token);
      if (signal) {
        let abortListener: (() => void) | undefined;
        try {
          await Promise.race([
            login,
            new Promise<never>((_resolve, reject) => {
              abortListener = () => reject(new Error('Discord bot startup was cancelled'));
              signal.addEventListener('abort', abortListener, { once: true });
            }),
          ]);
        } finally {
          if (abortListener) signal.removeEventListener('abort', abortListener);
        }
      } else {
        await login;
      }
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  }
}

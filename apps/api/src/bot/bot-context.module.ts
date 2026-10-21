import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntentsBitField } from 'discord.js';
import { NecordModule } from 'necord';
import { DiscordCommandsModule } from './discord-commands.module.js';
import './rebind-necord-discovery.js';

class DeferredLoginNecordModule extends NecordModule {
  override async onApplicationBootstrap(): Promise<string> {
    return '';
  }
}

@Module({})
export class BotContextModule {}

export function botContextModuleForToken(
  token: string,
  developmentGuildId?: string,
): DynamicModule {
  return {
    module: BotContextModule,
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      DeferredLoginNecordModule.forRoot({
        token,
        intents: [IntentsBitField.Flags.Guilds],
        development: developmentGuildId ? [developmentGuildId] : undefined,
      }),
      DiscordCommandsModule,
    ],
  };
}

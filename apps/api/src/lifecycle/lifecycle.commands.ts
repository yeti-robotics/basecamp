import { Injectable } from "@nestjs/common";
import { MessageFlags } from "discord.js";
import { Context, SlashCommand, type SlashCommandContext } from "necord";
import { LifecycleService } from "./lifecycle.service.js";

@Injectable()
export class LifecycleCommands {

  constructor(
  private readonly service: LifecycleService,
) {}

  @SlashCommand({
    name: "ping",
    description: "Ping the bot",
    dmPermission: true,
  })
  public async onPing(@Context() [interaction]: SlashCommandContext) {
    return interaction.reply({
      content: `Pong! ${interaction.client.ws.ping}ms`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  @SlashCommand({
    name: "greet",
    description: "Talk to the database",
    dmPermission: true,
  })
  public async onGreet(@Context() [interaction]: SlashCommandContext) {
    const connected = await this.service.checkConnection();
    let message: string;

    switch (connected) {
      case true:
        message = `Hello, ${interaction.user.username}! The database connection is working.`;
        break;
      case false:
        message = `Sorry, ${interaction.user.username}! The database connection is not working.`;
        break;
      default:
        message = `Sorry, ${interaction.user.username}! The database connection checker failed to determine the connection status.`;
    }

    return interaction.reply({
      content: message,
      flags: [MessageFlags.Ephemeral],
    });
  }
}
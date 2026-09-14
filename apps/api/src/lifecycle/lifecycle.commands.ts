import { Injectable } from "@nestjs/common";
import { MessageFlags } from "discord.js";
import { Context, SlashCommand, type SlashCommandContext } from "necord";
import { DatabaseService } from "./lifecycle.service.js";

@Injectable()
export class LifecycleCommands {
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
    const connected = await new DatabaseService().checkConnection();

    if (connected) {
      return interaction.reply({
        content: `Hello, ${interaction.user.username}! The database connection is working.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    return interaction.reply({
      content: `Hello, ${interaction.user.username}! The database connection is not working.`,
      flags: [MessageFlags.Ephemeral],
    });
  }
}
import { Command, Handler, InteractionEvent } from "@discord-nestjs/core";
import { ChatInputCommandInteraction } from "discord.js";

@Command({name: "handbook", description: "Ask the handbook a question"})
export class HandbookCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Handbook command");
    }
}
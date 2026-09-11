import { Injectable } from "@nestjs/common/decorators/core/injectable.decorator";
import { SlashCommand, Context, type SlashCommandContext } from "necord";


@Injectable()
export class HandbookCommands {
    @SlashCommand({name: "handbook", description: "Ask the handbook a question"})
    async HandbookCommand(@Context() [interaction]: SlashCommandContext) {
        await interaction.reply("Handbook command");
    }
}
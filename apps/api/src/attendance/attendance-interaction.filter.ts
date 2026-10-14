import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { MessageFlags } from 'discord.js';
import { NecordArgumentsHost, type SlashCommandContext } from 'necord';

@Catch(BadRequestException, ThrottlerException)
export class AttendanceInteractionFilter implements ExceptionFilter {
  catch(error: BadRequestException | ThrottlerException, host: ArgumentsHost) {
    const [interaction] = NecordArgumentsHost.create(host).getContext<SlashCommandContext>();
    const content =
      error instanceof ThrottlerException
        ? 'Too many attempts. Wait a minute and try again.'
        : 'Enter the four digits shown on the facility display.';
    if (interaction.deferred || interaction.replied) return interaction.editReply({ content });
    return interaction.reply({ content, flags: [MessageFlags.Ephemeral] });
  }
}

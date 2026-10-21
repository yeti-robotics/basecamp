import { Body, Controller, Get, Header, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { SessionGuard } from '../access/session.guard.js';
import { TeamAdminGuard } from '../access/team-admin.guard.js';
import { SetBotEnabledDto, SetBotStatusMessageDto, SetBotTokenDto } from './bot.dto.js';
import { BotRuntimeService } from './bot-runtime.service.js';

const writeBody = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });

@Controller('api/settings/bot')
@UseGuards(SessionGuard, TeamAdminGuard)
export class BotController {
  constructor(private readonly runtime: BotRuntimeService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  getStatus() {
    return this.runtime.status();
  }

  @Put('token')
  @Header('Cache-Control', 'private, no-store')
  setToken(@Body(writeBody) body: SetBotTokenDto) {
    return this.runtime.replaceToken(body.token);
  }

  @Put('enabled')
  @Header('Cache-Control', 'private, no-store')
  setEnabled(@Body(writeBody) body: SetBotEnabledDto) {
    return this.runtime.setEnabled(body.enabled);
  }

  @Put('status-message')
  @Header('Cache-Control', 'private, no-store')
  setStatusMessage(@Body(writeBody) body: SetBotStatusMessageDto) {
    return this.runtime.setStatusMessage(body.statusMessage);
  }
}

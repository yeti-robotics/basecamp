import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard, type AuthenticatedRequest } from '../access/session.guard.js';
import { type EventInput, type EventUpdate, EventsService } from './events.service.js';

@Controller('api/events')
@UseGuards(SessionGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list() {
    return this.events.list();
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  async create(@Req() request: Request, @Body() input: EventInput) {
    return this.events.create(input, this.actorId(request));
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  async update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() input: EventUpdate,
  ) {
    return this.events.update(id, input, this.actorId(request));
  }

  @Post(':id/cancel')
  @Header('Cache-Control', 'private, no-store')
  async cancel(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return this.events.cancel(id, this.actorId(request));
  }

  private actorId(request: Request): string {
    const userId = (request as AuthenticatedRequest).authUserId;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }
}

import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AUTH } from '../auth/auth.module.js';
import type { Auth } from '../auth.js';
import { type SeasonInput, SeasonsService } from './seasons.service.js';

@Controller('api/seasons')
export class SeasonsController {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly seasons: SeasonsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() request: Request) {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();
    return this.seasons.viewFor(session.user.id);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  async create(@Req() request: Request, @Body() input: SeasonInput) {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();
    return this.seasons.create(input, session.user.id);
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  async update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() input: SeasonInput,
  ) {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) throw new UnauthorizedException();
    return this.seasons.update(id, input, session.user.id);
  }
}

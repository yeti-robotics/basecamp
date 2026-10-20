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
} from '@nestjs/common';
import type { Request } from 'express';
import { MemberContextService } from '../roster/member-context.service.js';
import { type SeasonInput, SeasonsService } from './seasons.service.js';

@Controller('api/seasons')
export class SeasonsController {
  constructor(
    private readonly memberContext: MemberContextService,
    private readonly seasons: SeasonsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() request: Request) {
    const userId = await this.memberContext.authenticate(request.headers);
    return this.seasons.viewFor(userId);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  async create(@Req() request: Request, @Body() input: SeasonInput) {
    const userId = await this.memberContext.authenticate(request.headers);
    return this.seasons.create(input, userId);
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  async update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() input: SeasonInput,
  ) {
    const userId = await this.memberContext.authenticate(request.headers);
    return this.seasons.update(id, input, userId);
  }
}

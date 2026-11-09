import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { type AuthenticatedRequest, SessionGuard } from '../access/session.guard.js';
import {
  type AttendanceRecordFilter,
  type AttendanceRecordInput,
  AttendanceRecordsService,
  type AttendanceRecordUpdate,
} from './attendance-records.service.js';

@Controller('api/attendance/records')
@UseGuards(SessionGuard)
export class AttendanceRecordsController {
  constructor(private readonly records: AttendanceRecordsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() request: Request, @Query() filter: AttendanceRecordFilter) {
    return this.records.list(this.actorId(request), filter);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  async create(@Req() request: Request, @Body() input: AttendanceRecordInput) {
    return this.records.create(this.actorId(request), input);
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  async update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() input: AttendanceRecordUpdate,
  ) {
    return this.records.update(this.actorId(request), id, input);
  }

  @Get(':id/history')
  @Header('Cache-Control', 'private, no-store')
  async history(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return this.records.history(this.actorId(request), id);
  }

  private actorId(request: Request): string {
    const userId = (request as AuthenticatedRequest).authUserId;
    if (!userId) throw new UnauthorizedException();
    return userId;
  }
}

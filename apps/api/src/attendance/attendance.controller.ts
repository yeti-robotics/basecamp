import { Controller, Get, Header, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MemberContextService } from '../roster/member-context.service.js';
import { AttendanceService } from './attendance.service.js';

@Controller('api/attendance')
export class AttendanceController {
  constructor(
    private readonly memberContext: MemberContextService,
    private readonly attendance: AttendanceService,
  ) {}

  @Get('overview')
  @Header('Cache-Control', 'private, no-store')
  async overview(@Req() request: Request) {
    const userId = await this.memberContext.authenticate(request.headers);
    return this.attendance.overview(userId);
  }
}

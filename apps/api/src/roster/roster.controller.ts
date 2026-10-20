import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';
import { MemberContextService } from './member-context.service.js';
import { RosterService } from './roster.service.js';

@Controller('api/roster')
export class RosterController {
  constructor(
    private readonly memberContext: MemberContextService,
    private readonly authorization: SeasonAuthorizationService,
    private readonly roster: RosterService,
  ) {}

  @Get('current')
  @Header('Cache-Control', 'private, no-store')
  async current(@Req() request: Request, @Query('includeRemoved') includeRemoved?: string) {
    const userId = await this.memberContext.authenticate(request.headers);
    const access = await this.authorization.accessFor(userId);
    if (!access.canView)
      throw new ForbiddenException('Roster access is limited to Team Admins and Mentors');
    if (includeRemoved === 'true' && !access.canManage) {
      throw new ForbiddenException('Only Team Admins can view removed members');
    }
    const [roster, seasons] = await Promise.all([
      this.roster.currentRoster(includeRemoved === 'true'),
      access.canManage ? this.roster.listSeasons() : Promise.resolve([]),
    ]);
    return { ...roster, canManage: access.canManage, seasons };
  }

  @Get('seasons/:seasonId')
  @Header('Cache-Control', 'private, no-store')
  async season(
    @Req() request: Request,
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Query('includeRemoved') includeRemoved?: string,
  ) {
    const userId = await this.memberContext.authenticate(request.headers);
    const access = await this.authorization.accessFor(userId);
    if (!access.canManage) throw new ForbiddenException('Only Team Admins can view past rosters');
    return this.roster.seasonRoster(seasonId, includeRemoved === 'true');
  }

  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  async me(@Req() request: Request) {
    const userId = await this.memberContext.authenticate(request.headers);
    const membership = await this.roster.getOwnCurrent(userId, new Date());
    if (!membership) return null;
    return {
      id: membership.id,
      userId: membership.user_id,
      role: membership.role,
      studentExperience: membership.student_experience,
      state: membership.state,
      joinedAt: membership.joined_at,
      removedAt: membership.removed_at,
    };
  }
}

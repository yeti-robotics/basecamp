import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';
import { MemberContextService } from './member-context.service.js';
import { type MembershipCorrection, RosterService } from './roster.service.js';

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

  @Patch('members/:id')
  @Header('Cache-Control', 'private, no-store')
  async updateCurrent(
    @Req() request: Request,
    @Param('id', ParseIntPipe) membershipId: number,
    @Body() input: MembershipCorrection,
  ) {
    const actorId = await this.adminActor(request);
    return this.roster.updateCurrentMember(membershipId, input, actorId);
  }

  @Patch('seasons/:seasonId/members/:id')
  @Header('Cache-Control', 'private, no-store')
  async updateSeason(
    @Req() request: Request,
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Param('id', ParseIntPipe) membershipId: number,
    @Body() input: MembershipCorrection,
  ) {
    const actorId = await this.adminActor(request);
    return this.roster.updateSeasonMember(seasonId, membershipId, input, actorId);
  }

  @Post('members/:id/remove')
  @Header('Cache-Control', 'private, no-store')
  async remove(
    @Req() request: Request,
    @Param('id', ParseIntPipe) membershipId: number,
    @Body() body?: { reason?: string },
  ) {
    const actorId = await this.adminActor(request);
    return this.roster.removeCurrentMember(membershipId, actorId, body?.reason);
  }

  @Post('members/:id/restore')
  @Header('Cache-Control', 'private, no-store')
  async restore(@Req() request: Request, @Param('id', ParseIntPipe) membershipId: number) {
    const actorId = await this.adminActor(request);
    return this.roster.restoreCurrentMember(membershipId, actorId);
  }

  private async adminActor(request: Request): Promise<string> {
    const userId = await this.memberContext.authenticate(request.headers);
    const access = await this.authorization.accessFor(userId);
    if (!access.canManage) throw new ForbiddenException('Team Admin access is required');
    return userId;
  }
}

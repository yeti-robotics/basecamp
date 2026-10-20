import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { AccessService } from '../access/access.service.js';
import { AUTH } from '../auth/auth.module.js';
import type { Auth } from '../auth.js';
import { RosterService } from './roster.service.js';

@Injectable()
export class MemberContextService {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly roster: RosterService,
    private readonly access: AccessService,
  ) {}

  async authenticate(headers: IncomingHttpHeaders): Promise<string> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) });
    if (!session) throw new UnauthorizedException();
    if (await this.access.isSuspended(session.user.id)) throw new UnauthorizedException();
    await this.roster.ensureCurrentMembership(session.user.id, new Date());
    return session.user.id;
  }
}

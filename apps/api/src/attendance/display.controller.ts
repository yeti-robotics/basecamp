import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsNotEmpty, IsString } from 'class-validator';
import type { Request, Response } from 'express';
import { DisplaySessionService, readCookie } from './display-session.service.js';

const sessionLifetimeMs = 43_200_000;
const cookieName = 'attendance_display';

class DisplayLoginDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}

@Controller('api/attendance-display')
export class DisplayController {
  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ attendance: { limit: 5, ttl: 900_000 } })
  login(@Body(new ValidationPipe()) body: DisplayLoginDto, @Res() response: Response) {
    if (!this.sessions.checkPassword(body.password)) throw new UnauthorizedException();
    response.cookie(cookieName, this.sessions.create(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionLifetimeMs,
      path: '/',
    });
    return response.status(204).send();
  }

  @Get('seed')
  seed(@Req() request: Request, @Res() response: Response) {
    const token = readCookie(request.headers.cookie, cookieName);
    const expiresAt = token && this.sessions.verify(token);
    if (!expiresAt) throw new UnauthorizedException();
    response.setHeader('Cache-Control', 'no-store');
    return response.json({
      secret: this.config.getOrThrow<string>('ATTENDANCE_TOTP_SECRET'),
      expiresAt,
    });
  }

  @Post('logout')
  logout(@Res() response: Response) {
    response.clearCookie(cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return response.status(204).send();
  }
}

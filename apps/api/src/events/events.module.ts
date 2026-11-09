import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [AccessModule, AuthModule, DatabaseModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}

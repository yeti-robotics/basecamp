import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { HandbookModule } from './handbook/handbook.module.js';
import { PingModule } from './ping/ping.module.js';

@Module({
  imports: [AttendanceModule, PingModule, HandbookModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

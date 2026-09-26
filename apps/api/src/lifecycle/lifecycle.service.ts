import { Injectable, Logger } from "@nestjs/common";
import { ActivityType } from "discord.js";
import { sql } from "drizzle-orm";
import { Context, type ContextOf, Once } from "necord";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(private readonly database: DatabaseService) {}

  @Once("clientReady")
  public async onReady(@Context() [client]: ContextOf<"clientReady">): Promise<void> {
    this.logger.log(`Bot logged in as ${client.user.username}`);

    client.user.setActivity("YETI ARE YOU READY?", { type: ActivityType.Custom });
  }

  public async checkConnection(): Promise<boolean> {
    try {
      await this.database.db.execute(sql`SELECT 1 AS connected`);
      return true;
    } catch {
      return false;
    }
  }
}

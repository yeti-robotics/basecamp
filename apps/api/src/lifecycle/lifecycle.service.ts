import { Injectable, Logger } from "@nestjs/common";
import { ActivityType } from "discord.js";
import { sql } from "drizzle-orm/sql/sql";
import { Context, type ContextOf, Once } from "necord";
import { db } from "src/auth.js";

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  @Once("clientReady")
  public async onReady(@Context() [client]: ContextOf<"clientReady">): Promise<void> {
    this.logger.log(`Bot logged in as ${client.user.username}`);

    client.user.setActivity("YETI ARE YOU READY?", { type: ActivityType.Custom });
  }
}

@Injectable()
export class DatabaseService {
  async checkConnection(): Promise<boolean> {
    try {
      await db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }
}
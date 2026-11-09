import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { eventHourCategory, eventType } from '../database/schema/enums.js';
import { events } from '../database/schema/events.js';
import { seasons } from '../database/schema/seasons.js';
import { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';

type EventType = (typeof eventType.enumValues)[number];
type EventHourCategory = (typeof eventHourCategory.enumValues)[number];

export interface EventInput {
  seasonId: number;
  name: string;
  description?: string | null;
  location: string;
  startsAt: string;
  endsAt: string;
  eventType: EventType;
  hourCategory: EventHourCategory;
}

export type EventUpdate = Partial<EventInput>;

type NormalizedEvent = {
  seasonId: number;
  name: string;
  description: string | null;
  location: string;
  startsAt: Date;
  endsAt: Date;
  eventType: EventType;
  hourCategory: EventHourCategory;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authorization: SeasonAuthorizationService,
  ) {}

  async list() {
    return this.database.db
      .select({
        id: events.id,
        seasonId: events.season_id,
        seasonName: seasons.name,
        name: events.name,
        description: events.description,
        location: events.location,
        startsAt: events.starts_at,
        endsAt: events.ends_at,
        eventType: events.event_type,
        hourCategory: events.hour_category,
        status: events.status,
        createdBy: events.created_by,
        createdAt: events.created_at,
        updatedAt: events.updated_at,
      })
      .from(events)
      .innerJoin(seasons, eq(events.season_id, seasons.id))
      .orderBy(asc(events.starts_at), asc(events.id));
  }

  async create(input: EventInput, actorId: string) {
    await this.requireTeamAdmin(actorId);
    const event = this.normalizeCreate(input);
    await this.requireSeason(event.seasonId);

    const [created] = await this.database.db
      .insert(events)
      .values({
        season_id: event.seasonId,
        name: event.name,
        description: event.description,
        location: event.location,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        event_type: event.eventType,
        hour_category: event.hourCategory,
        created_by: actorId,
      })
      .returning({ id: events.id });
    if (!created) throw new Error('Event insert did not return a row');
    return this.findById(created.id);
  }

  async update(id: number, input: EventUpdate, actorId: string) {
    await this.requireTeamAdmin(actorId);
    const before = await this.findRawById(id);
    const update = this.normalizeUpdate(input, before);

    if (update.season_id !== undefined) await this.requireSeason(update.season_id);
    await this.database.db
      .update(events)
      .set({ ...update, updated_at: new Date() })
      .where(eq(events.id, id));
    return this.findById(id);
  }

  async cancel(id: number, actorId: string) {
    await this.requireTeamAdmin(actorId);
    const [cancelled] = await this.database.db
      .update(events)
      .set({ status: 'cancelled', updated_at: new Date() })
      .where(eq(events.id, id))
      .returning({ id: events.id });
    if (!cancelled) throw new NotFoundException('Event not found');
    return this.findById(id);
  }

  private async requireTeamAdmin(userId: string): Promise<void> {
    const access = await this.authorization.accessFor(userId);
    if (!access.canManage) throw new ForbiddenException('Team Admin access is required');
  }

  private async requireSeason(seasonId: number): Promise<void> {
    const [season] = await this.database.db
      .select({ id: seasons.id })
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .limit(1);
    if (!season) throw new NotFoundException('Season not found');
  }

  private async findById(id: number) {
    const [event] = await this.database.db
      .select({
        id: events.id,
        seasonId: events.season_id,
        seasonName: seasons.name,
        name: events.name,
        description: events.description,
        location: events.location,
        startsAt: events.starts_at,
        endsAt: events.ends_at,
        eventType: events.event_type,
        hourCategory: events.hour_category,
        status: events.status,
        createdBy: events.created_by,
        createdAt: events.created_at,
        updatedAt: events.updated_at,
      })
      .from(events)
      .innerJoin(seasons, eq(events.season_id, seasons.id))
      .where(eq(events.id, id))
      .limit(1);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async findRawById(id: number) {
    const [event] = await this.database.db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private normalizeCreate(input: EventInput): NormalizedEvent {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Event details are required');
    }
    const seasonId = this.validateSeasonId(input.seasonId);
    const name = this.requiredText(input.name, 'Name');
    const location = this.requiredText(input.location, 'Location');
    const description = this.optionalDescription(input.description);
    const startsAt = this.timestamp(input.startsAt, 'Start time');
    const endsAt = this.timestamp(input.endsAt, 'End time');
    if (endsAt <= startsAt) {
      throw new BadRequestException('End time must be after start time');
    }
    if (!eventType.enumValues.includes(input.eventType)) {
      throw new BadRequestException('Choose a valid event type');
    }
    if (!eventHourCategory.enumValues.includes(input.hourCategory)) {
      throw new BadRequestException('Choose a valid hour contribution');
    }
    return {
      seasonId,
      name,
      description,
      location,
      startsAt,
      endsAt,
      eventType: input.eventType,
      hourCategory: input.hourCategory,
    };
  }

  private normalizeUpdate(
    input: EventUpdate,
    before: typeof events.$inferSelect,
  ): Partial<typeof events.$inferInsert> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Event changes are required');
    }
    const update: Partial<typeof events.$inferInsert> = {};
    if (input.seasonId !== undefined) update.season_id = this.validateSeasonId(input.seasonId);
    if (input.name !== undefined) update.name = this.requiredText(input.name, 'Name');
    if (input.description !== undefined)
      update.description = this.optionalDescription(input.description);
    if (input.location !== undefined)
      update.location = this.requiredText(input.location, 'Location');
    if (input.eventType !== undefined) {
      if (!eventType.enumValues.includes(input.eventType)) {
        throw new BadRequestException('Choose a valid event type');
      }
      update.event_type = input.eventType;
    }
    if (input.hourCategory !== undefined) {
      if (!eventHourCategory.enumValues.includes(input.hourCategory)) {
        throw new BadRequestException('Choose a valid hour contribution');
      }
      update.hour_category = input.hourCategory;
    }

    const startsAt =
      input.startsAt === undefined
        ? before.starts_at
        : this.timestamp(input.startsAt, 'Start time');
    const endsAt =
      input.endsAt === undefined ? before.ends_at : this.timestamp(input.endsAt, 'End time');
    if (endsAt <= startsAt) {
      throw new BadRequestException('End time must be after start time');
    }
    if (input.startsAt !== undefined) update.starts_at = startsAt;
    if (input.endsAt !== undefined) update.ends_at = endsAt;
    if (Object.keys(update).length === 0)
      throw new BadRequestException('Event changes are required');
    return update;
  }

  private validateSeasonId(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new BadRequestException('Choose a valid season');
    }
    return value;
  }

  private requiredText(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private optionalDescription(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value !== 'string') throw new BadRequestException('Description must be text');
    return value.trim() || null;
  }

  private timestamp(value: unknown, field: string): Date {
    if (typeof value !== 'string') throw new BadRequestException(`${field} is required`);
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException(`${field} must be a valid timestamp`);
    }
    return timestamp;
  }
}

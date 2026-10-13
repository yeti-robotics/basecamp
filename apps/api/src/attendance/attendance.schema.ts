import { z } from "zod";

export const AttendanceSchema = z.object({
  id: z.int().min(1),  
  userId: z.string().length(32),
  checkedInAt: z.iso.datetime(),
  checkedOutAt: z.iso.datetime().nullable(),
  category: z.enum(["meeting", "outreach"]),
  eventId: z.int().min(1).nullable(),
});

export type Attendance = z.infer<typeof AttendanceSchema>;
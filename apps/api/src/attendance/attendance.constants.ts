/** Minimum gap (6 hours) required before a cross-day sign-in auto-credits a forgotten sign-out */
export const STALE_SIGNIN_MIN_HOURS_MS = 1000 * 60 * 60 * 6;

/** Default credit given when user forgot to sign out (1.5 hours) */
export const FORGOT_SIGNOUT_CREDIT_MS = 1000 * 60 * 60 * 1.5;

/** Time after which a sign-out attempt becomes a new sign-in (18 hours) */
export const EXPIRED_SESSION_THRESHOLD_MS = 1000 * 60 * 60 * 18;

/** Milliseconds per hour for calculations */
export const MS_PER_HOUR = 1000 * 60 * 60;

/** Team name mappings */
export const TEAM_NAMES = {
  OFFICIAL_NAME: "YETI Robotics",
  DEV: "Dev",
} as const;

/** Default limit for leaderboard queries */
export const DEFAULT_LEADERBOARD_LIMIT = 5;

/** Cache TTL for attendance sheet reads (15 minutes) */
export const ATTENDANCE_CACHE_TTL_MS = 900_000;
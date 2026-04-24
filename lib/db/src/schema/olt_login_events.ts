import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Permanent audit record of OLT CLI login activity.
 *
 * The OLT itself only retains a bounded `display security log` buffer that
 * resets on reboot. We mirror events into this table on every poll of
 * `/olt/user-logins` so admins can answer long-term questions like "who
 * signed in last month?" or "show every failed login from this IP" even
 * after the device has rotated its log.
 *
 * Dedup key: (ownerUserId, host, username, loginAtRaw, channel) — matches
 * the spec's "(host, username, login_time, channel)" plus the owner so
 * each AppUser sees only events ingested under their session.
 *
 * NOTE: every column in the dedup key is NOT NULL (channel uses an empty
 * string as the "unknown" sentinel) because Postgres treats NULL values
 * as distinct in a unique index — leaving any of them nullable would
 * silently allow duplicate rows on repeated polls.
 */
export const oltLoginEventsTable = pgTable(
  "olt_login_events",
  {
    id: serial("id").primaryKey(),
    /** Clerk user id of the AppUser whose session ingested the event */
    ownerUserId: text("owner_user_id").notNull(),
    /** OLT host (matches RouterProfile.host for cross-referencing) */
    host: text("host").notNull(),
    /** OLT-side CLI account name (NOT the AppUser) */
    username: text("username").notNull(),
    /** Source IP of the login attempt as reported by the OLT */
    sourceIp: text("source_ip"),
    /**
     * ssh / telnet / console / web / etc. Empty string means "unknown" —
     * never NULL, so it can participate in the dedup unique index.
     */
    channel: text("channel").notNull().default(""),
    /** Parsed login timestamp (null if device timestamp is unparseable) */
    loginAt: timestamp("login_at"),
    /** Original login timestamp string from the OLT (used for dedup) */
    loginAtRaw: text("login_at_raw").notNull().default(""),
    /** Parsed logout timestamp; null for active or failed sessions */
    logoutAt: timestamp("logout_at"),
    /** Original logout timestamp string from the OLT */
    logoutAtRaw: text("logout_at_raw"),
    /** "success" | "fail" — failed logins are always standalone rows */
    result: text("result").notNull().default("success"),
    /** When *we* first saw this event (server clock) */
    seenAt: timestamp("seen_at").notNull().defaultNow(),
    /** Most recent time we re-observed and updated this event */
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqEvent: uniqueIndex("olt_login_events_dedup_idx").on(
      t.ownerUserId,
      t.host,
      t.username,
      t.loginAtRaw,
      t.channel,
    ),
    byOwnerHost: index("olt_login_events_owner_host_idx").on(t.ownerUserId, t.host),
    byLoginAt: index("olt_login_events_login_at_idx").on(t.loginAt),
  }),
);

export type OltLoginEvent = typeof oltLoginEventsTable.$inferSelect;
export type InsertOltLoginEvent = typeof oltLoginEventsTable.$inferInsert;

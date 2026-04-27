import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Tracks "I've seen this" acknowledgements for OLT login alerts.
 *
 * Alerts themselves are computed on demand from `olt_login_events` (see the
 * `/olt/login-alerts` route). Each alert has a stable identity of
 * (kind, host, scopeKey) — for example ("ip_burst", "10.0.0.1", "203.0.113.5")
 * — and a moving `lastAt` watermark that is the timestamp of the most recent
 * failed event included in the burst.
 *
 * A row in this table records "the operator has dismissed every event up to
 * `watermarkAt` for this alert identity". The alert reappears on the OLT
 * Users page only when a *newer* event pushes the burst's `lastAt` past the
 * stored watermark, which means a fresh wave of failures arrived after the
 * dismissal — exactly the early-warning signal we want.
 *
 * Scope notes:
 *   - `host` is the OLT host (matches `RouterProfile.host`). Always set —
 *     alerts are never global across hosts.
 *   - `scopeKey` is the discriminator within the alert kind:
 *       ip_burst   → source IP
 *       user_burst → OLT-side username
 *       off_hours  → empty string (alert is per-host, not per-IP/user)
 *     Empty string is used as the "no scope" sentinel because Postgres
 *     treats NULL as distinct in a unique index — leaving it nullable would
 *     allow duplicate ack rows for the same off-hours alert.
 */
export const oltLoginAlertAcksTable = pgTable(
  "olt_login_alert_acks",
  {
    id: serial("id").primaryKey(),
    /** Clerk user id of the AppUser that dismissed the alert */
    ownerUserId: text("owner_user_id").notNull(),
    /** "ip_burst" | "user_burst" | "off_hours" */
    kind: text("kind").notNull(),
    /** OLT host the alert applies to */
    host: text("host").notNull().default(""),
    /** Source IP / username / "" — see file header */
    scopeKey: text("scope_key").notNull().default(""),
    /**
     * Timestamp of the latest event the dismissal covers. The alert
     * reappears once a newer matching event arrives.
     */
    watermarkAt: timestamp("watermark_at").notNull(),
    /** When the dismissal was recorded (server clock) */
    acknowledgedAt: timestamp("acknowledged_at").notNull().defaultNow(),
    /** Clerk user id of whoever clicked Dismiss (kept for audit) */
    acknowledgedBy: text("acknowledged_by"),
  },
  (t) => ({
    uniqAck: uniqueIndex("olt_login_alert_acks_dedup_idx").on(
      t.ownerUserId,
      t.kind,
      t.host,
      t.scopeKey,
    ),
  }),
);

export type OltLoginAlertAck = typeof oltLoginAlertAcksTable.$inferSelect;
export type InsertOltLoginAlertAck = typeof oltLoginAlertAcksTable.$inferInsert;

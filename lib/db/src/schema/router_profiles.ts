import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const routerProfilesTable = pgTable(
  "router_profiles",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    host: text("host").notNull(),
    port: integer("port"),
    username: text("username").notNull(),
    vendor: text("vendor").notNull().default("mikrotik"),
    identity: text("identity"),
    routerOs: text("router_os"),
    routerBoard: text("router_board"),
    notes: text("notes"),
    trendingData: jsonb("trending_data").$type<Record<string, unknown>>().default({}),
    firstConnectedAt: timestamp("first_connected_at").notNull().defaultNow(),
    lastConnectedAt: timestamp("last_connected_at").notNull().defaultNow(),
    connectionCount: integer("connection_count").notNull().default(1),
  },
  (t) => ({
    uniqOwnerHost: uniqueIndex("router_profiles_owner_host_idx").on(t.ownerUserId, t.host),
  }),
);

export type RouterProfile = typeof routerProfilesTable.$inferSelect;
export type InsertRouterProfile = typeof routerProfilesTable.$inferInsert;

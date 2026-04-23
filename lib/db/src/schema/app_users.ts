import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const appUsersTable = pgTable(
  "app_users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    email: text("email"),
    fullName: text("full_name"),
    // superuser: full admin including user management
    // read_write: can connect, run all read commands, run mutating commands
    // read_only: can connect and run read-only commands; mutations blocked
    role: text("role").notNull().default("read_only"),
    disabled: text("disabled").notNull().default("false"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqUsername: uniqueIndex("app_users_username_idx").on(t.username),
  }),
);

export type AppUser = typeof appUsersTable.$inferSelect;
export type InsertAppUser = typeof appUsersTable.$inferInsert;

export type AppUserRole = "superuser" | "read_write" | "read_only";

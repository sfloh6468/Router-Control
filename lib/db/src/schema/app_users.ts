import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const appUsersTable = pgTable("app_users", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  email: text("email"),
  fullName: text("full_name"),
  // superuser: full admin including user management
  // read_write: can connect, run all read commands, run mutating commands
  // read_only: can connect and run read-only commands; mutations blocked
  role: text("role").notNull().default("read_only"),
  disabled: text("disabled").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AppUser = typeof appUsersTable.$inferSelect;
export type InsertAppUser = typeof appUsersTable.$inferInsert;

export type AppUserRole = "superuser" | "read_write" | "read_only";

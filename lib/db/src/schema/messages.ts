import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export type MessageAttachment = {
  kind: "image" | "text";
  name: string;
  mediaType: string;
};

export type MessageToolCall = {
  id: string;
  command: string;
  status: "running" | "ok" | "error";
  output?: string;
  error?: string;
};

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  text: text("text").notNull().default(""),
  attachments: jsonb("attachments").$type<MessageAttachment[]>(),
  toolCalls: jsonb("tool_calls").$type<MessageToolCall[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DbMessage = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;

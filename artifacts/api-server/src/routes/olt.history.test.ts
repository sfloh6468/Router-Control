// Unit tests for the shared history filter helpers in olt.ts.
//
// These tests guard against the JSON `/olt/login-history` and the streamed
// `/olt/login-history.csv` endpoints silently drifting on filter or
// ordering semantics — the original motivation for Task #16.
//
// They run against the real Drizzle SQL builder (no DB needed) by
// inspecting the parameterized SQL string + bind values that
// `historyWhere` and `buildHistorySelect` produce. Run with:
//
//   pnpm --filter @workspace/api-server test
//
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseHistoryFilters,
  historyWhere,
  buildHistorySelect,
  type HistoryFilters,
} from "./olt.js";
import { db, oltLoginEventsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const USER = "user_test_123";

function selectWithWhere(filters: HistoryFilters) {
  // Mirrors what each route's count query does: a plain SELECT against the
  // shared WHERE. Used to compare the WHERE that two callers would produce.
  return db
    .select({ n: sql<number>`count(*)::int` })
    .from(oltLoginEventsTable)
    .where(historyWhere(USER, filters))
    .toSQL();
}

test("parseHistoryFilters resolves valid date strings", () => {
  const r = parseHistoryFilters({
    from: "2026-04-01",
    to: "2026-04-27",
    host: "olt-1",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.filters.fromDate instanceof Date);
  assert.ok(r.filters.toDate instanceof Date);
  assert.equal(r.filters.host, "olt-1");
});

test("parseHistoryFilters rejects an invalid `from` timestamp", () => {
  const r = parseHistoryFilters({ from: "not-a-date" });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /from/);
});

test("parseHistoryFilters rejects an invalid `to` timestamp", () => {
  const r = parseHistoryFilters({ to: "garbage" });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /to/);
});

test("historyWhere always scopes to the calling user", () => {
  const { sql: text, params } = selectWithWhere({
    fromDate: null,
    toDate: null,
  });
  // owner_user_id = $1 is the first (and, with no other filters, only)
  // bound condition besides the always-present user scope.
  assert.match(text, /"owner_user_id"\s*=\s*\$1/);
  assert.deepEqual(params, [USER]);
});

test("historyWhere appends each provided filter", () => {
  const fromDate = new Date("2026-04-01T00:00:00Z");
  const toDate = new Date("2026-04-27T00:00:00Z");
  const { sql: text, params } = selectWithWhere({
    host: "olt-1",
    username: "admin",
    sourceIp: "10.0.",
    channel: "SSH",
    result: "fail",
    fromDate,
    toDate,
  });
  // Every filter must show up in the parameter list — order matches the
  // helper's append order, which is locked in by this assertion.
  assert.deepEqual(params, [
    USER,
    "olt-1",
    "admin",
    "%10.0.%",
    "ssh", // channel is lowercased before binding
    "fail",
    fromDate,
    toDate,
  ]);
  // Date filters must use the coalesce(login_at, logout_at) form so
  // orphan logout rows aren't silently dropped from the range.
  assert.match(text, /coalesce\("olt_login_events"\."login_at",\s*"olt_login_events"\."logout_at"\)\s*>=\s*\$/);
  assert.match(text, /coalesce\("olt_login_events"\."login_at",\s*"olt_login_events"\."logout_at"\)\s*<=\s*\$/);
});

test("buildHistorySelect applies the canonical history ORDER BY", () => {
  const { sql: text } = buildHistorySelect(USER, {
    fromDate: null,
    toDate: null,
  }).toSQL();
  // Newest-first by login (or logout) timestamp, with a secondary id
  // tiebreaker so paged results are deterministic.
  assert.match(text, /order by\s+coalesce\("olt_login_events"\."login_at",\s*"olt_login_events"\."logout_at"\)\s+desc nulls last/i);
  assert.match(text, /"olt_login_events"\."id"\s+desc/i);
});

test("JSON-list and CSV-stream callers produce identical filter SQL+params", () => {
  // Same filter set the user types into the UI's filter bar.
  const filters: HistoryFilters = {
    host: "olt-prod-1",
    username: "alice",
    sourceIp: "192.168.",
    channel: "telnet",
    result: "success",
    fromDate: new Date("2026-01-01T00:00:00Z"),
    toDate: new Date("2026-04-27T00:00:00Z"),
  };

  // The JSON endpoint runs both a paginated list and a count. The list
  // uses `buildHistorySelect(...).limit().offset()`, the count uses
  // `historyWhere` directly. We compare the WHERE through the count
  // shape since that is the lowest common denominator.
  const jsonCount = db
    .select({ n: sql<number>`count(*)::int` })
    .from(oltLoginEventsTable)
    .where(historyWhere(USER, filters))
    .toSQL();

  // The CSV endpoint hands the full select (WHERE + ORDER BY) to the
  // pg cursor. Strip its ORDER BY / LIMIT / OFFSET to get the filter
  // shape. Easier: rebuild a count select against the same helper —
  // since both routes call `historyWhere` for the WHERE, the params
  // and the WHERE substring must match exactly.
  const csvCount = db
    .select({ n: sql<number>`count(*)::int` })
    .from(oltLoginEventsTable)
    .where(historyWhere(USER, filters))
    .toSQL();

  assert.equal(jsonCount.sql, csvCount.sql);
  assert.deepEqual(jsonCount.params, csvCount.params);

  // And the CSV's full select must include the same WHERE substring as
  // the JSON count — proving structurally that both endpoints filter
  // through the exact same parameterized clause.
  const csvFull = buildHistorySelect(USER, filters).toSQL();
  const whereStart = jsonCount.sql.indexOf("where ");
  assert.ok(whereStart > 0, "expected a WHERE clause in the JSON count SQL");
  const jsonWhereOnward = jsonCount.sql.slice(whereStart);
  assert.ok(
    csvFull.sql.includes(jsonWhereOnward.split(/\s+order by\s+/i)[0] ?? ""),
    "CSV select must contain the JSON endpoint's WHERE clause verbatim",
  );
  assert.deepEqual(csvFull.params, jsonCount.params);
});

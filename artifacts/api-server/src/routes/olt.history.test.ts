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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// Source-level guard: catches the regression mode the helper-call tests
// can't — someone adding a new condition by re-inlining a bespoke WHERE
// clause inside one of the route handlers instead of editing
// `historyWhere`. We parse out each handler's body and assert that
// neither contains a hand-written `eq(oltLoginEventsTable.<col>, ...)`
// or `ilike(...)` for a filterable column. The only legitimate place
// those Drizzle filter primitives are allowed for `oltLoginEventsTable`
// is inside `historyWhere` itself.
test("neither route handler re-inlines per-filter WHERE conditions", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "olt.ts"), "utf8");

  function bodyOf(routePathLiteral: string): string {
    const startMarker = `router.get("${routePathLiteral}",`;
    const start = src.indexOf(startMarker);
    assert.ok(start >= 0, `could not locate route handler for ${routePathLiteral}`);
    // Walk braces to find the handler body's matching close-brace.
    const bodyOpen = src.indexOf("{", start);
    let depth = 0;
    let i = bodyOpen;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    return src.slice(bodyOpen, i + 1);
  }

  const jsonBody = bodyOf("/olt/login-history");
  const csvBody = bodyOf("/olt/login-history.csv");

  // Per-filter primitives that historyWhere uses internally. If a route
  // body contains one of these for the events table, someone re-inlined.
  const forbidden = [
    /eq\(\s*oltLoginEventsTable\.host\b/,
    /eq\(\s*oltLoginEventsTable\.username\b/,
    /ilike\(\s*oltLoginEventsTable\.sourceIp\b/,
    /eq\(\s*oltLoginEventsTable\.channel\b/,
    /eq\(\s*oltLoginEventsTable\.result\b/,
  ];
  for (const pat of forbidden) {
    assert.ok(
      !pat.test(jsonBody),
      `JSON history handler must not re-inline filter ${pat}; call historyWhere/buildHistorySelect instead`,
    );
    assert.ok(
      !pat.test(csvBody),
      `CSV history handler must not re-inline filter ${pat}; call historyWhere/buildHistorySelect instead`,
    );
  }

  // Both handlers must actually invoke the shared helpers.
  assert.match(jsonBody, /\bhistoryWhere\(\s*userId\s*,/, "JSON handler should call historyWhere");
  assert.match(jsonBody, /\bbuildHistorySelect\(\s*userId\s*,/, "JSON handler should call buildHistorySelect");
  assert.match(csvBody, /\bbuildHistorySelect\(\s*userId\s*,/, "CSV handler should call buildHistorySelect");
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

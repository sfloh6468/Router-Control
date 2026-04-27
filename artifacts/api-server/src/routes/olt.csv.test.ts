// Backend tests covering the CSV export contract for
// `GET /olt/login-history.csv`.
//
// What we cover (per Task #18):
//   - 401 when unauthenticated.
//   - Correct `Content-Type` header (`text/csv; charset=utf-8`).
//   - `Content-Disposition` filename pattern
//     `olt-login-history__<host>__<from>_<to>.csv` with safe parts.
//   - Leading UTF-8 BOM (\uFEFF) so Excel renders unicode correctly.
//   - CRLF (`\r\n`) row terminators on every row.
//   - Formula-injection prefixing: any cell whose value starts with
//     `=`, `+`, `-`, `@`, `\t`, or `\r` must be prefixed with a
//     literal single-quote so spreadsheets treat it as text rather
//     than executing a formula. (OWASP CSV Injection / CWE-1236.)
//   - Same row set as the JSON endpoint for an identical filter
//     combination.
//
// Implementation notes:
//   - We mount `historyJsonHandler` and `historyCsvHandler` (the
//     extracted route handlers) on a small Express app with a stub
//     auth middleware that sets `req.userId` from a header. This
//     lets us exercise the real route logic — including streaming
//     output, header construction, and CSV serialization — without
//     a Clerk session.
//   - The 401 case uses a *separate* test app with no stub
//     middleware, so the handler's defensive `if (!userId)` path
//     fires (mirroring what would happen if the real
//     `requireUser` middleware ever stopped setting `req.userId`).
//   - All seeded rows are scoped to a unique throwaway owner ID
//     and torn down in a `finally` block, regardless of test
//     outcome.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response, type NextFunction } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import {
  csvField,
  safeFilenamePart,
  historyJsonHandler,
  historyCsvHandler,
} from "./olt.js";
import { db, oltLoginEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── pure unit tests for the helpers ─────────────────────────────────────

test("csvField returns empty string for null and undefined", () => {
  assert.equal(csvField(null), "");
  assert.equal(csvField(undefined), "");
});

test("csvField always quotes plain strings (consistent quoting policy)", () => {
  // Even values with no special characters get wrapped — keeps the
  // serialization rules simple and avoids leading-zero / scientific-notation
  // surprises in Excel.
  assert.equal(csvField("hello"), '"hello"');
  assert.equal(csvField("ssh"), '"ssh"');
});

test("csvField doubles embedded double-quotes", () => {
  assert.equal(csvField('a "quoted" word'), '"a ""quoted"" word"');
});

test("csvField preserves embedded commas and newlines inside quotes", () => {
  assert.equal(csvField("a,b,c"), '"a,b,c"');
  assert.equal(csvField("line1\nline2"), '"line1\nline2"');
});

test("csvField prefixes formula-leader values (=, +, -, @, \\t, \\r) with a single quote", () => {
  // Each of these would be interpreted as a formula by Excel / Google
  // Sheets / LibreOffice without the leading apostrophe. We assert the
  // apostrophe lands inside the quotes so the cell still parses as one
  // CSV field.
  for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
    const out = csvField(`${lead}cmd|calc`);
    assert.equal(out, `"'${lead}cmd|calc"`, `formula leader ${JSON.stringify(lead)} must be prefixed with a single quote`);
  }
});

test("csvField does not prefix values whose formula-leader is not the FIRST character", () => {
  // Defense-in-depth: the prefix only triggers on the leading character.
  // An interior `=` or `+` is harmless and must not be touched.
  assert.equal(csvField("a=b"), '"a=b"');
  assert.equal(csvField("ab+cd"), '"ab+cd"');
});

test("csvField stringifies numbers", () => {
  assert.equal(csvField(0), '"0"');
  assert.equal(csvField(42), '"42"');
});

test("safeFilenamePart replaces unsafe runs with `_`, caps at 64 chars, and falls back to `all` for empty input", () => {
  assert.equal(safeFilenamePart("olt-A.example.com"), "olt-A.example.com");
  assert.equal(safeFilenamePart("a/b\\c d?e"), "a_b_c_d_e");
  // The `|| "all"` fallback only kicks in when the result is the empty
  // string, i.e. the input was already empty before replacement (a
  // string of all-unsafe chars collapses to a single `_`, which is
  // truthy and is returned as-is).
  assert.equal(safeFilenamePart(""), "all");
  assert.equal(safeFilenamePart("////"), "_");
  // 80-char input -> truncated to 64.
  const long = "x".repeat(80);
  assert.equal(safeFilenamePart(long).length, 64);
});

// ─── integration tests against the real handlers + a stub auth app ───────

const HAS_DB = Boolean(process.env.DATABASE_URL);

// One throwaway owner used for the entire integration suite. Generated
// once at module load so all seeded rows share the same owner and the
// after() hook can clean them up in a single DELETE.
const TEST_OWNER = `test_csv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Two separate apps: one that simulates an authenticated user (sets
// req.userId from a header), one that mounts the route raw so the
// handler's `if (!userId)` 401 branch can fire.
function makeAuthedApp() {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const u = req.header("x-test-user-id");
    if (u) req.userId = u;
    next();
  });
  app.get("/api/olt/login-history", historyJsonHandler);
  app.get("/api/olt/login-history.csv", historyCsvHandler);
  return app;
}

function makeUnauthedApp() {
  const app = express();
  // Intentionally NO middleware: req.userId stays undefined.
  app.get("/api/olt/login-history.csv", historyCsvHandler);
  return app;
}

let authedServer: Server | null = null;
let unauthedServer: Server | null = null;
let authedBase = "";
let unauthedBase = "";

before(async () => {
  if (!HAS_DB) return;
  // Seed one row of each interesting kind. The formula-injection rows
  // use values that would be interpreted as formulas in Excel / Google
  // Sheets if the route forgot to prefix them.
  await db.insert(oltLoginEventsTable).values([
    {
      ownerUserId: TEST_OWNER,
      host: "olt-csv-A",
      username: "alice",
      sourceIp: "10.0.0.1",
      channel: "ssh",
      loginAtRaw: "2026-04-01 10:00:00",
      loginAt: new Date("2026-04-01T10:00:00Z"),
      result: "success",
    },
    {
      ownerUserId: TEST_OWNER,
      host: "olt-csv-A",
      username: "bob",
      sourceIp: "10.0.0.2",
      channel: "telnet",
      loginAtRaw: "2026-04-05 11:00:00",
      loginAt: new Date("2026-04-05T11:00:00Z"),
      result: "fail",
    },
    // Formula-leader payloads: the username and source_ip start with
    // characters that spreadsheets execute as formulas.
    {
      ownerUserId: TEST_OWNER,
      host: "olt-csv-A",
      username: "=2+5",
      sourceIp: "+CMD|calc",
      channel: "ssh",
      loginAtRaw: "2026-04-10 12:00:00",
      loginAt: new Date("2026-04-10T12:00:00Z"),
      result: "fail",
    },
    {
      ownerUserId: TEST_OWNER,
      host: "olt-csv-A",
      username: "@SUM(A1:A2)",
      sourceIp: "-1+1",
      channel: "ssh",
      loginAtRaw: "2026-04-12 13:00:00",
      loginAt: new Date("2026-04-12T13:00:00Z"),
      result: "fail",
    },
  ]);

  await new Promise<void>((resolve) => {
    authedServer = makeAuthedApp().listen(0, () => resolve());
  });
  await new Promise<void>((resolve) => {
    unauthedServer = makeUnauthedApp().listen(0, () => resolve());
  });
  authedBase = `http://127.0.0.1:${(authedServer!.address() as AddressInfo).port}`;
  unauthedBase = `http://127.0.0.1:${(unauthedServer!.address() as AddressInfo).port}`;
});

after(async () => {
  if (authedServer) await new Promise<void>((r) => authedServer!.close(() => r()));
  if (unauthedServer) await new Promise<void>((r) => unauthedServer!.close(() => r()));
  if (HAS_DB) {
    await db.delete(oltLoginEventsTable).where(eq(oltLoginEventsTable.ownerUserId, TEST_OWNER));
  }
});

const skipReason = HAS_DB ? undefined : "DATABASE_URL not set";

test(
  "GET /olt/login-history.csv returns 401 JSON when req.userId is not set",
  { skip: skipReason },
  async () => {
    const res = await fetch(`${unauthedBase}/api/olt/login-history.csv`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.deepEqual(body, { error: "Unauthenticated" });
  },
);

test(
  "GET /olt/login-history.csv sets text/csv Content-Type and the archival Content-Disposition filename",
  { skip: skipReason },
  async () => {
    const res = await fetch(
      `${authedBase}/api/olt/login-history.csv?host=olt-csv-A&from=2026-04-01&to=2026-04-30`,
      { headers: { "x-test-user-id": TEST_OWNER } },
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8");
    const cd = res.headers.get("content-disposition") ?? "";
    // Pattern: olt-login-history__<host>__<from>_<to>.csv with safe parts.
    assert.match(
      cd,
      /^attachment; filename="olt-login-history__olt-csv-A__2026-04-01_2026-04-30\.csv"$/,
      `unexpected Content-Disposition: ${cd}`,
    );
    // Drain the body so the connection isn't left half-open.
    await res.text();
  },
);

test(
  "GET /olt/login-history.csv falls back to `all-hosts`/`earliest`/`latest` parts when filters are omitted",
  { skip: skipReason },
  async () => {
    const res = await fetch(`${authedBase}/api/olt/login-history.csv`, {
      headers: { "x-test-user-id": TEST_OWNER },
    });
    assert.equal(res.status, 200);
    const cd = res.headers.get("content-disposition") ?? "";
    assert.match(
      cd,
      /^attachment; filename="olt-login-history__all-hosts__earliest_latest\.csv"$/,
      `unexpected Content-Disposition: ${cd}`,
    );
    await res.text();
  },
);

test(
  "GET /olt/login-history.csv body starts with a UTF-8 BOM and uses CRLF row terminators",
  { skip: skipReason },
  async () => {
    const res = await fetch(`${authedBase}/api/olt/login-history.csv?host=olt-csv-A`, {
      headers: { "x-test-user-id": TEST_OWNER },
    });
    assert.equal(res.status, 200);

    // IMPORTANT: read the body as raw bytes, not via res.text(). The
    // WHATWG TextDecoder used by Response.text() *strips* a leading
    // UTF-8 BOM by default (its `ignoreBOM` option defaults to false,
    // meaning "consume the BOM during decode"), which would silently
    // hide a regression where the route stops emitting it. Inspect
    // the raw bytes instead.
    const buf = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual(
      Array.from(buf.slice(0, 3)),
      [0xef, 0xbb, 0xbf],
      "body should start with a UTF-8 BOM (EF BB BF)",
    );

    // Now decode the rest with `ignoreBOM: true` so we don't accidentally
    // strip a *real* leading BOM that we want to assert is present
    // exactly once.
    const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(buf).slice(1);

    assert.ok(body.includes("\r\n"), "body should contain CRLF row terminators");
    // The body should end with a CRLF after the last data row.
    assert.ok(body.endsWith("\r\n"), "final row should be terminated by CRLF");
    // No bare LFs outside a CRLF pair — guards against accidental
    // platform-native line endings sneaking into the writer.
    let bareLfs = 0;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === "\n" && body[i - 1] !== "\r") bareLfs++;
    }
    assert.equal(bareLfs, 0, "body must not contain bare LF (\\n) outside of CRLF pairs");

    // Header row sanity: confirms the column order callers depend on
    // and that headers themselves are CSV-quoted via csvField.
    const firstRow = body.split("\r\n")[0];
    assert.equal(
      firstRow,
      '"host","username","source_ip","channel","login_at","logout_at","result","seen_at"',
    );
  },
);

test(
  "GET /olt/login-history.csv prefixes formula-leader values with a single quote",
  { skip: skipReason },
  async () => {
    // Pull only the rows that contain formula-leader payloads.
    const res = await fetch(`${authedBase}/api/olt/login-history.csv?host=olt-csv-A&result=fail`, {
      headers: { "x-test-user-id": TEST_OWNER },
    });
    assert.equal(res.status, 200);
    const body = (await res.text()).slice(1); // strip BOM

    // The two seeded payloads were `username="=2+5"` and `username="@SUM(A1:A2)"`,
    // and `source_ip="+CMD|calc"` and `source_ip="-1+1"`. All four must
    // appear in the body wrapped in CSV quotes AND prefixed with a `'`.
    assert.match(body, /"'=2\+5"/, "username '=2+5' must be prefixed with single-quote");
    assert.match(body, /"'@SUM\(A1:A2\)"/, "username '@SUM(A1:A2)' must be prefixed with single-quote");
    assert.match(body, /"'\+CMD\|calc"/, "source_ip '+CMD|calc' must be prefixed with single-quote");
    assert.match(body, /"'-1\+1"/, "source_ip '-1+1' must be prefixed with single-quote");

    // And confirm the non-formula values from the same response are
    // NOT mangled with a stray apostrophe.
    assert.match(body, /"olt-csv-A"/);
    assert.doesNotMatch(body, /"'olt-csv-A"/);
  },
);

test(
  "GET /olt/login-history.csv returns the same row IDs as GET /olt/login-history for the same filters",
  { skip: skipReason },
  async () => {
    // Hit both endpoints with identical filters and compare the host +
    // login_at columns (the ID isn't in the CSV, but the dedup key is
    // good enough to assert row-set parity for this owner).
    const filterQs = "host=olt-csv-A&from=2026-04-01&to=2026-04-30";

    const jsonRes = await fetch(`${authedBase}/api/olt/login-history?${filterQs}&limit=100`, {
      headers: { "x-test-user-id": TEST_OWNER },
    });
    assert.equal(jsonRes.status, 200);
    const jsonBody = (await jsonRes.json()) as { events: Array<{ host: string; loginAt: string | null; loginAtRaw: string }> };
    const jsonKeys = jsonBody.events.map((e) => `${e.host}|${e.loginAt ?? e.loginAtRaw}`);

    const csvRes = await fetch(`${authedBase}/api/olt/login-history.csv?${filterQs}`, {
      headers: { "x-test-user-id": TEST_OWNER },
    });
    assert.equal(csvRes.status, 200);
    const csvBody = (await csvRes.text()).slice(1);
    const csvLines = csvBody.split("\r\n").filter((l) => l.length > 0);
    // Drop the header row.
    const csvDataRows = csvLines.slice(1);
    // Each row is `"host","username","source_ip","channel","login_at",...`.
    // We extract host (col 0) and login_at (col 4) using a tiny CSV
    // parser that handles our always-quoted output. Using a regex split
    // would be fragile because formula-prefixed values contain commas.
    // Minimal CSV row parser tolerant of (a) the "always quoted" output
    // produced by csvField for non-null values, and (b) bare empty
    // fields produced by csvField for null/undefined (it returns "" with
    // no surrounding quotes for null). Two adjacent commas, or a comma
    // immediately at end-of-line, signal an empty field.
    function parseQuotedCsvRow(line: string): string[] {
      const out: string[] = [];
      let i = 0;
      while (i <= line.length) {
        if (i === line.length || line[i] === ",") {
          // Bare empty field (null serialized as the empty string).
          out.push("");
          if (line[i] === ",") { i++; continue; }
          break;
        }
        if (line[i] === '"') {
          i++;
          let v = "";
          while (i < line.length) {
            if (line[i] === '"' && line[i + 1] === '"') { v += '"'; i += 2; continue; }
            if (line[i] === '"') { i++; break; }
            v += line[i++];
          }
          out.push(v);
          if (i < line.length && line[i] === ",") i++;
          continue;
        }
        throw new Error(`expected quote or comma at col ${i} of: ${line}`);
      }
      return out;
    }
    const csvKeys = csvDataRows.map((line) => {
      const cols = parseQuotedCsvRow(line);
      return `${cols[0]}|${cols[4]}`;
    });

    assert.deepEqual(
      csvKeys,
      jsonKeys,
      `CSV and JSON endpoints must return the same rows in the same order for filters ${filterQs}`,
    );
  },
);

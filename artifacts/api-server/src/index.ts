import bcrypt from "bcryptjs";
import { db, appUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "./app";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Seed the initial superuser if no superuser exists. In dev we accept the
// classic admin/admin so the user can sign in immediately. In production we
// REQUIRE SEED_ADMIN_USERNAME + SEED_ADMIN_PASSWORD to be set explicitly so
// no public deployment is ever shipped with a guessable bootstrap account.
// The password is never logged.
async function seedInitialSuperuser(): Promise<void> {
  const existing = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.role, "superuser"))
    .limit(1);
  if (existing[0]) return;

  const isProd = process.env.NODE_ENV === "production";
  const envUser = process.env.SEED_ADMIN_USERNAME;
  const envPwd = process.env.SEED_ADMIN_PASSWORD;

  if (isProd && (!envUser || !envPwd || envPwd.length < 8)) {
    throw new Error(
      "No superuser exists and SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD (>=8 chars) are not set. Refusing to seed a default admin in production.",
    );
  }

  const username = (envUser || "admin").trim().toLowerCase();
  const password = envPwd || "admin";
  const passwordHash = await bcrypt.hash(password, 10);

  // If a row with this username already exists (e.g. from a previous seed
  // attempt), upgrade it to superuser; otherwise create a fresh row.
  const sameName = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.username, username))
    .limit(1);
  if (sameName[0]) {
    await db
      .update(appUsersTable)
      .set({
        role: "superuser",
        disabled: "false",
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(appUsersTable.id, sameName[0].id));
    // eslint-disable-next-line no-console
    console.log(`[seed] promoted existing user "${username}" to superuser`);
    return;
  }

  await db.insert(appUsersTable).values({
    id: `usr_admin_${Date.now().toString(36)}`,
    username,
    passwordHash,
    role: "superuser",
    fullName: "Administrator",
  });
  // eslint-disable-next-line no-console
  console.log(
    `[seed] created initial superuser "${username}". ` +
      (envPwd
        ? "Password sourced from SEED_ADMIN_PASSWORD."
        : "Default dev password is in effect — change it from the Admin page."),
  );
}

seedInitialSuperuser().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[seed] failed to seed initial superuser:", e);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

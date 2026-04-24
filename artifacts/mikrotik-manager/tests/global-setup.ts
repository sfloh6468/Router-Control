/**
 * Playwright global setup for the mikrotik-manager e2e suite.
 *
 * The suite uses a Vite alias (`vite.test.config.ts`) that swaps `@clerk/react`
 * for a local stub, so no real Clerk session is required. This hook is kept
 * as an extension point and intentionally performs no work.
 */
export default async function globalSetup() {
  // intentionally empty
}

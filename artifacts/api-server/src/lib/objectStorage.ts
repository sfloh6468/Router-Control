/**
 * Minimal Replit Object Storage helper for OLT config snapshots.
 *
 * The OLT backup route writes saved configs into the project's private
 * bucket and reads/lists/deletes them per-user. We only need a single
 * authenticated GCS client; everything else (per-user prefixing, download
 * streaming) lives in the route file.
 *
 * Authentication uses the Replit object-storage sidecar — no credentials
 * are required at runtime.
 */
import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

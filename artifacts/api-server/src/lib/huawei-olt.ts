/**
 * Huawei SmartAX EA5801E (and related EA5800-family) OLT transport adapter.
 *
 * Connects via SSH (port 22), opens an interactive shell, enters privileged
 * mode (`enable`), disables paging (`scroll`), and exposes a sequential
 * `exec(line)` that returns the raw CLI output stripped of the command echo,
 * pagination markers, and trailing prompt.
 *
 * Designed to be opened once per request and held for the duration of the
 * route handler — many endpoints (dashboard, ONT list) issue several
 * `display ...` commands and benefit from reusing a single shell.
 */
import { Client as SshClient, type ClientChannel, type Algorithms } from "ssh2";

/**
 * Permissive algorithm whitelist. Older Huawei firmware negotiates legacy
 * primitives (`ssh-dss`, `hmac-md5`, `3des-cbc`, `diffie-hellman-group1-sha1`)
 * that aren't in ssh2's narrow literal union — we cast once after assembling
 * the object instead of per-line.
 */
const SSH_ALGORITHMS = {
  kex: [
    "curve25519-sha256",
    "curve25519-sha256@libssh.org",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group14-sha1",
    "diffie-hellman-group-exchange-sha256",
    "diffie-hellman-group-exchange-sha1",
    "diffie-hellman-group1-sha1",
  ],
  serverHostKey: [
    "ssh-ed25519",
    "rsa-sha2-512",
    "rsa-sha2-256",
    "ssh-rsa",
    "ssh-dss",
  ],
  cipher: [
    "aes128-ctr",
    "aes192-ctr",
    "aes256-ctr",
    "aes128-gcm",
    "aes256-gcm",
    "aes128-cbc",
    "aes192-cbc",
    "aes256-cbc",
    "3des-cbc",
  ],
  hmac: [
    "hmac-sha2-256",
    "hmac-sha2-512",
    "hmac-sha1",
    "hmac-md5",
  ],
} as unknown as Algorithms;

export interface OltCreds {
  host: string;
  port?: number;
  username: string;
  password: string;
}

export interface OltSession {
  exec(command: string, opts?: { timeoutMs?: number }): Promise<string>;
  /**
   * Send a sequence of input lines as a single "wizard-style" command.
   * Useful for interactive OLT prompts (e.g. `terminal user name <name>` on
   * EA5800 firmware that asks for password / profile / re-enter count one
   * line at a time). Lines are written sequentially with a small pause to
   * give the OLT time to print each sub-prompt; the combined output is
   * returned once the regular shell prompt reappears.
   */
  execScript(lines: string[], opts?: { timeoutMs?: number }): Promise<string>;
  close(): void;
}

// "---- More ( Press 'Q' to break ) ----" or "  ---- More ----"
const MORE_RE = /----\s*More[^-]*----/i;

// A SmartAX prompt line: "MA5800-X7>" / "MA5800-X7#" / "MA5800-X7(config)#" /
// "MA5800-X7(config-if-gpon-0/0)#" — printable, no spaces, ends in > or #.
const PROMPT_RE = /(^|\n)[^\s\n]+[>#]\s*$/;

/** Strip ANSI escape sequences SmartAX occasionally emits. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
}

function readUntilPrompt(
  stream: ClientChannel,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let acc = "";
    const onData = (chunk: Buffer) => {
      acc += chunk.toString("utf-8");
      let cleaned = stripAnsi(acc).replace(/\r/g, "");

      // Answer pagination prompts so output continues uninterrupted.
      while (MORE_RE.test(cleaned)) {
        try {
          stream.write(" ");
        } catch {
          /* ignore */
        }
        cleaned = cleaned.replace(MORE_RE, "");
        acc = cleaned;
      }

      if (PROMPT_RE.test(cleaned)) {
        cleanup();
        resolve(cleaned);
      }
    };
    const onClose = () => {
      cleanup();
      // If the channel closes mid-command return whatever we got — caller
      // may still be able to use it.
      resolve(stripAnsi(acc).replace(/\r/g, ""));
    };
    const cleanup = () => {
      stream.removeListener("data", onData);
      stream.removeListener("close", onClose);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timeout waiting for OLT prompt after ${timeoutMs}ms. Got: ${acc.slice(-200)}`,
        ),
      );
    }, timeoutMs);
    stream.on("data", onData);
    stream.on("close", onClose);
  });
}

/** Strip the echoed command from the start, trailing prompt line, and any
 *  isolated More markers that slipped through. */
function cleanCommandOutput(raw: string, command: string): string {
  let s = raw.replace(/\r/g, "");
  // Remove first occurrence of the echoed command line.
  const cmdIdx = s.indexOf(command);
  if (cmdIdx >= 0 && cmdIdx < 200) {
    const after = s.indexOf("\n", cmdIdx);
    if (after >= 0) s = s.slice(after + 1);
  }
  // Drop the final prompt line.
  const lines = s.split("\n");
  while (lines.length > 0) {
    const last = lines[lines.length - 1];
    if (/^\s*$/.test(last) || /^\S+[>#]\s*$/.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join("\n").replace(/[ \t]+$/gm, "").trimEnd();
}

export async function connectOlt(creds: OltCreds): Promise<OltSession> {
  const port = creds.port ?? 22;
  const client = new SshClient();

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (e: Error) => {
      if (!settled) {
        settled = true;
        try {
          client.end();
        } catch {
          /* ignore */
        }
        reject(e);
      }
    };
    client.on("ready", () => {
      settled = true;
      resolve();
    });
    client.on("error", fail);
    client.connect({
      host: creds.host,
      port,
      username: creds.username,
      password: creds.password,
      readyTimeout: 20000,
      algorithms: SSH_ALGORITHMS,
    });
  });

  const stream: ClientChannel = await new Promise((resolve, reject) => {
    client.shell({ term: "vt100", rows: 24, cols: 200 }, (err, s) => {
      if (err) return reject(err);
      resolve(s);
    });
  });

  // Wait for the initial user-mode prompt. SmartAX often prints a long banner.
  await readUntilPrompt(stream, 15000);

  // Enter privileged mode. EA5801E typically does not re-prompt for password
  // here when authenticated by SSH password.
  stream.write("enable\n");
  await readUntilPrompt(stream, 10000);

  // Disable pagination. `scroll` toggles automatic scrolling on EA5800-family;
  // best-effort — if it errors we still continue (we also handle More inline).
  stream.write("scroll\n");
  try {
    await readUntilPrompt(stream, 5000);
  } catch {
    /* ignore */
  }

  // Sequential queue — commands MUST not interleave on a single shell.
  let chain: Promise<unknown> = Promise.resolve();

  function exec(command: string, opts?: { timeoutMs?: number }): Promise<string> {
    const timeoutMs = opts?.timeoutMs ?? 30000;
    const job = chain.then(async () => {
      stream.write(command + "\n");
      const raw = await readUntilPrompt(stream, timeoutMs);
      return cleanCommandOutput(raw, command);
    });
    chain = job.catch(() => {
      /* swallow so the chain stays alive for next caller */
    });
    return job;
  }

  function execScript(lines: string[], opts?: { timeoutMs?: number }): Promise<string> {
    const timeoutMs = opts?.timeoutMs ?? 30000;
    const job = chain.then(async () => {
      for (let i = 0; i < lines.length; i++) {
        stream.write(lines[i] + "\n");
        if (i < lines.length - 1) {
          await new Promise((r) => setTimeout(r, 350));
        }
      }
      const raw = await readUntilPrompt(stream, timeoutMs);
      return cleanCommandOutput(raw, lines[0] ?? "");
    });
    chain = job.catch(() => {
      /* swallow so the chain stays alive for next caller */
    });
    return job;
  }

  return {
    exec,
    execScript,
    close() {
      try {
        stream.end();
      } catch {
        /* ignore */
      }
      try {
        client.end();
      } catch {
        /* ignore */
      }
    },
  };
}

export async function withOlt<T>(
  creds: OltCreds,
  fn: (s: OltSession) => Promise<T>,
): Promise<T> {
  const session = await connectOlt(creds);
  try {
    return await fn(session);
  } finally {
    session.close();
  }
}

// ─────────────────────── Higher-level helpers ───────────────────────

export interface OltIdentity {
  identity: string | null;
  softwareVersion: string | null;
  hardware: string | null;
}

/** Probe identity / version. Best-effort — any failed parse returns null. */
export async function probeOltIdentity(s: OltSession): Promise<OltIdentity> {
  let identity: string | null = null;
  let softwareVersion: string | null = null;
  let hardware: string | null = null;

  try {
    const ver = await s.exec("display version");
    // Look for "VERSION : MA5800V100R019C10" or "Software Version: ..."
    const m1 = ver.match(/VERSION[^:]*:\s*([^\s]+)/i)
      || ver.match(/Software\s+Version\s*[:=]\s*([^\s]+)/i);
    if (m1) softwareVersion = m1[1];
    const m2 = ver.match(/PRODUCT[^:]*:\s*([^\s]+)/i)
      || ver.match(/Product\s+name\s*[:=]\s*([^\r\n]+)/i);
    if (m2) hardware = m2[1].trim();
  } catch {
    /* ignore */
  }

  try {
    const sn = await s.exec("display sysname");
    // "  MA5800-X7" or "Sysname: foo"
    const m = sn.match(/(?:Sysname[^:]*:\s*)?([A-Za-z0-9_\-.]+)/);
    if (m) identity = m[1];
  } catch {
    /* ignore */
  }

  return { identity, softwareVersion, hardware };
}

/**
 * Environment variable access that works in both the browser and Node.
 *
 * Vite replaces `import.meta.env` at build time, but that object does not exist
 * when the same modules are imported by a plain Node script. Without this
 * shim, maintenance and verification scripts could not import the real
 * application code — they would have to reimplement it, and a test that
 * reimplements what it is testing proves nothing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const viteEnv: Record<string, string | undefined> | undefined = (
  import.meta as any
)?.env;

const source: Record<string, string | undefined> =
  viteEnv ?? (globalThis as any)?.process?.env ?? {};

export function readEnv(key: string): string | undefined {
  return source[key];
}

export function requireEnv(key: string): string {
  const value = readEnv(key);
  if (!value) {
    throw new Error(
      `Missing ${key}. Copy .env.example to .env at the repo root and fill it in.`,
    );
  }
  return value;
}

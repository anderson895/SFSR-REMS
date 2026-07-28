/**
 * Environment variable access that works in both the browser and Node.
 *
 * Vite replaces `import.meta.env` at transform time, but that object does not
 * exist when the same modules are imported by a plain Node script. Without this
 * shim, maintenance and verification scripts could not import the real
 * application code — they would have to reimplement it, and a test that
 * reimplements what it is testing proves nothing.
 *
 * The expression below must be written EXACTLY as `import.meta.env`.
 * Vite's replacement is a textual match, so writing `import.meta?.env` — even
 * though it looks safer — is silently left alone, evaluates to `undefined` in
 * the browser, and every variable comes back missing.
 *
 * The try/catch, not optional chaining, is what makes this safe under Node.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let viteEnv: Record<string, string | undefined> | undefined;
try {
  viteEnv = import.meta.env as unknown as Record<string, string | undefined>;
} catch {
  // `import.meta` is unavailable in a CommonJS context.
  viteEnv = undefined;
}

const nodeEnv: Record<string, string | undefined> | undefined = (globalThis as any)
  ?.process?.env;

const source: Record<string, string | undefined> = viteEnv ?? nodeEnv ?? {};

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

/**
 * DEV-only warning helpers. Every call site that uses these is wrapped in
 * `if (process.env.NODE_ENV !== 'production')` so that bundlers configured
 * with the standard `define: { 'process.env.NODE_ENV': '"production"' }`
 * (Webpack production mode, Vite production mode, esbuild --define, etc.)
 * trim both the call site **and** the helper itself out of production
 * bundles via dead-code elimination.
 *
 * Keep this module tiny — no imports beyond what the warnings themselves
 * need, no top-level side effects.
 */

const memo = new Set<string>();

/**
 * Print `message` to the console at most once per `key`. Subsequent calls
 * with the same key are silently dropped — so we don't spam during React
 * StrictMode mount-cycles or hot reloads.
 */
export function warnOnce(key: string, message: string): void {
  if (memo.has(key)) return;
  memo.add(key);
  // eslint-disable-next-line no-console -- DEV warn
  console.warn(message);
}

/** Print `message` every time. Use for unconditional notices (lookup misses). */
export function warn(message: string): void {
  // eslint-disable-next-line no-console -- DEV warn
  console.warn(message);
}

/**
 * Minimal ambient declaration so source files in this package can write
 *   `if (process.env.NODE_ENV !== 'production') { … }`
 * without depending on `@types/node`. Bundlers configured for production
 * builds (Webpack / Vite / esbuild --define) replace this with the literal
 * `false`, dead-code-eliminating the entire block.
 *
 * Declared with a type intersection so it's compatible with the richer
 * `NodeJS.Process` shape that other packages in the monorepo bring in via
 * `@types/node` for `process.argv` / `process.exit` etc.
 */
// biome-ignore lint/suspicious/noExplicitAny: ambient shim, kept loose for compatibility
declare const process: any;

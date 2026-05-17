#!/usr/bin/env node
/**
 * Walk every `examples/<name>/` folder, collect source files (excluding
 * node_modules, dist, lockfiles, CHANGELOGs, hidden dirs) and emit a JSON
 * bundle per example into `apps/docs/public/example-bundles/<name>.json`.
 *
 * At runtime the StackBlitzButton component fetches that bundle and hands
 * it to `@stackblitz/sdk`'s `openProject({ files, ... })` — no GitHub clone,
 * no minute-long "Cloning repo" wait.
 *
 * Run via `pnpm bundle-examples` (added to the `build` script so CI picks
 * it up on every docs deploy).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..'); // /Users/.../triggery
const EXAMPLES = join(REPO, 'examples');
const OUT = join(REPO, 'apps', 'docs', 'public', 'example-bundles');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', '.cache', '.changeset']);
const SKIP_FILES = new Set(['CHANGELOG.md', 'pnpm-lock.yaml', '.DS_Store']);

/**
 * Walks `dir` and returns `{ [relativePath]: utf8Contents }` for every file
 * not matched by the skip lists. Uses `withFileTypes: true` so we get the
 * `Dirent.isDirectory()` / `Dirent.isFile()` info from the single
 * `readdir` syscall — no separate `statSync()` follow-up, no TOCTOU race
 * between check and read (CodeQL `js/file-system-race`).
 */
function walk(dir, base) {
  const out = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (entry.isDirectory()) {
      Object.assign(out, walk(full, base));
    } else if (entry.isFile()) {
      try {
        const content = readFileSync(full, 'utf-8');
        const rel = relative(base, full);
        // StackBlitz SDK expects forward-slash relative paths.
        out[rel.split(/[\\/]/).join('/')] = content;
      } catch {
        // File vanished between readdir and read — skip it. Build still
        // produces a bundle for the rest of the example.
      }
    }
  }
  return out;
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Same `withFileTypes` trick at the top level — list only directories
// directly under `examples/` without a follow-up `statSync`.
const entries = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  .map((e) => e.name);

const manifest = [];
let total = 0;
for (const name of entries) {
  const root = join(EXAMPLES, name);
  const files = walk(root, root);
  let title = name;
  let description = '';

  // Normalise package.json so StackBlitz's node template boots cleanly:
  // we mirror `dev` into `start` if missing — `npm start` is what the
  // WebContainer runs by default for `template: 'node'`.
  const pkgRaw = files['package.json'];
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw);
      title = pkg.name ?? name;
      description = pkg.description ?? '';
      pkg.scripts = pkg.scripts ?? {};
      if (!pkg.scripts.start) {
        pkg.scripts.start = pkg.scripts.dev ?? 'vite';
      }
      files['package.json'] = `${JSON.stringify(pkg, null, 2)}\n`;
    } catch {
      // Leave package.json untouched if it's not parseable.
    }
  }

  const bundle = { name, title, description, files };
  const payload = JSON.stringify(bundle);
  writeFileSync(join(OUT, `${name}.json`), payload);
  console.log(
    `  bundled ${name}: ${Object.keys(files).length} files (${(payload.length / 1024).toFixed(1)} KB)`,
  );
  manifest.push({
    name,
    fileCount: Object.keys(files).length,
    sizeKB: +(payload.length / 1024).toFixed(1),
  });
  total += payload.length;
}

writeFileSync(join(OUT, '_manifest.json'), JSON.stringify({ examples: manifest }, null, 2));
console.log(`\nTotal: ${entries.length} bundles, ${(total / 1024).toFixed(1)} KB`);

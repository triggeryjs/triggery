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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..'); // /Users/.../triggery
const EXAMPLES = join(REPO, 'examples');
const OUT = join(REPO, 'apps', 'docs', 'public', 'example-bundles');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', '.cache', '.changeset']);
const SKIP_FILES = new Set(['CHANGELOG.md', 'pnpm-lock.yaml', '.DS_Store']);

function walk(dir, base) {
  const out = {};
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      Object.assign(out, walk(full, base));
    } else {
      const rel = relative(base, full);
      // StackBlitz SDK expects forward-slash relative paths.
      out[rel.split(/[\\/]/).join('/')] = readFileSync(full, 'utf-8');
    }
  }
  return out;
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const entries = readdirSync(EXAMPLES).filter((name) => {
  const full = join(EXAMPLES, name);
  return !name.startsWith('.') && statSync(full).isDirectory();
});

const manifest = [];
let total = 0;
for (const name of entries) {
  const root = join(EXAMPLES, name);
  const files = walk(root, root);
  let title = name;
  let description = '';

  // Normalise package.json so the inline sandbox CTAs (StackBlitz + CSB)
  // actually boot. Both expect a `start` script — CSB runs `npm start` by
  // default; SB's node template falls back to `dev` only after `start`.
  // Vite examples ship with `dev`/`build`/`preview`, so we mirror `dev`
  // into `start` if it's missing.
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

  // Tell CodeSandbox what to run + which port to expose. Without this
  // CSB occasionally creates the sandbox, opens an empty preview iframe
  // and never starts the dev server — terminal hidden, no way to debug.
  if (!files['sandbox.config.json']) {
    files['sandbox.config.json'] = `${JSON.stringify(
      {
        template: 'node',
        container: {
          node: '20',
          port: 5173,
          startScript: 'dev',
        },
      },
      null,
      2,
    )}\n`;
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

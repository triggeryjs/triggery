import { resolve } from 'node:path';
import { downloadTemplate } from 'giget';

export type TemplateName = 'vite-react' | 'next-app' | 'react-native';

const REPO = 'github:triggeryjs/triggery';
const BRANCH = 'main';

export interface CreateProjectOptions {
  readonly directory: string;
  readonly template: TemplateName;
  readonly cwd?: string;
  readonly force?: boolean;
}

export interface CreateProjectResult {
  readonly directory: string;
  readonly source: string;
}

/**
 * Downloads a Triggery starter template via giget (`degit`-flavoured tar
 * fetcher backed by the GitHub archive endpoint). No `git clone`, no node
 * shell-out — works in offline-cache mode after the first fetch.
 *
 * The starter templates live under `templates/<name>` in this repo so
 * versioning stays in lockstep with core.
 */
export async function createProject(options: CreateProjectOptions): Promise<CreateProjectResult> {
  const cwd = options.cwd ?? process.cwd();
  const target = resolve(cwd, options.directory);
  const source = `${REPO}/templates/${options.template}#${BRANCH}`;
  await downloadTemplate(source, {
    dir: target,
    force: options.force ?? false,
  });
  return { directory: target, source };
}

export function isKnownTemplate(name: string): name is TemplateName {
  return name === 'vite-react' || name === 'next-app' || name === 'react-native';
}

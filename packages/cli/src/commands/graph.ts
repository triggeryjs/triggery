import { type CallExpression, Node, Project, SyntaxKind } from 'ts-morph';

export interface TriggerNode {
  readonly id: string;
  readonly file: string;
  readonly events: readonly string[];
  readonly required: readonly string[];
}

export interface GraphOptions {
  readonly cwd?: string;
  readonly include?: readonly string[]; // glob patterns; defaults to **/*.trigger.ts
}

/**
 * Statically discovers every `createTrigger({...})` call beneath `cwd` and
 * returns a flat list of nodes. The graph is "events × triggers", so adopters
 * can pipe the output into `graphviz` (DOT renderer) or any topo-tool to
 * visualise which triggers react to which events.
 */
export function buildTriggerGraph(options: GraphOptions = {}): readonly TriggerNode[] {
  const cwd = options.cwd ?? process.cwd();
  const includeGlobs = options.include ?? ['**/*.trigger.ts', '**/*.trigger.tsx'];
  const project = new Project({
    useInMemoryFileSystem: false,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });
  project.addSourceFilesAtPaths(includeGlobs.map((g) => `${cwd}/${g}`));

  const out: TriggerNode[] = [];
  for (const source of project.getSourceFiles()) {
    for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (!isCreateTriggerCall(call)) continue;
      const config = call.getArguments()[0];
      if (!config || !Node.isObjectLiteralExpression(config)) continue;
      const idProp = config.getProperty('id');
      let id = '<unknown>';
      if (idProp && Node.isPropertyAssignment(idProp)) {
        const init = idProp.getInitializer();
        if (init && Node.isStringLiteral(init)) id = init.getLiteralText();
      }
      const events = readStringArray(config, 'events');
      const required = readStringArray(config, 'required');
      out.push({ id, file: source.getFilePath(), events, required });
    }
  }
  return out;
}

function isCreateTriggerCall(call: CallExpression): boolean {
  const expr = call.getExpression();
  if (Node.isIdentifier(expr) && expr.getText() === 'createTrigger') return true;
  if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'createTrigger') return true;
  return false;
}

function readStringArray(
  config: ReturnType<CallExpression['getArguments']>[number],
  key: string,
): readonly string[] {
  if (!Node.isObjectLiteralExpression(config)) return [];
  const prop = config.getProperty(key);
  if (!prop || !Node.isPropertyAssignment(prop)) return [];
  const init = prop.getInitializer();
  if (!init || !Node.isArrayLiteralExpression(init)) return [];
  const out: string[] = [];
  for (const el of init.getElements()) {
    if (Node.isStringLiteral(el)) out.push(el.getLiteralText());
  }
  return out;
}

export type GraphFormat = 'json' | 'dot' | 'md';

export function renderGraph(nodes: readonly TriggerNode[], format: GraphFormat): string {
  if (format === 'json') return JSON.stringify(nodes, null, 2);

  if (format === 'dot') {
    const lines = ['digraph triggery {', '  rankdir=LR;', '  node [shape=box];'];
    const events = new Set<string>();
    for (const node of nodes) {
      for (const ev of node.events) events.add(ev);
    }
    for (const ev of events) {
      lines.push(`  "event:${ev}" [shape=ellipse style=filled fillcolor="#cfe"];`);
    }
    for (const node of nodes) {
      lines.push(`  "trigger:${node.id}" [label="${node.id}"];`);
      for (const ev of node.events) {
        lines.push(`  "event:${ev}" -> "trigger:${node.id}";`);
      }
      for (const cond of node.required) {
        lines.push(
          `  "cond:${cond}" [shape=note style=filled fillcolor="#fec"]; "cond:${cond}" -> "trigger:${node.id}" [style=dashed];`,
        );
      }
    }
    lines.push('}');
    return lines.join('\n');
  }

  // markdown table
  const lines = ['| Trigger id | Events | Required conditions | File |', '|---|---|---|---|'];
  for (const node of nodes) {
    lines.push(
      `| \`${node.id}\` | ${node.events.map((e) => `\`${e}\``).join(', ') || '—'} | ${
        node.required.map((c) => `\`${c}\``).join(', ') || '—'
      } | \`${node.file}\` |`,
    );
  }
  return lines.join('\n');
}

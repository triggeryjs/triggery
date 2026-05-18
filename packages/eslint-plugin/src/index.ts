import type { ESLint, Linter } from 'eslint';
import { exhaustiveConditions } from './rules/exhaustive-conditions.ts';
import { exhaustiveRequired } from './rules/exhaustive-required.ts';
import { hookRules } from './rules/hook-rules.ts';
import { maxHandlerSize } from './rules/max-handler-size.ts';
import { maxPortsPerTrigger } from './rules/max-ports-per-trigger.ts';
import { noDynamicId } from './rules/no-dynamic-id.ts';
import { noEventCascade } from './rules/no-event-cascade.ts';
import { noNonNullAssertionInHandler } from './rules/no-non-null-assertion-in-handler.ts';
import { preferNamedHook } from './rules/prefer-named-hook.ts';

const rules = {
  'exhaustive-conditions': exhaustiveConditions,
  'exhaustive-required': exhaustiveRequired,
  'hook-rules': hookRules,
  'max-handler-size': maxHandlerSize,
  'max-ports-per-trigger': maxPortsPerTrigger,
  'no-dynamic-id': noDynamicId,
  'no-event-cascade': noEventCascade,
  'no-non-null-assertion-in-handler': noNonNullAssertionInHandler,
  'prefer-named-hook': preferNamedHook,
};

const meta = {
  name: '@triggery/eslint-plugin',
  version: '0.0.0',
};

/**
 * Drop-in flat config presets. Adopters either spread our preset or pick the
 * individual rule keys they want — both work with ESLint 9.x flat config.
 *
 * @example
 * ```js
 * import triggery from '@triggery/eslint-plugin';
 *
 * export default [
 *   triggery.configs.recommended,
 *   triggery.configs.strict, // optionally on top
 * ];
 * ```
 */
const plugin: ESLint.Plugin = {
  meta,
  rules: rules as unknown as ESLint.Plugin['rules'],
};

const recommended: Linter.Config = {
  plugins: { '@triggery': plugin },
  rules: {
    '@triggery/no-dynamic-id': 'error',
    '@triggery/no-event-cascade': 'error',
    '@triggery/hook-rules': 'error',
    '@triggery/exhaustive-conditions': 'warn',
    '@triggery/exhaustive-required': 'warn',
    '@triggery/max-handler-size': 'warn',
    '@triggery/max-ports-per-trigger': 'warn',
    '@triggery/no-non-null-assertion-in-handler': 'warn',
  },
};

const strict: Linter.Config = {
  plugins: { '@triggery': plugin },
  rules: {
    '@triggery/no-dynamic-id': 'error',
    '@triggery/no-event-cascade': 'error',
    '@triggery/hook-rules': 'error',
    '@triggery/exhaustive-conditions': 'error',
    '@triggery/exhaustive-required': 'error',
    '@triggery/max-handler-size': ['error', { max: 30 }],
    '@triggery/max-ports-per-trigger': ['error', { maxEvents: 5, maxConditions: 5, maxTotal: 8 }],
    '@triggery/prefer-named-hook': ['warn', { threshold: 3 }],
    '@triggery/no-non-null-assertion-in-handler': 'error',
  },
};

const finalPlugin: ESLint.Plugin = {
  ...plugin,
  configs: {
    recommended,
    strict,
  },
};

export default finalPlugin;
export { recommended, rules, strict };

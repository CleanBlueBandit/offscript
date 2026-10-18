import { register } from 'node:module';

// Use Node's built-in TypeScript transformer: no test framework dependency or
// emitted test files are needed. Async loader hooks also support Node 22.13.
const loader = `
  import { readFileSync } from 'node:fs';
  import { stripTypeScriptTypes } from 'node:module';
  export async function resolve(specifier, context, nextResolve) {
    try { return await nextResolve(specifier, context); }
    catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[a-z]+$/i.test(specifier)) {
        return nextResolve(specifier + '.ts', context);
      }
      throw error;
    }
  }
  export function load(url, context, nextLoad) {
    if (url.endsWith('.ts')) return {
      format: 'module',
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
      shortCircuit: true,
    };
    return nextLoad(url, context);
  }
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
await import('../tests/ai.test.ts');

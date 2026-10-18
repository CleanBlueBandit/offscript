import { register } from "node:module";

const root = new URL("../", import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`
  import { readFileSync } from 'node:fs';
  import { stripTypeScriptTypes } from 'node:module';
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) specifier = new URL(specifier.slice(2), ${JSON.stringify(root)}).href;
    try { return await nextResolve(specifier, context); }
    catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('file:')) && !/\\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.ts', context);
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
`)}`, import.meta.url);
await import("../tests/handoff.test.ts");

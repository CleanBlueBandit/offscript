import { register } from "node:module";

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
await import("../tests/research.test.ts");

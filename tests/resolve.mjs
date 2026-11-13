// Resolve hook used by tests/register.mjs (see there).
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

function findSource(base) {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (isFile(c)) return c;
  return null;
}

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
  else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith("file:") && context.parentURL.endsWith(".ts"))
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  const file = base && findSource(base);
  return next(file ? pathToFileURL(file).href : specifier, context);
}

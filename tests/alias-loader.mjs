// Lets Node's built-in test runner load the app's TypeScript the way Next does:
// "@/x" maps to the repo root (tsconfig "paths"), and extensionless imports
// resolve to .ts/.tsx. Node strips the types itself (Node 22.18+), so the tests
// need no extra dependencies.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTS = ["", ".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:"))
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  if (base && !path.extname(base)) {
    for (const ext of EXTS) {
      const candidate = base + ext;
      if (ext && existsSync(candidate)) return next(pathToFileURL(candidate).href, context);
    }
  }
  if (base && specifier.startsWith("@/")) return next(pathToFileURL(base).href, context);
  return next(specifier, context);
}

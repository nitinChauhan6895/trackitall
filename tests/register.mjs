// Lets `node --test` run the TypeScript tests with no extra dependencies:
// Node strips the types itself; this hook maps the "@/..." alias from
// tsconfig.json to the repo root and adds the ".ts" extension Next omits.
import { register } from "node:module";

register("./resolve.mjs", import.meta.url);

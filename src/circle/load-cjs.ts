import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));

export function loadCjs<T>(id: string): T {
  return require(id) as T;
}

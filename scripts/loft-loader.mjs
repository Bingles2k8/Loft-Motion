/**
 * Loft Motion — Node ESM resolve hook for headless tooling (CLI + MCP server).
 *
 * Lets plain Node run the project's TypeScript agent code directly — no bundler,
 * no extra dependencies. Node 22.18+ strips TypeScript types natively; this hook
 * only teaches the resolver two things the project relies on:
 *
 *   1. the `@/…` path alias  →  `<repoRoot>/src/…`
 *   2. extensionless imports →  resolve to `.ts` / `.tsx` / `index.ts`
 *
 * Register it before importing any agent module:
 *   import { register } from "node:module";
 *   register(new URL("./loft-loader.mjs", import.meta.url), import.meta.url);
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Resolve a filesystem base path to a concrete module file. */
function probe(base) {
  if (path.extname(base) && isFile(base)) return base;
  for (const e of EXTS) if (isFile(base + e)) return base + e;
  for (const e of EXTS) {
    const idx = path.join(base, "index" + e);
    if (isFile(idx)) return idx;
  }
  return null;
}

const TS_EXT = new Set([".ts", ".tsx", ".mts"]);

function resolution(hit) {
  return {
    url: pathToFileURL(hit).href,
    shortCircuit: true,
    // Tell Node to strip types and treat as ESM (no typeless-package warning).
    format: TS_EXT.has(path.extname(hit)) ? "module-typescript" : undefined,
  };
}

export async function resolve(specifier, context, next) {
  // `@/…` alias → repo src.
  if (specifier.startsWith("@/")) {
    const hit = probe(path.join(SRC, specifier.slice(2)));
    if (hit) return resolution(hit);
  }
  // Relative imports that omit their extension (or resolve to a directory).
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    if (!isFile(target)) {
      const hit = probe(target);
      if (hit) return resolution(hit);
    }
  }
  return next(specifier, context);
}

/** Repo root, exported for callers that need to locate other project files. */
export const repoRoot = ROOT;

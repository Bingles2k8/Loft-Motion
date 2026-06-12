#!/usr/bin/env node
/**
 * Loft Motion — MCP server (development runner).
 *
 * Runs the shared server core (`server.ts`) directly from TypeScript via the
 * project's Node resolve hook + native type-stripping — no build step. This is
 * what `npm run mcp` launches.
 *
 * For a one-click Claude Desktop install, build the bundled extension instead:
 *   npm run build:mcpb     →   dist/loft-motion.mcpb
 * (The bundle precompiles this same `server.ts`, so it needs no loader and no
 * particular Node version.)
 */
import { register } from "node:module";

register(new URL("../scripts/loft-loader.mjs", import.meta.url), import.meta.url);

await import("./server.ts");

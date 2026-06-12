#!/usr/bin/env node
/**
 * Build the Claude Desktop one-click extension: dist/loft-motion.mcpb
 *
 * Steps:
 *   1. esbuild bundles mcp-server/server.ts into a single self-contained
 *      CommonJS file (zod inlined, `@/` paths resolved). No type-stripping and
 *      no node_modules are needed at runtime, so it works on any Node ≥ 18 that
 *      Claude Desktop ships.
 *   2. Writes the MCPB manifest.
 *   3. Packs the staging folder into a .mcpb with the official @anthropic-ai/mcpb.
 */
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, rmSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGE = path.join(ROOT, "mcp-server", ".bundle");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "loft-motion.mcpb");
const VERSION = JSON.parse(
  (await import("node:fs")).readFileSync(path.join(ROOT, "package.json"), "utf8"),
).version || "0.1.0";

/* 1 — bundle the server -------------------------------------------------- */
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(path.join(STAGE, "server"), { recursive: true });

await esbuild.build({
  absWorkingDir: ROOT,
  entryPoints: [path.join(ROOT, "mcp-server/server.ts")],
  outfile: path.join(STAGE, "server", "index.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  tsconfig: path.join(ROOT, "tsconfig.json"),
  minify: true,
  legalComments: "none",
  logLevel: "info",
});

/* 2 — manifest ----------------------------------------------------------- */
// Track the newest manifest version the installed packer (and therefore a
// current Claude Desktop) understands, so a recent app doesn't reject an older
// schema value.
let MANIFEST_VERSION = "0.2";
try {
  const latest = JSON.parse(
    (await import("node:fs")).readFileSync(
      path.join(ROOT, "node_modules/@anthropic-ai/mcpb/schemas/mcpb-manifest-latest.schema.json"),
      "utf8",
    ),
  );
  MANIFEST_VERSION = latest?.properties?.manifest_version?.const ?? MANIFEST_VERSION;
} catch {
  /* fall back to 0.2 */
}

const TOOLS = [
  { name: "get_guide", description: "The Loft Motion authoring guide (read first)." },
  { name: "get_spec_schema", description: "JSON Schema for an AnimationSpec." },
  { name: "get_example_spec", description: "A sample AnimationSpec to adapt." },
  { name: "describe_vocabulary", description: "Every preset name the spec accepts." },
  { name: "create_project", description: "Compile a spec into a Loft Motion .loft.json project." },
];

const manifest = {
  manifest_version: MANIFEST_VERSION,
  name: "loft-motion",
  display_name: "Loft Motion",
  version: VERSION,
  description: "Author Loft Motion animations from a text prompt — get back an editable project.",
  long_description:
    "Drive Loft Motion with Claude. Describe an animation in words; Claude writes a small " +
    "AnimationSpec and this server compiles it into a real, beautiful Loft Motion project " +
    "(.loft.json) you can open in the app and export to video, Lottie or CSS.",
  author: { name: "Loft Motion" },
  homepage: "https://fanciful-bonbon-5ab3b6.netlify.app/",
  license: "MIT",
  keywords: ["animation", "motion-design", "loft-motion", "video", "lottie"],
  server: {
    type: "node",
    entry_point: "server/index.cjs",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/server/index.cjs"],
    },
  },
  tools: TOOLS,
  compatibility: {
    runtimes: { node: ">=18.0.0" },
  },
};
if (existsSync(path.join(ROOT, "mcp-server", "icon.png"))) {
  manifest.icon = "icon.png";
  copyFileSync(path.join(ROOT, "mcp-server", "icon.png"), path.join(STAGE, "icon.png"));
}
writeFileSync(path.join(STAGE, "manifest.json"), JSON.stringify(manifest, null, 2));

/* 3 — pack --------------------------------------------------------------- */
mkdirSync(DIST, { recursive: true });
rmSync(OUT, { force: true });
const mcpbBin = path.join(ROOT, "node_modules", ".bin", "mcpb");
execFileSync(mcpbBin, ["validate", path.join(STAGE, "manifest.json")], { stdio: "inherit" });
execFileSync(mcpbBin, ["pack", STAGE, OUT], { stdio: "inherit" });

console.log("\n✓ Built " + path.relative(ROOT, OUT));

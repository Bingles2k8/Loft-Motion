#!/usr/bin/env node
/**
 * Loft Motion — Agent CLI.
 *
 * A zero-dependency command line that lets an LLM (or a human) turn an
 * AnimationSpec into a Loft Motion project headlessly. It runs the project's
 * real TypeScript compiler via the loader hook — no build step, no extra deps.
 *
 *   node scripts/loft-agent.mjs guide              # print the authoring guide
 *   node scripts/loft-agent.mjs schema             # print the JSON Schema
 *   node scripts/loft-agent.mjs example            # print a sample spec
 *   node scripts/loft-agent.mjs build spec.json    # spec → project (stdout)
 *   node scripts/loft-agent.mjs build spec.json -o out.loft.json
 *   cat spec.json | node scripts/loft-agent.mjs build   # read spec from stdin
 *
 * The produced `.loft.json` opens directly in Loft Motion. (To get a *video*,
 * render the project in the browser engine — see docs/LLM_AGENT.md.)
 */
import { register } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

register(new URL("./loft-loader.mjs", import.meta.url), import.meta.url);

const agent = await import("@/lib/agent");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const args = { _: [], out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o" || a === "--out") args.out = argv[++i];
    else if (a === "-h" || a === "--help") args.help = true;
    else args._.push(a);
  }
  return args;
}

const USAGE = `Loft Motion — Agent CLI

Usage:
  loft-agent guide                      Print the LLM authoring guide
  loft-agent schema                     Print the AnimationSpec JSON Schema
  loft-agent example                    Print a sample AnimationSpec
  loft-agent build [spec.json] [-o out] Compile a spec into a .loft.json project
                                        (reads stdin when no file is given)

Examples:
  node scripts/loft-agent.mjs example > spec.json
  node scripts/loft-agent.mjs build spec.json -o teaser.loft.json
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (args.help || !cmd) {
    process.stdout.write(USAGE);
    return;
  }

  switch (cmd) {
    case "guide":
      process.stdout.write(agent.LOFT_AGENT_GUIDE + "\n");
      return;
    case "schema":
      process.stdout.write(JSON.stringify(agent.specJsonSchema(), null, 2) + "\n");
      return;
    case "example":
      process.stdout.write(JSON.stringify(agent.exampleSpec(), null, 2) + "\n");
      return;
    case "build": {
      const file = args._[1];
      const input = file ? readFileSync(file, "utf8") : readStdin();
      if (!input.trim()) {
        process.stderr.write("No spec provided. Pass a file or pipe JSON on stdin.\n\n" + USAGE);
        process.exitCode = 2;
        return;
      }
      let result;
      try {
        result = agent.generateProject(input);
      } catch (e) {
        process.stderr.write((e?.message ?? String(e)) + "\n");
        process.exitCode = 1;
        return;
      }
      for (const n of result.notes) process.stderr.write("note: " + n + "\n");
      if (args.out) {
        writeFileSync(args.out, result.json);
        process.stderr.write(
          `Wrote ${args.out} — ${result.scene.layers.length} layers, ` +
            `${result.scene.composition.width}×${result.scene.composition.height}, ` +
            `${result.scene.composition.duration}s @ ${result.scene.composition.fps}fps\n`,
        );
      } else {
        process.stdout.write(result.json + "\n");
      }
      return;
    }
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n` + USAGE);
      process.exitCode = 2;
  }
}

main();

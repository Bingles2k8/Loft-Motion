#!/usr/bin/env node
/**
 * Loft Motion — Model Context Protocol (MCP) server.
 *
 * Exposes Loft Motion to any MCP client (Claude Desktop, IDEs, agents) so an LLM
 * can author animations from a text prompt and get back a Loft Motion project.
 * It speaks MCP's JSON-RPC 2.0 over stdio with **zero dependencies** — the
 * protocol is hand-implemented and the real TypeScript compiler is loaded via
 * the project's resolve hook (Node strips the types natively).
 *
 * Tools:
 *   • get_guide            – the LLM authoring guide (read this first)
 *   • get_spec_schema      – JSON Schema for an AnimationSpec
 *   • get_example_spec     – a representative sample spec
 *   • describe_vocabulary  – every preset name the spec accepts
 *   • create_project       – compile a spec → a Loft Motion .loft.json project
 *
 * Register it with a client, e.g. in Claude Desktop's config:
 *   {
 *     "mcpServers": {
 *       "loft-motion": {
 *         "command": "node",
 *         "args": ["/abs/path/to/mcp-server/loft-motion-mcp.mjs"]
 *       }
 *     }
 *   }
 */
import { register } from "node:module";
import { writeFileSync } from "node:fs";
import process from "node:process";

register(new URL("../scripts/loft-loader.mjs", import.meta.url), import.meta.url);

const agent = await import("@/lib/agent");

const SERVER_INFO = { name: "loft-motion", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";

/* -------------------------------------------------------------------------- */
/*  Tool definitions                                                          */
/* -------------------------------------------------------------------------- */

function specSchemaNested() {
  const s = agent.specJsonSchema();
  // Strip the dialect marker so it nests cleanly inside another schema.
  const { $schema, ...rest } = s;
  void $schema;
  return rest;
}

const TOOLS = [
  {
    name: "get_guide",
    description:
      "Return the Loft Motion authoring guide: how to turn a text prompt into an " +
      "AnimationSpec, with the full preset vocabulary and an example. Read this first.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_spec_schema",
    description: "Return the JSON Schema (draft 2020-12) an AnimationSpec must satisfy.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_example_spec",
    description: "Return a representative example AnimationSpec to adapt.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "describe_vocabulary",
    description:
      "List every preset the spec accepts: sizes, placements, entrances, exits, " +
      "emphasis, effects, easings.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_project",
    description:
      "Compile an AnimationSpec into a Loft Motion project (.loft.json). Returns the " +
      "project JSON; if `path` is given, also writes it to disk. On an invalid spec " +
      "it returns the validation errors so you can correct and retry.",
    inputSchema: {
      type: "object",
      properties: {
        spec: specSchemaNested(),
        path: {
          type: "string",
          description: "Optional absolute file path to write the .loft.json to.",
        },
      },
      required: ["spec"],
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  Tool implementations                                                      */
/* -------------------------------------------------------------------------- */

function vocabulary() {
  const s = agent;
  return {
    sizes: Object.keys(s.SIZE_PRESETS),
    placements: s.POSITION_PRESETS,
    entrances: s.ENTER_PRESETS,
    exits: s.EXIT_PRESETS,
    emphasis: s.EMPHASIS_PRESETS,
    effects: s.EFFECT_PRESETS,
  };
}

function callTool(name, args) {
  switch (name) {
    case "get_guide":
      return text(agent.LOFT_AGENT_GUIDE);
    case "get_spec_schema":
      return text(JSON.stringify(agent.specJsonSchema(), null, 2));
    case "get_example_spec":
      return text(JSON.stringify(agent.exampleSpec(), null, 2));
    case "describe_vocabulary":
      return text(JSON.stringify(vocabulary(), null, 2));
    case "create_project": {
      if (args?.spec == null) return errText("Missing required argument: spec");
      let result;
      try {
        result = agent.generateProject(args.spec);
      } catch (e) {
        return errText(e?.message ?? String(e));
      }
      let head = `Compiled "${result.scene.name}" — ${result.scene.layers.length} layers, ` +
        `${result.scene.composition.width}×${result.scene.composition.height}, ` +
        `${result.scene.composition.duration}s @ ${result.scene.composition.fps}fps.`;
      if (result.notes.length) head += "\nNotes:\n- " + result.notes.join("\n- ");
      if (args.path) {
        try {
          writeFileSync(args.path, result.json);
          head += `\nWrote project to ${args.path}.`;
        } catch (e) {
          head += `\nCould not write to ${args.path}: ${e?.message ?? e}`;
        }
      }
      return text(head + "\n\n" + result.json);
    }
    default:
      return errText(`Unknown tool: ${name}`);
  }
}

const text = (t) => ({ content: [{ type: "text", text: t }] });
const errText = (t) => ({ content: [{ type: "text", text: t }], isError: true });

/* -------------------------------------------------------------------------- */
/*  JSON-RPC 2.0 over stdio (newline-delimited)                               */
/* -------------------------------------------------------------------------- */

function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "tools/list":
      return reply(id, { tools: TOOLS });
    case "tools/call":
      return reply(id, callTool(params?.name, params?.arguments ?? {}));
    case "ping":
      return reply(id, {});
    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // notifications get no response
    default:
      if (!isRequest) return null;
      return error(id, -32601, `Method not found: ${method}`);
  }
}

function reply(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function error(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function send(obj) {
  if (obj == null) return;
  process.stdout.write(JSON.stringify(obj) + "\n");
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send(error(null, -32700, "Parse error"));
      continue;
    }
    try {
      send(handle(msg));
    } catch (e) {
      send(error(msg?.id ?? null, -32603, e?.message ?? "Internal error"));
    }
  }
});
process.stdin.on("end", () => process.exit(0));

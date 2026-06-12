/**
 * Loft Motion — MCP server core (shared by the dev runner and the .mcpb bundle).
 *
 * Speaks MCP's JSON-RPC 2.0 over stdio with the standard tool set. It imports the
 * agent compiler statically (`@/lib/agent`) so it can be bundled with esbuild
 * into a single dependency-free file for the Claude Desktop extension — and run
 * directly via the Node loader hook during development. Importing this module
 * starts the server (it attaches stdin listeners immediately).
 */
import { writeFileSync } from "node:fs";
import process from "node:process";
import * as agent from "@/lib/agent";

const SERVER_INFO = { name: "loft-motion", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";

/* -------------------------------------------------------------------------- */
/*  Tool definitions                                                          */
/* -------------------------------------------------------------------------- */

function specSchemaNested(): Record<string, unknown> {
  const s = agent.specJsonSchema();
  // Strip the dialect marker so it nests cleanly inside another schema.
  const { $schema, ...rest } = s as Record<string, unknown>;
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
      "emphasis, effects.",
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

interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}
const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });
const errText = (t: string): ToolResult => ({ content: [{ type: "text", text: t }], isError: true });

function vocabulary() {
  return {
    sizes: Object.keys(agent.SIZE_PRESETS),
    placements: agent.POSITION_PRESETS,
    entrances: agent.ENTER_PRESETS,
    exits: agent.EXIT_PRESETS,
    emphasis: agent.EMPHASIS_PRESETS,
    effects: agent.EFFECT_PRESETS,
  };
}

function callTool(name: string, args: Record<string, unknown>): ToolResult {
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
        return errText(e instanceof Error ? e.message : String(e));
      }
      let head =
        `Compiled "${result.scene.name}" — ${result.scene.layers.length} layers, ` +
        `${result.scene.composition.width}×${result.scene.composition.height}, ` +
        `${result.scene.composition.duration}s @ ${result.scene.composition.fps}fps.`;
      if (result.notes.length) head += "\nNotes:\n- " + result.notes.join("\n- ");
      const path = args.path;
      if (typeof path === "string" && path) {
        try {
          writeFileSync(path, result.json);
          head += `\nWrote project to ${path}.`;
        } catch (e) {
          head += `\nCould not write to ${path}: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      return text(head + "\n\n" + result.json);
    }
    default:
      return errText(`Unknown tool: ${name}`);
  }
}

/* -------------------------------------------------------------------------- */
/*  JSON-RPC 2.0 over stdio (newline-delimited)                               */
/* -------------------------------------------------------------------------- */

interface RpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function handle(msg: RpcMessage): object | null {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: (params?.protocolVersion as string) ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "tools/list":
      return reply(id, { tools: TOOLS });
    case "tools/call":
      return reply(
        id,
        callTool(params?.name as string, (params?.arguments as Record<string, unknown>) ?? {}),
      );
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

function reply(id: RpcMessage["id"], result: object) {
  return { jsonrpc: "2.0", id, result };
}
function error(id: RpcMessage["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function send(obj: object | null) {
  if (obj == null) return;
  process.stdout.write(JSON.stringify(obj) + "\n");
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buf += chunk;
  let nl: number;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line);
    } catch {
      send(error(null, -32700, "Parse error"));
      continue;
    }
    try {
      send(handle(msg));
    } catch (e) {
      send(error(msg?.id ?? null, -32603, e instanceof Error ? e.message : "Internal error"));
    }
  }
});
process.stdin.on("end", () => process.exit(0));

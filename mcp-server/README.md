# Loft Motion MCP server

A zero-dependency [Model Context Protocol](https://modelcontextprotocol.io)
server that lets an LLM author Loft Motion animations from a text prompt and get
back a Loft Motion project (`.loft.json`).

It speaks MCP's JSON-RPC 2.0 over stdio. There are two ways to install it.

## Option A — One-click for Claude Desktop (recommended)

A prebuilt **MCP Bundle** lives at [`dist/loft-motion.mcpb`](../dist/loft-motion.mcpb).
It is fully self-contained (the TypeScript is precompiled and `zod` is bundled),
so it needs no repo checkout, no `npm install`, and no particular Node version —
Claude Desktop runs it with its own bundled runtime.

1. Open **Claude Desktop → Settings → Extensions**.
2. Drag `loft-motion.mcpb` onto the window (or double-click the file), then click **Install**.
3. Start a chat: *"Use Loft Motion to make a 6-second square teaser…"*

> The bundle is unsigned (a self-distributed extension), so Claude Desktop may
> label it "unverified" — that's expected; click through to install.

### Rebuilding the bundle

```bash
npm install
npm run build:mcpb     # -> dist/loft-motion.mcpb
```

`scripts/build-mcpb.mjs` esbuild-bundles `server.ts` (resolving `@/` paths and
inlining `zod`) into one CommonJS file, writes the manifest, and packs it with
the official `@anthropic-ai/mcpb` tool. Run `npm run make:icon` to regenerate the
icon.

## Option B — Run from source (dev, or other clients)

```bash
npm install          # once, for the zod runtime the compiler uses
npm run mcp          # runs server.ts via Node's type-stripping (needs Node >= 22.18)
```

Then point any MCP client at the absolute path. Claude Desktop
(`claude_desktop_config.json`):

```jsonc
{
  "mcpServers": {
    "loft-motion": {
      "command": "node",
      "args": ["/abs/path/to/Loft-Motion/mcp-server/loft-motion-mcp.mjs"]
    }
  }
}
```

Both options expose the exact same server (`server.ts`).

## Tools

| Tool | Input | Returns |
|---|---|---|
| `get_guide` | — | The LLM authoring guide (read first). |
| `get_spec_schema` | — | JSON Schema for an `AnimationSpec`. |
| `get_example_spec` | — | A sample spec to adapt. |
| `describe_vocabulary` | — | Every preset name the spec accepts. |
| `create_project` | `{ spec, path? }` | Compiles the spec into a `.loft.json` project (writes it to `path` if given). Invalid specs come back as errors to self-correct on. |

## Suggested flow for the model

1. Call `get_guide` (and `get_spec_schema`) once to learn the format.
2. Turn the user's prompt into an `AnimationSpec`.
3. Call `create_project` with that spec.
4. On a validation error, read the message, fix the spec, and retry.

To deliver a **video** (rather than a project), render the project in the
browser engine — see `docs/LLM_AGENT.md`.

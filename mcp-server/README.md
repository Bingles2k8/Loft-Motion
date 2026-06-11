# Loft Motion MCP server

A zero-dependency [Model Context Protocol](https://modelcontextprotocol.io)
server that lets an LLM author Loft Motion animations from a text prompt and get
back a Loft Motion project (`.loft.json`).

It speaks MCP's JSON-RPC 2.0 over stdio and runs the project's real TypeScript
compiler directly (no build step, no dependencies — Node ≥ 22.18 strips the
types natively via `scripts/loft-loader.mjs`).

## Run it

```bash
npm install          # once, for the zod runtime the compiler uses
npm run mcp          # or: node mcp-server/loft-motion-mcp.mjs
```

## Connect a client

Claude Desktop (`claude_desktop_config.json`):

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

Any MCP-capable client works the same way — give it the absolute path to
`loft-motion-mcp.mjs`.

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

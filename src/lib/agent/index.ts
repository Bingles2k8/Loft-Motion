/**
 * Loft Motion — Agent public API.
 *
 * The single import surface for everything LLM-facing: the spec types, the
 * compiler, the authoring guide / JSON Schema, and a couple of convenience
 * entry points that go straight from "spec (object or JSON string)" to a
 * ready-to-use Loft Motion project.
 */
export * from "@/lib/agent/spec";
export * from "@/lib/agent/compile";
export {
  LOFT_AGENT_GUIDE,
  specJsonSchema,
  exampleSpec,
} from "@/lib/agent/prompt";

import { exportSceneJson } from "@/lib/io/file";
import { safeParseSpec, type AnimationSpec } from "@/lib/agent/spec";
import { compileSpec } from "@/lib/agent/compile";
import type { SceneDocument } from "@/lib/scene/schema";

export interface GenerateResult {
  scene: SceneDocument;
  /** Pretty-printed `.loft.json` project string, ready to save. */
  json: string;
  /** Non-fatal compile notes. */
  notes: string[];
}

export class SpecError extends Error {
  issues: { path: string; message: string }[];
  constructor(issues: { path: string; message: string }[]) {
    super(
      "Invalid AnimationSpec:\n" +
        issues.map((i) => `  • ${i.path || "(root)"}: ${i.message}`).join("\n"),
    );
    this.name = "SpecError";
    this.issues = issues;
  }
}

/**
 * Validate + compile a spec (object or JSON string) into a Loft Motion project.
 * Throws {@link SpecError} with friendly, path-pointed issues on invalid input —
 * exactly what an LLM needs to self-correct.
 */
export function generateProject(input: AnimationSpec | string | unknown): GenerateResult {
  let data: unknown = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch (e) {
      throw new SpecError([{ path: "", message: `not valid JSON — ${(e as Error).message}` }]);
    }
  }
  const parsed = safeParseSpec(data);
  if (!parsed.success) {
    throw new SpecError(
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  const { scene, notes } = compileSpec(parsed.data);
  return { scene, json: exportSceneJson(scene), notes };
}

"use client";

/**
 * Loft Motion — Agent panel.
 *
 * The human-facing front door to the LLM authoring layer: paste an AnimationSpec
 * (the same JSON an LLM produces from a text prompt) and "Build" it straight
 * into the live scene — then scrub, tweak, and export to a project or a video.
 * Also surfaces the guide + JSON Schema so you can hand them to any model.
 */
import { useState } from "react";
import { useStore } from "@/lib/store/useStore";
import {
  generateProject,
  exampleSpec,
  LOFT_AGENT_GUIDE,
  specJsonSchema,
} from "@/lib/agent";

const EXAMPLE_JSON = JSON.stringify(exampleSpec(), null, 2);

export function AgentPanel() {
  const show = useStore((s) => s.showAgent);
  const setShow = useStore((s) => s.setShowAgent);
  const loadScene = useStore((s) => s.loadScene);
  const setShowExport = useStore((s) => s.setShowExport);

  const [text, setText] = useState(EXAMPLE_JSON);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [built, setBuilt] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!show) return null;

  const build = () => {
    setError(null);
    setNotes([]);
    setBuilt(null);
    try {
      const { scene, notes } = generateProject(text);
      loadScene(scene);
      setNotes(notes);
      setBuilt(
        `Built "${scene.name}" — ${scene.layers.length} layers, ` +
          `${scene.composition.width}×${scene.composition.height}, ` +
          `${scene.composition.duration}s. It's live on the stage.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
      onClick={() => setShow(false)}
    >
      <div
        className="flex h-[82vh] max-h-[720px] w-full max-w-4xl overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: what this is */}
        <div className="flex w-72 shrink-0 flex-col border-r border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-4 py-3.5">
            <div className="text-sm font-bold text-haze-200">Animate from a prompt</div>
            <div className="mt-0.5 text-[11px] text-haze-500">LLM → AnimationSpec → motion</div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-[11px] leading-relaxed text-haze-300">
            <p>
              Ask any LLM to write an <b>AnimationSpec</b> from your idea, paste the
              JSON here, and <b>Build</b> it into the scene. Then export a
              <b> project</b> to keep editing, or a <b>video</b> to share.
            </p>
            <p className="mt-3 text-haze-400">
              Hand your model the guide and schema so it knows the format:
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              <CopyBtn label="guide" active={copied === "guide"} onClick={() => copy("guide", LOFT_AGENT_GUIDE)}>
                Copy authoring guide
              </CopyBtn>
              <CopyBtn
                label="schema"
                active={copied === "schema"}
                onClick={() => copy("schema", JSON.stringify(specJsonSchema(), null, 2))}
              >
                Copy JSON Schema
              </CopyBtn>
              <CopyBtn label="example" active={copied === "example"} onClick={() => copy("example", EXAMPLE_JSON)}>
                Copy example spec
              </CopyBtn>
            </div>
            <p className="mt-4 text-haze-500">
              Tip: an automated agent can skip this panel — open the app with
              <code className="mx-1 rounded bg-ink-800 px-1 text-[10px]">?spec=…&amp;export=mp4&amp;download=1</code>
              or call <code className="rounded bg-ink-800 px-1 text-[10px]">window.LoftAgent</code>.
            </p>
          </div>
        </div>

        {/* Right: the spec editor */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-haze-200">AnimationSpec</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setText(EXAMPLE_JSON);
                  setError(null);
                  setBuilt(null);
                  setNotes([]);
                }}
                className="text-[11px] text-haze-400 transition hover:text-haze-200"
              >
                Reset to example
              </button>
              <button
                onClick={() => setShow(false)}
                className="text-haze-400 transition hover:text-haze-200"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 w-full resize-none rounded-lg border border-ink-700 bg-ink-900 p-3 font-mono text-[11px] leading-relaxed text-haze-200 focus:border-brand-500/50 focus:outline-none"
            />

            {error && (
              <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] text-rose-200">
                {error}
              </pre>
            )}
            {built && (
              <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-[11px] text-emerald-200">
                {built}
              </div>
            )}
            {notes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {notes.map((n, i) => (
                  <li key={i} className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-1.5 text-[11px] text-amber-200">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-ink-700 px-5 py-3">
            <div className="flex-1" />
            {built && (
              <button
                onClick={() => {
                  setShow(false);
                  setShowExport(true);
                }}
                className="rounded px-3 py-2 text-xs font-medium text-haze-300 transition hover:bg-ink-700 hover:text-haze-200"
              >
                Export…
              </button>
            )}
            <button
              onClick={build}
              className="rounded bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-400"
            >
              Build animation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyBtn({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-left text-[11px] transition ${
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-ink-700 bg-ink-850 text-haze-300 hover:border-ink-600 hover:text-haze-200"
      }`}
    >
      {children}
      <span>{active ? "Copied ✓" : "Copy"}</span>
    </button>
  );
}

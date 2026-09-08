import { useState } from "react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { go } from "../lib/nav";
import { Input } from "../components/ui/input";
import { SegmentedControl } from "../components/ui/segmented-control";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

const SUGGESTIONS = [
  "Summarize unread support threads",
  "Draft a polite follow-up",
  "Find invoices from last week",
  "Clean up newsletters",
];

export default function AiAssistantPage() {
  const [allowed, setAllowed] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [tab, setTab] = useState<"chat" | "automations" | "style">("chat");

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setLog((prev) => [
      ...prev,
      { role: "user", text: q },
      {
        role: "assistant",
        text: "This is an interface preview. Inbox-wide AI conversations are not connected yet. You can use the existing message assistant from an individual email; no message has been sent.",
      },
    ]);
    setPrompt("");
  }

  return (
    <AppFeaturePage
      current="ai"
      title="AI assistant"
      subtitle="Ask your inbox in plain language. Nothing sends without your approval."
      actions={
        <SegmentedControl
          aria-label="Assistant views"
          value={tab}
          onChange={(v) => setTab(v as "chat" | "automations" | "style")}
          options={[
            { value: "chat", label: "Chat" },
            { value: "automations", label: "Automations" },
            { value: "style", label: "Writing style" },
          ]}
        />
      }
    >
      <p className="mb-4 rounded-[10px] border border-dashed border-[var(--line-strong)] px-3.5 py-3 text-[13px] text-[var(--foreground-muted)]" role="status">Preview · Conversational AI and writing profiles are not connected yet. <button type="button" className="underline" onClick={() => go("/app")}>Open your inbox</button></p>
      {!allowed ? (
        <div className={tw.appFeatureCard}>
          <h2>Meet your future email assistant</h2>
          <p className={tw.muted}>
            Explore suggested prompts and the conversation layout. This preview does not read your messages or send data to an AI provider.
          </p>
          <div className={cn("gap-2 mt-4", tw.stack)} style={{ maxWidth: 280 }}>
            <Button type="button" onClick={() => setAllowed(true)}>
              Explore the preview
            </Button>
            <Button type="button" variant="secondary" onClick={() => go("/app")}>
              Back to inbox
            </Button>
          </div>
        </div>
      ) : tab === "chat" ? (
        <div className="flex min-h-[420px] flex-col gap-3.5">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:border-[var(--accent)]" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex min-h-[240px] flex-1 flex-col gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            {log.length === 0 ? (
              <p className={tw.muted}>Your conversations will appear here.</p>
            ) : (
              log.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-[14px] px-3 py-2.5 text-sm leading-[1.45]",
                    m.role === "user"
                      ? "self-end bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "self-start bg-[var(--surface-hover)] text-[var(--foreground)]",
                  )}
                >
                  {m.text}
                </div>
              ))
            )}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(prompt);
            }}
          >
            <Input
              aria-label="Preview prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask your inbox anything…"
            />
            <Button type="submit" disabled={!prompt.trim()}>Try prompt</Button>
          </form>
        </div>
      ) : tab === "automations" ? (
        <div className={tw.appFeatureCard}>
          <h2>Automations in plain language</h2>
          <p className={tw.muted}>
            Plain-language automations are planned. You can manage existing email rules in Settings.
          </p>
        </div>
      ) : (
        <div className={tw.appFeatureCard}>
          <h2>Writing style</h2>
          <p className={tw.muted}>
            Writing profiles are planned. Saved profiles and automatic tone matching are not available yet.
          </p>
        </div>
      )}
    </AppFeaturePage>
  );
}

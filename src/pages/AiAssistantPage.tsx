import { useState } from "react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { go } from "../lib/nav";
import { Input } from "../components/ui/input";

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
        <div className="seg-toggle">
          {(["chat", "automations", "style"] as const).map((t) => (
            <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t === "chat" ? "Chat" : t === "automations" ? "Automations" : "Writing style"}
            </button>
          ))}
        </div>
      }
    >
      <p className="deferred-banner" role="status">Preview · Conversational AI and writing profiles are not connected yet. <button type="button" className="underline" onClick={() => go("/app")}>Open your inbox</button></p>
      {!allowed ? (
        <div className="app-feature-card">
          <h2>Meet your future email assistant</h2>
          <p className="muted">
            Explore suggested prompts and the conversation layout. This preview does not read your messages or send data to an AI provider.
          </p>
          <div className="stack gap-2 mt-4" style={{ maxWidth: 280 }}>
            <Button type="button" onClick={() => setAllowed(true)}>
              Explore the preview
            </Button>
            <Button type="button" variant="secondary" onClick={() => go("/app")}>
              Back to inbox
            </Button>
          </div>
        </div>
      ) : tab === "chat" ? (
        <div className="ai-chat">
          <div className="ai-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="ai-chip" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="ai-log">
            {log.length === 0 ? (
              <p className="muted">Your conversations will appear here.</p>
            ) : (
              log.map((m, i) => (
                <div key={i} className={`ai-bubble ${m.role}`}>
                  {m.text}
                </div>
              ))
            )}
          </div>
          <form
            className="ai-compose"
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
        <div className="app-feature-card">
          <h2>Automations in plain language</h2>
          <p className="muted">
            Plain-language automations are planned. You can manage existing email rules in Settings.
          </p>
        </div>
      ) : (
        <div className="app-feature-card">
          <h2>Writing style</h2>
          <p className="muted">
            Writing profiles are planned. Saved profiles and automatic tone matching are not available yet.
          </p>
        </div>
      )}
    </AppFeaturePage>
  );
}

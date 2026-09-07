import { useEffect, useMemo, useRef, useState } from "react";
import type { Domain } from "../lib/api";
import { FOLDERS } from "../lib/mailFolders";

export type CommandAction = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
};

const SETTINGS_TABS: Array<{ id: string; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "compose", label: "Compose" },
  { id: "contacts", label: "Contacts" },
  { id: "filters", label: "Filters" },
  { id: "aliases", label: "Aliases" },
  { id: "delivery", label: "Delivery" },
  { id: "developers", label: "Developers" },
  { id: "privacy", label: "Privacy" },
  { id: "billing", label: "Billing" },
  { id: "team", label: "Team" },
  { id: "referrals", label: "Referrals" },
];

export default function CommandPalette({
  open,
  onClose,
  domains,
  onCompose,
  onFolder,
  onDomain,
  onSearchFocus,
  onSettings,
}: {
  open: boolean;
  onClose: () => void;
  domains: Domain[];
  onCompose: () => void;
  onFolder: (id: string) => void;
  onDomain: (domainId: string) => void;
  onSearchFocus: () => void;
  onSettings: (tab?: string) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo<CommandAction[]>(() => {
    const list: CommandAction[] = [
      { id: "compose", label: "Compose new message", hint: "c", group: "Actions", run: onCompose },
      { id: "search", label: "Focus search", hint: "/", group: "Actions", run: onSearchFocus },
      ...FOLDERS.map((f) => ({
        id: `folder-${f.id}`,
        label: `Go to ${f.label}`,
        group: "Folders",
        run: () => onFolder(f.id),
      })),
      ...domains.map((d) => ({
        id: `domain-${d.id}`,
        label: `Jump to ${d.name}`,
        group: "Domains",
        run: () => onDomain(d.id),
      })),
      {
        id: "settings",
        label: "Open Settings",
        group: "Settings",
        run: () => onSettings(),
      },
      ...SETTINGS_TABS.map((t) => ({
        id: `settings-${t.id}`,
        label: `Settings · ${t.label}`,
        group: "Settings",
        run: () => onSettings(t.id),
      })),
    ];
    return list;
  }, [domains, onCompose, onDomain, onFolder, onSearchFocus, onSettings]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter(
      (a) => a.label.toLowerCase().includes(needle) || a.group.toLowerCase().includes(needle),
    );
  }, [actions, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  if (!open) return null;

  function runAt(index: number) {
    const action = filtered[index];
    if (!action) return;
    onClose();
    action.run();
  }

  let lastGroup = "";

  return (
    <div className="modal-back command-palette-back" role="presentation" onClick={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-palette-input-wrap">
          <span aria-hidden>⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Compose, jump to domain, open settings…"
            aria-label="Command search"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runAt(active);
              }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul className="command-palette-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="command-palette-empty muted">No matching actions</li>
          ) : (
            filtered.map((action, index) => {
              const showGroup = action.group !== lastGroup;
              lastGroup = action.group;
              return (
                <li key={action.id}>
                  {showGroup ? <div className="command-palette-group">{action.group}</div> : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className={`command-palette-item${index === active ? " active" : ""}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => runAt(index)}
                  >
                    <span>{action.label}</span>
                    {action.hint ? <kbd>{action.hint}</kbd> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
